import { db } from "./db";
import { 
  users, 
  vehicles, 
  licenseRequests, 
  transporters, 
  statusHistories,
  vehicleModels,
  User,
  Vehicle,
  LicenseRequest,
  Transporter,
  StatusHistory,
  VehicleModel,
  InsertUser,
  InsertVehicle,
  InsertLicenseRequest,
  InsertTransporter,
  InsertStatusHistory,
  InsertVehicleModel
} from "@shared/schema";
import { eq, desc, and, or, like, sql, inArray } from "drizzle-orm";

class DatabaseStorage {
  // User operations
  async getUser(id: number): Promise<User | null> {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0] || null;
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
    return result[0] || null;
  }

  async createUser(userData: InsertUser): Promise<User> {
    const result = await db.insert(users).values(userData).returning();
    return result[0];
  }

  async updateUser(id: number, userData: Partial<InsertUser>): Promise<User> {
    const result = await db.update(users).set(userData).where(eq(users.id, id)).returning();
    return result[0];
  }

  async deleteUser(id: number): Promise<void> {
    await db.delete(users).where(eq(users.id, id));
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(desc(users.createdAt));
  }

  // Vehicle operations
  async getVehicle(id: number): Promise<Vehicle | null> {
    const result = await db.select().from(vehicles).where(eq(vehicles.id, id)).limit(1);
    return result[0] || null;
  }

  async createVehicle(vehicleData: InsertVehicle): Promise<Vehicle> {
    const result = await db.insert(vehicles).values(vehicleData).returning();
    return result[0];
  }

  async updateVehicle(id: number, vehicleData: Partial<InsertVehicle>): Promise<Vehicle> {
    const result = await db.update(vehicles).set(vehicleData).where(eq(vehicles.id, id)).returning();
    return result[0];
  }

  async deleteVehicle(id: number): Promise<void> {
    await db.delete(vehicles).where(eq(vehicles.id, id));
  }

  async getAllVehicles(): Promise<Vehicle[]> {
    return await db.select().from(vehicles).orderBy(desc(vehicles.createdAt));
  }

  async getVehiclesByUserId(userId: number): Promise<Vehicle[]> {
    return await db.select().from(vehicles).where(eq(vehicles.userId, userId)).orderBy(desc(vehicles.createdAt));
  }

  async getVehicleByPlate(plate: string): Promise<Vehicle | null> {
    const result = await db.select().from(vehicles).where(eq(vehicles.plate, plate)).limit(1);
    return result[0] || null;
  }

  // License operations
  async getLicense(id: number): Promise<LicenseRequest | null> {
    const result = await db.select().from(licenseRequests).where(eq(licenseRequests.id, id)).limit(1);
    return result[0] || null;
  }

  async createLicense(licenseData: InsertLicenseRequest): Promise<LicenseRequest> {
    const result = await db.insert(licenseRequests).values(licenseData).returning();
    return result[0];
  }

  async updateLicense(id: number, licenseData: Partial<InsertLicenseRequest>): Promise<LicenseRequest> {
    const result = await db.update(licenseRequests).set(licenseData).where(eq(licenseRequests.id, id)).returning();
    return result[0];
  }

  async deleteLicense(id: number): Promise<void> {
    // First delete related status histories
    await db.delete(statusHistories).where(eq(statusHistories.licenseId, id));
    // Then delete the license
    await db.delete(licenseRequests).where(eq(licenseRequests.id, id));
  }

  async getAllLicenses(): Promise<LicenseRequest[]> {
    return await db.select().from(licenseRequests).orderBy(desc(licenseRequests.createdAt));
  }

  async getLicensesByUserId(userId: number): Promise<LicenseRequest[]> {
    return await db.select().from(licenseRequests).where(eq(licenseRequests.userId, userId)).orderBy(desc(licenseRequests.createdAt));
  }

  // Transporter operations
  async getTransporter(id: number): Promise<Transporter | null> {
    const result = await db.select().from(transporters).where(eq(transporters.id, id)).limit(1);
    return result[0] || null;
  }

  async getTransporterById(id: number): Promise<Transporter | null> {
    return this.getTransporter(id);
  }

  async createTransporter(transporterData: InsertTransporter): Promise<Transporter> {
    const result = await db.insert(transporters).values(transporterData).returning();
    return result[0];
  }

  async updateTransporter(id: number, transporterData: Partial<InsertTransporter>): Promise<Transporter> {
    const result = await db.update(transporters).set(transporterData).where(eq(transporters.id, id)).returning();
    return result[0];
  }

  async deleteTransporter(id: number): Promise<void> {
    await db.delete(transporters).where(eq(transporters.id, id));
  }

  async getAllTransporters(): Promise<Transporter[]> {
    return await db.select().from(transporters).orderBy(desc(transporters.createdAt));
  }

  // Status history operations
  async createStatusHistory(historyData: InsertStatusHistory): Promise<StatusHistory> {
    const result = await db.insert(statusHistories).values(historyData).returning();
    return result[0];
  }

  async getStatusHistoryByLicenseId(licenseId: number): Promise<StatusHistory[]> {
    return await db.select().from(statusHistories).where(eq(statusHistories.licenseId, licenseId)).orderBy(desc(statusHistories.createdAt));
  }

  // Vehicle model operations
  async getAllVehicleModels(): Promise<VehicleModel[]> {
    return await db.select().from(vehicleModels).orderBy(vehicleModels.brand, vehicleModels.model);
  }

  async getVehicleModelById(id: number): Promise<VehicleModel | null> {
    const result = await db.select().from(vehicleModels).where(eq(vehicleModels.id, id)).limit(1);
    return result[0] || null;
  }

  async createVehicleModel(modelData: InsertVehicleModel): Promise<VehicleModel> {
    const result = await db.insert(vehicleModels).values(modelData).returning();
    return result[0];
  }

  async updateVehicleModel(id: number, modelData: Partial<InsertVehicleModel>): Promise<VehicleModel> {
    const result = await db.update(vehicleModels).set(modelData).where(eq(vehicleModels.id, id)).returning();
    return result[0];
  }

  async deleteVehicleModel(id: number): Promise<void> {
    await db.delete(vehicleModels).where(eq(vehicleModels.id, id));
  }
}

export const storage = new DatabaseStorage();