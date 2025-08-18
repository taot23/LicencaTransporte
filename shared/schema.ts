import { pgTable, text, serial, integer, boolean, timestamp, json, index, uniqueIndex, numeric, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Define enum para os tipos de role/perfil de usuário
export const userRoleEnum = z.enum([
  "admin", // Administrador (acesso completo)
  "operational", // Operacional (gerenciamento de licenças e veículos)
  "supervisor", // Supervisor (papel intermediário)
  "manager", // Gerente (papel com permissões estendidas)
  "financial", // Financeiro (acesso a transportadores, usuários e boletos)
  "user" // Usuário transportador padrão
]);

export type UserRole = z.infer<typeof userRoleEnum>;

// Define enum para tipos de pessoa
export const personTypeEnum = z.enum([
  "pj", // Pessoa Jurídica
  "pf"  // Pessoa Física
]);

export type PersonType = z.infer<typeof personTypeEnum>;

// Transportador model
export const transporters = pgTable("transporters", {
  id: serial("id").primaryKey(),
  personType: text("person_type").notNull(), // PJ ou PF
  
  // Campos comuns
  name: text("name").notNull(), // Razão Social (PJ) ou Nome Completo (PF)
  documentNumber: text("document_number").notNull().unique(), // CNPJ ou CPF
  email: text("email").notNull(),
  phone: text("phone"),
  
  // Campos específicos PJ
  tradeName: text("trade_name"), // Nome Fantasia
  legalResponsible: text("legal_responsible"), // Responsável Legal
  
  // Campos específicos PF
  birthDate: text("birth_date"), // Data de Nascimento para PF
  nationality: text("nationality"), // Nacionalidade para PF
  idNumber: text("id_number"), // RG para PF
  idIssuer: text("id_issuer"), // Órgão Emissor do RG
  idState: text("id_state"), // UF do RG
  
  // Endereço
  street: text("street"), // Logradouro
  number: text("number"), // Número
  complement: text("complement"), // Complemento
  district: text("district"), // Bairro
  zipCode: text("zip_code"), // CEP
  city: text("city"), // Cidade
  state: text("state"), // UF
  
  // Filiais (apenas para PJ)
  subsidiaries: json("subsidiaries").default('[]'), // Array com filiais (CNPJ, nome, endereço, etc)
  
  // Arquivos
  documents: json("documents").default('[]'), // URLs dos documentos anexados
  
  // Campo para retro-compatibilidade
  contact1Name: text("contact1_name"),
  contact1Phone: text("contact1_phone"),
  contact2Name: text("contact2_name"),
  contact2Phone: text("contact2_phone"),
  
  userId: integer("user_id").references(() => users.id), // Referência para o usuário vinculado
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => {
  return {
    // Índices básicos mantidos
    documentNumberIdx: uniqueIndex("idx_transporter_document").on(table.documentNumber),
    userIdIdx: index("idx_transporter_user_id").on(table.userId),
    nameIdx: index("idx_transporter_name").on(table.name),
    
    // Índices compostos para otimização de buscas
    searchOptimizedIdx: index("idx_transporter_search").on(table.name, table.documentNumber, table.tradeName),
    personTypeNameIdx: index("idx_transporter_type_name").on(table.personType, table.name)
  };
});

// Esquema JSON para filiais (subsidiárias)
export const subsidiarySchema = z.object({
  cnpj: z.string().min(14, "CNPJ deve ter pelo menos 14 dígitos"),
  name: z.string().min(3, "Razão social deve ter pelo menos 3 caracteres"),
  tradeName: z.string().optional(),
  street: z.string().optional(),
  number: z.string().optional(),
  complement: z.string().optional(),
  zipCode: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  documents: z.array(z.string()).optional().default([]),
});

// Esquema JSON para documentos
export const documentSchema = z.object({
  type: z.string(), // "social_contract", "power_of_attorney", etc.
  url: z.string(),
  filename: z.string(),
});

// Schema para inserção/atualização de transportador
export const insertTransporterSchema = z.object({
  personType: personTypeEnum,
  
  // Campos comuns
  name: z.string().min(3, "Nome/Razão Social deve ter pelo menos 3 caracteres"),
  documentNumber: z.string().min(11, "Documento deve ter pelo menos 11 dígitos"),
  email: z.string().email("Email inválido"),
  phone: z.string().optional(),
  
  // Campos específicos PJ
  tradeName: z.string().optional(),
  legalResponsible: z.string().optional(),
  
  // Campos específicos PF
  birthDate: z.string().optional(),
  nationality: z.string().optional(),
  idNumber: z.string().optional(),
  idIssuer: z.string().optional(),
  idState: z.string().optional(),
  
  // Endereço
  street: z.string().optional(),
  number: z.string().optional(),
  complement: z.string().optional(),
  district: z.string().optional(),
  zipCode: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  
  // Filiais (apenas para PJ)
  subsidiaries: z.array(subsidiarySchema).optional().default([]),
  
  // Arquivos
  documents: z.array(documentSchema).optional().default([]),
  
  // Campos para retro-compatibilidade
  contact1Name: z.string().optional(),
  contact1Phone: z.string().optional(),
  contact2Name: z.string().optional(),
  contact2Phone: z.string().optional(),
});

// User model
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  fullName: text("full_name").notNull(),
  phone: text("phone").notNull(),
  role: text("role").default("user").notNull(), // Novo campo: role como string (enum)
  isAdmin: boolean("is_admin").default(false).notNull(), // Mantido para compatibilidade
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => {
  return {
    emailIdx: uniqueIndex("idx_user_email").on(table.email),
    roleIdx: index("idx_user_role").on(table.role)
  };
});

export const insertUserSchema = createInsertSchema(users).pick({
  email: true,
  password: true,
  fullName: true,
  phone: true,
}).extend({
  role: userRoleEnum.optional().default("user"),
});

// Vehicle model
export const vehicles = pgTable("vehicles", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  plate: text("plate").notNull(),
  type: text("type").notNull(), // Unidade Tratora, Semirreboque, Reboque, Dolly, Prancha
  bodyType: text("body_type"), // Tipo de Carroceria: ABERTA, BASCULANTE, PORTA-CONTÊINER, FECHADA, TANQUE
  brand: text("brand"),
  model: text("model"),
  year: integer("year"),
  renavam: text("renavam"),
  tare: numeric("tare").notNull(), // peso em kg
  axleCount: integer("axle_count"), // Quantidade de eixos
  remarks: text("remarks"),
  crlvYear: integer("crlv_year").notNull(),
  crlvUrl: text("crlv_url"),
  ownerName: text("owner_name"), // Nome do Proprietário
  ownershipType: text("ownership_type").default("proprio").notNull(), // "proprio" ou "terceiro"
  cmt: numeric("cmt", { precision: 10, scale: 2 }), // Capacidade Máxima de Tração (apenas para unidade tratora)
  status: text("status").default("active").notNull(),
}, (table) => {
  return {
    // Índices básicos mantidos
    plateIdx: index("idx_vehicle_plate").on(table.plate),
    userIdIdx: index("idx_vehicle_user_id").on(table.userId),
    statusIdx: index("idx_vehicle_status").on(table.status),
    typeIdx: index("idx_vehicle_type").on(table.type),
    
    // Índices compostos para otimização de consultas frequentes
    userStatusIdx: index("idx_vehicle_user_status").on(table.userId, table.status),
    plateUserIdx: index("idx_vehicle_plate_user").on(table.plate, table.userId),
    searchOptimizedIdx: index("idx_vehicle_search").on(table.plate, table.brand, table.model, table.type),
    typeStatusIdx: index("idx_vehicle_type_status").on(table.type, table.status)
  };
});

