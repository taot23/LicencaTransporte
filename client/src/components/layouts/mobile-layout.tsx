import { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { 
  Home, 
  Truck, 
  FileText, 
  Search, 
  List, 
  User, 
  Menu, 
  X,
  LogOut,
  Receipt,
  Settings,
  Check
} from "lucide-react";
import { MobileNavigation } from "@/components/mobile/mobile-navigation";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { isAdminUser, isOperationalUser } from "@/lib/utils";

interface MobileLayoutProps {
  children: ReactNode;
  title: string;
  showBackButton?: boolean;
  backLink?: string;
}

export function MobileLayout({ 
  children, 
  title, 
  showBackButton = false,
  backLink = "/dashboard"
}: MobileLayoutProps) {
  const [location] = useLocation();
  const { user, logoutMutation } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  
  const handleLogout = async () => {
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
  
  // Obtém as iniciais do nome do usuário
  const getInitials = () => {
    if (!user?.fullName) return "U";
    
    const names = user.fullName.split(" ");
    if (names.length === 1) return names[0].charAt(0).toUpperCase();
    return (names[0].charAt(0) + names[names.length - 1].charAt(0)).toUpperCase();
  };
  
  // Desativa o scroll da página quando o menu estiver aberto
  const toggleMenu = (open: boolean) => {
    setIsOpen(open);
    document.body.style.overflow = open ? "hidden" : "";
  };
  
  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Cabeçalho fixo */}
      <header className="sticky top-0 z-50 w-full bg-background border-b shadow-sm h-14 flex items-center px-4">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center">
            {showBackButton ? (
              <Link href={backLink}>
                <Button variant="ghost" size="icon" className="mr-2">
                  <span className="sr-only">Voltar</span>
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-chevron-left"><path d="m15 18-6-6 6-6"/></svg>
                </Button>
              </Link>
            ) : null}
            <h1 className="text-lg font-semibold truncate">{title}</h1>
          </div>
          
          <Sheet open={isOpen} onOpenChange={toggleMenu}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[280px] p-0">
              <SheetHeader className="border-b p-4">
                <SheetTitle className="flex items-center gap-3">
                  <Avatar>
                    <AvatarFallback>{getInitials()}</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{user?.fullName}</span>
                    <span className="text-xs text-muted-foreground">{user?.email}</span>
                  </div>
                </SheetTitle>
              </SheetHeader>
              <div className="py-4">
                <nav className="flex flex-col gap-1 px-2">
                  <Link href="/dashboard">
                    <Button 
                      variant={location === "/dashboard" ? "secondary" : "ghost"} 
                      className="w-full justify-start" 
                      onClick={() => setIsOpen(false)}
                    >
                      <Home className="mr-2 h-4 w-4" />
                      Dashboard
                    </Button>
                  </Link>
                  
                  <Link href="/vehicles">
                    <Button 
                      variant={location === "/vehicles" ? "secondary" : "ghost"} 
                      className="w-full justify-start" 
                      onClick={() => setIsOpen(false)}
                    >
                      <Truck className="mr-2 h-4 w-4" />
                      Veículos
                    </Button>
                  </Link>
                  
                  <Link href="/request-license">
                    <Button 
                      variant={location === "/request-license" ? "secondary" : "ghost"} 
                      className="w-full justify-start" 
                      onClick={() => setIsOpen(false)}
                    >
                      <FileText className="mr-2 h-4 w-4" />
                      Solicitar Licença
                    </Button>
                  </Link>
                  
                  <Link href="/track-license">
                    <Button 
                      variant={location === "/track-license" ? "secondary" : "ghost"} 
                      className="w-full justify-start" 
                      onClick={() => setIsOpen(false)}
                    >
                      <Search className="mr-2 h-4 w-4" />
                      Acompanhar Licenças
                    </Button>
                  </Link>
                  
                  <Link href="/issued-licenses">
                    <Button 
                      variant={location === "/issued-licenses" ? "secondary" : "ghost"} 
                      className="w-full justify-start" 
                      onClick={() => setIsOpen(false)}
                    >
                      <Check className="mr-2 h-4 w-4" />
                      Licenças Emitidas
                    </Button>
                  </Link>
                  
                  <Link href="/meus-boletos">
                    <Button 
                      variant={location === "/meus-boletos" ? "secondary" : "ghost"} 
                      className="w-full justify-start" 
                      onClick={() => setIsOpen(false)}
                    >
                      <Receipt className="mr-2 h-4 w-4" />
                      Meus Boletos
                    </Button>
                  </Link>
                  
                  {(user && (isAdminUser(user) || isOperationalUser(user))) && (
                    <Link href="/admin">
                      <Button 
                        variant={location.startsWith("/admin") ? "secondary" : "ghost"} 
                        className="w-full justify-start" 
                        onClick={() => setIsOpen(false)}
                      >
                        <Settings className="mr-2 h-4 w-4" />
                        Administração
                      </Button>
                    </Link>
                  )}
                  
                  <hr className="my-2 mx-1 border-muted" />
                  
                  <Button 
                    variant="ghost" 
                    className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10" 
                    onClick={() => {
                      setIsOpen(false);
                      handleLogout();
                    }}
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Sair
                  </Button>
                </nav>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>
      
      {/* Conteúdo principal */}
      <main className="flex-1 px-3 py-4 pb-24">
        {children}
      </main>
      
      {/* Navegação inferior */}
      <MobileNavigation />
    </div>
  );
}