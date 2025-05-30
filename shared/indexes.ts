import { index, uniqueIndex } from "drizzle-orm/pg-core";
import { licenseRequests, transporters, users, vehicles } from "./schema";

// Adicionar índices para o modelo de usuários
export const emailIndex = uniqueIndex("idx_user_email").on(users.email);
export const userRoleIndex = index("idx_user_role").on(users.role);

// Adicionar índices para o modelo de transportadores
export const transporterDocumentIndex = uniqueIndex("idx_transporter_document").on(transporters.documentNumber);
export const transporterUserIdIndex = index("idx_transporter_user_id").on(transporters.userId);
export const transporterNameIndex = index("idx_transporter_name").on(transporters.name);

// Adicionar índices para o modelo de veículos
export const vehiclePlateIndex = index("idx_vehicle_plate").on(vehicles.plate);
export const vehicleUserIdIndex = index("idx_vehicle_user_id").on(vehicles.userId);
export const vehicleStatusIndex = index("idx_vehicle_status").on(vehicles.status);
export const vehicleTypeIndex = index("idx_vehicle_type").on(vehicles.type);

// Adicionar índices para o modelo de pedidos de licença
export const licenseRequestNumberIndex = uniqueIndex("idx_license_request_number").on(licenseRequests.requestNumber);
export const licenseUserIdIndex = index("idx_license_user_id").on(licenseRequests.userId);
export const licenseTransporterIdIndex = index("idx_license_transporter_id").on(licenseRequests.transporterId);
export const licenseStatusIndex = index("idx_license_status").on(licenseRequests.status);
export const licenseIsDraftIndex = index("idx_license_is_draft").on(licenseRequests.isDraft);
export const licenseCreatedAtIndex = index("idx_license_created_at").on(licenseRequests.createdAt);
export const licenseMainVehiclePlateIndex = index("idx_license_main_vehicle").on(licenseRequests.mainVehiclePlate);