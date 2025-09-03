import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { useIsMobile } from "@/hooks/use-mobile";
import { 
  Menu, 
  Home, 
  FileText, 
  ClipboardList, 
  ListChecks, 
  LogOut, 
  ChevronRight, 
  ChevronDown,
  Building2, 
  ClipboardEdit,
  LayoutDashboard,
  Users,
  Settings,
  Car,
  RefreshCw,
  Receipt,
  BarChart3,
  UploadCloud,
  PanelLeftClose,
  PanelLeftOpen
} from "lucide-react";

// Importar ícone personalizado de veículo
import genericTruckIcon from '@assets/{F9464883-3F10-4933-AF74-76A8D67A0F59}_1756866800903.png';

// Componente de ícone personalizado de veículo
const TruckIcon = ({ className, size = 20 }: { className?: string; size?: number }) => (
  <img 
    src={genericTruckIcon} 
    alt="Veículo" 
    className={className}
    style={{ 
      width: `${size}px`,
      height: `${size}px`,
      objectFit: 'contain'
    }}
  />
);
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Logo } from "@/components/ui/logo";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface SidebarProps {
  className?: string;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function Sidebar({ className, isCollapsed = false, onToggleCollapse }: SidebarProps) {
  const [location, setLocation] = useLocation();
  const { user, logoutMutation } = useAuth();
  const permissions = usePermissions();

  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [vehicleMenuExpanded, setVehicleMenuExpanded] = useState(false);

  const userInitials = user?.fullName
    .split(' ')
    .map(name => name[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  // Auto-expand vehicle menu when on vehicle-related pages
  useEffect(() => {
    const vehiclePages = ['/vehicles', '/admin/vehicle-models', '/admin/vehicle-transfer', '/cadastro-massa-veiculos'];
    // Otimização: Usar early return e evitar expansão desnecessária
    const shouldExpand = vehiclePages.includes(location);
    if (shouldExpand !== vehicleMenuExpanded) {
      setVehicleMenuExpanded(shouldExpand);
    }
  }, [location, vehicleMenuExpanded]);

  const handleLogout = async () => {
    // Previne múltiplos cliques durante logout
    if (logoutMutation.isPending) return;
    
    try {
      // Limpa o cache imediatamente para logout instantâneo
      const { queryClient } = await import("@/lib/queryClient");
      queryClient.setQueryData(["/api/user"], null);
      queryClient.clear();
      
      // Faz logout no servidor em background
      await fetch("/api/logout", { 
        method: "POST",
        credentials: "include"
      });
      
      // Força redirecionamento para tela inicial
      window.location.href = "/auth";
    } catch (error) {
      console.error("Erro no logout:", error);
      // Mesmo com erro, redireciona para tela inicial
      window.location.href = "/auth";
    }
  };

  const handleNavigate = (path: string) => {
    // Navegação otimizada - fecha modal primeiro para feedback visual instantâneo
    setOpen(false);
    
    // Navegação apenas se for caminho diferente
    if (location !== path) {
      setLocation(path);
    }
  };

  // Componente SidebarItem com tooltip para modo colapsado
  const SidebarItem = ({ icon: Icon, label, path, isActive, children }: {
    icon: any;
    label: string;
    path?: string;
    isActive?: boolean;
    children?: React.ReactNode;
  }) => {
    const content = (
      <Button
        variant="ghost"
        className={cn(
          "w-full text-white hover:bg-gray-700 transition-colors",
          isCollapsed ? "justify-center px-2" : "justify-start",
          isActive ? "bg-gray-700" : "bg-transparent"
        )}
        onClick={() => path && handleNavigate(path)}
      >
        <Icon className={cn("h-5 w-5", !isCollapsed && "mr-3")} />
        {!isCollapsed && <span className="flex-1 text-left">{label}</span>}
        {!isCollapsed && children}
      </Button>
    );

    if (isCollapsed) {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              {content}
            </TooltipTrigger>
            <TooltipContent side="right" className="ml-2">
              {label}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }

    return content;
  };

  const NavItems = () => (
    <>
      {/* Header da Sidebar */}
      <div className={cn(
        "flex items-center h-16 px-4 bg-gray-900 border-b border-gray-700",
        isCollapsed ? "justify-center" : "justify-between"
      )}>
        {!isCollapsed && <Logo width={120} className="py-2" />}
        {isCollapsed && <Logo width={32} className="py-2" />}
        
        {/* Botão de colapsar - apenas quando não está colapsado */}
        {!isMobile && !isCollapsed && onToggleCollapse && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleCollapse}
            className="text-white hover:bg-gray-700 p-1"
          >
            <PanelLeftClose className="h-4 w-4" />
          </Button>
        )}
      </div>
      
      {/* Conteúdo Principal da Sidebar */}
      <div className={cn(
        "py-4 space-y-1 overflow-y-auto h-full max-h-screen scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800",
        isCollapsed ? "px-1" : "px-2"
      )}>
        {/* Dashboard - Apenas para transportadores (usuários comuns) */}
        {user?.role === 'user' && (
          <SidebarItem
            icon={Home}
            label="Dashboard"
            path="/"
            isActive={location === "/" || location === "/dashboard"}
          />
        )}
        

        
        {/* Menu Hierárquico de Veículos */}
        {permissions.canViewVehicles() && (
          <div className="space-y-1">
            {/* Menu Principal de Veículos */}
            {!isCollapsed ? (
              <Button
                variant="ghost"
                className={cn(
                  "w-full justify-start text-white hover:bg-gray-700",
                  (location === "/vehicles" || location === "/admin/vehicle-models" || location === "/admin/vehicle-transfer" || location === "/cadastro-massa-veiculos") ? "bg-gray-700" : "bg-transparent"
                )}
                onClick={() => {
                  // Sempre navegar para veículos ao clicar no menu principal
                  handleNavigate("/vehicles");
                }}
              >
                <TruckIcon className="mr-3" size={20} />
                <span className="flex-1 text-left">Veículos</span>
                {vehicleMenuExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </Button>
            ) : (
              // No modo colapsado, mostrar apenas ícone dos veículos com acesso direto à lista
              <SidebarItem
                icon={() => <TruckIcon size={20} />}
                label="Veículos"
                path="/vehicles"
                isActive={location === "/vehicles" || location === "/admin/vehicle-models" || location === "/admin/vehicle-transfer" || location === "/cadastro-massa-veiculos"}
              />
            )}
            
            {/* Submenus de Veículos - apenas no modo expandido */}
            {!isCollapsed && vehicleMenuExpanded && (
              <div className="ml-6 space-y-1 border-l border-gray-600 pl-4">
                {/* Veículos Cadastrados */}
                <Button
                  variant="ghost"
                  className={cn(
                    "w-full justify-start text-white hover:bg-gray-600 text-sm",
                    location === "/vehicles" ? "bg-gray-600" : "bg-transparent"
                  )}
                  onClick={() => handleNavigate("/vehicles")}
                >
                  <TruckIcon className="mr-3" size={16} />
                  Veículos Cadastrados
                </Button>
                
                {/* Cadastro em Massa - Apenas para usuários administrativos */}
                {user?.role !== 'user' && (
                  <Button
                    variant="ghost"
                    className={cn(
                      "w-full justify-start text-white hover:bg-gray-600 text-sm",
                      location === "/cadastro-massa-veiculos" ? "bg-gray-600" : "bg-transparent"
                    )}
                    onClick={() => handleNavigate("/cadastro-massa-veiculos")}
                  >
                    <UploadCloud className="mr-3 h-4 w-4" />
                    Cadastro em Massa
                  </Button>
                )}
                
                {/* Modelos de Veículos - Apenas para usuários administrativos (não transportadores) */}
                {permissions.canViewVehicleModels() && user?.role !== 'user' && (
                  <Button
                    variant="ghost"
                    className={cn(
                      "w-full justify-start text-white hover:bg-gray-600 text-sm",
                      location === "/admin/vehicle-models" ? "bg-gray-600" : "bg-transparent"
                    )}
                    onClick={() => handleNavigate("/admin/vehicle-models")}
                  >
                    <Car className="mr-3 h-4 w-4" />
                    Modelos de Veículos
                  </Button>
                )}
                
                {/* Transferir Veículos - Apenas para usuários administrativos (não transportadores) */}
                {permissions.canViewUsers() && user?.role !== 'user' && (
                  <Button
                    variant="ghost"
                    className={cn(
                      "w-full justify-start text-white hover:bg-gray-600 text-sm",
                      location === "/admin/vehicle-transfer" ? "bg-gray-600" : "bg-transparent"
                    )}
                    onClick={() => handleNavigate("/admin/vehicle-transfer")}
                  >
                    <RefreshCw className="mr-3 h-4 w-4" />
                    Transferir Veículos
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
        
        {/* Solicitar Licença - Todos podem solicitar */}
        {permissions.canCreateLicenses() && (
          <SidebarItem
            icon={FileText}
            label="Solicitar Licença"
            path="/request-license"
            isActive={location === "/request-license"}
          />
        )}
        
        {/* Acompanhar Licença - Todos podem acompanhar */}
        {permissions.canTrackLicenses() && (
          <SidebarItem
            icon={ClipboardList}
            label="Acompanhar Licença"
            path="/track-license"
            isActive={location === "/track-license"}
          />
        )}
        
        {/* Licenças Emitidas - Todos podem ver suas licenças emitidas */}
        {permissions.canTrackLicenses() && (
          <SidebarItem
            icon={ListChecks}
            label="Licenças Emitidas"
            path="/issued-licenses"
            isActive={location === "/issued-licenses"}
          />
        )}
        
        {/* MEUS BOLETOS - Conforme permissões */}
        {permissions.canViewMyBoletos() && (
          <SidebarItem
            icon={Receipt}
            label="Meus Boletos"
            path="/meus-boletos"
            isActive={location === "/meus-boletos"}
          />
        )}
        
        {/* Seção de Funcionalidades Administrativas */}
        {user && ['admin', 'manager', 'supervisor', 'financial', 'operational'].includes(user.role) && (
          <>
            {!isCollapsed && (
              <div className="pt-2 pb-2">
                <Separator className="bg-gray-700" />
                <p className="text-xs text-gray-400 uppercase mt-2 ml-2 font-semibold">Administração</p>
              </div>
            )}
            
            {/* Dashboard AET - para perfis com acesso ao dashboard */}
            {permissions.canViewDashboard() && (
              <SidebarItem
                icon={BarChart3}
                label="Dashboard AET"
                path="/admin/dashboard-aet"
                isActive={location === "/admin/dashboard-aet"}
              />
            )}
            
            {/* Gerenciar Licenças - conforme permissões de gerenciamento */}
            {user && ['admin', 'manager', 'supervisor', 'financial', 'operational'].includes(user.role) && (
              <SidebarItem
                icon={ClipboardEdit}
                label="Gerenciar Licenças"
                path="/admin/licenses"
                isActive={location === "/admin/licenses" || location === "/gerenciar-licencas"}
              />
            )}
            
            {/* Importação em Massa de Licenças - para perfis operacionais */}
            {user && ['admin', 'manager', 'supervisor', 'operational'].includes(user.role) && (
              <SidebarItem
                icon={UploadCloud}
                label="Importar Licenças"
                path="/admin/bulk-license-import"
                isActive={location === "/admin/bulk-license-import"}
              />
            )}
            
            {/* Gerenciar Transportadores - conforme permissões */}
            {user && ['admin', 'manager', 'supervisor', 'financial', 'operational'].includes(user.role) && (
              <SidebarItem
                icon={Building2}
                label="Transportadores"
                path="/admin/transporters"
                isActive={location === "/admin/transporters"}
              />
            )}
            
            {/* Gerenciar Usuários - conforme permissões */}
            {permissions.canViewUsers() && (
              <SidebarItem
                icon={Users}
                label="Usuários"
                path="/admin/users"
                isActive={location === "/admin/users"}
              />
            )}
            
            {/* Tipos de Conjunto - apenas admin */}
            {user?.role === 'admin' && (
              <SidebarItem
                icon={Settings}
                label="Tipos de Conjunto"
                path="/admin/vehicle-set-types"
                isActive={location === "/admin/vehicle-set-types"}
              />
            )}
            
            {/* Módulo Financeiro - apenas para perfis financeiro, manager e admin */}
            {permissions.canViewFinancial() && (
              <SidebarItem
                icon={Receipt}
                label="Módulo Financeiro"
                path="/admin/boletos"
                isActive={location === "/admin/boletos"}
              />
            )}

          </>
        )}
      </div>
      
      {/* Footer da Sidebar com informações do usuário */}
      <div className="mt-auto border-t border-gray-700">
        {/* Botão de expandir quando colapsado */}
        {!isMobile && isCollapsed && onToggleCollapse && (
          <div className="p-2 flex justify-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleCollapse}
              className="text-white hover:bg-gray-700 p-2"
            >
              <PanelLeftOpen className="h-4 w-4" />
            </Button>
          </div>
        )}
        
        {/* Informações do usuário */}
        <div className={cn(
          "p-3 bg-gray-800",
          isCollapsed ? "flex justify-center" : "flex items-center space-x-3"
        )}>
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-blue-600 text-white text-sm">
              {userInitials}
            </AvatarFallback>
          </Avatar>
          
          {!isCollapsed && (
            <>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {user?.fullName}
                </p>
                <p className="text-xs text-gray-400 truncate">
                  {user?.email}
                </p>
              </div>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                disabled={logoutMutation.isPending}
                className="text-gray-300 hover:text-white hover:bg-gray-700 p-1"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </>
          )}
          
          {isCollapsed && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleLogout}
                    disabled={logoutMutation.isPending}
                    className="text-gray-300 hover:text-white hover:bg-gray-700 p-2"
                  >
                    <LogOut className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right" className="ml-2">
                  Sair ({user?.fullName})
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
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
      {/* Desktop Sidebar - Responsiva com colapso */}
      <div className={cn(
        "hidden md:flex md:flex-col md:fixed md:inset-y-0 bg-gray-800 text-white z-10 transition-all duration-300",
        isCollapsed ? "md:w-16" : "md:w-56 lg:w-64 xl:w-72",
        className
      )}>
        <div className="flex flex-col h-full">
          <NavItems />
        </div>
      </div>
    </>
  );
}