export const insertVehicleSchema = createInsertSchema(vehicles)
  .omit({ id: true, userId: true })
  .extend({
    // Campos obrigatórios com validações
    plate: z.string().min(1, "A placa é obrigatória"),
    type: z.string().min(1, "O tipo de veículo é obrigatório"),
    bodyType: z.string().optional(), // Tipo de carroceria
    renavam: z.string().min(1, "O RENAVAM é obrigatório"),
    brand: z.string().min(1, "A marca é obrigatória"),
    model: z.string().min(1, "O modelo é obrigatório"),
    tare: z.coerce.number().min(1, "A tara deve ser maior que zero"),
    axleCount: z.coerce.number().min(1, "A quantidade de eixos deve ser maior que zero"),
    year: z.coerce.number().min(1950, "O ano de fabricação é obrigatório"),
    crlvYear: z.coerce.number().optional(),
    remarks: z.string().optional(),
    status: z.string().optional(),
    crlvFile: z.any().optional(),
    ownerName: z.string().optional(), // Nome do Proprietário
    ownershipType: z.enum(["proprio", "terceiro"]).default("proprio"), // Tipo de propriedade
    cmt: z.union([z.string(), z.number()]).pipe(z.coerce.number().positive()).optional(), // Capacidade Máxima de Tração (apenas para unidade tratora)
  });

