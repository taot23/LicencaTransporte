import { ReactNode, useEffect, useState } from "react";
import { Sidebar } from "./sidebar";
import { Loader2 } from "lucide-react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";

interface UnifiedLayoutProps {
  children: ReactNode;
  contentKey?: string; // Chave única para identificar o conteúdo (substituindo renderizar tudo novamente)
}

export function UnifiedLayout({ children, contentKey }: UnifiedLayoutProps) {
  const [location] = useLocation();
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

  return (
    <div className="min-h-screen flex bg-gray-50">
      <Sidebar />
      
      <div className="flex-1 md:ml-56 lg:ml-64 xl:ml-72 md:pt-16 relative">
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