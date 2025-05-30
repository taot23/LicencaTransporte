import { createContext, useContext, ReactNode } from 'react';
import { useWebSocket, WebSocketMessage } from './use-websocket';
import { useToast } from './use-toast';

// Interface do contexto
interface WebSocketContextType {
  isConnected: boolean;
  lastMessage: WebSocketMessage | null;
  sendMessage: (message: WebSocketMessage) => boolean;
}

// Criar contexto
const WebSocketContext = createContext<WebSocketContextType | null>(null);

// Provider
export function WebSocketProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const { isConnected, lastMessage, sendMessage } = useWebSocket();
  
  // Exibir toast para atualizações de status (opcional, para debug)
  if (lastMessage?.type === 'STATUS_UPDATE' && lastMessage.data) {
    console.log('Status atualizado:', lastMessage.data);
    
    // Comentado para evitar muitos toasts em produção, descomente para debug
    /*
    toast({
      title: 'Status atualizado',
      description: `Licença #${lastMessage.data.licenseId} - Estado ${lastMessage.data.state}: ${lastMessage.data.status}`,
      variant: 'default',
    });
    */
  }
  
  return (
    <WebSocketContext.Provider value={{ isConnected, lastMessage, sendMessage }}>
      {children}
    </WebSocketContext.Provider>
  );
}

// Hook para usar o contexto
export function useWebSocketContext() {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocketContext deve ser usado dentro de um WebSocketProvider');
  }
  return context;
}