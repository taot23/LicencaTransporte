import { apiRequest } from "@/lib/queryClient";

let isLoggingOut = false;
let logoutTimeout: NodeJS.Timeout | null = null;

/**
 * Função centralizada de logout com proteção contra múltiplos cliques
 */
export const performLogout = async (navigate?: (path: string) => void) => {
  // Previne múltiplos cliques em um período curto
  if (isLoggingOut) {
    console.log("Logout já em andamento, ignorando...");
    return;
  }

  // Debounce para evitar duplo clique
  if (logoutTimeout) {
    clearTimeout(logoutTimeout);
  }

  logoutTimeout = setTimeout(async () => {
    isLoggingOut = true;
    
    try {
      console.log("Iniciando processo de logout...");
      
      // Limpa o cache imediatamente
      const { queryClient } = await import("@/lib/queryClient");
      queryClient.clear();
      
      // Fazer logout no servidor
      await apiRequest("POST", "/api/logout");
      console.log("Logout no servidor concluído");
      
      // Redirecionamento
      if (navigate) {
        navigate("/auth");
      } else {
        window.location.href = "/auth";
      }
      
    } catch (error) {
      console.error("Erro no logout:", error);
      // Mesmo com erro, redirecionar para garantir que o usuário saia
      if (navigate) {
        navigate("/auth");
      } else {
        window.location.href = "/auth";
      }
    } finally {
      // Reset do flag após um delay para permitir novo logout se necessário
      setTimeout(() => {
        isLoggingOut = false;
      }, 2000);
    }
  }, 100); // Debounce de 100ms
};