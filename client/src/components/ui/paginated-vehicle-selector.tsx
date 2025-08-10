import { useState, useRef, useEffect } from "react";
import { Vehicle } from "@shared/schema";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Check, ChevronDown, Search, Plus, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDebounce } from "@/hooks/use-debounce";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";

interface PaginatedVehicleSelectorProps {
  value?: number;
  onSelect: (vehicleId: number | undefined, plate?: string) => void;
  placeholder?: string;
  disabled?: boolean;
  allowManualEntry?: boolean;
  className?: string;
  label?: string;
  onCreateNew?: () => void;
  vehicleType?: 'tractor_unit' | 'trailer' | 'semi_trailer' | 'dolly' | 'truck' | 'flatbed';
}

interface VehicleSearchResponse {
  vehicles: Vehicle[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

const PAGE_SIZE = 10;

export function PaginatedVehicleSelector({
  value,
  onSelect,
  placeholder = "Digite a placa ou selecione...",
  disabled = false,
  allowManualEntry = false,
  className,
  label,
  onCreateNew,
  vehicleType,
}: PaginatedVehicleSelectorProps) {
  const [inputValue, setInputValue] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [currentPage, setCurrentPage] = useState(1);
  const [allVehicles, setAllVehicles] = useState<Vehicle[]>([]);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  // Usar debounce hook como o transportador
  const debouncedSearchTerm = useDebounce(inputValue, 300);

  // Query para buscar veículos com paginação
  const { data: vehicleData, isLoading, error } = useQuery<VehicleSearchResponse>({
    queryKey: ['/api/vehicles/search', debouncedSearchTerm, currentPage, vehicleType],
    queryFn: async () => {
      const params = new URLSearchParams({
        search: debouncedSearchTerm,
        page: currentPage.toString(),
        limit: PAGE_SIZE.toString(),
        ...(vehicleType && { type: vehicleType })
      });
      
      console.log(`[PAGINATED VEHICLE] Buscando veículos - tipo: ${vehicleType}, busca: "${debouncedSearchTerm}", página: ${currentPage}`);
      console.log(`[PAGINATED VEHICLE] URL completa: /api/vehicles/search?${params.toString()}`);
      
      const res = await fetch(`/api/vehicles/search?${params}`, {
        credentials: "include"
      });
      
      if (!res.ok) {
        console.error(`[PAGINATED VEHICLE] Erro na requisição: ${res.status} ${res.statusText}`);
        throw new Error("Erro ao buscar veículos");
      }
      
      const data = await res.json();
      console.log(`[PAGINATED VEHICLE] Recebidos ${data.vehicles?.length || 0} veículos, hasNext: ${data.pagination?.hasNext}`);
      console.log(`[PAGINATED VEHICLE] Total no servidor: ${data.pagination?.total}, página atual: ${data.pagination?.page}`);
      
      return data;
    },
    enabled: isOpen,
    staleTime: 2 * 60 * 1000, // 2 minutos
    cacheTime: 5 * 60 * 1000, // 5 minutos
  });

  // Buscar veículo selecionado por ID
  const { data: selectedVehicle } = useQuery<Vehicle>({
    queryKey: ['/api/vehicles', value],
    queryFn: async () => {
      const res = await fetch(`/api/vehicles/${value}`, {
        credentials: "include"
      });
      
      if (!res.ok) {
        throw new Error("Erro ao buscar veículo");
      }
      
      return res.json();
    },
    enabled: !!value && !allVehicles.find(v => v.id === value),
    staleTime: 5 * 60 * 1000,
  });

  // Atualizar lista de veículos quando nova página carrega
  useEffect(() => {
    if (!vehicleData?.vehicles) return;
    
    console.log(`[PAGINATED VEHICLE] Página ${currentPage} recebeu ${vehicleData.vehicles.length} veículos`);
    
    if (currentPage === 1) {
      setAllVehicles(vehicleData.vehicles);
    } else {
      setAllVehicles(prev => [...prev, ...vehicleData.vehicles]);
    }
  }, [vehicleData?.vehicles, currentPage]);

  // Sincronizar input apenas quando veículo é selecionado (não durante digitação)
  useEffect(() => {
    if (selectedVehicle && !isOpen) {
      setInputValue(selectedVehicle.plate);
    }
  }, [selectedVehicle, isOpen]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value.toUpperCase();
    setInputValue(newValue);
    if (!isOpen) {
      setIsOpen(true);
    }
    setHighlightedIndex(-1);
    
    // Limpar seleção se o input foi limpo
    if (!newValue && value) {
      onSelect(null);
    }

    // Se permitir entrada manual e não há veículo correspondente
    if (allowManualEntry && newValue.length >= 3) {
      const exactMatch = allVehicles.find(v => v.plate === newValue);
      if (!exactMatch) {
        onSelect(undefined, newValue);
      }
    }
  };

  const handleVehicleSelect = (vehicle: Vehicle) => {
    onSelect(vehicle.id);
    setInputValue(vehicle.plate);
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  const handleLoadMore = () => {
    if (vehicleData?.pagination?.hasNext && !isLoading) {
      setCurrentPage(prev => prev + 1);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "Enter") {
        setIsOpen(true);
        // Abrir dropdown automaticamente
        return;
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev < allVehicles.length - 1 ? prev + 1 : prev
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case "Enter":
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < allVehicles.length) {
          handleVehicleSelect(allVehicles[highlightedIndex]);
        } else if (allVehicles.length === 1) {
          handleVehicleSelect(allVehicles[0]);
        }
        break;
      case "Escape":
        setIsOpen(false);
        setHighlightedIndex(-1);
        break;
    }
  };

  const handleBlur = (e: React.FocusEvent) => {
    // Se o foco está indo para um elemento dentro do dropdown, não fechar
    const relatedTarget = e.relatedTarget as HTMLElement;
    if (relatedTarget && relatedTarget.closest('.paginated-dropdown-content')) {
      return;
    }
    
    setTimeout(() => {
      setIsOpen(false);
      setHighlightedIndex(-1);
    }, 300);
  };

  // Função handleFocus não é mais necessária

  // Scroll para item destacado
  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const highlightedElement = listRef.current.children[highlightedIndex] as HTMLElement;
      if (highlightedElement) {
        highlightedElement.scrollIntoView({
          block: 'nearest',
        });
      }
    }
  }, [highlightedIndex]);

  return (
    <div className={cn("relative", className)}>
      {label && (
        <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 mb-2 block">
          {label}
        </label>
      )}
      
      <div className="relative">
        <Input
          ref={inputRef}
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(
            "pr-10",
            error && "border-red-500"
          )}
        />
        
        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-gray-400" />
          )}
        </div>
      </div>

      {isOpen && (
        <div 
          className="absolute z-[9999] w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-hidden"
          onMouseDown={(e) => e.preventDefault()} // Previne que o clique feche o dropdown
          style={{ zIndex: 9999 }}
        >
          {isLoading && currentPage === 1 ? (
            <div className="p-2 space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="p-4 text-center text-red-600">
              <p>Erro ao carregar veículos</p>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => window.location.reload()}
                className="mt-2"
              >
                Tentar novamente
              </Button>
            </div>
          ) : !vehicleData && allVehicles.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Nenhuma placa encontrada</p>
              <div className="text-xs mt-2 text-gray-400">
                Debug: allVehicles={allVehicles.length}, busca="{debouncedSearchTerm}"
              </div>
              {onCreateNew && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={onCreateNew}
                  className="mt-2"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Cadastrar novo veículo
                </Button>
              )}
            </div>
          ) : (
            <div className="flex flex-col max-h-60">
              <ul ref={listRef} className="overflow-y-auto flex-1">
                {allVehicles.map((vehicle, index) => (
                  <li
                    key={vehicle.id}
                    onClick={() => handleVehicleSelect(vehicle)}
                    className={cn(
                      "px-4 py-2 cursor-pointer hover:bg-gray-50 border-b border-gray-100 last:border-b-0",
                      highlightedIndex === index && "bg-blue-50",
                      value === vehicle.id && "bg-blue-100 font-medium"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">
                          {vehicle.plate}
                        </div>
                        {(vehicle.brand || vehicle.model) && (
                          <div className="text-sm text-gray-500">
                            {[vehicle.brand, vehicle.model].filter(Boolean).join(' ')}
                          </div>
                        )}
                      </div>
                      {value === vehicle.id && (
                        <Check className="h-4 w-4 text-blue-600" />
                      )}
                    </div>
                  </li>
                ))}
              </ul>
              
              {vehicleData?.pagination?.hasNext && (
                <div className="p-2 border-t bg-gray-50">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleLoadMore}
                    disabled={isLoading}
                    className="w-full text-xs"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                        Carregando...
                      </>
                    ) : (
                      <>
                        Carregar mais ({vehicleData.pagination.total - allVehicles.length} restantes)
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}