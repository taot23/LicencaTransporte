import { 
  users, type User, type InsertUser,
  vehicles, type Vehicle, type InsertVehicle,
  transporters, type Transporter, type InsertTransporter,
  licenseRequests, type LicenseRequest, type InsertLicenseRequest, type UpdateLicenseStatus, 
  type UpdateLicenseState, LicenseStatus, LicenseType
} from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";
import connectPg from "connect-pg-simple";
import { eq, and, desc, asc, sql } from "drizzle-orm";
import { db, pool } from "./db";

const MemoryStore = createMemoryStore(session);
// @ts-ignore - Suprime erro de tipagem
const PostgresSessionStore = connectPg(session);

// Define o tipo de estatísticas do painel
export interface DashboardStats {
  issuedLicenses: number;
  pendingLicenses: number;
  registeredVehicles: number;
  activeVehicles: number;
  recentLicenses: Array<{
    id: number;
    requestNumber: string;
    type: string;
    mainVehiclePlate: string;
    states: string[];
    status: string;
    createdAt: string;
  }>;
}

export interface ChartData {
  name: string;
  value: number;
}

// Interface de armazenamento
export interface IStorage {
  // Métodos de usuário
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getAllUsers(): Promise<User[]>;
  getNonAdminUsers(): Promise<User[]>;
  updateUser(id: number, userData: Partial<User>): Promise<User>;
  deleteUser(id: number): Promise<void>;
  
  // Transportador methods
  getTransporterById(id: number): Promise<Transporter | undefined>;
  getTransporterByDocument(documentNumber: string): Promise<Transporter | undefined>;
  getAllTransporters(): Promise<Transporter[]>;
  createTransporter(transporter: InsertTransporter): Promise<Transporter>;
  updateTransporter(id: number, transporter: Partial<Transporter>): Promise<Transporter>;
  deleteTransporter(id: number): Promise<void>;
  linkTransporterToUser(transporterId: number, userId: number | null): Promise<Transporter>;
  
  // Vehicle methods
  getVehicleById(id: number): Promise<Vehicle | undefined>;
  getVehiclesByUserId(userId: number): Promise<Vehicle[]>;
  createVehicle(userId: number, vehicle: InsertVehicle & { crlvUrl?: string | null }): Promise<Vehicle>;
  updateVehicle(id: number, vehicle: Partial<Vehicle>): Promise<Vehicle>;
  deleteVehicle(id: number): Promise<void>;
  
  // License methods
  getLicenseRequestById(id: number): Promise<LicenseRequest | undefined>;
  getLicenseRequestsByUserId(userId: number): Promise<LicenseRequest[]>;
  getLicenseDraftsByUserId(userId: number): Promise<LicenseRequest[]>;
  getIssuedLicensesByUserId(userId: number): Promise<LicenseRequest[]>;
  getAllLicenseRequests(): Promise<LicenseRequest[]>;
  createLicenseRequest(userId: number, license: InsertLicenseRequest & { requestNumber: string, isDraft: boolean }): Promise<LicenseRequest>;
  createLicenseDraft(userId: number, draft: InsertLicenseRequest & { requestNumber: string, isDraft: boolean }): Promise<LicenseRequest>;
  updateLicenseDraft(id: number, draft: Partial<LicenseRequest>): Promise<LicenseRequest>;
  deleteLicenseRequest(id: number): Promise<void>;
  submitLicenseDraft(id: number, requestNumber: string): Promise<LicenseRequest>;
  updateLicenseStatus(id: number, statusUpdate: UpdateLicenseStatus & { licenseFileUrl?: string }): Promise<LicenseRequest>;
  updateLicenseStateStatus(data: UpdateLicenseState): Promise<LicenseRequest>;
  
  // Dashboard stats
  getDashboardStats(userId: number): Promise<DashboardStats>;
  getVehicleStats(userId: number): Promise<ChartData[]>;
  getStateStats(userId: number): Promise<ChartData[]>;
  
  // Session store
  sessionStore: any;
}

