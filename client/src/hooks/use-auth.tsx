import { createContext, ReactNode, useContext, useRef } from "react";
import {
  useQuery,
  useMutation,
  UseMutationResult,
} from "@tanstack/react-query";
import { insertUserSchema, User } from "@shared/schema";
import { getQueryFn, apiRequest, queryClient } from "../lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  error: Error | null;
  loginMutation: UseMutationResult<User, Error, LoginData>;
  logoutMutation: UseMutationResult<void, Error, void>;
  registerMutation: UseMutationResult<User, Error, RegisterData>;
  checkRole: (role: 'admin' | 'supervisor' | 'operational' | 'financial') => boolean;
};

const loginSchema = z.object({
  email: z.string().email("Por favor insira um e-mail válido"),
  password: z.string().min(6, "A senha deve ter pelo menos 6 caracteres"),
});

const registerSchema = insertUserSchema.extend({
  confirmPassword: z.string().min(6, "A confirmação de senha deve ter pelo menos 6 caracteres"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "As senhas não coincidem",
  path: ["confirmPassword"],
});

type LoginData = z.infer<typeof loginSchema>;
type RegisterData = z.infer<typeof registerSchema>;

export const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const logoutInProgress = useRef(false);
  const {
    data: user,
    error,
    isLoading,
  } = useQuery<User | null, Error>({
    queryKey: ["/api/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });
  
  // Helper para verificar os papéis de usuário
  const checkRole = (role: 'admin' | 'supervisor' | 'operational' | 'financial'): boolean => {
    if (!user) return false;
    
    switch (role) {
      case 'admin':
        return user.role === 'admin' || !!user.isAdmin;
      case 'supervisor':
        return user.role === 'admin' || user.role === 'supervisor' || !!user.isAdmin;
      case 'operational':
        return user.role === 'admin' || user.role === 'supervisor' || user.role === 'operational' || !!user.isAdmin;
      case 'financial':
        return user.role === 'admin' || user.role === 'financial' || !!user.isAdmin;
      default:
        return false;
    }
  };

  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginData) => {
      const res = await apiRequest("POST", "/api/login", credentials);
      return await res.json();
    },
    onSuccess: (user: User) => {
      queryClient.setQueryData(["/api/user"], user);
      toast({
        title: "Login realizado com sucesso",
        description: `Bem-vindo(a), ${user.fullName}!`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Falha no login",
        description: error.message || "Credenciais inválidas",
        variant: "destructive",
      });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (userData: RegisterData) => {
      // Remove confirmPassword before sending to the server
      const { confirmPassword, ...userDataToSend } = userData;
      const res = await apiRequest("POST", "/api/register", userDataToSend);
      return await res.json();
    },
    onSuccess: (user: User) => {
      queryClient.setQueryData(["/api/user"], user);
      toast({
        title: "Cadastro realizado com sucesso",
        description: `Bem-vindo(a), ${user.fullName}!`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Falha no cadastro",
        description: error.message || "Não foi possível criar sua conta",
        variant: "destructive",
      });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      // Previne múltiplas execuções simultâneas
      if (logoutInProgress.current) return;
      logoutInProgress.current = true;
      
      try {
        // Limpa o cache imediatamente para logout instantâneo
        queryClient.setQueryData(["/api/user"], null);
        queryClient.clear(); // Remove todos os dados em cache
        
        // Faz a requisição de logout em background
        await fetch("/api/logout", {
          method: "POST",
          credentials: "include"
        });
      } catch (error) {
        // Silencia erros de logout - usuário já foi deslogado localmente
        console.warn("Erro no logout do servidor:", error);
      } finally {
        // Reset da flag após um pequeno delay para evitar cliques duplos
        setTimeout(() => {
          logoutInProgress.current = false;
        }, 1000);
      }
    },
    onSuccess: () => {
      toast({
        title: "Logout realizado",
        description: "Você foi desconectado.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Falha no logout",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <AuthContext.Provider
      value={{
        user: user || null,
        isLoading,
        error,
        loginMutation,
        logoutMutation,
        registerMutation,
        checkRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export { loginSchema, registerSchema };