// Enums for license status
export const licenseStatusEnum = z.enum([
  "pending_registration", // Pedido em Cadastramento
  "registration_in_progress", // Cadastro em Andamento
  "pending_documentation", // Pendente Documentação
  "rejected", // Reprovado - Pendência de Documentação
  "under_review", // Análise do Órgão
  "pending_approval", // Pendente Liberação
  "approved", // Liberada
  "canceled", // Cancelado
]);

export type LicenseStatus = z.infer<typeof licenseStatusEnum>;

// License type enum
export const licenseTypeEnum = z.enum([
  "roadtrain_9_axles", // Rodotrem 9 eixos
  "bitrain_9_axles", // Bitrem 9 eixos
  "bitrain_7_axles", // Bitrem 7 eixos 
  "bitrain_6_axles", // Bitrem 6 eixos
  "flatbed", // Prancha
  "romeo_and_juliet", // Romeu e Julieta
]);

export type LicenseType = z.infer<typeof licenseTypeEnum>;

// Cargo type enums
export const nonFlatbedCargoTypeEnum = z.enum([
  "dry_cargo", // Carga Seca
  "liquid_cargo", // Líquida
  "live_cargo", // Viva
  "sugar_cane", // Cana de Açúcar
]);

export const flatbedCargoTypeEnum = z.enum([
  "indivisible_cargo", // Carga Indivisível
  "agricultural_machinery", // Máquinas Agrícolas
  "oversized", // SUPERDIMENSIONADA
]);

export const cargoTypeEnum = z.union([nonFlatbedCargoTypeEnum, flatbedCargoTypeEnum]);

export type NonFlatbedCargoType = z.infer<typeof nonFlatbedCargoTypeEnum>;
export type FlatbedCargoType = z.infer<typeof flatbedCargoTypeEnum>;
export type CargoType = z.infer<typeof cargoTypeEnum>;

// License requests model
export const licenseRequests = pgTable("license_requests", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  transporterId: integer("transporter_id").references(() => transporters.id),
  requestNumber: text("request_number").notNull().unique(),
  type: text("type").notNull(), // From licenseTypeEnum
  mainVehiclePlate: text("main_vehicle_plate").notNull(),
  tractorUnitId: integer("tractor_unit_id").references(() => vehicles.id),
  firstTrailerId: integer("first_trailer_id").references(() => vehicles.id),
  dollyId: integer("dolly_id").references(() => vehicles.id),
  secondTrailerId: integer("second_trailer_id").references(() => vehicles.id),
  firstTrailerManualPlate: text("first_trailer_manual_plate"), // Placa manual para 1ª carreta
  dollyManualPlate: text("dolly_manual_plate"), // Placa manual para dolly
  secondTrailerManualPlate: text("second_trailer_manual_plate"), // Placa manual para 2ª carreta
  flatbedId: integer("flatbed_id").references(() => vehicles.id),
  length: integer("length").notNull(), // total length in cm
  width: integer("width"), // width in cm
  height: integer("height"), // height in cm
  cargoType: text("cargo_type"), // tipo de carga (union de nonFlatbedCargoType e flatbedCargoType)
  additionalPlates: text("additional_plates").array(), // Lista de placas adicionais 
  additionalPlatesDocuments: text("additional_plates_documents").array(), // URLs dos documentos das placas adicionais
  states: text("states").array().notNull(),
  status: text("status").default("pending_registration").notNull(), // Status principal (legado)
  stateStatuses: text("state_statuses").array(), // Array com formato "ESTADO:STATUS" (ex: "SP:approved")
  stateFiles: text("state_files").array(), // Array com formato "ESTADO:URL" (ex: "SP:http://...pdf")
  stateAETNumbers: text("state_aet_numbers").array(), // Array com formato "ESTADO:NUMERO_AET" (ex: "SP:123456")
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  isDraft: boolean("is_draft").default(true).notNull(),
  comments: text("comments"),
  licenseFileUrl: text("license_file_url").default(''),
  validUntil: timestamp("valid_until"),
  issuedAt: timestamp("issued_at"),
  aetNumber: text("aet_number"),
  selectedCnpj: text("selected_cnpj"), // CNPJ selecionado da empresa transportadora (global - legado)
  stateCnpjs: text("state_cnpjs").array(), // Array com formato "ESTADO:CNPJ" (ex: "SP:12345678000100")
}, (table) => {
  return {
    requestNumberIdx: uniqueIndex("idx_license_request_number").on(table.requestNumber),
    userIdIdx: index("idx_license_user_id").on(table.userId),
    transporterIdIdx: index("idx_license_transporter_id").on(table.transporterId),
    statusIdx: index("idx_license_status").on(table.status),
    isDraftIdx: index("idx_license_is_draft").on(table.isDraft),
    createdAtIdx: index("idx_license_created_at").on(table.createdAt),
    mainVehiclePlateIdx: index("idx_license_main_vehicle").on(table.mainVehiclePlate)
  };
});

