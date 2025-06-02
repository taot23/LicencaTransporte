import { useState, useEffect, useRef, useCallback } from 'react';
import { queryClient } from '@/lib/queryClient';

// Tipos de mensagem
export type WebSocketMessage = {
  type: 'STATUS_UPDATE' | 'LICENSE_UPDATE' | 'DASHBOARD_UPDATE' | 'VEHICLE_UPDATE' | 'TRANSPORTER_UPDATE' | 'USER_UPDATE' | 'ACTIVITY_LOG_UPDATE' | 'CACHE_INVALIDATION' | 'CONNECTED';
  data?: any;
  message?: string;
};

// Hook para usar WebSocket
export function useWebSocket() {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const socketRef = useRef<WebSocket | null>(null);

  // Função para invalidar o cache e forçar o recarregamento de dados
  const invalidateQueryData = useCallback((type: string, data: any) => {
    console.log(`🔄 Processando atualização WebSocket: ${type}`, data);
    
    switch (type) {
      case 'STATUS_UPDATE':
      case 'LICENSE_UPDATE':
        // Invalidar todas as queries relacionadas a licenças
        queryClient.invalidateQueries({ queryKey: ['/api/licenses'] });
        queryClient.invalidateQueries({ queryKey: ['/api/admin/licenses'] });
        queryClient.invalidateQueries({ queryKey: ['/api/licenses/issued'] });
        queryClient.invalidateQueries({ queryKey: ['/api/licenses/drafts'] });
        
        // Se tiver ID específico da licença
        if (data.licenseId) {
          queryClient.invalidateQueries({ queryKey: [`/api/licenses/${data.licenseId}`] });
          queryClient.invalidateQueries({ queryKey: [`/api/admin/licenses/${data.licenseId}`] });
        }
        
        // Sempre invalidar dashboard quando licenças mudam
        queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
        queryClient.invalidateQueries({ queryKey: ['/api/admin/dashboard/stats'] });
        break;
        
      case 'DASHBOARD_UPDATE':
        // Atualizar estatísticas do dashboard
        queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
        queryClient.invalidateQueries({ queryKey: ['/api/admin/dashboard/stats'] });
        break;
        
      case 'VEHICLE_UPDATE':
        // Invalidar queries de veículos
        queryClient.invalidateQueries({ queryKey: ['/api/vehicles'] });
        queryClient.invalidateQueries({ queryKey: ['/api/admin/vehicles'] });
        
        if (data.vehicleId) {
          queryClient.invalidateQueries({ queryKey: [`/api/vehicles/${data.vehicleId}`] });
        }
        break;
        
      case 'TRANSPORTER_UPDATE':
        // Invalidar queries de transportadores
        queryClient.invalidateQueries({ queryKey: ['/api/transporters'] });
        queryClient.invalidateQueries({ queryKey: ['/api/public/transporters'] });
        
        if (data.transporterId) {
          queryClient.invalidateQueries({ queryKey: [`/api/public/transporters/${data.transporterId}`] });
        }
        break;
        
      case 'USER_UPDATE':
        // Invalidar queries de usuários
        queryClient.invalidateQueries({ queryKey: ['/api/users'] });
        queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
        break;
        
      case 'ACTIVITY_LOG_UPDATE':
        // Invalidar logs de atividade
        queryClient.invalidateQueries({ queryKey: ['/api/admin/activity-logs'] });
        queryClient.invalidateQueries({ queryKey: ['/api/status-history'] });
        break;
        
      case 'CACHE_INVALIDATION':
        // Invalidação customizada baseada em queryKeys específicas
        if (data.queryKeys && Array.isArray(data.queryKeys)) {
          data.queryKeys.forEach((queryKey: string) => {
            queryClient.invalidateQueries({ queryKey: [queryKey] });
          });
        }
        break;
        
      default:
        console.log(`Tipo de mensagem WebSocket não reconhecido: ${type}`);
    }
  }, []);

  // Inicializar a conexão WebSocket
  useEffect(() => {
    // Função para conectar ao WebSocket
    const connectWebSocket = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      
      console.log(`Conectando ao WebSocket em ${wsUrl}`);
      
      const socket = new WebSocket(wsUrl);
      socketRef.current = socket;
      
      socket.onopen = () => {
        console.log('WebSocket conectado');
        setIsConnected(true);
      };
      
      socket.onclose = () => {
        console.log('WebSocket desconectado');
        setIsConnected(false);
        // Tentar reconectar após 3 segundos
        setTimeout(connectWebSocket, 3000);
      };
      
      socket.onerror = (error) => {
        console.error('Erro no WebSocket:', error);
        socket.close();
      };
      
      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as WebSocketMessage;
          console.log('Mensagem recebida:', message);
          setLastMessage(message);
          
          // Processar mensagem conforme o tipo
          if (message.type) {
            invalidateQueryData(message.type, message.data);
          }
        } catch (error) {
          console.error('Erro ao processar mensagem WebSocket:', error);
        }
      };
    };
    
    // Conectar ao WebSocket
    connectWebSocket();
    
    // Cleanup na desmontagem
    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [invalidateQueryData]);
  
  // Função para enviar mensagens através do WebSocket
  const sendMessage = useCallback((message: WebSocketMessage) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(message));
      return true;
    }
    console.warn('WebSocket não está conectado, não foi possível enviar mensagem');
    return false;
  }, []);

  return { isConnected, lastMessage, sendMessage };
}