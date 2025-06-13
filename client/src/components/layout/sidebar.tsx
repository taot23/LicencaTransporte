import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "@/hooks/use-auth";
import { useIsMobile } from "@/hooks/use-mobile";
import { 
  Menu, 
  Home, 
  Truck, 
  FileText, 
  ClipboardList, 
  ListChecks, 
  LogOut, 
  ChevronRight, 
  ChevronLeft,
  Building2, 
  ClipboardEdit,
  LayoutDashboard,
  Users,
  Settings,
  Car,
  RefreshCw,
  Receipt
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Logo } from "@/components/ui/logo";
import { Separator } from "@/components/ui/separator";

interface SidebarProps {
  className?: string;
}

export function Sidebar({ className }: SidebarProps) {
  const [location, setLocation] = useLocation();
  const { user, logoutMutation } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.isAdmin;
  const isSupervisor = isAdmin || user?.role === 'supervisor';
  const isOperational = isSupervisor || user?.role === 'operational';
  const isFinancial = isAdmin || user?.role === 'financial';
  const isTransporter = user?.role === 'user';

  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const userInitials = user?.fullName
    .split(' ')
    .map(name => name[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  const handleNavigate = (path: string) => {
    if (location !== path) {
      setLocation(path);
    }
    setOpen(false);
  };

  // Menu items que aparecem sempre
  const menuItems = [
    // Dashboard
    {
      icon: Home,
      label: "Dashboard",
      path: "/",
      show: !isOperational
    },
    // Minhas Empresas
    {
      icon: Building2,
      label: "Minhas Empresas",
      path: "/my-companies",
      show: isSupervisor || isOperational
    },
    // Veículos Cadastrados
    {
      icon: Truck,
      label: "Veículos Cadastrados",
      path: "/vehicles",
      show: true
    },
    // Solicitar Licença
    {
      icon: FileText,
      label: "Solicitar Licença",
      path: "/request-license",
      show: true
    },
    // Acompanhar Licença
    {
      icon: ClipboardList,
      label: "Acompanhar Licença",
      path: "/track-license",
      show: true
    },
    // Licenças Emitidas
    {
      icon: ListChecks,
      label: "Licenças Emitidas",
      path: "/issued-licenses",
      show: true
    },
    // MEUS BOLETOS - SEMPRE VISÍVEL
    {
      icon: Receipt,
      label: "Meus Boletos",
      path: "/meus-boletos",
      show: true
    }
  ];

  const adminMenuItems = [
    {
      icon: LayoutDashboard,
      label: "Relatórios",
      path: "/admin",
      show: isAdmin
    },
    {
      icon: ClipboardEdit,
      label: "Gerenciar Licenças",
      path: "/admin/licenses",
      show: isOperational
    },
    {
      icon: Building2,
      label: "Transportadores",
      path: "/admin/transporters",
      show: isOperational
    },
    {
      icon: Users,
      label: "Usuários",
      path: "/admin/users",
      show: isAdmin
    },
    {
      icon: Car,
      label: "Modelos de Veículos",
      path: "/admin/vehicle-models",
      show: isAdmin
    },
    {
      icon: Receipt,
      label: "Módulo Financeiro",
      path: "/admin/boletos",
      show: isFinancial
    }
  ];

  const renderMenuItems = (items: any[], showSeparator = false) => (
    <>
      {showSeparator && (
        <div className="pt-2 pb-2">
          <Separator className="bg-gray-700" />
          <p className="text-xs text-gray-400 uppercase mt-2 ml-2 font-semibold">Administração</p>
        </div>
      )}
      {items.map((item, index) => 
        item.show && (
          <Button
            key={index}
            variant="ghost"
            className={cn(
              "w-full justify-start text-white hover:bg-gray-700",
              location === item.path ? "bg-gray-700" : "bg-transparent"
            )}
            onClick={() => handleNavigate(item.path)}
          >
            <item.icon className="mr-3 h-5 w-5" />
            {item.label}
          </Button>
        )
      )}
    </>
  );

  const DesktopSidebar = () => (
    <div className={cn(
      "fixed left-0 top-0 z-40 h-screen bg-gray-800 text-white transition-all duration-300",
      isCollapsed ? "w-16" : "w-64",
      className
    )}>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-center h-16 px-4 bg-gray-900">
          {!isCollapsed && <Logo width={120} className="py-2" />}
          {isCollapsed && <Logo width={40} className="py-2" />}
        </div>
        
        {/* Navigation */}
        <div className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
          {renderMenuItems(menuItems)}
          
          {/* Admin Section */}
          {(isAdmin || isSupervisor || isOperational) && 
            renderMenuItems(adminMenuItems.filter(item => item.show), true)
          }
        </div>
        
        {/* User Footer */}
        <div className="p-4 border-t border-gray-700">
          <div className="flex items-center space-x-3">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-gray-600 text-white text-sm">
                {userInitials}
              </AvatarFallback>
            </Avatar>
            {!isCollapsed && (
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-white truncate">
                  {user?.fullName}
                </div>
                <div className="text-xs text-gray-400 truncate">
                  {user?.email}
                </div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {isAdmin && <span className="bg-blue-600 text-white text-[10px] px-1 py-0.5 rounded">Admin</span>}
                  {user?.role === 'supervisor' && <span className="bg-green-600 text-white text-[10px] px-1 py-0.5 rounded">Supervisor</span>}
                  {user?.role === 'operational' && <span className="bg-orange-600 text-white text-[10px] px-1 py-0.5 rounded">Operacional</span>}
                  {user?.role === 'financial' && <span className="bg-purple-600 text-white text-[10px] px-1 py-0.5 rounded">Financeiro</span>}
                  {user?.role === 'user' && <span className="bg-gray-600 text-white text-[10px] px-1 py-0.5 rounded">Transportador</span>}
                </div>
              </div>
            )}
            <Button 
              variant="ghost" 
              size="icon" 
              className="ml-auto text-gray-300 hover:text-white"
              onClick={handleLogout}
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

  const MobileSidebar = () => (
    <>
      <div className="md:hidden fixed inset-x-0 top-0 z-20 bg-gray-900 text-white flex items-center justify-between h-16 px-4 shadow-md">
        <div className="flex items-center">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="text-white p-2 mr-2">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 bg-gray-800 text-white w-[250px] sm:w-[280px] overflow-y-auto max-h-screen">
              <div className="flex items-center justify-center h-16 px-4 bg-gray-900">
                <Logo width={120} className="py-2" />
              </div>
              
              <div className="px-2 py-4 space-y-1">
                {renderMenuItems(menuItems)}
                
                {/* Admin Section Mobile */}
                {(isAdmin || isSupervisor || isOperational) && 
                  renderMenuItems(adminMenuItems.filter(item => item.show), true)
                }
              </div>
            </SheetContent>
          </Sheet>
          <Logo width={100} className="py-2" />
        </div>
        
        <div className="flex items-center space-x-2">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-gray-600 text-white text-sm">
              {userInitials}
            </AvatarFallback>
          </Avatar>
          <Button 
            variant="ghost" 
            size="icon" 
            className="text-gray-300 hover:text-white"
            onClick={handleLogout}
          >
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </>
  );

  return isMobile ? <MobileSidebar /> : <DesktopSidebar />;
}