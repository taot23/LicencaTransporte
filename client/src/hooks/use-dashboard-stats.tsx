import { useQuery } from "@tanstack/react-query";
import { useWebSocketContext } from "./use-websocket-context";
import { useEffect } from "react";
import { queryClient } from "@/lib/queryClient";

export type DashboardStats = {
  issuedLicenses: number;
  pendingLicenses: number;
  registeredVehicles: number;
  activeVehicles: number;
  expiringLicenses: number;
  recentLicenses: Array<{
    id: number;
    requestNumber: string;
    type: string;
    mainVehiclePlate: string;
    states: string[];
    status: string;
    createdAt: string;
  }>;
};

export function useDashboardStats() {
  const { lastMessage } = useWebSocketContext();
  
  const query = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard/stats", {
        credentials: "include"
      });
      if (!res.ok) {
        throw new Error("Erro ao buscar estatísticas do dashboard");
      }
      return res.json();
    },
    staleTime: 30000, // Cache por 30 segundos
    refetchInterval: 60000, // Refetch a cada 60 segundos
  });

  // Atualizar dashboard em tempo real quando houver mudanças via WebSocket
  useEffect(() => {
    if (lastMessage?.data) {
      try {
        const message = JSON.parse(lastMessage.data);
        
        // Invalidar cache do dashboard quando houver mudanças relevantes
        if (message.type === 'STATUS_UPDATE' || 
            message.type === 'LICENSE_UPDATE' ||
            message.type === 'VEHICLE_CREATED' ||
            message.type === 'VEHICLE_UPDATED') {
          
          console.log('📊 Atualizando dashboard em tempo real:', message.type);
          
          // Invalidar múltiplas queries relacionadas ao dashboard
          queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
          queryClient.invalidateQueries({ queryKey: ["/api/dashboard/vehicle-stats"] });
          queryClient.invalidateQueries({ queryKey: ["/api/dashboard/state-stats"] });
          queryClient.invalidateQueries({ queryKey: ["/api/licenses/issued"] });
          queryClient.invalidateQueries({ queryKey: ["/api/admin/dashboard/stats"] });
        }
      } catch (error) {
        // Ignorar mensagens que não são JSON válido
      }
    }
  }, [lastMessage]);

  return query;
}
