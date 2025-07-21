import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useDebounce } from "./use-debounce";

export interface VehicleOption {
  id: number;
  plate: string;
  brand?: string;
  model?: string;
  year?: number;
  tare: number;
  axle_count?: number;
  transporter_name?: string;
}

export interface OptimizedVehicleSelectorOptions {
  vehicleType?: 'tractor_unit' | 'semi_trailer' | '';
  searchEnabled?: boolean;
  limit?: number;
  autoFocus?: boolean;
}

export function useOptimizedVehicleSelector(options: OptimizedVehicleSelectorOptions = {}) {
  const {
    vehicleType = '',
    searchEnabled = true,
    limit = 50,
    autoFocus = false
  } = options;

  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const debouncedSearch = useDebounce(searchTerm, 500);

  // Query para busca por tipo específico
  const { data: vehiclesByType, isLoading: loadingByType, error: errorByType } = useQuery({
    queryKey: ['/api/vehicles/by-type', vehicleType, debouncedSearch, limit],
    enabled: !!vehicleType && vehicleType.length > 0,
    staleTime: 30000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const params = new URLSearchParams({
        search: debouncedSearch,
        limit: limit.toString()
      });
      
      const response = await fetch(`/api/vehicles/by-type/${vehicleType}?${params}`);
      if (!response.ok) {
        throw new Error('Falha ao carregar veículos por tipo');
      }
      const data = await response.json();
      return data.vehicles as VehicleOption[];
    },
  });

  // Query para busca rápida por placa (autocomplete)
  const { data: vehiclesByPlate, isLoading: loadingByPlate, error: errorByPlate } = useQuery({
    queryKey: ['/api/vehicles/search-plate', debouncedSearch, vehicleType],
    enabled: searchEnabled && debouncedSearch.length >= 2,
    staleTime: 30000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const params = new URLSearchParams({
        q: debouncedSearch,
        ...(vehicleType && { type: vehicleType })
      });
      
      const response = await fetch(`/api/vehicles/search-plate?${params}`);
      if (!response.ok) {
        throw new Error('Falha ao buscar por placa');
      }
      const data = await response.json();
      return data.vehicles as VehicleOption[];
    },
  });

  // Query para unidades tratoras específica
  const { data: tractorUnits, isLoading: loadingTractors, error: errorTractors } = useQuery({
    queryKey: ['/api/vehicles/tractor-units', debouncedSearch, limit],
    enabled: vehicleType === 'tractor_unit',
    staleTime: 30000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const params = new URLSearchParams({
        search: debouncedSearch,
        limit: limit.toString()
      });
      
      const response = await fetch(`/api/vehicles/tractor-units?${params}`);
      if (!response.ok) {
        throw new Error('Falha ao carregar unidades tratoras');
      }
      const data = await response.json();
      return data.vehicles as VehicleOption[];
    },
  });

  // Query para semirreboques específica
  const { data: semiTrailers, isLoading: loadingSemiTrailers, error: errorSemiTrailers } = useQuery({
    queryKey: ['/api/vehicles/semi-trailers', debouncedSearch, limit],
    enabled: vehicleType === 'semi_trailer',
    staleTime: 30000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const params = new URLSearchParams({
        search: debouncedSearch,
        limit: limit.toString()
      });
      
      const response = await fetch(`/api/vehicles/semi-trailers?${params}`);
      if (!response.ok) {
        throw new Error('Falha ao carregar semirreboques');
      }
      const data = await response.json();
      return data.vehicles as VehicleOption[];
    },
  });

  // Determinar dados a usar baseado no tipo
  const getVehicleData = (): {
    vehicles: VehicleOption[];
    isLoading: boolean;
    error: Error | null;
  } => {
    // Se temos busca por placa ativa, priorizar esse resultado
    if (searchEnabled && debouncedSearch.length >= 2) {
      return {
        vehicles: vehiclesByPlate || [],
        isLoading: loadingByPlate,
        error: errorByPlate
      };
    }

    // Caso contrário, usar busca por tipo
    switch (vehicleType) {
      case 'tractor_unit':
        return {
          vehicles: tractorUnits || [],
          isLoading: loadingTractors,
          error: errorTractors
        };
      case 'semi_trailer':
        return {
          vehicles: semiTrailers || [],
          isLoading: loadingSemiTrailers,
          error: errorSemiTrailers
        };
      default:
        if (vehicleType && vehiclesByType) {
          return {
            vehicles: vehiclesByType,
            isLoading: loadingByType,
            error: errorByType
          };
        }
        return {
          vehicles: [],
          isLoading: false,
          error: null
        };
    }
  };

  const { vehicles, isLoading, error } = getVehicleData();

  // Helper para formatar label do veículo
  const formatVehicleLabel = (vehicle: VehicleOption): string => {
    const parts = [vehicle.plate];
    if (vehicle.brand) parts.push(vehicle.brand);
    if (vehicle.model) parts.push(vehicle.model);
    if (vehicle.year) parts.push(vehicle.year.toString());
    return parts.join(' - ');
  };

  // Helper para obter veículo por ID
  const getVehicleById = (id: number): VehicleOption | undefined => {
    return vehicles.find(v => v.id === id);
  };

  // Helper para buscar veículo por placa
  const findVehicleByPlate = (plate: string): VehicleOption | undefined => {
    return vehicles.find(v => 
      v.plate.toUpperCase() === plate.toUpperCase()
    );
  };

  return {
    // Estado
    searchTerm,
    setSearchTerm,
    isOpen,
    setIsOpen,
    
    // Dados
    vehicles: vehicles || [],
    isLoading,
    error,
    hasResults: (vehicles?.length || 0) > 0,
    
    // Helpers
    formatVehicleLabel,
    getVehicleById,
    findVehicleByPlate,
    
    // Configurações
    searchEnabled,
    autoFocus,
    limit
  };
}

// Hook específico para unidades tratoras
export function useTractorUnitsSelector(search = '', limit = 50) {
  return useOptimizedVehicleSelector({
    vehicleType: 'tractor_unit',
    searchEnabled: true,
    limit,
    autoFocus: false
  });
}

// Hook específico para semirreboques  
export function useSemiTrailersSelector(search = '', limit = 50) {
  return useOptimizedVehicleSelector({
    vehicleType: 'semi_trailer',
    searchEnabled: true,
    limit,
    autoFocus: false
  });
}