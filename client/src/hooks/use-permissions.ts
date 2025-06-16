import { useAuth } from "@/hooks/use-auth";
import { 
  hasPermission, 
  canAccessModule, 
  canCreateIn, 
  canEditIn, 
  canDeleteIn,
  isAdministrativeRole,
  type UserRole,
  type ModulePermissions 
} from "@shared/permissions";

export function usePermissions() {
  const { user } = useAuth();

  const getUserRole = (): UserRole => {
    return (user?.role as UserRole) || 'user';
  };

  const checkPermission = (
    module: keyof ModulePermissions,
    action: 'view' | 'create' | 'edit' | 'delete'
  ): boolean => {
    if (!user) return false;
    return hasPermission(getUserRole(), module, action);
  };

  const canAccess = (module: keyof ModulePermissions): boolean => {
    if (!user) {
      console.log(`[PERMISSIONS] Usuário não autenticado - negando acesso ao módulo ${module}`);
      return false;
    }
    const userRole = getUserRole();
    const hasAccess = canAccessModule(userRole, module);
    console.log(`[PERMISSIONS] Usuário ${user.email} (${userRole}) tentando acessar ${module}: ${hasAccess}`);
    return hasAccess;
  };

  const canCreate = (module: keyof ModulePermissions): boolean => {
    if (!user) return false;
    return canCreateIn(getUserRole(), module);
  };

  const canEdit = (module: keyof ModulePermissions): boolean => {
    if (!user) return false;
    return canEditIn(getUserRole(), module);
  };

  const canDelete = (module: keyof ModulePermissions): boolean => {
    if (!user) return false;
    return canDeleteIn(getUserRole(), module);
  };

  const isAdmin = (): boolean => {
    if (!user) return false;
    return getUserRole() === 'admin';
  };

  const isAdministrative = (): boolean => {
    if (!user) return false;
    return isAdministrativeRole(getUserRole());
  };

  const isFinancial = (): boolean => {
    if (!user) return false;
    const role = getUserRole();
    return role === 'financial' || role === 'manager' || role === 'admin';
  };

  // Verificações específicas por módulo
  const permissions = {
    // Dashboard
    canViewDashboard: () => canAccess('dashboard'),
    
    // Usuários
    canViewUsers: () => canAccess('users'),
    canCreateUsers: () => canCreate('users'),
    canEditUsers: () => canEdit('users'),
    canDeleteUsers: () => canDelete('users'),
    
    // Módulo Financeiro
    canViewFinancial: () => canAccess('financial'),
    canCreateBoletos: () => canCreate('financial'),
    canEditBoletos: () => canEdit('financial'),
    canDeleteBoletos: () => canDelete('financial'),
    
    // Meus Boletos
    canViewMyBoletos: () => canAccess('myBoletos'),
    
    // Veículos
    canViewVehicles: () => canAccess('vehicles'),
    canCreateVehicles: () => canCreate('vehicles'),
    canEditVehicles: () => canEdit('vehicles'),
    canDeleteVehicles: () => canDelete('vehicles'),
    
    // Acompanhar Licenças
    canTrackLicenses: () => canAccess('trackLicense'),
    canCreateLicenses: () => canCreate('trackLicense'),
    canEditLicenses: () => canEdit('trackLicense'),
    
    // Gerenciar Licenças
    canManageLicenses: () => canAccess('manageLicenses'),
    canEditManagedLicenses: () => canEdit('manageLicenses'),
    canDeleteManagedLicenses: () => canDelete('manageLicenses'),
    
    // Transportadores
    canViewTransporters: () => canAccess('transporters'),
    canCreateTransporters: () => canCreate('transporters'),
    canEditTransporters: () => canEdit('transporters'),
    canDeleteTransporters: () => canDelete('transporters'),
    
    // Modelos de Veículos
    canViewVehicleModels: () => canAccess('vehicleModels'),
    canCreateVehicleModels: () => canCreate('vehicleModels'),
    canEditVehicleModels: () => canEdit('vehicleModels'),
    canDeleteVehicleModels: () => canDelete('vehicleModels'),
  };

  return {
    user,
    getUserRole,
    checkPermission,
    canAccess,
    canCreate,
    canEdit,
    canDelete,
    isAdmin,
    isAdministrative,
    isFinancial,
    ...permissions,
  };
}