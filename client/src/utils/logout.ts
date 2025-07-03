let isLoggingOut = false;
let logoutPromise: Promise<void> | null = null;

/**
 * Função centralizada de logout com proteção contra múltiplos cliques
 */
export const performLogout = async (navigate?: (path: string) => void) => {
  // Se já existe um logout em andamento, aguarda ele terminar
  if (logoutPromise) {
    console.log("Logout já em andamento, aguardando...");
    return logoutPromise;
  }

  // Previne múltiplos cliques
  if (isLoggingOut) {
    console.log("Logout já em andamento, ignorando...");
    return;
  }

  // Cria uma promise para o processo de logout
  logoutPromise = new Promise<void>(async (resolve) => {
    isLoggingOut = true;
    
    try {
      console.log("Iniciando processo de logout...");
      
      // Limpa o cache imediatamente
      const { queryClient } = await import("@/lib/queryClient");
      queryClient.clear();
      
      // Tenta logout no servidor primeiro (com timeout)
      try {
        await Promise.race([
          fetch("/api/logout", { 
            method: "POST",
            credentials: "include"
          }),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error("Timeout")), 3000)
          )
        ]);
        console.log("Logout no servidor concluído");
      } catch (error) {
        console.log("Erro/timeout no logout do servidor, prosseguindo...", error);
      }
      
      // Redirecionamento após tentar logout no servidor
      if (navigate) {
        navigate("/auth");
      } else {
        window.location.href = "/auth";
      }
      
    } catch (error) {
      console.error("Erro no logout:", error);
      // Mesmo com erro, redirecionar
      if (navigate) {
        navigate("/auth");
      } else {
        window.location.href = "/auth";
      }
    } finally {
      // Reset dos flags
      isLoggingOut = false;
      logoutPromise = null;
      resolve();
    }
  });

  return logoutPromise;
};