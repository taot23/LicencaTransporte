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
    staleTime: 1000, // Cache por 1 segundo (instantâneo)
    refetchInterval: 15000, // Refetch a cada 15 segundos (ultra rápido)
  });

  // TEMPO REAL INSTANTÂNEO: Dashboard atualiza cores imediatamente
  useEffect(() => {
    if (lastMessage?.type && (lastMessage.type === 'STATUS_UPDATE' || lastMessage.type === 'LICENSE_UPDATE')) {
      // Performance: Log removido
      
      // FORÇAR RESET E REFETCH IMEDIATO para cores mudarem instantaneamente
      queryClient.resetQueries({ queryKey: ["/api/dashboard/stats"] });
      queryClient.refetchQueries({ queryKey: ["/api/dashboard/stats"], type: 'active' });
    }
  }, [lastMessage]);

  return query;
}
