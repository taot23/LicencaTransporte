import { pgTable, serial, text, timestamp, boolean, integer, jsonb, decimal } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

// Users table
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  password: text('password').notNull(),
  fullName: text('full_name').notNull(),
  phone: text('phone'),
  isAdmin: boolean('is_admin').default(false),
  role: text('role', { enum: ['transporter', 'operational', 'supervisor'] }).default('transporter'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Transporters table
export const transporters = pgTable('transporters', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  tradeName: text('trade_name'),
  personType: text('person_type', { enum: ['pf', 'pj'] }).notNull(),
  documentNumber: text('document_number').notNull().unique(),
  city: text('city').notNull(),
  state: text('state').notNull(),
  email: text('email').notNull(),
  phone: text('phone').notNull(),
  subsidiaries: jsonb('subsidiaries').default([]),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Vehicles table
export const vehicles = pgTable('vehicles', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull(),
  plate: text('plate').notNull().unique(),
  type: text('type').notNull(),
  brand: text('brand'),
  model: text('model'),
  year: integer('year'),
  renavam: text('renavam'),
  status: text('status').default('active'),
  axleCount: integer('axle_count'),
  tare: integer('tare'),
  crlvUrl: text('crlv_url'),
  crlvYear: integer('crlv_year'),
  bodyType: text('body_type'),
  ownerName: text('owner_name'),
  ownershipType: text('ownership_type', { enum: ['proprio', 'terceiro'] }).default('proprio'),
  cmt: text('cmt'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// License requests table
export const licenseRequests = pgTable('license_requests', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull(),
  transporterId: integer('transporter_id'),
  requestNumber: text('request_number').notNull().unique(),
  type: text('type').notNull(),
  mainVehiclePlate: text('main_vehicle_plate').notNull(),
  tractorUnitId: integer('tractor_unit_id'),
  firstTrailerId: integer('first_trailer_id'),
  dollyId: integer('dolly_id'),
  secondTrailerId: integer('second_trailer_id'),
  flatbedId: integer('flatbed_id'),
  length: integer('length').notNull(),
  width: integer('width').notNull(),
  height: integer('height').notNull(),
  cargoType: text('cargo_type', { 
    enum: ['dry_cargo', 'liquid_cargo', 'live_cargo', 'sugar_cane', 'indivisible_cargo', 'agricultural_machinery', 'oversized'] 
  }).notNull(),
  additionalPlates: jsonb('additional_plates').default([]),
  additionalPlatesDocuments: jsonb('additional_plates_documents').default([]),
  states: jsonb('states').notNull(),
  status: text('status').default('pending_registration'),
  stateStatuses: jsonb('state_statuses').default([]),
  stateFiles: jsonb('state_files').default([]),
  stateAETNumbers: jsonb('state_aet_numbers').default([]),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  isDraft: boolean('is_draft').default(false),
  comments: text('comments').default(''),
  licenseFileUrl: text('license_file_url'),
  validUntil: timestamp('valid_until'),
  aetNumber: text('aet_number'),
  selectedCnpj: text('selected_cnpj'),
});

// Status histories table
export const statusHistories = pgTable('status_histories', {
  id: serial('id').primaryKey(),
  licenseId: integer('license_id').notNull(),
  state: text('state').notNull(),
  userId: integer('user_id').notNull(),
  oldStatus: text('old_status').notNull(),
  newStatus: text('new_status').notNull(),
  comments: text('comments'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Vehicle models table
export const vehicleModels = pgTable('vehicle_models', {
  id: serial('id').primaryKey(),
  brand: text('brand').notNull(),
  model: text('model').notNull(),
  type: text('type').notNull(),
  year: integer('year'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Create insert and select schemas
export const insertUserSchema = createInsertSchema(users);
export const selectUserSchema = createSelectSchema(users);
export const insertVehicleSchema = createInsertSchema(vehicles);
export const selectVehicleSchema = createSelectSchema(vehicles);
export const insertLicenseRequestSchema = createInsertSchema(licenseRequests);
export const selectLicenseRequestSchema = createSelectSchema(licenseRequests);
export const insertTransporterSchema = createInsertSchema(transporters);
export const selectTransporterSchema = createSelectSchema(transporters);
export const insertStatusHistorySchema = createInsertSchema(statusHistories);
export const selectStatusHistorySchema = createSelectSchema(statusHistories);
export const insertVehicleModelSchema = createInsertSchema(vehicleModels);
export const selectVehicleModelSchema = createSelectSchema(vehicleModels);

// Type exports
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Vehicle = typeof vehicles.$inferSelect;
export type InsertVehicle = typeof vehicles.$inferInsert;
export type LicenseRequest = typeof licenseRequests.$inferSelect;
export type InsertLicenseRequest = typeof licenseRequests.$inferInsert;
export type Transporter = typeof transporters.$inferSelect;
export type InsertTransporter = typeof transporters.$inferInsert;
export type StatusHistory = typeof statusHistories.$inferSelect;
export type InsertStatusHistory = typeof statusHistories.$inferInsert;
export type VehicleModel = typeof vehicleModels.$inferSelect;
export type InsertVehicleModel = typeof vehicleModels.$inferInsert;

// Additional schemas for API validation
export const updateLicenseStatusSchema = z.object({
  status: z.string(),
  comments: z.string().optional(),
  licenseFile: z.any().optional(),
});

export const updateLicenseStateSchema = z.object({
  state: z.string(),
  status: z.string(),
  comments: z.string().optional(),
  validUntil: z.string().optional(),
  aetNumber: z.string().optional(),
  selectedCnpj: z.string().optional(),
  licenseFile: z.any().optional(),
  stateFile: z.any().optional(),
});

export const insertDraftLicenseSchema = insertLicenseRequestSchema.extend({
  isDraft: z.boolean().default(true),
});

// Enums
export const userRoleEnum = z.enum(['transporter', 'operational', 'supervisor']);
export const LicenseStatus = z.enum([
  'pending_registration',
  'under_review',
  'pending_approval', 
  'approved',
  'rejected'
]);

// Brazilian states
export const brazilianStates = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
  "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
  "RS", "RO", "RR", "SC", "SP", "SE", "TO", "DNIT"
] as const;