// Implementação de armazenamento em memória
export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private transporters: Map<number, Transporter>;
  private vehicles: Map<number, Vehicle>;
  private licenseRequests: Map<number, LicenseRequest>;
  private currentUserId: number;
  private currentTransporterId: number;
  private currentVehicleId: number;
  private currentLicenseId: number;
  public sessionStore: any;

  constructor() {
    this.users = new Map();
    this.transporters = new Map();
    this.vehicles = new Map();
    this.licenseRequests = new Map();
    this.currentUserId = 1;
    this.currentTransporterId = 1;
    this.currentVehicleId = 1;
    this.currentLicenseId = 1;
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000, // remove entradas expiradas a cada 24h
    });
    
    // Cria usuário administrador - autenticação de senha tratada por caso especial em auth.ts
    const id = this.currentUserId++;
    const adminUser: User = {
      id,
      email: "admin@sistema.com",
      password: "admin-special-password", // Este é apenas um marcador, verificação real está em auth.ts
      fullName: "Administrador",
      phone: "(11) 99999-9999",
      isAdmin: true,
      role: "admin",
      createdAt: new Date().toISOString()
    };
    this.users.set(id, adminUser);
    
    // Cria usuário transportador para testes
    const transporterId = this.currentUserId++;
    const transporterUser: User = {
      id: transporterId,
      email: "transportador@teste.com",
      password: "$2b$10$oDIUQbw08yuv3aX/uAHWoO8BDC5h3l24giiPDZ.iWoKKwS3.AvbW6", // senha: 123456
      fullName: "Usuário Transportador",
      phone: "(11) 98765-4321",
      isAdmin: false,
      role: "user",
      createdAt: new Date().toISOString()
    };
    this.users.set(transporterId, transporterUser);
    
    // Cria empresa transportadora de teste e vincula ao usuário
    const companyId = this.currentTransporterId++;
    const testCompany: Transporter = {
      id: companyId,
      personType: "pj",
      name: "Transportadora Teste Ltda",
      tradeName: "Transportes Rápidos",
      documentNumber: "12345678000190",
      email: "contato@transportesteste.com",
      phone: "(11) 3333-4444",
      legalResponsible: "João da Silva",
      street: "Avenida Brasil",
      number: "1500",
      complement: "Sala 300",
      district: "Centro",
      zipCode: "01000-000",
      city: "São Paulo",
      state: "SP",
      userId: transporterId,
      subsidiaries: [],
      documents: [],
      createdAt: new Date().toISOString()
    };
    this.transporters.set(companyId, testCompany);
    
    // Adicionar veículos de teste para o transportador
    const tratorId = this.currentVehicleId++;
    const vehicleTrator: Vehicle = {
      id: tratorId,
      userId: transporterId,
      plate: "ABC1234",
      type: "tractor", // Unidade Tratora
      tare: 9000,
      crlvYear: 2023,
      status: "active",
      crlvUrl: null
    };
    this.vehicles.set(tratorId, vehicleTrator);
    
    const semiReboqueId1 = this.currentVehicleId++;
    const vehicleSemi1: Vehicle = {
      id: semiReboqueId1,
      userId: transporterId,
      plate: "XYZ5678",
      type: "semi_trailer", // Semirreboque
      tare: 7000,
      crlvYear: 2022,
      status: "active",
      crlvUrl: null
    };
    this.vehicles.set(semiReboqueId1, vehicleSemi1);
    
    const semiReboqueId2 = this.currentVehicleId++;
    const vehicleSemi2: Vehicle = {
      id: semiReboqueId2,
      userId: transporterId,
      plate: "DEF9012",
      type: "semi_trailer", // Semirreboque
      tare: 6500,
      crlvYear: 2021,
      status: "active",
      crlvUrl: null
    };
    this.vehicles.set(semiReboqueId2, vehicleSemi2);
    
    // Criar uma licença de teste para o transportador
    const licenseId = this.currentLicenseId++;
    const testLicense: LicenseRequest = {
      id: licenseId,
      userId: transporterId,
      transporterId: companyId,
      requestNumber: "LIC-2023-001",
      type: "bitrem",
      mainVehiclePlate: "ABC1234",
      additionalPlates: ["XYZ5678", "DEF9012"],
      additionalPlatesDocuments: [],
      states: ["SP", "MG", "PR"],
      status: "under_review",
      comments: "Licença de teste para demonstração do sistema",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isDraft: false,
      licenseFileUrl: null,
      validUntil: null,
      stateStatuses: ["SP:under_review", "MG:pending", "PR:pending_approval"],
      stateFiles: []
    };
    this.licenseRequests.set(licenseId, testLicense);
  }

  // Métodos de usuário
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.email.toLowerCase() === email.toLowerCase()
    );
  }

  async createUser(userData: InsertUser & { isAdmin?: boolean }): Promise<User> {
    const id = this.currentUserId++;
    const user: User = { 
      ...userData, 
      id,
      isAdmin: userData.isAdmin || false,
      createdAt: new Date().toISOString()
    };
    this.users.set(id, user);
    return user;
  }
  
  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }
  
  async getNonAdminUsers(): Promise<User[]> {
    return Array.from(this.users.values()).filter(user => !user.isAdmin);
  }
  
  async updateUser(id: number, userData: Partial<User>): Promise<User> {
    const user = await this.getUser(id);
    if (!user) {
      throw new Error("Usuário não encontrado");
    }
    
    const updatedUser = { ...user, ...userData };
    this.users.set(id, updatedUser);
    return updatedUser;
  }
  
  async deleteUser(id: number): Promise<void> {
    const user = await this.getUser(id);
    if (!user) {
      throw new Error("Usuário não encontrado");
    }
    
    this.users.delete(id);
  }
  
  // Métodos de transportador
  async getTransporterById(id: number): Promise<Transporter | undefined> {
    return this.transporters.get(id);
  }
  
  async getTransporterByDocument(documentNumber: string): Promise<Transporter | undefined> {
    return Array.from(this.transporters.values()).find(
      (transporter) => transporter.documentNumber === documentNumber
    );
  }
  
  async getAllTransporters(): Promise<Transporter[]> {
    return Array.from(this.transporters.values());
  }
  
  async createTransporter(transporterData: InsertTransporter): Promise<Transporter> {
    const id = this.currentTransporterId++;
    const now = new Date();
    
    const transporter: Transporter = {
      ...transporterData,
      id,
      userId: transporterData.userId || null,
      createdAt: now.toISOString()
    };
    
    this.transporters.set(id, transporter);
    return transporter;
  }
  
  async updateTransporter(id: number, transporterData: Partial<Transporter>): Promise<Transporter> {
    const transporter = await this.getTransporterById(id);
    if (!transporter) {
      throw new Error("Transportador não encontrado");
    }
    
    const updatedTransporter = { ...transporter, ...transporterData };
    this.transporters.set(id, updatedTransporter);
    return updatedTransporter;
  }
  
  async deleteTransporter(id: number): Promise<void> {
    const transporter = await this.getTransporterById(id);
    if (!transporter) {
      throw new Error("Transportador não encontrado");
    }
    
    this.transporters.delete(id);
  }
  
  async linkTransporterToUser(transporterId: number, userId: number | null): Promise<Transporter> {
    const transporter = await this.getTransporterById(transporterId);
    if (!transporter) {
      throw new Error("Transportador não encontrado");
    }
    
    // Se userId for null, estamos apenas removendo a vinculação
    if (userId !== null) {
      const user = await this.getUser(userId);
      if (!user) {
        throw new Error("Usuário não encontrado");
      }
    }
    
    const updatedTransporter = { ...transporter, userId };
    this.transporters.set(transporterId, updatedTransporter);
    return updatedTransporter;
  }

  // Vehicle methods
  async getVehicleById(id: number): Promise<Vehicle | undefined> {
    return this.vehicles.get(id);
  }

  async getVehiclesByUserId(userId: number): Promise<Vehicle[]> {
    // Retorna todos os veículos quando userId=0 (caso especial para admin)
    if (userId === 0) {
      return Array.from(this.vehicles.values());
    }
    
    return Array.from(this.vehicles.values()).filter(
      (vehicle) => vehicle.userId === userId
    );
  }

  async createVehicle(userId: number, vehicleData: InsertVehicle & { crlvUrl?: string | null }): Promise<Vehicle> {
    const id = this.currentVehicleId++;
    const vehicle: Vehicle = { 
      ...vehicleData, 
      id,
      userId,
      status: vehicleData.status || "active",
      crlvUrl: vehicleData.crlvUrl || null
    };
    this.vehicles.set(id, vehicle);
    return vehicle;
  }

  async updateVehicle(id: number, vehicleData: Partial<Vehicle>): Promise<Vehicle> {
    const vehicle = this.vehicles.get(id);
    if (!vehicle) {
      throw new Error("Vehicle not found");
    }
    
    const updatedVehicle: Vehicle = { ...vehicle, ...vehicleData };
    this.vehicles.set(id, updatedVehicle);
    return updatedVehicle;
  }

  async deleteVehicle(id: number): Promise<void> {
    this.vehicles.delete(id);
  }

  // License methods
  async getLicenseRequestById(id: number): Promise<LicenseRequest | undefined> {
    return this.licenseRequests.get(id);
  }

  async getLicenseRequestsByUserId(userId: number): Promise<LicenseRequest[]> {
    // Retorna todas as licenças quando userId=0 (caso especial para admin)
    if (userId === 0) {
      return Array.from(this.licenseRequests.values()).filter(
        (license) => !license.isDraft
      );
    }
    
    return Array.from(this.licenseRequests.values()).filter(
      (license) => license.userId === userId && !license.isDraft
    );
  }

  async getLicenseDraftsByUserId(userId: number): Promise<LicenseRequest[]> {
    // Retorna todos os rascunhos quando userId=0 (caso especial para admin)
    if (userId === 0) {
      return Array.from(this.licenseRequests.values()).filter(
        (license) => license.isDraft
      );
    }
    
    return Array.from(this.licenseRequests.values()).filter(
      (license) => license.userId === userId && license.isDraft
    );
  }

  async getIssuedLicensesByUserId(userId: number): Promise<LicenseRequest[]> {
    // Função helper para verificar se todos os estados de uma licença estão "liberada"
    const allStatesApproved = (license: LicenseRequest): boolean => {
      if (!license.stateStatuses || license.stateStatuses.length === 0) {
        return false;
      }
      
      // Verificar se todos os estados da licença têm status 'approved'
      return license.states.every(state => {
        const stateStatus = license.stateStatuses?.find(ss => ss.startsWith(`${state}:`))?.split(':')[1];
        return stateStatus === 'approved';
      });
    };
    
    // Caso especial para admin (userId=0)
    if (userId === 0) {
      return Array.from(this.licenseRequests.values()).filter(
        (license) => {
          // Incluir licenças onde todos os estados estão aprovados
          if (allStatesApproved(license)) return true;
          
          // Ou incluir licenças com status geral 'approved'
          if (license.status === 'approved') return true;
          
          // Ou incluir licenças que tenham pelo menos um estado com status 'approved'
          if (license.stateStatuses && license.stateStatuses.some(ss => ss.includes(':approved'))) {
            return true;
          }
          
          return false;
        }
      );
    }
    
    // Caso normal para usuários
    return Array.from(this.licenseRequests.values()).filter(
      (license) => {
        if (license.userId !== userId) return false;
        
        // Incluir licenças onde todos os estados estão aprovados
        if (allStatesApproved(license)) return true;
        
        // Ou incluir licenças com status geral 'approved'
        if (license.status === 'approved') return true;
        
        // Ou incluir licenças que tenham pelo menos um estado com status 'approved'
        if (license.stateStatuses && license.stateStatuses.some(ss => ss.includes(':approved'))) {
          return true;
        }
        
        return false;
      }
    );
  }

  async getAllLicenseRequests(): Promise<LicenseRequest[]> {
    return Array.from(this.licenseRequests.values()).filter(
      (license) => !license.isDraft
    );
  }

  async createLicenseRequest(userId: number, licenseData: InsertLicenseRequest & { requestNumber: string, isDraft: boolean }): Promise<LicenseRequest> {
    const id = this.currentLicenseId++;
    const now = new Date();
    
    const license: LicenseRequest = {
      ...licenseData,
      id,
      userId,
      requestNumber: licenseData.requestNumber,
      status: licenseData.isDraft ? 'pending_registration' : 'pending_registration',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      isDraft: licenseData.isDraft,
      additionalPlates: licenseData.additionalPlates || [],
      additionalPlatesDocuments: licenseData.additionalPlatesDocuments || [],
      comments: licenseData.comments || null,
      licenseFileUrl: null,
      validUntil: null
    };
    
    this.licenseRequests.set(id, license);
    return license;
  }

  async createLicenseDraft(userId: number, draftData: InsertLicenseRequest & { requestNumber: string, isDraft: boolean }): Promise<LicenseRequest> {
    return this.createLicenseRequest(userId, draftData);
  }

  async updateLicenseDraft(id: number, draftData: Partial<LicenseRequest>): Promise<LicenseRequest> {
    const draft = this.licenseRequests.get(id);
    if (!draft) {
      throw new Error("Draft not found");
    }
    
    const now = new Date();
    const updatedDraft: LicenseRequest = { 
      ...draft, 
      ...draftData,
      updatedAt: now.toISOString() 
    };
    
    this.licenseRequests.set(id, updatedDraft);
    return updatedDraft;
  }

  async deleteLicenseRequest(id: number): Promise<void> {
    this.licenseRequests.delete(id);
  }

  async submitLicenseDraft(id: number, requestNumber: string): Promise<LicenseRequest> {
    const draft = this.licenseRequests.get(id);
    if (!draft) {
      throw new Error("Draft not found");
    }
    
    const now = new Date();
    const licenseRequest: LicenseRequest = {
      ...draft,
      requestNumber,
      isDraft: false,
      updatedAt: now.toISOString()
    };
    
    this.licenseRequests.set(id, licenseRequest);
    return licenseRequest;
  }

  async updateLicenseStatus(id: number, statusUpdate: UpdateLicenseStatus & { licenseFileUrl?: string }): Promise<LicenseRequest> {
    const license = this.licenseRequests.get(id);
    if (!license) {
      throw new Error("License not found");
    }
    
    const now = new Date();
    let updatedLicense: LicenseRequest = {
      ...license,
      status: statusUpdate.status,
      comments: statusUpdate.comments || license.comments,
      updatedAt: now.toISOString(),
      licenseFileUrl: statusUpdate.licenseFileUrl || license.licenseFileUrl,
      validUntil: statusUpdate.validUntil || license.validUntil
    };
    
    // Se temos um estado específico para atualizar
    if (statusUpdate.state && statusUpdate.stateStatus) {
      // Inicializa arrays se necessário
      const stateStatuses = updatedLicense.stateStatuses || [];
      const stateFiles = updatedLicense.stateFiles || [];
      
      const stateStatusKey = `${statusUpdate.state}:${statusUpdate.stateStatus}`;
      
      // Remove status antigo para este estado, se existir
      const stateStatusIndex = stateStatuses.findIndex(s => s.startsWith(`${statusUpdate.state}:`));
      if (stateStatusIndex >= 0) {
        stateStatuses.splice(stateStatusIndex, 1);
      }
      
      // Adiciona novo status
      stateStatuses.push(stateStatusKey);
      
      // Se tiver arquivo, adiciona ou atualiza
      if (statusUpdate.stateFile) {
        const stateFileIndex = stateFiles.findIndex(f => f.startsWith(`${statusUpdate.state}:`));
        if (stateFileIndex >= 0) {
          stateFiles.splice(stateFileIndex, 1);
        }
        
        // Usa o caminho do arquivo salvo pelo middleware multer
        const fileUrl = `/uploads/${statusUpdate.stateFile.filename}`;
        stateFiles.push(`${statusUpdate.state}:${fileUrl}`);
      }
      
      updatedLicense = {
        ...updatedLicense,
        stateStatuses,
        stateFiles
      };
      
      // Verifica se todos os estados possuem status 'approved' e atualiza o status geral
      const allStatesApproved = updatedLicense.states.every(state => {
        const stateStatus = stateStatuses.find(ss => ss.startsWith(`${state}:`))?.split(':')[1];
        return stateStatus === 'approved';
      });
      
      if (allStatesApproved) {
        updatedLicense.status = 'approved';
      }
    }
    
    this.licenseRequests.set(id, updatedLicense);
    return updatedLicense;
  }
  
  // Método específico para atualizar apenas o status de um estado
  async updateLicenseStateStatus(data: UpdateLicenseState): Promise<LicenseRequest> {
    const { licenseId, state, status, file, comments, validUntil, aetNumber } = data;
    
    const license = this.licenseRequests.get(licenseId);
    if (!license) {
      throw new Error("License not found");
    }
    
    // Inicializa arrays se necessário
    const stateStatuses = license.stateStatuses || [];
    const stateFiles = license.stateFiles || [];
    
    // Remove status antigo para este estado, se existir
    const stateStatusIndex = stateStatuses.findIndex(s => s.startsWith(`${state}:`));
    if (stateStatusIndex >= 0) {
      stateStatuses.splice(stateStatusIndex, 1);
    }
    
    // Se for status "approved" e tiver data de validade, incluir no status
    if (status === "approved" && validUntil) {
      // Se existe um aetNumber em um estado anterior, manter esse número
      if (aetNumber) {
        stateStatuses.push(`${state}:${status}:${validUntil}:${aetNumber}`);
      } else {
        // Procurar número da AET em estados anteriores
        const aetNumberFromPreviousState = license.stateStatuses?.find(
          ss => ss.includes(":under_review:") || ss.includes(":pending_approval:"))
          ?.split(":")
          ?.pop();
        
        if (aetNumberFromPreviousState) {
          stateStatuses.push(`${state}:${status}:${validUntil}:${aetNumberFromPreviousState}`);
        } else {
          stateStatuses.push(`${state}:${status}:${validUntil}`);
        }
      }
    } 
    // Se for status "under_review" ou "pending_approval" e tiver número da AET, incluir no status
    else if ((status === "under_review" || status === "pending_approval") && aetNumber) {
      stateStatuses.push(`${state}:${status}:${aetNumber}`);
      
      // Se for o primeiro estado a receber número de AET, atualizar o número do pedido/licença
      if (license.requestNumber && !license.requestNumber.includes("AET")) {
        license.requestNumber = `${license.requestNumber} (AET: ${aetNumber})`;
      }
    } 
    else {
      // Adiciona novo status normal
      stateStatuses.push(`${state}:${status}`);
    }
    
    // Se tiver arquivo, adiciona ou atualiza
    if (file) {
      const stateFileIndex = stateFiles.findIndex(f => f.startsWith(`${state}:`));
      if (stateFileIndex >= 0) {
        stateFiles.splice(stateFileIndex, 1);
      }
      
      // Usa o caminho do arquivo salvo pelo middleware multer
      const fileUrl = `/uploads/${file.filename}`;
      stateFiles.push(`${state}:${fileUrl}`);
    }
    
    const now = new Date();
    const updatedLicense: LicenseRequest = {
      ...license,
      stateStatuses,
      stateFiles,
      updatedAt: now.toISOString(),
      comments: comments || license.comments,
      // Adicionar validUntil para a licença principal quando o estado é approved e tem validUntil
      validUntil: (status === "approved" && validUntil) ? 
        new Date(validUntil).toISOString() : 
        (license.validUntil || undefined)
    };
    
    // Verifica se todos os estados possuem status 'approved' e atualiza o status geral
    const allStatesApproved = updatedLicense.states.every(state => {
      const stateStatus = stateStatuses.find(ss => ss.startsWith(`${state}:`))?.split(':')[1];
      return stateStatus === 'approved';
    });
    
    if (allStatesApproved) {
      updatedLicense.status = 'approved';
    }
    
    this.licenseRequests.set(licenseId, updatedLicense);
    return updatedLicense;
  }

  // Dashboard stats
  async getDashboardStats(userId: number): Promise<DashboardStats> {
    const userVehicles = await this.getVehiclesByUserId(userId);
    const userLicenses = await this.getLicenseRequestsByUserId(userId);
    
    // Sort licenses by createdAt descending for recent licenses
    const sortedLicenses = [...userLicenses].sort((a, b) => {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    
    return {
      issuedLicenses: userLicenses.filter(license => license.status === 'approved').length,
      pendingLicenses: userLicenses.filter(license => license.status !== 'approved').length,
      registeredVehicles: userVehicles.length,
      activeVehicles: userVehicles.filter(vehicle => vehicle.status === 'active').length,
      recentLicenses: sortedLicenses.slice(0, 5).map(license => ({
        id: license.id,
        requestNumber: license.requestNumber,
        type: license.type,
        mainVehiclePlate: license.mainVehiclePlate,
        states: license.states,
        status: license.status,
        createdAt: license.createdAt
      }))
    };
  }

  async getVehicleStats(userId: number): Promise<ChartData[]> {
    const userVehicles = await this.getVehiclesByUserId(userId);
    
    // Count vehicles by type
    const vehicleTypeCount: Record<string, number> = {};
    userVehicles.forEach(vehicle => {
      const type = this.getVehicleTypeLabel(vehicle.type);
      vehicleTypeCount[type] = (vehicleTypeCount[type] || 0) + 1;
    });
    
    return Object.entries(vehicleTypeCount).map(([name, value]) => ({ name, value }));
  }

  async getStateStats(userId: number): Promise<ChartData[]> {
    const userLicenses = await this.getLicenseRequestsByUserId(userId);
    
    // Count licenses by state
    const stateCount: Record<string, number> = {};
    userLicenses.forEach(license => {
      license.states.forEach(state => {
        stateCount[state] = (stateCount[state] || 0) + 1;
      });
    });
    
    return Object.entries(stateCount).map(([name, value]) => ({ name, value }));
  }

  // Helper to convert vehicle type to label for stats
  private getVehicleTypeLabel(type: string): string {
    switch (type) {
      case "tractor_unit": return "Unidade Tratora";
      case "semi_trailer": return "Semirreboque";
      case "trailer": return "Reboque";
      case "dolly": return "Dolly";
      case "flatbed": return "Prancha";
      default: return type;
    }
  }
}

// Implementação de armazenamento com PostgreSQL
export class DatabaseStorage implements IStorage {
  public sessionStore: any;

  constructor() {
    this.sessionStore = new PostgresSessionStore({ 
      pool, 
      createTableIfMissing: true 
    });
  }

  // Métodos de usuário
  async getUser(id: number): Promise<User | undefined> {
    const results = await db.select().from(users).where(eq(users.id, id));
    return results[0];
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const results = await db.select().from(users).where(eq(users.email, email));
    return results[0];
  }

  async createUser(userData: InsertUser & { isAdmin?: boolean }): Promise<User> {
    // Verificar se o email já está em uso
    const existingUser = await this.getUserByEmail(userData.email);
    if (existingUser) {
      throw new Error("Email já está em uso");
    }

    const newUser = {
      ...userData,
      isAdmin: userData.isAdmin || false,
    };

    const results = await db.insert(users).values(newUser).returning();
    return results[0];
  }
  
  async getAllUsers(): Promise<User[]> {
    return db.select().from(users);
  }
  
  async getNonAdminUsers(): Promise<User[]> {
    return db.select().from(users).where(eq(users.isAdmin, false));
  }
  
  async updateUser(id: number, userData: Partial<User>): Promise<User> {
    const results = await db.update(users)
      .set(userData)
      .where(eq(users.id, id))
      .returning();
    
    if (results.length === 0) {
      throw new Error("Usuário não encontrado");
    }
    
    return results[0];
  }
  
  async deleteUser(id: number): Promise<void> {
    await db.delete(users).where(eq(users.id, id));
  }
  
  // Métodos de transportador
  async getTransporterById(id: number): Promise<Transporter | undefined> {
    const results = await db.select().from(transporters).where(eq(transporters.id, id));
    return results[0];
  }
  
  async getTransporterByDocument(documentNumber: string): Promise<Transporter | undefined> {
    const results = await db.select().from(transporters).where(eq(transporters.documentNumber, documentNumber));
    return results[0];
  }
  
  async getAllTransporters(): Promise<Transporter[]> {
    return db.select().from(transporters);
  }
  
  async createTransporter(transporterData: InsertTransporter): Promise<Transporter> {
    const results = await db.insert(transporters).values(transporterData).returning();
    return results[0];
  }
  
  async updateTransporter(id: number, transporterData: Partial<Transporter>): Promise<Transporter> {
    const results = await db.update(transporters)
      .set(transporterData)
      .where(eq(transporters.id, id))
      .returning();
    
    if (results.length === 0) {
      throw new Error("Transportador não encontrado");
    }
    
    return results[0];
  }
  
  async deleteTransporter(id: number): Promise<void> {
    await db.delete(transporters).where(eq(transporters.id, id));
  }
  
  async linkTransporterToUser(transporterId: number, userId: number | null): Promise<Transporter> {
    const results = await db.update(transporters)
      .set({ userId })
      .where(eq(transporters.id, transporterId))
      .returning();
    
    if (results.length === 0) {
      throw new Error("Transportador não encontrado");
    }
    
    return results[0];
  }

  // Vehicle methods
  async getVehicleById(id: number): Promise<Vehicle | undefined> {
    const results = await db.select().from(vehicles).where(eq(vehicles.id, id));
    return results[0];
  }

  async getVehiclesByUserId(userId: number): Promise<Vehicle[]> {
    // Retorna todos os veículos quando userId=0 (caso especial para admin)
    if (userId === 0) {
      return db.select().from(vehicles);
    }
    
    return db.select().from(vehicles).where(eq(vehicles.userId, userId));
  }

  async createVehicle(userId: number, vehicleData: InsertVehicle & { crlvUrl?: string | null }): Promise<Vehicle> {
    const vehicle = {
      ...vehicleData,
      userId,
      status: vehicleData.status || "active",
      crlvUrl: vehicleData.crlvUrl || null
    };
    
    const results = await db.insert(vehicles).values(vehicle).returning();
    return results[0];
  }

  async updateVehicle(id: number, vehicleData: Partial<Vehicle>): Promise<Vehicle> {
    const results = await db.update(vehicles)
      .set(vehicleData)
      .where(eq(vehicles.id, id))
      .returning();
    
    if (results.length === 0) {
      throw new Error("Vehicle not found");
    }
    
    return results[0];
  }

  async deleteVehicle(id: number): Promise<void> {
    await db.delete(vehicles).where(eq(vehicles.id, id));
  }

  // License methods
  async getLicenseRequestById(id: number): Promise<LicenseRequest | undefined> {
    const results = await db.select().from(licenseRequests).where(eq(licenseRequests.id, id));
    return results[0];
  }

  async getLicenseRequestsByUserId(userId: number): Promise<LicenseRequest[]> {
    // Retorna todas as licenças quando userId=0 (caso especial para admin)
    if (userId === 0) {
      return db.select()
        .from(licenseRequests)
        .where(eq(licenseRequests.isDraft, false))
        .orderBy(desc(licenseRequests.createdAt));
    }
    
    return db.select()
      .from(licenseRequests)
      .where(and(
        eq(licenseRequests.userId, userId),
        eq(licenseRequests.isDraft, false)
      ))
      .orderBy(desc(licenseRequests.createdAt));
  }

  async getLicenseDraftsByUserId(userId: number): Promise<LicenseRequest[]> {
    // Retorna todos os rascunhos quando userId=0 (caso especial para admin)
    if (userId === 0) {
      return db.select()
        .from(licenseRequests)
        .where(eq(licenseRequests.isDraft, true))
        .orderBy(desc(licenseRequests.createdAt));
    }
    
    return db.select()
      .from(licenseRequests)
      .where(and(
        eq(licenseRequests.userId, userId),
        eq(licenseRequests.isDraft, true)
      ))
      .orderBy(desc(licenseRequests.createdAt));
  }

  async getIssuedLicensesByUserId(userId: number): Promise<LicenseRequest[]> {
    // Caso especial para admin (userId=0)
    if (userId === 0) {
      // Esta consulta é aproximada, pois o PostgreSQL não tem uma maneira direta
      // de verificar se todos os elementos de um array atendem a uma condição
      return db.select()
        .from(licenseRequests)
        .where(eq(licenseRequests.status, "approved"))
        .orderBy(desc(licenseRequests.createdAt));
    }
    
    // Caso normal para usuários
    return db.select()
      .from(licenseRequests)
      .where(and(
        eq(licenseRequests.userId, userId),
        eq(licenseRequests.status, "approved")
      ))
      .orderBy(desc(licenseRequests.createdAt));
  }

  async getAllLicenseRequests(): Promise<LicenseRequest[]> {
    return db.select().from(licenseRequests).orderBy(desc(licenseRequests.createdAt));
  }

  async createLicenseRequest(userId: number, licenseData: InsertLicenseRequest & { requestNumber: string, isDraft: boolean }): Promise<LicenseRequest> {
    const now = new Date();
    
    const license = {
      ...licenseData,
      userId,
      createdAt: now,
      updatedAt: now
    };
    
    const results = await db.insert(licenseRequests).values(license).returning();
    return results[0];
  }

  async createLicenseDraft(userId: number, draftData: InsertLicenseRequest & { requestNumber: string, isDraft: boolean }): Promise<LicenseRequest> {
    return this.createLicenseRequest(userId, { ...draftData, isDraft: true });
  }

  async updateLicenseDraft(id: number, draftData: Partial<LicenseRequest>): Promise<LicenseRequest> {
    const now = new Date();
    
    const results = await db.update(licenseRequests)
      .set({ ...draftData, updatedAt: now })
      .where(eq(licenseRequests.id, id))
      .returning();
    
    if (results.length === 0) {
      throw new Error("Rascunho não encontrado");
    }
    
    return results[0];
  }

  async deleteLicenseRequest(id: number): Promise<void> {
    await db.delete(licenseRequests).where(eq(licenseRequests.id, id));
  }

  async submitLicenseDraft(id: number, requestNumber: string): Promise<LicenseRequest> {
    const now = new Date();
    
    const results = await db.update(licenseRequests)
      .set({ 
        isDraft: false, 
        requestNumber,
        status: "pending_registration", 
        updatedAt: now 
      })
      .where(eq(licenseRequests.id, id))
      .returning();
    
    if (results.length === 0) {
      throw new Error("Rascunho não encontrado");
    }
    
    return results[0];
  }

  async updateLicenseStatus(id: number, statusUpdate: UpdateLicenseStatus & { licenseFileUrl?: string }): Promise<LicenseRequest> {
    const now = new Date();
    const updateData: any = { 
      status: statusUpdate.status, 
      updatedAt: now 
    };
    
    if (statusUpdate.comments) {
      updateData.comments = statusUpdate.comments;
    }
    
    if (statusUpdate.licenseFileUrl) {
      updateData.licenseFileUrl = statusUpdate.licenseFileUrl;
    }
    
    if (statusUpdate.validUntil) {
      updateData.validUntil = new Date(statusUpdate.validUntil);
    }
    
    const results = await db.update(licenseRequests)
      .set(updateData)
      .where(eq(licenseRequests.id, id))
      .returning();
    
    if (results.length === 0) {
      throw new Error("Licença não encontrada");
    }
    
    return results[0];
  }

  async updateLicenseStateStatus(data: UpdateLicenseState): Promise<LicenseRequest> {
    const license = await this.getLicenseRequestById(data.licenseId);
    if (!license) {
      throw new Error("Licença não encontrada");
    }
    
    const now = new Date();
    let stateStatuses = [...(license.stateStatuses || [])];
    let stateFiles = [...(license.stateFiles || [])];
    
    // Atualizar o status para o estado específico
    const stateStatusIndex = stateStatuses.findIndex(ss => ss.startsWith(`${data.state}:`));
    const newStateStatus = `${data.state}:${data.status}`;
    
    if (stateStatusIndex >= 0) {
      stateStatuses[stateStatusIndex] = newStateStatus;
    } else {
      stateStatuses.push(newStateStatus);
    }
    
    // Adicionar URL do arquivo para o estado específico, se fornecido
    if (data.file) {
      const stateFileIndex = stateFiles.findIndex(sf => sf.startsWith(`${data.state}:`));
      const newStateFile = `${data.state}:${data.file}`;
      
      if (stateFileIndex >= 0) {
        stateFiles[stateFileIndex] = newStateFile;
      } else {
        stateFiles.push(newStateFile);
      }
    }
    
    // Atualizar a licença
    const updateData: any = {
      stateStatuses,
      stateFiles,
      updatedAt: now
    };
    
    // Atualizar comentários, se fornecidos
    if (data.comments) {
      updateData.comments = data.comments;
    }
    
    // Atualizar a data de validade, se fornecida
    if (data.validUntil) {
      updateData.validUntil = new Date(data.validUntil);
    }
    
    // Para status approved, atualizar o status geral para approved
    if (data.status === 'approved') {
      updateData.status = 'approved';
    }
    
    const results = await db.update(licenseRequests)
      .set(updateData)
      .where(eq(licenseRequests.id, data.licenseId))
      .returning();
    
    return results[0];
  }
  
  // Dashboard stats
  async getDashboardStats(userId: number): Promise<DashboardStats> {
    // Construir a consulta base com base no userId
    let baseQuery = db.select();
    
    if (userId !== 0) {
      // Para usuários normais, filtrar por userId
      baseQuery = baseQuery.where(eq(licenseRequests.userId, userId));
    }
    
    // Contar licenças emitidas (status approved)
    const issuedLicensesQuery = db.select({ count: sql`count(*)` })
      .from(licenseRequests)
      .where(and(
        userId !== 0 ? eq(licenseRequests.userId, userId) : sql`1=1`,
        eq(licenseRequests.status, "approved")
      ));
    
    // Contar licenças pendentes (nem draft nem approved)
    const pendingLicensesQuery = db.select({ count: sql`count(*)` })
      .from(licenseRequests)
      .where(and(
        userId !== 0 ? eq(licenseRequests.userId, userId) : sql`1=1`,
        eq(licenseRequests.isDraft, false),
        sql`status != 'approved'`
      ));
    
    // Contar veículos registrados
    const registeredVehiclesQuery = db.select({ count: sql`count(*)` })
      .from(vehicles)
      .where(userId !== 0 ? eq(vehicles.userId, userId) : sql`1=1`);
    
    // Contar veículos ativos
    const activeVehiclesQuery = db.select({ count: sql`count(*)` })
      .from(vehicles)
      .where(and(
        userId !== 0 ? eq(vehicles.userId, userId) : sql`1=1`,
        eq(vehicles.status, "active")
      ));
    
    // Buscar licenças recentes
    const recentLicensesQuery = db.select()
      .from(licenseRequests)
      .where(and(
        userId !== 0 ? eq(licenseRequests.userId, userId) : sql`1=1`,
        eq(licenseRequests.isDraft, false)
      ))
      .orderBy(desc(licenseRequests.createdAt))
      .limit(5);
    
    // Executar todas as consultas em paralelo
    const [
      issuedLicensesResult,
      pendingLicensesResult,
      registeredVehiclesResult,
      activeVehiclesResult,
      recentLicensesResult
    ] = await Promise.all([
      issuedLicensesQuery,
      pendingLicensesQuery,
      registeredVehiclesQuery,
      activeVehiclesQuery,
      recentLicensesQuery
    ]);
    
    // Formatar as licenças recentes
    const recentLicenses = recentLicensesResult.map(license => ({
      id: license.id,
      requestNumber: license.requestNumber,
      type: license.type,
      mainVehiclePlate: license.mainVehiclePlate,
      states: license.states,
      status: license.status,
      createdAt: license.createdAt.toISOString()
    }));
    
    return {
      issuedLicenses: Number(issuedLicensesResult[0]?.count || 0),
      pendingLicenses: Number(pendingLicensesResult[0]?.count || 0),
      registeredVehicles: Number(registeredVehiclesResult[0]?.count || 0),
      activeVehicles: Number(activeVehiclesResult[0]?.count || 0),
      recentLicenses
    };
  }
  
  async getVehicleStats(userId: number): Promise<ChartData[]> {
    const query = db.select({
      type: vehicles.type,
      count: sql`count(*)`
    })
    .from(vehicles)
    .where(userId !== 0 ? eq(vehicles.userId, userId) : sql`1=1`)
    .groupBy(vehicles.type);
    
    const results = await query;
    
    return results.map(result => ({
      name: this.getVehicleTypeLabel(result.type),
      value: Number(result.count)
    }));
  }
  
  async getStateStats(userId: number): Promise<ChartData[]> {
    // Esta consulta é uma aproximação, já que estamos trabalhando com arrays no PostgreSQL
    // Uma abordagem mais completa exigiria uma tabela de relacionamento separada
    const query = db.select({
      state: sql`unnest(states)`.as('state'),
      count: sql`count(*)`.as('count')
    })
    .from(licenseRequests)
    .where(userId !== 0 ? eq(licenseRequests.userId, userId) : sql`1=1`)
    .groupBy(sql`unnest(states)`);
    
    const results = await query;
    
    return results.map(result => ({
      name: result.state,
      value: Number(result.count)
    }));
  }
  
  private getVehicleTypeLabel(type: string): string {
    const typeMap: Record<string, string> = {
      "tractor_unit": "Unidade Tratora",
      "semi_trailer": "Semirreboque",
      "trailer": "Reboque",
      "dolly": "Dolly",
      "flatbed": "Prancha"
    };
    
    return typeMap[type] || type;
  }
}

// Define qual implementação de armazenamento será usada
export const storage = new DatabaseStorage();
