import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    try {
      // Tentar extrair erro como JSON primeiro se possível
      const contentType = res.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const errorJson = await res.json();
        throw new Error(errorJson.message || `${res.status}: ${res.statusText}`);
      } else {
        const text = await res.text();
        throw new Error(text || `${res.status}: ${res.statusText}`);
      }
    } catch (e) {
      // Se não conseguir parsear ou outro erro
      if (e instanceof Error) {
        throw e;
      }
      throw new Error(`${res.status}: ${res.statusText}`);
    }
  }
}

/**
 * Função para realizar requisições à API com tratamento de erro padronizado
 */
export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
  options?: { 
    headers?: Record<string, string>;
    isFormData?: boolean;
  }
): Promise<Response> {
  try {
    // Verifica se é FormData diretamente ou pela flag
    const isFormData = data instanceof FormData || options?.isFormData === true;
    const headers = options?.headers || {};
    
    // Não definimos Content-Type para FormData, o navegador define automaticamente com o boundary correto
    if (data && !isFormData && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }
    
    const res = await fetch(url, {
      method,
      headers,
      // Para FormData não usamos JSON.stringify
      body: isFormData ? (data as BodyInit) : data ? JSON.stringify(data) : undefined,
      credentials: "include",
    });

    await throwIfResNotOk(res);
    return res;
  } catch (error) {
    console.error(`Erro na requisição ${method} ${url}:`, error);
    throw error;
  }
}

/**
 * Comportamentos possíveis quando ocorre erro 401 (não autenticado)
 */
type UnauthorizedBehavior = "returnNull" | "throw";

/**
 * Função de query para o TanStack Query com tratamento de erros
 */
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    try {
      const url = queryKey[0] as string;
      const res = await fetch(url, {
        method: 'GET',
        credentials: "include",
        headers: {
          'Accept': 'application/json'
        }
      });

      // Tratamento específico para erros de autenticação
      if (res.status === 401) {
        if (unauthorizedBehavior === "returnNull") {
          return null;
        } else {
          throw new Error("Não autenticado");
        }
      }

      await throwIfResNotOk(res);
      return await res.json();
    } catch (error) {
      console.error(`Erro na consulta:`, error);
      throw error;
    }
  };

/**
 * Cliente de query configurado com os padrões da aplicação
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      // TEMPO REAL INSTANTÂNEO: Cache ultra baixo para cores mudarem instantaneamente
      staleTime: 1000, // 1 segundo para tempo real
      gcTime: 30 * 1000, // 30 segundos
      // FORÇA refetch para tempo real
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      refetchOnMount: true,
      // Retry otimizado para tempo real
      retry: (failureCount, error: any) => {
        if (error?.message?.includes('401') || error?.message?.includes('Não autenticado')) {
          return false;
        }
        return failureCount < 2;
      },
      retryDelay: 300, // Delay menor para atualizações mais rápidas
      networkMode: 'online',
    },
    mutations: {
      retry: 1,
      networkMode: 'online',
    },
  },
});
