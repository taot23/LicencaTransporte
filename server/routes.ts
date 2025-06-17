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
import { eq, sql, or, inArray, and, desc, gt } from "drizzle-orm";
import { fromZodError } from "zod-validation-error";
import { ZodError } from "zod";
import multer from "multer";
import path from "path";
import * as fs from "fs";
import { promisify } from "util";
import { WebSocketServer, WebSocket } from "ws";

// Set up file storage for uploads - externa ao projeto
const getUploadDir = () => {
  // Tentar diferentes localizações baseadas no ambiente
  const possiblePaths = [
    process.env.UPLOAD_DIR, // Variável de ambiente personalizada
    '/var/uploads', // Padrão para produção
    '/tmp/uploads', // Fallback para sistemas com permissões limitadas
    path.join(process.cwd(), '..', 'uploads'), // Um nível acima do projeto
    path.join(process.cwd(), 'uploads') // Último recurso dentro do projeto
  ].filter(Boolean);

  for (const uploadPath of possiblePaths) {
    try {
      // Tentar criar o diretório
      if (!fs.existsSync(uploadPath!)) {
        fs.mkdirSync(uploadPath!, { recursive: true });
      }
      
      // Testar se consegue escrever no diretório
      const testFile = path.join(uploadPath!, '.write-test');
      fs.writeFileSync(testFile, 'test');
      fs.unlinkSync(testFile);
      
      console.log(`[UPLOAD] Usando diretório: ${uploadPath}`);
      return uploadPath!;
    } catch (error) {
      console.warn(`[UPLOAD] Não foi possível usar ${uploadPath}:`, error.message);
      continue;
    }
  }
  
  throw new Error('Nenhum diretório de upload válido encontrado');
};

const uploadDir = getUploadDir();

const storage_config = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
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

