import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { 
  Home, 
  Truck, 
  FileText, 
  ClipboardList, 
  ListChecks,
  Receipt,
  Settings
} from "lucide-react";
import { cn } from "@/lib/utils";

export function MobileNavigation() {
  const [location, setLocation] = useLocation();
  const { user } = useAuth();
  const permissions = usePermissions();

  const isAdminUser = (user: any): boolean => {
    return user?.role === 'admin' || user?.role === 'operational' || user?.role === 'manager' || user?.role === 'supervisor' || user?.role === 'financial';
  };

  const navigationItems = [
    // Dashboard - apenas para transportadores
    ...(user?.role === 'user' ? [{
      id: 'dashboard',
      label: 'Início',
      icon: Home,
      path: '/',
      active: location === '/' || location === '/dashboard'
    }] : []),
    
    // Veículos
    {
      id: 'vehicles',
      label: 'Veículos',
      icon: Truck,
      path: '/vehicles',
      active: location === '/vehicles'
    },
    
    // Nova Licença
    {
      id: 'new-license',
      label: 'Nova',
      icon: FileText,
      path: '/nova-licenca',
      active: location === '/nova-licenca'
    },
    
    // Acompanhar
    {
      id: 'track',
      label: 'Acompanhar',
      icon: ClipboardList,
      path: '/acompanhar-licenca',
      active: location === '/acompanhar-licenca'
    },
    
    // Emitidas
    {
      id: 'issued',
      label: 'Emitidas',
      icon: ListChecks,
      path: '/licencas-emitidas',
      active: location === '/licencas-emitidas'
    },
    
    // Meus Boletos - apenas para usuários com permissão
    ...(permissions.canViewMyBoletos() ? [{
      id: 'boletos',
      label: 'Boletos',
      icon: Receipt,
      path: '/meus-boletos',
      active: location === '/meus-boletos'
    }] : []),
    
    // Admin - apenas administradores
    ...(isAdminUser(user) ? [{
      id: 'admin',
      label: 'Admin',
      icon: Settings,
      path: '/admin',
      active: location.startsWith('/admin')
    }] : [])
  ];

  // Limitar a 5 itens na navegação mobile
  const displayItems = navigationItems.slice(0, 5);

  return (
    <nav className="bottom-nav md:hidden">
      {displayItems.map((item) => {
        const Icon = item.icon;
        return (
          <Button
            key={item.id}
            variant="ghost"
            size="sm"
            className={cn(
              "bottom-nav-item h-auto p-2 flex-col",
              item.active && "bottom-nav-item active"
            )}
            onClick={() => setLocation(item.path)}
          >
            <Icon className="bottom-nav-icon" />
            <span className="bottom-nav-label">{item.label}</span>
          </Button>
        );
      })}
    </nav>
  );
}