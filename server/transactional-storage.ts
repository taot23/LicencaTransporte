import { 
  users, type User, type InsertUser,
  vehicles, type Vehicle, type InsertVehicle,
  transporters, type Transporter, type InsertTransporter,
  licenseRequests, type LicenseRequest, type InsertLicenseRequest, type UpdateLicenseStatus, 
  type UpdateLicenseState, LicenseStatus, LicenseType,
  statusHistories, type StatusHistory, type InsertStatusHistory,
  vehicleModels, type VehicleModel, type InsertVehicleModel,
  boletos, type Boleto, type InsertBoleto,
  stateLicenses,
  licencasEmitidas
} from "@shared/schema";
import { eq, and, desc, asc, sql, gt, lt, like, not, isNull, or, count, sum } from "drizzle-orm";
import { db, pool, withTransaction, withRetry } from "./db";
import { IStorage, DashboardStats, ChartData } from "./storage";
import {
  getDashboardStatsCombined,
  getLicensesWithTransporters,
  getVehicleStatsByType,
  getLicenseStatsByState,
  performGlobalSearch,
  getSoonToExpireLicenses
} from "./queries";
import session from "express-session";
import connectPg from "connect-pg-simple";

// Configuração do store de sessão PostgreSQL
const PostgresSessionStore = connectPg(session);

/**
 * Implementação de armazenamento usando PostgreSQL com suporte a transações
 */
export class TransactionalStorage implements IStorage {
  sessionStore: any;

  constructor() {
    this.sessionStore = new PostgresSessionStore({
      pool,
      createTableIfMissing: true
    });
  }
  
