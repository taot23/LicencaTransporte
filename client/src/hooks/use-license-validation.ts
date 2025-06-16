import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface LicenseConflict {
  estado: string;
  licenca: {
    id: number;
    requestNumber: string;
    mainVehiclePlate: string;
    validUntil: string;
    diasRestantes: number;
    placasConflitantes: string[];
  };
}

interface CheckExistingLicensesResponse {
  conflitos: LicenseConflict[];
}

interface CheckExistingLicensesRequest {
  placas: string[];
  estados: string[];
}

export function useLicenseValidation() {
  const checkExistingLicensesMutation = useMutation({
    mutationFn: async (data: CheckExistingLicensesRequest): Promise<CheckExistingLicensesResponse> => {
      console.log("[VALIDAÇÃO CLIENT] Enviando requisição:", data);
      
      const response = await fetch("/api/licenses/check-existing", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include", // Incluir cookies de sessão
        body: JSON.stringify(data),
      });
      
      console.log("[VALIDAÇÃO CLIENT] Status da resposta:", response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("[VALIDAÇÃO CLIENT] Erro:", errorText);
        throw new Error("Erro ao verificar licenças existentes");
      }
      
      const result = await response.json();
      console.log("[VALIDAÇÃO CLIENT] Resultado:", result);
      return result;
    },
  });

  return {
    checkExistingLicenses: checkExistingLicensesMutation.mutateAsync,
    isChecking: checkExistingLicensesMutation.isPending,
    error: checkExistingLicensesMutation.error
  };
}

export type { LicenseConflict };