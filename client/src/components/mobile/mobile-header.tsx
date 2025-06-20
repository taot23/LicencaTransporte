import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { 
  Menu, 
  LogOut, 
  Home, 
  Truck, 
  FileText, 
  ClipboardList, 
  ListChecks,
  Settings,
  Building2,
  Receipt,
  BarChart3,
  Car,
  Users,
  ChevronRight
} from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { Separator } from "@/components/ui/separator";

interface MobileHeaderProps {
  title?: string;
  showBack?: boolean;
  backPath?: string;
}

export function MobileHeader({ title, showBack = false, backPath = "/" }: MobileHeaderProps) {
  const [open, setOpen] = useState(false);
  const [location, setLocation] = useLocation();
  const { user, logoutMutation } = useAuth();
  const permissions = usePermissions();

  const userInitials = user?.fullName
    ?.split(' ')
    .map(name => name[0])
    .join('')
    .substring(0, 2)
    .toUpperCase() || "U";

  const handleLogout = () => {
    if (logoutMutation.isPending) return;
    setOpen(false);
    logoutMutation.mutate();
  };

  const handleNavigate = (path: string) => {
    setOpen(false);
    if (location !== path) {
      setLocation(path);
    }
  };

  const isAdminUser = (user: any): boolean => {
    return user?.role === 'admin' || user?.role === 'operational' || user?.role === 'manager' || user?.role === 'supervisor' || user?.role === 'financial';
  };

  const menuItems = [
    // Dashboard - apenas para transportadores
    ...(user?.role === 'user' ? [{
      id: 'dashboard',
      label: 'Dashboard',
      icon: Home,
      path: '/',
      show: true
    }] : []),
    
    // Veículos
    ...(permissions.canViewVehicles() ? [{
      id: 'vehicles',
      label: 'Meus Veículos',
      icon: Truck,
      path: '/vehicles',
      show: true
    }] : []),
    
    // Nova Licença
    ...(permissions.canCreateLicenses() ? [{
      id: 'new-license',
      label: 'Nova Licença',
      icon: FileText,
      path: '/nova-licenca',
      show: true
    }] : []),
    
    // Acompanhar Licenças
    ...(permissions.canViewLicenses() ? [{
      id: 'track',
      label: 'Acompanhar Licenças',
      icon: ClipboardList,
      path: '/acompanhar-licenca',
      show: true
    }] : []),
    
    // Licenças Emitidas
    ...(permissions.canViewLicenses() ? [{
      id: 'issued',
      label: 'Licenças Emitidas',
      icon: ListChecks,
      path: '/licencas-emitidas',
      show: true
    }] : []),
    
    // Transportadores - apenas para admins
    ...(isAdminUser(user) ? [{
      id: 'transporters',
      label: 'Transportadores',
      icon: Building2,
      path: '/admin/transporters',
      show: true
    }] : []),
    
    // Usuários - apenas para admins
    ...(isAdminUser(user) ? [{
      id: 'users',
      label: 'Usuários',
      icon: Users,
      path: '/admin/users',
      show: true
    }] : []),
    
    // Licenças Admin - apenas para admins
    ...(isAdminUser(user) ? [{
      id: 'admin-licenses',
      label: 'Gerenciar Licenças',
      icon: Settings,
      path: '/admin/licenses',
      show: true
    }] : []),
    
    // Modelos de Veículos - apenas para admins
    ...(isAdminUser(user) ? [{
      id: 'vehicle-models',
      label: 'Modelos de Veículos',
      icon: Car,
      path: '/admin/vehicle-models',
      show: true
    }] : []),
    
    // Dashboard AET - apenas para admins
    ...(isAdminUser(user) ? [{
      id: 'dashboard-aet',
      label: 'Dashboard AET',
      icon: BarChart3,
      path: '/admin/dashboard-aet',
      show: true
    }] : [])
  ];

  const getPageTitle = () => {
    if (title) return title;
    
    const currentItem = menuItems.find(item => item.path === location);
    return currentItem?.label || 'Sistema AET';
  };

  return (
    <header className="mobile-header md:hidden fixed top-0 left-0 right-0 z-40 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
      <div className="flex items-center">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="mr-3">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Abrir menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-[280px] bg-gray-800 text-white">
            <div className="flex flex-col h-full">
              {/* Header do menu */}
              <div className="flex items-center justify-center h-16 px-4 bg-gray-900 border-b border-gray-700">
                <Logo width={120} className="py-2" />
              </div>
              
              {/* Informações do usuário */}
              <div className="p-4 bg-gray-900">
                <div className="flex items-center space-x-3">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-gray-600 text-white">
                      {userInitials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">
                      {user?.fullName}
                    </p>
                    <p className="text-xs text-gray-300 truncate">
                      {user?.email}
                    </p>
                  </div>
                </div>
              </div>
              
              <Separator className="bg-gray-700" />
              
              {/* Itens do menu */}
              <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
                {menuItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = location === item.path || 
                    (item.path.includes('/admin') && location.startsWith('/admin'));
                  
                  return (
                    <Button
                      key={item.id}
                      variant="ghost"
                      className={`w-full justify-start text-white hover:bg-gray-700 ${
                        isActive ? 'bg-gray-700' : ''
                      }`}
                      onClick={() => handleNavigate(item.path)}
                    >
                      <Icon className="mr-3 h-5 w-5" />
                      {item.label}
                      <ChevronRight className="ml-auto h-4 w-4" />
                    </Button>
                  );
                })}
              </nav>
              
              <Separator className="bg-gray-700" />
              
              {/* Logout */}
              <div className="p-4">
                <Button 
                  variant="ghost" 
                  className="w-full justify-start text-red-400 hover:text-red-300 hover:bg-red-900/20"
                  onClick={handleLogout}
                  disabled={logoutMutation.isPending}
                >
                  <LogOut className="mr-3 h-5 w-5" />
                  Sair
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
        
        <h1 className="text-lg font-semibold text-gray-900 truncate">
          {getPageTitle()}
        </h1>
      </div>
      
      {/* Avatar do usuário */}
      <Avatar className="h-8 w-8">
        <AvatarFallback className="bg-gray-600 text-white text-sm">
          {userInitials}
        </AvatarFallback>
      </Avatar>
    </header>
  );
}