export const insertLicenseRequestSchema = createInsertSchema(licenseRequests)
  .omit({ 
    id: true, 
    userId: true, 
    requestNumber: true, 
    createdAt: true, 
    updatedAt: true, 
    licenseFileUrl: true, 
    validUntil: true,
    aetNumber: true,
    stateAETNumbers: true
  })
  .extend({
    transporterId: z.number().positive("Um transportador deve ser selecionado"),
    states: z.array(z.string()).min(1, "Selecione pelo menos um estado"),
    cargoType: cargoTypeEnum.refine(val => !!val, {
      message: "O tipo de carga é obrigatório",
      path: ["cargoType"]
    }),
    length: z.coerce.number()
      .positive("O comprimento deve ser positivo")
      .min(19.8, "O comprimento deve ser de no mínimo 19,80 metros")
      .max(30.0, "O comprimento deve ser de no máximo 30,00 metros"),
    width: z.coerce.number()
      .positive("A largura deve ser um valor positivo")
      .max(3.20, "A largura máxima permitida é 3,20 metros"),
    height: z.coerce.number()
      .positive("A altura deve ser um valor positivo")
      .max(4.95, "A altura máxima permitida é 4,95 metros"),
    additionalPlates: z.array(z.string()).optional().default([]),
    additionalPlatesDocuments: z.array(z.string()).optional().default([]),
    firstTrailerManualPlate: z.string().optional(),
    dollyManualPlate: z.string().optional(),
    secondTrailerManualPlate: z.string().optional(),
  });

export const insertDraftLicenseSchema = insertLicenseRequestSchema.partial().extend({
  type: licenseTypeEnum,
  isDraft: z.literal(true),
});

export const updateLicenseStatusSchema = createInsertSchema(licenseRequests)
  .pick({
    status: true,
    comments: true,
  })
  .extend({
    licenseFile: z.any().optional(),
    validUntil: z.string().optional(),
    issuedAt: z.string().optional(),
    state: z.string().optional(), // Estado específico sendo atualizado
    stateStatus: z.enum(licenseStatusEnum.options).optional(), // Status para o estado específico
    stateFile: z.any().optional(), // Arquivo para o estado específico
    selectedCnpj: z.string().optional(), // CNPJ selecionado da empresa transportadora (global - legado)
    stateCnpj: z.string().optional(), // CNPJ específico para este estado
    aetNumber: z.string().optional(), // Número AET
  });

// Schema para quando todos os estados forem setados, atualizar o status geral
export const updateLicenseStateSchema = z.object({
  licenseId: z.number(),
  state: z.string(),
  status: licenseStatusEnum,
  file: z.any().optional(),
  comments: z.string().optional(),
  validUntil: z.string().optional(),
  issuedAt: z.string().optional(),
  aetNumber: z.string().optional(), // Número da AET para o status "Análise do Órgão"
  selectedCnpj: z.string().optional(), // CNPJ selecionado da empresa transportadora (global - legado)
  stateCnpj: z.string().optional(), // CNPJ específico para este estado
});

// Type definitions
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Transporter = typeof transporters.$inferSelect;
export type InsertTransporter = z.infer<typeof insertTransporterSchema>;

export type Vehicle = typeof vehicles.$inferSelect;
export type InsertVehicle = z.infer<typeof insertVehicleSchema>;

