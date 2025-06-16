import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
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
  Receipt,
  BarChart3
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
    // Previne múltiplos cliques durante logout
    if (logoutMutation.isPending) return;
    
    logoutMutation.mutate();
  };

  const handleNavigate = (path: string) => {
    // Navegação otimizada - fecha modal primeiro para feedback visual instantâneo
    setOpen(false);
    
    // Navegação apenas se for caminho diferente
    if (location !== path) {
      setLocation(path);
    }
  };

  const NavItems = () => (
    <>
      <div className="flex items-center justify-center h-16 px-4 bg-gray-900">
        <Logo width={120} className="py-2" />
      </div>
      
      <div className="px-2 py-4 space-y-1">
        {/* Dashboard */}
        {!isOperational && (
          <Button
            variant="ghost"
            className={cn(
              "w-full justify-start text-white hover:bg-gray-700",
              (location === "/" || location === "/dashboard") ? "bg-gray-700" : "bg-transparent"
            )}
            onClick={() => handleNavigate("/")}
          >
            <Home className="mr-3 h-5 w-5" />
            Dashboard
          </Button>
        )}
        

        
        <Button
          variant="ghost"
          className={cn(
            "w-full justify-start text-white hover:bg-gray-700",
            location === "/vehicles" ? "bg-gray-700" : "bg-transparent"
          )}
          onClick={() => handleNavigate("/vehicles")}
        >
          <Truck className="mr-3 h-5 w-5" />
          Veículos Cadastrados
        </Button>
        
        <Button
          variant="ghost"
          className={cn(
            "w-full justify-start text-white hover:bg-gray-700",
            location === "/request-license" ? "bg-gray-700" : "bg-transparent"
          )}
          onClick={() => handleNavigate("/request-license")}
        >
          <FileText className="mr-3 h-5 w-5" />
          Solicitar Licença
        </Button>
        
        <Button
          variant="ghost"
          className={cn(
            "w-full justify-start text-white hover:bg-gray-700",
            location === "/track-license" ? "bg-gray-700" : "bg-transparent"
          )}
          onClick={() => handleNavigate("/track-license")}
        >
          <ClipboardList className="mr-3 h-5 w-5" />
          Acompanhar Licença
        </Button>
        
        <Button
          variant="ghost"
          className={cn(
            "w-full justify-start text-white hover:bg-gray-700",
            location === "/issued-licenses" ? "bg-gray-700" : "bg-transparent"
          )}
          onClick={() => handleNavigate("/issued-licenses")}
        >
          <ListChecks className="mr-3 h-5 w-5" />
          Licenças Emitidas
        </Button>
        
        {/* MEUS BOLETOS - SEMPRE VISÍVEL */}
        <Button
          variant="ghost"
          className={cn(
            "w-full justify-start text-white hover:bg-gray-700",
            location === "/meus-boletos" ? "bg-gray-700" : "bg-transparent"
          )}
          onClick={() => handleNavigate("/meus-boletos")}
        >
          <Receipt className="mr-3 h-5 w-5" />
          Meus Boletos
        </Button>
        
        {/* Seção de Funcionalidades Administrativas */}
        {(isAdmin || isSupervisor || isOperational) && (
          <>
            <div className="pt-2 pb-2">
              <Separator className="bg-gray-700" />
              <p className="text-xs text-gray-400 uppercase mt-2 ml-2 font-semibold">Administração</p>
            </div>
            
            {(isAdmin || user?.role === 'manager') && (
              <Button
                variant="ghost"
                className={cn(
                  "w-full justify-start text-white hover:bg-gray-700",
                  location === "/admin/dashboard-aet" ? "bg-gray-700" : "bg-transparent"
                )}
                onClick={() => handleNavigate("/admin/dashboard-aet")}
              >
                <BarChart3 className="mr-3 h-5 w-5" />
                Dashboard AET
              </Button>
            )}
            
            {isOperational && (
              <Button
                variant="ghost"
                className={cn(
                  "w-full justify-start text-white hover:bg-gray-700",
                  (location === "/admin/licenses" || location === "/gerenciar-licencas") ? "bg-gray-700" : "bg-transparent"
                )}
                onClick={() => handleNavigate("/admin/licenses")}
              >
                <ClipboardEdit className="mr-3 h-5 w-5" />
                Gerenciar Licenças
              </Button>
            )}
            
            {isOperational && (
              <Button
                variant="ghost"
                className={cn(
                  "w-full justify-start text-white hover:bg-gray-700",
                  location === "/admin/transporters" ? "bg-gray-700" : "bg-transparent"
                )}
                onClick={() => handleNavigate("/admin/transporters")}
              >
                <Building2 className="mr-3 h-5 w-5" />
                Transportadores
              </Button>
            )}
            
            {isAdmin && (
              <Button
                variant="ghost"
                className={cn(
                  "w-full justify-start text-white hover:bg-gray-700",
                  location === "/admin/users" ? "bg-gray-700" : "bg-transparent"
                )}
                onClick={() => handleNavigate("/admin/users")}
              >
                <Users className="mr-3 h-5 w-5" />
                Usuários
              </Button>
            )}
            
            {(isAdmin || isOperational) && (
              <Button
                variant="ghost"
                className={cn(
                  "w-full justify-start text-white hover:bg-gray-700",
                  location === "/admin/vehicle-models" ? "bg-gray-700" : "bg-transparent"
                )}
                onClick={() => handleNavigate("/admin/vehicle-models")}
              >
                <Car className="mr-3 h-5 w-5" />
                Modelos de Veículos
              </Button>
            )}
            
            {isFinancial && (
              <Button
                variant="ghost"
                className={cn(
                  "w-full justify-start text-white hover:bg-gray-700",
                  location === "/admin/boletos" ? "bg-gray-700" : "bg-transparent"
                )}
                onClick={() => handleNavigate("/admin/boletos")}
              >
                <Receipt className="mr-3 h-5 w-5" />
                Módulo Financeiro
              </Button>
            )}
          </>
        )}
      </div>
      

    </>
  );

  return isMobile ? (
    <>
      {/* Mobile Header */}
      <div className="md:hidden fixed inset-x-0 top-0 z-20 bg-gray-900 text-white flex items-center justify-between h-16 px-4 shadow-md">
        <div className="flex items-center">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="text-white p-2 mr-2">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 bg-gray-800 text-white w-[250px] sm:w-[280px] overflow-y-auto max-h-screen">
              <div className="flex flex-col h-full">
                <NavItems />
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
  ) : (
    <>
      {/* Desktop Sidebar - Mantém as classes do layout original */}
      <div className={cn(
        "hidden md:flex md:w-56 lg:w-64 xl:w-72 md:flex-col md:fixed md:inset-y-0 bg-gray-800 text-white z-10",
        className
      )}>
        <div className="flex flex-col h-full">
          <NavItems />
        </div>
      </div>
    </>
  );
}