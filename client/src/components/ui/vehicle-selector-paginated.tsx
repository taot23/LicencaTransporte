import { useState, useEffect, useCallback, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, ChevronDown, ChevronLeft, ChevronRight, Truck, Plus, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";

interface Vehicle {
  id: number;
  plate: string;
  type: string;
  brand: string;
  model: string;
  year: number;
  status: string;
  ownershipType: string;
  ownerName: string;
  userEmail: string;
  userName: string;
  transporterName: string;
  displayText: string;
}

interface VehicleSelectorPaginatedProps {
  vehicleType: string; // 'tractor_unit', 'semi_trailer', 'trailer', 'dolly'
  value?: number;
  onSelect: (vehicleId: number | undefined, plate?: string) => void;
  placeholder?: string;
  disabled?: boolean;
  allowManualEntry?: boolean;
  className?: string;
  label?: string;
  onCreateNew?: () => void;
}

const vehicleTypeLabels: Record<string, string> = {
  'tractor_unit': 'Unidade Tratora',
  'semi_trailer': 'Semirreboque',
  'trailer': 'Reboque',
  'dolly': 'Dolly',
  'flatbed': 'Prancha'
};

export function VehicleSelectorPaginated({
  vehicleType,
  value,
  onSelect,
  placeholder = "Digite a placa para buscar...",
  disabled = false,
  allowManualEntry = false,
  className,
  label,
  onCreateNew,
}: VehicleSelectorPaginatedProps) {
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isOpen, setIsOpen] = useState(false);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounce para otimização
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setCurrentPage(1); // Reset página ao mudar busca
    }, 300);

    return () => clearTimeout(timer);
  }, [search]);

  // Query otimizada para busca de veículos por tipo
  const { data, isLoading, error } = useQuery({
    queryKey: ['vehicles-paginated', vehicleType, debouncedSearch, currentPage],
    queryFn: async () => {
      const params = new URLSearchParams({
        search: debouncedSearch || '',
        page: currentPage.toString(),
        limit: '10',
        vehicleType: vehicleType,
        ownedOnly: 'false'
      });

      const response = await fetch(`/api/plates/search?${params}`);
      if (!response.ok) {
        throw new Error(`Erro na busca de veículos: ${response.status}`);
      }
      const result = await response.json();
      console.log(`[DEBUG] Busca veículos tipo ${vehicleType}: ${result.plates?.length || 0} de ${result.pagination?.total || 0} encontrados`);
      return result;
    },
    enabled: isOpen, // Carrega quando o dropdown está aberto
    staleTime: 2 * 60 * 1000, // Cache por 2 minutos
    retry: 2,
  });

  // Carregar veículo selecionado se value mudou
  useEffect(() => {
    if (value && (!selectedVehicle || selectedVehicle.id !== value)) {
      // Buscar dados do veículo selecionado
      fetch(`/api/vehicles/${value}`)
        .then(res => res.json())
        .then(vehicle => {
          setSelectedVehicle(vehicle);
          setSearch(vehicle.plate);
        })
        .catch(() => {
          setSelectedVehicle(null);
          setSearch('');
        });
    } else if (!value) {
      setSelectedVehicle(null);
      setSearch('');
    }
  }, [value]);

  const handleVehicleSelect = useCallback((vehicle: Vehicle) => {
    setSelectedVehicle(vehicle);
    setSearch(vehicle.plate);
    setIsOpen(false);
    onSelect(vehicle.id);
  }, [onSelect]);

  const handleManualPlate = useCallback((plateText: string) => {
    if (allowManualEntry && plateText.length >= 3) {
      setSelectedVehicle(null);
      onSelect(undefined, plateText);
    }
  }, [allowManualEntry, onSelect]);

  const handlePageChange = useCallback((newPage: number) => {
    setCurrentPage(newPage);
  }, []);

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      'tractor_unit': 'bg-blue-100 text-blue-800',
      'semi_trailer': 'bg-green-100 text-green-800',
      'trailer': 'bg-purple-100 text-purple-800',
      'dolly': 'bg-yellow-100 text-yellow-800',
      'flatbed': 'bg-orange-100 text-orange-800'
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className={cn("relative w-full", className)}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {label}
        </label>
      )}

      {/* Campo de busca principal */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
        <Input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          value={search}
          onChange={(e) => {
            const newValue = e.target.value.toUpperCase();
            setSearch(newValue);
            setIsOpen(true);
            
            // Se entrada manual estiver habilitada
            if (allowManualEntry && newValue.length >= 3) {
              handleManualPlate(newValue);
            }
          }}
          onFocus={() => setIsOpen(true)}
          disabled={disabled}
          className="pl-10 pr-12"
        />
        
        {/* Indicadores no campo */}
        <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center gap-1">
          {selectedVehicle && (
            <Check className="text-green-500 h-4 w-4" />
          )}
          <ChevronDown className={cn(
            "text-gray-400 h-4 w-4 transition-transform",
            isOpen && "rotate-180"
          )} />
        </div>
      </div>

      {/* Informação do veículo selecionado */}
      {selectedVehicle && (
        <div className="mt-2 p-2 bg-gray-50 rounded-md text-sm">
          <div className="flex items-center justify-between">
            <div>
              <span className="font-medium">{selectedVehicle.plate}</span>
              <span className="text-gray-600 ml-2">
                {selectedVehicle.brand} {selectedVehicle.model} ({selectedVehicle.year})
              </span>
            </div>
            <Badge className={getTypeColor(selectedVehicle.type)}>
              {vehicleTypeLabels[selectedVehicle.type]}
            </Badge>
          </div>
          {selectedVehicle.transporterName && (
            <div className="text-gray-500 text-xs mt-1">
              {selectedVehicle.transporterName}
            </div>
          )}
        </div>
      )}

      {/* Dropdown de resultados com paginação */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-96 overflow-hidden">
          {isLoading && (
            <div className="p-4 text-center text-gray-500">
              <div className="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-2"></div>
              Buscando {vehicleTypeLabels[vehicleType].toLowerCase()}...
            </div>
          )}

          {error && (
            <div className="p-4 text-center text-red-500">
              Erro na busca. Tente novamente.
            </div>
          )}

          {data && data.plates && (
            <>
              {/* Lista de veículos */}
              <div className="max-h-64 overflow-y-auto">
                {data.plates.length === 0 ? (
                  <div className="p-4 text-center">
                    <div className="text-gray-500 mb-2">
                      {debouncedSearch ? 
                        `Nenhum ${vehicleTypeLabels[vehicleType].toLowerCase()} encontrado para "${debouncedSearch}"` :
                        `Nenhum ${vehicleTypeLabels[vehicleType].toLowerCase()} disponível`
                      }
                    </div>
                    {allowManualEntry && debouncedSearch && (
                      <div className="text-sm text-blue-600">
                        Pressione Enter para usar placa manual
                      </div>
                    )}
                  </div>
                ) : (
                  data.plates.map((vehicle: Vehicle) => (
                    <div
                      key={vehicle.id}
                      onClick={() => handleVehicleSelect(vehicle)}
                      className="p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Truck className="h-4 w-4 text-gray-400" />
                          <div>
                            <div className="font-mono font-medium text-gray-900">
                              {vehicle.plate}
                            </div>
                            <div className="text-sm text-gray-500">
                              {vehicle.brand} {vehicle.model} ({vehicle.year})
                            </div>
                            {vehicle.transporterName && (
                              <div className="text-xs text-gray-400">
                                {vehicle.transporterName}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <Badge className={getTypeColor(vehicle.type)}>
                            {vehicleTypeLabels[vehicle.type]}
                          </Badge>
                          {vehicle.ownershipType === 'terceiro' && (
                            <Badge variant="outline" className="text-xs">
                              Terceiro
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Paginação */}
              {data.pagination && data.pagination.totalPages > 1 && (
                <div className="p-3 border-t border-gray-200 bg-gray-50">
                  <div className="flex items-center justify-between text-sm">
                    <div className="text-gray-600">
                      Página {data.pagination.page} de {data.pagination.totalPages}
                      <span className="ml-2 text-xs">
                        ({data.pagination.total} {vehicleTypeLabels[vehicleType].toLowerCase()})
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={!data.pagination.hasPrev}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="text-xs px-2 py-1 bg-white rounded border">
                        {currentPage}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={!data.pagination.hasNext}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Performance info */}
              {data.performance && (
                <div className="p-2 bg-blue-50 text-xs text-blue-600 border-t border-blue-100">
                  ⚡ {data.performance.resultCount} resultados
                  {data.performance.cached && " (cache)"}
                  - Otimizado para {vehicleTypeLabels[vehicleType]}
                </div>
              )}
            </>
          )}

          {/* Ação de criar novo */}
          {onCreateNew && (
            <div className="p-2 border-t border-gray-200">
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => {
                  setIsOpen(false);
                  onCreateNew();
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Cadastrar Novo {vehicleTypeLabels[vehicleType]}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Overlay para fechar */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}