export type LicenseRequest = typeof licenseRequests.$inferSelect;
export type InsertLicenseRequest = z.infer<typeof insertLicenseRequestSchema>;
export type InsertDraftLicense = z.infer<typeof insertDraftLicenseSchema>;
export type UpdateLicenseStatus = z.infer<typeof updateLicenseStatusSchema>;
export type UpdateLicenseState = z.infer<typeof updateLicenseStateSchema>;

// Estados disponíveis para solicitação de licenças AET
export const brazilianStates = [
  { code: "AL", name: "Alagoas" },
  { code: "BA", name: "Bahia" },
  { code: "CE", name: "Ceará" },
  { code: "DF", name: "Distrito Federal" },
  { code: "DNIT", name: "FEDERAL" },
  { code: "ES", name: "Espírito Santo" },
  { code: "GO", name: "Goiás" },
  { code: "MG", name: "Minas Gerais" },
  { code: "MS", name: "Mato Grosso do Sul" },
  { code: "MT", name: "Mato Grosso" },
  { code: "PA", name: "Pará" },
  { code: "PE", name: "Pernambuco" },
  { code: "PR", name: "Paraná" },
  { code: "RJ", name: "Rio de Janeiro" },
  { code: "RS", name: "Rio Grande do Sul" },
  { code: "SC", name: "Santa Catarina" },
  { code: "SE", name: "Sergipe" },
  { code: "SP", name: "São Paulo" },
  { code: "TO", name: "Tocantins" },
];

// Todos os estados brasileiros (em ordem alfabética) para cadastro de endereço
export const allBrazilianStates = [
  { code: "AC", name: "Acre" },
  { code: "AL", name: "Alagoas" },
  { code: "AP", name: "Amapá" },
  { code: "AM", name: "Amazonas" },
  { code: "BA", name: "Bahia" },
  { code: "CE", name: "Ceará" },
  { code: "DF", name: "Distrito Federal" },
  { code: "ES", name: "Espírito Santo" },
  { code: "GO", name: "Goiás" },

  { code: "MT", name: "Mato Grosso" },
  { code: "MS", name: "Mato Grosso do Sul" },
  { code: "MG", name: "Minas Gerais" },
  { code: "PA", name: "Pará" },
  { code: "PB", name: "Paraíba" },
  { code: "PR", name: "Paraná" },
  { code: "PE", name: "Pernambuco" },
  { code: "PI", name: "Piauí" },
  { code: "RJ", name: "Rio de Janeiro" },
  { code: "RN", name: "Rio Grande do Norte" },
  { code: "RS", name: "Rio Grande do Sul" },
  { code: "RO", name: "Rondônia" },
  { code: "RR", name: "Roraima" },
  { code: "SC", name: "Santa Catarina" },
  { code: "SP", name: "São Paulo" },
  { code: "SE", name: "Sergipe" },
  { code: "TO", name: "Tocantins" },
];

// Enum para tipo de veículo
export const vehicleTypeEnum = z.enum([
  "tractor_unit", // Unidade Tratora (Cavalo)
  "truck", // Caminhão
  "semi_trailer", // Semirreboque
  "trailer", // Reboque
  "dolly", // Dolly
  "flatbed", // Prancha
]);

export type VehicleType = z.infer<typeof vehicleTypeEnum>;

// Opções de veículos para interface
export const vehicleTypeOptions = [
  { value: "tractor_unit", label: "Unidade Tratora (Cavalo)" },
  { value: "truck", label: "Caminhão" },
  { value: "semi_trailer", label: "Semirreboque" },
  { value: "trailer", label: "Reboque" },
  { value: "dolly", label: "Dolly" },
  { value: "flatbed", label: "Prancha" },
];

// Enum para tipos de carroceria
export const vehicleBodyTypeEnum = z.enum([
  "open", // Aberta
  "dump", // Basculante
  "cattle", // Boiadeiro
  "sugar_cane", // Cana de Açúcar
  "container", // Container
  "closed", // Fechada
  "mechanical_operational", // Mecânico operacional
  "platform", // Plataforma
  "flatbed", // Prancha
  "car_carrier", // Prancha - Cegonha
  "extendable_flatbed", // Prancha Extensiva
  "dump_truck", // Rodo Caçamba
  "roll_on_roll_off", // Rollon Rollof
  "silo", // SILO
  "mobile_substation", // Subestação Móvel
  "tank", // Tanque
  "log_carrier", // Tran Toras
  "vtav", // VTAV
]);

