import { useQuery } from "@tanstack/react-query";

export type DashboardStats = {
  issuedLicenses: number;
  pendingLicenses: number;
  registeredVehicles: number;
  activeVehicles: number;
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
  return useQuery<DashboardStats>({
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
    staleTime: 1000 * 60 * 5, // 5 minutos
    refetchOnMount: true
  });
}
