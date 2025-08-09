import { useState, useRef, useEffect, useCallback } from "react";
import { Vehicle } from "@shared/schema";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Check, ChevronDown, Search, Plus, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
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
  total: number;
  hasMore: boolean;
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
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [allVehicles, setAllVehicles] = useState<Vehicle[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const debounceTimeout = useRef<NodeJS.Timeout>();

  // Query para buscar veículos com paginação
  const { data: vehicleData, isLoading, error } = useQuery<VehicleSearchResponse>({
    queryKey: ['/api/vehicles/search', searchTerm, currentPage, vehicleType],
    queryFn: async () => {
      const params = new URLSearchParams({
        search: searchTerm,
        page: currentPage.toString(),
        limit: PAGE_SIZE.toString(),
        ...(vehicleType && { type: vehicleType })
      });
      
      console.log(`[PAGINATED VEHICLE] Buscando veículos - tipo: ${vehicleType}, busca: "${searchTerm}", página: ${currentPage}`);
      console.log(`[PAGINATED VEHICLE] URL completa: /api/vehicles/search?${params.toString()}`);
      
      const res = await fetch(`/api/vehicles/search?${params}`, {
        credentials: "include"
      });
      
      if (!res.ok) {
        console.error(`[PAGINATED VEHICLE] Erro na requisição: ${res.status} ${res.statusText}`);
        throw new Error("Erro ao buscar veículos");
      }
      
      const data = await res.json();
      console.log(`[PAGINATED VEHICLE] Recebidos ${data.vehicles?.length || 0} veículos`);
      
      return data;
    },
    enabled: isOpen || hasSearched,
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
    if (vehicleData) {
      if (currentPage === 1) {
        setAllVehicles(vehicleData.vehicles);
      } else {
        setAllVehicles(prev => [...prev, ...vehicleData.vehicles]);
      }
    }
  }, [vehicleData, currentPage]);

  // Sincronizar input com valor selecionado
  useEffect(() => {
    if (selectedVehicle) {
      setInputValue(selectedVehicle.plate);
    } else if (value) {
      const vehicle = allVehicles.find(v => v.id === value);
      if (vehicle) {
        setInputValue(vehicle.plate);
      }
    } else {
      setInputValue("");
    }
  }, [value, selectedVehicle, allVehicles]);

  // Debounced search
  const debouncedSearch = useCallback((term: string) => {
    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
    }
    
    debounceTimeout.current = setTimeout(() => {
      setSearchTerm(term);
      setCurrentPage(1);
      setAllVehicles([]);
      setHasSearched(true);
    }, 300);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value.toUpperCase();
    setInputValue(newValue);
    setIsOpen(true);
    setHighlightedIndex(-1);
    
    debouncedSearch(newValue);

    // Se permitir entrada manual e não há veículo correspondente
    if (allowManualEntry && newValue.length >= 3) {
      const exactMatch = allVehicles.find(v => v.plate === newValue);
      if (!exactMatch) {
        onSelect(undefined, newValue);
      }
    }
  };

  const handleVehicleSelect = (vehicle: Vehicle) => {
    setInputValue(vehicle.plate);
    setIsOpen(false);
    setHighlightedIndex(-1);
    onSelect(vehicle.id);
  };

  const handleLoadMore = () => {
    if (vehicleData?.hasMore && !isLoading) {
      setCurrentPage(prev => prev + 1);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "Enter") {
        setIsOpen(true);
        if (!hasSearched) {
          debouncedSearch("");
        }
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

  const handleBlur = () => {
    setTimeout(() => {
      setIsOpen(false);
      setHighlightedIndex(-1);
    }, 200);
  };

  const handleFocus = () => {
    if (!hasSearched) {
      debouncedSearch("");
    }
    setIsOpen(true);
  };

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
          onFocus={handleFocus}
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
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-hidden">
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
                onClick={() => debouncedSearch(searchTerm)}
                className="mt-2"
              >
                Tentar novamente
              </Button>
            </div>
          ) : allVehicles.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Nenhuma placa encontrada</p>
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
            <ul ref={listRef} className="overflow-y-auto max-h-52">
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
              
              {vehicleData?.hasMore && (
                <li className="p-2 border-t">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleLoadMore}
                    disabled={isLoading}
                    className="w-full"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Carregando...
                      </>
                    ) : (
                      <>
                        Carregar mais ({vehicleData.total - allVehicles.length} restantes)
                      </>
                    )}
                  </Button>
                </li>
              )}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}