export type VehicleBodyType = z.infer<typeof vehicleBodyTypeEnum>;

// Status History model
export const statusHistories = pgTable("status_histories", {
  id: serial("id").primaryKey(),
  licenseId: integer("license_id").notNull().references(() => licenseRequests.id),
  userId: integer("user_id").notNull().references(() => users.id),
  state: text("state").notNull(), // Estado da federação: SP, MG, etc.
  oldStatus: text("old_status").notNull(), // Status anterior
  newStatus: text("new_status").notNull(), // Novo status
  comments: text("comments"), // Comentários/observações sobre a alteração
  createdAt: timestamp("created_at").defaultNow().notNull(), // Data/hora da alteração
}, (table) => {
  return {
    licenseIdIdx: index("idx_history_license_id").on(table.licenseId),
    userIdIdx: index("idx_history_user_id").on(table.userId),
    stateIdx: index("idx_history_state").on(table.state),
    createdAtIdx: index("idx_history_created_at").on(table.createdAt)
  };
});

export const insertStatusHistorySchema = createInsertSchema(statusHistories)
  .omit({ id: true, createdAt: true });

export type StatusHistory = typeof statusHistories.$inferSelect;
export type InsertStatusHistory = z.infer<typeof insertStatusHistorySchema>;

export const bodyTypeOptions = [
  { value: "open", label: "Aberta" },
  { value: "dump", label: "Basculante" },
  { value: "cattle", label: "Boiadeiro" },
  { value: "sugar_cane", label: "Cana de Açúcar" },
  { value: "container", label: "Container" },
  { value: "closed", label: "Fechada" },
  { value: "mechanical_operational", label: "Mecânico operacional" },
  { value: "platform", label: "Plataforma" },
  { value: "flatbed", label: "Prancha" },
  { value: "car_carrier", label: "Prancha - Cegonha" },
  { value: "extendable_flatbed", label: "Prancha Extensiva" },
  { value: "dump_truck", label: "Rodo Caçamba" },
  { value: "roll_on_roll_off", label: "Rollon Rollof" },
  { value: "silo", label: "SILO" },
  { value: "mobile_substation", label: "Subestação Móvel" },
  { value: "tank", label: "Tanque" },
  { value: "log_carrier", label: "Tran Toras" },
  { value: "vtav", label: "VTAV" },
];

