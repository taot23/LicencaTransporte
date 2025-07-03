let isLoggingOut = false;

/**
 * Função centralizada de logout com proteção contra múltiplos cliques
 */
export const performLogout = async (navigate?: (path: string) => void) => {
  // Previne múltiplos cliques
  if (isLoggingOut) {
    console.log("Logout já em andamento, ignorando...");
    return;
  }

  isLoggingOut = true;
  
  try {
    console.log("Iniciando processo de logout...");
    
    // Limpa o cache imediatamente
    const { queryClient } = await import("@/lib/queryClient");
    queryClient.clear();
    
    // Redirecionamento IMEDIATO - não aguardar servidor
    if (navigate) {
      navigate("/auth");
    } else {
      window.location.href = "/auth";
    }
    
    // Logout no servidor em background - não bloquear redirecionamento
    fetch("/api/logout", { 
      method: "POST",
      credentials: "include"
    }).catch(() => {
      // Ignorar erros - o redirecionamento já aconteceu
    });
    
  } catch (error) {
    console.error("Erro no logout:", error);
    // Mesmo com erro, redirecionar
    if (navigate) {
      navigate("/auth");
    } else {
      window.location.href = "/auth";
    }
  } finally {
    // Reset do flag após um tempo menor
    setTimeout(() => {
      isLoggingOut = false;
    }, 500);
  }
};