// Middleware para processar dados do veículo, tanto de FormData quanto JSON direto
const processVehicleData = (req: any, res: any, next: any) => {
  console.log('Processing request body:', req.body);
  
  // Se tiver contentType application/json, já está processado como JSON
  const contentType = req.headers['content-type'] || '';
  
  // Caso 1: Dados no formato FormData com campo vehicleData (abordagem antiga)
  if (req.body && req.body.vehicleData) {
    try {
      req.body = {
        ...req.body,
        ...JSON.parse(req.body.vehicleData)
      };
      console.log('Processed vehicle data from vehicleData field:', req.body);
    } catch (error) {
      console.error('Error parsing vehicleData JSON:', error);
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
  
  // Verifica se o usuário tem papel Operacional
  if (req.user!.role !== 'operational' && req.user!.role !== 'supervisor' && !req.user!.isAdmin) {
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
    let placaPrimeiraCarreta = null;
    let placaSegundaCarreta = null;
    let placaDolly = null;
    let placaPrancha = null;
    let placaReboque = null;

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
        placaPrimeiraCarreta = firstTrailerResult.rows[0].plate;
      }
    }

    if (licenca.secondTrailerId) {
      const secondTrailerQuery = 'SELECT plate FROM vehicles WHERE id = $1';
      const secondTrailerResult = await pool.query(secondTrailerQuery, [licenca.secondTrailerId]);
      if (secondTrailerResult.rows.length > 0) {
        placaSegundaCarreta = secondTrailerResult.rows[0].plate;
      }
    }

    if (licenca.dollyId) {
      const dollyQuery = 'SELECT plate FROM vehicles WHERE id = $1';
      const dollyResult = await pool.query(dollyQuery, [licenca.dollyId]);
      if (dollyResult.rows.length > 0) {
        placaDolly = dollyResult.rows[0].plate;
      }
    }

    if (licenca.flatbedId) {
      const flatbedQuery = 'SELECT plate FROM vehicles WHERE id = $1';
      const flatbedResult = await pool.query(flatbedQuery, [licenca.flatbedId]);
      if (flatbedResult.rows.length > 0) {
        placaPrancha = flatbedResult.rows[0].plate;
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
  console.log(`📡 Enviando atualização WebSocket: ${message.type}`);
  
  wsClients.forEach(client => {
    try {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(message));
      } else {
        wsClients.delete(client);
      }
    } catch (error) {
      console.error('Erro ao enviar mensagem WebSocket:', error);
      wsClients.delete(client);
    }
  });
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
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));
  
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
    ws.send(JSON.stringify({ type: 'CONNECTED', message: 'Conectado ao servidor' }));
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
      
      console.log(`[DASHBOARD NEW] Usuário ${userId} (${userEmail}) role: ${userRole}`);
      
      // Evitar cache
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      
      const isAdmin = userRole === 'admin' || userRole === 'supervisor' || userRole === 'manager' || userRole === 'financial';
      
      if (isAdmin) {
        console.log(`[DASHBOARD NEW] ADMIN - Coletando dados globais`);
        
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
        
        console.log(`[DASHBOARD NEW] ADMIN - Retornando:`, adminStats);
        res.json(adminStats);
        
      } else {
        console.log(`[DASHBOARD NEW] TRANSPORTADOR - Coletando dados específicos do usuário ${userId}`);
        
        // Buscar transportadores associados ao usuário
        const userTransporters = await db.select()
          .from(transporters)
          .where(eq(transporters.userId, userId));
        
        const transporterIds = userTransporters.map(t => t.id);
        console.log(`[DASHBOARD NEW] TRANSPORTADOR - IDs dos transportadores: ${transporterIds.join(', ')}`);
        
        // Buscar apenas veículos do usuário específico
        const userVehicles = await db.select()
          .from(vehicles)
          .where(eq(vehicles.userId, userId));
        
        const userActiveVehicles = userVehicles.filter(v => v.status === 'active');
        
        console.log(`[DASHBOARD NEW] TRANSPORTADOR - Veículos: ${userVehicles.length} total, ${userActiveVehicles.length} ativos`);
        
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
        
        console.log(`[DASHBOARD NEW] TRANSPORTADOR - Licenças encontradas: ${userLicenses.length}`);
        
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
      const stats = await storage.getVehicleStats(userId);
      res.json(stats);
    } catch (error) {
      console.error('Error fetching vehicle stats:', error);
      res.status(500).json({ message: 'Erro ao buscar estatísticas de veículos' });
    }
  });

  app.get('/api/dashboard/state-stats', requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const stats = await storage.getStateStats(userId);
      res.json(stats);
    } catch (error) {
      console.error('Error fetching state stats:', error);
      res.status(500).json({ message: 'Erro ao buscar estatísticas por estado' });
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
    return hasPermission(user.role as UserRole, 'transporters', 'edit');
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
      
      console.log(`[DEBUG VEHICLES] Usuário ${user.email} (ID: ${user.id}, role: ${user.role}) buscando veículos`);
      
      // Se for usuário com papel administrativo, buscar todos os veículos
      if (isAdminUser(user)) {
        console.log(`[DEBUG VEHICLES] Usuário admin - buscando todos os veículos`);
        vehicles = await storage.getAllVehicles();
        console.log(`[DEBUG VEHICLES] Admin encontrou ${vehicles.length} veículos no total`);
      } else {
        console.log(`[DEBUG VEHICLES] Usuário comum - buscando veículos do usuário ${user.id}`);
        
        // Buscar transportadores vinculados ao usuário
        const allTransporters = await storage.getAllTransporters();
        const userTransporters = allTransporters.filter(t => t.userId === user.id);
        
        if (userTransporters.length > 0) {
          console.log(`[DEBUG VEHICLES] Usuário tem ${userTransporters.length} transportadores vinculados`);
          // Se tem transportadores vinculados, buscar veículos associados a esses transportadores
          vehicles = await storage.getVehiclesByUserId(user.id);
        } else {
          console.log(`[DEBUG VEHICLES] Usuário não tem transportadores vinculados, buscando apenas veículos próprios`);
          vehicles = await storage.getVehiclesByUserId(user.id);
        }
        
        console.log(`[DEBUG VEHICLES] Usuário comum encontrou ${vehicles.length} veículos`);
      }
      
      res.json(vehicles);
    } catch (error) {
      console.error('Error fetching vehicles:', error);
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
      const userId = req.user!.id;
      
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
      
      console.log(`Total de rascunhos: ${allDrafts.length}, filtrados: ${drafts.length}, incluindo renovação: ${shouldIncludeRenewalDrafts}`);
      
      // Log detalhado dos rascunhos
      console.log(`[DEBUG DETALHES] Retornando ${drafts.length} licenças com os seguintes IDs:`);
      drafts.forEach(d => {
        console.log(`- ID: ${d.id}, isDraft: ${d.isDraft}, status: ${d.status}, transporterId: ${d.transporterId}, cargoType: ${d.cargoType}, comments: ${d.comments?.substring(0, 30)}`);
      });
      
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
        console.log(`Usuário ${user.id} (${user.role}) tentou submeter rascunho ${draftId} do usuário ${existingDraft.userId}`);
        return res.status(403).json({ message: 'Acesso negado' });
      }
      
      console.log(`Usuário ${user.id} (${user.role}) autorizado a submeter rascunho ${draftId}`);
      
      
      // Garantir que todos os campos obrigatórios não sejam nulos antes de submeter
      const draftData = { ...existingDraft };
      
      if (draftData.type === "flatbed") {
        // Para prancha: verifica requisitos específicos
        console.log("Rascunho para submissão: É prancha");
        if (!draftData.width) draftData.width = 260; // 2.60m padrão
        if (!draftData.height) draftData.height = 440; // 4.40m padrão
        if (!draftData.cargoType) draftData.cargoType = "indivisible_cargo"; // Carga indivisível padrão
      } else if (draftData.type) {
        // Para não-prancha: verifica requisitos gerais
        console.log("Rascunho para submissão: Não é prancha");
        if (!draftData.width) draftData.width = 260; // 2.60m padrão
        if (!draftData.height) draftData.height = 440; // 4.40m padrão
        if (!draftData.cargoType) draftData.cargoType = "dry_cargo"; // Carga seca padrão
      }
      
      // Atualizar o rascunho com os dados sanitizados
      await storage.updateLicenseDraft(draftId, {
        width: draftData.width,
        height: draftData.height,
        cargoType: draftData.cargoType
      });
      
      console.log("Rascunho sanitizado antes de submeter:", draftData);
      
      // Generate a real request number
      const requestNumber = `AET-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`;
      
      // Submit the draft as a real license request
      const licenseRequest = await storage.submitLicenseDraft(draftId, requestNumber);
      
      res.json(licenseRequest);
    } catch (error) {
      console.error('Error submitting license draft:', error);
      res.status(500).json({ message: 'Erro ao enviar solicitação de licença' });
    }
  });
  
  // Novo endpoint específico para submissão de formulário de licença
  app.post('/api/licenses/submit', requireAuth, async (req, res) => {
    try {
      const user = req.user!;
      console.log("Recebendo dados do formulário:", req.body);
      
      const licenseData = { ...req.body };
      console.log("Verificando estados solicitados:", licenseData.requestedStates);
      
      // Se tiver um ID de rascunho, usa o fluxo de submissão de rascunho
      if (licenseData.id) {
        const draftId = licenseData.id;
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
          console.log(`Usuário ${user.id} (${user.role}) tentou submeter rascunho ${draftId} do usuário ${existingDraft.userId}`);
          return res.status(403).json({ message: 'Acesso negado' });
        }
        
        console.log(`Usuário ${user.id} (${user.role}) autorizado a submeter rascunho ${draftId}`);
        
        // Generate a real request number
        const requestNumber = `AET-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`;
        
        // Update the draft with the new data
        await storage.updateLicenseDraft(draftId, {
          ...licenseData,
          isDraft: false,
        });
        
        // Submit the updated draft as a real license request
        const licenseRequest = await storage.submitLicenseDraft(draftId, requestNumber);
        
        console.log("Licença submetida com sucesso:", licenseRequest.id);
        return res.json(licenseRequest);
      } 
      // Caso contrário, cria uma nova licença
      else {
        // Faz as validações básicas necessárias
        if (!licenseData.transporterId) {
          return res.status(400).json({ message: 'Transportador é obrigatório' });
        }
        
        if (!licenseData.type) {
          return res.status(400).json({ message: 'Tipo de conjunto é obrigatório' });
        }
        
        if (!licenseData.requestedStates || licenseData.requestedStates.length === 0) {
          return res.status(400).json({ message: 'Selecione pelo menos um estado' });
        }
        
        // Prepara dados para criar a licença
        const requestNumber = `AET-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`;
        
        // Converte estados solicitados para o formato esperado no backend
        licenseData.states = licenseData.requestedStates || licenseData.states || [];
        console.log("Estados processados para envio:", licenseData.states);
        
        // Define valores padrão se necessário
        if (!licenseData.mainVehiclePlate) {
          licenseData.mainVehiclePlate = "Não especificado";
        }
        
        if (!licenseData.length) {
          licenseData.length = 2000; // 20 metros em centímetros
        }
        
        // Sanitizar campos de dimensões e tipo de carga
        if (licenseData.width === undefined || licenseData.width === null) {
          // Valores padrão com base no tipo de licença
          licenseData.width = licenseData.type === "flatbed" ? 320 : 260; // 3.20m ou 2.60m
        }
        
        if (licenseData.height === undefined || licenseData.height === null) {
          // Valores padrão com base no tipo de licença
          licenseData.height = licenseData.type === "flatbed" ? 495 : 440; // 4.95m ou 4.40m
        }
        
        if (licenseData.cargoType === undefined || licenseData.cargoType === null || licenseData.cargoType === "") {
          // Valores padrão com base no tipo de licença
          licenseData.cargoType = licenseData.type === "flatbed" ? "indivisible_cargo" : "dry_cargo";
        }
        
        console.log("Dados processados para envio:", {
          ...licenseData,
          requestNumber,
          isDraft: false
        });
        
        // Cria a licença
        const licenseRequest = await storage.createLicenseRequest(user.id, {
          ...licenseData,
          requestNumber,
          isDraft: false,
        });
        
        console.log("Nova licença criada com sucesso:", licenseRequest.id);
        return res.json(licenseRequest);
      }
    } catch (error) {
      console.error('Erro ao enviar solicitação de licença:', error);
      res.status(500).json({ message: 'Erro ao enviar solicitação de licença' });
    }
  });

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
        console.log(`[VALIDAÇÃO ESTADO] Nenhuma placa fornecida para validação`);
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
      
      console.log(`[VALIDAÇÃO ESTADO] Query:`, query);
      console.log(`[VALIDAÇÃO ESTADO] Params:`, params);
      
      const result = await pool.query(query, params);
      
      if (result.rows.length > 0) {
        const licenca = result.rows[0];
        const now = new Date();
        const validUntil = new Date(licenca.data_validade);
        const diasRestantes = Math.ceil((validUntil.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        
        console.log(`[VALIDAÇÃO ESTADO] Licença encontrada: ${licenca.numero_licenca}, ${diasRestantes} dias restantes`);
        
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
        console.log(`[VALIDAÇÃO ESTADO] Nenhuma licença vigente encontrada para ${estado}`);
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
      
      console.log(`Total de licenças: ${allLicenses.length}, filtradas: ${licenses.length}, incluindo renovação: ${shouldIncludeRenewalDrafts}`);
      
      res.json(licenses);
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
      
      res.status(201).json(licenseRequest);
    } catch (error) {
      console.error('Error creating license request:', error);
      res.status(500).json({ message: 'Erro ao criar solicitação de licença' });
    }
  });
  
  // Endpoint para enviar um pedido de licença (usado no formulário frontened)
  app.post('/api/licenses/submit', requireAuth, async (req, res) => {
    try {
      console.log('Received submit request with data:', JSON.stringify(req.body, null, 2));
      
      const user = req.user!;
      const userId = user.id;
      const licenseData = { ...req.body };
      
      console.log("Tipo de licença:", licenseData.type);
      console.log("Tipo de carga:", licenseData.cargoType);
      console.log("Comprimento:", licenseData.length);
      console.log("Largura:", licenseData.width);
      console.log("Altura:", licenseData.height);
      
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
      
      if (!licenseData.states || !Array.isArray(licenseData.states)) {
        licenseData.states = licenseData.requestedStates || [];
      }
      
      // Preparando estado das solicitações por estado
      if (!licenseData.stateStatuses) {
        licenseData.stateStatuses = licenseData.states.map((state: string) => `${state}:pending_registration`);
      }
      
      // Ensure additionalPlates is properly formatted
      licenseData.additionalPlates = licenseData.additionalPlates || [];
      
      // Generate a request number
      const requestNumber = `AET-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`;
      
      // Validate license data (partially - since we're more permissive with client-side submissions)
      try {
        // Vamos fazer somente algumas validações básicas
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
        
        if (!licenseData.length || licenseData.length <= 0) {
          return res.status(400).json({ message: "O comprimento deve ser positivo" });
        }
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
      
      // Validação removida - será feita no frontend ao selecionar estados

      const licenseRequest = await storage.createLicenseRequest(userId, sanitizedData);
      
      console.log('License request saved to database:', JSON.stringify(licenseRequest, null, 2));
      
      // Criar registros individuais para cada estado na nova tabela state_licenses
      console.log(`[NOVA ABORDAGEM] Criando registros individuais para estados: ${sanitizedData.states.join(', ')}`);
      
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
    } catch (error) {
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

  // ENDPOINT DE VALIDAÇÃO CRÍTICA DEFINITIVO - EVITA CUSTOS DESNECESSÁRIOS
  app.post('/api/validacao-critica', requireAuth, async (req, res) => {
    try {
      const { estado, placas } = req.body;
      
      console.log(`[VALIDAÇÃO CRÍTICA DEFINITIVA] Estado: ${estado}, Placas: ${placas?.join(', ')}`);
      
      if (!estado || !placas || placas.length === 0) {
        return res.json({ bloqueado: false, message: 'Parâmetros inválidos' });
      }

      // Query SQL DIRETA para máxima confiabilidade  
      const query = `
        SELECT 
          numero_licenca,
          data_validade,
          placa_unidade_tratora,
          placa_primeira_carreta,
          placa_segunda_carreta,
          EXTRACT(DAY FROM (data_validade - CURRENT_DATE)) as dias_restantes
        FROM licencas_emitidas 
        WHERE estado = $1 
          AND status = 'ativa'
          AND data_validade > CURRENT_DATE
          AND (
            placa_unidade_tratora = ANY($2::text[]) OR
            placa_primeira_carreta = ANY($2::text[]) OR
            placa_segunda_carreta = ANY($2::text[])
          )
        ORDER BY data_validade DESC
        LIMIT 1
      `;
      
      const result = await pool.query(query, [estado, placas]);
      
      if (result.rows.length > 0) {
        const licenca = result.rows[0];
        const dias = parseInt(licenca.dias_restantes);
        
        console.log(`[VALIDAÇÃO CRÍTICA] ${estado}: Licença ${licenca.numero_licenca} com ${dias} dias`);
        
        if (dias > 60) {
          console.log(`[VALIDAÇÃO CRÍTICA] ${estado} BLOQUEADO - ${dias} dias > 60`);
          return res.json({
            bloqueado: true,
            numero: licenca.numero_licenca,
            validade: licenca.data_validade,
            diasRestantes: dias,
            placasConflitantes: [
              licenca.placa_unidade_tratora,
              licenca.placa_primeira_carreta, 
              licenca.placa_segunda_carreta
            ].filter(Boolean)
          });
        }
      }
      
      console.log(`[VALIDAÇÃO CRÍTICA] ${estado} LIBERADO`);
      return res.json({ bloqueado: false });
      
    } catch (error) {
      console.error('[VALIDAÇÃO CRÍTICA] Erro:', error);
      return res.json({ bloqueado: false, error: 'Erro na validação' });
    }
  });

  // ENDPOINT ESPECÍFICO POR ESTADO - VALIDAÇÃO CRÍTICA
  app.post('/api/licencas-vigentes-by-state', requireAuth, async (req, res) => {
    try {
      const { estado, placas } = req.body;
      
      if (!estado) {
        return res.status(400).json({ message: 'Estado é obrigatório' });
      }
      
      if (!placas || !Array.isArray(placas) || placas.length === 0) {
        return res.status(400).json({ message: 'Placas são obrigatórias' });
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
      const { states, plates } = req.body;
      
      if (!states || !Array.isArray(states) || states.length === 0) {
        return res.status(400).json({ message: 'Estados são obrigatórios' });
      }
      
      if (!plates || !Array.isArray(plates) || plates.length === 0) {
        return res.status(400).json({ message: 'Placas são obrigatórias' });
      }
      
      console.log(`[VALIDAÇÃO DEFINITIVA] Verificando conflitos para estados: ${states.join(', ')} e placas: ${plates.join(', ')}`);
      
      const conflicts = [];
      
      // Para cada estado, verificar licenças ativas na tabela licencas_emitidas
      for (const state of states) {
        console.log(`[VALIDAÇÃO DEFINITIVA] Verificando estado: ${state}`);
        
        const query = `
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
        
        const result = await pool.query(query, [state, plates]);
        
        console.log(`[VALIDAÇÃO DEFINITIVA] Estado ${state}: encontradas ${result.rows.length} licenças ativas`);
        
        for (const license of result.rows) {
          const daysUntilExpiry = parseInt(license.dias_restantes);
          console.log(`[VALIDAÇÃO DEFINITIVA] Licença ${license.numero_licenca}: ${daysUntilExpiry} dias restantes`);
          
          // REGRA CRÍTICA: bloquear se tiver mais de 60 dias para evitar custos
          if (daysUntilExpiry > 60) {
            console.log(`[VALIDAÇÃO DEFINITIVA] Estado ${state} BLOQUEADO: ${daysUntilExpiry} dias > 60 - EVITANDO CUSTO DESNECESSÁRIO`);
            conflicts.push({
              state: state,
              licenseNumber: license.numero_licenca,
              expiryDate: license.data_validade,
              daysUntilExpiry: daysUntilExpiry,
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
            .where(eq(licenseRequests.isDraft, false))
            .where(
              or(
                eq(licenseRequests.userId, user.id),
                inArray(licenseRequests.transporterId, transporterIds)
              )
            );
            
          console.log(`[DEBUG LICENÇAS EMITIDAS] Encontradas ${licencasNoBanco.length} licenças para usuário ${user.id} ou transportadores ${transporterIds.join(', ')}`);
        } else {
          // Se não houver transportadores, buscar apenas por userId
          licencasNoBanco = await db.select()
            .from(licenseRequests)
            .where(eq(licenseRequests.isDraft, false))
            .where(eq(licenseRequests.userId, user.id));
            
          console.log(`[DEBUG LICENÇAS EMITIDAS] Encontradas ${licencasNoBanco.length} licenças para usuário ${user.id} sem transportadores associados`);
        }
        
        // Filtrar licenças com estado aprovado manualmente
        issuedLicenses = licencasNoBanco.filter(lic => {
          // Verificar estados aprovados
          return lic.stateStatuses && 
                 Array.isArray(lic.stateStatuses) && 
                 lic.stateStatuses.some(ss => ss.includes(':approved'));
        });
        
        console.log(`[DEBUG LICENÇAS EMITIDAS] Total de licenças emitidas para o usuário ${user.id}: ${issuedLicenses.length}`);
      }
      
      // Log das licenças que serão retornadas
      console.log(`[DEBUG LICENÇAS EMITIDAS] Retornando ${issuedLicenses.length} licenças emitidas`);
      console.log(`[DEBUG LICENÇAS EMITIDAS] IDs: ${issuedLicenses.map(l => l.id).join(', ')}`);
      
      res.json(issuedLicenses);
    } catch (error) {
      console.error('Error fetching issued licenses:', error);
      res.status(500).json({ message: 'Erro ao buscar licenças emitidas' });
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
      
      // Log para diagnóstico
      if (licenses.length > 0) {
        // Get direct database row of last license for comparison
        const lastLicenseId = licenses[licenses.length - 1].id;
        const dbResult = await db.select().from(licenseRequests).where(eq(licenseRequests.id, lastLicenseId));
        
        console.log("Licença exemplo recuperada:", JSON.stringify(licenses[licenses.length - 1], null, 2));
        console.log("Mesma licença diretamente do banco de dados:", JSON.stringify(dbResult[0], null, 2));
      }
      
      console.log(`Total de licenças admin: ${allLicenses.length}, filtradas: ${licenses.length}, incluindo renovação: ${shouldIncludeRenewalDrafts}`);
      
      res.json(licenses);
    } catch (error) {
      console.error('Error fetching all license requests:', error);
      res.status(500).json({ message: 'Erro ao buscar todas as solicitações de licenças' });
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
          vehicleData = JSON.parse(req.body.vehicleData);
        } catch (err) {
          console.error("Erro ao processar JSON de dados do veículo:", err);
          return res.status(400).json({ message: "Dados do veículo inválidos" });
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
  
  // Rota para listagem de usuários (transportadores)
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
        if (transporter.documents) {
          existingDocuments = JSON.parse(transporter.documents as string);
        }
      } catch (e) {
        console.error("Erro ao processar documentos existentes:", e);
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
          const parsedSubsidiaries = JSON.parse(transporterData.subsidiaries);
          transporterData.subsidiaries = JSON.stringify(parsedSubsidiaries);
        } catch (e) {
          console.error("Erro ao processar subsidiárias:", e);
          // Manter as subsidiárias existentes se houver erro
          if (transporter.subsidiaries) {
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
      const statusData: {
        status: LicenseStatus;
        comments: string;
        validUntil?: string;
        state?: string; // Agora exigimos um estado específico
        aetNumber?: string; // Número AET específico do estado
      } = {
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
      if (!existingLicense.states.includes(statusData.state)) {
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
        state: statusData.state,
        stateStatus: statusData.status,
        comments: statusData.comments,
        validUntil: statusData.validUntil,
        issuedAt: statusData.issuedAt,
        aetNumber: statusData.aetNumber,
        selectedCnpj: statusData.selectedCnpj,
        stateFile: file
      });
      
      // Registrar mudança no histórico de status
      await storage.createStatusHistory({
        licenseId: updatedLicense.id,
        state: statusData.state,
        userId: req.user!.id,
        oldStatus: previousStateStatus,
        newStatus: statusData.status,
        comments: statusData.comments || null,
        createdAt: new Date()
      });
      
      console.log(`Histórico de status criado para licença ${licenseId}, estado ${statusData.state}: ${previousStateStatus} -> ${statusData.status}`);
      
      // Se o status foi alterado para 'approved' ou 'released', sincronizar com licencas_emitidas
      if ((statusData.status === 'approved' || statusData.status === 'released') && statusData.validUntil && statusData.aetNumber) {
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
        state: statusData.state,
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
  app.patch('/api/admin/licenses/:id/state-status', requireOperational, upload.single('stateFile'), async (req, res) => {
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
      
      // Adicionar arquivo se fornecido
      let file: Express.Multer.File | undefined = undefined;
      if (req.file) {
        file = req.file;
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
      });
      
      // Registrar mudança no histórico de status
      await storage.createStatusHistory({
        licenseId: updatedLicense.id,
        state: stateStatusData.state,
        userId: req.user!.id,
        oldStatus: previousStateStatus,
        newStatus: stateStatusData.status,
        comments: stateStatusData.comments || null,
        createdAt: new Date()
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
        width: width !== undefined ? Number(width) : null,
        height: height !== undefined ? Number(height) : null,
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
      cb(new Error('Apenas arquivos PDF são aceitos'), false);
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

  // Verificar licenças vigentes por estado e placas
  app.post("/api/licenses/check-existing", requireAuth, async (req, res) => {
    try {
      const { placas, estados } = req.body;
      
      console.log("[VALIDAÇÃO] Recebendo verificação de licenças:", { placas, estados });
      
      if (!placas || !Array.isArray(placas) || placas.length === 0) {
        return res.status(400).json({ message: "Placas são obrigatórias" });
      }
      
      if (!estados || !Array.isArray(estados) || estados.length === 0) {
        return res.status(400).json({ message: "Estados são obrigatórios" });
      }
      
      const conflitos: any[] = [];
      const hoje = new Date();
      const limiteRenovacao = new Date(hoje.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 dias no futuro
      
      console.log("[VALIDAÇÃO] Data atual:", hoje.toISOString());
      console.log("[VALIDAÇÃO] Limite renovação (30 dias):", limiteRenovacao.toISOString());
      console.log("[VALIDAÇÃO] Placas para verificar:", placas);
      console.log("[VALIDAÇÃO] Estados para verificar:", estados);
      
      // Buscar todas as licenças aprovadas vigentes
      const todasLicencas = await db
        .select()
        .from(licenseRequests)
        .where(
          and(
            eq(licenseRequests.status, 'approved'),
            eq(licenseRequests.isDraft, false)
          )
        );
      
      console.log(`[VALIDAÇÃO] Total de licenças aprovadas:`, todasLicencas.length);
      
      // Para cada estado selecionado, verificar individualmente
      for (const estado of estados) {
        console.log(`[VALIDAÇÃO] Verificando estado individual: ${estado}`);
        
        // Buscar licenças que incluem este estado específico
        for (const licenca of todasLicencas) {
          console.log(`[VALIDAÇÃO] Analisando licença ${licenca.id} - Estados: ${JSON.stringify(licenca.states)} - Placa principal: ${licenca.mainVehiclePlate}`);
          
          // Verificar se a licença inclui este estado específico
          if (!licenca.states || !licenca.states.includes(estado)) {
            console.log(`[VALIDAÇÃO] Licença ${licenca.id} não inclui estado ${estado} - PULAR`);
            continue;
          }
          
          console.log(`[VALIDAÇÃO] ✓ Licença ${licenca.id} inclui estado ${estado}`);
          
          // Verificar se alguma placa da nova solicitação conflita
          const placaConflitante = placas.find(placa => {
            const conflito = placa === licenca.mainVehiclePlate || 
              (licenca.additionalPlates && licenca.additionalPlates.includes(placa));
            console.log(`[VALIDAÇÃO] Comparando placa ${placa} com licença ${licenca.id}: placa principal=${licenca.mainVehiclePlate}, conflito=${conflito}`);
            return conflito;
          });
          
          if (!placaConflitante) {
            console.log(`[VALIDAÇÃO] Licença ${licenca.id} não tem conflito de placas - PULAR`);
            continue;
          }
          
          console.log(`[VALIDAÇÃO] ⚠️  CONFLITO DE PLACA DETECTADO! Licença ${licenca.id}, estado ${estado}, placa ${placaConflitante}`);
          
          // Verificar se há status aprovado para este estado específico
          let dataValidadeEstado = null;
          let statusIndividual = null;
          
          // Procurar por status individual do estado
          if (licenca.stateStatuses && licenca.stateStatuses.length > 0) {
            statusIndividual = licenca.stateStatuses.find(status => 
              status.startsWith(`${estado}:approved`)
            );
            
            if (statusIndividual) {
              console.log(`[VALIDAÇÃO] Status individual encontrado para ${estado}:`, statusIndividual);
              
              // Extrair data de validade específica do estado
              const statusParts = statusIndividual.split(':');
              if (statusParts.length > 2 && statusParts[2]) {
                try {
                  dataValidadeEstado = new Date(statusParts[2]);
                  console.log(`[VALIDAÇÃO] Data extraída do status individual:`, dataValidadeEstado);
                } catch (e) {
                  console.log(`[VALIDAÇÃO] Erro ao parsear data do status:`, statusParts[2]);
                }
              }
            }
          }
          
          // Se não tem status individual mas tem aprovação geral
          if (!dataValidadeEstado && licenca.status === 'approved' && licenca.validUntil) {
            dataValidadeEstado = new Date(licenca.validUntil);
            console.log(`[VALIDAÇÃO] Usando data geral da licença:`, dataValidadeEstado);
          }
          
          if (!dataValidadeEstado) {
            console.log(`[VALIDAÇÃO] Licença ${licenca.id} sem data de validade válida`);
            continue;
          }
          
          // Verificar se ainda está válida
          if (dataValidadeEstado <= hoje) {
            console.log(`[VALIDAÇÃO] Licença ${licenca.id} expirada para ${estado}`);
            continue;
          }
          
          // Verificar se a licença no estado específico tem mais de 30 dias até vencer
          const diasRestantes = Math.ceil((dataValidadeEstado.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
          console.log(`[VALIDAÇÃO] Dias restantes para ${estado}:`, diasRestantes);
          
          if (diasRestantes > 30) {
            console.log(`[VALIDAÇÃO] CONFLITO CONFIRMADO! Estado ${estado}, licença ${licenca.id}, dias restantes: ${diasRestantes}`);
            
            conflitos.push({
              estado,
              licenca: {
                id: licenca.id,
                requestNumber: licenca.requestNumber,
                mainVehiclePlate: licenca.mainVehiclePlate,
                validUntil: dataValidadeEstado,
                diasRestantes,
                placasConflitantes: [placaConflitante],
                statusIndividual: statusIndividual || `${estado}:approved`
              }
            });
          } else {
            console.log(`[VALIDAÇÃO] Estado ${estado} da licença ${licenca.id} pode ser renovado (${diasRestantes} dias restantes)`);
          }
        }
      }
      
      console.log(`[VALIDAÇÃO] Total de conflitos encontrados:`, conflitos.length);
      
      res.json({ conflitos });
    } catch (error) {
      console.error("Erro ao verificar licenças existentes:", error);
      res.status(500).json({ message: "Erro ao verificar licenças existentes" });
    }
  });

  // Listar todos os boletos (apenas admin e financial) com filtros
  app.get("/api/boletos", requireAuth, async (req, res) => {
    const user = req.user!;
    
    if (!canAccessFinancial(user)) {
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
  app.post("/api/boletos", requireAuth, requirePermission('financial', 'create'), async (req, res) => {

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

  // Servir arquivos de upload da pasta externa
  app.use('/uploads', express.static(uploadDir));
  
  // Log da configuração final de uploads
  console.log(`[UPLOAD] Servindo arquivos de ${uploadDir} em /uploads`);

  return httpServer;
}
