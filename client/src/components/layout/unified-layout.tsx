import { ReactNode, useEffect, useState } from "react";
import { Sidebar } from "./sidebar";
import { Loader2, LogOut } from "lucide-react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";

interface UnifiedLayoutProps {
  children: ReactNode;
  contentKey?: string; // Chave única para identificar o conteúdo (substituindo renderizar tudo novamente)
}

export function UnifiedLayout({ children, contentKey }: UnifiedLayoutProps) {
  const [location, navigate] = useLocation();
  const { user, checkRole } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [pageKey, setPageKey] = useState(`${location}-${contentKey || ''}`);
  
  // Efeito para controlar o estado de carregamento entre navegações
  useEffect(() => {
    const newPageKey = `${location}-${contentKey || ''}`;
    
    if (newPageKey !== pageKey) {
      setIsLoading(true);
      
      // Simula um carregamento rápido para dar feedback visual
      const timer = setTimeout(() => {
        setPageKey(newPageKey);
        setIsLoading(false);
      }, 200); // Tempo curto para não atrapalhar a experiência
      
      return () => clearTimeout(timer);
    }
  }, [location, contentKey, pageKey]);

  const handleLogout = async () => {
    try {
      await fetch("/api/logout", { 
        method: "POST",
        credentials: "include"
      });
      navigate("/auth");
    } catch (error) {
      console.error("Erro ao fazer logout:", error);
      navigate("/auth");
    }
  };

  const isAdmin = checkRole("admin");
  const userInitials = user?.fullName
    ?.split(" ")
    ?.map((name) => name[0]?.toUpperCase())
    ?.join("")
    ?.slice(0, 2) || "U";

  return (
    <div className="min-h-screen flex bg-gray-50">
      <Sidebar />
      
      {/* Header fixo no topo */}
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
              title="Logout"
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>
      
      <div className="flex-1 md:ml-56 lg:ml-64 xl:ml-72 pt-16 relative">
        {isLoading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-60 z-10">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : null}
        
        <div 
          className="md:py-8 md:px-6 p-4 md:pt-8 pt-4"
          key={pageKey} // Ajuda React a renderizar apenas o que mudou
        >
          {children}
        </div>
      </div>
    </div>
  );
}