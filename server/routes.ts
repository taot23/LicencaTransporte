import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, hashPassword } from "./auth";
import { db, pool } from "./db";
import { v4 as uuidv4 } from "uuid";
import { 
  insertUserSchema, 
  insertVehicleSchema, 
  insertLicenseRequestSchema, 
  insertDraftLicenseSchema, 
  updateLicenseStatusSchema,
  updateLicenseStateSchema,
  insertStatusHistorySchema,
  insertVehicleModelSchema,
  insertBoletoSchema,
  LicenseStatus,
  userRoleEnum,
  licenseRequests,
  transporters,
  statusHistories,
  vehicles,
  boletos,
  stateLicenses
} from "@shared/schema";
import { 
  canAccessRoute, 
  hasPermission, 
  canAccessModule, 
  isAdministrativeRole,
  type UserRole 
} from "@shared/permissions";
import { eq, and, or, desc, ilike, gte, lte, count, asc, like, not, sql, exists, inArray, isNull, gt, ne, isNotNull } from "drizzle-orm";
import { fromZodError } from "zod-validation-error";
import { ZodError } from "zod";
import multer from "multer";
import path from "path";
import * as fs from "fs";
import { promisify } from "util";
import { WebSocketServer, WebSocket } from "ws";
import { withCache, invalidateCache, appCache } from "./cache";
import type { LicenseMetadata } from './lib/license-storage';

// Configuração de upload SEM FALLBACK - falha claro se diretório não for gravável
const validateUploadDirStrict = (): string => {
  const uploadDir = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
  
  console.log(`[UPLOAD] Validando diretório de upload (SEM FALLBACK): ${uploadDir}`);
  
  try {
    // Verificar se diretório existe ou pode ser criado
    if (!fs.existsSync(uploadDir)) {
      console.log(`[UPLOAD] Criando diretório: ${uploadDir}`);
      fs.mkdirSync(uploadDir, { recursive: true, mode: 0o755 });
    }
    
    // Criar subdiretórios necessários
    const subDirs = ['vehicles', 'transporters', 'boletos', 'vehicle-set-types', 'licenses'];
    subDirs.forEach(subDir => {
      const subPath = path.join(uploadDir, subDir);
      if (!fs.existsSync(subPath)) {
        fs.mkdirSync(subPath, { recursive: true, mode: 0o755 });
      }
    });
    
    // Testar permissão de escrita
    const testFile = path.join(uploadDir, '.write-test');
    fs.writeFileSync(testFile, 'test');
    fs.unlinkSync(testFile);
    
    console.log(`[UPLOAD] ✅ Diretório validado: ${uploadDir}`);
    console.log(`[UPLOAD] 📁 Subdiretórios: ${subDirs.join(', ')}`);
    return uploadDir;
    
  } catch (error) {
    const errorMsg = `[UPLOAD] ❌ ERRO CRÍTICO: Diretório não gravável: ${uploadDir}`;
    console.error(errorMsg);
    console.error(`[UPLOAD] Erro:`, error);
    console.error(`[UPLOAD] SOLUÇÃO: Configure UPLOAD_DIR com diretório gravável ou ajuste permissões`);
    
    // Falhar imediatamente - SEM FALLBACK
    throw new Error(`Upload directory not writable: ${uploadDir}. Set UPLOAD_DIR environment variable or fix permissions.`);
  }
};

const uploadDir = validateUploadDirStrict();

