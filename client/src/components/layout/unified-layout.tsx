import { ReactNode, useEffect, useState } from "react";
import { Sidebar } from "./sidebar";
import { MobileNavigation } from "@/components/mobile/mobile-navigation";
import { useIsMobile } from "@/hooks/use-mobile";
import { Loader2, LogOut } from "lucide-react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { performLogout } from "@/utils/logout";

interface UnifiedLayoutProps {
  children: ReactNode;
  contentKey?: string;
}

export function UnifiedLayout({ children, contentKey }: UnifiedLayoutProps) {
  const [location, navigate] = useLocation();
  const { user, checkRole } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [pageKey, setPageKey] = useState(`${location}-${contentKey || ''}`);
  const isMobile = useIsMobile();
  
  // Otimização de navegação - remove delay artificial
  useEffect(() => {
    const newPageKey = `${location}-${contentKey || ''}`;
    
    if (newPageKey !== pageKey) {
      setPageKey(newPageKey);
      setIsLoading(false);
    }
  }, [location, contentKey, pageKey]);

  const handleLogout = async () => {
    if (isLoggingOut) return;
    
    setIsLoggingOut(true);
    
    try {
      await performLogout(navigate);
    } catch (error) {
      console.error("Erro no logout:", error);
      navigate("/auth");
    } finally {
      setIsLoggingOut(false);
    }
  };

  const isAdmin = user?.role === 'admin' || user?.role === 'supervisor' || user?.role === 'operational' || user?.role === 'manager' || user?.role === 'financial';

  const userInitials = user?.fullName
    ?.split(" ")
    ?.filter(name => name.length > 0)
    ?.map((name) => name[0]?.toUpperCase())
    ?.join("")
    ?.slice(0, 2) || "U";

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Sidebar apenas para desktop */}
      {!isMobile && <Sidebar />}
      
      {/* Header fixo no topo - apenas para desktop */}
      {!isMobile && (
        <div className="fixed top-0 right-0 left-0 md:left-56 lg:left-64 xl:left-72 z-30 bg-white border-b border-gray-200 h-16">
          <div className="flex items-center justify-end h-full px-6">
            <div className="flex items-center space-x-3">
              <div className="text-right">
                <div className="text-sm font-medium text-gray-900">
                  {user?.fullName}
                </div>
                <div className="text-xs text-gray-500">
                  {user?.email}
                </div>
              </div>
              <div className="flex flex-wrap gap-1">
                {isAdmin && <span className="bg-blue-600 text-white text-[10px] px-1 py-0.5 rounded">Admin</span>}
                {user?.role === 'supervisor' && <span className="bg-green-600 text-white text-[10px] px-1 py-0.5 rounded">Supervisor</span>}
                {user?.role === 'operational' && <span className="bg-orange-600 text-white text-[10px] px-1 py-0.5 rounded">Operacional</span>}
                {user?.role === 'financial' && <span className="bg-purple-600 text-white text-[10px] px-1 py-0.5 rounded">Financeiro</span>}
                {user?.role === 'user' && <span className="bg-gray-600 text-white text-[10px] px-1 py-0.5 rounded">Transportador</span>}
              </div>
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-gray-600 text-white text-sm">
                  {userInitials}
                </AvatarFallback>
              </Avatar>
              <Button 
                variant="ghost" 
                size="icon" 
                className="text-gray-500 hover:text-gray-700"
                onClick={handleLogout}
                disabled={isLoggingOut}
                title="Logout"
              >
                {isLoggingOut ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <LogOut className="h-5 w-5" />
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
      
      {/* Conteúdo principal */}
      <div className={`flex-1 ${isMobile ? 'pt-0 pb-20' : 'md:ml-56 lg:ml-64 xl:ml-72 pt-16'} relative`}>
        {isLoading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-60 z-10">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : null}
        
        <div 
          className={`${isMobile ? 'p-4 pt-4' : 'md:py-8 md:px-6 p-4 md:pt-8 pt-4'}`}
          key={pageKey}
        >
          {children}
        </div>
      </div>
      
      {/* Navegação mobile no rodapé */}
      {isMobile && <MobileNavigation />}
    </div>
  );
}