  // Métodos relacionados a Usuários
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }
  
  async getUserByEmail(email: string): Promise<User | undefined> {
    return await withRetry(async () => {
      const [user] = await db.select().from(users).where(eq(users.email, email));
      return user;
    });
  }
  
  async createUser(userData: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(userData).returning();
    return user;
  }
  
  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async getNonAdminUsers(): Promise<User[]> {
    return await db.select()
      .from(users)
      .where(
        and(
          eq(users.isAdmin, false),
          eq(users.role, "user")
        )
      );
  }
  
  async updateUser(id: number, userData: Partial<User>): Promise<User> {
    const [updatedUser] = await db
      .update(users)
      .set(userData)
      .where(eq(users.id, id))
      .returning();
    
    if (!updatedUser) {
      throw new Error("Usuário não encontrado");
    }
    
    return updatedUser;
  }
  
  async deleteUser(id: number): Promise<void> {
    // Usando transação para garantir que todas as operações sejam concluídas
    // ou nenhuma delas seja
    await withTransaction(async (tx) => {
      // Primeiro, remover históricos de status relacionados ao usuário
      await tx.delete(statusHistories).where(eq(statusHistories.userId, id));
      
      // Segundo, exclua todos os veículos do usuário
      await tx.delete(vehicles).where(eq(vehicles.userId, id));
      
      // Terceiro, exclua os transportadores do usuário
      await tx.delete(transporters).where(eq(transporters.userId, id));
      
      // Por fim, exclua o usuário
      const result = await tx.delete(users).where(eq(users.id, id)).returning();
      
      if (!result.length) {
        throw new Error("Usuário não encontrado");
      }
    });
  }
  
  // Métodos relacionados a Transportadores
  async getTransporterById(id: number): Promise<Transporter | undefined> {
    const [transporter] = await db
      .select()
      .from(transporters)
      .where(eq(transporters.id, id));
    
    return transporter;
  }
  
  async getTransporterByDocument(documentNumber: string): Promise<Transporter | undefined> {
    const [transporter] = await db
      .select()
      .from(transporters)
      .where(eq(transporters.documentNumber, documentNumber));
    
    return transporter;
  }
  
  async getAllTransporters(): Promise<Transporter[]> {
    return await db.select().from(transporters);
  }
  
  async getTransportersByUserId(userId: number): Promise<Transporter[]> {
    return await db
      .select()
      .from(transporters)
      .where(eq(transporters.userId, userId));
  }
  
  async createTransporter(transporterData: InsertTransporter): Promise<Transporter> {
    const [transporter] = await db
      .insert(transporters)
      .values({
        ...transporterData,
        // Garantir que campos JSON sejam objetos
        subsidiaries: transporterData.subsidiaries || [],
        documents: transporterData.documents || []
      })
      .returning();
    
    return transporter;
  }
  
  async updateTransporter(id: number, transporterData: Partial<Transporter>): Promise<Transporter> {
    const [updatedTransporter] = await db
      .update(transporters)
      .set(transporterData)
      .where(eq(transporters.id, id))
      .returning();
    
    if (!updatedTransporter) {
      throw new Error("Transportador não encontrado");
    }
    
    return updatedTransporter;
  }
  
  async linkTransporterToUser(transporterId: number, userId: number | null): Promise<Transporter> {
    return await withTransaction(async (tx) => {
      // Verificar se o transportador existe
      const transporter = await this.getTransporterById(transporterId);
      if (!transporter) {
        throw new Error("Transportador não encontrado");
      }
      
      // Se userId for null, estamos apenas removendo a vinculação
      if (userId !== null) {
        // Verificar se o usuário existe
        const user = await this.getUser(userId);
        if (!user) {
          throw new Error("Usuário não encontrado");
        }
      }
      
      // Transferir veículos que podem ter sido importados para este transportador
      // mas ficaram sob outros usuários administrativos
      if (userId) {
        console.log(`[LINK USER] Verificando transferência de veículos para usuário ${userId} do transportador ${transporterId}`);
        
        // Por simplicidade, vamos usar uma estratégia baseada em logs para identificar
        // veículos que precisam ser transferidos. Em uma implementação futura,
        // poderia adicionar um campo transporterId na tabela vehicles
        
        // Para agora, o administrador precisará fazer a transferência manual
        // ou re-importar os veículos após vincular o usuário
        console.log(`[LINK USER] Transportador ${transporterId} vinculado ao usuário ${userId}. Veículos existentes podem precisar de transferência manual.`);
      }
      
      // Atualizar o transportador
      const [updatedTransporter] = await tx
        .update(transporters)
        .set({ userId })
        .where(eq(transporters.id, transporterId))
        .returning();
      
      return updatedTransporter;
    });
  }
  
  async deleteTransporter(id: number): Promise<void> {
    // Usando transação para garantir que todas as operações sejam concluídas
    // ou nenhuma delas seja
    await withTransaction(async (tx) => {
      // Primeiro, verifique se não existem licenças associadas
      const licenseCount = await tx
        .select({ count: sql`COUNT(*)` })
        .from(licenseRequests)
        .where(eq(licenseRequests.transporterId, id));

      if (licenseCount.length > 0 && Number(licenseCount[0].count) > 0) {
        throw new Error("Não é possível excluir um transportador que possui licenças associadas");
      }
      
      // Em seguida, exclua o transportador
      const result = await tx
        .delete(transporters)
        .where(eq(transporters.id, id))
        .returning();
      
      if (!result.length) {
        throw new Error("Transportador não encontrado");
      }
    });
  }
  
  // Métodos relacionados a Veículos
  async getVehicleById(id: number): Promise<Vehicle | undefined> {
    const [vehicle] = await db
      .select()
      .from(vehicles)
      .where(eq(vehicles.id, id));
    
    return vehicle;
  }
  
  async getVehicleByPlate(plate: string): Promise<Vehicle | undefined> {
    const [vehicle] = await db
      .select()
      .from(vehicles)
      .where(eq(vehicles.plate, plate));
    
    return vehicle;
  }
  
  async getVehiclesByUserId(userId: number): Promise<Vehicle[]> {
    return await db
      .select()
      .from(vehicles)
      .where(eq(vehicles.userId, userId));
  }
  
  async getAllVehicles(): Promise<Vehicle[]> {
    return await db
      .select()
      .from(vehicles);
  }
  
  async createVehicle(userId: number | null, vehicleData: InsertVehicle & { crlvUrl?: string | null }): Promise<Vehicle> {
    console.log('DEBUG TransactionalStorage createVehicle - vehicleData recebido:', vehicleData);
    
    const [vehicle] = await db
      .insert(vehicles)
      .values({
        userId: userId,
        plate: vehicleData.plate,
        type: vehicleData.type,
        bodyType: vehicleData.bodyType || null,
        brand: vehicleData.brand || null,
        model: vehicleData.model || null,
        year: vehicleData.year || null,
        renavam: vehicleData.renavam || null,
        tare: vehicleData.tare,
        axleCount: vehicleData.axleCount || null,
        remarks: vehicleData.remarks || null,
        crlvYear: vehicleData.crlvYear,
        crlvUrl: vehicleData.crlvUrl || null,
        ownerName: vehicleData.ownerName || null,
        ownershipType: vehicleData.ownershipType || "proprio",
        cmt: vehicleData.cmt || null,
        status: vehicleData.status || "active"
      })
      .returning();
    
    console.log('DEBUG TransactionalStorage createVehicle - vehicle salvo:', vehicle);
    
    return vehicle;
  }
  
  async updateVehicle(id: number, vehicleData: Partial<Vehicle>): Promise<Vehicle> {
    const [updatedVehicle] = await db
      .update(vehicles)
      .set(vehicleData)
      .where(eq(vehicles.id, id))
      .returning();
    
    if (!updatedVehicle) {
      throw new Error("Veículo não encontrado");
    }
    
    return updatedVehicle;
  }
  
  async deleteVehicle(id: number): Promise<void> {
    // Usando transação para garantir que todas as operações sejam concluídas
    // ou nenhuma delas seja
    await withTransaction(async (tx) => {
      // Primeiro, verifique se não existem licenças associadas a este veículo
      const licenseWithVehicle = await tx
        .select({ count: sql`COUNT(*)` })
        .from(licenseRequests)
        .where(
          or(
            eq(licenseRequests.tractorUnitId, id),
            eq(licenseRequests.firstTrailerId, id),
            eq(licenseRequests.dollyId, id),
            eq(licenseRequests.secondTrailerId, id),
            eq(licenseRequests.flatbedId, id)
          )
        );

      if (licenseWithVehicle.length > 0 && Number(licenseWithVehicle[0].count) > 0) {
        throw new Error("Não é possível excluir um veículo que está associado a licenças");
      }
      
      // Em seguida, exclua o veículo
      const result = await tx
        .delete(vehicles)
        .where(eq(vehicles.id, id))
        .returning();
      
      if (!result.length) {
        throw new Error("Veículo não encontrado");
      }
    });
  }
  
  // Métodos relacionados a Pedidos de Licença
  async getLicenseRequestById(id: number): Promise<LicenseRequest | undefined> {
    const [licenseRequest] = await db
      .select()
      .from(licenseRequests)
      .where(eq(licenseRequests.id, id));
    
    return licenseRequest;
  }
  
  async getLicenseRequestsByUserId(userId: number): Promise<LicenseRequest[]> {
    return await db
      .select()
      .from(licenseRequests)
      .where(eq(licenseRequests.userId, userId))
      .orderBy(desc(licenseRequests.createdAt));
  }
  
  async getAllLicenseRequests(): Promise<LicenseRequest[]> {
    return await db
      .select()
      .from(licenseRequests)
      .orderBy(desc(licenseRequests.createdAt));
  }
  
  async getAllIssuedLicenses(): Promise<LicenseRequest[]> {
    return await db
      .select()
      .from(licenseRequests)
      .where(eq(licenseRequests.status, "approved"))
      .orderBy(desc(licenseRequests.createdAt));
  }
  
  async getLicenseRequestsByTransporterId(transporterId: number): Promise<LicenseRequest[]> {
    return await db
      .select()
      .from(licenseRequests)
      .where(eq(licenseRequests.transporterId, transporterId))
      .orderBy(desc(licenseRequests.createdAt));
  }
  
  async createLicenseRequest(userId: number, licenseData: InsertLicenseRequest & { requestNumber: string, isDraft: boolean }): Promise<LicenseRequest> {
    // Sanitizar campos de dimensões e tipo de carga com valores padrão baseados no tipo de licença
    let width = licenseData.width;
    let height = licenseData.height;
    let cargoType = licenseData.cargoType;
    
    // Se a largura não estiver definida, usar valor padrão com base no tipo de licença
    if (width === undefined || width === null) {
      width = licenseData.type === "flatbed" ? 320 : 260; // 3.20m ou 2.60m
    }
    
    // Se a altura não estiver definida, usar valor padrão com base no tipo de licença
    if (height === undefined || height === null) {
      height = licenseData.type === "flatbed" ? 495 : 440; // 4.95m ou 4.40m
    }
    
    // Se o tipo de carga não estiver definido, usar valor padrão com base no tipo de licença
    if (cargoType === undefined || cargoType === null || cargoType === "") {
      cargoType = licenseData.type === "flatbed" ? "indivisible_cargo" : "dry_cargo";
    }
    
    // Log para diagnóstico
    console.log("CreateLicenseRequest - dados originais:", {
      width: licenseData.width,
      height: licenseData.height,
      cargoType: licenseData.cargoType
    });
    
    console.log("CreateLicenseRequest - dados sanitizados:", {
      width,
      height,
      cargoType
    });
    
    const [licenseRequest] = await db
      .insert(licenseRequests)
      .values({
        userId,
        transporterId: licenseData.transporterId,
        requestNumber: licenseData.requestNumber,
        type: licenseData.type,
        mainVehiclePlate: licenseData.mainVehiclePlate,
        tractorUnitId: licenseData.tractorUnitId,
        firstTrailerId: licenseData.firstTrailerId, 
        dollyId: licenseData.dollyId,
        secondTrailerId: licenseData.secondTrailerId,
        flatbedId: licenseData.flatbedId,
        length: licenseData.length,
        // Usar os valores sanitizados
        width: Number(width),
        height: Number(height),
        cargoType,
        additionalPlates: licenseData.additionalPlates || [],
        additionalPlatesDocuments: licenseData.additionalPlatesDocuments || [],
        states: licenseData.states,
        status: licenseData.status || "pending_registration",
        stateStatuses: licenseData.stateStatuses || [],
        stateFiles: licenseData.stateFiles || [],
        createdAt: new Date(),
        updatedAt: new Date(),
        isDraft: licenseData.isDraft,
        comments: licenseData.comments,
        licenseFileUrl: licenseData.licenseFileUrl || null,
        validUntil: licenseData.validUntil || null
      })
      .returning();
    
    return licenseRequest;
  }
  
  async createLicenseDraft(userId: number, draftData: InsertLicenseRequest & { requestNumber: string, isDraft: boolean }): Promise<LicenseRequest> {
    // Assegurar que é um rascunho
    draftData.isDraft = true;
    return this.createLicenseRequest(userId, draftData);
  }
  
  async updateLicenseDraft(id: number, draftData: Partial<LicenseRequest>): Promise<LicenseRequest> {
    // Obter o rascunho atual para decisões mais informadas sobre valores padrão
    const currentDraft = await this.getLicenseRequestById(id);
    if (!currentDraft) {
      throw new Error("Rascunho não encontrado");
    }
    
    // Preparar os dados atualizados
    const updateData = { ...draftData };
    
    // Se estamos alterando o tipo de licença, podemos precisar atualizar os valores padrão
    const licenseType = draftData.type || currentDraft.type;
    
    // Somente converter se os campos estiverem presentes na atualização
    if (draftData.width !== undefined) {
      updateData.width = Number(draftData.width);
    } else if (currentDraft.width === null || currentDraft.width === undefined) {
      // Se o valor atual é null mas não estamos atualizando, definir valor padrão
      updateData.width = licenseType === "flatbed" ? 320 : 260;
    }
    
    if (draftData.height !== undefined) {
      updateData.height = Number(draftData.height);
    } else if (currentDraft.height === null || currentDraft.height === undefined) {
      // Se o valor atual é null mas não estamos atualizando, definir valor padrão
      updateData.height = licenseType === "flatbed" ? 495 : 440;
    }
    
    if (draftData.cargoType !== undefined) {
      updateData.cargoType = draftData.cargoType;
    } else if (currentDraft.cargoType === null || currentDraft.cargoType === undefined || currentDraft.cargoType === "") {
      // Se o valor atual é null mas não estamos atualizando, definir valor padrão
      updateData.cargoType = licenseType === "flatbed" ? "indivisible_cargo" : "dry_cargo";
    }
    
    // Log para diagnóstico
    console.log("UpdateLicenseDraft - dados originais:", {
      width: draftData.width,
      height: draftData.height,
      cargoType: draftData.cargoType
    });
    
    console.log("UpdateLicenseDraft - dados sanitizados:", {
      width: updateData.width,
      height: updateData.height,
      cargoType: updateData.cargoType
    });
    
    // Atualizar o registro
    const [updatedDraft] = await db
      .update(licenseRequests)
      .set({
        ...updateData,
        updatedAt: new Date()
      })
      .where(
        and(
          eq(licenseRequests.id, id),
          eq(licenseRequests.isDraft, true)
        )
      )
      .returning();
    
    if (!updatedDraft) {
      throw new Error("Rascunho de licença não encontrado");
    }
    
    return updatedDraft;
  }
  
  async submitLicenseDraft(id: number, requestNumber: string): Promise<LicenseRequest> {
    // Verificar se o rascunho existe
    const draft = await this.getLicenseRequestById(id);
    if (!draft || !draft.isDraft) {
      throw new Error("Rascunho de licença não encontrado");
    }
    
    // Sanitizar campos de dimensões e tipo de carga com valores padrão baseados no tipo de licença
    let width = draft.width;
    let height = draft.height;
    let cargoType = draft.cargoType;
    
    // Se a largura não estiver definida, usar valor padrão com base no tipo de licença
    if (width === undefined || width === null) {
      width = draft.type === "flatbed" ? 320 : 260; // 3.20m ou 2.60m
    }
    
    // Se a altura não estiver definida, usar valor padrão com base no tipo de licença
    if (height === undefined || height === null) {
      height = draft.type === "flatbed" ? 495 : 440; // 4.95m ou 4.40m
    }
    
    // Se o tipo de carga não estiver definido, usar valor padrão com base no tipo de licença
    if (cargoType === undefined || cargoType === null || cargoType === "") {
      cargoType = draft.type === "flatbed" ? "indivisible_cargo" : "dry_cargo";
    }
    
    // Log para diagnóstico
    console.log("SubmitLicenseDraft - dados originais:", {
      width: draft.width,
      height: draft.height,
      cargoType: draft.cargoType
    });
    
    console.log("SubmitLicenseDraft - dados sanitizados:", {
      width,
      height,
      cargoType
    });
    
    // Atualizar o rascunho para um pedido real
    const [licenseRequest] = await db
      .update(licenseRequests)
      .set({
        isDraft: false,
        requestNumber,
        status: "pending_registration",
        width: Number(width),
        height: Number(height),
        cargoType,
        updatedAt: new Date()
      })
      .where(eq(licenseRequests.id, id))
      .returning();
    
    return licenseRequest;
  }
  
  async getLicenseDraftsByUserId(userId: number): Promise<LicenseRequest[]> {
    // userId = 0 indica que queremos todos os rascunhos (acesso administrativo)
    if (userId === 0) {
      return await db
        .select()
        .from(licenseRequests)
        .where(eq(licenseRequests.isDraft, true))
        .orderBy(desc(licenseRequests.createdAt));
    }
    
    // Caso contrário, retornamos apenas os rascunhos do usuário especificado
    return await db
      .select()
      .from(licenseRequests)
      .where(
        and(
          eq(licenseRequests.userId, userId),
          eq(licenseRequests.isDraft, true)
        )
      )
      .orderBy(desc(licenseRequests.createdAt));
  }
  
  async getIssuedLicensesByUserId(userId: number): Promise<LicenseRequest[]> {
    // userId = 0 indica que queremos todas as licenças emitidas (acesso administrativo)
    if (userId === 0) {
      return await db
        .select()
        .from(licenseRequests)
        .where(
          and(
            eq(licenseRequests.isDraft, false),
            or(
              eq(licenseRequests.status, "approved"),
              // Incluir licenças que tenham pelo menos um estado com status 'approved'
              sql`EXISTS (
                SELECT 1 FROM unnest(${licenseRequests.stateStatuses}) as state_status
                WHERE state_status LIKE '%:approved'
              )`
            )
          )
        )
        .orderBy(desc(licenseRequests.createdAt));
    }
    
    // Caso contrário, retornamos apenas as licenças emitidas do usuário especificado
    return await db
      .select()
      .from(licenseRequests)
      .where(
        and(
          eq(licenseRequests.userId, userId),
          eq(licenseRequests.isDraft, false),
          or(
            eq(licenseRequests.status, "approved"),
            // Incluir licenças que tenham pelo menos um estado com status 'approved'
            sql`EXISTS (
              SELECT 1 FROM unnest(${licenseRequests.stateStatuses}) as state_status
              WHERE state_status LIKE '%:approved'
            )`
          )
        )
      )
      .orderBy(desc(licenseRequests.createdAt));
  }
  
  async updateLicenseStateStatus(data: UpdateLicenseState): Promise<LicenseRequest> {
    // Verificar se a licença existe
    const license = await this.getLicenseRequestById(data.licenseId);
    if (!license) {
      throw new Error("Pedido de licença não encontrado");
    }
    
    // Preparar os dados de atualização
    let stateStatuses = [...(license.stateStatuses || [])];
    
    // Incluir data de validade e emissão no status se fornecidas
    let newStateStatus = `${data.state}:${data.status}`;
    if (data.validUntil) {
      newStateStatus = `${data.state}:${data.status}:${data.validUntil}`;
      
      // Se tiver data de emissão também, incluir no formato
      if (data.issuedAt) {
        newStateStatus += `:${data.issuedAt}`;
      }
    }
    
    // Verificar se o estado já existe na lista
    const existingIndex = stateStatuses.findIndex(s => s.startsWith(`${data.state}:`));
    if (existingIndex >= 0) {
      stateStatuses[existingIndex] = newStateStatus;
    } else {
      stateStatuses.push(newStateStatus);
    }
    
    // Atualizar arquivo do estado se fornecido
    let stateFiles = [...(license.stateFiles || [])];
    let licenseFileUrl = license.licenseFileUrl;
    
    if (data.file && typeof data.file !== 'string') {
      // Extrair o nome do arquivo do caminho completo
      const filename = data.file.filename;
      // Arquivos de licenças agora ficam na pasta licenses com nomenclatura organizada
      const fileUrl = `/uploads/licenses/${filename}`;
      const newStateFile = `${data.state}:${fileUrl}`;
      
      console.log(`[UPLOAD LICENSE] Arquivo salvo: ${filename} -> URL: ${fileUrl}`);
      
      const existingFileIndex = stateFiles.findIndex(s => s.startsWith(`${data.state}:`));
      if (existingFileIndex >= 0) {
        stateFiles[existingFileIndex] = newStateFile;
      } else {
        stateFiles.push(newStateFile);
      }
      
      // Se o estado for aprovado, atualizar também o licenseFileUrl
      if (data.status === "approved") {
        licenseFileUrl = fileUrl;
      }
    }
    
    // Se recebemos número da AET, armazenar específico para o estado
    let aetNumber = license.aetNumber;
    let stateAETNumbers = [...(license.stateAETNumbers || [])];
    
    if (data.aetNumber) {
      // Atualizar o array stateAETNumbers (formato "SP:123456")
      const newStateAET = `${data.state}:${data.aetNumber}`;
      const existingAETIndex = stateAETNumbers.findIndex(s => s.startsWith(`${data.state}:`));
      
      if (existingAETIndex >= 0) {
        stateAETNumbers[existingAETIndex] = newStateAET;
      } else {
        stateAETNumbers.push(newStateAET);
      }
      
      // Manter o campo legado aetNumber também atualizado (usar o último número cadastrado)
      aetNumber = data.aetNumber;
    }
    
    // Processar CNPJ específico por estado se fornecido
    let stateCnpjs = [...(license.stateCnpjs || [])];
    console.log('[BACKEND] data.stateCnpj recebido:', data.stateCnpj);
    console.log('[BACKEND] stateCnpjs atual antes da atualização:', stateCnpjs);
    
    if (data.stateCnpj && data.stateCnpj.trim() !== '') {
      const newStateCnpj = `${data.state}:${data.stateCnpj}`;
      const existingCnpjIndex = stateCnpjs.findIndex(s => s.startsWith(`${data.state}:`));
      
      console.log('[BACKEND] Processando CNPJ para estado:', data.state, 'CNPJ:', data.stateCnpj);
      console.log('[BACKEND] Novo formato:', newStateCnpj);
      
      if (existingCnpjIndex >= 0) {
        stateCnpjs[existingCnpjIndex] = newStateCnpj;
        console.log('[BACKEND] Atualizando CNPJ existente no índice:', existingCnpjIndex);
      } else {
        stateCnpjs.push(newStateCnpj);
        console.log('[BACKEND] Adicionando novo CNPJ ao array');
      }
      
      console.log('[BACKEND] stateCnpjs após atualização:', stateCnpjs);
    } else {
      console.log('[BACKEND] CNPJ não fornecido ou vazio, mantendo array atual');
    }

    // Se recebemos data de validade para status aprovado, armazenar como licença principal também
    let validUntil = license.validUntil;
    if (data.status === "approved" && data.validUntil) {
      try {
        validUntil = new Date(data.validUntil);
      } catch (e) {
        console.error("Erro ao converter data de validade:", e);
      }
    }
    
    // Verificar se todos os estados estão aprovados para potencialmente atualizar o status geral da licença
    let overallStatus = license.status;
    if (data.status === "approved") {
      // Verificar se TODOS os estados estão aprovados para atualizar o status geral
      const allStatesApproved = license.states.every(state => {
        // O estado atual está sendo atualizado para aprovado
        if (state === data.state) return true;
        
        // Verificar outros estados
        const stateEntry = stateStatuses.find(s => s.startsWith(`${state}:`));
        if (!stateEntry) return false;
        
        const statusParts = stateEntry.split(':');
        return statusParts[1] === "approved";
      });
      
      if (allStatesApproved) {
        overallStatus = "approved";
      }
    }
    
    // Preparar dados de atualização
    const updateData: any = {
      stateStatuses,
      stateFiles,
      stateAETNumbers, // Incluir o array de números AET específicos por estado
      stateCnpjs, // Incluir o array de CNPJs específicos por estado
      updatedAt: new Date(),
      licenseFileUrl,
      validUntil,
      aetNumber,
      status: overallStatus // Atualizar status geral se todos estados estiverem aprovados
    };

    // Adicionar data de emissão se fornecida
    if (data.issuedAt) {
      updateData.issuedAt = new Date(data.issuedAt);
      console.log('[TransactionalStorage] Salvando data de emissão:', data.issuedAt, '-> banco:', updateData.issuedAt);
    }

    // Executar a atualização com todos os campos corretos
    const [updatedLicense] = await db
      .update(licenseRequests)
      .set(updateData)
      .where(eq(licenseRequests.id, data.licenseId))
      .returning();
    
    // SINCRONIZAÇÃO AUTOMÁTICA: Se o status foi aprovado, sincronizar na tabela licencas_emitidas
    console.log(`[SINCRONIZAÇÃO AUTO] Verificando condições: status=${data.status}, validUntil=${data.validUntil}, aetNumber=${data.aetNumber}`);
    if (data.status === "approved" && data.validUntil && data.aetNumber) {
      try {
        console.log(`[SINCRONIZAÇÃO AUTO] Iniciando sincronização para licença ${data.licenseId} estado ${data.state}`);
        await this.sincronizarLicencaEmitida(updatedLicense, data.state, data.aetNumber, data.validUntil, data.issuedAt || new Date().toISOString().split('T')[0]);
        console.log(`[SINCRONIZAÇÃO AUTO] ✅ Licença ${data.licenseId} sincronizada para estado ${data.state}`);
      } catch (error) {
        console.error(`[SINCRONIZAÇÃO AUTO] ❌ Erro ao sincronizar licença ${data.licenseId} estado ${data.state}:`, error);
      }
    } else {
      console.log(`[SINCRONIZAÇÃO AUTO] ⚠️ Condições não atendidas - não sincronizando`);
    }
    
    return updatedLicense;
  }
  
  async updateLicenseStatus(id: number, statusData: UpdateLicenseStatus): Promise<LicenseRequest> {
    // Verificar se a licença existe
    const license = await this.getLicenseRequestById(id);
    if (!license) {
      throw new Error("Pedido de licença não encontrado");
    }
    
    // Prepare os dados de atualização
    const updateData: Partial<LicenseRequest> = {
      status: statusData.status as LicenseStatus,
      comments: statusData.comments,
      updatedAt: new Date()
    };
    
    // Se houver validUntil e for uma string, convertê-la para Date
    if (statusData.validUntil) {
      updateData.validUntil = new Date(statusData.validUntil);
    }
    
    // Se houver licenseFileUrl, atualizá-la
    if (statusData.licenseFile && typeof statusData.licenseFile !== 'string') {
      const filename = statusData.licenseFile.filename;
      const fileUrl = `/uploads/${filename}`;
      updateData.licenseFileUrl = fileUrl;
    }
    
    // Atualizar status de um estado específico, se fornecido
    if (statusData.state && statusData.stateStatus) {
      // Incluir data de validade e data de emissão no status se disponível
      let newStateStatus = `${statusData.state}:${statusData.stateStatus}`;
      
      console.log('[Storage] Estado:', statusData.state);
      console.log('[Storage] Status:', statusData.stateStatus);
      console.log('[Storage] Data de validade recebida:', statusData.validUntil);
      console.log('[Storage] Data de emissão recebida:', statusData.issuedAt);
      
      // Adicionar data de validade se disponível
      if (statusData.validUntil) {
        newStateStatus += `:${statusData.validUntil}`;
      } else {
        // Se não há data de validade mas há data de emissão, usar string vazia como placeholder
        if (statusData.issuedAt) {
          newStateStatus += `:`;
        }
      }
      
      // Adicionar data de emissão se disponível
      if (statusData.issuedAt) {
        newStateStatus += `:${statusData.issuedAt}`;
      }
      
      console.log('[Storage] Status formatado final:', newStateStatus);
      
      let stateStatuses = [...(license.stateStatuses || [])];
      
      // Verificar se o estado já existe na lista
      const existingIndex = stateStatuses.findIndex(s => s.startsWith(`${statusData.state}:`));
      if (existingIndex >= 0) {
        stateStatuses[existingIndex] = newStateStatus;
      } else {
        stateStatuses.push(newStateStatus);
      }
      
      updateData.stateStatuses = stateStatuses;
      
      // Se houver um arquivo para o estado, atualizá-lo
      if (statusData.stateFile && typeof statusData.stateFile !== 'string') {
        const filename = statusData.stateFile.filename;
        const fileUrl = `/uploads/${filename}`;
        const newStateFile = `${statusData.state}:${fileUrl}`;
        let stateFiles = [...(license.stateFiles || [])];
        
        const existingFileIndex = stateFiles.findIndex(s => s.startsWith(`${statusData.state}:`));
        if (existingFileIndex >= 0) {
          stateFiles[existingFileIndex] = newStateFile;
        } else {
          stateFiles.push(newStateFile);
        }
        
        updateData.stateFiles = stateFiles;
        
        // Nota: Não mais atualizamos o licenseFileUrl global, pois cada estado tem seu próprio arquivo
        // Agora usamos apenas o array stateFiles para armazenar arquivos específicos por estado
      }
      
      // Se houver um número AET para o estado, atualizá-lo no array stateAETNumbers
      if (statusData.aetNumber) {
        const newStateAET = `${statusData.state}:${statusData.aetNumber}`;
        let stateAETNumbers = [...(license.stateAETNumbers || [])];
        
        const existingAETIndex = stateAETNumbers.findIndex(s => s.startsWith(`${statusData.state}:`));
        if (existingAETIndex >= 0) {
          stateAETNumbers[existingAETIndex] = newStateAET;
        } else {
          stateAETNumbers.push(newStateAET);
        }
        
        updateData.stateAETNumbers = stateAETNumbers;
        
        // Manter o campo legado aetNumber também atualizado (usar o último número cadastrado)
        updateData.aetNumber = statusData.aetNumber;
      }
    }
    
    // Executar a atualização
    const [updatedLicense] = await db
      .update(licenseRequests)
      .set(updateData)
      .where(eq(licenseRequests.id, id))
      .returning();
    
    return updatedLicense;
  }
  
  async deleteLicenseRequest(id: number): Promise<void> {
    return await withTransaction(async (tx) => {
      // Primeiro, excluir todos os históricos associados
      await tx.delete(statusHistories).where(eq(statusHistories.licenseId, id));
      
      // Segundo, excluir todos os state_licenses associados
      await tx.delete(stateLicenses).where(eq(stateLicenses.licenseRequestId, id));
      
      // Por último, excluir a licença
      const result = await tx
        .delete(licenseRequests)
        .where(eq(licenseRequests.id, id))
        .returning();
      
      if (!result.length) {
        throw new Error("Pedido de licença não encontrado");
      }
    });
  }
  
  // Métodos para obter estatísticas
  async getDashboardStats(userId: number): Promise<DashboardStats> {
    console.log(`[DASHBOARD NEW] Usuário ${userId} (${(await this.getUser(userId))?.email}) role: ${(await this.getUser(userId))?.role}`);
    
    // Verificar se o usuário é admin baseado no role
    const user = await this.getUser(userId);
    if (!user) {
      throw new Error('Usuário não encontrado');
    }
    
    const isAdmin = user.role === 'admin' || user.role === 'supervisor' || user.role === 'manager';
    
    if (isAdmin) {
      console.log(`[DASHBOARD NEW] ADMIN - Coletando dados globais`);
      const stats = await getDashboardStatsCombined();
      
      const recentLicenses = await db
        .select()
        .from(licenseRequests)
        .where(eq(licenseRequests.isDraft, false))
        .orderBy(desc(licenseRequests.createdAt))
        .limit(5);
      
      return {
        ...stats,
        recentLicenses
      };
      
    } else {
      console.log(`[DASHBOARD NEW] TRANSPORTADOR - Coletando dados específicos do usuário ${userId}`);
      
      // Primeiro, verificar se o usuário tem transportadores associados
      const userTransporters = await db.select()
        .from(transporters)
        .where(eq(transporters.userId, userId));
      
      const transporterIds = userTransporters.map(t => t.id);
      console.log(`[DASHBOARD NEW] TRANSPORTADOR - IDs dos transportadores: ${transporterIds.join(', ')}`);
      
      // Contar veículos do usuário
      const vehiclesResult = await db.select({ count: sql`count(*)` })
        .from(vehicles)
        .where(eq(vehicles.userId, userId));
        
      const activeVehiclesResult = await db.select({ count: sql`count(*)` })
        .from(vehicles)
        .where(and(
          eq(vehicles.userId, userId),
          eq(vehicles.status, "active")
        ));
      
      const registeredVehicles = Number(vehiclesResult[0]?.count || 0);
      const activeVehicles = Number(activeVehiclesResult[0]?.count || 0);
      
      console.log(`[DASHBOARD NEW] TRANSPORTADOR - Veículos: ${registeredVehicles} total, ${activeVehicles} ativos`);
      
      // Buscar licenças específicas do usuário/transportador
      let userLicenses = [];
      if (transporterIds.length > 0) {
        userLicenses = await db.select()
          .from(licenseRequests)
          .where(
            or(
              eq(licenseRequests.userId, userId),
              eq(licenseRequests.transporterId, transporterIds[0])
            )
          );
      } else {
        userLicenses = await db.select()
          .from(licenseRequests)
          .where(eq(licenseRequests.userId, userId));
      }
      
      // USAR EXATAMENTE A MESMA FUNÇÃO expandedLicenses da página "Licenças Emitidas"
      const expandedLicenses: any[] = [];
      
      userLicenses.forEach(license => {
        if (license.isDraft) return;
        
        // Para cada licença, expandir para uma linha por estado que tenha sido aprovado
        license.states.forEach((state, index) => {
          // Verifica se este estado específico foi aprovado
          const stateStatusEntry = license.stateStatuses?.find(entry => entry.startsWith(`${state}:`));
          const stateStatus = stateStatusEntry?.split(':')?.[1] || 'pending_registration';
          const stateFileEntry = license.stateFiles?.find(entry => entry.startsWith(`${state}:`));
          const stateFileUrl = stateFileEntry?.split(':')?.[1] || null;
          
          // Só incluir estados com status "approved"
          if (stateStatus === 'approved') {
            // Obter data de validade específica para este estado, se disponível
            let stateValidUntil = license.validUntil ? license.validUntil.toString() : null;
            
            // Novo formato: "estado:status:data_validade"
            if (stateStatusEntry && stateStatusEntry.split(':').length > 2) {
              // Extrair data de validade do formato estado:status:data
              stateValidUntil = stateStatusEntry.split(':')[2];
            }
            
            // Obter número AET específico para este estado, se disponível
            let stateAETNumber = null;
            
            // Verificar primeiro no array stateAETNumbers (formato "SP:123456")
            if (license.stateAETNumbers && Array.isArray(license.stateAETNumbers)) {
              const aetEntry = license.stateAETNumbers.find(entry => entry.startsWith(`${state}:`));
              if (aetEntry) {
                const parts = aetEntry.split(':');
                if (parts.length >= 2) {
                  stateAETNumber = parts[1];
                }
              }
            }
            
            // Se não encontrou no stateAETNumbers, tentar no campo aetNumber (legado)
            if (!stateAETNumber && license.aetNumber) {
              stateAETNumber = license.aetNumber;
            }
            
            expandedLicenses.push({
              id: license.id * 100 + index, // Gerar ID único para a linha
              licenseId: license.id,
              requestNumber: license.requestNumber,
              type: license.type,
              mainVehiclePlate: license.mainVehiclePlate,
              state,
              status: stateStatus,
              stateStatus,
              emissionDate: license.updatedAt ? license.updatedAt.toString() : null,
              validUntil: stateValidUntil,
              licenseFileUrl: license.licenseFileUrl,
              stateFileUrl,
              transporterId: license.transporterId || 0,
              aetNumber: stateAETNumber // Usar o número AET específico do estado
            });
          }
        });
      });
      
      // Função getLicenseStatus IDÊNTICA à da página "Licenças Emitidas"
      const getLicenseStatus = (validUntil: string | null): 'active' | 'expired' | 'expiring_soon' => {
        if (!validUntil) return 'active';
        
        const validDate = new Date(validUntil);
        const today = new Date();
        
        // Se a validade é antes de hoje (vencida)
        if (validDate < today) {
          return 'expired';
        }
        
        // Se a validade é menos de 30 dias a partir de hoje
        const diffInDays = Math.ceil((validDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        if (diffInDays <= 30) {
          return 'expiring_soon';
        }
        
        return 'active';
      };
      
      // Contar usando expandedLicenses (EXATAMENTE como na página "Licenças Emitidas")
      const issuedLicensesCount = expandedLicenses.length;
      const expiringLicensesCount = expandedLicenses.filter(l => getLicenseStatus(l.validUntil) === 'expiring_soon').length;
      
      console.log(`[DASHBOARD EXPANDEDLICENSES] Total: ${issuedLicensesCount}, A vencer: ${expiringLicensesCount}`);
      
      // Licenças pendentes (não emitidas)
      const pendingLicenses = userLicenses.filter(license => {
        if (license.isDraft) return false;
        const hasApprovedState = license.stateStatuses && 
          Array.isArray(license.stateStatuses) && 
          license.stateStatuses.some((ss: string) => ss.includes(':approved:'));
        return !hasApprovedState;
      });
      
      // Buscar licenças recentes
      let recentLicensesResult = [];
      if (transporterIds.length > 0) {
        recentLicensesResult = await db.select()
          .from(licenseRequests)
          .where(and(
            or(
              eq(licenseRequests.userId, userId),
              sql`${licenseRequests.transporterId} = ANY(${transporterIds})`
            ),
            eq(licenseRequests.isDraft, false)
          ))
          .orderBy(desc(licenseRequests.createdAt))
          .limit(5);
      } else {
        recentLicensesResult = await db.select()
          .from(licenseRequests)
          .where(and(
            eq(licenseRequests.userId, userId),
            eq(licenseRequests.isDraft, false)
          ))
          .orderBy(desc(licenseRequests.createdAt))
          .limit(5);
      }
      
      const recentLicenses = recentLicensesResult.map(license => ({
        id: license.id,
        requestNumber: license.requestNumber,
        type: license.type,
        mainVehiclePlate: license.mainVehiclePlate,
        states: license.states,
        status: license.status,
        createdAt: license.createdAt
      }));
      
      const result = {
        issuedLicenses: issuedLicensesCount,
        pendingLicenses: pendingLicenses.length,
        registeredVehicles,
        activeVehicles,
        expiringLicenses: expiringLicensesCount,
        recentLicenses
      };
      
      console.log(`[DASHBOARD FINAL] Estados aprovados encontrados: ${issuedLicensesCount}`);
      console.log(`[DASHBOARD FINAL] Licenças com estados aprovados:`, userLicenses.filter(l => !l.isDraft && l.stateStatuses?.some(s => s.includes(':approved'))).map(l => ({ id: l.id, stateStatuses: l.stateStatuses })));
      return result;
    }
  }
  
  async getVehicleStats(userId: number): Promise<ChartData[]> {
    // Admin (userId 0) vê todos os veículos 
    // Usuários comuns veem apenas os seus
    let query = sql`
      SELECT type, COUNT(*) as count
      FROM ${vehicles}
    `;
    
    if (userId !== 0) {
      query = sql`
        SELECT type, COUNT(*) as count
        FROM ${vehicles}
        WHERE user_id = ${userId}
      `;
    }
    
    query = sql`${query} GROUP BY type ORDER BY count DESC`;
    
    const result = await db.execute(query);
    
    return result.rows.map((row: any) => ({
      name: this.getVehicleTypeLabel(row.type),
      value: Number(row.count)
    }));
  }
  
  async getStateStats(userId: number): Promise<ChartData[]> {
    // Admin (userId 0) vê todos os estados
    // Usuários comuns veem apenas os seus
    let query = sql`
      WITH expanded_states AS (
        SELECT id, unnest(states) as state
        FROM ${licenseRequests}
        WHERE is_draft = false
    `;
    
    if (userId !== 0) {
      query = sql`${query} AND user_id = ${userId}`;
    }
    
    query = sql`${query})
      SELECT state, COUNT(*) as count
      FROM expanded_states
      GROUP BY state
      ORDER BY count DESC
    `;
    
    const result = await db.execute(query);
    
    return result.rows.map((row: any) => ({
      name: row.state,
      value: Number(row.count)
    }));
  }
  
  // Método auxiliar para converter códigos de tipo de veículo para rótulos legíveis
  private getVehicleTypeLabel(type: string): string {
    const typeMap: Record<string, string> = {
      'tractor': 'Unidade Tratora',
      'semi_trailer': 'Semirreboque',
      'trailer': 'Reboque',
      'dolly': 'Dolly',
      'flatbed': 'Prancha'
    };
    
    return typeMap[type] || type;
  }
  
  // Método para pesquisa global
  async search(term: string): Promise<any[]> {
    return performGlobalSearch(term);
  }
  
  // Método para obter licenças prestes a expirar
  async getSoonToExpireLicenses(): Promise<any[]> {
    const result = await getSoonToExpireLicenses();
    return result.rows;
  }
  
  // Métodos para histórico de status
  async createStatusHistory(historyData: InsertStatusHistory): Promise<StatusHistory> {
    try {
      const [history] = await db
        .insert(statusHistories)
        .values({
          licenseId: historyData.licenseId,
          state: historyData.state,
          userId: historyData.userId,
          oldStatus: historyData.oldStatus,
          newStatus: historyData.newStatus,
          comments: historyData.comments,
          createdAt: historyData.createdAt || new Date()
        })
        .returning();
      
      return history;
    } catch (error) {
      console.error('Erro ao criar histórico de status:', error);
      throw new Error('Falha ao registrar histórico de status');
    }
  }
  
  async getStatusHistoryByLicenseId(licenseId: number): Promise<(StatusHistory & { user?: { fullName: string, email: string } })[]> {
    try {
      const result = await db
        .select({
          id: statusHistories.id,
          licenseId: statusHistories.licenseId,
          state: statusHistories.state,
          userId: statusHistories.userId,
          oldStatus: statusHistories.oldStatus,
          newStatus: statusHistories.newStatus,
          comments: statusHistories.comments,
          createdAt: statusHistories.createdAt,
          user: {
            fullName: users.fullName,
            email: users.email
          }
        })
        .from(statusHistories)
        .leftJoin(users, eq(statusHistories.userId, users.id))
        .where(eq(statusHistories.licenseId, licenseId))
        .orderBy(desc(statusHistories.createdAt));
      
      return result;
    } catch (error) {
      console.error('Erro ao buscar histórico de status por licença:', error);
      throw new Error('Falha ao buscar histórico de status');
    }
  }
  
  async getStatusHistoryByState(licenseId: number, state: string): Promise<(StatusHistory & { user?: { fullName: string, email: string } })[]> {
    try {
      const result = await db
        .select({
          id: statusHistories.id,
          licenseId: statusHistories.licenseId,
          state: statusHistories.state,
          userId: statusHistories.userId,
          oldStatus: statusHistories.oldStatus,
          newStatus: statusHistories.newStatus,
          comments: statusHistories.comments,
          createdAt: statusHistories.createdAt,
          user: {
            fullName: users.fullName,
            email: users.email
          }
        })
        .from(statusHistories)
        .leftJoin(users, eq(statusHistories.userId, users.id))
        .where(
          and(
            eq(statusHistories.licenseId, licenseId),
            eq(statusHistories.state, state)
          )
        )
        .orderBy(desc(statusHistories.createdAt));
      
      return result;
    } catch (error) {
      console.error('Erro ao buscar histórico de status por estado:', error);
      throw new Error('Falha ao buscar histórico de status para o estado especificado');
    }
  }

  // ===== VEHICLE MODELS METHODS =====
  async getAllVehicleModels(): Promise<VehicleModel[]> {
    try {
      return await db
        .select()
        .from(vehicleModels)
        .orderBy(asc(vehicleModels.brand), asc(vehicleModels.model));
    } catch (error) {
      console.error('Erro ao buscar modelos de veículos:', error);
      throw new Error('Falha ao buscar modelos de veículos');
    }
  }

  async getVehicleModelById(id: number): Promise<VehicleModel | undefined> {
    try {
      const [model] = await db
        .select()
        .from(vehicleModels)
        .where(eq(vehicleModels.id, id));
      return model || undefined;
    } catch (error) {
      console.error('Erro ao buscar modelo de veículo por ID:', error);
      throw new Error('Falha ao buscar modelo de veículo');
    }
  }

  async createVehicleModel(model: InsertVehicleModel): Promise<VehicleModel> {
    try {
      const [newModel] = await db
        .insert(vehicleModels)
        .values(model)
        .returning();
      return newModel;
    } catch (error) {
      console.error('Erro ao criar modelo de veículo:', error);
      throw new Error('Falha ao criar modelo de veículo');
    }
  }

  async updateVehicleModel(id: number, model: InsertVehicleModel): Promise<VehicleModel | undefined> {
    try {
      const [updatedModel] = await db
        .update(vehicleModels)
        .set(model)
        .where(eq(vehicleModels.id, id))
        .returning();
      return updatedModel || undefined;
    } catch (error) {
      console.error('Erro ao atualizar modelo de veículo:', error);
      throw new Error('Falha ao atualizar modelo de veículo');
    }
  }

  async deleteVehicleModel(id: number): Promise<void> {
    try {
      await db
        .delete(vehicleModels)
        .where(eq(vehicleModels.id, id));
    } catch (error) {
      console.error('Erro ao deletar modelo de veículo:', error);
      throw new Error('Falha ao deletar modelo de veículo');
    }
  }

  // Método para Dashboard AET
  async getDashboardAETData(): Promise<any> {
    try {
      // Usar data atual real do servidor
      const agora = new Date();
      const hoje = agora.toISOString().split('T')[0]; // YYYY-MM-DD
      
      console.log(`[DASHBOARD AET] Data de hoje (Brasília): ${hoje}`);
      
      // Buscar dados básicos do sistema
      const todasLicencas = await db.select().from(licenseRequests).where(eq(licenseRequests.isDraft, false));
      const todosVeiculos = await db.select().from(vehicles);
      const todosBoletos = await db.select().from(boletos);
      
      // Últimas 5 licenças com nome do transportador
      const ultimasLicencas = await db.select({
        id: licenseRequests.id,
        requestNumber: licenseRequests.requestNumber,
        mainVehiclePlate: licenseRequests.mainVehiclePlate,
        type: licenseRequests.type,
        status: licenseRequests.status,
        createdAt: licenseRequests.createdAt,
        transporterName: transporters.name
      })
      .from(licenseRequests)
      .leftJoin(transporters, eq(licenseRequests.transporterId, transporters.id))
      .where(eq(licenseRequests.isDraft, false))
      .orderBy(desc(licenseRequests.createdAt))
      .limit(5);
      
      // Últimos 5 boletos
      const ultimosBoletos = await db.select()
        .from(boletos)
        .orderBy(desc(boletos.criadoEm))
        .limit(5);

      // Calcular estatísticas POR ESTADO e não por pedido
      let estadosSolicitadosHoje = 0;
      let estadosEmitidosHoje = 0;
      let estadosPendentes = 0;
      let estadosEmitidosTotal = 0;
      
      console.log(`[DASHBOARD AET] Analisando ${todasLicencas.length} licenças para contagem por estado`);
      
      todasLicencas.forEach(l => {
        if (!l.states) return;
        
        // Verificar se foi criado hoje
        const isHoje = l.createdAt && new Date(l.createdAt).toISOString().split('T')[0] === hoje;
        
        console.log(`[DASHBOARD AET] Licença #${l.id}:`);
        console.log(`  - Data criação: ${l.createdAt}`);
        console.log(`  - É hoje: ${isHoje}`);
        console.log(`  - Estados: ${JSON.stringify(l.states)}`);
        console.log(`  - Status estados: ${JSON.stringify(l.stateStatuses)}`);
        
        l.states.forEach(state => {
          // Contar estados solicitados hoje
          if (isHoje) {
            estadosSolicitadosHoje++;
            console.log(`    Estado ${state} solicitado hoje: +1`);
          }
          
          // Verificar se o estado foi aprovado e QUANDO foi aprovado
          const stateStatus = l.stateStatuses?.find(s => s.startsWith(`${state}:`));
          const isApproved = stateStatus?.includes(':approved:');
          
          if (isApproved) {
            estadosEmitidosTotal++;
            
            // Para contar como emitido hoje, vamos verificar a data de emissão do estado
            // O formato é: "STATE:approved:YYYY-MM-DD:YYYY-MM-DD"
            const statusParts = stateStatus?.split(':');
            if (statusParts && statusParts.length >= 4) {
              const dataEmissao = statusParts[3]; // Data de emissão
              console.log(`    Estado ${state} - Data emissão: ${dataEmissao}, Hoje: ${hoje}`);
              
              // Contar como emitido hoje APENAS se a data de emissão for hoje
              if (dataEmissao === hoje) {
                estadosEmitidosHoje++;
                console.log(`    Estado ${state} emitido hoje: +1`);
              } else {
                console.log(`    Estado ${state} NÃO emitido hoje (${dataEmissao} != ${hoje})`);
              }
            } else {
              console.log(`    Estado ${state} - Status mal formatado: ${stateStatus}`);
            }
          } else {
            estadosPendentes++;
            console.log(`    Estado ${state} pendente: +1`);
          }
        });
      });
      
      console.log(`[DASHBOARD AET] Resultado da contagem por estado:`);
      console.log(`- Estados solicitados hoje: ${estadosSolicitadosHoje}`);
      console.log(`- Estados emitidos hoje: ${estadosEmitidosHoje}`);
      console.log(`- Estados pendentes: ${estadosPendentes}`);
      console.log(`- Estados emitidos total: ${estadosEmitidosTotal}`);
      
      const boletosHoje = todosBoletos.filter(b => 
        b.criadoEm && new Date(b.criadoEm).toISOString().split('T')[0] === hoje
      );
      
      const valorBoletosHoje = boletosHoje.reduce((sum, b) => sum + parseFloat(b.valor), 0);

      // Estatísticas por estado
      const estadosMap: Record<string, number> = {};
      todasLicencas.forEach(l => {
        if (l.states) {
          l.states.forEach(state => {
            estadosMap[state] = (estadosMap[state] || 0) + 1;
          });
        }
      });
      
      const porEstado = Object.entries(estadosMap).map(([name, value]) => ({ name, value }));

      // Estatísticas por tipo de veículo
      const tiposVeiculoMap: Record<string, string> = {
        'roadtrain_9_axles': 'Rodotrem 9 eixos',
        'bitrain_9_axles': 'Bitrem 9 eixos',
        'bitrain_7_axles': 'Bitrem 7 eixos',
        'bitrain_6_axles': 'Bitrem 6 eixos',
        'flatbed': 'Prancha',
        'romeo_juliet': 'Romeu e Julieta'
      };
      
      const tiposMap: Record<string, number> = {};
      todasLicencas.forEach(l => {
        if (l.type) {
          tiposMap[l.type] = (tiposMap[l.type] || 0) + 1;
        }
      });
      
      const porTipoVeiculo = Object.entries(tiposMap).map(([type, value]) => ({
        name: tiposVeiculoMap[type] || type,
        value,
        color: `hsl(${Math.floor(Math.random() * 360)}, 70%, 50%)`
      }));

      // Dados dos últimos 7 dias (contagem por estado)
      const licencasPorStatus7Dias = [];
      for (let i = 6; i >= 0; i--) {
        const data = new Date(agora);
        data.setDate(agora.getDate() - i);
        const dataStr = data.toISOString().split('T')[0];
        
        let estadosSolicitados = 0;
        let estadosEmitidos = 0;
        let estadosRecusados = 0;
        let estadosExpirados = 0;
        
        todasLicencas.forEach(l => {
          if (!l.states || !l.createdAt) return;
          
          const licenseDate = new Date(l.createdAt).toISOString().split('T')[0];
          if (licenseDate !== dataStr) return;
          
          l.states.forEach(state => {
            estadosSolicitados++;
            
            const stateStatus = l.stateStatuses?.find(s => s.startsWith(`${state}:`));
            if (stateStatus?.includes(':approved:')) {
              estadosEmitidos++;
            } else if (l.status === 'rejected') {
              estadosRecusados++;
            } else if (l.status === 'expired') {
              estadosExpirados++;
            }
          });
        });
        
        licencasPorStatus7Dias.push({
          data: data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
          solicitada: estadosSolicitados,
          emitida: estadosEmitidos,
          recusada: estadosRecusados,
          expirada: estadosExpirados
        });
      }

      return {
        aetsSolicitadasHoje: estadosSolicitadosHoje,
        aetsEmitidasHoje: estadosEmitidosHoje,
        aetsPendentes: estadosPendentes,
        aetsVencidasHoje: 0, // Precisaria implementar lógica de vencimento
        totalVeiculos: todosVeiculos.length,
        boletosHoje: boletosHoje.length,
        valorBoletosHoje,
        porEstado,
        porTipoVeiculo,
        ultimosBoletos,
        ultimasLicencas,
        licencasPorStatus7Dias
      };
    } catch (error) {
      console.error('Erro ao buscar dados do dashboard AET:', error);
      throw new Error('Falha ao buscar dados do dashboard AET');
    }
  }

  // Métodos relacionados a Boletos
  async getAllBoletos(): Promise<Boleto[]> {
    try {
      return await db
        .select()
        .from(boletos)
        .orderBy(desc(boletos.criadoEm));
    } catch (error) {
      console.error('Erro ao buscar todos os boletos:', error);
      throw new Error('Falha ao buscar boletos');
    }
  }

  async getBoletoById(id: number): Promise<Boleto | undefined> {
    try {
      const [boleto] = await db
        .select()
        .from(boletos)
        .where(eq(boletos.id, id));
      return boleto || undefined;
    } catch (error) {
      console.error('Erro ao buscar boleto por ID:', error);
      throw new Error('Falha ao buscar boleto');
    }
  }

  async getBoletosByTransportadorId(transportadorId: number): Promise<Boleto[]> {
    try {
      return await db
        .select()
        .from(boletos)
        .where(eq(boletos.transportadorId, transportadorId))
        .orderBy(desc(boletos.criadoEm));
    } catch (error) {
      console.error('Erro ao buscar boletos por transportador:', error);
      throw new Error('Falha ao buscar boletos do transportador');
    }
  }

  async createBoleto(boletoData: InsertBoleto): Promise<Boleto> {
    try {
      // Garantir conversão correta de datas
      const dataEmissao = typeof boletoData.dataEmissao === 'string' 
        ? new Date(boletoData.dataEmissao) 
        : boletoData.dataEmissao;
      const dataVencimento = typeof boletoData.dataVencimento === 'string' 
        ? new Date(boletoData.dataVencimento) 
        : boletoData.dataVencimento;

      const [boleto] = await db
        .insert(boletos)
        .values({
          ...boletoData,
          dataEmissao,
          dataVencimento,
          criadoEm: new Date(),
          atualizadoEm: new Date()
        })
        .returning();
      return boleto;
    } catch (error) {
      console.error('Erro ao criar boleto:', error);
      throw new Error('Falha ao criar boleto');
    }
  }

  async updateBoleto(id: number, boletoData: Partial<Boleto>): Promise<Boleto> {
    try {
      const updateData: any = { ...boletoData };
      
      // Converter strings de data para objetos Date
      if (updateData.dataEmissao && typeof updateData.dataEmissao === 'string') {
        updateData.dataEmissao = new Date(updateData.dataEmissao);
      }
      if (updateData.dataVencimento && typeof updateData.dataVencimento === 'string') {
        updateData.dataVencimento = new Date(updateData.dataVencimento);
      }
      
      const [updatedBoleto] = await db
        .update(boletos)
        .set({
          ...updateData,
          atualizadoEm: new Date()
        })
        .where(eq(boletos.id, id))
        .returning();
      
      if (!updatedBoleto) {
        throw new Error("Boleto não encontrado");
      }
      
      return updatedBoleto;
    } catch (error) {
      console.error('Erro ao atualizar boleto:', error);
      throw new Error('Falha ao atualizar boleto');
    }
  }

  async deleteBoleto(id: number): Promise<void> {
    try {
      const result = await db
        .delete(boletos)
        .where(eq(boletos.id, id))
        .returning();
      
      if (!result.length) {
        throw new Error("Boleto não encontrado");
      }
    } catch (error) {
      console.error('Erro ao deletar boleto:', error);
      throw new Error('Falha ao deletar boleto');
    }
  }

  // Método para sincronizar licenças aprovadas na tabela licencas_emitidas
  async sincronizarLicencaEmitida(licenca: any, estado: string, numeroAet: string, dataValidade: string, dataEmissao: string): Promise<void> {
    try {
      // Buscar informações dos veículos associados
      let placaTratora: string | null = licenca.mainVehiclePlate || null;
      let placaPrimeiraCarreta: string | null = null;
      let placaSegundaCarreta: string | null = null;
      let placaDolly: string | null = null;
      let placaPrancha: string | null = null;
      let placaReboque: string | null = null;

      // Obter placas dos veículos por ID se existirem
      if (licenca.tractorUnitId) {
        const tractorResult = await db.select({ plate: vehicles.plate })
          .from(vehicles)
          .where(eq(vehicles.id, licenca.tractorUnitId));
        if (tractorResult.length > 0) {
          placaTratora = tractorResult[0].plate;
        }
      }

      if (licenca.firstTrailerId) {
        const firstTrailerResult = await db.select({ plate: vehicles.plate })
          .from(vehicles)
          .where(eq(vehicles.id, licenca.firstTrailerId));
        if (firstTrailerResult.length > 0) {
          placaPrimeiraCarreta = firstTrailerResult[0].plate;
        }
      }

      if (licenca.secondTrailerId) {
        const secondTrailerResult = await db.select({ plate: vehicles.plate })
          .from(vehicles)
          .where(eq(vehicles.id, licenca.secondTrailerId));
        if (secondTrailerResult.length > 0) {
          placaSegundaCarreta = secondTrailerResult[0].plate;
        }
      }

      if (licenca.dollyId) {
        const dollyResult = await db.select({ plate: vehicles.plate })
          .from(vehicles)
          .where(eq(vehicles.id, licenca.dollyId));
        if (dollyResult.length > 0) {
          placaDolly = dollyResult[0].plate;
        }
      }

      if (licenca.flatbedId) {
        const flatbedResult = await db.select({ plate: vehicles.plate })
          .from(vehicles)
          .where(eq(vehicles.id, licenca.flatbedId));
        if (flatbedResult.length > 0) {
          placaPrancha = flatbedResult[0].plate;
        }
      }

      // Adicionar placas adicionais se existirem
      if (licenca.additionalPlates && Array.isArray(licenca.additionalPlates)) {
        licenca.additionalPlates.forEach((placa: string, index: number) => {
          if (placa) {
            if (index === 0 && !placaPrimeiraCarreta) placaPrimeiraCarreta = placa;
            else if (index === 1 && !placaSegundaCarreta) placaSegundaCarreta = placa;
            else if (index === 2 && !placaDolly) placaDolly = placa;
            else if (index === 3 && !placaPrancha) placaPrancha = placa;
            else if (index === 4 && !placaReboque) placaReboque = placa;
          }
        });
      }

      // Buscar CNPJ selecionado para o estado
      let cnpjSelecionado = null;
      if (licenca.stateCnpjs && Array.isArray(licenca.stateCnpjs)) {
        const cnpjEntry = licenca.stateCnpjs.find((entry: string) => entry.startsWith(`${estado}:`));
        if (cnpjEntry) {
          cnpjSelecionado = cnpjEntry.split(':')[1];
        }
      }

      // Verificar se já existe uma entrada para esta licença e estado
      const existingLicense = await db.select()
        .from(licencasEmitidas)
        .where(and(
          eq(licencasEmitidas.pedidoId, licenca.id),
          eq(licencasEmitidas.estado, estado)
        ));

      if (existingLicense.length > 0) {
        // Atualizar entrada existente
        await db.update(licencasEmitidas)
          .set({
            numeroLicenca: numeroAet,
            dataValidade: new Date(dataValidade),
            dataEmissao: new Date(dataEmissao),
            status: 'ativa',
            placaUnidadeTratora: placaTratora,
            placaPrimeiraCarreta: placaPrimeiraCarreta,
            placaSegundaCarreta: placaSegundaCarreta,
            placaDolly: placaDolly,
            placaPrancha: placaPrancha,
            placaReboque: placaReboque,
            cnpjSelecionado: cnpjSelecionado,
            updatedAt: new Date()
          })
          .where(and(
            eq(licencasEmitidas.pedidoId, licenca.id),
            eq(licencasEmitidas.estado, estado)
          ));
      } else {
        // Inserir nova entrada
        await db.insert(licencasEmitidas).values({
          pedidoId: licenca.id,
          estado: estado,
          numeroLicenca: numeroAet,
          dataEmissao: new Date(dataEmissao),
          dataValidade: new Date(dataValidade),
          status: 'ativa',
          placaUnidadeTratora: placaTratora,
          placaPrimeiraCarreta: placaPrimeiraCarreta,
          placaSegundaCarreta: placaSegundaCarreta,
          placaDolly: placaDolly,
          placaPrancha: placaPrancha,
          placaReboque: placaReboque,
          cnpjSelecionado: cnpjSelecionado
        });
      }

      console.log(`[SINCRONIZAÇÃO] Licença emitida sincronizada: ${numeroAet} para estado ${estado}`);
    } catch (error) {
      console.error('[SINCRONIZAÇÃO] Erro ao sincronizar licença emitida:', error);
      throw error;
    }
  }
}