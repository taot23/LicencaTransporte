import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { queryClient } from '@/lib/queryClient';

// Tipos de mensagem WebSocket
export interface WebSocketMessage {
  type: 'STATUS_UPDATE' | 'LICENSE_UPDATE' | 'DASHBOARD_UPDATE' | 'CONNECTED';
  data?: any;
  message?: string;
  timestamp?: string;
}

// Context para WebSocket
interface WebSocketContextType {
  isConnected: boolean;
  lastMessage: WebSocketMessage | null;
  send: (message: any) => void;
}

const WebSocketContext = createContext<WebSocketContextType | null>(null);

// Provider do WebSocket
export function WebSocketProvider({ children }: { children: ReactNode }) {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);

  const connect = () => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    console.log('Conectando ao WebSocket em', wsUrl);
    
    const ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
      console.log('WebSocket conectado');
      setIsConnected(true);
      setSocket(ws);
    };
    
    ws.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        console.log('Mensagem recebida:', message);
        setLastMessage(message);
        
        // TEMPO REAL INSTANTÂNEO: Processar atualizações imediatamente
        if (message.type === 'STATUS_UPDATE' || message.type === 'LICENSE_UPDATE') {
          console.log('🔄 [TEMPO REAL INSTANTÂNEO] Processando:', message.type, message.data);
          
          // FORÇAR ATUALIZAÇÃO IMEDIATA - staleTime = 0 temporariamente
          queryClient.resetQueries({ queryKey: ['/api/licenses'] });
          queryClient.resetQueries({ queryKey: ['/api/admin/licenses'] });
          queryClient.resetQueries({ queryKey: ['/api/dashboard/stats'] });
          
          // Refetch forçado para garantir dados frescos
          Promise.all([
            queryClient.refetchQueries({ queryKey: ['/api/licenses'], type: 'active' }),
            queryClient.refetchQueries({ queryKey: ['/api/admin/licenses'], type: 'active' }),
            queryClient.refetchQueries({ queryKey: ['/api/dashboard/stats'], type: 'active' })
          ]).then(() => {
            console.log('✅ [TEMPO REAL] Todas as queries atualizadas instantaneamente');
          });
          
          // Forçar re-render dos componentes com timestamp único
          setLastMessage({ ...message, timestamp: new Date().toISOString() });
        }
      } catch (error) {
        console.error('[REALTIME] Erro ao processar mensagem WebSocket:', error);
      }
    };
    
    ws.onclose = () => {
      console.log('WebSocket desconectado');
      setIsConnected(false);
      setSocket(null);
      
      // Reconectar após 1 segundo
      setTimeout(connect, 1000);
    };
    
    ws.onerror = (error) => {
      console.error('[REALTIME] Erro WebSocket:', error);
    };
  };

  useEffect(() => {
    connect();
    
    return () => {
      if (socket) {
        socket.close();
      }
    };
  }, []);

  const send = (message: any) => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
    }
  };

  return (
    <WebSocketContext.Provider value={{ isConnected, lastMessage, send }}>
      {children}
    </WebSocketContext.Provider>
  );
}

// Hook para usar o contexto
export function useWebSocketContext() {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocketContext deve ser usado dentro de WebSocketProvider');
  }
  return context;
}