// Configuração de storage com lógica de nomeação específica
const storage_config = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    
    console.log(`[UPLOAD NAMING] Campo: ${file.fieldname}, Arquivo original: ${file.originalname}`);
    console.log(`[UPLOAD NAMING] Dados do request:`, {
      state: req.body?.state,
      aetNumber: req.body?.aetNumber,
      validUntil: req.body?.validUntil
    });
    
    // Para CRLV de veículos - manter nome original
    if (file.fieldname === 'crlvFile' || file.fieldname.includes('crlv')) {
      // Sanitizar o nome original para evitar problemas de caracteres especiais
      const originalName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
      console.log(`[UPLOAD NAMING] CRLV: mantendo nome original sanitizado: ${originalName}`);
      cb(null, originalName);
      return;
    }
    
    // Para arquivos de estado de licenças - será processado manualmente no endpoint
    if (file.fieldname === 'stateFile' || file.fieldname.includes('stateFile')) {
      // Para arquivos de licenças, usaremos estrutura organizacional posteriormente
      const tempName = `temp-${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      console.log(`[UPLOAD NAMING] StateFile: nome temporário para reorganização: ${tempName}`);
      cb(null, tempName);
      return;
    }
    
    // Para outros tipos de arquivos - usar padrão padrão
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const genericFilename = file.fieldname + '-' + uniqueSuffix + ext;
    console.log(`[UPLOAD NAMING] Genérico: ${genericFilename}`);
    cb(null, genericFilename);
  }
});

const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Accept only images and PDFs
  if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(null, false);
  }
};

const csvFileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Accept only CSV files
  if (file.mimetype === 'text/csv' || file.originalname.toLowerCase().endsWith('.csv')) {
    cb(null, true);
  } else {
    cb(null, false);
  }
};

// Middleware para processar dados do veículo, tanto de FormData quanto JSON direto
const processVehicleData = (req: any, res: any, next: any) => {
  console.log('Processing request body:', req.body);
  
  // Se tiver contentType application/json, já está processado como JSON
  const contentType = req.headers['content-type'] || '';
  
  // Caso 1: Dados no formato FormData com campo vehicleData (abordagem antiga)
  if (req.body && req.body.vehicleData) {
    try {
      if (typeof req.body.vehicleData === 'string' && req.body.vehicleData.trim().length > 0) {
        req.body = {
          ...req.body,
          ...JSON.parse(req.body.vehicleData)
        };
        console.log('Processed vehicle data from vehicleData field:', req.body);
      } else {
        console.error('Campo vehicleData está vazio ou não é uma string válida:', req.body.vehicleData);
      }
    } catch (error) {
      console.error('Error parsing vehicleData JSON:', error);
      console.error('Conteúdo do campo vehicleData:', req.body.vehicleData);
    }
  } 
  // Caso 2: FormData com campos individuais (nossa nova abordagem)
  else if (contentType.includes('multipart/form-data') && req.body) {
    // Campos individuais já estão acessíveis em req.body
    console.log('Using form-data fields directly:', req.body);
    
    // Tratar campos que podem vir como arrays (problema do form-data duplicado)
    Object.keys(req.body).forEach(key => {
      if (Array.isArray(req.body[key])) {
        // Usar o primeiro valor se for array
        req.body[key] = req.body[key][0];
      }
    });
    
    // Garantir que números são convertidos corretamente
    if (req.body.tare) req.body.tare = Number(req.body.tare);
    if (req.body.crlvYear) req.body.crlvYear = Number(req.body.crlvYear);
    if (req.body.year) req.body.year = Number(req.body.year);
    if (req.body.axleCount) req.body.axleCount = Number(req.body.axleCount);
    if (req.body.cmt) req.body.cmt = Number(req.body.cmt);
  }
  // Caso 3: JSON direto (nossa nova abordagem para requests sem arquivo)
  else if (contentType.includes('application/json')) {
    // Já processado como JSON pelo bodyParser
    console.log('Request is already in JSON format:', req.body);
  }
  
  console.log('Final vehicle data for processing:', req.body);
  next();
};

const upload = multer({ 
  storage: storage_config,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size
  }
});

// Upload específico para CSV (sem fileFilter)
const uploadCSV = multer({
  storage: multer.memoryStorage(), // Usar memória para CSV
  fileFilter: csvFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max para CSV
  }
});

// Authentication middleware
const requireAuth = (req: any, res: any, next: any) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Não autenticado" });
  }
  next();
};

// Admin middleware
const requireAdmin = (req: any, res: any, next: any) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Não autenticado" });
  }
  
  if (!req.user!.isAdmin) {
    return res.status(403).json({ message: "Acesso negado" });
  }
  
  next();
};

// Middleware para usuários com papel Operacional
const requireOperational = (req: any, res: any, next: any) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Não autenticado" });
  }
  
  // Verifica se o usuário tem papel Operacional, Supervisor ou Admin
  const hasPermission = req.user!.role === 'operational' || 
                       req.user!.role === 'supervisor' || 
                       req.user!.isAdmin;
  
  if (!hasPermission) {
    return res.status(403).json({ 
      message: "Acesso negado. Apenas usuários com perfil Operacional ou Supervisor podem acessar." 
    });
  }
  
  next();
};

// Middleware para usuários com papel Supervisor
const requireSupervisor = (req: any, res: any, next: any) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Não autenticado" });
  }
  
  // Verifica se o usuário tem papel Supervisor
  if (req.user!.role !== 'supervisor' && !req.user!.isAdmin) {
    return res.status(403).json({ 
      message: "Acesso negado. Apenas usuários com perfil Supervisor podem acessar." 
    });
  }
  
  next();
};

// Middleware para verificar se o usuário é dono do recurso ou tem papel de staff
const requireOwnerOrStaff = (req: any, res: any, next: any) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Não autenticado" });
  }
  
  // Os perfis que podem acessar recursos de outros usuários
  const isStaff = ['operational', 'supervisor'].includes(req.user!.role) || req.user!.isAdmin;
  
  // Se o usuário não é staff, verifica se é o dono do recurso
  if (!isStaff) {
    const resourceUserId = parseInt(req.params.userId);
    if (req.user!.id !== resourceUserId) {
      return res.status(403).json({ 
        message: "Acesso negado. Você só pode acessar seus próprios dados." 
      });
    }
  }
  
  next();
};

// Tipo para as mensagens WebSocket
interface WSMessage {
  type: 'STATUS_UPDATE' | 'LICENSE_UPDATE' | 'DASHBOARD_UPDATE' | 'VEHICLE_UPDATE' | 'TRANSPORTER_UPDATE' | 'USER_UPDATE' | 'ACTIVITY_LOG_UPDATE' | 'CACHE_INVALIDATION';
  data: any;
}

// Armazenamento de clientes WebSocket
const wsClients: Set<WebSocket> = new Set();

// Função para sincronizar licença aprovada com tabela licencas_emitidas
async function sincronizarLicencaEmitida(licenca: any, estado: string, numeroAet: string, dataValidade: string) {
  try {
    // Buscar informações dos veículos associados
    let placaTratora = licenca.mainVehiclePlate || null;
    let placaPrimeiraCarreta: string | null = null;
    let placaSegundaCarreta: string | null = null;
    let placaDolly: string | null = null;
    let placaPrancha: string | null = null;
    let placaReboque: string | null = null;

    // Obter placas dos veículos por ID se existirem
    if (licenca.tractorUnitId) {
      const tractorQuery = 'SELECT plate FROM vehicles WHERE id = $1';
      const tractorResult = await pool.query(tractorQuery, [licenca.tractorUnitId]);
      if (tractorResult.rows.length > 0) {
        placaTratora = tractorResult.rows[0].plate;
      }
    }

    if (licenca.firstTrailerId) {
      const firstTrailerQuery = 'SELECT plate FROM vehicles WHERE id = $1';
      const firstTrailerResult = await pool.query(firstTrailerQuery, [licenca.firstTrailerId]);
      if (firstTrailerResult.rows.length > 0) {
        placaPrimeiraCarreta = firstTrailerResult.rows[0].plate as string;
      }
    }

    if (licenca.secondTrailerId) {
      const secondTrailerQuery = 'SELECT plate FROM vehicles WHERE id = $1';
      const secondTrailerResult = await pool.query(secondTrailerQuery, [licenca.secondTrailerId]);
      if (secondTrailerResult.rows.length > 0) {
        placaSegundaCarreta = secondTrailerResult.rows[0].plate as string;
      }
    }

    if (licenca.dollyId) {
      const dollyQuery = 'SELECT plate FROM vehicles WHERE id = $1';
      const dollyResult = await pool.query(dollyQuery, [licenca.dollyId]);
      if (dollyResult.rows.length > 0) {
        placaDolly = dollyResult.rows[0].plate as string;
      }
    }

    if (licenca.flatbedId) {
      const flatbedQuery = 'SELECT plate FROM vehicles WHERE id = $1';
      const flatbedResult = await pool.query(flatbedQuery, [licenca.flatbedId]);
      if (flatbedResult.rows.length > 0) {
        placaPrancha = flatbedResult.rows[0].plate as string;
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

    // Verificar se já existe uma entrada para esta licença e estado
    const existingQuery = `
      SELECT id FROM licencas_emitidas 
      WHERE pedido_id = $1 AND estado = $2
    `;
    const existingResult = await pool.query(existingQuery, [licenca.id, estado]);

    if (existingResult.rows.length > 0) {
      // Atualizar entrada existente
      const updateQuery = `
        UPDATE licencas_emitidas SET
          numero_licenca = $3,
          data_validade = $4,
          status = 'emitida',
          placa_unidade_tratora = $5,
          placa_primeira_carreta = $6,
          placa_segunda_carreta = $7,
          placa_dolly = $8,
          placa_prancha = $9,
          placa_reboque = $10,
          updated_at = CURRENT_TIMESTAMP
        WHERE pedido_id = $1 AND estado = $2
      `;
      await pool.query(updateQuery, [
        licenca.id, estado, numeroAet, dataValidade,
        placaTratora, placaPrimeiraCarreta, placaSegundaCarreta,
        placaDolly, placaPrancha, placaReboque
      ]);
    } else {
      // Inserir nova entrada
      const insertQuery = `
        INSERT INTO licencas_emitidas (
          pedido_id, estado, numero_licenca, data_validade, status,
          placa_unidade_tratora, placa_primeira_carreta, placa_segunda_carreta,
          placa_dolly, placa_prancha, placa_reboque, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, 'emitida', $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `;
      await pool.query(insertQuery, [
        licenca.id, estado, numeroAet, dataValidade,
        placaTratora, placaPrimeiraCarreta, placaSegundaCarreta,
        placaDolly, placaPrancha, placaReboque
      ]);
    }

    console.log(`Licença emitida sincronizada: ${numeroAet} para estado ${estado}`);
  } catch (error) {
    console.error('Erro ao sincronizar licença emitida:', error);
    throw error;
  }
}

// Função para sincronizar todas as licenças aprovadas existentes
async function sincronizarTodasLicencasAprovadas() {
  try {
    console.log('[SINCRONIZAÇÃO EM LOTE] Iniciando sincronização de todas as licenças aprovadas...');
    
    // Buscar todas as licenças não-rascunho
    const licencasQuery = `
      SELECT * FROM license_requests 
      WHERE is_draft = false 
      AND state_statuses IS NOT NULL 
      AND array_length(state_statuses, 1) > 0
    `;
    
    const licencasResult = await pool.query(licencasQuery);
    let totalSincronizadas = 0;
    
    for (const licenca of licencasResult.rows) {
      if (licenca.state_statuses && Array.isArray(licenca.state_statuses)) {
        for (const stateStatus of licenca.state_statuses) {
          // Parse do formato: "ESTADO:status:data_validade:data_emissao"
          const parts = stateStatus.split(':');
          if (parts.length >= 4 && (parts[1] === 'approved' || parts[1] === 'released')) {
            const estado = parts[0];
            const dataValidade = parts[2];
            const dataEmissao = parts[3];
            
            // Buscar número AET do stateAETNumbers
            let numeroAet = `AET-${estado}-${licenca.id}`;
            if (licenca.state_aet_numbers && Array.isArray(licenca.state_aet_numbers)) {
              const aetEntry = licenca.state_aet_numbers.find((entry: string) => entry.startsWith(`${estado}:`));
              if (aetEntry) {
                numeroAet = aetEntry.split(':')[1];
              }
            }
            
            try {
              await sincronizarLicencaEmitida(licenca, estado, numeroAet, dataValidade);
              totalSincronizadas++;
              console.log(`[SINCRONIZAÇÃO EM LOTE] Sincronizada: Licença ${licenca.id}, Estado ${estado}`);
            } catch (error) {
              console.error(`[SINCRONIZAÇÃO EM LOTE] Erro na licença ${licenca.id}, estado ${estado}:`, error);
            }
          }
        }
      }
    }
    
    console.log(`[SINCRONIZAÇÃO EM LOTE] Concluída: ${totalSincronizadas} licenças sincronizadas`);
  } catch (error) {
    console.error('[SINCRONIZAÇÃO EM LOTE] Erro geral:', error);
  }
}

// Função para transmitir mensagens a todos os clientes conectados
const broadcastMessage = (message: WSMessage) => {
  let activeClients = 0;
  let sentMessages = 0;
  
  wsClients.forEach(client => {
    try {
      if (client.readyState === WebSocket.OPEN) {
        activeClients++;
        client.send(JSON.stringify(message));
        sentMessages++;
      } else {
        wsClients.delete(client);
      }
    } catch (error) {
      console.error('Erro ao enviar mensagem WebSocket:', error);
      wsClients.delete(client);
    }
  });
  
  console.log(`📡 WebSocket: ${message.type} enviado para ${sentMessages}/${activeClients} clientes`);
};

// Funções auxiliares para diferentes tipos de atualizações
const broadcastLicenseUpdate = (licenseId: number, action: string, license?: any) => {
  broadcastMessage({
    type: 'LICENSE_UPDATE',
    data: {
      licenseId,
      action, // 'created', 'updated', 'deleted', 'status_changed'
      license,
      timestamp: new Date().toISOString()
    }
  });
};

const broadcastDashboardUpdate = () => {
  broadcastMessage({
    type: 'DASHBOARD_UPDATE',
    data: {
      action: 'refresh_stats',
      timestamp: new Date().toISOString()
    }
  });
};

const broadcastVehicleUpdate = (vehicleId: number, action: string, vehicle?: any) => {
  broadcastMessage({
    type: 'VEHICLE_UPDATE',
    data: {
      vehicleId,
      action, // 'created', 'updated', 'deleted'
      vehicle,
      timestamp: new Date().toISOString()
    }
  });
};

const broadcastTransporterUpdate = (transporterId: number, action: string, transporter?: any) => {
  broadcastMessage({
    type: 'TRANSPORTER_UPDATE',
    data: {
      transporterId,
      action, // 'created', 'updated', 'deleted'
      transporter,
      timestamp: new Date().toISOString()
    }
  });
};

const broadcastActivityLog = (logEntry: any) => {
  broadcastMessage({
    type: 'ACTIVITY_LOG_UPDATE',
    data: {
      action: 'new_entry',
      logEntry,
      timestamp: new Date().toISOString()
    }
  });
};

const broadcastCacheInvalidation = (queryKeys: string[]) => {
  broadcastMessage({
    type: 'CACHE_INVALIDATION',
    data: {
      queryKeys,
      timestamp: new Date().toISOString()
    }
  });
};

export async function registerRoutes(app: Express): Promise<Server> {
  // Log para todas as requisições PATCH
  app.use((req, res, next) => {
    if (req.method === 'PATCH') {
      console.log(`=== PATCH REQUEST: ${req.url} ===`);
    }
    next();
  });
  
  // Setup authentication routes
  setupAuth(app);

  // Servir arquivos estáticos da pasta uploads
  app.use('/uploads', express.static(uploadDir));
  console.log(`[UPLOAD] Servindo arquivos de ${uploadDir} em /uploads`);
  
  // Criar o servidor HTTP (definido apenas uma vez)
  const httpServer = createServer(app);
  
  // Configurar o WebSocketServer
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  wss.on('connection', (ws) => {
    console.log('Novo cliente WebSocket conectado');
    wsClients.add(ws);
    
    ws.on('message', (message) => {
      console.log('Mensagem recebida:', message.toString());
    });
    
    ws.on('close', () => {
      console.log('Cliente WebSocket desconectado');
      wsClients.delete(ws);
    });
    
    ws.on('error', (error) => {
      console.error('Erro na conexão WebSocket:', error);
      wsClients.delete(ws);
    });
    
    // Enviar mensagem inicial para confirmar conexão
    ws.send(JSON.stringify({ 
      type: 'CONNECTED', 
      message: 'Conectado ao servidor',
      timestamp: new Date().toISOString()
    }));
  });

  // Cache para armazenar tokens de acesso
  let accessToken: string | undefined = undefined;
  let tokenExpiration: number = 0;

  // Função para obter token de acesso
  async function getAccessToken() {
    try {
      // Verificar se o token atual ainda é válido
      if (accessToken && tokenExpiration > Date.now()) {
        return accessToken;
      }

      // Configurar a solicitação para obter o token
      const tokenUrl = 'https://h-apigateway.conectagov.estaleiro.serpro.gov.br/oauth2/jwt-token';
      const params = new URLSearchParams({
        grant_type: 'client_credentials',
      });

      // Usar chave fornecida pelo cliente
      const authHeader = 'Basic ' + Buffer.from(
        `${process.env.GOV_BR_CLIENT_ID || 'client-id'}:${process.env.GOV_BR_CLIENT_SECRET || 'client-secret'}`
      ).toString('base64');

      // Fazer a solicitação para obter o token
      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': authHeader
        },
        body: params
      });

      if (!response.ok) {
        // Se a resposta não for OK, tentar extrair o erro
        const errorText = await response.text();
        console.error('Erro ao obter token de acesso:', errorText);
        throw new Error(`Erro ao obter token: ${response.status} ${response.statusText}`);
      }

      // Extrair o token de acesso da resposta
      const data = await response.json();
      accessToken = data.access_token;
      // Calcular a expiração (normalmente em segundos) e converter para timestamp
      tokenExpiration = Date.now() + (data.expires_in * 1000) - 60000; // 1 minuto antes para evitar problemas
      
      return accessToken;
    } catch (error) {
      console.error('Erro ao obter token de acesso:', error);
      throw error;
    }
  }

  // Endpoint de API para consulta de CNPJ - usando ReceitaWS
  app.get('/api/external/cnpj/:cnpj', async (req, res) => {
    // Definir explicitamente cabeçalhos para evitar intercepção pelo Vite
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    try {
      const { cnpj } = req.params;
      const cleanCnpj = cnpj.replace(/[^\d]/g, '');
      console.log(`[DEBUG] Consultando CNPJ via ReceitaWS: ${cleanCnpj}`);
      
      if (cleanCnpj.length !== 14) {
        console.log(`[DEBUG] CNPJ inválido: ${cleanCnpj}`);
        return res.status(400).json({ error: 'CNPJ deve conter 14 dígitos' });
      }
      
      // Configurar a solicitação para a ReceitaWS (API pública sem autenticação - consulta básica)
      const receitaWsUrl = `https://www.receitaws.com.br/v1/cnpj/${cleanCnpj}`;
      console.log(`[DEBUG] URL da ReceitaWS: ${receitaWsUrl}`);
      
      // Fazer a solicitação à ReceitaWS
      console.log(`[DEBUG] Enviando solicitação para ReceitaWS`);
      const response = await fetch(receitaWsUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (compatible; AETLicencasApp/1.0)',
        }
      });
      console.log(`[DEBUG] Resposta da ReceitaWS: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[DEBUG] Erro na resposta da ReceitaWS: ${response.status} ${response.statusText}`, errorText);
        throw new Error(`Erro ao consultar ReceitaWS: ${response.status}`);
      }

      // Processar a resposta da API
      console.log(`[DEBUG] Processando resposta da ReceitaWS`);
      const apiData = await response.json();
      console.log(`[DEBUG] Dados recebidos:`, JSON.stringify(apiData));
      
      // Verificar se a API retornou um erro no corpo da resposta
      if (apiData.status === 'ERROR') {
        console.error(`[DEBUG] Erro reportado pela ReceitaWS:`, apiData.message);
        throw new Error(apiData.message || 'Erro na consulta do CNPJ');
      }
      
      // Mapear os dados da ReceitaWS para o formato esperado pelo frontend
      const dadosEmpresa = {
        razao_social: apiData.nome || '',
        nome_fantasia: apiData.fantasia || '',
        logradouro: apiData.logradouro || '',
        numero: apiData.numero || '',
        complemento: apiData.complemento || '',
        bairro: apiData.bairro || '',
        cep: apiData.cep?.replace(/\D/g, '') || '',
        municipio: apiData.municipio || '',
        uf: apiData.uf || ''
      };
      console.log(`[DEBUG] Dados mapeados:`, JSON.stringify(dadosEmpresa));

      return res.json(dadosEmpresa);
    } catch (error) {
      console.error('[DEBUG] Erro ao processar consulta CNPJ via ReceitaWS:', error);
      return res.status(503).json({ 
        error: 'Não foi possível realizar a consulta do CNPJ', 
        message: error instanceof Error ? error.message : 'Erro ao verificar dados do CNPJ',
        details: 'Não foi possível consultar o CNPJ. Prossiga com o cadastro inserindo os dados manualmente.',
        service_unavailable: true
      });
    }
  });
  
  // API antiga - manter temporariamente para compatibilidade durante a transição
  app.get('/api/cnpj/:cnpj', async (req, res) => {
    const { cnpj } = req.params;
    const cleanCnpj = cnpj.replace(/[^\d]/g, '');
    
    // Verificação de credenciais para avaliação
    if (!process.env.GOV_BR_CLIENT_ID || !process.env.GOV_BR_CLIENT_SECRET) {
      return res.status(500).json({ 
        error: 'Credenciais não configuradas',
        message: 'As credenciais da API Gov.br não estão configuradas corretamente'
      });
    }
    
    // Retornar erro indicando que a consulta requer credenciais
    return res.status(503).json({
      error: 'Serviço temporariamente indisponível',
      message: 'O serviço de consulta de CNPJ requer credenciais válidas da API Gov.br Connect',
      instructions: 'Entre em contato com o administrador do sistema para configurar as credenciais de integração'
    });
  });

  // Dashboard Stats - NOVA IMPLEMENTAÇÃO SEGMENTADA
  app.get('/api/dashboard/stats', requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const userRole = req.user!.role;
      const userEmail = req.user!.email;
      
      // Evitar cache
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      
      const isAdmin = userRole === 'admin' || userRole === 'supervisor' || userRole === 'manager' || userRole === 'financial';
      
      if (isAdmin) {
        // Estatísticas globais para admin
        const allLicenses = await db.select().from(licenseRequests).where(eq(licenseRequests.isDraft, false));
        const allVehicles = await db.select().from(vehicles);
        const allActiveVehicles = allVehicles.filter(v => v.status === 'active');
        
        // Contar licenças emitidas (com pelo menos um estado aprovado)
        const globalIssuedLicenses = allLicenses.filter(license => {
          if (!license.stateStatuses || license.stateStatuses.length === 0) return false;
          return license.stateStatuses.some(status => status.includes(':approved:'));
        });
        
        const globalPendingLicenses = allLicenses.filter(license => {
          if (!license.stateStatuses || license.stateStatuses.length === 0) return true;
          return !license.stateStatuses.some(status => status.includes(':approved:'));
        });
        
        const recentLicenses = await db.select()
          .from(licenseRequests)
          .where(eq(licenseRequests.isDraft, false))
          .orderBy(desc(licenseRequests.createdAt))
          .limit(5);
        
        const adminStats = {
          issuedLicenses: globalIssuedLicenses.length,
          pendingLicenses: globalPendingLicenses.length,
          registeredVehicles: allVehicles.length,
          activeVehicles: allActiveVehicles.length,
          recentLicenses: recentLicenses.map(license => ({
            id: license.id,
            requestNumber: license.requestNumber,
            type: license.type,
            mainVehiclePlate: license.mainVehiclePlate,
            states: license.states,
            status: license.status,
            createdAt: license.createdAt
          }))
        };
        
        res.json(adminStats);
        
      } else {
        // Performance: Log removido
        
        // Buscar transportadores associados ao usuário
        const userTransporters = await db.select()
          .from(transporters)
          .where(eq(transporters.userId, userId));
        
        const transporterIds = userTransporters.map(t => t.id);
        // Performance: Log removido
        
        // Buscar apenas veículos do usuário específico
        const userVehicles = await db.select()
          .from(vehicles)
          .where(eq(vehicles.userId, userId));
        
        const userActiveVehicles = userVehicles.filter(v => v.status === 'active');
        
        // Performance: Log removido
        
        // Buscar licenças do usuário e transportadores associados
        let userLicenses = [];
        if (transporterIds.length > 0) {
          userLicenses = await db.select()
            .from(licenseRequests)
            .where(and(
              eq(licenseRequests.isDraft, false),
              or(
                eq(licenseRequests.userId, userId),
                inArray(licenseRequests.transporterId, transporterIds)
              )
            ));
        } else {
          userLicenses = await db.select()
            .from(licenseRequests)
            .where(and(
              eq(licenseRequests.userId, userId),
              eq(licenseRequests.isDraft, false)
            ));
        }
        
        // Performance: Log removido
        
        // APLICAR EXATAMENTE A MESMA FUNÇÃO expandedLicenses da página "Licenças Emitidas"
        const expandedLicenses: any[] = [];
        
        userLicenses.forEach(license => {
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
        const userIssuedLicensesCount = expandedLicenses.length;
        const userExpiringLicensesCount = expandedLicenses.filter(l => getLicenseStatus(l.validUntil) === 'expiring_soon').length;
        
        console.log(`[DASHBOARD EXPANDEDLICENSES] Total: ${userIssuedLicensesCount}, A vencer: ${userExpiringLicensesCount}`);
        
        const userPendingLicenses = userLicenses.filter(license => {
          if (!license.stateStatuses || license.stateStatuses.length === 0) return true;
          return !license.stateStatuses.some(status => status.includes(':approved:'));
        });
        
        // Buscar licenças recentes do usuário
        let recentUserLicenses = [];
        if (transporterIds.length > 0) {
          recentUserLicenses = await db.select()
            .from(licenseRequests)
            .where(and(
              eq(licenseRequests.isDraft, false),
              or(
                eq(licenseRequests.userId, userId),
                inArray(licenseRequests.transporterId, transporterIds)
              )
            ))
            .orderBy(desc(licenseRequests.createdAt))
            .limit(5);
        } else {
          recentUserLicenses = await db.select()
            .from(licenseRequests)
            .where(and(
              eq(licenseRequests.userId, userId),
              eq(licenseRequests.isDraft, false)
            ))
            .orderBy(desc(licenseRequests.createdAt))
            .limit(5);
        }
        
        const transporterStats = {
          issuedLicenses: userIssuedLicensesCount,
          pendingLicenses: userPendingLicenses.length,
          registeredVehicles: userVehicles.length,
          activeVehicles: userActiveVehicles.length,
          expiringLicenses: userExpiringLicensesCount,
          recentLicenses: recentUserLicenses.map(license => ({
            id: license.id,
            requestNumber: license.requestNumber,
            type: license.type,
            mainVehiclePlate: license.mainVehiclePlate,
            states: license.states,
            status: license.status,
            createdAt: license.createdAt
          }))
        };
        
        console.log(`[DASHBOARD NEW] TRANSPORTADOR - Retornando:`, transporterStats);
        res.json(transporterStats);
      }
    } catch (error) {
      console.error('[DASHBOARD NEW] Erro:', error);
      res.status(500).json({ message: 'Erro ao buscar estatísticas do dashboard' });
    }
  });

  app.get('/api/dashboard/vehicle-stats', requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const role = req.user!.role;
      
      // Cache otimizado para estatísticas de veículos
      const cacheKey = `dashboard:vehicle-stats:${userId}:${role}`;
      
      const stats = await withCache(cacheKey, async () => {
        return await storage.getVehicleStats(userId);
      }, 3); // Cache por 3 minutos
      
      res.json(stats);
    } catch (error) {
      console.error('Error fetching vehicle stats:', error);
      res.status(500).json({ message: 'Erro ao buscar estatísticas de veículos' });
    }
  });

  app.get('/api/dashboard/state-stats', requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const role = req.user!.role;
      
      // Cache otimizado para estatísticas por estado
      const cacheKey = `dashboard:state-stats:${userId}:${role}`;
      
      const stats = await withCache(cacheKey, async () => {
        return await storage.getStateStats(userId);
      }, 5); // Cache por 5 minutos (dados menos voláteis)
      
      res.json(stats);
    } catch (error) {
      console.error('Error fetching state stats:', error);
      res.status(500).json({ message: 'Erro ao buscar estatísticas por estado' });
    }
  });
  
  // Endpoint otimizado para busca de transportadores (para formulários)
  app.get('/api/transporters/search', requireAuth, async (req, res) => {
    try {
      const user = req.user!;
      const { search = '', limit = '20' } = req.query;
      
      let transporters = [];
      const maxLimit = Math.min(parseInt(limit as string), 50); // Otimizado: máximo 50 para melhor performance
      
      // Obter transportadores vinculados ao usuário (não todos do sistema)
      let userTransporters = [];
      if (isAdministrativeRole(user.role as UserRole)) {
        // Usuários administrativos veem todos os transportadores
        userTransporters = await storage.getAllTransporters();
      } else {
        // Usuários comuns veem apenas transportadores vinculados
        userTransporters = await storage.getUserTransporters(user.id);
      }
      
      // Buscar transportadores com base no termo de busca
      if (typeof search === 'string' && search.trim().length > 0) {
        const searchTerm = search.trim().toLowerCase();
        
        transporters = userTransporters.filter(transporter => {
          // Busca por nome (case insensitive)
          const nameMatch = transporter.name.toLowerCase().includes(searchTerm);
          
          // Busca por CNPJ/CPF (apenas números)
          const numericSearch = searchTerm.replace(/\D/g, '');
          const documentMatch = numericSearch && transporter.documentNumber && 
                               transporter.documentNumber.replace(/\D/g, '').includes(numericSearch);
          
          // Busca por nome fantasia
          const tradeNameMatch = transporter.tradeName && 
                                transporter.tradeName.toLowerCase().includes(searchTerm);
          
          return nameMatch || documentMatch || tradeNameMatch;
        }).slice(0, maxLimit);
        
      } else {
        // Se não há termo de busca, retornar os transportadores do usuário (limitado)
        transporters = userTransporters.slice(0, maxLimit);
      }
      
      // Performance: Log removido
      
      res.json({
        transporters,
        total: transporters.length,
        limit: maxLimit
      });
      
    } catch (error) {
      console.error('[TRANSPORTER SEARCH] Erro:', error);
      res.status(500).json({ 
        transporters: [],
        error: 'Erro ao buscar transportadores' 
      });
    }
  });

  // Endpoint para buscar transportadores vinculados ao usuário
  app.get('/api/user/transporters', requireAuth, async (req, res) => {
    try {
      const user = req.user!;
      const userId = user.id;
      
      console.log(`[DEBUG TRANSPORTERS] Usuário ${user.email} (ID: ${userId}, role: ${user.role}) buscando transportadores`);
      
      // Buscar todos os transportadores
      const allTransporters = await storage.getAllTransporters();
      console.log(`[DEBUG TRANSPORTERS] Total de transportadores no sistema: ${allTransporters.length}`);
      
      // Se for um usuário administrativo, retornar todos os transportadores
      if (isAdminUser(user)) {
        console.log(`[DEBUG TRANSPORTERS] Usuário admin - retornando todos os ${allTransporters.length} transportadores`);
        return res.json(allTransporters);
      }
      
      // Para usuários comuns, filtrar apenas os vinculados ao usuário atual
      const userTransporters = allTransporters.filter(t => t.userId === userId);
      console.log(`[DEBUG TRANSPORTERS] Usuário comum - encontrou ${userTransporters.length} transportadores vinculados de ${allTransporters.length} total`);
      
      if (userTransporters.length === 0) {
        console.log(`[DEBUG TRANSPORTERS] IDs de transportadores disponíveis: ${allTransporters.map(t => `${t.id}:${t.userId || 'null'}`).join(', ')}`);
        console.log(`[DEBUG TRANSPORTERS] Usuário ${userId} não encontrou transportadores. Verificando vinculações...`);
      } else {
        console.log(`[DEBUG TRANSPORTERS] Transportadores vinculados ao usuário ${userId}: ${userTransporters.map(t => `${t.name} (ID: ${t.id})`).join(', ')}`);
      }
      
      res.json(userTransporters);
    } catch (error) {
      console.error('Error fetching user transporters:', error);
      res.status(500).json({ message: 'Erro ao buscar transportadores do usuário' });
    }
  });
  
  // Endpoint para buscar um transportador específico por ID (acessível a todos usuários autenticados)
  app.get('/api/transporters/:id', requireAuth, async (req, res) => {
    try {
      const transporterId = parseInt(req.params.id);
      
      const transporter = await storage.getTransporterById(transporterId);
      if (!transporter) {
        return res.status(404).json({ message: "Transportador não encontrado" });
      }
      
      res.json(transporter);
    } catch (error) {
      console.error("Erro ao buscar transportador:", error);
      res.status(500).json({ message: "Erro ao buscar transportador" });
    }
  });
  
  // Endpoint público para acessar dados básicos de transportadores
  // Usado pelo componente TransporterInfo para exibir informações em licenças
  app.get('/api/public/transporters/:id', async (req, res) => {
    try {
      const transporterId = parseInt(req.params.id);
      
      const transporter = await storage.getTransporterById(transporterId);
      if (!transporter) {
        return res.status(404).json({ message: "Transportador não encontrado" });
      }
      
      // Retorne apenas os dados públicos necessários incluindo filiais
      const publicData = {
        id: transporter.id,
        name: transporter.name,
        tradeName: transporter.tradeName,
        personType: transporter.personType,
        documentNumber: transporter.documentNumber,
        city: transporter.city,
        state: transporter.state,
        email: transporter.email,
        phone: transporter.phone,
        subsidiaries: transporter.subsidiaries || []
      };
      
      res.json(publicData);
    } catch (error) {
      console.error("Erro ao buscar transportador por ID (público):", error);
      res.status(500).json({ message: "Erro ao buscar detalhes do transportador" });
    }
  });

  // Função auxiliar para verificar se um usuário tem papel administrativo
  function isAdminUser(user: Express.User): boolean {
    const adminRoles = ['admin', 'manager', 'supervisor', 'financial', 'operational'];
    return adminRoles.includes(user.role);
  }

  function canManageTransporters(user: Express.User): boolean {
    // Permitir para usuários operacionais, supervisores e admins
    return user.role === 'operational' || 
           user.role === 'supervisor' || 
           user.role === 'admin' ||
           user.isAdmin ||
           hasPermission(user.role as UserRole, 'transporters', 'edit');
  }

  function canManageVehicleModels(user: Express.User): boolean {
    return hasPermission(user.role as UserRole, 'vehicleModels', 'edit');
  }

  // Middleware para verificar permissões específicas
  function requirePermission(module: keyof import("@shared/permissions").ModulePermissions, action: keyof import("@shared/permissions").Permission) {
    return (req: any, res: any, next: any) => {
      if (!req.user) {
        return res.status(401).json({ message: "Não autenticado" });
      }

      const userRole = req.user.role as UserRole;
      if (!hasPermission(userRole, module, action)) {
        return res.status(403).json({ message: "Acesso negado - permissão insuficiente" });
      }

      next();
    };
  }

  // Middleware para verificar acesso a rotas específicas
  function requireRouteAccess() {
    return (req: any, res: any, next: any) => {
      if (!req.user) {
        return res.status(401).json({ message: "Não autenticado" });
      }

      const userRole = req.user.role as UserRole;
      const method = req.method;
      const path = req.path;

      if (!canAccessRoute(userRole, method, path)) {
        return res.status(403).json({ message: "Acesso negado - operação não permitida" });
      }

      next();
    };
  }
  
  // Vehicles CRUD endpoints
  app.get('/api/vehicles', requireAuth, async (req, res) => {
    try {
      const user = req.user!;
      let vehicles;
      
      // Se for usuário com papel administrativo, buscar todos os veículos
      if (isAdminUser(user)) {
        vehicles = await storage.getAllVehicles();
      } else {
        // Buscar transportadores vinculados ao usuário
        const allTransporters = await storage.getAllTransporters();
        const userTransporters = allTransporters.filter(t => t.userId === user.id);
        
        if (userTransporters.length > 0) {
          // Se tem transportadores vinculados, buscar veículos associados a esses transportadores
          vehicles = await storage.getVehiclesByUserId(user.id);
        } else {
          vehicles = await storage.getVehiclesByUserId(user.id);
        }
      }

      // Enriquecer veículos com dados do transportador para exportações CSV
      const allTransporters = await storage.getAllTransporters();
      const vehiclesWithTransporter = vehicles.map(vehicle => {
        const transporter = allTransporters.find(t => t.id === (vehicle as any).transporterId);
        return {
          ...vehicle,
          transporter: transporter ? {
            id: transporter.id,
            name: transporter.name,
            tradeName: transporter.tradeName,
            documentNumber: transporter.documentNumber
          } : null
        };
      });
      
      res.json(vehiclesWithTransporter);
    } catch (error) {
      console.error('Error fetching vehicles:', error);
      res.status(500).json({ message: 'Erro ao buscar veículos' });
    }
  });

  // Endpoint para busca paginada de veículos (otimizado para formulários)
  app.get('/api/vehicles/search-paginated', requireAuth, async (req, res) => {
    try {
      const user = req.user!;
      const search = (req.query.search as string) || '';
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 10, 50); // Max 50 por página
      const vehicleType = req.query.type as string;
      const axleFilter = req.query.axles ? parseInt(req.query.axles as string) : null; // NOVO: Filtro de eixos
      const offset = (page - 1) * limit;
      
      let allVehicles;
      
      // Determinar quais veículos o usuário pode acessar
      if (isAdminUser(user)) {
        allVehicles = await storage.getAllVehicles();
      } else {
        allVehicles = await storage.getVehiclesByUserId(user.id);
      }
      
      // Filtrar por busca de texto (placa, marca, modelo)
      let filteredVehicles = allVehicles;
      if (search.trim()) {
        const searchLower = search.toLowerCase();
        filteredVehicles = allVehicles.filter(vehicle =>
          vehicle.plate.toLowerCase().includes(searchLower) ||
          (vehicle.brand && vehicle.brand.toLowerCase().includes(searchLower)) ||
          (vehicle.model && vehicle.model.toLowerCase().includes(searchLower))
        );
      }
      
      // Filtrar por tipo de veículo se especificado
      if (vehicleType) {
        filteredVehicles = filteredVehicles.filter(vehicle => 
          vehicle.type === vehicleType
        );
      }
      
      // CRÍTICO: Filtrar por número de eixos se especificado
      if (axleFilter !== null) {
        const originalCount = filteredVehicles.length;
        filteredVehicles = filteredVehicles.filter(vehicle => 
          vehicle.axleCount === axleFilter
        );
        // Performance: Log de filtro removido
      }
      
      // Ordenar por placa
      filteredVehicles.sort((a, b) => a.plate.localeCompare(b.plate));
      
      const total = filteredVehicles.length;
      const paginatedVehicles = filteredVehicles.slice(offset, offset + limit);
      const hasMore = offset + limit < total;
      
      // Performance: Log removido
      
      res.json({
        vehicles: paginatedVehicles,
        total,
        hasMore,
        page,
        limit
      });
    } catch (error) {
      console.error('Error in paginated vehicle search:', error);
      res.status(500).json({ message: 'Erro ao buscar veículos' });
    }
  });
  
  // Buscar veículo por ID
  app.get('/api/vehicles/:id([0-9]+)', async (req, res) => {
    try {
      const vehicleId = parseInt(req.params.id);
      
      const vehicle = await storage.getVehicleById(vehicleId);
      if (!vehicle) {
        return res.status(404).json({ message: 'Veículo não encontrado' });
      }
      
      // Definir explicitamente o content-type
      res.setHeader('Content-Type', 'application/json');
      res.json(vehicle);
    } catch (error) {
      console.error('Error fetching vehicle by ID:', error);
      res.status(500).json({ message: 'Erro ao buscar veículo pelo ID' });
    }
  });

  // Buscar veículo por placa
  app.get('/api/vehicles/by-plate/:plate', requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const plate = req.params.plate.toUpperCase();
      
      // Buscar veículos do usuário
      const vehicles = await storage.getVehiclesByUserId(userId);
      
      // Encontrar o veículo com a placa correspondente
      const vehicle = vehicles.find(v => v.plate.toUpperCase() === plate);
      
      if (!vehicle) {
        return res.status(404).json({ message: 'Veículo não encontrado' });
      }
      
      res.json(vehicle);
    } catch (error) {
      console.error('Error fetching vehicle by plate:', error);
      res.status(500).json({ message: 'Erro ao buscar veículo pela placa' });
    }
  });
  
  // Endpoint público para buscar veículo por placa (para uso em licenças)
  app.get('/api/public/vehicle-by-plate/:plate', async (req, res) => {
    try {
      const plate = req.params.plate.toUpperCase();
      
      console.log(`Buscando veículo com a placa: ${plate}`);
      
      // Buscar todos os veículos
      const allVehicles = await storage.getAllVehicles();
      console.log(`Total de veículos encontrados: ${allVehicles.length}`);
      
      // Buscar todas as placas disponíveis para debug
      const availablePlates = allVehicles.map(v => v.plate);
      console.log('Placas disponíveis:', availablePlates.join(', '));
      
      // Encontrar o veículo com a placa correspondente
      const vehicle = allVehicles.find(v => v.plate.toUpperCase() === plate);
      
      if (!vehicle) {
        console.log(`Veículo não encontrado com a placa ${plate}`);
        return res.status(404).json({ message: 'Veículo não encontrado' });
      }
      
      console.log(`Veículo encontrado:`, vehicle);
      res.json(vehicle);
    } catch (error) {
      console.error('Error fetching vehicle by plate (public):', error);
      res.status(500).json({ message: 'Erro ao buscar veículo pela placa' });
    }
  });
  
  // Endpoint para buscar todos os veículos (para sugestões de placas)
  // Mantemos a rota original que requer autenticação
  app.get('/api/vehicles/all', requireAuth, async (req, res) => {
    try {
      // Retorna uma lista simplificada de todos os veículos (apenas id, placa e tipo)
      const vehicles = await storage.getAllVehicles();
      const simplifiedVehicles = vehicles.map(v => ({
        id: v.id,
        plate: v.plate,
        type: v.type
      }));
      res.json(simplifiedVehicles);
    } catch (error) {
      console.error('Error fetching all vehicles:', error);
      res.status(500).json({ message: 'Erro ao buscar lista de veículos' });
    }
  });
  
  // Criamos uma nova rota pública específica para sugestões de placas
  app.get('/api/public/vehicle-plates', async (req, res) => {
    try {
      // Retorna apenas as placas de todos os veículos, sem autenticação
      console.log("Recebida requisição para sugestões públicas de placas");
      const vehicles = await storage.getAllVehicles();
      console.log(`Encontrados ${vehicles.length} veículos para sugestões`);
      
      // Extraímos apenas as placas únicas
      const uniquePlates = Array.from(new Set(vehicles.map(v => v.plate)));
      console.log(`${uniquePlates.length} placas únicas disponíveis para sugestão`);
      
      res.json(uniquePlates);
    } catch (error) {
      console.error('Error fetching vehicle plates:', error);
      res.status(500).json({ message: 'Erro ao buscar sugestões de placas' });
    }
  });

  app.post('/api/vehicles', requireAuth, upload.single('crlvFile'), processVehicleData, async (req, res) => {
    try {
      const currentUser = req.user!;
      
      // Para usuários administrativos, não vincular o veículo a eles
      // Deixar como "Usuário undefined" (userId = null)
      const isAdministrativeUser = isAdminUser(currentUser);
      const userId = isAdministrativeUser ? null : currentUser.id;
      
      console.log(`[VEHICLE CREATION] Usuário: ${currentUser.email} (${currentUser.role}), Administrativo: ${isAdministrativeUser}, userId assinado: ${userId}`);
      
      // Extrair dados do campo vehicleData (JSON string)
      let vehicleData;
      
      // Já processado pelo middleware processVehicleData
      vehicleData = { ...req.body };
      delete vehicleData.vehicleData; // Remove o campo vehicleData se presente
      console.log('Using processed vehicle data:', vehicleData);
      
      // Debug: log the request body
      console.log('Vehicle data received:', vehicleData);
      
      // Forçar conversão de todos os campos numéricos
      const processedData = {
        ...vehicleData,
        year: parseInt(vehicleData.year),
        axleCount: parseInt(vehicleData.axleCount),
        tare: parseFloat(vehicleData.tare),
        crlvYear: vehicleData.crlvYear ? parseInt(vehicleData.crlvYear) : undefined
      };

      console.log('Data after conversion:', processedData);

      // Validate vehicle data com dados já convertidos
      const validationResult = insertVehicleSchema.safeParse(processedData);
      if (!validationResult.success) {
        console.log('Validation error:', validationResult.error);
        const validationError = fromZodError(validationResult.error);
        return res.status(400).json({ message: validationError.message });
      }
      
      // Usar os dados validados
      vehicleData = validationResult.data;
      
      // Add file URL if provided
      let crlvUrl: string | undefined = undefined;
      if (req.file) {
        crlvUrl = `/uploads/${req.file.filename}`;
      }
      
      const vehicle = await storage.createVehicle(userId, {
        ...vehicleData,
        crlvUrl
      });
      
      // Invalidar cache relacionado a veículos
      invalidateCache('vehicles', vehicle.userId || undefined);
      
      // Enviar notificação WebSocket para novo veículo criado
      broadcastMessage({
        type: 'LICENSE_UPDATE',
        data: {
          vehicleId: vehicle.id,
          userId: vehicle.userId,
          action: 'VEHICLE_CREATED',
          createdAt: new Date().toISOString(),
          vehicle: vehicle
        }
      });
      
      res.status(201).json(vehicle);
    } catch (error) {
      console.error('Error creating vehicle:', error);
      res.status(500).json({ message: 'Erro ao criar veículo' });
    }
  });

  app.put('/api/vehicles/:id', requireAuth, upload.single('crlvFile'), processVehicleData, async (req, res) => {
    console.log('=== INICIO UPDATE VEHICLE ===');
    console.log('req.params.id:', req.params.id);
    console.log('req.body:', req.body);
    console.log('req.file:', req.file);
    
    try {
      const user = req.user!;
      const userId = user.id;
      const vehicleId = parseInt(req.params.id);
      
      console.log('User ID:', userId, 'Vehicle ID:', vehicleId);
      
      // Check if vehicle exists
      const existingVehicle = await storage.getVehicleById(vehicleId);
      if (!existingVehicle) {
        return res.status(404).json({ message: 'Veículo não encontrado' });
      }
      
      // Verificar se o usuário tem permissão para editar o veículo
      // Usuários comuns podem editar apenas seus próprios veículos
      // Administradores, Operacionais e Supervisores podem editar qualquer veículo
      const isStaff = isAdminUser(user) || user.role === 'operational' || user.role === 'supervisor';
      
      if (!isStaff && existingVehicle.userId !== userId) {
        console.log(`Usuário ${userId} (${user.role}) tentou editar veículo ${vehicleId} do usuário ${existingVehicle.userId}`);
        return res.status(403).json({ message: 'Acesso negado' });
      }
      
      console.log(`Usuário ${userId} (${user.role}) autorizado a editar veículo ${vehicleId}`);
      
      
      // Extrair dados do campo vehicleData (JSON string)
      let vehicleData;
      
      // Já processado pelo middleware processVehicleData
      vehicleData = { ...req.body };
      delete vehicleData.vehicleData; // Remove o campo vehicleData se presente
      console.log('Using processed vehicle update data:', vehicleData);
      
      // Processar dados para validação - converter tipos conforme esperado pelo schema
      const processedUpdateData = {
        ...vehicleData,
        ...(vehicleData.year && { year: parseInt(vehicleData.year) }),
        ...(vehicleData.axleCount && { axleCount: parseInt(vehicleData.axleCount) }),
        ...(vehicleData.tare && { tare: parseFloat(vehicleData.tare) }),
        ...(vehicleData.crlvYear && { crlvYear: parseInt(vehicleData.crlvYear) })
      };

      console.log('Data after conversion for update:', processedUpdateData);

      // Validate vehicle data
      const updateValidationResult = insertVehicleSchema.partial().safeParse(processedUpdateData);
      if (!updateValidationResult.success) {
        console.log('Validation error on update:', updateValidationResult.error);
        const validationError = fromZodError(updateValidationResult.error);
        return res.status(400).json({ message: validationError.message });
      }
      
      // Preparar dados para o storage com conversão de tipos explícita
      console.log('Dados validados recebidos:', updateValidationResult.data);
      
      const storageData: any = {};
      
      // Copiar todos os campos validados
      Object.keys(updateValidationResult.data).forEach(key => {
        const value = (updateValidationResult.data as any)[key];
        if (value !== undefined) {
          // Converter tare especificamente para string
          if (key === 'tare') {
            console.log(`Convertendo tare de ${value} (${typeof value}) para string`);
            storageData[key] = value.toString();
          } else {
            storageData[key] = value;
          }
        }
      });
      
      // Add file URL if provided
      if (req.file) {
        storageData.crlvUrl = `/uploads/${req.file.filename}`;
      }
      
      console.log('Dados preparados para storage:', storageData);
      
      const updatedVehicle = await storage.updateVehicle(vehicleId, storageData);
      console.log('Veículo atualizado com sucesso:', updatedVehicle);
      
      // Invalidar cache relacionado a veículos
      invalidateCache('vehicles', existingVehicle.userId || undefined);
      
      // Enviar notificação WebSocket para veículo atualizado
      broadcastVehicleUpdate(updatedVehicle.id, 'updated', updatedVehicle);
      
      res.json(updatedVehicle);
    } catch (error) {
      console.error('Error updating vehicle:', error);
      res.status(500).json({ message: 'Erro ao atualizar veículo' });
    }
  });

  app.delete('/api/vehicles/:id', requireAuth, async (req, res) => {
    try {
      const user = req.user!;
      const userId = user.id;
      const vehicleId = parseInt(req.params.id);
      
      // Check if vehicle exists
      const existingVehicle = await storage.getVehicleById(vehicleId);
      if (!existingVehicle) {
        return res.status(404).json({ message: 'Veículo não encontrado' });
      }
      
      // Verificar se o usuário tem permissão para excluir o veículo
      // Usuários comuns podem excluir apenas seus próprios veículos
      // Administradores, Operacionais e Supervisores podem excluir qualquer veículo
      const isStaff = isAdminUser(user) || user.role === 'operational' || user.role === 'supervisor';
      
      if (!isStaff && existingVehicle.userId !== userId) {
        console.log(`Usuário ${userId} (${user.role}) tentou excluir veículo ${vehicleId} do usuário ${existingVehicle.userId}`);
        return res.status(403).json({ message: 'Acesso negado' });
      }
      
      console.log(`Usuário ${userId} (${user.role}) autorizado a excluir veículo ${vehicleId}`);
      
      
      await storage.deleteVehicle(vehicleId);
      
      // Invalidar cache relacionado a veículos
      invalidateCache('vehicles', existingVehicle.userId || undefined);
      
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting vehicle:', error);
      res.status(500).json({ message: 'Erro ao excluir veículo' });
    }
  });

  // License draft endpoints
  app.get('/api/licenses/drafts', requireAuth, async (req, res) => {
    try {
      const user = req.user!;
      console.log(`[DRAFTS ENDPOINT] Usuário ${user.email} buscando rascunhos com parâmetros:`, req.query);
      let allDrafts = [];
      
      // Se for usuário administrativo, buscar todos os rascunhos
      if (isAdminUser(user)) {
        console.log(`Usuário ${user.email} (${user.role}) tem acesso administrativo. Buscando todos os rascunhos.`);
        
        // Consulta simples direta no banco
        const query = await db.execute(sql`
          SELECT * FROM license_requests WHERE is_draft = true
        `);
        
        // Mapear resultados da consulta SQL direta para o formato esperado
        allDrafts = query.rows.map(row => {
          // Converter campos tipo array
          let states = row.states;
          if (typeof states === 'string' && states.startsWith('{') && states.endsWith('}')) {
            states = states.substring(1, states.length - 1).split(',');
          }
          
          return {
            ...row,
            id: Number(row.id),
            userId: Number(row.user_id),
            transporterId: Number(row.transporter_id),
            isDraft: row.is_draft === true,
            tractorUnitId: row.tractor_unit_id ? Number(row.tractor_unit_id) : null,
            firstTrailerId: row.first_trailer_id ? Number(row.first_trailer_id) : null,
            secondTrailerId: row.second_trailer_id ? Number(row.second_trailer_id) : null,
            dollyId: row.dolly_id ? Number(row.dolly_id) : null,
            flatbedId: row.flatbed_id ? Number(row.flatbed_id) : null,
            requestNumber: row.request_number,
            status: row.status,
            states: states,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            comments: row.comments,
            cargoType: row.cargo_type,
            mainVehiclePlate: row.main_vehicle_plate,
            type: row.type,
            length: row.length,
            width: row.width,
            height: row.height,
            additionalPlates: row.additional_plates || [],
            additionalPlatesDocuments: row.additional_plates_documents || [],
          }
        });
      } else {
        console.log(`Usuário ${user.email} (${user.role}) tem acesso comum. Buscando apenas seus rascunhos.`);
        
        // Buscar rascunhos por userId
        const userDraftsQuery = await db.execute(sql`
          SELECT * FROM license_requests WHERE is_draft = true AND user_id = ${user.id}
        `);
        
        // Buscar transportadores do usuário individualmente
        const transportersQuery = await db.execute(sql`
          SELECT id FROM transporters WHERE user_id = ${user.id}
        `);
        
        const transporterIds = transportersQuery.rows.map(t => Number(t.id));
        console.log(`[DEBUG RASCUNHOS] Transportadores associados ao usuário ${user.id}: ${transporterIds.join(', ')}`);
        
        // Mapear resultados do usuário para o formato de objeto
        const userDrafts = userDraftsQuery.rows.map(row => {
          // Converter campos tipo array
          let states = row.states;
          if (typeof states === 'string' && states.startsWith('{') && states.endsWith('}')) {
            states = states.substring(1, states.length - 1).split(',');
          }
          
          return {
            ...row,
            id: Number(row.id),
            userId: Number(row.user_id),
            transporterId: Number(row.transporter_id),
            isDraft: row.is_draft === true,
            tractorUnitId: row.tractor_unit_id ? Number(row.tractor_unit_id) : null,
            firstTrailerId: row.first_trailer_id ? Number(row.first_trailer_id) : null,
            secondTrailerId: row.second_trailer_id ? Number(row.second_trailer_id) : null,
            dollyId: row.dolly_id ? Number(row.dolly_id) : null,
            flatbedId: row.flatbed_id ? Number(row.flatbed_id) : null,
            requestNumber: row.request_number,
            status: row.status,
            states: states,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            comments: row.comments,
            cargoType: row.cargo_type,
            mainVehiclePlate: row.main_vehicle_plate,
            type: row.type,
            length: row.length,
            width: row.width,
            height: row.height,
            additionalPlates: row.additional_plates || [],
            additionalPlatesDocuments: row.additional_plates_documents || [],
          }
        });
        
        allDrafts = [...userDrafts];
        
        // Se houver transportadores associados, buscar rascunhos por cada transportador
        for (const transporterId of transporterIds) {
          const transporterDraftsQuery = await db.execute(sql`
            SELECT * FROM license_requests WHERE is_draft = true AND transporter_id = ${transporterId}
          `);
          
          const transporterDrafts = transporterDraftsQuery.rows.map(row => {
            // Converter campos tipo array
            let states = row.states;
            if (typeof states === 'string' && states.startsWith('{') && states.endsWith('}')) {
              states = states.substring(1, states.length - 1).split(',');
            }
            
            return {
              ...row,
              id: Number(row.id),
              userId: Number(row.user_id),
              transporterId: Number(row.transporter_id),
              isDraft: row.is_draft === true,
              tractorUnitId: row.tractor_unit_id ? Number(row.tractor_unit_id) : null,
              firstTrailerId: row.first_trailer_id ? Number(row.first_trailer_id) : null,
              secondTrailerId: row.second_trailer_id ? Number(row.second_trailer_id) : null,
              dollyId: row.dolly_id ? Number(row.dolly_id) : null,
              flatbedId: row.flatbed_id ? Number(row.flatbed_id) : null,
              requestNumber: row.request_number,
              status: row.status,
              states: states,
              createdAt: row.created_at,
              updatedAt: row.updated_at,
              comments: row.comments,
              cargoType: row.cargo_type,
              mainVehiclePlate: row.main_vehicle_plate,
              type: row.type,
              length: row.length,
              width: row.width,
              height: row.height,
              additionalPlates: row.additional_plates || [],
              additionalPlatesDocuments: row.additional_plates_documents || [],
            }
          });
          
          console.log(`[DEBUG RASCUNHOS] Encontrados ${transporterDrafts.length} rascunhos para transportador ${transporterId}`);
          allDrafts = [...allDrafts, ...transporterDrafts];
        }
        
        // Remover duplicatas por ID
        const uniqueMap = new Map();
        allDrafts.forEach(draft => {
          if (!uniqueMap.has(draft.id)) {
            uniqueMap.set(draft.id, draft);
          }
        });
        
        allDrafts = Array.from(uniqueMap.values());
      }
      
      // Verificar se deve incluir rascunhos de renovação
      const shouldIncludeRenewalDrafts = req.query.includeRenewal === 'true';
      
      // Se não deve incluir rascunhos de renovação, filtrar aqueles que têm comentários sobre renovação
      const drafts = shouldIncludeRenewalDrafts 
        ? allDrafts 
        : allDrafts.filter(draft => {
            // Se o comentário menciona "Renovação", é um rascunho de renovação
            return !(draft.comments && draft.comments.includes('Renovação'));
          });
      
      // Performance: Logs de debug removidos
      
      res.json(drafts);
    } catch (error) {
      console.error('Error fetching license drafts:', error);
      res.status(500).json({ message: 'Erro ao buscar rascunhos de licenças' });
    }
  });

  app.post('/api/licenses/drafts', requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const draftData = { ...req.body };
      
      console.log("Dados de rascunho recebidos:", JSON.stringify(draftData, null, 2));
      
      // Sanitização mais rigorosa dos campos de dimensões com valores padrão
      console.log("Rascunho: Sanitizando dados para tipo " + draftData.type);
      
      // Valores padrão baseados no tipo de licença - prancha tem limites diferentes
      const isPrancha = draftData.type === "flatbed";
      
      // Verificar width (largura)
      if (draftData.width === undefined || draftData.width === null || draftData.width === "") {
        draftData.width = isPrancha ? 320 : 260; // 3.20m para prancha, 2.60m para outros
        console.log(`Aplicando valor padrão para largura: ${draftData.width}`);
      } else {
        // Garantir que é um número
        draftData.width = Number(draftData.width);
        console.log(`Convertendo largura para número: ${draftData.width}`);
      }
      
      // Verificar height (altura)
      if (draftData.height === undefined || draftData.height === null || draftData.height === "") {
        draftData.height = isPrancha ? 495 : 440; // 4.95m para prancha, 4.40m para outros
        console.log(`Aplicando valor padrão para altura: ${draftData.height}`);
      } else {
        // Garantir que é um número
        draftData.height = Number(draftData.height);
        console.log(`Convertendo altura para número: ${draftData.height}`);
      }
      
      // Verificar cargoType (tipo de carga)
      if (draftData.cargoType === undefined || draftData.cargoType === null || draftData.cargoType === "") {
        draftData.cargoType = isPrancha ? "indivisible_cargo" : "dry_cargo";
        console.log(`Aplicando valor padrão para tipo de carga: ${draftData.cargoType}`);
      }
      
      // Validate draft data
      try {
        insertDraftLicenseSchema.parse(draftData);
      } catch (error: any) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message });
      }
      
      // Generate a draft request number with AET format
      const draftNumber = `AET-${String(Math.floor(Math.random() * 90000) + 10000)}`;
      
      // Garantir que os campos obrigatórios sejam enviados corretamente para o banco de dados
      const sanitizedData = {
        ...draftData,
        width: draftData.width !== undefined ? Number(draftData.width) : null,
        height: draftData.height !== undefined ? Number(draftData.height) : null,
        cargoType: draftData.cargoType || null,
        requestNumber: draftNumber,
        isDraft: true,
      };
      
      console.log("Dados sanitizados para envio ao banco:", sanitizedData);
      
      const draft = await storage.createLicenseDraft(userId, sanitizedData);
      
      res.status(201).json(draft);
    } catch (error) {
      console.error('Error creating license draft:', error);
      res.status(500).json({ message: 'Erro ao criar rascunho de licença' });
    }
  });

  app.patch('/api/licenses/drafts/:id', requireAuth, async (req, res) => {
    try {
      const user = req.user!;
      const draftId = parseInt(req.params.id);
      
      // Check if draft exists
      const existingDraft = await storage.getLicenseRequestById(draftId);
      if (!existingDraft) {
        return res.status(404).json({ message: 'Rascunho não encontrado' });
      }
      
      // Verificar acesso - usuários staff (admin, operacional, supervisor) podem editar qualquer rascunho
      const isStaff = isAdminUser(user) || user.role === 'operational' || user.role === 'supervisor';
      
      if (!isStaff && existingDraft.userId !== user.id) {
        console.log(`Usuário ${user.id} (${user.role}) tentou editar rascunho ${draftId} do usuário ${existingDraft.userId}`);
        return res.status(403).json({ message: 'Acesso negado' });
      }
      
      console.log(`Usuário ${user.id} (${user.role}) autorizado a editar rascunho ${draftId}`);
      
      
      const draftData = { ...req.body };
      
      console.log("Dados para atualização de rascunho recebidos:", JSON.stringify(draftData, null, 2));
      
      // Garantir que todos os campos obrigatórios não sejam nulos
      // Sempre preservar o cargoType do existingDraft se não estiver presente no draftData
      if (!draftData.cargoType && existingDraft.cargoType) {
        draftData.cargoType = existingDraft.cargoType;
        console.log(`Preservando cargoType existente: ${existingDraft.cargoType}`);
      }
      
      if (draftData.type === "flatbed" || existingDraft.type === "flatbed") {
        // Para prancha: verifica requisitos específicos
        console.log("Atualização de rascunho: É prancha");
        if (!draftData.width) draftData.width = existingDraft.width || 260; // Manter valor existente ou valor padrão
        if (!draftData.height) draftData.height = existingDraft.height || 440; // Manter valor existente ou valor padrão
        if (!draftData.cargoType) draftData.cargoType = existingDraft.cargoType || "indivisible_cargo"; // Manter valor existente ou valor padrão
      } else if (draftData.type || existingDraft.type) {
        // Para não-prancha: verifica requisitos gerais
        console.log("Atualização de rascunho: Não é prancha");
        if (!draftData.width) draftData.width = existingDraft.width || 260; // Manter valor existente ou valor padrão
        if (!draftData.height) draftData.height = existingDraft.height || 440; // Manter valor existente ou valor padrão
        if (!draftData.cargoType) draftData.cargoType = existingDraft.cargoType || "dry_cargo"; // Manter valor existente ou valor padrão
      }
      
      // Validate draft data
      try {
        insertDraftLicenseSchema.partial().parse(draftData);
      } catch (error: any) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message });
      }
      
      // Garantir que os campos obrigatórios sejam enviados corretamente para o banco de dados
      const sanitizedData = {
        ...draftData,
        width: draftData.width !== undefined ? Number(draftData.width) : existingDraft.width,
        height: draftData.height !== undefined ? Number(draftData.height) : existingDraft.height,
        cargoType: draftData.cargoType || existingDraft.cargoType,
      };
      
      console.log("Dados sanitizados para atualização do rascunho:", sanitizedData);
      
      const updatedDraft = await storage.updateLicenseDraft(draftId, sanitizedData);
      
      res.json(updatedDraft);
    } catch (error) {
      console.error('Error updating license draft:', error);
      res.status(500).json({ message: 'Erro ao atualizar rascunho de licença' });
    }
  });

  app.delete('/api/licenses/drafts/:id', requireAuth, async (req, res) => {
    try {
      const user = req.user!;
      const draftId = parseInt(req.params.id);
      
      // Check if draft exists
      const existingDraft = await storage.getLicenseRequestById(draftId);
      if (!existingDraft) {
        return res.status(404).json({ message: 'Rascunho não encontrado' });
      }
      
      // Verificar se é um rascunho
      if (!existingDraft.isDraft) {
        return res.status(403).json({ message: 'Este item não é um rascunho' });
      }
      
      // Verificar acesso - usuários staff (admin, operacional, supervisor) podem excluir qualquer rascunho
      const isStaff = isAdminUser(user) || user.role === 'operational' || user.role === 'supervisor';
      
      if (!isStaff && existingDraft.userId !== user.id) {
        console.log(`Usuário ${user.id} (${user.role}) tentou excluir rascunho ${draftId} do usuário ${existingDraft.userId}`);
        return res.status(403).json({ message: 'Acesso negado' });
      }
      
      console.log(`Usuário ${user.id} (${user.role}) autorizado a excluir rascunho ${draftId}`);
      
      
      await storage.deleteLicenseRequest(draftId);
      
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting license draft:', error);
      res.status(500).json({ message: 'Erro ao excluir rascunho de licença' });
    }
  });

  app.post('/api/licenses/drafts/:id/submit', requireAuth, async (req, res) => {
    try {
      // Performance: Logs de debug removidos
      
      const user = req.user!;
      const draftId = parseInt(req.params.id);
      
      // Check if draft exists
      const existingDraft = await storage.getLicenseRequestById(draftId);
      if (!existingDraft) {
        return res.status(404).json({ message: 'Rascunho não encontrado' });
      }
      
      // Verificar se é um rascunho
      if (!existingDraft.isDraft) {
        return res.status(403).json({ message: 'Este item não é um rascunho ou já foi submetido' });
      }
      
      // Verificar acesso - usuários staff (admin, operacional, supervisor) podem submeter qualquer rascunho
      const isStaff = isAdminUser(user) || user.role === 'operational' || user.role === 'supervisor';
      
      if (!isStaff && existingDraft.userId !== user.id) {
        return res.status(403).json({ message: 'Acesso negado' });
      }
      
      // CORREÇÃO CRÍTICA: Usar os estados do req.body se disponíveis
      const bodyData = req.body || {};
      
      // Mesclar dados do rascunho com dados do body
      const draftData = { 
        ...existingDraft,
        ...bodyData, // Dados do body têm prioridade
        states: bodyData.states || existingDraft.states // USAR ESTADOS DO FRONTEND
      };
      
      if (draftData.type === "flatbed") {
        // Para prancha: verifica requisitos específicos
        if (!draftData.width) draftData.width = 260; // 2.60m padrão
        if (!draftData.height) draftData.height = 440; // 4.40m padrão
        if (!draftData.cargoType) draftData.cargoType = "indivisible_cargo"; // Carga indivisível padrão
      } else if (draftData.type) {
        // Para não-prancha: verifica requisitos gerais
        if (!draftData.width) draftData.width = 260; // 2.60m padrão
        if (!draftData.height) draftData.height = 440; // 4.40m padrão
        if (!draftData.cargoType) draftData.cargoType = "dry_cargo"; // Carga seca padrão
      }
      
      // Atualizar o rascunho com TODOS os dados incluindo estados
      console.log('Atualizando rascunho com estados:', draftData.states);
      await storage.updateLicenseDraft(draftId, {
        width: draftData.width,
        height: draftData.height,
        cargoType: draftData.cargoType,
        states: draftData.states, // INCLUIR ESTADOS NA ATUALIZAÇÃO
        comments: draftData.comments
      });
      
      console.log("Rascunho sanitizado antes de submeter:", draftData);
      
      // Generate a real request number
      const requestNumber = `AET-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`;
      
      // Submit the draft as a real license request
      const licenseRequest = await storage.submitLicenseDraft(draftId, requestNumber);
      
      console.log('Licença final submetida com estados:', licenseRequest.states);
      
      // CORREÇÃO: Enviar notificações WebSocket após submissão
      console.log('📡 Enviando broadcast para licença submetida:', licenseRequest.id);
      broadcastLicenseUpdate(licenseRequest.id, 'submitted', licenseRequest);
      broadcastDashboardUpdate();
      
      res.json(licenseRequest);
    } catch (error) {
      console.error('Error submitting license draft:', error);
      res.status(500).json({ message: 'Erro ao enviar solicitação de licença' });
    }
  });
  
  // Endpoint removido - duplicado abaixo

  // Endpoint para verificar licenças vigentes por estado e placas (nova abordagem)
  app.post('/api/licencas-vigentes', requireAuth, async (req: any, res: any) => {
    try {
      const { estado, placas } = req.body;
      
      if (!estado) {
        return res.status(400).json({ message: 'Estado é obrigatório' });
      }
      
      if (!placas || typeof placas !== 'object') {
        return res.status(400).json({ message: 'Placas são obrigatórias' });
      }
      
      console.log(`[VALIDAÇÃO ESTADO] Verificando licenças vigentes para estado: ${estado}`);
      console.log(`[VALIDAÇÃO ESTADO] Placas:`, placas);
      
      // Construir condições dinâmicas baseadas nas placas disponíveis
      const conditions = [];
      const params = [estado];
      let paramIndex = 2;
      
      if (placas.cavalo) {
        conditions.push(`le.placa_unidade_tratora = $${paramIndex++}`);
        params.push(placas.cavalo);
      }
      if (placas.primeiraCarreta) {
        conditions.push(`le.placa_primeira_carreta = $${paramIndex++}`);
        params.push(placas.primeiraCarreta);
      }
      if (placas.segundaCarreta) {
        conditions.push(`le.placa_segunda_carreta = $${paramIndex++}`);
        params.push(placas.segundaCarreta);
      }
      if (placas.dolly) {
        conditions.push(`le.placa_dolly = $${paramIndex++}`);
        params.push(placas.dolly);
      }
      if (placas.prancha) {
        conditions.push(`le.placa_prancha = $${paramIndex++}`);
        params.push(placas.prancha);
      }
      if (placas.reboque) {
        conditions.push(`le.placa_reboque = $${paramIndex++}`);
        params.push(placas.reboque);
      }
      
      if (conditions.length === 0) {
        // Performance: Log removido
        return res.json(null);
      }
      
      const query = `
        SELECT 
          le.estado,
          le.numero_licenca,
          le.data_validade,
          le.status,
          le.placa_unidade_tratora,
          le.placa_primeira_carreta,
          le.placa_segunda_carreta,
          le.placa_dolly,
          le.placa_prancha,
          le.placa_reboque
        FROM licencas_emitidas le
        WHERE le.estado = $1 
          AND le.status = 'ativa'
          AND le.data_validade > CURRENT_DATE
          AND (${conditions.join(' OR ')})
        ORDER BY le.data_validade DESC
        LIMIT 1
      `;
      
      // Performance: Logs removidos
      
      const result = await pool.query(query, params);
      
      if (result.rows.length > 0) {
        const licenca = result.rows[0];
        const now = new Date();
        const validUntil = new Date(licenca.data_validade);
        const diasRestantes = Math.ceil((validUntil.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        
        // Performance: Log removido
        
        return res.json({
          numero_licenca: licenca.numero_licenca,
          data_validade: licenca.data_validade,
          diasRestantes,
          bloqueado: diasRestantes > 60,
          placas: {
            tratora: licenca.placa_unidade_tratora,
            primeira: licenca.placa_primeira_carreta,
            segunda: licenca.placa_segunda_carreta,
            dolly: licenca.placa_dolly,
            prancha: licenca.placa_prancha,
            reboque: licenca.placa_reboque
          }
        });
      } else {
        // Performance: Log removido
        return res.json(null);
      }
      
    } catch (error) {
      console.error('Erro ao verificar licenças vigentes:', error);
      return res.status(500).json({ message: 'Erro interno do servidor' });
    }
  });

  // License request endpoints
  app.get('/api/licenses', requireAuth, async (req, res) => {
    try {
      const user = req.user!;
      let allLicenses;
      
      // Se for usuário administrativo, buscar todas as licenças
      if (isAdminUser(user)) {
        console.log(`Usuário ${user.email} (${user.role}) tem acesso administrativo. Buscando todas as licenças.`);
        allLicenses = await storage.getAllLicenseRequests();
      } else {
        console.log(`Usuário ${user.email} (${user.role}) tem acesso comum. Buscando apenas suas licenças.`);
        
        // Primeiro, obter os transportadores associados ao usuário
        const userTransporters = await db.select()
          .from(transporters)
          .where(eq(transporters.userId, user.id));
          
        const transporterIds = userTransporters.map(t => t.id);
        console.log(`[DEBUG ACOMPANHAR LICENÇAS] Transportadores associados ao usuário ${user.id}: ${transporterIds.join(', ')}`);
        
        // Buscar licenças onde o usuário é o dono OU o transportador está associado ao usuário
        let licencasNoBanco = [];
        
        // Se houver transportadores associados, buscar licenças por transporterId também
        if (transporterIds.length > 0) {
          licencasNoBanco = await db.select()
            .from(licenseRequests)
            .where(
              or(
                eq(licenseRequests.userId, user.id),
                inArray(licenseRequests.transporterId, transporterIds)
              )
            );
            
          console.log(`[DEBUG ACOMPANHAR LICENÇAS] Encontradas ${licencasNoBanco.length} licenças para usuário ${user.id} ou transportadores ${transporterIds.join(', ')}`);
        } else {
          // Se não houver transportadores, buscar apenas por userId
          licencasNoBanco = await db.select()
            .from(licenseRequests)
            .where(eq(licenseRequests.userId, user.id));
            
          console.log(`[DEBUG ACOMPANHAR LICENÇAS] Encontradas ${licencasNoBanco.length} licenças para usuário ${user.id} sem transportadores associados`);
        }
        
        allLicenses = licencasNoBanco;
      }
      
      // Verificar se deve incluir rascunhos de renovação
      const shouldIncludeRenewalDrafts = req.query.includeRenewal === 'true';
      
      // Filtrar rascunhos de renovação, a menos que solicitado explicitamente para incluí-los
      const licenses = shouldIncludeRenewalDrafts 
        ? allLicenses 
        : allLicenses.filter(license => {
            // Se é um rascunho e o comentário menciona "Renovação", é um rascunho de renovação
            if (license.isDraft && license.comments && license.comments.includes('Renovação')) {
              return false; // excluir rascunhos de renovação
            }
            return true; // manter todos os outros
          });
      
      // Enriquecer licenças com dados do transportador para exportações CSV
      const allTransporters = await storage.getAllTransporters();
      const licensesWithTransporter = licenses.map(license => {
        const transporter = allTransporters.find(t => t.id === license.transporterId);
        return {
          ...license,
          transporter: transporter ? {
            id: transporter.id,
            name: transporter.name,
            tradeName: transporter.tradeName,
            documentNumber: transporter.documentNumber
          } : null
        };
      });

      console.log(`Total de licenças: ${allLicenses.length}, filtradas: ${licensesWithTransporter.length}, incluindo renovação: ${shouldIncludeRenewalDrafts}`);
      
      res.json(licensesWithTransporter);
    } catch (error) {
      console.error('Error fetching license requests:', error);
      res.status(500).json({ message: 'Erro ao buscar solicitações de licenças' });
    }
  });

  app.post('/api/licenses', requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const licenseData = { ...req.body };
      
      console.log("Dados de licença recebidos:", JSON.stringify(licenseData, null, 2));
      console.log("Tipo de licença:", licenseData.type);
      console.log("Tipo de carga:", licenseData.cargoType);
      console.log("Comprimento:", licenseData.length);
      console.log("Largura:", licenseData.width);
      console.log("Altura:", licenseData.height);
      console.log("Comprimento da licença:", licenseData.length);
      console.log("Tipo do valor do comprimento:", typeof licenseData.length);
      
      // Sanitização mais rigorosa dos campos de dimensões com valores padrão
      console.log("Sanitizando dados para tipo " + licenseData.type);
      
      // Valores padrão baseados no tipo de licença - prancha tem limites diferentes
      const isPrancha = licenseData.type === "flatbed";
      
      // Verificar length (comprimento) - CONVERSÃO DE METROS PARA CENTÍMETROS
      if (licenseData.length === undefined || licenseData.length === null || licenseData.length === "") {
        licenseData.length = isPrancha ? 2600 : 2500; // 26.00m para prancha, 25.00m para outros (em centímetros)
        console.log(`Aplicando valor padrão para comprimento: ${licenseData.length} cm`);
      } else {
        // Converter metros para centímetros (frontend envia em metros, BD armazena em centímetros)
        const metersValue = Number(licenseData.length);
        licenseData.length = metersValue * 100;
        console.log(`Convertendo comprimento de ${metersValue}m para ${licenseData.length} cm`);
      }
      
      // Verificar width (largura)
      if (licenseData.width === undefined || licenseData.width === null || licenseData.width === "") {
        licenseData.width = isPrancha ? 320 : 260; // 3.20m para prancha, 2.60m para outros
        console.log(`Aplicando valor padrão para largura: ${licenseData.width}`);
      } else {
        // Garantir que é um número
        licenseData.width = Number(licenseData.width);
        console.log(`Convertendo largura para número: ${licenseData.width}`);
      }
      
      // Verificar height (altura)
      if (licenseData.height === undefined || licenseData.height === null || licenseData.height === "") {
        licenseData.height = isPrancha ? 495 : 440; // 4.95m para prancha, 4.40m para outros
        console.log(`Aplicando valor padrão para altura: ${licenseData.height}`);
      } else {
        // Garantir que é um número
        licenseData.height = Number(licenseData.height);
        console.log(`Convertendo altura para número: ${licenseData.height}`);
      }
      
      // Verificar cargoType (tipo de carga)
      if (licenseData.cargoType === undefined || licenseData.cargoType === null || licenseData.cargoType === "") {
        licenseData.cargoType = isPrancha ? "indivisible_cargo" : "dry_cargo";
        console.log(`Aplicando valor padrão para tipo de carga: ${licenseData.cargoType}`);
      }
      
      console.log("Dados sanitizados para envio ao banco:", licenseData);
      
      // Bypass validação temporariamente para entender o problema
      try {
        // Verificações mínimas ao invés da validação completa
        if (!licenseData.transporterId) {
          return res.status(400).json({ message: "Um transportador deve ser selecionado" });
        }
        
        if (!licenseData.type) {
          return res.status(400).json({ message: "O tipo é obrigatório" });
        }
        
        if (!licenseData.states || licenseData.states.length === 0) {
          return res.status(400).json({ message: "Selecione pelo menos um estado" });
        }
        
        if (!licenseData.mainVehiclePlate) {
          return res.status(400).json({ message: "A placa principal é obrigatória" });
        }
        
        // Nenhuma validação ou conversão de dimensões no backend
        // Todas as validações são feitas no frontend conforme o tipo específico
        // Valores de comprimento, largura e altura são mantidos exatamente como enviados do frontend
      } catch (error: any) {
        console.error("Erro de validação manual:", error);
        return res.status(400).json({ message: error.message || "Erro na validação" });
      }
      
      // Generate a request number
      const requestNumber = `AET-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`;
      
      // Garantir que os campos obrigatórios sejam enviados corretamente para o banco de dados
      // Conversão explícita de tipos para evitar problemas de nulos
      const sanitizedData = {
        ...licenseData,
        width: licenseData.width !== undefined ? Number(licenseData.width) : null,
        height: licenseData.height !== undefined ? Number(licenseData.height) : null,
        cargoType: licenseData.cargoType || null,
        requestNumber,
        isDraft: false,
      };
      
      console.log("Dados sanitizados para envio ao banco:", sanitizedData);
      
      const licenseRequest = await storage.createLicenseRequest(userId, sanitizedData);
      
      console.log("Licença criada com sucesso! ID:", licenseRequest.id, "Estados:", licenseRequest.states);
      
      // Enviar notificação WebSocket para nova licença
      broadcastMessage({
        type: 'LICENSE_UPDATE',
        data: {
          action: 'created',
          license: licenseRequest,
          userId: userId
        }
      });
      
      res.status(201).json(licenseRequest);
    } catch (error) {
      console.error('Error creating license request:', error);
      res.status(500).json({ message: 'Erro ao criar solicitação de licença' });
    }
  });
  
  // Endpoint para enviar um pedido de licença (usado no formulário frontened)
  app.post('/api/licenses/submit', requireAuth, async (req, res) => {
    try {
      const user = req.user!;
      const userId = user.id;
      let licenseData = { ...req.body };
      
      // Se é um rascunho existente, redireciona para a rota correspondente
      if (licenseData.id) {
        const draftId = licenseData.id;
        
        // Check if draft exists and belongs to the user
        const existingDraft = await storage.getLicenseRequestById(draftId);
        if (!existingDraft) {
          return res.status(404).json({ message: 'Rascunho não encontrado' });
        }
        
        if (existingDraft.userId !== userId) {
          return res.status(403).json({ message: 'Acesso negado' });
        }
        
        // Generate a real request number
        const requestNumber = `AET-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`;
        
        // Submit the draft as a real license request
        const licenseRequest = await storage.submitLicenseDraft(draftId, requestNumber);
        
        // Enviar notificação WebSocket para nova licença criada
        broadcastMessage({
          type: 'LICENSE_UPDATE',
          data: {
            licenseId: licenseRequest.id,
            userId: licenseRequest.userId,
            status: licenseRequest.status,
            action: 'CREATED',
            createdAt: new Date().toISOString(),
            license: licenseRequest
          }
        });
        
        return res.json(licenseRequest);
      }
      
      // Caso seja uma criação direta
      // Definindo valores padrão para campos obrigatórios, se não existirem
      if (!licenseData.status) {
        licenseData.status = 'pending_registration';
      }
      
      // Garantir que os estados estão corretos - priorizar o campo states do frontend
      // Performance: Log removido
      
      if (!licenseData.states || !Array.isArray(licenseData.states)) {
        licenseData.states = licenseData.requestedStates || [];
      }
      
      console.log("Estados finais processados:", licenseData.states);
      
      // Preparando estado das solicitações por estado
      if (!licenseData.stateStatuses) {
        licenseData.stateStatuses = licenseData.states.map((state: string) => `${state}:pending_registration`);
      }
      
      // Ensure additionalPlates is properly formatted
      licenseData.additionalPlates = licenseData.additionalPlates || [];
      
      // Generate a request number
      const requestNumber = `AET-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`;
      
      // CONVERSÃO: Frontend envia em centímetros, PostgreSQL espera em metros
      console.log('Valores ANTES da conversão:', {
        length: licenseData.length,
        width: licenseData.width, 
        height: licenseData.height
      });
      
      // Converter de centímetros para metros se os valores parecem estar em centímetros
      if (licenseData.length && licenseData.length > 100) {
        licenseData.length = Number((licenseData.length / 100).toFixed(2)); // centímetros para metros
      }
      if (licenseData.width && licenseData.width > 50) {
        licenseData.width = Number((licenseData.width / 100).toFixed(2)); // centímetros para metros  
      }
      if (licenseData.height && licenseData.height > 50) {
        licenseData.height = Number((licenseData.height / 100).toFixed(2)); // centímetros para metros
      }
      
      console.log('Valores DEPOIS da conversão (metros):', {
        length: licenseData.length,
        width: licenseData.width,
        height: licenseData.height
      });
      
      // Validate license data using the complete schema with conditional validations
      try {
        console.log('Validando dados da licença com schema completo...');
        console.log('Dados a validar:', JSON.stringify(licenseData, null, 2));
        
        const validationResult = insertLicenseRequestSchema.safeParse(licenseData);
        if (!validationResult.success) {
          console.log('❌ VALIDATION ERROR:', validationResult.error);
          const validationError = fromZodError(validationResult.error);
          return res.status(400).json({ 
            message: validationError.message,
            errors: validationResult.error.errors 
          });
        }
        
        console.log('✅ Validação bem-sucedida');
        // Use os dados validados
        licenseData = validationResult.data;
        
      } catch (error: any) {
        console.error('Validation error:', error);
        return res.status(400).json({ message: error.message || "Erro de validação" });
      }
      
      // Sanitização mais rigorosa dos campos de dimensões com valores padrão
      console.log("Sanitizando dados para tipo " + licenseData.type);
      
      // Valores padrão baseados no tipo de licença - prancha tem limites diferentes
      const isPrancha = licenseData.type === "flatbed";
      
      // Verificar width (largura)
      if (licenseData.width === undefined || licenseData.width === null || licenseData.width === "") {
        licenseData.width = isPrancha ? 320 : 260; // 3.20m para prancha, 2.60m para outros
        console.log(`Aplicando valor padrão para largura: ${licenseData.width}`);
      } else {
        // Garantir que é um número
        licenseData.width = Number(licenseData.width);
        console.log(`Convertendo largura para número: ${licenseData.width}`);
      }
      
      // Verificar height (altura)
      if (licenseData.height === undefined || licenseData.height === null || licenseData.height === "") {
        licenseData.height = isPrancha ? 495 : 440; // 4.95m para prancha, 4.40m para outros
        console.log(`Aplicando valor padrão para altura: ${licenseData.height}`);
      } else {
        // Garantir que é um número
        licenseData.height = Number(licenseData.height);
        console.log(`Convertendo altura para número: ${licenseData.height}`);
      }
      
      // Verificar cargoType (tipo de carga)
      if (licenseData.cargoType === undefined || licenseData.cargoType === null || licenseData.cargoType === "") {
        licenseData.cargoType = isPrancha ? "indivisible_cargo" : "dry_cargo";
        console.log(`Aplicando valor padrão para tipo de carga: ${licenseData.cargoType}`);
      }
      
      // Garantir que os campos obrigatórios sejam enviados corretamente para o banco de dados
      // Conversão explícita de tipos para evitar problemas de nulos
      const sanitizedData = {
        ...licenseData,
        width: licenseData.width !== undefined ? Number(licenseData.width) : null,
        height: licenseData.height !== undefined ? Number(licenseData.height) : null,
        cargoType: licenseData.cargoType || null,
        requestNumber,
        isDraft: false,
      };
      
      console.log('Creating license request with data:', JSON.stringify(sanitizedData, null, 2));
      console.log('=== DADOS PARA O BANCO ===');
      console.log('ESTADOS SENDO ENVIADOS PARA O BANCO:', sanitizedData.states);
      console.log('Dados sanitizados completos:', JSON.stringify(sanitizedData, null, 2));
      
      // Validação removida - será feita no frontend ao selecionar estados

      const licenseRequest = await storage.createLicenseRequest(userId, sanitizedData);
      
      console.log('=== RESULTADO DO BANCO ===');
      console.log('License request saved to database:', JSON.stringify(licenseRequest, null, 2));
      console.log('ESTADOS SALVOS NO BANCO:', licenseRequest.states);
      console.log('Comparação - Enviado vs Salvo:', {
        enviado: sanitizedData.states,
        salvo: licenseRequest.states,
        iguais: JSON.stringify(sanitizedData.states) === JSON.stringify(licenseRequest.states)
      });
      
      // Criar registros individuais para cada estado na nova tabela state_licenses
      
      try {
        for (const state of sanitizedData.states) {
          await db.insert(stateLicenses).values({
            licenseRequestId: licenseRequest.id,
            state: state,
            status: 'pending_registration',
            comments: licenseRequest.comments || null,
            selectedCnpj: null, // Será preenchido quando aprovado
            licenseFileUrl: null, // Será preenchido quando aprovado
            aetNumber: null, // Será preenchido quando aprovado
            issuedAt: null, // Será preenchido quando aprovado
            validUntil: null, // Será preenchido quando aprovado
          });
          console.log(`[NOVA ABORDAGEM] Registro criado para estado: ${state}`);
        }
        console.log(`[NOVA ABORDAGEM] Todos os ${sanitizedData.states.length} registros de estado criados com sucesso`);
      } catch (error) {
        console.error('[NOVA ABORDAGEM] Erro ao criar registros de estado:', error);
        // Não falhar a criação da licença principal se houver erro nos registros de estado
      }
      
      // Enviar notificação WebSocket para nova licença criada
      broadcastLicenseUpdate(licenseRequest.id, 'created', licenseRequest);
      broadcastDashboardUpdate();
      
      res.json(licenseRequest);
    } catch (error: any) {
      console.error('Error submitting license request:', error);
      res.status(500).json({ message: 'Erro ao enviar solicitação de licença', error: String(error) });
    }
  });

  // Renovar licença para um estado específico
  app.post('/api/licenses/renew', requireAuth, async (req, res) => {
    try {
      const { licenseId, state } = req.body;
      
      if (!licenseId || !state) {
        return res.status(400).json({ message: 'ID da licença e estado são obrigatórios' });
      }
      
      const userId = req.user!.id;
      
      // Verificar se a licença existe
      const originalLicense = await storage.getLicenseRequestById(licenseId);
      if (!originalLicense) {
        return res.status(404).json({ message: 'Pedido de licença não encontrado' });
      }
      
      // Verificar se o usuário é o dono da licença ou tem papel administrativo
      if (originalLicense.userId !== userId && !isAdminUser(req.user!)) {
        return res.status(403).json({ message: 'Você não tem permissão para renovar esta licença' });
      }
      
      // Verificar se o estado está presente na licença original
      if (!originalLicense.states.includes(state)) {
        return res.status(400).json({ message: `O estado ${state} não faz parte da licença original` });
      }
      
      // Gerar número de pedido baseado no ano atual
      const requestNumber = `AET-${new Date().getFullYear()}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
      
      // Criar um novo rascunho baseado na licença original, mas apenas com o estado escolhido
      // Aqui, precisamos garantir que os campos opcionais sejam tratados corretamente
      const draftData: any = {
        transporterId: originalLicense.transporterId || null,
        mainVehiclePlate: originalLicense.mainVehiclePlate,
        length: originalLicense.length || 0,
        type: originalLicense.type,
        // Valores padrão para campos opcionais
        width: originalLicense.width || (originalLicense.type === "flatbed" ? 320 : 260),
        height: originalLicense.height || (originalLicense.type === "flatbed" ? 495 : 440),
        cargoType: originalLicense.cargoType || (originalLicense.type === "flatbed" ? "indivisible_cargo" : "dry_cargo"),
        // Incluir apenas o estado específico sendo renovado
        states: [state],
        requestNumber,
        isDraft: true,
        comments: `Renovação da licença ${originalLicense.requestNumber} para o estado ${state}`,
      };
      
      // Copiar campos de referência de veículos somente se existirem
      if (originalLicense.tractorUnitId) draftData.tractorUnitId = originalLicense.tractorUnitId;
      if (originalLicense.firstTrailerId) draftData.firstTrailerId = originalLicense.firstTrailerId;
      if (originalLicense.dollyId) draftData.dollyId = originalLicense.dollyId;
      if (originalLicense.secondTrailerId) draftData.secondTrailerId = originalLicense.secondTrailerId; 
      if (originalLicense.flatbedId) draftData.flatbedId = originalLicense.flatbedId;
      
      // Garantir que arrays existam ou sejam vazios
      draftData.additionalPlates = originalLicense.additionalPlates || [];
      draftData.additionalPlatesDocuments = originalLicense.additionalPlatesDocuments || [];
      
      // Logar os dados que serão enviados para criar o rascunho
      console.log("[RENOVAÇÃO] Criando rascunho com os seguintes dados:", JSON.stringify(draftData, null, 2));
      
      // Criar o novo rascunho
      const newDraft = await storage.createLicenseDraft(userId, draftData);
      
      // Logar o rascunho criado
      console.log("[RENOVAÇÃO] Rascunho criado com sucesso:", JSON.stringify(newDraft, null, 2));
      
      // Enviar atualização WebSocket para notificar criação do rascunho de renovação
      broadcastLicenseUpdate(newDraft.id, 'DRAFT_CREATED', newDraft);
      
      // Responder com o novo rascunho criado
      res.status(201).json({
        message: `Licença renovada com sucesso para o estado ${state}`,
        draft: newDraft
      });
    } catch (error) {
      console.error('Error renewing license:', error);
      
      // Logar os detalhes para diagnóstico
      if (error instanceof Error) {
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
      }
      
      // Verificar se é um erro conhecido e fornecer mensagem mais específica
      const errorMessage = error instanceof Error 
        ? `Erro ao renovar licença: ${error.message}`
        : 'Erro ao renovar licença';
      
      res.status(500).json({ message: errorMessage });
    }
  });

  // ENDPOINT DE VALIDAÇÃO CRÍTICA PARA TODOS OS ESTADOS BRASILEIROS - PRODUÇÃO
  app.post('/api/validacao-critica', requireAuth, async (req, res) => {
    try {
      // Performance: Log de validação removido
      
      const { estado, placas } = req.body;
      
      // Lista completa de estados brasileiros + órgãos federais para validação
      const estadosValidos = [
        'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 
        'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 
        'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
        'DNIT', 'ANTT', 'PRF'  // Órgãos federais
      ];
      
      // Validação robusta de entrada
      if (!estado || !estadosValidos.includes(estado.toUpperCase())) {
        // Performance: Log removido
        return res.status(400).json({ 
          bloqueado: false, 
          error: 'Estado inválido ou não suportado',
          estadosValidos: estadosValidos 
        });
      }
      
      if (!placas || !Array.isArray(placas) || placas.length === 0) {
        // Performance: Log removido
        return res.status(400).json({ 
          bloqueado: false, 
          error: 'Lista de placas é obrigatória e deve conter ao menos uma placa',
          recebido: { estado, placas }
        });
      }

      // Normalizar estado para maiúsculo
      const estadoNormalizado = estado.toUpperCase();
      
      // Normalizar e filtrar placas válidas
      const placasNormalizadas = placas
        .map(placa => typeof placa === 'string' ? placa.trim().toUpperCase() : '')
        .filter(placa => placa.length >= 6); // Placas brasileiras têm pelo menos 6 caracteres

      if (placasNormalizadas.length === 0) {
        // Performance: Log removido
        return res.json({ bloqueado: false });
      }

      // Performance: Log removido

      // Query SQL otimizada com múltiplos campos de placas e validação robusta
      const query = `
        SELECT 
          numero_licenca,
          data_validade,
          data_emissao,
          placa_unidade_tratora,
          placa_primeira_carreta,
          placa_segunda_carreta,
          placa_dolly,
          placa_prancha,
          placa_reboque,
          status,
          EXTRACT(DAY FROM (data_validade - CURRENT_DATE)) as dias_restantes,
          EXTRACT(DAY FROM (CURRENT_DATE - data_emissao)) as dias_desde_emissao
        FROM licencas_emitidas 
        WHERE UPPER(estado) = $1 
          AND status = 'ativa'
          AND data_validade > CURRENT_DATE
          AND (
            UPPER(placa_unidade_tratora) = ANY($2::text[]) OR
            UPPER(placa_primeira_carreta) = ANY($2::text[]) OR
            UPPER(placa_segunda_carreta) = ANY($2::text[]) OR
            UPPER(placa_dolly) = ANY($2::text[]) OR
            UPPER(placa_prancha) = ANY($2::text[]) OR
            UPPER(placa_reboque) = ANY($2::text[])
          )
        ORDER BY data_validade DESC, data_emissao DESC
        LIMIT 1
      `;
      
      console.log(`[VALIDAÇÃO CRÍTICA] Executando validação para estado ${estadoNormalizado}`);
      const result = await pool.query(query, [estadoNormalizado, placasNormalizadas]);
      
      console.log(`[VALIDAÇÃO CRÍTICA] Consulta executada. Registros encontrados: ${result.rows.length}`);
      
      if (result.rows.length > 0) {
        const licenca = result.rows[0];
        const dias = Math.floor(parseFloat(licenca.dias_restantes));
        const diasDesdeEmissao = Math.floor(parseFloat(licenca.dias_desde_emissao));
        
        console.log(`[VALIDAÇÃO CRÍTICA] ${estadoNormalizado}: Licença ${licenca.numero_licenca}`);
        console.log(`[VALIDAÇÃO CRÍTICA] Dias restantes: ${dias}, Status: ${licenca.status}`);
        console.log(`[VALIDAÇÃO CRÍTICA] Emitida há: ${diasDesdeEmissao} dias`);
        
        // Aplicar regra dos 60 dias
        if (dias > 60) {
          console.log(`[VALIDAÇÃO CRÍTICA] ❌ ${estadoNormalizado} BLOQUEADO - ${dias} dias > 60`);
          
          // Coletar todas as placas da licença para informar o usuário
          const placasLicenca = [
            licenca.placa_unidade_tratora,
            licenca.placa_primeira_carreta, 
            licenca.placa_segunda_carreta,
            licenca.placa_dolly,
            licenca.placa_prancha,
            licenca.placa_reboque
          ].filter(Boolean);
          
          return res.json({
            bloqueado: true,
            numero: licenca.numero_licenca,
            validade: licenca.data_validade,
            emissao: licenca.data_emissao,
            diasRestantes: dias,
            diasDesdeEmissao: diasDesdeEmissao,
            placasConflitantes: placasLicenca,
            estado: estadoNormalizado,
            motivo: `Licença vigente com ${dias} dias restantes (> 60 dias)`
          });
        } else {
          console.log(`[VALIDAÇÃO CRÍTICA] ⚠️ ${estadoNormalizado} PERMITIDO - ${dias} dias ≤ 60 (renovação)`);
        }
      }
      
      console.log(`[VALIDAÇÃO CRÍTICA] ✅ ${estadoNormalizado} LIBERADO - Sem licenças vigentes conflitantes`);
      return res.json({ 
        bloqueado: false,
        estado: estadoNormalizado,
        placasVerificadas: placasNormalizadas.length,
        motivo: 'Nenhuma licença vigente encontrada para as placas informadas'
      });
      
    } catch (error) {
      console.error('[VALIDAÇÃO CRÍTICA] ❌ ERRO CRÍTICO:', error);
      console.error('[VALIDAÇÃO CRÍTICA] Stack trace:', (error as Error).stack);
      
      return res.status(500).json({ 
        bloqueado: false, // Em caso de erro, liberar para não bloquear o usuário
        error: 'Erro interno na validação - liberando por segurança',
        timestamp: new Date().toISOString(),
        details: (error as Error).message 
      });
    }
  });

  // ✅ ENDPOINT ESPECÍFICO PARA VALIDAÇÃO POR COMBINAÇÃO COMPLETA
  app.post('/api/licencas-vigentes-by-combination', requireAuth, async (req, res) => {
    try {
      const { estado, composicao } = req.body;
      
      if (!estado) {
        return res.status(400).json({ message: 'Estado é obrigatório' });
      }
      
      if (!composicao || !composicao.cavalo || !composicao.carreta1) {
        return res.status(400).json({ message: 'Composição mínima é obrigatória (cavalo, carreta1)' });
      }
      
      // Identificar tipo de composição
      const isBitrem = composicao.carreta2 && !composicao.dolly;
      const isRodotrem = composicao.dolly && composicao.carreta2;
      const isSimples = !composicao.carreta2 && !composicao.dolly; // Apenas cavalo + carreta1
      const isDollyOnly = composicao.dolly && !composicao.carreta2; // Cavalo + carreta1 + dolly (sem carreta2)
      
      console.log(`[VALIDAÇÃO COMBINAÇÃO] Tipo detectado - Bitrem: ${isBitrem}, Rodotrem: ${isRodotrem}, Simples: ${isSimples}, DollyOnly: ${isDollyOnly}`);
      
      console.log(`[VALIDAÇÃO COMBINAÇÃO] Verificando composição específica no estado: ${estado}`);
      
      let query: string;
      let queryParams: any[];
      
      if (isBitrem) {
        console.log(`[VALIDAÇÃO COMBINAÇÃO] Composição BITREM: ${composicao.cavalo} + ${composicao.carreta1} + ${composicao.carreta2}`);
        
        // Query para bitrem (cavalo + carreta1 + carreta2, SEM dolly)
        query = `
          SELECT 
            le.estado, le.numero_licenca, le.data_validade,
            le.placa_unidade_tratora, le.placa_primeira_carreta, 
            le.placa_segunda_carreta, le.placa_dolly,
            EXTRACT(DAY FROM (le.data_validade - CURRENT_DATE)) as dias_restantes
          FROM licencas_emitidas le
          WHERE le.estado = $1 AND le.status = 'ativa' AND le.data_validade > CURRENT_DATE
            AND UPPER(le.placa_unidade_tratora) = UPPER($2)
            AND UPPER(le.placa_primeira_carreta) = UPPER($3)
            AND UPPER(le.placa_segunda_carreta) = UPPER($4)
            AND (le.placa_dolly IS NULL OR le.placa_dolly = '')
          ORDER BY le.data_validade DESC LIMIT 1
        `;
        queryParams = [estado, composicao.cavalo, composicao.carreta1, composicao.carreta2];
        
      } else if (isRodotrem) {
        console.log(`[VALIDAÇÃO COMBINAÇÃO] Composição RODOTREM: ${composicao.cavalo} + ${composicao.carreta1} + ${composicao.dolly} + ${composicao.carreta2}`);
        
        // Query para rodotrem (cavalo + carreta1 + dolly + carreta2)
        query = `
          SELECT 
            le.estado, le.numero_licenca, le.data_validade,
            le.placa_unidade_tratora, le.placa_primeira_carreta, 
            le.placa_segunda_carreta, le.placa_dolly,
            EXTRACT(DAY FROM (le.data_validade - CURRENT_DATE)) as dias_restantes
          FROM licencas_emitidas le
          WHERE le.estado = $1 AND le.status = 'ativa' AND le.data_validade > CURRENT_DATE
            AND UPPER(le.placa_unidade_tratora) = UPPER($2)
            AND UPPER(le.placa_primeira_carreta) = UPPER($3)
            AND UPPER(le.placa_dolly) = UPPER($4)
            AND UPPER(le.placa_segunda_carreta) = UPPER($5)
          ORDER BY le.data_validade DESC LIMIT 1
        `;
        queryParams = [estado, composicao.cavalo, composicao.carreta1, composicao.dolly, composicao.carreta2];
        
      } else if (isSimples) {
        console.log(`[VALIDAÇÃO COMBINAÇÃO] Composição SIMPLES: ${composicao.cavalo} + ${composicao.carreta1}`);
        
        // Query para composição simples (apenas cavalo + carreta1)
        query = `
          SELECT 
            le.estado, le.numero_licenca, le.data_validade,
            le.placa_unidade_tratora, le.placa_primeira_carreta, 
            le.placa_segunda_carreta, le.placa_dolly,
            EXTRACT(DAY FROM (le.data_validade - CURRENT_DATE)) as dias_restantes
          FROM licencas_emitidas le
          WHERE le.estado = $1 AND le.status = 'ativa' AND le.data_validade > CURRENT_DATE
            AND UPPER(le.placa_unidade_tratora) = UPPER($2)
            AND UPPER(le.placa_primeira_carreta) = UPPER($3)
            AND (le.placa_segunda_carreta IS NULL OR le.placa_segunda_carreta = '')
            AND (le.placa_dolly IS NULL OR le.placa_dolly = '')
          ORDER BY le.data_validade DESC LIMIT 1
        `;
        queryParams = [estado, composicao.cavalo, composicao.carreta1];
        
      } else if (isDollyOnly) {
        console.log(`[VALIDAÇÃO COMBINAÇÃO] Composição DOLLY ONLY: ${composicao.cavalo} + ${composicao.carreta1} + ${composicao.dolly}`);
        
        // Query para cavalo + carreta1 + dolly (sem carreta2)
        query = `
          SELECT 
            le.estado, le.numero_licenca, le.data_validade,
            le.placa_unidade_tratora, le.placa_primeira_carreta, 
            le.placa_segunda_carreta, le.placa_dolly,
            EXTRACT(DAY FROM (le.data_validade - CURRENT_DATE)) as dias_restantes
          FROM licencas_emitidas le
          WHERE le.estado = $1 AND le.status = 'ativa' AND le.data_validade > CURRENT_DATE
            AND UPPER(le.placa_unidade_tratora) = UPPER($2)
            AND UPPER(le.placa_primeira_carreta) = UPPER($3)
            AND UPPER(le.placa_dolly) = UPPER($4)
            AND (le.placa_segunda_carreta IS NULL OR le.placa_segunda_carreta = '')
          ORDER BY le.data_validade DESC LIMIT 1
        `;
        queryParams = [estado, composicao.cavalo, composicao.carreta1, composicao.dolly];
        
      } else {
        return res.status(400).json({ 
          message: 'Tipo de composição não reconhecido. Use: bitrem, rodotrem, simples ou dolly apenas.' 
        });
      }
      
      const result = await pool.query(query, queryParams);
      
      if (result.rows.length > 0) {
        const license = result.rows[0];
        const daysUntilExpiry = parseInt(license.dias_restantes);
        
        console.log(`[VALIDAÇÃO COMBINAÇÃO] 🚫 COMBINAÇÃO IDÊNTICA ENCONTRADA: ${license.numero_licenca} - ${daysUntilExpiry} dias restantes`);
        
        if (daysUntilExpiry > 60) {
          console.log(`[VALIDAÇÃO COMBINAÇÃO] Estado ${estado} BLOQUEADO: ${daysUntilExpiry} dias > 60 - COMBINAÇÃO IDÊNTICA`);
          return res.json({
            bloqueado: true,
            estado: estado,
            numero_licenca: license.numero_licenca,
            data_validade: license.data_validade,
            diasRestantes: daysUntilExpiry,
            tipo_bloqueio: 'combinacao_identica',
            composicao_encontrada: {
              cavalo: license.placa_unidade_tratora,
              carreta1: license.placa_primeira_carreta,
              carreta2: license.placa_segunda_carreta,
              dolly: license.placa_dolly || null
            },
            message: (() => {
              if (isRodotrem) return `Combinação rodotrem idêntica encontrada na licença ${license.numero_licenca} (${daysUntilExpiry} dias restantes)`;
              if (isBitrem) return `Combinação bitrem idêntica encontrada na licença ${license.numero_licenca} (${daysUntilExpiry} dias restantes)`;
              if (isSimples) return `Combinação simples idêntica encontrada na licença ${license.numero_licenca} (${daysUntilExpiry} dias restantes)`;
              if (isDollyOnly) return `Combinação com dolly idêntica encontrada na licença ${license.numero_licenca} (${daysUntilExpiry} dias restantes)`;
              return `Combinação idêntica encontrada na licença ${license.numero_licenca} (${daysUntilExpiry} dias restantes)`;
            })()
          });
        } else {
          console.log(`[VALIDAÇÃO COMBINAÇÃO] Estado ${estado} LIBERADO: ${daysUntilExpiry} dias ≤ 60 - PODE RENOVAR`);
          return res.json({
            bloqueado: false,
            estado: estado,
            numero_licenca: license.numero_licenca,
            data_validade: license.data_validade,
            diasRestantes: daysUntilExpiry,
            tipo_liberacao: 'renovacao_permitida',
            message: `Combinação idêntica encontrada mas pode renovar (${daysUntilExpiry} dias restantes ≤ 60)`
          });
        }
      }
      
      console.log(`[VALIDAÇÃO COMBINAÇÃO] ✅ Estado ${estado} LIBERADO - Combinação específica não encontrada`);
      return res.json({
        bloqueado: false,
        estado: estado,
        tipo_liberacao: 'combinacao_diferente',
        message: `Combinação específica não encontrada no estado ${estado} - nova configuração permitida`
      });
      
    } catch (error: any) {
      console.error('[VALIDAÇÃO COMBINAÇÃO] ❌ ERRO:', error);
      return res.status(500).json({ 
        bloqueado: false, // Em caso de erro, liberar para não bloquear o usuário
        error: 'Erro na validação por combinação - liberando por segurança',
        details: error.message 
      });
    }
  });

  // ENDPOINT ESPECÍFICO POR ESTADO - VALIDAÇÃO DE COMBINAÇÃO COMPLETA
  app.post('/api/licencas-vigentes-by-state', requireAuth, async (req, res) => {
    try {
      const { estado, placas, composicao } = req.body;
      
      if (!estado) {
        return res.status(400).json({ message: 'Estado é obrigatório' });
      }
      
      // Nova lógica: verificar se foi fornecida a composição completa
      if (composicao && composicao.cavalo && composicao.carreta1 && composicao.carreta2) {
        console.log(`[VALIDAÇÃO COMBINAÇÃO] Verificando composição específica no estado: ${estado}`);
        console.log(`[VALIDAÇÃO COMBINAÇÃO] Cavalo: ${composicao.cavalo}, Carreta1: ${composicao.carreta1}, Carreta2: ${composicao.carreta2}`);
        
        // Query para verificar se a combinação EXATA já existe
        const queryComposicao = `
          SELECT 
            le.estado,
            le.numero_licenca,
            le.data_validade,
            le.placa_unidade_tratora,
            le.placa_primeira_carreta,
            le.placa_segunda_carreta,
            EXTRACT(DAY FROM (le.data_validade - CURRENT_DATE)) as dias_restantes
          FROM licencas_emitidas le
          WHERE le.estado = $1 
            AND le.status = 'ativa'
            AND le.data_validade > CURRENT_DATE
            AND UPPER(le.placa_unidade_tratora) = UPPER($2)
            AND UPPER(le.placa_primeira_carreta) = UPPER($3)
            AND UPPER(le.placa_segunda_carreta) = UPPER($4)
          ORDER BY le.data_validade DESC
          LIMIT 1
        `;
        
        const result = await pool.query(queryComposicao, [
          estado, 
          composicao.cavalo, 
          composicao.carreta1, 
          composicao.carreta2
        ]);
        
        if (result.rows.length > 0) {
          const license = result.rows[0];
          const daysUntilExpiry = parseInt(license.dias_restantes);
          
          console.log(`[VALIDAÇÃO COMBINAÇÃO] Combinação EXATA encontrada: ${license.numero_licenca} - ${daysUntilExpiry} dias restantes`);
          
          if (daysUntilExpiry > 60) {
            console.log(`[VALIDAÇÃO COMBINAÇÃO] Estado ${estado} BLOQUEADO: combinação específica com ${daysUntilExpiry} dias > 60`);
            return res.json({
              bloqueado: true,
              numero_licenca: license.numero_licenca,
              data_validade: license.data_validade,
              diasRestantes: daysUntilExpiry,
              tipo_bloqueio: 'combinacao_exata',
              composicao_conflitante: {
                cavalo: license.placa_unidade_tratora,
                carreta1: license.placa_primeira_carreta,
                carreta2: license.placa_segunda_carreta
              },
              message: `Combinação específica (${composicao.cavalo} + ${composicao.carreta1} + ${composicao.carreta2}) já possui licença vigente`
            });
          } else {
            console.log(`[VALIDAÇÃO COMBINAÇÃO] Estado ${estado} LIBERADO: combinação pode ser renovada (${daysUntilExpiry} dias ≤ 60)`);
            return res.json({
              bloqueado: false,
              diasRestantes: daysUntilExpiry,
              message: `Combinação pode ser renovada - restam ${daysUntilExpiry} dias`
            });
          }
        } else {
          console.log(`[VALIDAÇÃO COMBINAÇÃO] Estado ${estado} LIBERADO: combinação específica não encontrada`);
          return res.json({
            bloqueado: false,
            tipo_liberacao: 'combinacao_diferente',
            message: 'Combinação específica não possui licença vigente - pode solicitar'
          });
        }
      }
      
      // Fallback para lógica antiga (compatibilidade)
      if (!placas || !Array.isArray(placas) || placas.length === 0) {
        return res.status(400).json({ message: 'Placas ou composição são obrigatórias' });
      }
      
      console.log(`[VALIDAÇÃO BY STATE] Verificando estado: ${estado} com placas: ${placas.join(', ')}`);
      
      const query = `
        SELECT 
          le.estado,
          le.numero_licenca,
          le.data_validade,
          le.placa_unidade_tratora,
          le.placa_primeira_carreta,
          le.placa_segunda_carreta,
          EXTRACT(DAY FROM (le.data_validade - CURRENT_DATE)) as dias_restantes
        FROM licencas_emitidas le
        WHERE le.estado = $1 
          AND le.status = 'ativa'
          AND le.data_validade > CURRENT_DATE
          AND (
            le.placa_unidade_tratora = ANY($2::text[]) OR
            le.placa_primeira_carreta = ANY($2::text[]) OR
            le.placa_segunda_carreta = ANY($2::text[])
          )
        ORDER BY le.data_validade DESC
        LIMIT 1
      `;
      
      const result = await pool.query(query, [estado, placas]);
      
      if (result.rows.length > 0) {
        const license = result.rows[0];
        const daysUntilExpiry = parseInt(license.dias_restantes);
        
        console.log(`[VALIDAÇÃO BY STATE] Licença encontrada: ${license.numero_licenca} - ${daysUntilExpiry} dias restantes`);
        
        if (daysUntilExpiry > 60) {
          console.log(`[VALIDAÇÃO BY STATE] Estado ${estado} BLOQUEADO: ${daysUntilExpiry} dias > 60`);
          return res.json({
            bloqueado: true,
            numero_licenca: license.numero_licenca,
            data_validade: license.data_validade,
            diasRestantes: daysUntilExpiry,
            placas: {
              tratora: license.placa_unidade_tratora,
              primeira: license.placa_primeira_carreta,
              segunda: license.placa_segunda_carreta
            }
          });
        } else {
          console.log(`[VALIDAÇÃO BY STATE] Estado ${estado} LIBERADO: ${daysUntilExpiry} dias ≤ 60`);
          return res.json({
            bloqueado: false,
            diasRestantes: daysUntilExpiry,
            message: `Pode renovar - restam ${daysUntilExpiry} dias`
          });
        }
      } else {
        console.log(`[VALIDAÇÃO BY STATE] Estado ${estado} LIBERADO: nenhuma licença ativa encontrada`);
        return res.json({
          bloqueado: false,
          message: 'Nenhuma licença vigente encontrada'
        });
      }
      
    } catch (error) {
      console.error('[VALIDAÇÃO BY STATE] Erro:', error);
      res.status(500).json({ 
        message: 'Erro ao verificar licenças vigentes',
        error: String(error)
      });
    }
  });

  // VALIDAÇÃO DEFINITIVA - BLOQUEIA PEDIDOS DUPLICADOS E EVITA CUSTOS
  app.post('/api/licenses/check-existing', requireAuth, async (req, res) => {
    try {
      const { states, plates, composicao } = req.body;
      
      if (!states || !Array.isArray(states) || states.length === 0) {
        return res.status(400).json({ message: 'Estados são obrigatórios' });
      }
      
      if (!plates || !Array.isArray(plates) || plates.length === 0) {
        return res.status(400).json({ message: 'Placas são obrigatórias' });
      }
      
      console.log(`[VALIDAÇÃO DEFINITIVA] Verificando conflitos para estados: ${states.join(', ')} e placas: ${plates.join(', ')}`);
      
      // Nova lógica: se composição for fornecida, usar validação específica
      if (composicao && composicao.cavalo && composicao.carreta1 && composicao.carreta2) {
        console.log(`[VALIDAÇÃO DEFINITIVA] Usando validação por combinação específica:`, composicao);
      }
      
      const conflicts = [];
      
      // Para cada estado, verificar licenças ativas na tabela licencas_emitidas
      for (const state of states) {
        console.log(`[VALIDAÇÃO DEFINITIVA] Verificando estado: ${state}`);
        
        let query: string;
        let queryParams: any[];
        
        // Escolher query baseada na presença de composição
        if (composicao && composicao.cavalo && composicao.carreta1 && composicao.carreta2) {
          // Query para combinação específica
          query = `
            SELECT 
              le.estado,
              le.numero_licenca,
              le.data_validade,
              le.placa_unidade_tratora,
              le.placa_primeira_carreta,
              le.placa_segunda_carreta,
              le.pedido_id,
              EXTRACT(DAY FROM (le.data_validade - CURRENT_DATE)) as dias_restantes
            FROM licencas_emitidas le
            WHERE le.estado = $1 
              AND le.status = 'ativa'
              AND le.data_validade > CURRENT_DATE
              AND UPPER(le.placa_unidade_tratora) = UPPER($2)
              AND UPPER(le.placa_primeira_carreta) = UPPER($3)
              AND UPPER(le.placa_segunda_carreta) = UPPER($4)
          `;
          queryParams = [state, composicao.cavalo, composicao.carreta1, composicao.carreta2];
          console.log(`[VALIDAÇÃO DEFINITIVA] Verificando combinação específica: ${composicao.cavalo} + ${composicao.carreta1} + ${composicao.carreta2}`);
        } else {
          // Query original para qualquer placa
          query = `
            SELECT 
              le.estado,
              le.numero_licenca,
              le.data_validade,
              le.placa_unidade_tratora,
              le.placa_primeira_carreta,
              le.placa_segunda_carreta,
              le.pedido_id,
              EXTRACT(DAY FROM (le.data_validade - CURRENT_DATE)) as dias_restantes
            FROM licencas_emitidas le
            WHERE le.estado = $1 
              AND le.status = 'ativa'
              AND le.data_validade > CURRENT_DATE
              AND (
                le.placa_unidade_tratora = ANY($2::text[]) OR
                le.placa_primeira_carreta = ANY($2::text[]) OR
                le.placa_segunda_carreta = ANY($2::text[])
              )
          `;
          queryParams = [state, plates];
        }
        
        const result = await pool.query(query, queryParams);
        
        console.log(`[VALIDAÇÃO DEFINITIVA] Estado ${state}: encontradas ${result.rows.length} licenças ativas`);
        
        for (const license of result.rows) {
          const daysUntilExpiry = parseInt(license.dias_restantes);
          console.log(`[VALIDAÇÃO DEFINITIVA] Licença ${license.numero_licenca}: ${daysUntilExpiry} dias restantes`);
          
          // REGRA CRÍTICA: bloquear se tiver mais de 60 dias para evitar custos
          if (daysUntilExpiry > 60) {
            const tipoValidacao = composicao ? 'combinação específica' : 'placas individuais';
            console.log(`[VALIDAÇÃO DEFINITIVA] Estado ${state} BLOQUEADO: ${daysUntilExpiry} dias > 60 - EVITANDO CUSTO DESNECESSÁRIO (${tipoValidacao})`);
            conflicts.push({
              state: state,
              licenseNumber: license.numero_licenca,
              expiryDate: license.data_validade,
              daysUntilExpiry: daysUntilExpiry,
              tipoValidacao: tipoValidacao,
              conflictingPlates: [
                license.placa_unidade_tratora,
                license.placa_primeira_carreta,
                license.placa_segunda_carreta
              ].filter(Boolean),
              canRenew: false
            });
          } else {
            console.log(`[VALIDAÇÃO DEFINITIVA] Estado ${state} LIBERADO: ${daysUntilExpiry} dias ≤ 60 - PODE RENOVAR`);
          }
        }
      }
      
      console.log(`[VALIDAÇÃO DEFINITIVA] Total de conflitos encontrados: ${conflicts.length}`);
      
      res.json({
        hasConflicts: conflicts.length > 0,
        conflicts,
        message: conflicts.length > 0 
          ? `Encontrados ${conflicts.length} conflito(s) em licenças vigentes`
          : 'Nenhum conflito encontrado'
      });
      
    } catch (error) {
      console.error('[VALIDAÇÃO DEFINITIVA] Erro ao verificar licenças existentes:', error);
      res.status(500).json({ 
        message: 'Erro ao verificar licenças existentes',
        error: String(error)
      });
    }
  });

  // Endpoint para sincronizar todas as licenças aprovadas
  app.post('/api/admin/sync-approved-licenses', requireAuth, async (req, res) => {
    try {
      const user = req.user!;
      if (!isAdminUser(user)) {
        return res.status(403).json({ message: 'Acesso negado' });
      }

      console.log('Iniciando sincronização de licenças aprovadas...');

      // Buscar todas as licenças com estados aprovados
      const query = `
        SELECT 
          lr.id,
          lr.main_vehicle_plate,
          lr.additional_plates,
          lr.tractor_unit_id,
          lr.first_trailer_id,
          lr.second_trailer_id,
          lr.dolly_id,
          lr.flatbed_id,
          UNNEST(string_to_array(unnest(lr.state_statuses), ':')) as state_data
        FROM license_requests lr
        WHERE array_length(lr.state_statuses, 1) > 0
          AND EXISTS (
            SELECT 1 FROM unnest(lr.state_statuses) as status
            WHERE status LIKE '%:approved:%'
          )
      `;

      const result = await pool.query(query);
      let sincronizadas = 0;

      // Processar cada licença aprovada
      for (const row of result.rows) {
        const stateStatuses = row.state_data;
        if (!stateStatuses) continue;

        // Parse do estado e status
        const statusParts = stateStatuses.split(':');
        if (statusParts.length >= 4 && statusParts[1] === 'approved') {
          const estado = statusParts[0];
          const dataValidade = statusParts[2];
          const numeroAet = statusParts[3] || `AET-${estado}-${row.id}`;

          try {
            await sincronizarLicencaEmitida(row, estado, numeroAet, dataValidade);
            sincronizadas++;
          } catch (error) {
            console.error(`Erro ao sincronizar licença ${row.id} estado ${estado}:`, error);
          }
        }
      }

      console.log(`Sincronização concluída: ${sincronizadas} licenças sincronizadas`);

      res.json({
        message: `Sincronização concluída com sucesso`,
        licencasSincronizadas: sincronizadas
      });

    } catch (error) {
      console.error('Erro na sincronização:', error);
      res.status(500).json({ message: 'Erro na sincronização de licenças' });
    }
  });

  app.get('/api/licenses/issued', requireAuth, async (req, res) => {
    try {
      console.log("[DEBUG LICENÇAS EMITIDAS] Início da rota");
      
      const user = req.user!;
      let issuedLicenses = [];
      
      // Se for usuário administrativo, buscar todas as licenças emitidas
      if (isAdminUser(user)) {
        console.log(`Usuário ${user.email} (${user.role}) tem acesso administrativo. Buscando todas as licenças emitidas.`);
        
        // Buscar diretamente no banco se há licenças com estado aprovado
        const licencasNoBanco = await db.select().from(licenseRequests).where(eq(licenseRequests.isDraft, false));
        console.log(`[DEBUG LICENÇAS EMITIDAS] Total de licenças não-rascunho no banco: ${licencasNoBanco.length}`);
        
        // Filtrar licenças com estado aprovado manualmente
        const licencasAprovadas = licencasNoBanco.filter(lic => {
          console.log(`[DEBUG LICENÇAS EMITIDAS] Avaliando licença #${lic.id} - stateStatuses: ${JSON.stringify(lic.stateStatuses)}`);
          
          // Verificar estados aprovados
          const temEstadoAprovado = lic.stateStatuses && 
                                   Array.isArray(lic.stateStatuses) && 
                                   lic.stateStatuses.some(ss => ss.includes(':approved'));
          
          console.log(`[DEBUG LICENÇAS EMITIDAS] Licença #${lic.id} - Tem estado aprovado: ${temEstadoAprovado ? 'SIM' : 'NÃO'}`);
          
          return temEstadoAprovado;
        });
        
        console.log(`[DEBUG LICENÇAS EMITIDAS] Total de licenças filtradas com estado aprovado: ${licencasAprovadas.length}`);
        issuedLicenses = licencasAprovadas;
      } else {
        console.log(`Usuário ${user.email} (${user.role}) tem acesso comum. Buscando apenas suas licenças emitidas.`);
        
        // Para usuários comuns, buscar também diretamente do banco
        // Primeiro, obter os transportadores associados ao usuário
        const userTransporters = await db.select()
          .from(transporters)
          .where(eq(transporters.userId, user.id));
          
        const transporterIds = userTransporters.map(t => t.id);
        console.log(`[DEBUG LICENÇAS EMITIDAS] Transportadores associados ao usuário ${user.id}: ${transporterIds.join(', ')}`);
        
        // Buscar licenças onde o usuário é o dono OU o transportador está associado ao usuário
        let licencasNoBanco = [];
        
        // Se houver transportadores associados, buscar licenças por transporterId também
        if (transporterIds.length > 0) {
          licencasNoBanco = await db.select()
            .from(licenseRequests)
            .where(
              and(
                eq(licenseRequests.isDraft, false),
                or(
                  eq(licenseRequests.userId, user.id),
                  inArray(licenseRequests.transporterId, transporterIds)
                )
              )
            );
            
          console.log(`[DEBUG LICENÇAS EMITIDAS] Encontradas ${licencasNoBanco.length} licenças para usuário ${user.id} ou transportadores ${transporterIds.join(', ')}`);
        } else {
          // Se não houver transportadores, buscar apenas por userId
          licencasNoBanco = await db.select()
            .from(licenseRequests)
            .where(
              and(
                eq(licenseRequests.isDraft, false),
                eq(licenseRequests.userId, user.id)
              )
            );
            
          console.log(`[DEBUG LICENÇAS EMITIDAS] Encontradas ${licencasNoBanco.length} licenças para usuário ${user.id} sem transportadores associados`);
        }
        
        // Filtrar licenças com estado aprovado manualmente
        issuedLicenses = licencasNoBanco.filter((lic: any) => {
          // Verificar estados aprovados
          return lic.stateStatuses && 
                 Array.isArray(lic.stateStatuses) && 
                 lic.stateStatuses.some((ss: string) => ss.includes(':approved'));
        });
        
        console.log(`[DEBUG LICENÇAS EMITIDAS] Total de licenças emitidas para o usuário ${user.id}: ${issuedLicenses.length}`);
      }
      
      // Enriquecer licenças com dados do transportador para exportações CSV
      const allTransporters = await storage.getAllTransporters();
      console.log(`[DEBUG LICENÇAS EMITIDAS] Total transportadores carregados: ${allTransporters.length}`);
      
      const licensesWithTransporter = issuedLicenses.map(license => {
        const transporter = allTransporters.find(t => t.id === license.transporterId);
        console.log(`[DEBUG LICENÇAS EMITIDAS] Licença ${license.id} - transporterId: ${license.transporterId}, encontrado: ${transporter ? transporter.name : 'NÃO ENCONTRADO'}`);
        return {
          ...license,
          transporter: transporter ? {
            id: transporter.id,
            name: transporter.name,
            tradeName: transporter.tradeName,
            documentNumber: transporter.documentNumber
          } : null
        };
      });

      // Log das licenças que serão retornadas
      console.log(`[DEBUG LICENÇAS EMITIDAS] Retornando ${licensesWithTransporter.length} licenças emitidas`);
      console.log(`[DEBUG LICENÇAS EMITIDAS] IDs: ${licensesWithTransporter.map((l: any) => l.id).join(', ')}`);
      
      res.json(licensesWithTransporter);
    } catch (error) {
      console.error('Error fetching issued licenses:', error);
      res.status(500).json({ message: 'Erro ao buscar licenças emitidas' });
    }
  });

  // Upload e importação em lote de licenças/pedidos via CSV
  app.post('/api/admin/licenses/bulk-import', uploadCSV.single('csvFile'), requireAuth, async (req, res) => {
    console.log('[BULK IMPORT DEBUG] Requisição recebida');
    console.log('[BULK IMPORT DEBUG] Headers:', req.headers['content-type']);
    console.log('[BULK IMPORT DEBUG] Body keys:', Object.keys(req.body || {}));
    console.log('[BULK IMPORT DEBUG] File presente:', !!req.file);
    
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ message: "Não autenticado" });
    }

    if (!req.file) {
      console.log('[BULK IMPORT DEBUG] Nenhum arquivo encontrado no req.file');
      console.log('[BULK IMPORT DEBUG] Multer error?:', req.body);
      return res.status(400).json({ 
        message: "Arquivo CSV não encontrado - verifique se o campo do formulário se chama 'csvFile'",
        success: false,
        errors: ["Nenhum arquivo foi enviado ou nome do campo incorreto"]
      });
    }

    console.log(`[BULK LICENSE IMPORT] Iniciando importação de licenças por usuário ${user.email} (role: ${user.role})`);

    try {
      const csvBuffer = req.file.buffer;
      let csvString = csvBuffer.toString('utf-8');
      
      // Remover BOM se presente
      if (csvString.charCodeAt(0) === 0xFEFF) {
        csvString = csvString.substring(1);
      }
      
      // Parse CSV
      const lines = csvString.split('\n').filter(line => line.trim());
      if (lines.length < 2) {
        return res.status(400).json({ 
          message: "Arquivo CSV inválido - deve conter cabeçalho e pelo menos uma linha de dados",
          success: false,
          errors: ["Arquivo vazio ou apenas com cabeçalho"]
        });
      }

      const header = lines[0].split(';').map(col => col.trim());
      
      // Validar colunas obrigatórias
      const requiredColumns = [
        'transportador_cpf_cnpj',
        'tipo_conjunto',
        'cavalo_placa',
        'estados',
        'comprimento',
        'largura',
        'altura',
        'peso_total'
      ];

      const missingColumns = requiredColumns.filter(col => !header.includes(col));
      if (missingColumns.length > 0) {
        return res.status(400).json({
          message: `Colunas obrigatórias ausentes: ${missingColumns.join(', ')}`,
          success: false,
          errors: [`Colunas obrigatórias ausentes: ${missingColumns.join(', ')}`]
        });
      }

      const results = {
        success: true,
        imported: 0,
        errors: [] as string[],
        warnings: [] as string[]
      };

      // Mapeamento de tipos de conjunto (case insensitive)
      const vehicleSetTypeMap: Record<string, string> = {
        'bitrem 6 eixos': 'bitrain_6_axles',
        'bitrem 7 eixos': 'bitrain_7_axles', 
        'bitrem 9 eixos': 'bitrain_9_axles',
        'rodotrem 7 eixos': 'roadtrain_7_axles',
        'rodotrem 9 eixos': 'roadtrain_9_axles',
        'prancha': 'flatbed',
        'romeu e julieta': 'romeo_juliet'
      };

      // Obter todos os transportadores e veículos
      const allTransporters = await storage.getAllTransporters();
      const allVehicles = await storage.getAllVehicles();

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (!line.trim()) continue;

        const data = line.split(';').map(col => col.trim());
        const rowData: Record<string, string> = {};
        
        header.forEach((col, index) => {
          rowData[col] = data[index] || '';
        });

        try {
          // 1. Validar transportador
          if (!rowData.transportador_cpf_cnpj) {
            throw new Error("CPF/CNPJ do transportador é obrigatório");
          }

          const transporterDoc = rowData.transportador_cpf_cnpj.replace(/\D/g, '');
          const transporter = allTransporters.find(t => 
            t.documentNumber?.replace(/\D/g, '') === transporterDoc
          );
          
          if (!transporter) {
            throw new Error(`Transportador não encontrado: ${rowData.transportador_cpf_cnpj}`);
          }

          // 2. Validar tipo de conjunto
          if (!rowData.tipo_conjunto) {
            throw new Error("Tipo de conjunto é obrigatório");
          }
          
          const normalizedType = rowData.tipo_conjunto.toLowerCase().trim();
          const licenseType = vehicleSetTypeMap[normalizedType];
          
          if (!licenseType) {
            throw new Error(`Tipo de conjunto inválido: ${rowData.tipo_conjunto}. Valores aceitos: ${Object.keys(vehicleSetTypeMap).join(', ')}`);
          }

          // 3. Validar veículos obrigatórios
          if (!rowData.cavalo_placa || rowData.cavalo_placa.length < 6) {
            throw new Error("Placa do cavalo inválida (mínimo 6 caracteres)");
          }

          const tractorVehicle = allVehicles.find(v => 
            v.plate.toUpperCase() === rowData.cavalo_placa.toUpperCase()
          );
          
          if (!tractorVehicle) {
            throw new Error(`Veículo cavalo não encontrado: ${rowData.cavalo_placa}`);
          }

          // 4. Validar estados
          if (!rowData.estados) {
            throw new Error("Estados são obrigatórios");
          }

          const states = rowData.estados.split(',').map(s => s.trim()).filter(s => s);
          if (states.length === 0) {
            throw new Error("Pelo menos um estado deve ser informado");
          }

          // 5. Validar dimensões (planilha em metros, BD em centímetros)
          const lengthInMeters = parseFloat(rowData.comprimento?.replace(',', '.') || '0');
          const widthInMeters = parseFloat(rowData.largura?.replace(',', '.') || '0');
          const heightInMeters = parseFloat(rowData.altura?.replace(',', '.') || '0');
          const totalWeight = parseFloat(rowData.peso_total?.replace(',', '.') || '0');

          if (lengthInMeters <= 0 || widthInMeters <= 0 || heightInMeters <= 0 || totalWeight <= 0) {
            throw new Error("Dimensões e peso devem ser valores positivos");
          }

          // Converter de metros para centímetros (como espera o banco de dados)
          const length = Math.round(lengthInMeters * 100); // 25.5m → 2550cm
          const width = Math.round(widthInMeters * 100);   // 2.6m → 260cm
          const height = Math.round(heightInMeters * 100); // 4.4m → 440cm

          // 6. Buscar veículos adicionais baseado no tipo
          let firstTrailerVehicle = null;
          let secondTrailerVehicle = null;
          let dollyVehicle = null;
          let flatbedVehicle = null;

          // Primeira carreta (obrigatória para bitrem e rodotrem)
          if (licenseType.includes('bitrain') || licenseType.includes('roadtrain')) {
            if (!rowData.primeira_carreta_placa) {
              throw new Error("Primeira carreta é obrigatória para este tipo de conjunto");
            }

            firstTrailerVehicle = allVehicles.find(v => 
              v.plate.toUpperCase() === rowData.primeira_carreta_placa.toUpperCase()
            );
            
            if (!firstTrailerVehicle) {
              throw new Error(`Primeira carreta não encontrada: ${rowData.primeira_carreta_placa}`);
            }
          }

          // Segunda carreta (obrigatória para bitrem e rodotrem)
          if (licenseType.includes('bitrain') || licenseType.includes('roadtrain')) {
            if (!rowData.segunda_carreta_placa) {
              throw new Error("Segunda carreta é obrigatória para este tipo de conjunto");
            }

            secondTrailerVehicle = allVehicles.find(v => 
              v.plate.toUpperCase() === rowData.segunda_carreta_placa.toUpperCase()
            );
            
            if (!secondTrailerVehicle) {
              throw new Error(`Segunda carreta não encontrada: ${rowData.segunda_carreta_placa}`);
            }
          }

          // Dolly (obrigatório para rodotrem)
          if (licenseType.includes('roadtrain')) {
            if (!rowData.dolly_placa) {
              throw new Error("Dolly é obrigatório para rodotrem");
            }

            dollyVehicle = allVehicles.find(v => 
              v.plate.toUpperCase() === rowData.dolly_placa.toUpperCase()
            );
            
            if (!dollyVehicle) {
              throw new Error(`Dolly não encontrado: ${rowData.dolly_placa}`);
            }
          }

          // Prancha (obrigatória para prancha)
          if (licenseType === 'flatbed') {
            if (!rowData.prancha_placa) {
              throw new Error("Prancha é obrigatória para este tipo de conjunto");
            }

            flatbedVehicle = allVehicles.find(v => 
              v.plate.toUpperCase() === rowData.prancha_placa.toUpperCase()
            );
            
            if (!flatbedVehicle) {
              throw new Error(`Prancha não encontrada: ${rowData.prancha_placa}`);
            }
          }

          // 7. Verificar licenças existentes para evitar duplicatas
          const existingLicenses = await storage.getAllLicenseRequests();
          const vehicleCombination = [
            tractorVehicle.id,
            firstTrailerVehicle?.id,
            secondTrailerVehicle?.id,
            dollyVehicle?.id,
            flatbedVehicle?.id
          ].filter(Boolean).sort().join('-');

          const existingLicense = existingLicenses.find(license => {
            const licenseCombination = [
              license.tractorUnitId,
              license.firstTrailerId,
              license.secondTrailerId,
              license.dollyId,
              license.flatbedId
            ].filter(Boolean).sort().join('-');
            
            return licenseCombination === vehicleCombination && 
                   license.status !== 'cancelled' &&
                   states.some(state => license.states.includes(state));
          });

          if (existingLicense) {
            results.warnings.push(`Linha ${i + 1}: Já existe licença similar (${existingLicense.requestNumber}) para esta combinação de veículos`);
            continue;
          }

          // 8. Gerar número da licença
          const requestNumber = `AET-${new Date().getFullYear()}-${Math.floor(Math.random() * 10000)}`;

          // 9. Criar a licença
          const newLicense = {
            transporterId: transporter.id,
            type: licenseType,
            mainVehiclePlate: tractorVehicle.plate,
            requestNumber,
            
            // Veículos
            tractorUnitId: tractorVehicle.id,
            firstTrailerId: firstTrailerVehicle?.id,
            secondTrailerId: secondTrailerVehicle?.id,
            dollyId: dollyVehicle?.id,
            flatbedId: flatbedVehicle?.id,
            
            // Dimensões (em centímetros)
            length: length, // Já convertido para cm
            width: width,   // Já convertido para cm
            height: height, // Já convertido para cm
            totalWeight: totalWeight,
            cargoType: 'dry_cargo' as const,
            
            // Campos obrigatórios
            additionalPlates: [],
            additionalPlatesDocuments: [],
            
            // Estados e metadados
            states: states,
            status: 'pending_registration' as const,
            isDraft: false,
            comments: rowData.observacoes || `Importado via planilha em ${new Date().toLocaleString('pt-BR')}`
          };

          await storage.createLicenseRequest(user.id, newLicense);
          results.imported++;

          console.log(`[BULK LICENSE IMPORT] Licença criada: ${newLicense.mainVehiclePlate} - ${licenseType}`);

        } catch (error) {
          const errorMessage = `Linha ${i + 1}: ${error instanceof Error ? error.message : 'Erro desconhecido'}`;
          results.errors.push(errorMessage);
          console.error(`[BULK LICENSE IMPORT] Erro linha ${i + 1}:`, error);
        }
      }

      console.log(`[BULK LICENSE IMPORT] Concluído: ${results.imported} licenças importadas, ${results.errors.length} erros`);

      return res.json({
        message: `Importação concluída: ${results.imported} licenças importadas`,
        ...results
      });

    } catch (error) {
      console.error('[BULK LICENSE IMPORT] Erro geral:', error);
      return res.status(500).json({
        message: "Erro interno do servidor",
        success: false,
        errors: [error instanceof Error ? error.message : 'Erro desconhecido']
      });
    }
  });

  // Endpoint para baixar template da planilha de licenças
  app.get('/api/admin/licenses/bulk-import/template', requireAuth, async (req, res) => {
    const csvHeaders = [
      'transportador_cpf_cnpj',
      'tipo_conjunto',
      'cavalo_placa',
      'primeira_carreta_placa',
      'segunda_carreta_placa',
      'dolly_placa',
      'prancha_placa',
      'estados',
      'comprimento',
      'largura',
      'altura',
      'peso_total',
      'observacoes'
    ];

    const exampleData = [
      '12.345.678/0001-90',
      'Bitrem 9 eixos',
      'ABC1234',
      'DEF5678',
      'GHI9012',
      '',
      '',
      'SP,MG,RJ',
      '25.5',
      '2.6',
      '4.4',
      '74.0',
      'Licença para rota SP-RJ'
    ];

    const csvContent = [
      csvHeaders.join(';'),
      exampleData.join(';')
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="template_importacao_licencas.csv"');
    res.send('\uFEFF' + csvContent); // BOM para UTF-8
  });

  // Endpoint para cadastro em massa de veículos via CSV
  app.post("/api/vehicles/bulk-import", requireAuth, uploadCSV.single('csvFile'), async (req, res) => {
    try {
      const user = req.user!;
      
      console.log('[BULK IMPORT] Iniciando importação:', {
        hasFile: !!req.file,
        fileName: req.file?.originalname,
        fileSize: req.file?.size,
        user: user.email
      });

      if (!req.file) {
        console.log('[BULK IMPORT] Erro: Arquivo não encontrado');
        return res.status(400).json({
          success: false,
          message: "Arquivo CSV é obrigatório"
        });
      }

      const csvContent = req.file.buffer.toString('utf-8');
      console.log('[BULK IMPORT] Conteúdo CSV (primeiros 200 chars):', csvContent.substring(0, 200));
      
      const lines = csvContent.split('\n').filter(line => line.trim());
      console.log('[BULK IMPORT] Número de linhas:', lines.length);
      
      if (lines.length < 2) {
        console.log('[BULK IMPORT] Erro: CSV com menos de 2 linhas');
        return res.status(400).json({
          success: false,
          message: "Arquivo CSV deve conter pelo menos um cabeçalho e uma linha de dados"
        });
      }

      const header = lines[0].split(';').map(col => col.trim());
      console.log('[BULK IMPORT] Header detectado:', header);
      
      const requiredColumns = [
        'placa', 'tipo_veiculo', 'marca', 'modelo', 'ano_fabricacao',
        'ano_crlv', 'renavam', 'cmt', 'tara', 'transportador_cpf_cnpj'
      ];
      const optionalColumns = ['eixo', 'tipo_carroceria']; // Eixo é opcional (padrão 2), tipo_carroceria é opcional

      // Validar se todas as colunas obrigatórias estão presentes
      const missingColumns = requiredColumns.filter(col => !header.includes(col));
      console.log('[BULK IMPORT] Colunas obrigatórias:', requiredColumns);
      console.log('[BULK IMPORT] Colunas faltando:', missingColumns);
      
      if (missingColumns.length > 0) {
        console.log('[BULK IMPORT] Erro: Colunas faltando');
        return res.status(400).json({
          success: false,
          message: `Colunas obrigatórias faltando: ${missingColumns.join(', ')}. Formato esperado: placa;tipo_veiculo;tipo_carroceria;marca;modelo;ano_fabricacao;ano_crlv;renavam;cmt;tara;eixo;transportador_cpf_cnpj`
        });
      }

      const results = { inserted: 0, errors: [] as any[] };
      const validVehicles = [];

      // Mapear tipos de veículo aceitos
      const vehicleTypeMap: Record<string, string> = {
        'Unidade Tratora (Cavalo)': 'tractor_unit',
        'Cavalo Mecânico': 'tractor_unit',
        'Cavalo': 'tractor_unit',
        'Primeira Carreta': 'semi_trailer',
        'Segunda Carreta': 'semi_trailer',
        'Semirreboque': 'semi_trailer',
        'Carreta': 'semi_trailer',
        'Reboque': 'trailer',
        'Dolly': 'dolly',
        'Prancha': 'flatbed',
        'Caminhão': 'truck'
      };

      // Mapear tipos de carroceria aceitos (opcional)
      const bodyTypeMap: Record<string, string> = {
        'Aberta': 'open',
        'Basculante': 'dump',
        'Boiadeiro': 'cattle',
        'Cana de Açúcar': 'sugar_cane',
        'Container': 'container',
        'Fechada': 'closed',
        'Mecânico operacional': 'mechanical_operational',
        'Plataforma': 'platform',
        'Prancha': 'flatbed',
        'Prancha - Cegonha': 'car_carrier',
        'Prancha Extensiva': 'extendable_flatbed',
        'Rodo Caçamba': 'dump_truck',
        'Rollon Rollof': 'roll_on_roll_off',
        'SILO': 'silo',
        'Subestação Móvel': 'mobile_substation',
        'Tanque': 'tank',
        'Tran Toras': 'log_carrier',
        'VTAV': 'vtav'
      };

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (!line.trim()) continue;

        const data = line.split(';').map(col => col.trim());
        const rowData: Record<string, string> = {};
        
        header.forEach((col, index) => {
          rowData[col] = data[index] || '';
        });

        try {
          // Validações
          if (!rowData.placa || rowData.placa.length < 6) {
            throw new Error("Placa inválida (mínimo 6 caracteres)");
          }

          if (!rowData.tipo_veiculo || !vehicleTypeMap[rowData.tipo_veiculo]) {
            throw new Error(`Tipo de veículo inválido: ${rowData.tipo_veiculo}`);
          }

          if (!rowData.transportador_cpf_cnpj) {
            throw new Error("CPF/CNPJ do transportador é obrigatório");
          }

          // Verificar se o transportador existe
          const transporterDoc = rowData.transportador_cpf_cnpj.replace(/\D/g, '');
          const allTransporters = await storage.getAllTransporters();
          const transporter = allTransporters.find(t => 
            t.documentNumber?.replace(/\D/g, '') === transporterDoc
          );
          
          if (!transporter) {
            throw new Error(`Transportador não encontrado: ${rowData.transportador_cpf_cnpj}`);
          }

          // Determinar userId para o veículo baseado no perfil do usuário e vinculação do transportador
          let targetUserId = transporter.userId;
          
          // Se o usuário que está fazendo a importação é administrativo,
          // não vincular veículo a ele, deixar como "Usuário undefined"
          const isAdministrativeUser = isAdminUser(user);
          
          if (!transporter.userId) {
            if (isAdministrativeUser) {
              console.log(`[BULK IMPORT] Transportador ${transporter.name} não possui usuário vinculado. Usuário administrativo ${user.email} - deixando veículo sem vinculação (undefined)`);
              targetUserId = null;
            } else {
              console.log(`[BULK IMPORT] Transportador ${transporter.name} não possui usuário vinculado. Usando usuário da importação: ${user.email}`);
              targetUserId = user.id;
            }
          }

          // Verificar se a placa já existe
          const allVehicles = await storage.getAllVehicles();
          const existingVehicle = allVehicles.find(v => 
            v.plate.toUpperCase() === rowData.placa.toUpperCase()
          );
          
          if (existingVehicle) {
            throw new Error(`Placa já cadastrada: ${rowData.placa}`);
          }

          // Preparar dados do veículo (conforme schema do banco)
          // Usar o userId do transportador ou fallback para o usuário da importação
          
          // Determinar bodyType baseado no tipo_carroceria ou usar valor padrão baseado no tipo do veículo
          let bodyType = null;
          
          console.log(`[BULK IMPORT] Processando tipo_carroceria para ${rowData.placa}: "${rowData.tipo_carroceria}"`);
          
          if (rowData.tipo_carroceria && bodyTypeMap[rowData.tipo_carroceria]) {
            bodyType = bodyTypeMap[rowData.tipo_carroceria];
            console.log(`[BULK IMPORT] Tipo carroceria mapeado: "${rowData.tipo_carroceria}" -> "${bodyType}"`);
          } else {
            // Valores padrão baseados no tipo do veículo se não especificado
            const vehicleType = vehicleTypeMap[rowData.tipo_veiculo];
            if (vehicleType === 'tractor_unit') {
              bodyType = null; // Unidade tratora não tem carroceria
            } else if (vehicleType === 'semi_trailer' || vehicleType === 'trailer') {
              bodyType = 'container'; // Padrão para semirreboques/reboques
            } else if (vehicleType === 'flatbed') {
              bodyType = 'flatbed'; // Prancha
            } else {
              bodyType = 'closed'; // Padrão geral
            }
            console.log(`[BULK IMPORT] Tipo carroceria não especificado/inválido, usando padrão baseado no veículo "${vehicleType}": "${bodyType}"`);
          }
          
          const vehicleData = {
            plate: rowData.placa.toUpperCase(),
            type: vehicleTypeMap[rowData.tipo_veiculo],
            brand: rowData.marca || '',
            model: rowData.modelo || '',
            year: parseInt(rowData.ano_fabricacao) || new Date().getFullYear(),
            crlvYear: parseInt(rowData.ano_crlv) || new Date().getFullYear(),
            renavam: rowData.renavam || '',
            cmt: parseFloat(rowData.cmt) || 0,
            tare: parseFloat(rowData.tara) || 0,
            axleCount: parseInt(rowData.eixo) || 2, // Valor padrão 2 se não informado
            bodyType: bodyType,
            status: 'pending_documents' as any,
            ownershipType: 'proprio' as any,
            transporterUserId: targetUserId // Usar o userId do transportador ou fallback para o usuário da importação
          };

          console.log('[BULK IMPORT] Veículo validado:', vehicleData);
          validVehicles.push(vehicleData);

        } catch (error: any) {
          console.log('[BULK IMPORT] Erro na linha', i + 1, ':', error.message);
          results.errors.push({
            row: i + 1,
            data: rowData,
            error: error.message
          });
        }
      }

      console.log('[BULK IMPORT] Total de veículos válidos:', validVehicles.length);
      console.log('[BULK IMPORT] Erros encontrados:', results.errors.length);

      // Inserir veículos válidos no banco
      for (const vehicleData of validVehicles) {
        try {
          console.log('[BULK IMPORT] Tentando criar veículo:', vehicleData.plate);
          
          // Usar o userId do transportador, não do usuário logado
          const { transporterUserId, ...vehicleDataClean } = vehicleData;
          const cleanVehicleData = {
            ...vehicleDataClean,
            bodyType: vehicleDataClean.bodyType || undefined
          };
          await storage.createVehicle(transporterUserId, cleanVehicleData);
          
          console.log('[BULK IMPORT] Veículo criado com sucesso para transportador:', vehicleData.plate);
          results.inserted++;
          
          // Enviar notificação WebSocket sobre o novo veículo
          broadcastMessage({
            type: 'VEHICLE_UPDATE',
            data: {
              action: 'created',
              vehicleId: null, // Será definido após criação
              message: `Novo veículo importado: ${vehicleData.plate}`
            }
          });
          
        } catch (error: any) {
          console.log('[BULK IMPORT] Erro ao criar veículo:', vehicleData.plate, error.message);
          results.errors.push({
            row: 0,
            data: vehicleData,
            error: `Erro ao salvar: ${error.message}`
          });
        }
      }

      // Notificar via WebSocket sobre novos veículos
      if (results.inserted > 0) {
        broadcastMessage({
          type: 'VEHICLE_UPDATE',
          data: { action: 'bulk_create', count: results.inserted }
        });
      }

      res.json({
        success: true,
        inserted: results.inserted,
        errors: results.errors,
        validVehicles: validVehicles
      });

    } catch (error: any) {
      console.error('Erro no upload CSV:', error);
      res.status(500).json({
        success: false,
        message: error.message || "Erro interno do servidor"
      });
    }
  });

  // Endpoint para buscar o histórico de status de uma licença
  app.get('/api/licenses/:id/status-history', requireAuth, async (req, res) => {
    try {
      const licenseId = parseInt(req.params.id);
      
      // Verifica se a licença existe
      const license = await storage.getLicenseRequestById(licenseId);
      if (!license) {
        return res.status(404).json({ message: 'Licença não encontrada' });
      }
      
      // Verifica se o usuário tem permissão para acessar essa licença
      const isStaff = ['operational', 'supervisor', 'admin'].includes(req.user!.role);
      if (!isStaff && license.userId !== req.user!.id) {
        return res.status(403).json({ message: 'Sem permissão para acessar o histórico desta licença' });
      }
      
      // Busca o histórico completo
      const statusHistory = await storage.getStatusHistoryByLicenseId(licenseId);
      
      res.json(statusHistory);
    } catch (error) {
      console.error('Erro ao buscar histórico de status:', error);
      res.status(500).json({ message: 'Erro ao buscar histórico de status' });
    }
  });
  
  // Endpoint para buscar o histórico de status de um estado específico na licença
  app.get('/api/licenses/:id/status-history/:state', requireAuth, async (req, res) => {
    try {
      const licenseId = parseInt(req.params.id);
      const state = req.params.state;
      
      // Verifica se a licença existe
      const license = await storage.getLicenseRequestById(licenseId);
      if (!license) {
        return res.status(404).json({ message: 'Licença não encontrada' });
      }
      
      // Verifica se o usuário tem permissão para acessar essa licença
      const isStaff = ['operational', 'supervisor', 'admin'].includes(req.user!.role);
      if (!isStaff && license.userId !== req.user!.id) {
        return res.status(403).json({ message: 'Sem permissão para acessar o histórico desta licença' });
      }
      
      // Verifica se o estado existe na licença
      if (!license.states.includes(state)) {
        return res.status(400).json({ message: 'Estado não encontrado na licença' });
      }
      
      // Busca o histórico para o estado específico
      const stateHistory = await storage.getStatusHistoryByState(licenseId, state);
      
      res.json(stateHistory);
    } catch (error) {
      console.error('Erro ao buscar histórico de status do estado:', error);
      res.status(500).json({ message: 'Erro ao buscar histórico de status do estado' });
    }
  });

  // Admin endpoints
  // Endpoint para buscar todas as licenças - acessível para Admin, Operacional e Supervisor
  // Rota para admin/operational obter todas as licenças
  app.get('/api/admin/licenses', requireAuth, requirePermission('manageLicenses', 'view'), async (req, res) => {
    try {
      console.log('🚀 [ADMIN LICENSES] Iniciando busca otimizada para grande escala...');
      const startTime = Date.now();
      
      // PAGINAÇÃO OTIMIZADA PARA 50K+ REGISTROS
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(100, parseInt(req.query.limit as string) || 25); // Máx 100 por página
      const offset = (page - 1) * limit;
      
      // FILTROS OTIMIZADOS
      const searchTerm = (req.query.search as string)?.trim();
      const statusFilter = req.query.status as string;
      const stateFilter = req.query.state as string;
      const transporterFilter = req.query.transporter as string;
      const shouldIncludeRenewalDrafts = req.query.includeRenewal === 'true';
      
      console.log(`📊 [ADMIN LICENSES] Parâmetros: page=${page}, limit=${limit}, search="${searchTerm}", status="${statusFilter}"`);
      
      // QUERY OTIMIZADA COM ÍNDICES - BUSCA APENAS DADOS NECESSÁRIOS
      let query = db.select({
        id: licenseRequests.id,
        userId: licenseRequests.userId,
        transporterId: licenseRequests.transporterId,
        requestNumber: licenseRequests.requestNumber,
        type: licenseRequests.type,
        mainVehiclePlate: licenseRequests.mainVehiclePlate,
        states: licenseRequests.states,
        status: licenseRequests.status,
        stateStatuses: licenseRequests.stateStatuses,
        createdAt: licenseRequests.createdAt,
        updatedAt: licenseRequests.updatedAt,
        isDraft: licenseRequests.isDraft,
        comments: licenseRequests.comments,
        validUntil: licenseRequests.validUntil,
        issuedAt: licenseRequests.issuedAt,
        aetNumber: licenseRequests.aetNumber,
        // CAMPOS DAS DIMENSÕES - ESSENCIAIS PARA DADOS DO CONJUNTO
        length: licenseRequests.length,
        width: licenseRequests.width,
        height: licenseRequests.height,
        cargoType: licenseRequests.cargoType,
        // CAMPOS DOS VEÍCULOS - ESSENCIAIS PARA A LINHA DE FRENTE
        tractorUnitId: licenseRequests.tractorUnitId,
        firstTrailerId: licenseRequests.firstTrailerId,
        dollyId: licenseRequests.dollyId,
        secondTrailerId: licenseRequests.secondTrailerId,
        flatbedId: licenseRequests.flatbedId
      }).from(licenseRequests);
      
      // APLICAR FILTROS NO BANCO PARA PERFORMANCE
      const conditions = [];
      
      // Filtro de rascunhos de renovação
      if (!shouldIncludeRenewalDrafts) {
        conditions.push(
          or(
            eq(licenseRequests.isDraft, false),
            and(
              eq(licenseRequests.isDraft, true),
              or(
                isNull(licenseRequests.comments),
                not(ilike(licenseRequests.comments, '%Renovação%'))
              )
            )
          )
        );
      }
      
      // Filtro de busca por placa ou número de pedido
      if (searchTerm) {
        conditions.push(
          or(
            ilike(licenseRequests.mainVehiclePlate, `%${searchTerm}%`),
            ilike(licenseRequests.requestNumber, `%${searchTerm}%`)
          )
        );
      }
      
      // Filtro de status
      if (statusFilter && statusFilter !== 'all') {
        conditions.push(eq(licenseRequests.status, statusFilter));
      }
      
      // Filtro de estado
      if (stateFilter && stateFilter !== 'all_states') {
        // O campo states é um array de texto, então verificamos se o estado está contido no array
        conditions.push(sql`${stateFilter} = ANY(${licenseRequests.states})`);
      }
      
      // APLICAR TODAS AS CONDIÇÕES
      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }
      
      // BUSCAR CONTAGEM TOTAL (OTIMIZADA)
      const countQuery = db.select({ count: count() }).from(licenseRequests);
      if (conditions.length > 0) {
        countQuery.where(and(...conditions));
      }
      
      // EXECUTAR QUERIES EM PARALELO PARA PERFORMANCE
      const [licenses, totalResult] = await Promise.all([
        query.orderBy(desc(licenseRequests.createdAt)).limit(limit).offset(offset),
        countQuery
      ]);
      
      const total = totalResult[0].count;
      const totalPages = Math.ceil(total / limit);
      
      console.log(`⚡ [ADMIN LICENSES] Query executada em ${Date.now() - startTime}ms - ${licenses.length}/${total} registros`);
      
      // BUSCAR TRANSPORTADORES APENAS DOS REGISTROS ATUAIS (OTIMIZADO)
      const transporterIds = Array.from(new Set(licenses.map(l => l.transporterId).filter(Boolean)));
      const transportersMap = new Map();
      
      if (transporterIds.length > 0) {
        const validTransporterIds = transporterIds.filter(id => id !== null) as number[];
        const transportersData = await db.select({
          id: transporters.id,
          name: transporters.name,
          tradeName: transporters.tradeName,
          documentNumber: transporters.documentNumber
        }).from(transporters).where(inArray(transporters.id, validTransporterIds));
        
        transportersData.forEach(t => {
          transportersMap.set(t.id, t);
        });
      }
      
      // ENRIQUECER APENAS OS DADOS ATUAIS
      const licensesWithTransporter = licenses.map(license => ({
        ...license,
        transporter: transportersMap.get(license.transporterId) || null
      }));
      
      const endTime = Date.now();
      console.log(`✅ [ADMIN LICENSES] Resposta preparada em ${endTime - startTime}ms - Performance otimizada para grande escala`);
      
      res.json({
        data: licensesWithTransporter,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        },
        performance: {
          executionTime: endTime - startTime,
          recordsPerSecond: Math.round((licenses.length / (endTime - startTime)) * 1000)
        }
      });
    } catch (error) {
      console.error('Error fetching admin licenses (optimized):', error);
      res.status(500).json({ message: 'Erro ao buscar licenças administrativas' });
    }
  });
  
  // Endpoint para excluir uma licença - acessível apenas para Admin
  app.delete('/api/admin/licenses/:id', requireAdmin, async (req, res) => {
    try {
      const licenseId = parseInt(req.params.id);
      
      // Verificar se a licença existe
      const existingLicense = await storage.getLicenseRequestById(licenseId);
      if (!existingLicense) {
        return res.status(404).json({ message: 'Licença não encontrada' });
      }
      
      // Excluir a licença
      await storage.deleteLicenseRequest(licenseId);
      
      res.status(200).json({ message: 'Licença excluída com sucesso' });
    } catch (error: any) {
      console.error('Erro ao excluir licença:', error);
      res.status(500).json({ message: error.message });
    }
  });
  
  // Rota para staff (operational/supervisor) obter todas as licenças
  app.get('/api/staff/licenses', requireOperational, async (req, res) => {
    try {
      // Obter todas as licenças
      const allLicenses = await storage.getAllLicenseRequests();
      
      // Verificar se deve incluir rascunhos de renovação (por padrão não inclui)
      const shouldIncludeRenewalDrafts = req.query.includeRenewal === 'true';
      
      // Filtrar rascunhos de renovação, a menos que solicitado explicitamente para incluí-los
      const licenses = shouldIncludeRenewalDrafts 
        ? allLicenses 
        : allLicenses.filter(license => {
            // Se é um rascunho e o comentário menciona "Renovação", é um rascunho de renovação
            if (license.isDraft && license.comments && license.comments.includes('Renovação')) {
              return false; // excluir rascunhos de renovação
            }
            return true; // manter todos os outros
          });
      
      console.log(`Total de licenças staff: ${allLicenses.length}, filtradas: ${licenses.length}, incluindo renovação: ${shouldIncludeRenewalDrafts}`);
      
      res.json(licenses);
    } catch (error) {
      console.error('Error fetching all license requests for staff:', error);
      res.status(500).json({ message: 'Erro ao buscar todas as solicitações de licenças' });
    }
  });
  
  // Rota para admin check
  app.get('/api/admin/check', requireAuth, (req, res) => {
    const user = req.user!;
    
    if (user.isAdmin) {
      res.json({ message: "Acesso de administrador confirmado" });
    } else {
      res.status(403).json({ message: "Acesso negado" });
    }
  });
  
  // Rotas para staff check
  app.get('/api/staff/check-operational', requireAuth, (req, res) => {
    const user = req.user!;
    
    if (user.role === 'operational' || user.role === 'supervisor' || user.role === 'manager' || user.role === 'financial' || user.role === 'admin') {
      res.json({ message: "Acesso operacional confirmado" });
    } else {
      res.status(403).json({ message: "Acesso negado. Perfil operacional necessário" });
    }
  });
  
  app.get('/api/staff/check-supervisor', requireAuth, (req, res) => {
    const user = req.user!;
    
    if (user.role === 'supervisor' || user.role === 'manager' || user.role === 'financial' || user.role === 'admin') {
      res.json({ message: "Acesso de supervisor confirmado" });
    } else {
      res.status(403).json({ message: "Acesso negado. Perfil de supervisor necessário" });
    }
  });
  
  app.get('/api/staff/check-financial', requireAuth, (req, res) => {
    const user = req.user!;
    
    if (user.role === 'financial' || user.role === 'manager' || user.role === 'admin') {
      res.json({ message: "Acesso financeiro confirmado" });
    } else {
      res.status(403).json({ message: "Acesso negado. Perfil financeiro necessário" });
    }
  });
  
  /* Rota removida para evitar duplicação - já existe implementação abaixo
  // Rota para obter usuários não-admin para seleção
  app.get('/api/admin/non-admin-users', requireAdmin, async (req, res) => {
    try {
      const users = await storage.getNonAdminUsers();
      res.json(users);
    } catch (error) {
      console.error('Erro ao buscar usuários não-admin:', error);
      res.status(500).json({ message: 'Erro ao buscar usuários não-admin' });
    }
  });
  */
  
  // Dashboard AET endpoint
  app.get("/api/dashboard/aet", requireAuth, async (req, res) => {
    try {
      const user = req.user as Express.User;
      
      // Verificar se o usuário tem permissão para acessar o dashboard AET
      if (!isAdminUser(user) && user.role !== 'manager') {
        return res.status(403).json({ message: "Acesso negado" });
      }

      const dashboardData = await storage.getDashboardAETData();
      res.json(dashboardData);
    } catch (error) {
      console.error("Error fetching AET dashboard data:", error);
      res.status(500).json({ message: "Erro ao buscar dados do dashboard AET" });
    }
  });

  // Dashboard Admin
  app.get('/api/admin/dashboard/stats', requireAdmin, async (req, res) => {
    try {
      // Como é admin, vamos pegar as estatísticas gerais, não específicas de um usuário
      const stats = await storage.getDashboardStats(0); // 0 = all users
      res.json(stats);
    } catch (error) {
      console.error('Error fetching admin dashboard stats:', error);
      res.status(500).json({ message: 'Erro ao buscar estatísticas do dashboard administrativo' });
    }
  });

  app.get('/api/admin/dashboard/vehicle-stats', requireAdmin, async (req, res) => {
    try {
      const stats = await storage.getVehicleStats(0); // 0 = all users
      res.json(stats);
    } catch (error) {
      console.error('Error fetching admin vehicle stats:', error);
      res.status(500).json({ message: 'Erro ao buscar estatísticas de veículos administrativo' });
    }
  });

  app.get('/api/admin/dashboard/state-stats', requireAdmin, async (req, res) => {
    try {
      const stats = await storage.getStateStats(0); // 0 = all users
      res.json(stats);
    } catch (error) {
      console.error('Error fetching admin state stats:', error);
      res.status(500).json({ message: 'Erro ao buscar estatísticas por estado administrativo' });
    }
  });
  
  // Rota para admin obter todos os veículos
  app.get('/api/admin/vehicles', requireAdmin, async (req, res) => {
    try {
      // Usar a função otimizada para buscar todos os veículos
      const allVehicles = await storage.getAllVehicles();
      res.json(allVehicles);
    } catch (error) {
      console.error("Erro ao buscar todos os veículos:", error);
      res.status(500).json({ message: "Erro ao buscar todos os veículos" });
    }
  });
  
  // Configuração do multer para upload de arquivos de veículos
  const vehicleStorage = multer.diskStorage({
    destination: (req, file, cb) => {
      // Usar o diretório de uploads externo com subpasta para veículos
      const vehicleUploadDir = path.join(uploadDir, 'vehicles');
      if (!fs.existsSync(vehicleUploadDir)) {
        fs.mkdirSync(vehicleUploadDir, { recursive: true });
      }
      cb(null, vehicleUploadDir);
    },
    filename: (req, file, cb) => {
      // Preservar o ID do veículo no nome do arquivo para facilitar substituição
      const vehicleId = req.params.id || Date.now();
      const ext = path.extname(file.originalname);
      cb(null, `vehicle-${vehicleId}-crlv${ext}`);
    }
  });
  
  const vehicleFileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    // Aceitar apenas imagens e PDFs
    if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(null, false);
    }
  };
  
  const vehicleUpload = multer({ 
    storage: vehicleStorage,
    fileFilter: vehicleFileFilter,
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB max file size
    }
  });

  // Rota para admin atualizar um veículo específico
  app.patch('/api/admin/vehicles/:id', requireAdmin, vehicleUpload.single('crlvFile'), async (req, res) => {
    try {
      const vehicleId = parseInt(req.params.id);
      if (isNaN(vehicleId)) {
        return res.status(400).json({ message: "ID de veículo inválido" });
      }
      
      // Verificar se o veículo existe
      const vehicle = await storage.getVehicleById(vehicleId);
      if (!vehicle) {
        return res.status(404).json({ message: "Veículo não encontrado" });
      }
      
      // Tratar formulário multipart
      let vehicleData: any = {};
      
      // Se os dados vierem como campo JSON
      if (req.body.vehicleData) {
        try {
          if (typeof req.body.vehicleData === 'string' && req.body.vehicleData.trim().length > 0) {
            vehicleData = JSON.parse(req.body.vehicleData);
          } else {
            console.error("Campo vehicleData está vazio ou não é uma string válida:", req.body.vehicleData);
            return res.status(400).json({ message: "Dados do veículo estão vazios ou inválidos" });
          }
        } catch (err) {
          console.error("Erro ao processar JSON de dados do veículo:", err);
          console.error("Conteúdo do campo vehicleData:", req.body.vehicleData);
          return res.status(400).json({ message: "Dados do veículo inválidos - JSON malformado" });
        }
      } else {
        // Caso contrário, usar campos individuais
        const { plate, type, tare, crlvYear, status } = req.body;
        
        if (!plate || !type || !tare || !crlvYear || !status) {
          return res.status(400).json({ message: "Dados incompletos" });
        }
        
        vehicleData = {
          plate,
          type,
          tare: Number(tare),
          crlvYear: Number(crlvYear),
          status
        };
      }
      
      // Verificar se há um novo arquivo CRLV
      if (req.file) {
        console.log("Arquivo CRLV recebido:", req.file.filename);
        
        // Se o veículo já tinha um arquivo CRLV, excluir o arquivo antigo
        if (vehicle.crlvUrl) {
          try {
            // Extrair o caminho físico do arquivo antigo
            const oldFilePath = path.join(process.cwd(), vehicle.crlvUrl.replace(/^\//, ''));
            
            // Verificar se o arquivo existe antes de tentar excluí-lo
            if (fs.existsSync(oldFilePath)) {
              fs.unlinkSync(oldFilePath);
              console.log("Arquivo CRLV antigo excluído:", oldFilePath);
            }
          } catch (err) {
            console.error("Erro ao excluir arquivo CRLV antigo:", err);
            // Não interromper o processo se falhar ao excluir o arquivo antigo
          }
        }
        
        // Adicionar o caminho do novo arquivo aos dados do veículo
        vehicleData.crlvUrl = `/uploads/vehicles/${req.file.filename}`;
      }
      
      // Atualizar o veículo
      const updatedVehicle = await storage.updateVehicle(vehicleId, vehicleData);
      
      res.json(updatedVehicle);
    } catch (error) {
      console.error("Erro ao atualizar veículo:", error);
      res.status(500).json({ message: "Erro ao atualizar veículo" });
    }
  });
  

  
  // Rota para verificar acesso supervisor
  app.get('/api/staff/check-supervisor', requireAuth, (req, res) => {
    const user = req.user!;
    
    if (user.role === 'supervisor' || user.isAdmin) {
      res.json({ 
        message: "Acesso de supervisor confirmado",
        role: user.role
      });
    } else {
      res.status(403).json({ message: "Acesso negado" });
    }
  });
  
  // Rota para listar os perfis de usuário disponíveis
  app.get('/api/roles', requireAuth, (req, res) => {
    // Lista os valores definidos no enum
    const roleValues = ["user", "operational", "supervisor", "admin", "manager"];
    res.json({ roles: roleValues });
  });
  
  // Endpoint público para listar usuários (restrito corretamente)
  app.get('/api/users', requireAuth, async (req, res) => {
    const user = req.user!;
    
    // Supervisores, managers e admins podem ver lista de usuários
    if (!['supervisor', 'manager', 'admin'].includes(user.role)) {
      return res.status(403).json({ message: "Acesso negado" });
    }
    
    try {
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      console.error("Erro ao buscar usuários:", error);
      res.status(500).json({ message: "Erro ao buscar usuários" });
    }
  });

  // Endpoint para criar usuários (compatibilidade - com validação correta)
  app.post('/api/users', requireAuth, async (req, res) => {
    const user = req.user!;
    
    // Supervisores, managers e admins podem criar usuários
    if (!['supervisor', 'manager', 'admin'].includes(user.role)) {
      return res.status(403).json({ message: "Acesso negado - permissão insuficiente" });
    }
    
    try {
      const { fullName, email, password, role = "user", phone = "" } = req.body;
      
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: "Este e-mail já está em uso" });
      }
      
      const hashedPassword = await hashPassword(password);
      const newUser = await storage.createUser({
        fullName,
        email,
        password: hashedPassword,
        role,
        phone,

      });
      
      res.status(201).json(newUser);
    } catch (error) {
      console.error("Erro ao criar usuário:", error);
      res.status(500).json({ message: "Erro ao criar usuário" });
    }
  });

  // Rota para listagem de usuários (transportadores) - admin panel
  app.get('/api/admin/users', requireAuth, requirePermission('users', 'view'), async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      console.log(`[DEBUG] Total de usuários recuperados: ${users.length}`);
      
      // Adicionar informações extras para melhorar a visualização no frontend
      const enhancedUsers = users.map(user => {
        // Formatar o perfil para exibição
        const roleLabel = user.isAdmin ? "Administrador" : 
                         (user.role === "operational" ? "Operacional" :
                          user.role === "supervisor" ? "Supervisor" :
                          user.role === "manager" ? "Gerente" : "Usuário");
        
        return {
          ...user,
          roleLabel
        };
      });
      
      res.json(enhancedUsers);
    } catch (error) {
      console.error("Erro ao buscar usuários:", error);
      res.status(500).json({ message: "Erro ao buscar usuários" });
    }
  });
  
  // Rota para criação de usuários (transportadores)
  app.post('/api/admin/users', requireAuth, requirePermission('users', 'create'), async (req, res) => {
    try {
      const { fullName, email, password, role = "user", phone = "" } = req.body;
      
      // Verificar se já existe um usuário com este e-mail
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: "Este e-mail já está em uso" });
      }
      
      // Criar o usuário
      const hashedPassword = await hashPassword(password);
      const newUser = await storage.createUser({
        fullName,
        email,
        password: hashedPassword,
        phone,
        role: userRoleEnum.parse(role), // Garantir que o role seja válido
      });
      
      // Remover a senha do objeto retornado
      const { password: _, ...userWithoutPassword } = newUser;
      
      res.status(201).json(userWithoutPassword);
    } catch (error) {
      console.error("Erro ao criar usuário:", error);
      res.status(500).json({ message: "Erro ao criar usuário" });
    }
  });
  
  // Rota para atualização de usuários (transportadores)
  app.patch('/api/admin/users/:id', requireAuth, requirePermission('users', 'edit'), async (req, res) => {
    const userId = parseInt(req.params.id);
    if (isNaN(userId)) {
      return res.status(400).json({ message: "ID de usuário inválido" });
    }
    
    try {
      // Verificar se o usuário existe
      const existingUser = await storage.getUser(userId);
      if (!existingUser) {
        return res.status(404).json({ message: "Usuário não encontrado" });
      }
      
      const { fullName, email, password, isAdmin, role, phone } = req.body;
      
      // Verificar se o e-mail já está em uso por outro usuário
      if (email !== existingUser.email) {
        const userWithEmail = await storage.getUserByEmail(email);
        if (userWithEmail && userWithEmail.id !== userId) {
          return res.status(400).json({ message: "Este e-mail já está em uso por outro usuário" });
        }
      }
      
      // Preparar os dados para atualização
      const updateData: any = {
        fullName,
        email,
        phone,
        isAdmin: !!isAdmin
      };
      
      // Se o perfil for fornecido, atualizar
      if (role) {
        try {
          updateData.role = userRoleEnum.parse(role);
        } catch (error) {
          return res.status(400).json({ message: "Tipo de perfil inválido" });
        }
      }
      
      // Se foi fornecida uma nova senha, hash ela
      if (password) {
        updateData.password = await hashPassword(password);
      }
      
      // Atualizar o usuário
      const updatedUser = await storage.updateUser(userId, updateData);
      
      // Remover a senha do objeto retornado
      const { password: _, ...userWithoutPassword } = updatedUser;
      
      res.json(userWithoutPassword);
    } catch (error) {
      console.error("Erro ao atualizar usuário:", error);
      res.status(500).json({ message: "Erro ao atualizar usuário" });
    }
  });
  
  // Rota para exclusão de usuários (transportadores) - APENAS ADMIN
  app.delete('/api/admin/users/:id', requireAuth, requirePermission('users', 'delete'), async (req, res) => {
    const userId = parseInt(req.params.id);
    if (isNaN(userId)) {
      return res.status(400).json({ message: "ID de usuário inválido" });
    }
    
    // Impedir que o administrador exclua a si mesmo
    if (userId === req.user!.id) {
      return res.status(400).json({ message: "Você não pode excluir sua própria conta" });
    }
    
    try {
      // Verificar se o usuário existe
      const existingUser = await storage.getUser(userId);
      if (!existingUser) {
        return res.status(404).json({ message: "Usuário não encontrado" });
      }
      
      // Excluir o usuário
      await storage.deleteUser(userId);
      
      res.json({ message: "Usuário excluído com sucesso" });
    } catch (error) {
      console.error("Erro ao excluir usuário:", error);
      res.status(500).json({ message: "Erro ao excluir usuário" });
    }
  });

  // Rotas para transportadores
  app.get('/api/admin/transporters', requireAuth, requirePermission('transporters', 'view'), async (req, res) => {
    try {
      const transporters = await storage.getAllTransporters();
      res.json(transporters);
    } catch (error) {
      console.error("Erro ao buscar transportadores:", error);
      res.status(500).json({ message: "Erro ao buscar transportadores" });
    }
  });
  
  // Configuração do multer para upload de arquivos do transportador
  const transporterStorage = multer.diskStorage({
    destination: (req, file, cb) => {
      // Usar o diretório de uploads externo com subpasta para transportadores
      const transporterUploadDir = path.join(uploadDir, 'transporter');
      if (!fs.existsSync(transporterUploadDir)) {
        fs.mkdirSync(transporterUploadDir, { recursive: true });
      }
      cb(null, transporterUploadDir);
    },
    filename: (req, file, cb) => {
      // Cria um nome de arquivo único
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const ext = path.extname(file.originalname);
      cb(null, file.fieldname + '-' + uniqueSuffix + ext);
    }
  });
  
  const transporterUpload = multer({ storage: transporterStorage });

  // Endpoint público para criar transportadores (com validação correta)
  app.post('/api/transporters', requireAuth, async (req, res) => {
    const user = req.user!;
    
    // Verificar se o usuário pode criar transportadores (todos exceto 'user')
    if (user.role === 'user') {
      return res.status(403).json({ message: "Acesso negado - usuários transportadores não podem criar novos transportadores" });
    }
    
    try {
      // Lógica básica de criação sem upload de arquivo
      const newTransporter = await storage.createTransporter({
        personType: 'pj' as const,
        name: req.body.name || 'Novo Transportador',
        documentNumber: req.body.documentNumber || '00000000000000',
        email: req.body.email || 'teste@exemplo.com',
        phone: req.body.phone || '(00) 00000-0000',
        subsidiaries: [],
        documents: []
      });
      
      res.status(201).json(newTransporter);
    } catch (error) {
      console.error("Erro ao criar transportador:", error);
      res.status(500).json({ message: "Erro ao criar transportador" });
    }
  });

  app.post('/api/admin/transporters', requireAuth, transporterUpload.any(), async (req, res) => {
    const user = req.user!;
    
    // Verificar se o usuário pode gerenciar transportadores
    if (!canManageTransporters(user)) {
      return res.status(403).json({ message: "Acesso negado" });
    }
    try {
      // Validar dados do transportador
      try {
        const { 
          personType, name, documentNumber, email, phone, 
          tradeName, legalResponsible,
          birthDate, nationality, idNumber, idIssuer, idState,
          street, number, complement, district, zipCode, city, state,
          subsidiaries, 
          contact1Name, contact1Phone, contact2Name, contact2Phone
        } = req.body;
        
        // Verificar se já existe um transportador com este documento
        const existingTransporter = await storage.getTransporterByDocument(documentNumber);
        if (existingTransporter) {
          return res.status(400).json({ message: "Este CPF/CNPJ já está cadastrado" });
        }
        
        // Processar arquivos enviados
        const files = req.files as Express.Multer.File[];
        const documents: { type: string, url: string, filename: string }[] = [];
        
        if (files && files.length > 0) {
          files.forEach((file) => {
            const fileType = file.fieldname.replace('document_', '');
            documents.push({
              type: fileType,
              url: `/uploads/transporter/${file.filename}`,
              filename: file.originalname
            });
          });
        }
        
        // Criar transportador com os dados específicos para o tipo (PJ ou PF)
        const transporterData: any = {
          personType,
          name,
          documentNumber,
          email,
          phone,
          contact1Name: contact1Name || "",
          contact1Phone: contact1Phone || "",
          contact2Name: contact2Name || "",
          contact2Phone: contact2Phone || "",
          documents: JSON.stringify(documents)
        };
        
        // Adicionar campos específicos de PJ
        if (personType === "pj") {
          transporterData.tradeName = tradeName;
          transporterData.legalResponsible = legalResponsible;
          
          // Adicionar endereço
          transporterData.street = street;
          transporterData.number = number;
          transporterData.complement = complement;
          transporterData.district = district;
          transporterData.zipCode = zipCode;
          transporterData.city = city;
          transporterData.state = state;
          
          // Processar subsidiárias (filiais)
          if (subsidiaries) {
            try {
              const parsedSubsidiaries = JSON.parse(subsidiaries);
              transporterData.subsidiaries = JSON.stringify(parsedSubsidiaries);
            } catch (e) {
              console.error("Erro ao processar subsidiárias:", e);
              transporterData.subsidiaries = '[]';
            }
          } else {
            transporterData.subsidiaries = '[]';
          }
        } 
        // Adicionar campos específicos de PF
        else if (personType === "pf") {
          transporterData.birthDate = birthDate;
          transporterData.nationality = nationality;
          transporterData.idNumber = idNumber;
          transporterData.idIssuer = idIssuer;
          transporterData.idState = idState;
        }
        
        const transporter = await storage.createTransporter(transporterData);
        
        // Enviar notificação em tempo real via WebSocket
        broadcastMessage({
          type: 'LICENSE_UPDATE',
          data: {
            type: 'TRANSPORTER_CREATED',
            transporterId: transporter.id,
            transporter: transporter
          }
        });
        
        res.status(201).json(transporter);
      } catch (error) {
        console.error("Erro ao validar dados do transportador:", error);
        return res.status(400).json({ message: "Dados inválidos: " + (error as Error).message });
      }
    } catch (error) {
      console.error("Erro ao criar transportador:", error);
      res.status(500).json({ message: "Erro ao criar transportador" });
    }
  });
  
  app.get('/api/admin/transporters/:id', requireAdmin, async (req, res) => {
    try {
      const transporterId = parseInt(req.params.id);
      
      const transporter = await storage.getTransporterById(transporterId);
      if (!transporter) {
        return res.status(404).json({ message: "Transportador não encontrado" });
      }
      
      res.json(transporter);
    } catch (error) {
      console.error("Erro ao buscar transportador:", error);
      res.status(500).json({ message: "Erro ao buscar transportador" });
    }
  });
  
  app.patch('/api/admin/transporters/:id', requireAuth, transporterUpload.any(), async (req, res) => {
    const user = req.user!;
    
    // Verificar se o usuário pode gerenciar transportadores
    if (!canManageTransporters(user)) {
      return res.status(403).json({ message: "Acesso negado" });
    }
    try {
      const transporterId = parseInt(req.params.id);
      
      // Verificar se o transportador existe
      const transporter = await storage.getTransporterById(transporterId);
      if (!transporter) {
        return res.status(404).json({ message: "Transportador não encontrado" });
      }
      
      // Se está atualizando o documento, verificar se já existe outro transportador com este documento
      if (req.body.documentNumber && req.body.documentNumber !== transporter.documentNumber) {
        const existingTransporter = await storage.getTransporterByDocument(req.body.documentNumber);
        if (existingTransporter && existingTransporter.id !== transporterId) {
          return res.status(400).json({ message: "Este CPF/CNPJ já está cadastrado para outro transportador" });
        }
      }
      
      // Processar arquivos enviados
      const files = req.files as Express.Multer.File[];
      let existingDocuments: { type: string, url: string, filename: string }[] = [];
      
      // Tentar carregar documentos existentes
      try {
        if (transporter.documents && typeof transporter.documents === 'string' && transporter.documents.trim().length > 0) {
          existingDocuments = JSON.parse(transporter.documents);
        }
      } catch (e) {
        console.error("Erro ao processar documentos existentes:", e);
        console.error("Conteúdo do campo documents:", transporter.documents);
        existingDocuments = []; // Inicializar como array vazio em caso de erro
      }
      
      // Adicionar novos documentos
      if (files && files.length > 0) {
        files.forEach((file) => {
          const fileType = file.fieldname.replace('document_', '');
          existingDocuments.push({
            type: fileType,
            url: `/uploads/transporter/${file.filename}`,
            filename: file.originalname
          });
        });
      }
      
      // Preparar dados para atualização
      const transporterData: any = {
        ...req.body,
        documents: JSON.stringify(existingDocuments)
      };
      
      // Processar subsidiárias se for PJ
      if (transporterData.personType === "pj" && transporterData.subsidiaries) {
        try {
          if (typeof transporterData.subsidiaries === 'string' && transporterData.subsidiaries.trim().length > 0) {
            const parsedSubsidiaries = JSON.parse(transporterData.subsidiaries);
            transporterData.subsidiaries = JSON.stringify(parsedSubsidiaries);
          } else {
            transporterData.subsidiaries = '[]';
          }
        } catch (e) {
          console.error("Erro ao processar subsidiárias:", e);
          console.error("Conteúdo do campo subsidiaries:", transporterData.subsidiaries);
          // Manter as subsidiárias existentes se houver erro
          if (transporter.subsidiaries && typeof transporter.subsidiaries === 'string' && transporter.subsidiaries.trim().length > 0) {
            transporterData.subsidiaries = transporter.subsidiaries;
          } else {
            transporterData.subsidiaries = '[]';
          }
        }
      }
      
      // Atualizar transportador
      const updatedTransporter = await storage.updateTransporter(transporterId, transporterData);
      
      // Enviar notificação em tempo real via WebSocket
      broadcastMessage({
        type: 'LICENSE_UPDATE',
        data: {
          type: 'TRANSPORTER_UPDATED',
          transporterId: transporterId,
          transporter: updatedTransporter
        }
      });
      
      res.json(updatedTransporter);
    } catch (error) {
      console.error("Erro ao atualizar transportador:", error);
      res.status(500).json({ message: "Erro ao atualizar transportador" });
    }
  });
  
  app.delete('/api/admin/transporters/:id', requireAuth, async (req, res) => {
    const user = req.user!;
    
    // Verificar se o usuário pode gerenciar transportadores
    if (!canManageTransporters(user)) {
      return res.status(403).json({ message: "Acesso negado" });
    }
    try {
      const transporterId = parseInt(req.params.id);
      
      // Verificar se o transportador existe
      const transporter = await storage.getTransporterById(transporterId);
      if (!transporter) {
        return res.status(404).json({ message: "Transportador não encontrado" });
      }
      
      await storage.deleteTransporter(transporterId);
      
      // Enviar notificação em tempo real via WebSocket
      broadcastMessage({
        type: 'LICENSE_UPDATE',
        data: {
          type: 'TRANSPORTER_DELETED',
          transporterId: transporterId
        }
      });
      
      res.status(204).send();
    } catch (error) {
      console.error("Erro ao excluir transportador:", error);
      res.status(500).json({ message: "Erro ao excluir transportador" });
    }
  });
  
  // Rota para vincular transportador a usuário
  app.post('/api/admin/transporters/:id/link', requireAdmin, async (req, res) => {
    try {
      const transporterId = parseInt(req.params.id);
      const { userId } = req.body;
      
      // Verificar se o transportador existe
      const transporter = await storage.getTransporterById(transporterId);
      if (!transporter) {
        return res.status(404).json({ message: "Transportador não encontrado" });
      }
      
      if (userId !== null) {
        // Verificar se o usuário existe
        const user = await storage.getUser(userId);
        if (!user) {
          return res.status(404).json({ message: "Usuário não encontrado" });
        }
      }
      
      // Vincular transportador ao usuário (ou desvincular se userId for null)
      const updatedTransporter = await storage.linkTransporterToUser(transporterId, userId);
      
      res.json(updatedTransporter);
    } catch (error) {
      console.error("Erro ao vincular transportador a usuário:", error);
      res.status(500).json({ message: "Erro ao vincular transportador a usuário" });
    }
  });

  // Endpoint para transferir veículos para outro usuário
  app.post('/api/admin/vehicles/transfer', requireAdmin, async (req, res) => {
    try {
      const { vehicleIds, targetUserId } = req.body;
      
      if (!vehicleIds || !Array.isArray(vehicleIds) || vehicleIds.length === 0) {
        return res.status(400).json({ message: "Lista de veículos é obrigatória" });
      }
      
      if (!targetUserId) {
        return res.status(400).json({ message: "Usuário de destino é obrigatório" });
      }
      
      // Verificar se o usuário de destino existe
      const targetUser = await storage.getUser(targetUserId);
      if (!targetUser) {
        return res.status(404).json({ message: "Usuário de destino não encontrado" });
      }
      
      // Transferir veículos um por um
      const transferredVehicles = [];
      for (const vehicleId of vehicleIds) {
        try {
          const vehicle = await storage.getVehicleById(vehicleId);
          if (vehicle) {
            await storage.updateVehicle(vehicleId, { userId: targetUserId });
            transferredVehicles.push(vehicleId);
          }
        } catch (error) {
          console.error(`Erro ao transferir veículo ${vehicleId}:`, error);
        }
      }
      
      console.log(`[TRANSFER] ${transferredVehicles.length} veículos transferidos para usuário ${targetUserId}`);
      
      res.json({
        success: true,
        transferredCount: transferredVehicles.length,
        transferredVehicles
      });
    } catch (error) {
      console.error("Erro ao transferir veículos:", error);
      res.status(500).json({ message: "Erro ao transferir veículos" });
    }
  });

  // Endpoint para listar todos os veículos (admin)
  app.get('/api/vehicles/all', requireAdmin, async (req, res) => {
    try {
      const vehicles = await storage.getAllVehicles();
      res.json(vehicles);
    } catch (error) {
      console.error("Erro ao buscar todos os veículos:", error);
      res.status(500).json({ message: "Erro ao buscar veículos" });
    }
  });
  
  // Rota para obter usuários não-admin para seleção
  app.get('/api/admin/non-admin-users', requireAdmin, async (req, res) => {
    try {
      const users = await storage.getNonAdminUsers();
      console.log("[DEBUG] Usuários não-admin recuperados:", users.length);
      
      // Adicionar informações extras para melhorar a visualização no frontend
      const enhancedUsers = users.map(user => {
        // Formatar o perfil para exibição
        const roleLabel = user.isAdmin ? "Administrador" : 
                         (user.role === "operational" ? "Operacional" :
                          user.role === "supervisor" ? "Supervisor" :
                          user.role === "manager" ? "Gerente" : "Usuário");
        
        return {
          ...user,
          roleLabel
        };
      });
      
      res.json(enhancedUsers);
    } catch (error) {
      console.error("Erro ao buscar usuários:", error);
      res.status(500).json({ message: "Erro ao buscar usuários" });
    }
  });

  // Rota para atualizar o status de uma licença - acessível para Admin, Operacional e Supervisor