// Vehicle Models - Cadastro de Modelos de Veículos
export const vehicleModels = pgTable("vehicle_models", {
  id: serial("id").primaryKey(),
  brand: text("brand").notNull(), // Marca (ex: Volvo, Scania, Mercedes-Benz)
  model: text("model").notNull(), // Modelo (ex: FH 460, R450, Actros 2651)
  vehicleType: text("vehicle_type").notNull(), // Tipo de veículo
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => {
  return {
    brandIdx: index("idx_vehicle_model_brand").on(table.brand),
    typeIdx: index("idx_vehicle_model_type").on(table.vehicleType),
    brandModelIdx: index("idx_vehicle_model_brand_model").on(table.brand, table.model)
  };
});

export const insertVehicleModelSchema = createInsertSchema(vehicleModels)
  .omit({ id: true, createdAt: true });

export type VehicleModel = typeof vehicleModels.$inferSelect;
export type InsertVehicleModel = z.infer<typeof insertVehicleModelSchema>;

// Enum para status dos boletos
export const boletoBankingStatusEnum = z.enum([
  "aguardando_pagamento", // Aguardando Pagamento
  "pago", // Pago
  "vencido" // Vencido
]);

export type BoletoBankingStatus = z.infer<typeof boletoBankingStatusEnum>;

// Tabela de Boletos Financeiros
export const boletos = pgTable("boletos", {
  id: serial("id").primaryKey(),
  transportadorId: integer("transportador_id").notNull().references(() => transporters.id),
  nomeTransportador: text("nome_transportador").notNull(), // Redundância para facilitar listagem
  cpfCnpj: text("cpf_cnpj").notNull(), // CPF/CNPJ do transportador
  numeroBoleto: text("numero_boleto").notNull(), // Número do boleto
  valor: numeric("valor", { precision: 10, scale: 2 }).notNull(), // Valor com 2 decimais
  dataEmissao: date("data_emissao").notNull(), // Data de emissão
  dataVencimento: date("data_vencimento").notNull(), // Data de vencimento
  status: text("status").notNull().default("aguardando_pagamento"), // Status do boleto
  uploadBoletoUrl: text("upload_boleto_url"), // URL do arquivo do boleto
  uploadNfUrl: text("upload_nf_url"), // URL do arquivo da nota fiscal
  observacoes: text("observacoes"), // Campo de observações
  criadoEm: timestamp("criado_em").defaultNow().notNull(),
  atualizadoEm: timestamp("atualizado_em").defaultNow().notNull(),
}, (table) => {
  return {
    transportadorIdIdx: index("idx_boleto_transportador_id").on(table.transportadorId),
    statusIdx: index("idx_boleto_status").on(table.status),
    vencimentoIdx: index("idx_boleto_vencimento").on(table.dataVencimento),
    numeroBoletoIdx: index("idx_boleto_numero").on(table.numeroBoleto),
  };
});

export const insertBoletoSchema = createInsertSchema(boletos)
  .omit({ id: true, criadoEm: true, atualizadoEm: true })
  .extend({
    valor: z.coerce.number().positive("O valor deve ser positivo"),
    dataEmissao: z.string().refine((date) => !isNaN(Date.parse(date)), {
      message: "Data de emissão inválida",
    }),
    dataVencimento: z.string().refine((date) => !isNaN(Date.parse(date)), {
      message: "Data de vencimento inválida",
    }),
    numeroBoleto: z.string().min(1, "Número do boleto é obrigatório"),
    cpfCnpj: z.string().regex(/^(\d{11}|\d{14})$/, "CPF deve ter 11 dígitos ou CNPJ deve ter 14 dígitos"),
  })
  .superRefine((val, ctx) => {
    // Validar se data de emissão é anterior à data de vencimento
    const emissao = new Date(val.dataEmissao);
    const vencimento = new Date(val.dataVencimento);
    
    if (emissao >= vencimento) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A data de emissão deve ser anterior à data de vencimento",
        path: ["dataVencimento"],
      });
    }
  });

export type Boleto = typeof boletos.$inferSelect;
export type InsertBoleto = z.infer<typeof insertBoletoSchema>;

// Status options para interface
export const boletoStatusOptions = [
  { value: "aguardando_pagamento", label: "Aguardando Pagamento" },
  { value: "pago", label: "Pago" },
  { value: "vencido", label: "Vencido" },
];

// Nova tabela de licenças emitidas por estado com validação precisa por composição veicular
export const licencasEmitidas = pgTable("licencas_emitidas", {
  id: serial("id").primaryKey(),
  pedidoId: integer("pedido_id").references(() => licenseRequests.id, { onDelete: 'cascade' }).notNull(),
  estado: text("estado").notNull(), // UF do estado
  numeroLicenca: text("numero_licenca").notNull(), // Número AET gerado
  
  // Placas por tipo de veículo na composição
  placaUnidadeTratora: text("placa_unidade_tratora"), // Cavalo mecânico
  placaPrimeiraCarreta: text("placa_primeira_carreta"), // Primeira carreta/reboque
  placaSegundaCarreta: text("placa_segunda_carreta"), // Segunda carreta (bitrem/rodotrem)
  placaDolly: text("placa_dolly"), // Dolly (para rodotrem)
  placaPrancha: text("placa_prancha"), // Prancha (para tipo prancha)
  placaReboque: text("placa_reboque"), // Reboque (Romeu e Julieta)
  
  // Dados da licença
  dataEmissao: timestamp("data_emissao").notNull(),
  dataValidade: timestamp("data_validade").notNull(),
  status: text("status").notNull().default("emitida"), // emitida, vencida, cancelada
  
  // Campos adicionais
  cnpjSelecionado: text("cnpj_selecionado"), // CNPJ usado para emissão
  arquivoLicenca: text("arquivo_licenca"), // URL do arquivo da licença
  observacoes: text("observacoes"), // Comentários específicos
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
}, (table) => {
  return {
    // Índices para validação eficiente
    estadoValidadeIdx: index("idx_licenca_estado_validade").on(table.estado, table.dataValidade),
    statusValidadeIdx: index("idx_licenca_status_validade").on(table.status, table.dataValidade),
    numeroLicencaIdx: uniqueIndex("idx_licenca_numero").on(table.numeroLicenca),
    
    // Índices por placa para validação rápida
    placaTratoraIdx: index("idx_licenca_placa_tratora").on(table.placaUnidadeTratora),
    placaPrimeiraIdx: index("idx_licenca_placa_primeira").on(table.placaPrimeiraCarreta),
    placaSegundaIdx: index("idx_licenca_placa_segunda").on(table.placaSegundaCarreta),
    placaDollyIdx: index("idx_licenca_placa_dolly").on(table.placaDolly),
    placaPranchaIdx: index("idx_licenca_placa_prancha").on(table.placaPrancha),
    placaReboqueIdx: index("idx_licenca_placa_reboque").on(table.placaReboque),
    
    // Índice composto para busca por estado + placas
    estadoPlacasIdx: index("idx_licenca_estado_placas").on(
      table.estado, 
      table.placaUnidadeTratora,
      table.placaPrimeiraCarreta,
      table.placaSegundaCarreta
    )
  };
});

