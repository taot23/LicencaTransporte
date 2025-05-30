import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';

interface WSMessage {
  type: 'STATUS_UPDATE' | 'LICENSE_UPDATE' | 'USER_ACTIVITY' | 'CONNECTED';
  data: any;
}

interface WebSocketContextType {
  isConnected: boolean;
  lastMessage: WSMessage | null;
  sendMessage: (message: WSMessage) => void;
  connectionError: string | null;
}

const WebSocketContext = createContext<WebSocketContextType | null>(null);

interface WebSocketProviderProps {
  children: ReactNode;
}

export function WebSocketProvider({ children }: WebSocketProviderProps) {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WSMessage | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);

  const connect = useCallback(() => {
    try {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      
      console.log('Conectando ao WebSocket:', wsUrl);
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('WebSocket conectado');
        setIsConnected(true);
        setConnectionError(null);
        setReconnectAttempts(0);
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as WSMessage;
          console.log('Mensagem WebSocket recebida:', message);
          setLastMessage(message);
        } catch (error) {
          console.error('Erro ao analisar mensagem WebSocket:', error);
        }
      };

      ws.onclose = (event) => {
        console.log('WebSocket desconectado:', event.code, event.reason);
        setIsConnected(false);
        setSocket(null);
        
        // Tentar reconectar automaticamente após um atraso
        if (reconnectAttempts < 5) {
          const delay = Math.pow(2, reconnectAttempts) * 1000; // Backoff exponencial
          console.log(`Tentando reconectar em ${delay}ms (tentativa ${reconnectAttempts + 1}/5)`);
          
          setTimeout(() => {
            setReconnectAttempts(prev => prev + 1);
            connect();
          }, delay);
        } else {
          setConnectionError('Falha na conexão WebSocket após várias tentativas');
        }
      };

      ws.onerror = (error) => {
        console.error('Erro no WebSocket:', error);
        setConnectionError('Erro na conexão WebSocket');
      };

      setSocket(ws);
    } catch (error) {
      console.error('Erro ao criar conexão WebSocket:', error);
      setConnectionError('Erro ao estabelecer conexão WebSocket');
    }
  }, [reconnectAttempts]);

  const sendMessage = useCallback((message: WSMessage) => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      try {
        socket.send(JSON.stringify(message));
        console.log('Mensagem enviada via WebSocket:', message);
      } catch (error) {
        console.error('Erro ao enviar mensagem WebSocket:', error);
      }
    } else {
      console.warn('WebSocket não está conectado. Não é possível enviar mensagem:', message);
    }
  }, [socket]);

  useEffect(() => {
    connect();

    // Cleanup na desmontagem do componente
    return () => {
      if (socket) {
        socket.close();
      }
    };
  }, []);

  // Reconectar quando a página volta ao foco (útil para mobile/PWA)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && !isConnected && socket?.readyState !== WebSocket.CONNECTING) {
        console.log('Página voltou ao foco, tentando reconectar WebSocket');
        connect();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isConnected, connect, socket]);

  const value: WebSocketContextType = {
    isConnected,
    lastMessage,
    sendMessage,
    connectionError
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocketContext(): WebSocketContextType {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocketContext deve ser usado dentro de um WebSocketProvider');
  }
  return context;
}