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
      return await apiRequest("/api/licenses/check-existing", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
  });

  return {
    checkExistingLicenses: checkExistingLicensesMutation.mutateAsync,
    isChecking: checkExistingLicensesMutation.isPending,
    error: checkExistingLicensesMutation.error
  };
}

export type { LicenseConflict };