// Tabela legacy mantida para compatibilidade
export const stateLicenses = pgTable("state_licenses", {
  id: serial("id").primaryKey(),
  licenseRequestId: integer("license_request_id").notNull().references(() => licenseRequests.id),
  state: text("state").notNull(), // Estado específico (AL, MG, SP, etc.)
  status: text("status").notNull().default("pending_registration"), // Status específico do estado
  aetNumber: text("aet_number"), // Número AET específico do estado
  issuedAt: timestamp("issued_at"), // Data de emissão específica do estado
  validUntil: timestamp("valid_until"), // Data de validade específica do estado
  comments: text("comments"), // Observações específicas do estado
  selectedCnpj: text("selected_cnpj"), // CNPJ selecionado para este estado
  licenseFileUrl: text("license_file_url"), // URL do arquivo de licença específico
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => {
  return {
    licenseRequestIdIdx: index("idx_state_licenses_request_id").on(table.licenseRequestId),
    stateIdx: index("idx_state_licenses_state").on(table.state),
    statusIdx: index("idx_state_licenses_status").on(table.status),
    validUntilIdx: index("idx_state_licenses_valid_until").on(table.validUntil),
    // Índice único para evitar duplicatas de estado por licença
    uniqueStatePerLicense: uniqueIndex("unique_state_per_license").on(table.licenseRequestId, table.state)
  };
});

// Schemas para a nova tabela de licenças emitidas
export const insertLicencaEmitidaSchema = createInsertSchema(licencasEmitidas)
  .omit({ id: true, createdAt: true, updatedAt: true });

export const insertStateLicenseSchema = createInsertSchema(stateLicenses)
  .omit({ id: true, createdAt: true, updatedAt: true });

// Tipos TypeScript para licenças emitidas
export type LicencaEmitida = typeof licencasEmitidas.$inferSelect;
export type InsertLicencaEmitida = z.infer<typeof insertLicencaEmitidaSchema>;

export type StateLicense = typeof stateLicenses.$inferSelect;
export type InsertStateLicense = z.infer<typeof insertStateLicenseSchema>;

// Tabela para tipos de conjunto personalizados
export const vehicleSetTypes = pgTable("vehicle_set_types", {
  id: text("id").primaryKey(), // UUID ou string única
  name: text("name").notNull(),
  label: text("label").notNull(),
  description: text("description"),
  axleConfiguration: json("axle_configuration").notNull(), // JSON com configuração de eixos
  dimensionLimits: json("dimension_limits").notNull(), // JSON com limites de dimensões
  vehicleTypes: json("vehicle_types").notNull(), // JSON com tipos de veículos permitidos
  iconPath: text("icon_path"),
  imageUrl: text("image_url"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => {
  return {
    nameIdx: index("idx_vehicle_set_types_name").on(table.name),
    isActiveIdx: index("idx_vehicle_set_types_is_active").on(table.isActive),
  };
});

export const insertVehicleSetTypeSchema = createInsertSchema(vehicleSetTypes)
  .omit({ createdAt: true, updatedAt: true });

export type InsertVehicleSetType = z.infer<typeof insertVehicleSetTypeSchema>;
export type VehicleSetTypeDB = typeof vehicleSetTypes.$inferSelect;