app.patch('/api/admin/licenses/:id/status', requireOperational, upload.single('licenseFile'), async (req, res) => {
    try {
      const licenseId = parseInt(req.params.id);
      const statusData: any = {
        status: req.body.status as LicenseStatus,
        comments: req.body.comments,
      };
      
      // Add state if provided (agora é obrigatório)
      if (req.body.state) {
        statusData.state = req.body.state;
      } else {
        return res.status(400).json({ message: 'É obrigatório informar o estado para atualizar o status' });
      }
      
      // Add aetNumber if provided
      if (req.body.aetNumber) {
        statusData.aetNumber = req.body.aetNumber;
      }
      
      // Add validUntil if provided
      if (req.body.validUntil) {
        statusData.validUntil = new Date(req.body.validUntil).toISOString();
      }
      
      // Add issuedAt if provided
      if (req.body.issuedAt) {
        statusData.issuedAt = new Date(req.body.issuedAt).toISOString();
        console.log('[Routes] Data de emissão recebida:', req.body.issuedAt);
        console.log('[Routes] Data de emissão convertida:', statusData.issuedAt);
      } else {
        console.log('[Routes] Nenhuma data de emissão recebida');
      }
      
      // Add selectedCnpj if provided
      console.log('Dados recebidos no body:', req.body);
      console.log('selectedCnpj no body:', req.body.selectedCnpj);
      console.log('Todos os campos do body:', Object.keys(req.body));
      if (req.body.selectedCnpj) {
        statusData.selectedCnpj = req.body.selectedCnpj;
        console.log('selectedCnpj adicionado ao statusData:', statusData.selectedCnpj);
      }
      
      // Validate status data
      try {
        updateLicenseStatusSchema.parse(statusData);
      } catch (error: any) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message });
      }
      
      // Check if license exists
      const existingLicense = await storage.getLicenseRequestById(licenseId);
      if (!existingLicense) {
        return res.status(404).json({ message: 'Licença não encontrada' });
      }
      
      // Verifica se o estado está incluído na lista de estados da licença
      if (statusData.state && !existingLicense.states.includes(statusData.state)) {
        return res.status(400).json({ message: 'Estado não incluído na solicitação da licença' });
      }
      
      // Add file se fornecido
      let file: Express.Multer.File | undefined = undefined;
      if (req.file) {
        file = req.file;
      }
      
      // Obter o status anterior do estado específico
      const previousStateStatus = existingLicense.stateStatuses?.find(ss => 
        ss.startsWith(`${statusData.state}:`)
      )?.split(':')?.[1] || 'pending';
      
      // Usar updateLicenseStateStatus para garantir que o arquivo e número AET 
      // sejam específicos para o estado selecionado
      const updatedLicense = await storage.updateLicenseStateStatus({
        licenseId,
        state: statusData.state || '',
        status: statusData.status,
        comments: statusData.comments || '',
        validUntil: statusData.validUntil,
        issuedAt: statusData.issuedAt,
        aetNumber: statusData.aetNumber,
        selectedCnpj: statusData.selectedCnpj,
        file: file
      });
      
      // Registrar mudança no histórico de status
      await storage.createStatusHistory({
        licenseId: updatedLicense.id,
        state: statusData.state || '',
        userId: req.user!.id,
        oldStatus: previousStateStatus,
        newStatus: statusData.status,
        comments: statusData.comments || null
      });
      
      console.log(`Histórico de status criado para licença ${licenseId}, estado ${statusData.state}: ${previousStateStatus} -> ${statusData.status}`);
      
      // Se o status foi alterado para 'approved' ou 'released', sincronizar com licencas_emitidas
      if ((statusData.status === 'approved' || statusData.status === 'released') && statusData.validUntil && statusData.aetNumber && statusData.state) {
        try {
          console.log(`[SINCRONIZAÇÃO AUTOMÁTICA] Licença ${licenseId} aprovada para estado ${statusData.state} - iniciando sincronização`);
          await sincronizarLicencaEmitida(updatedLicense, statusData.state, statusData.aetNumber, statusData.validUntil);
          console.log(`[SINCRONIZAÇÃO AUTOMÁTICA] Licença ${licenseId} sincronizada com sucesso para tabela licencas_emitidas`);
        } catch (error) {
          console.error(`[SINCRONIZAÇÃO AUTOMÁTICA] ERRO ao sincronizar licença ${licenseId}:`, error);
          // Ainda assim continuar o processo, mas logar o erro crítico
        }
      }

      // Enviar notificações WebSocket para atualização de status
      broadcastLicenseUpdate(updatedLicense.id, 'status_changed', updatedLicense);
      broadcastDashboardUpdate();
      broadcastActivityLog({
        licenseId: updatedLicense.id,
        state: statusData.state || '',
        oldStatus: previousStateStatus,
        newStatus: statusData.status,
        userId: req.user!.id,
        timestamp: new Date().toISOString()
      });
      
      res.json(updatedLicense);
    } catch (error) {
      console.error('Error updating license status:', error);
      res.status(500).json({ message: 'Erro ao atualizar status da licença' });
    }
  });
  
  // Endpoint simples para atualizar apenas o CNPJ selecionado
  app.patch('/api/admin/licenses/:id/selected-cnpj', requireOperational, async (req, res) => {
    try {
      const licenseId = parseInt(req.params.id);
      const { selectedCnpj } = req.body;
      
      console.log('Atualizando CNPJ selecionado para licença:', licenseId, 'CNPJ:', selectedCnpj);
      
      await db.update(licenseRequests)
        .set({ selectedCnpj: selectedCnpj || null })
        .where(eq(licenseRequests.id, licenseId));
      
      res.json({ success: true, selectedCnpj });
    } catch (error) {
      console.error('Erro ao atualizar CNPJ selecionado:', error);
      res.status(500).json({ message: 'Erro interno do servidor' });
    }
  });

  // Endpoint específico para salvar CNPJ por estado
  app.patch('/api/admin/licenses/:id/state-cnpj', requireOperational, async (req, res) => {
    try {
      const licenseId = parseInt(req.params.id);
      const { state, cnpj } = req.body;
      
      console.log('Atualizando CNPJ por estado - Licença:', licenseId, 'Estado:', state, 'CNPJ:', cnpj);
      
      // Buscar a licença atual
      const [license] = await db.select().from(licenseRequests).where(eq(licenseRequests.id, licenseId));
      if (!license) {
        return res.status(404).json({ message: 'Licença não encontrada' });
      }
      
      // Atualizar o array de CNPJs por estado
      let stateCnpjs = [...(license.stateCnpjs || [])];
      const newStateCnpj = `${state}:${cnpj}`;
      const existingIndex = stateCnpjs.findIndex(s => s.startsWith(`${state}:`));
      
      if (existingIndex >= 0) {
        stateCnpjs[existingIndex] = newStateCnpj;
      } else {
        stateCnpjs.push(newStateCnpj);
      }
      
      console.log('Atualizando stateCnpjs:', stateCnpjs);
      
      await db.update(licenseRequests)
        .set({ 
          stateCnpjs,
          selectedCnpj: cnpj, // Também atualizar o campo global
          updatedAt: new Date() 
        })
        .where(eq(licenseRequests.id, licenseId));
      
      res.json({ success: true, state, cnpj, stateCnpjs });
    } catch (error) {
      console.error('Erro ao atualizar CNPJ por estado:', error);
      res.status(500).json({ message: 'Erro interno do servidor' });
    }
  });

  // Endpoint específico para atualizar o status de um estado específico em uma licença
  app.patch('/api/admin/licenses/:id/state-status', requireOperational, (req, res, next) => {
    // Adicionar informações do AET ao request para o sistema de upload
    req.body.state = req.body.state;
    req.body.aetNumber = req.body.aetNumber;
    req.body.validUntil = req.body.validUntil;
    next();
  }, upload.single('stateFile'), async (req, res) => {
    console.log('=== ENDPOINT STATE-STATUS CHAMADO ===');
    console.log('URL completa:', req.url);
    console.log('Método:', req.method);
    console.log('Params:', req.params);
    console.log('Body completo:', req.body);
    console.log('issuedAt no body:', req.body.issuedAt);
    console.log('Tipo do issuedAt:', typeof req.body.issuedAt);
    try {
      const licenseId = parseInt(req.params.id);
      
      // Validar dados do status do estado
      console.log('Dados recebidos no endpoint state-status:', req.body);
      console.log('selectedCnpj recebido:', req.body.selectedCnpj);
      console.log('stateCnpj recebido:', req.body.stateCnpj);
      
      const stateStatusData = {
        licenseId,
        state: req.body.state,
        status: req.body.status,
        comments: req.body.comments,
        validUntil: req.body.validUntil,
        issuedAt: req.body.issuedAt, // Incluir data de emissão
        aetNumber: req.body.aetNumber, // Incluir número da AET
        selectedCnpj: req.body.selectedCnpj, // Incluir CNPJ selecionado (global - legado)
        stateCnpj: req.body.stateCnpj, // Incluir CNPJ específico para este estado
      };
      
      console.log('stateStatusData final:', stateStatusData);
      console.log('issuedAt no stateStatusData:', stateStatusData.issuedAt);
      
      try {
        updateLicenseStateSchema.parse(stateStatusData);
      } catch (error: any) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message });
      }
      
      // Verificar se a licença existe
      const existingLicense = await storage.getLicenseRequestById(licenseId);
      if (!existingLicense) {
        return res.status(404).json({ message: 'Licença não encontrada' });
      }
      
      // Verificar se o estado está incluído na lista de estados da licença
      if (!existingLicense.states.includes(stateStatusData.state)) {
        return res.status(400).json({ message: 'Estado não incluído na solicitação da licença' });
      }

      // Validação de unicidade e proteção do número AET
      if (stateStatusData.aetNumber) {
        console.log(`[VALIDAÇÃO AET] Validando número "${stateStatusData.aetNumber}" para estado ${stateStatusData.state}`);
        
        // 1. Verificar se já existe o número em outro estado da mesma licença
        if (existingLicense.stateAETNumbers) {
          const duplicateInSameLicense = existingLicense.stateAETNumbers.find((entry: string) => {
            const [state, number] = entry.split(':');
            return state !== stateStatusData.state && number === stateStatusData.aetNumber;
          });
          
          if (duplicateInSameLicense) {
            const [duplicateState] = duplicateInSameLicense.split(':');
            console.log(`[VALIDAÇÃO AET] ❌ Número já usado no estado ${duplicateState} da mesma licença`);
            return res.status(400).json({ 
              message: `O número "${stateStatusData.aetNumber}" já está sendo usado no estado ${duplicateState} desta licença` 
            });
          }
        }

        // 2. Verificar se já existe o número em outras licenças (busca global)
        const allLicenses = await db.select({
          id: licenseRequests.id,
          requestNumber: licenseRequests.requestNumber,
          stateAETNumbers: licenseRequests.stateAETNumbers
        }).from(licenseRequests)
        .where(and(
          ne(licenseRequests.id, licenseId),
          isNotNull(licenseRequests.stateAETNumbers)
        ));
        
        // Função para normalizar números AET (remover prefixo AET- se existir)
        const normalizeAetNumber = (num: string): string => {
          return num.replace(/^AET-?/i, '').trim();
        };
        
        for (const license of allLicenses) {
          if (license.stateAETNumbers && Array.isArray(license.stateAETNumbers)) {
            const duplicate = license.stateAETNumbers.find((entry: string) => {
              const [, number] = entry.split(':');
              return normalizeAetNumber(number) === normalizeAetNumber(stateStatusData.aetNumber || '');
            });
            
            if (duplicate) {
              console.log(`[VALIDAÇÃO AET] ❌ Número já usado na licença ${license.requestNumber}`);
              return res.status(400).json({ 
                message: `O número "${stateStatusData.aetNumber}" já está sendo usado na licença ${license.requestNumber}` 
              });
            }
          }
        }

        // 3. Verificar se é tentativa de alterar número já tratado (status aprovado/under_review)
        if (existingLicense.stateAETNumbers) {
          const existingAetEntry = existingLicense.stateAETNumbers.find((entry: string) => 
            entry.startsWith(`${stateStatusData.state}:`)
          );
          
          if (existingAetEntry) {
            const [, existingNumber] = existingAetEntry.split(':');
            
            const normalizedExisting = normalizeAetNumber(existingNumber);
            const normalizedNew = normalizeAetNumber(stateStatusData.aetNumber || '');
            
            // Verificar se o estado já foi tratado (tem status aprovado ou em análise)
            const currentStateStatus = existingLicense.stateStatuses?.find((status: string) => 
              status.startsWith(`${stateStatusData.state}:`)
            );
            
            if (currentStateStatus) {
              const [, currentStatus] = currentStateStatus.split(':');
              const isAlreadyProcessed = ['approved', 'under_review', 'pending_approval'].includes(currentStatus);
              
              if (isAlreadyProcessed && normalizedExisting !== normalizedNew) {
                console.log(`[VALIDAÇÃO AET] ❌ Tentativa de alterar número já tratado: ${existingNumber} → ${stateStatusData.aetNumber}`);
                return res.status(400).json({ 
                  message: `Não é possível alterar o número AET "${existingNumber}" pois o estado ${stateStatusData.state} já foi tratado` 
                });
              }
            }
          }
        }
        
        console.log(`[VALIDAÇÃO AET] ✅ Número "${stateStatusData.aetNumber}" válido para estado ${stateStatusData.state}`);
      }
      
      // Processar arquivo se fornecido com estrutura organizacional
      let file: Express.Multer.File | undefined = undefined;
      let organizedFileUrl: string | undefined = undefined;
      
      if (req.file) {
        const { saveLicenseFile } = await import('./lib/license-storage');
        
        // Buscar dados da transportadora para criar a estrutura de pastas
        const transporter = await db.select({
          name: transporters.name
        }).from(transporters)
        .where(eq(transporters.id, existingLicense.transporterId))
        .limit(1);
        
        if (transporter.length > 0) {
          try {
            // Ler o arquivo temporário
            const fs = await import('fs/promises');
            const tempFilePath = req.file.path;
            const fileBuffer = await fs.readFile(tempFilePath);
            
            // Salvar na estrutura organizacional
            const result = await saveLicenseFile({
              buffer: fileBuffer,
              originalName: req.file.originalname,
              transporter: transporter[0].name,
              state: stateStatusData.state!,
              licenseNumber: existingLicense.requestNumber
            });
            
            organizedFileUrl = result.publicUrl;
            
            // Remover arquivo temporário
            await fs.unlink(tempFilePath);
            
            console.log(`[LICENSE ORGANIZATION] ✅ Arquivo organizado: ${organizedFileUrl}`);
          } catch (error) {
            console.error('[LICENSE ORGANIZATION] ❌ Erro ao organizar arquivo:', error);
            // Em caso de erro, manter comportamento original
            file = req.file;
          }
        } else {
          console.error('[LICENSE ORGANIZATION] ❌ Transportadora não encontrada');
          file = req.file;
        }
      }
      
      // Obter o status anterior do estado específico
      const previousStateStatus = existingLicense.stateStatuses?.find(ss => 
        ss.startsWith(`${stateStatusData.state}:`)
      )?.split(':')?.[1] || 'pending';
      
      // Atualizar status do estado da licença
      const updatedLicense = await storage.updateLicenseStateStatus({
        licenseId: stateStatusData.licenseId,
        state: stateStatusData.state!,
        status: stateStatusData.status as LicenseStatus,
        comments: stateStatusData.comments,
        validUntil: stateStatusData.validUntil,
        issuedAt: stateStatusData.issuedAt, // Incluir data de emissão
        aetNumber: stateStatusData.aetNumber,
        selectedCnpj: stateStatusData.selectedCnpj,
        stateCnpj: stateStatusData.selectedCnpj, // Usar selectedCnpj como stateCnpj
        file,
        organizedFileUrl, // Usar URL organizada se disponível
      });
      
      // Registrar mudança no histórico de status
      await storage.createStatusHistory({
        licenseId: updatedLicense.id,
        state: stateStatusData.state,
        userId: req.user!.id,
        oldStatus: previousStateStatus,
        newStatus: stateStatusData.status,
        comments: stateStatusData.comments || null
      });
      
      console.log(`Histórico de status criado para licença ${licenseId}, estado ${stateStatusData.state}: ${previousStateStatus} -> ${stateStatusData.status}`);
      
      // Enviar notificação em tempo real via WebSocket
      broadcastMessage({
        type: 'STATUS_UPDATE',
        data: {
          licenseId: updatedLicense.id,
          state: stateStatusData.state,
          status: stateStatusData.status,
          updatedAt: new Date().toISOString(),
          license: updatedLicense
        }
      });
      
      console.log(`Status da licença ${licenseId} para o estado ${stateStatusData.state} atualizado para ${stateStatusData.status}. Notificação enviada.`);
      
      res.json(updatedLicense);
    } catch (error) {
      console.error('Error updating license state status:', error);
      res.status(500).json({ message: 'Erro ao atualizar status do estado da licença' });
    }
  });
  
  // Endpoint de teste para atualizar apenas dimensões de uma licença
  app.post('/api/test/license-dimensions/:id', requireAdmin, async (req, res) => {
    try {
      const licenseId = parseInt(req.params.id);
      const { width, height, cargoType } = req.body;
      
      console.log(`Atualizando licença ${licenseId} com dimensões:`, {
        width, height, cargoType
      });
      
      // Sanitizar os dados antes de atualizar
      const updateData = {
        width: width !== undefined ? Number(width).toString() : null,
        height: height !== undefined ? Number(height).toString() : null,
        cargoType: cargoType || null
      };
      
      // Log para diagnóstico
      console.log('Dados sanitizados para atualização:', JSON.stringify(updateData, null, 2));
      
      // Atualizar o banco de dados
      const results = await db.update(licenseRequests)
        .set(updateData)
        .where(eq(licenseRequests.id, licenseId))
        .returning();
      
      if (results.length === 0) {
        return res.status(404).json({ error: 'Licença não encontrada' });
      }
      
      console.log('Licença atualizada com sucesso:', JSON.stringify(results[0], null, 2));
      
      // Buscar a licença diretamente do banco para verificar se a atualização funcionou
      const dbResults = await db.select()
        .from(licenseRequests)
        .where(eq(licenseRequests.id, licenseId));
      
      if (dbResults.length === 0) {
        return res.status(404).json({ error: 'Não foi possível verificar a licença após atualização' });
      }
      
      console.log('Licença verificada após atualização:', JSON.stringify(dbResults[0], null, 2));
      
      res.json({
        updated: results[0],
        verification: dbResults[0]
      });
    } catch (error) {
      console.error('Erro ao atualizar dimensões da licença:', error);
      res.status(500).json({ error: String(error) });
    }
  });
  
  // Endpoint temporário para migrar os dados de aetNumber para stateAETNumbers
  app.post('/api/admin/migrate-aet-numbers', requireAdmin, async (req, res) => {
    try {
      console.log('Iniciando migração de números AET...');
      
      // Buscar todas as licenças que têm número AET mas não têm stateAETNumbers
      const licenses = await db.select().from(licenseRequests)
        .where(sql`aet_number IS NOT NULL AND 
                   (state_aet_numbers IS NULL OR array_length(state_aet_numbers, 1) IS NULL)`);
      
      console.log(`Encontradas ${licenses.length} licenças para migração`);
      
      let migratedCount = 0;
      
      // Para cada licença, criar um array stateAETNumbers com os estados da licença
      for (const license of licenses) {
        if (!license.aetNumber || !license.states || license.states.length === 0) {
          console.log(`Pulando licença ${license.id}: sem número AET ou estados definidos`);
          continue;
        }
        
        console.log(`Migrando licença ${license.id} com AET ${license.aetNumber}`);
        
        // Criar um array de stateAETNumbers
        const stateAETNumbers = license.states.map(state => `${state}:${license.aetNumber}`);
        
        // Atualizar a licença
        await db.update(licenseRequests)
          .set({ stateAETNumbers })
          .where(eq(licenseRequests.id, license.id));
        
        migratedCount++;
        console.log(`Licença ${license.id} atualizada com stateAETNumbers:`, stateAETNumbers);
      }
      
      res.json({ 
        message: `Migração concluída. ${migratedCount} licenças atualizadas de ${licenses.length} encontradas.` 
      });
    } catch (error) {
      console.error('Erro na migração de números AET:', error);
      res.status(500).json({ message: 'Erro durante migração de números AET' });
    }
  });

  // ===== VEHICLE MODELS ROUTES =====
  // Endpoint público para consultar modelos de veículos (usado nos formulários)
  app.get("/api/vehicle-models", async (req, res) => {
    try {
      const models = await storage.getAllVehicleModels();
      res.json(models);
    } catch (error) {
      console.error("Erro ao buscar modelos de veículos:", error);
      res.status(500).json({ message: "Erro ao buscar modelos de veículos" });
    }
  });

  // Listar todos os modelos de veículos (apenas admin)
  app.get("/api/admin/vehicle-models", requireAuth, async (req, res) => {
    const user = req.user!;
    
    // Verificar se o usuário pode gerenciar modelos de veículos
    if (!canManageVehicleModels(user)) {
      return res.status(403).json({ message: "Acesso negado" });
    }
    try {
      const models = await storage.getAllVehicleModels();
      res.json(models);
    } catch (error) {
      console.error("Erro ao buscar modelos de veículos:", error);
      res.status(500).json({ message: "Erro ao buscar modelos de veículos" });
    }
  });

  // Endpoint público para criar modelos de veículos (com validação correta)
  app.post("/api/vehicle-models", requireAuth, async (req, res) => {
    const user = req.user!;
    
    // Verificar se o usuário pode criar modelos de veículos (operacional e acima)
    if (!isAdminUser(user)) {
      return res.status(403).json({ message: "Acesso negado - permissão insuficiente" });
    }
    
    try {
      const newModel = await storage.createVehicleModel({
        brand: req.body.brand || 'Marca Teste',
        model: req.body.model || 'Modelo Teste',
        vehicleType: req.body.vehicleType || 'truck'
      });
      
      res.status(201).json(newModel);
    } catch (error) {
      console.error("Erro ao criar modelo de veículo:", error);
      res.status(500).json({ message: "Erro ao criar modelo de veículo" });
    }
  });

  // Criar novo modelo de veículo (apenas admin)
  app.post("/api/admin/vehicle-models", requireAuth, async (req, res) => {
    const user = req.user!;
    
    // Verificar se o usuário pode gerenciar modelos de veículos
    if (!canManageVehicleModels(user)) {
      return res.status(403).json({ message: "Acesso negado" });
    }
    try {
      const vehicleModelData = insertVehicleModelSchema.parse(req.body);
      const newModel = await storage.createVehicleModel(vehicleModelData);
      res.status(201).json(newModel);
    } catch (error) {
      console.error("Erro ao criar modelo de veículo:", error);
      if (error instanceof ZodError) {
        res.status(400).json({ message: "Dados inválidos", errors: error.errors });
      } else {
        res.status(500).json({ message: "Erro ao criar modelo de veículo" });
      }
    }
  });

  // Atualizar modelo de veículo (apenas admin) - PATCH
  app.patch("/api/admin/vehicle-models/:id", requireAuth, async (req, res) => {
    const user = req.user!;
    
    // Verificar se o usuário pode gerenciar modelos de veículos
    if (!canManageVehicleModels(user)) {
      return res.status(403).json({ message: "Acesso negado" });
    }
    try {
      const id = parseInt(req.params.id);
      const vehicleModelData = insertVehicleModelSchema.parse(req.body);
      const updatedModel = await storage.updateVehicleModel(id, vehicleModelData);
      
      if (!updatedModel) {
        return res.status(404).json({ message: "Modelo de veículo não encontrado" });
      }
      
      res.json(updatedModel);
    } catch (error) {
      console.error("Erro ao atualizar modelo de veículo:", error);
      if (error instanceof ZodError) {
        res.status(400).json({ message: "Dados inválidos", errors: error.errors });
      } else {
        res.status(500).json({ message: "Erro ao atualizar modelo de veículo" });
      }
    }
  });

  // Atualizar modelo de veículo (apenas admin) - PUT (compatibilidade com frontend)
  app.put("/api/admin/vehicle-models/:id", requireAuth, async (req, res) => {
    const user = req.user!;
    
    // Verificar se o usuário pode gerenciar modelos de veículos
    if (!canManageVehicleModels(user)) {
      return res.status(403).json({ message: "Acesso negado" });
    }
    try {
      const id = parseInt(req.params.id);
      const vehicleModelData = insertVehicleModelSchema.parse(req.body);
      const updatedModel = await storage.updateVehicleModel(id, vehicleModelData);
      
      if (!updatedModel) {
        return res.status(404).json({ message: "Modelo de veículo não encontrado" });
      }
      
      res.json(updatedModel);
    } catch (error) {
      console.error("Erro ao atualizar modelo de veículo:", error);
      if (error instanceof ZodError) {
        res.status(400).json({ message: "Dados inválidos", errors: error.errors });
      } else {
        res.status(500).json({ message: "Erro ao atualizar modelo de veículo" });
      }
    }
  });

  // Deletar modelo de veículo (apenas admin)
  app.delete("/api/admin/vehicle-models/:id", requireAuth, async (req, res) => {
    const user = req.user!;
    
    // Verificar se o usuário pode gerenciar modelos de veículos
    if (!canManageVehicleModels(user)) {
      return res.status(403).json({ message: "Acesso negado" });
    }
    try {
      const id = parseInt(req.params.id);
      await storage.deleteVehicleModel(id);
      res.status(204).send();
    } catch (error) {
      console.error("Erro ao deletar modelo de veículo:", error);
      res.status(500).json({ message: "Erro ao deletar modelo de veículo" });
    }
  });

  // ===== MÓDULO FINANCEIRO - BOLETOS =====

  // Função auxiliar para verificar permissões financeiras
  const canAccessFinancial = (user: any) => {
    return user.role === "admin" || user.role === "financial" || user.role === "manager";
  };

  // Configuração do multer para upload de arquivos de boletos
  const boletoStorage = multer.diskStorage({
    destination: (req, file, cb) => {
      // Usar o diretório de uploads externo com subpasta para boletos
      const boletoUploadDir = path.join(uploadDir, 'boletos');
      if (!fs.existsSync(boletoUploadDir)) {
        fs.mkdirSync(boletoUploadDir, { recursive: true });
      }
      cb(null, boletoUploadDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const ext = path.extname(file.originalname);
      cb(null, file.fieldname + '-' + uniqueSuffix + ext);
    }
  });

  const boletoFileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    // Aceitar apenas PDFs para boletos
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(null, false);
    }
  };

  const boletoUpload = multer({ 
    storage: boletoStorage,
    fileFilter: boletoFileFilter,
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB max file size
    }
  });

  // Rota de upload específica para boletos (chamada pelo frontend)
  app.post("/api/upload/boleto", requireAuth, boletoUpload.single('file'), async (req, res) => {
    const user = req.user!;
    
    if (!canAccessFinancial(user)) {
      return res.status(403).json({ message: "Acesso negado" });
    }

    try {
      if (!req.file) {
        return res.status(400).json({ message: "Nenhum arquivo enviado" });
      }

      const fileUrl = `/uploads/boletos/${req.file.filename}`;
      
      res.json({ 
        success: true, 
        url: fileUrl,
        filename: req.file.filename,
        originalName: req.file.originalname,
        size: req.file.size
      });
    } catch (error) {
      console.error("Erro no upload do boleto:", error);
      res.status(500).json({ message: "Erro ao fazer upload do arquivo" });
    }
  });

  // Endpoint para transportadores acessarem seus próprios boletos (admin pode ver todos)
  app.get("/api/meus-boletos", requireAuth, async (req, res) => {
    const user = req.user!;

    try {
      // Admin, financial e manager podem ver todos os boletos
      if (user.role === 'admin' || user.role === 'financial' || user.role === 'manager') {
        const boletos = await storage.getAllBoletos();
        
        // Força refresh removendo cache
        res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.set('Pragma', 'no-cache');
        res.set('Expires', '0');
        
        return res.json(boletos);
      }
      
      // Para transportadores, buscar apenas seus boletos
      const transporters = await storage.getAllTransporters();
      const userTransporter = transporters.find(t => t.userId === user.id);
      
      if (!userTransporter) {
        return res.status(404).json({ message: "Transportador não encontrado para este usuário" });
      }

      // Buscar boletos do transportador
      const boletos = await storage.getBoletosByTransportadorId(userTransporter.id);
      
      // Força refresh removendo cache
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
      
      res.json(boletos);
    } catch (error) {
      console.error("Erro ao buscar boletos do usuário:", error);
      res.status(500).json({ message: "Erro ao buscar seus boletos" });
    }
  });

  // Listar todos os boletos (supervisor, manager, admin, financial) com filtros
  app.get("/api/boletos", requireAuth, async (req, res) => {
    const user = req.user!;
    
    // Verificar se o usuário pode acessar boletos
    if (!['supervisor', 'financial', 'manager', 'admin'].includes(user.role)) {
      return res.status(403).json({ message: "Acesso negado" });
    }

    try {
      const { status, vencimento } = req.query;
      let boletos = await storage.getAllBoletos();
      
      // Aplicar filtros
      if (status && status !== 'todos') {
        boletos = boletos.filter(boleto => boleto.status === status);
      }
      
      if (vencimento) {
        const hoje = new Date();
        const seteDias = new Date(hoje.getTime() + 7 * 24 * 60 * 60 * 1000);
        
        switch (vencimento) {
          case 'vencidos':
            boletos = boletos.filter(boleto => 
              boleto.dataVencimento && new Date(boleto.dataVencimento) < hoje
            );
            break;
          case 'vencendo':
            boletos = boletos.filter(boleto => 
              boleto.dataVencimento && 
              new Date(boleto.dataVencimento) >= hoje && 
              new Date(boleto.dataVencimento) <= seteDias
            );
            break;
          case 'futuros':
            boletos = boletos.filter(boleto => 
              boleto.dataVencimento && new Date(boleto.dataVencimento) > seteDias
            );
            break;
        }
      }
      
      // Força refresh removendo cache
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
      
      res.json(boletos);
    } catch (error) {
      console.error("Erro ao buscar boletos:", error);
      res.status(500).json({ message: "Erro ao buscar boletos" });
    }
  });

  // Buscar boleto por ID (apenas admin e financial)
  app.get("/api/boletos/:id", requireAuth, async (req, res) => {
    const user = req.user!;
    
    if (!canAccessFinancial(user)) {
      return res.status(403).json({ message: "Acesso negado" });
    }

    try {
      const id = parseInt(req.params.id);
      const boleto = await storage.getBoletoById(id);
      
      if (!boleto) {
        return res.status(404).json({ message: "Boleto não encontrado" });
      }
      
      res.json(boleto);
    } catch (error) {
      console.error("Erro ao buscar boleto:", error);
      res.status(500).json({ message: "Erro ao buscar boleto" });
    }
  });

  // Buscar boletos por transportador (apenas admin e financial)
  app.get("/api/transportadores/:id/boletos", requireAuth, async (req, res) => {
    const user = req.user!;
    
    if (!canAccessFinancial(user)) {
      return res.status(403).json({ message: "Acesso negado" });
    }

    try {
      const transportadorId = parseInt(req.params.id);
      const boletos = await storage.getBoletosByTransportadorId(transportadorId);
      res.json(boletos);
    } catch (error) {
      console.error("Erro ao buscar boletos do transportador:", error);
      res.status(500).json({ message: "Erro ao buscar boletos do transportador" });
    }
  });

  // Criar novo boleto (apenas admin e financial)
  app.post("/api/boletos", requireAuth, async (req, res) => {
    const user = req.user!;
    
    // Verificar se o usuário pode criar boletos
    if (!['supervisor', 'financial', 'manager', 'admin'].includes(user.role)) {
      return res.status(403).json({ message: "Acesso negado - permissão insuficiente" });
    }

    try {
      // Os uploads já foram feitos separadamente via /api/upload/boleto
      // Aqui recebemos apenas os dados do formulário incluindo as URLs dos arquivos
      const validatedData = insertBoletoSchema.parse(req.body);
      const boleto = await storage.createBoleto(validatedData);
      
      res.status(201).json(boleto);
    } catch (error) {
      console.error("Erro ao criar boleto:", error);
      if (error instanceof ZodError) {
        res.status(400).json({ 
          message: "Dados inválidos", 
          errors: fromZodError(error).message 
        });
      } else {
        res.status(500).json({ message: "Erro ao criar boleto" });
      }
    }
  });

  // Atualizar boleto (apenas admin e financial)
  app.put("/api/boletos/:id", requireAuth, requirePermission('financial', 'edit'), async (req, res) => {

    try {
      const id = parseInt(req.params.id);
      // Os uploads já foram feitos separadamente via /api/upload/boleto
      // Aqui recebemos apenas os dados do formulário incluindo as URLs dos arquivos
      const boleto = await storage.updateBoleto(id, req.body);
      res.json(boleto);
    } catch (error) {
      console.error("Erro ao atualizar boleto:", error);
      if (error instanceof ZodError) {
        res.status(400).json({ 
          message: "Dados inválidos", 
          errors: fromZodError(error).message 
        });
      } else {
        res.status(500).json({ message: "Erro ao atualizar boleto" });
      }
    }
  });

  // Deletar boleto (apenas admin e financial com DELETE específico)
  app.delete("/api/boletos/:id", requireAuth, requirePermission('financial', 'delete'), async (req, res) => {

    try {
      const id = parseInt(req.params.id);
      await storage.deleteBoleto(id);
      res.status(204).send();
    } catch (error) {
      console.error("Erro ao deletar boleto:", error);
      res.status(500).json({ message: "Erro ao deletar boleto" });
    }
  });

  // ==========================================
  // ENDPOINTS OTIMIZADOS PARA GRANDES VOLUMES DE DADOS
  // ==========================================
  
  // Busca otimizada de veículos com paginação e filtros
  app.get('/api/vehicles/search', requireAuth, async (req, res) => {
    try {
      const user = req.user!;
      const {
        search = '',
        page = '1',
        limit = '20',
        type = '',
        sortBy = 'created_at',
        sortOrder = 'desc'
      } = req.query;
      
      const pageNum = Math.max(1, parseInt(page as string));
      const limitNum = Math.min(25, Math.max(5, parseInt(limit as string))); // Otimizado: máximo 25 por página para melhor performance
      const offset = (pageNum - 1) * limitNum;
      
      console.log(`[SEARCH VEHICLES] Busca: "${search}", Página: ${pageNum}, Limite: ${limitNum}, Tipo: "${type}"`);
      
      // Construir consulta otimizada com índices
      let baseQuery = sql`
        SELECT v.*, u.email as user_email, u.full_name as user_name,
               COUNT(*) OVER() as total_count
        FROM vehicles v
        LEFT JOIN users u ON v.user_id = u.id
      `;
      
      const conditions = [];
      const params = [];
      
      // Filtro por usuário (apenas próprios veículos se não for admin)
      if (!isAdministrativeRole(user.role as UserRole)) {
        conditions.push(sql`v.user_id = ${user.id}`);
      }
      
      // Filtro por tipo de veículo
      if (type) {
        conditions.push(sql`v.type = ${type.toString()}`);
      }
      
      // Filtro de busca otimizado com índices
      if (search) {
        const searchTerm = `%${search.toString().toUpperCase()}%`;
        conditions.push(sql`(
          UPPER(v.plate) LIKE ${searchTerm} OR 
          UPPER(v.brand) LIKE ${searchTerm} OR 
          UPPER(v.model) LIKE ${searchTerm}
        )`);
      }
      
      // Construir WHERE clause
      if (conditions.length > 0) {
        baseQuery = sql`${baseQuery} WHERE ${sql.join(conditions, sql` AND `)}`;
      }
      
      // Ordenação segura com colunas que existem na tabela vehicles
      const validSortFields = ['plate', 'brand', 'model', 'type', 'year', 'id'];
      const sortField = validSortFields.includes(sortBy as string) ? sortBy as string : 'plate';
      const order = sortOrder === 'asc' ? sql`ASC` : sql`DESC`;
      
      baseQuery = sql`${baseQuery} ORDER BY v.${sql.identifier(sortField)} ${order}`;
      
      // Paginação
      baseQuery = sql`${baseQuery} LIMIT ${limitNum} OFFSET ${offset}`;
      
      const result = await db.execute(baseQuery);
      const totalCount = result.rows.length > 0 ? parseInt(result.rows[0].total_count as string) : 0;
      
      res.json({
        vehicles: result.rows,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: totalCount,
          totalPages: Math.ceil(totalCount / limitNum),
          hasNext: pageNum * limitNum < totalCount,
          hasPrev: pageNum > 1
        }
      });
    } catch (error) {
      console.error('[SEARCH VEHICLES] Erro:', error);
      res.status(500).json({ message: 'Erro na busca de veículos' });
    }
  });

  
  // Busca global otimizada com limites por tipo
  app.get('/api/search/global', requireAuth, async (req, res) => {
    try {
      const user = req.user!;
      const { q: searchTerm = '', limit = '10' } = req.query;
      
      if (!searchTerm || searchTerm.toString().length < 2) {
        return res.json({ results: [] });
      }
      
      const maxResults = Math.min(20, Math.max(5, parseInt(limit as string)));
      const pattern = `%${searchTerm.toString().toUpperCase()}%`;
      
      console.log(`[GLOBAL SEARCH] Termo: "${searchTerm}", Limite: ${maxResults}`);
      
      // Busca otimizada em paralelo com índices
      const promises = [];
      
      // 1. Busca de veículos (limitada por permissão)
      let vehicleQuery = sql`
        SELECT 'vehicle' as type, v.id, v.plate as title, 
               CONCAT(COALESCE(v.brand, ''), ' ', COALESCE(v.model, '')) as subtitle,
               NULL as transporter_name
        FROM vehicles v
        WHERE UPPER(v.plate) LIKE ${pattern}
      `;
      
      if (!isAdministrativeRole(user.role as UserRole)) {
        vehicleQuery = sql`${vehicleQuery} AND v.user_id = ${user.id}`;
      }
      
      vehicleQuery = sql`${vehicleQuery} ORDER BY v.plate LIMIT ${Math.floor(maxResults / 3)}`;
      promises.push(db.execute(vehicleQuery));
      
      // 2. Busca de transportadores (limitada por permissão)
      let transporterQuery = sql`
        SELECT 'transporter' as type, t.id, t.name as title, 
               t.document_number as subtitle, t.name as transporter_name
        FROM transporters t
        WHERE UPPER(t.name) LIKE ${pattern} OR t.document_number LIKE ${pattern.replace('%', '').replace('%', '')}
      `;
      
      if (!isAdministrativeRole(user.role as UserRole)) {
        transporterQuery = sql`${transporterQuery} AND t.user_id = ${user.id}`;
      }
      
      transporterQuery = sql`${transporterQuery} ORDER BY t.name LIMIT ${Math.floor(maxResults / 3)}`;
      promises.push(db.execute(transporterQuery));
      
      // 3. Busca de licenças
      let licenseQuery = sql`
        SELECT 'license' as type, l.id, l.request_number as title, 
               l.status as subtitle, t.name as transporter_name
        FROM license_requests l
        LEFT JOIN transporters t ON l.transporter_id = t.id
        WHERE l.request_number LIKE ${pattern} OR UPPER(l.main_vehicle_plate) LIKE ${pattern}
      `;
      
      if (!isAdministrativeRole(user.role as UserRole)) {
        licenseQuery = sql`${licenseQuery} AND l.user_id = ${user.id}`;
      }
      
      licenseQuery = sql`${licenseQuery} ORDER BY l.created_at DESC LIMIT ${Math.floor(maxResults / 3)}`;
      promises.push(db.execute(licenseQuery));
      
      const [vehicleResults, transporterResults, licenseResults] = await Promise.all(promises);
      
      const results = [
        ...vehicleResults.rows,
        ...transporterResults.rows,
        ...licenseResults.rows
      ].slice(0, maxResults);
      
      res.json({ results });
    } catch (error) {
      console.error('[GLOBAL SEARCH] Erro:', error);
      res.status(500).json({ message: 'Erro na busca global' });
    }
  });
  
  // Busca otimizada de veículos por tipo específico para formulários de licença
  app.get('/api/vehicles/by-type/:type', requireAuth, async (req, res) => {
    try {
      const user = req.user!;
      const { type } = req.params;
      const {
        search = '',
        limit = '50'
      } = req.query;
      
      const maxResults = Math.min(100, Math.max(10, parseInt(limit as string)));
      
      console.log(`[VEHICLE BY TYPE] Tipo: ${type}, Busca: "${search}", Limite: ${maxResults}`);
      
      // Query otimizada para busca por tipo de veículo (sem JOIN desnecessário)
      let vehicleQuery = sql`
        SELECT v.id, v.plate, v.brand, v.model, v.year, v.tare::text, 
               v.axle_count, v.status
        FROM vehicles v
        WHERE v.type = ${type} AND v.status = 'active'
      `;
      
      // Filtro por usuário se não for admin
      if (!isAdministrativeRole(user.role as UserRole)) {
        vehicleQuery = sql`${vehicleQuery} AND v.user_id = ${user.id}`;
      }
      
      // Filtro de busca por placa
      if (search) {
        const searchPattern = `%${search.toString().toUpperCase()}%`;
        vehicleQuery = sql`${vehicleQuery} AND UPPER(v.plate) LIKE ${searchPattern}`;
      }
      
      vehicleQuery = sql`${vehicleQuery} 
        ORDER BY v.plate 
        LIMIT ${maxResults}`;
      
      const result = await db.execute(vehicleQuery);
      
      res.json({
        vehicles: result.rows,
        count: result.rows.length
      });
    } catch (error) {
      console.error('[VEHICLE BY TYPE] Erro:', error);
      res.status(500).json({ message: 'Erro na busca de veículos por tipo' });
    }
  });
  
  // Busca rápida de veículos por placa (para autocomplete) - ULTRA OTIMIZADA
  app.get('/api/vehicles/search-plate', requireAuth, async (req, res) => {
    try {
      const user = req.user!;
      const { q: searchTerm = '', type = '' } = req.query;
      
      const searchTermString = typeof searchTerm === 'string' ? searchTerm : String(searchTerm);
      
      if (!searchTerm || searchTermString.length < 2) {
        return res.json({ vehicles: [] });
      }
      
      const searchPattern = `%${searchTerm.toString().toUpperCase()}%`;
      const typeFilter = type ? type.toString() : '';
      
      // Cache key única para cada busca
      const cacheKey = `vehicle-search:${user.id}:${searchTerm}:${typeFilter}:${user.role}`;
      
      // Verificar cache primeiro
      const cached = appCache.get(cacheKey);
      if (cached) {
        console.log(`[PLATE SEARCH CACHE HIT] Termo: "${searchTerm}", Tipo: "${typeFilter}"`);
        return res.json(cached);
      }
      
      console.log(`[PLATE SEARCH CACHE MISS] Termo: "${searchTerm}", Tipo: "${typeFilter}"`);
      
      // Consulta ULTRA otimizada para 50K+ registros com trigram
      let vehicleQuery;
      
      // Para buscas curtas (2-3 chars), usar trigram que é mais rápido em volumes grandes
      if (searchTermString.length <= 3) {
        vehicleQuery = sql`
          SELECT v.id, v.plate, v.brand, v.model, v.type, v.tare::text,
                 v.axle_count, v.status,
                 similarity(v.plate, ${searchTerm.toString().toUpperCase()}) as sim
          FROM vehicles v
          WHERE v.status = 'active' 
            AND v.plate % ${searchTermString.toUpperCase()}
        `;
      } else {
        // Para buscas longas, usar índice UPPER otimizado
        vehicleQuery = sql`
          SELECT v.id, v.plate, v.brand, v.model, v.type, v.tare::text,
                 v.axle_count, v.status, 1.0 as sim
          FROM vehicles v
          WHERE v.status = 'active' 
            AND UPPER(v.plate) LIKE ${searchPattern}
        `;
      }
      
      // Filtro por tipo (aplicado cedo para usar índice combinado)
      if (typeFilter) {
        vehicleQuery = sql`${vehicleQuery} AND v.type = ${typeFilter}`;
      }
      
      // Filtro por usuário se não for admin
      if (!isAdministrativeRole(user.role as UserRole)) {
        vehicleQuery = sql`${vehicleQuery} AND v.user_id = ${user.id}`;
      }
      
      // Ordenação otimizada para grandes volumes
      if (searchTermString.length <= 3) {
        vehicleQuery = sql`${vehicleQuery} 
          ORDER BY sim DESC, v.plate
          LIMIT 12`;
      } else {
        vehicleQuery = sql`${vehicleQuery} 
          ORDER BY 
            CASE WHEN UPPER(v.plate) = ${searchTerm.toString().toUpperCase()} THEN 1 ELSE 2 END,
            v.plate
          LIMIT 12`;
      }
      
      const startTime = Date.now();
      const result = await db.execute(vehicleQuery);
      const queryTime = Date.now() - startTime;
      
      console.log(`[PLATE SEARCH] Consulta executada em ${queryTime}ms - ${result.rows.length} resultados`);
      
      const response = { vehicles: result.rows };
      
      // Cache agressivo para volumes grandes: 2 minutos
      appCache.set(cacheKey, response, 2);
      
      res.json(response);
    } catch (error) {
      console.error('[PLATE SEARCH] Erro:', error);
      res.status(500).json({ message: 'Erro na busca de placas' });
    }
  });
  
  // Busca de unidades tratoras otimizada com cache
  app.get('/api/vehicles/tractor-units', requireAuth, async (req, res) => {
    try {
      const user = req.user!;
      const { search = '', limit = '50' } = req.query;
      
      const maxResults = Math.min(50, parseInt(limit as string)); // Reduzido para performance
      const searchTerm = search.toString().toUpperCase();
      
      // Cache key para tractors
      const cacheKey = `tractor-units:${user.id}:${searchTerm}:${user.role}`;
      
      // Verificar cache
      const cached = appCache.get(cacheKey);
      if (cached) {
        console.log(`[TRACTOR CACHE HIT] Termo: "${searchTerm}"`);
        return res.json(cached);
      }
      
      console.log(`[TRACTOR CACHE MISS] Termo: "${searchTerm}"`);
      
      // Query especializada para tractors em volumes extremos
      let query;
      
      if (searchTerm && searchTerm.length <= 3) {
        // Usar trigram para buscas curtas em volumes grandes
        query = sql`
          SELECT v.id, v.plate, v.brand, v.model, v.year, v.tare::text,
                 similarity(v.plate, ${searchTerm}) as sim
          FROM vehicles v
          WHERE v.type = 'tractor_unit' AND v.status = 'active'
            AND v.plate % ${searchTerm}
        `;
      } else {
        // Query tradicional otimizada
        query = sql`
          SELECT v.id, v.plate, v.brand, v.model, v.year, v.tare::text
          FROM vehicles v
          WHERE v.type = 'tractor_unit' AND v.status = 'active'
        `;
        
        if (searchTerm) {
          const searchPattern = `%${searchTerm}%`;
          query = sql`${query} AND UPPER(v.plate) LIKE ${searchPattern}`;
        }
      }
      
      // Filtro de usuário
      if (!isAdministrativeRole(user.role as UserRole)) {
        query = sql`${query} AND v.user_id = ${user.id}`;
      }
      
      // Ordenação e limite
      if (searchTerm && searchTerm.length <= 3) {
        query = sql`${query} ORDER BY sim DESC, v.plate LIMIT ${Math.min(25, maxResults)}`;
      } else {
        query = sql`${query} ORDER BY v.plate LIMIT ${Math.min(25, maxResults)}`;
      }
      
      const startTime = Date.now();
      const result = await db.execute(query);
      const queryTime = Date.now() - startTime;
      
      console.log(`[TRACTOR UNITS] Consulta executada em ${queryTime}ms - ${result.rows.length} resultados`);
      
      const response = { vehicles: result.rows };
      
      // Cache por 1 minuto
      appCache.set(cacheKey, response, 1);
      
      res.json(response);
    } catch (error) {
      console.error('[TRACTOR UNITS] Erro:', error);
      res.status(500).json({ message: 'Erro na busca de unidades tratoras' });
    }
  });
  
  // Busca de semirreboques otimizada  
  app.get('/api/vehicles/semi-trailers', requireAuth, async (req, res) => {
    try {
      const user = req.user!;
      const { search = '', limit = '50' } = req.query;
      
      const maxResults = Math.min(100, parseInt(limit as string));
      
      let query = sql`
        SELECT v.id, v.plate, v.brand, v.model, v.year, v.tare,
               t.name as transporter_name
        FROM vehicles v
        LEFT JOIN transporters t ON v.transporter_id = t.id
        WHERE v.type = 'semi_trailer' AND v.status = 'active'
      `;
      
      if (!isAdministrativeRole(user.role as UserRole)) {
        query = sql`${query} AND v.user_id = ${user.id}`;
      }
      
      if (search) {
        const searchPattern = `%${search.toString().toUpperCase()}%`;
        query = sql`${query} AND UPPER(v.plate) LIKE ${searchPattern}`;
      }
      
      query = sql`${query} ORDER BY v.plate LIMIT ${maxResults}`;
      
      const result = await db.execute(query);
      res.json({ vehicles: result.rows });
    } catch (error) {
      console.error('[SEMI TRAILERS] Erro:', error);
      res.status(500).json({ message: 'Erro na busca de semirreboques' });
    }
  });

  // Servir arquivos de upload da pasta externa
  app.use('/uploads', express.static(uploadDir));
  
  // Log da configuração final de uploads
  console.log(`[UPLOAD] Servindo arquivos de ${uploadDir} em /uploads`);

  // ==========================================
  // OBJECT STORAGE PARA IMAGENS
  // ==========================================
  
  // Rota para servir arquivos públicos
  app.get("/public-objects/:filePath(*)", async (req, res) => {
    const filePath = req.params.filePath;
    const { ObjectStorageService } = await import('./objectStorage');
    const objectStorageService = new ObjectStorageService();
    try {
      const file = await objectStorageService.searchPublicObject(filePath);
      if (!file) {
        return res.status(404).json({ error: "File not found" });
      }
      objectStorageService.downloadObject(file, res);
    } catch (error) {
      console.error("Error searching for public object:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Rota para upload de objetos (híbrida: Object Storage + Upload Local)
  app.post("/api/objects/upload", requireAuth, async (req, res) => {
    try {
      // Tentar usar Object Storage primeiro (desenvolvimento/Replit)
      if (process.env.PRIVATE_OBJECT_DIR) {
        const { ObjectStorageService } = await import('./objectStorage');
        const objectStorageService = new ObjectStorageService();
        const uploadURL = await objectStorageService.getObjectEntityUploadURL();
        return res.json({ uploadURL, type: 'object_storage' });
      }
      
      // Fallback para upload local (produção)
      console.log('[UPLOAD] Object Storage não disponível, usando upload local');
      return res.json({ 
        uploadURL: null, 
        type: 'local_upload',
        message: 'Use local upload endpoint instead' 
      });
      
    } catch (error) {
      console.error("Error getting upload URL:", error);
      
      // Se Object Storage falhar, usar upload local como fallback
      console.log('[UPLOAD] Fallback para upload local devido a erro no Object Storage');
      return res.json({ 
        uploadURL: null, 
        type: 'local_upload',
        message: 'Fallback to local upload due to Object Storage error' 
      });
    }
  });

  // Rota para servir objetos privados
  app.get("/objects/:objectPath(*)", async (req, res) => {
    try {
      const { ObjectStorageService } = await import('./objectStorage');
      const objectStorageService = new ObjectStorageService();
      const objectFile = await objectStorageService.getObjectEntityFile(req.path);
      objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error accessing object:", error);
      res.status(404).json({ error: "Object not found" });
    }
  });

  // Upload local para imagens de tipos de conjunto (fallback para produção)
  const vehicleSetTypeImageUpload = multer({ 
    storage: multer.diskStorage({
      destination: function (req, file, cb) {
        const vehicleSetTypeDir = path.join(uploadDir, 'vehicle-set-types');
        cb(null, vehicleSetTypeDir);
      },
      filename: function (req, file, cb) {
        const timestamp = Date.now();
        const ext = path.extname(file.originalname);
        const filename = `vehicle-set-type-${timestamp}${ext}`;
        cb(null, filename);
      }
    }),
    fileFilter: function (req, file, cb) {
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(null, false);
      }
    },
    limits: {
      fileSize: 5 * 1024 * 1024, // 5MB max
    }
  });

  app.post("/api/upload/vehicle-set-type-image", requireAuth, vehicleSetTypeImageUpload.single('image'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "Nenhum arquivo enviado" });
      }

      const imageUrl = `/uploads/vehicle-set-types/${req.file.filename}`;
      
      console.log(`[UPLOAD] Imagem do tipo de conjunto salva: ${imageUrl}`);
      
      res.json({ 
        imageUrl,
        originalName: req.file.originalname,
        size: req.file.size 
      });
      
    } catch (error) {
      console.error("Erro no upload da imagem:", error);
      
      // Limpar arquivo em caso de erro
      if (req.file?.path) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (cleanupError) {
          console.error("Erro ao limpar arquivo:", cleanupError);
        }
      }
      
      const errorMessage = error instanceof Error ? error.message : "Erro interno do servidor";
      res.status(500).json({ error: errorMessage });
    }
  });

  // ==========================================
  // GESTÃO DE TIPOS DE CONJUNTO (ADMIN)
  // ==========================================
  
  // Listar todos os tipos de conjunto (com cache)
  app.get('/api/admin/vehicle-set-types', requireAuth, async (req, res) => {
    try {
      // Cache simples em memória por 5 minutos
      const cacheKey = 'vehicle_set_types_cache';
      const cacheTime = 5 * 60 * 1000; // 5 minutos
      
      // Forçar atualização se o cache existir mas for solicitado refresh
      const forceRefresh = req.query.refresh === 'true';
      
      if (!forceRefresh && (global as any)[cacheKey] && (global as any)[`${cacheKey}_time`] > Date.now() - cacheTime) {
        console.log('[VEHICLE SET TYPES] Retornando dados do cache');
        return res.json((global as any)[cacheKey]);
      }
      
      const { DEFAULT_VEHICLE_SET_TYPES } = await import('../shared/vehicle-set-types');
      const { vehicleSetTypes } = await import('../shared/schema');
      const { eq } = await import('drizzle-orm');
      
      // Buscar tipos personalizados do banco de dados
      const customTypes = await db.select().from(vehicleSetTypes).where(eq(vehicleSetTypes.isActive, true));
      
      // Combinar tipos padrão com tipos personalizados
      const allTypes = [
        ...DEFAULT_VEHICLE_SET_TYPES,
        ...customTypes.map(type => ({
          ...type,
          axleConfiguration: type.axleConfiguration as any,
          dimensionLimits: type.dimensionLimits as any,
          vehicleTypes: type.vehicleTypes as any,
          createdAt: new Date(type.createdAt),
          updatedAt: new Date(type.updatedAt),
        }))
      ];
      
      // Armazenar no cache
      (global as any)[cacheKey] = allTypes;
      (global as any)[`${cacheKey}_time`] = Date.now();
      
      console.log(`[VEHICLE SET TYPES] Retornando ${allTypes.length} tipos (${DEFAULT_VEHICLE_SET_TYPES.length} padrão + ${customTypes.length} personalizados)`);
      console.log(`[VEHICLE SET TYPES] Tipos personalizados no banco:`, customTypes.map(t => ({name: t.name, label: t.label, isActive: t.isActive})));
      res.json(allTypes);
    } catch (error) {
      console.error('[VEHICLE SET TYPES] Erro ao buscar tipos:', error);
      res.status(500).json({ message: 'Erro ao buscar tipos de conjunto' });
    }
  });

  // Criar novo tipo de conjunto
  app.post('/api/admin/vehicle-set-types', requireAuth, async (req, res) => {
    try {
      console.log('[VEHICLE SET TYPES] Recebendo dados para criação:', req.body);
      
      // Validar se é um usuário admin
      const user = req.user as any;
      if (user.role !== 'admin') {
        return res.status(403).json({ message: 'Acesso negado. Apenas administradores podem criar tipos de conjunto.' });
      }
      
      const { vehicleSetTypes } = await import('../shared/schema');
      const { randomUUID } = await import('crypto');
      const { eq } = await import('drizzle-orm');
      
      // Gerar ID único
      const newId = randomUUID();
      
      // Calcular total de eixos automaticamente
      const totalAxles = (req.body.axleConfiguration.tractorAxles || 0) + 
                        (req.body.axleConfiguration.firstTrailerAxles || 0) + 
                        (req.body.axleConfiguration.secondTrailerAxles || 0);
      
      const vehicleSetTypeData = {
        id: newId,
        name: req.body.name,
        label: req.body.label,
        description: req.body.description || null,
        axleConfiguration: {
          ...req.body.axleConfiguration,
          totalAxles
        },
        dimensionLimits: req.body.dimensionLimits,
        vehicleTypes: req.body.vehicleTypes,
        iconPath: req.body.iconPath || null,
        imageUrl: req.body.imageUrl || null,
        isActive: req.body.isActive !== false, // Default true
      };
      
      // Inserir no banco de dados
      const [newType] = await db.insert(vehicleSetTypes)
        .values(vehicleSetTypeData)
        .returning();
      
      // Limpar cache GLOBAL forçadamente
      (global as any)['vehicle_set_types_cache'] = null;
      (global as any)['vehicle_set_types_cache_time'] = null;
      delete (global as any)['vehicle_set_types_cache'];
      delete (global as any)['vehicle_set_types_cache_time'];
      
      console.log('[VEHICLE SET TYPES] Cache limpo e tipo criado com sucesso:', newType.id);
      
      res.json({ 
        success: true, 
        message: 'Tipo de conjunto criado com sucesso',
        data: newType 
      });
    } catch (error) {
      console.error('[VEHICLE SET TYPES] Erro ao criar tipo:', error);
      res.status(500).json({ message: 'Erro ao criar tipo de conjunto' });
    }
  });

  // Atualizar tipo de conjunto
  app.put('/api/admin/vehicle-set-types/:id', requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      if (user.role !== 'admin') {
        return res.status(403).json({ message: 'Acesso negado. Apenas administradores podem atualizar tipos de conjunto.' });
      }
      
      const { vehicleSetTypes } = await import('../shared/schema');
      const { eq } = await import('drizzle-orm');
      const typeId = req.params.id;
      
      // Calcular total de eixos automaticamente
      const totalAxles = (req.body.axleConfiguration.tractorAxles || 0) + 
                        (req.body.axleConfiguration.firstTrailerAxles || 0) + 
                        (req.body.axleConfiguration.secondTrailerAxles || 0);
      
      const updateData = {
        name: req.body.name,
        label: req.body.label,
        description: req.body.description || null,
        axleConfiguration: {
          ...req.body.axleConfiguration,
          totalAxles
        },
        dimensionLimits: req.body.dimensionLimits,
        vehicleTypes: req.body.vehicleTypes,
        iconPath: req.body.iconPath || null,
        imageUrl: req.body.imageUrl || null,
        isActive: req.body.isActive !== false,
        updatedAt: new Date(),
      };
      
      // Atualizar no banco de dados
      const [updatedType] = await db.update(vehicleSetTypes)
        .set(updateData)
        .where(eq(vehicleSetTypes.id, typeId))
        .returning();
      
      if (!updatedType) {
        return res.status(404).json({ message: 'Tipo de conjunto não encontrado' });
      }
      
      // Limpar cache GLOBAL forçadamente  
      (global as any)['vehicle_set_types_cache'] = null;
      (global as any)['vehicle_set_types_cache_time'] = null;
      delete (global as any)['vehicle_set_types_cache'];
      delete (global as any)['vehicle_set_types_cache_time'];
      
      console.log('[VEHICLE SET TYPES] Cache limpo e tipo atualizado com sucesso:', typeId);
      
      res.json({ 
        success: true, 
        message: 'Tipo de conjunto atualizado com sucesso',
        data: updatedType 
      });
    } catch (error) {
      console.error('[VEHICLE SET TYPES] Erro ao atualizar tipo:', error);
      res.status(500).json({ message: 'Erro ao atualizar tipo de conjunto' });
    }
  });

  // Deletar tipo de conjunto
  app.delete('/api/admin/vehicle-set-types/:id', requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      if (user.role !== 'admin') {
        return res.status(403).json({ message: 'Acesso negado. Apenas administradores podem deletar tipos de conjunto.' });
      }
      
      const { vehicleSetTypes } = await import('../shared/schema');
      const { eq } = await import('drizzle-orm');
      const typeId = req.params.id;
      
      // Verificar se o tipo existe
      const existingType = await db.select().from(vehicleSetTypes).where(eq(vehicleSetTypes.id, typeId)).limit(1);
      if (existingType.length === 0) {
        return res.status(404).json({ message: 'Tipo de conjunto não encontrado' });
      }
      
      // Deletar do banco de dados
      await db.delete(vehicleSetTypes).where(eq(vehicleSetTypes.id, typeId));
      
      // Limpar cache
      delete (global as any)['vehicle_set_types_cache'];
      delete (global as any)['vehicle_set_types_cache_time'];
      
      console.log('[VEHICLE SET TYPES] Tipo deletado com sucesso:', typeId);
      
      res.status(204).send();
    } catch (error) {
      console.error('[VEHICLE SET TYPES] Erro ao deletar tipo:', error);
      res.status(500).json({ message: 'Erro ao deletar tipo de conjunto' });
    }
  });

  return httpServer;
}
