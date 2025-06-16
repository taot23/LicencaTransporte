export type UserRole = 'user' | 'operational' | 'supervisor' | 'financial' | 'manager' | 'admin';

export interface Permission {
  view: boolean;
  create: boolean;
  edit: boolean;
  delete: boolean;
}

export interface ModulePermissions {
  dashboard: Permission;
  users: Permission;
  financial: Permission;
  myBoletos: Permission;
  vehicles: Permission;
  trackLicense: Permission;
  manageLicenses: Permission;
  transporters: Permission;
  vehicleModels: Permission;
}

// Matriz de permissões por role
const ROLE_PERMISSIONS: Record<UserRole, ModulePermissions> = {
  user: {
    dashboard: { view: true, create: false, edit: false, delete: false },
    users: { view: false, create: false, edit: false, delete: false },
    financial: { view: false, create: false, edit: false, delete: false },
    myBoletos: { view: false, create: false, edit: false, delete: false },
    vehicles: { view: true, create: true, edit: true, delete: false },
    trackLicense: { view: true, create: true, edit: true, delete: false },
    manageLicenses: { view: true, create: true, edit: true, delete: false },
    transporters: { view: true, create: false, edit: false, delete: false },
    vehicleModels: { view: true, create: false, edit: false, delete: false },
  },
  operational: {
    dashboard: { view: false, create: false, edit: false, delete: false },
    users: { view: false, create: false, edit: false, delete: false },
    financial: { view: false, create: false, edit: false, delete: false },
    myBoletos: { view: false, create: false, edit: false, delete: false },
    vehicles: { view: true, create: true, edit: true, delete: false },
    trackLicense: { view: true, create: true, edit: true, delete: false },
    manageLicenses: { view: true, create: true, edit: true, delete: false },
    transporters: { view: true, create: true, edit: true, delete: false },
    vehicleModels: { view: true, create: true, edit: true, delete: false },
  },
  supervisor: {
    dashboard: { view: true, create: true, edit: true, delete: false },
    users: { view: true, create: true, edit: true, delete: false },
    financial: { view: true, create: true, edit: true, delete: false },
    myBoletos: { view: true, create: false, edit: false, delete: false },
    vehicles: { view: true, create: true, edit: true, delete: false },
    trackLicense: { view: true, create: true, edit: true, delete: false },
    manageLicenses: { view: true, create: true, edit: true, delete: false },
    transporters: { view: true, create: true, edit: true, delete: false },
    vehicleModels: { view: true, create: true, edit: true, delete: false },
  },
  financial: {
    dashboard: { view: true, create: false, edit: false, delete: false },
    users: { view: false, create: false, edit: false, delete: false },
    financial: { view: true, create: true, edit: true, delete: true },
    myBoletos: { view: true, create: true, edit: true, delete: false },
    vehicles: { view: true, create: true, edit: true, delete: false },
    trackLicense: { view: true, create: true, edit: true, delete: false },
    manageLicenses: { view: true, create: false, edit: true, delete: false },
    transporters: { view: true, create: true, edit: true, delete: false },
    vehicleModels: { view: true, create: true, edit: true, delete: false },
  },
  manager: {
    dashboard: { view: true, create: true, edit: true, delete: false },
    users: { view: true, create: true, edit: true, delete: false },
    financial: { view: true, create: true, edit: true, delete: false },
    myBoletos: { view: true, create: true, edit: true, delete: false },
    vehicles: { view: true, create: true, edit: true, delete: false },
    trackLicense: { view: true, create: true, edit: true, delete: false },
    manageLicenses: { view: true, create: true, edit: true, delete: false },
    transporters: { view: true, create: true, edit: true, delete: false },
    vehicleModels: { view: true, create: true, edit: true, delete: false },
  },
  admin: {
    dashboard: { view: true, create: true, edit: true, delete: true },
    users: { view: true, create: true, edit: true, delete: true },
    financial: { view: true, create: true, edit: true, delete: true },
    myBoletos: { view: true, create: true, edit: true, delete: true },
    vehicles: { view: true, create: true, edit: true, delete: true },
    trackLicense: { view: true, create: true, edit: true, delete: true },
    manageLicenses: { view: true, create: true, edit: true, delete: true },
    transporters: { view: true, create: true, edit: true, delete: true },
    vehicleModels: { view: true, create: true, edit: true, delete: true },
  },
};

// Funções para verificação de permissões
export function hasPermission(
  userRole: UserRole,
  module: keyof ModulePermissions,
  action: keyof Permission
): boolean {
  const permissions = ROLE_PERMISSIONS[userRole];
  return permissions[module][action];
}

export function canAccessModule(userRole: UserRole, module: keyof ModulePermissions): boolean {
  return hasPermission(userRole, module, 'view');
}

export function canCreateIn(userRole: UserRole, module: keyof ModulePermissions): boolean {
  return hasPermission(userRole, module, 'create');
}

export function canEditIn(userRole: UserRole, module: keyof ModulePermissions): boolean {
  return hasPermission(userRole, module, 'edit');
}

export function canDeleteIn(userRole: UserRole, module: keyof ModulePermissions): boolean {
  return hasPermission(userRole, module, 'delete');
}

// Verificações específicas por rota de API
export function canAccessRoute(userRole: UserRole, method: string, path: string): boolean {
  // DELETE sempre apenas para admin
  if (method === 'DELETE') {
    return userRole === 'admin';
  }

  // POST /usuarios: administrador, supervisor
  if (method === 'POST' && path.includes('/users')) {
    return ['admin', 'supervisor'].includes(userRole);
  }

  // POST /boletos: financeiro, administrador
  if (method === 'POST' && path.includes('/boletos')) {
    return ['financial', 'admin'].includes(userRole);
  }

  // POST /transportador: todos exceto operacional
  if (method === 'POST' && path.includes('/transporters')) {
    return userRole !== 'operational';
  }

  return true;
}

// Função para obter permissões de um módulo específico
export function getModulePermissions(userRole: UserRole, module: keyof ModulePermissions): Permission {
  return ROLE_PERMISSIONS[userRole][module];
}

// Função para verificar se usuário é administrativo
export function isAdministrativeRole(userRole: UserRole): boolean {
  return ['operational', 'supervisor', 'financial', 'manager', 'admin'].includes(userRole);
}

// Função para verificar acesso ao dashboard administrativo
export function canAccessAdminDashboard(userRole: UserRole): boolean {
  return isAdministrativeRole(userRole);
}