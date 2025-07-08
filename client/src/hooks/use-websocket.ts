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
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  // Função para invalidar o cache e forçar o recarregamento de dados
  const invalidateQueryData = useCallback((type: string, data: any) => {
    console.log(`🔄 Processando atualização WebSocket: ${type}`, data);
    
    switch (type) {
      case 'STATUS_UPDATE':
      case 'LICENSE_UPDATE':
        // Invalidar todas as queries relacionadas a licenças usando prefix matching
        console.log('🔄 Invalidando queries de licenças via WebSocket');
        queryClient.invalidateQueries({ 
          predicate: (query) => {
            const key = query.queryKey[0];
            const shouldInvalidate = typeof key === 'string' && (
              key.startsWith('/api/licenses') ||
              key.startsWith('/api/admin/licenses')
            );
            if (shouldInvalidate) {
              console.log('🔄 Invalidando query:', query.queryKey);
            }
            return shouldInvalidate;
          }
        });
        
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

  // Limpeza otimizada de cache para melhor performance
  useEffect(() => {
    const cacheCleanupInterval = setInterval(() => {
      console.log('🧹 Limpeza automática de cache executada');
      
      // Limpar apenas queries muito antigas (mais de 15 minutos) para manter performance
      queryClient.getQueryCache().getAll().forEach(query => {
        const dataUpdatedAt = query.state.dataUpdatedAt;
        const fifteenMinutesAgo = Date.now() - 15 * 60 * 1000;
        
        if (dataUpdatedAt && dataUpdatedAt < fifteenMinutesAgo) {
          queryClient.removeQueries({ queryKey: query.queryKey });
        }
      });
    }, 15 * 60 * 1000); // A cada 15 minutos para reduzir overhead

    return () => clearInterval(cacheCleanupInterval);
  }, []);

  // Inicializar a conexão WebSocket
  useEffect(() => {
    // Função para conectar ao WebSocket
    const connectWebSocket = () => {
      // Para HTTPS com subdomínio, usar WSS através do mesmo host
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      
      console.log(`Conectando ao WebSocket em ${wsUrl}`);
      
      const socket = new WebSocket(wsUrl);
      socketRef.current = socket;
      
      socket.onopen = () => {
        console.log('WebSocket conectado');
        setIsConnected(true);
        reconnectAttempts.current = 0;
        
        // Não invalidar automaticamente no reconect para melhor performance
      };
      
      socket.onclose = () => {
        console.log('WebSocket desconectado');
        setIsConnected(false);
        
        // Tentar reconectar com backoff exponencial
        if (reconnectAttempts.current < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
          console.log(`Tentativa de reconexão ${reconnectAttempts.current + 1}/${maxReconnectAttempts} em ${delay}ms`);
          reconnectAttempts.current++;
          setTimeout(connectWebSocket, delay);
        } else {
          console.error('Máximo de tentativas de reconexão excedido');
        }
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