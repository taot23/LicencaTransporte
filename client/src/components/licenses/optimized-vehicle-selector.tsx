import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Vehicle } from "@shared/schema";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, Check, Plus, Truck, X } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { debounce } from 'lodash-es';

interface OptimizedVehicleSelectorProps {
  title: string;
  description?: string;
  placeholder: string;
  value?: number | null;
  vehicleType: string;
  onChange: (vehicleId: number | null) => void;
  onCreateNew?: () => void;
  disabled?: boolean;
  required?: boolean;
  vehicles: Vehicle[];
  isLoading?: boolean;
}

export function OptimizedVehicleSelector({
  title,
  description,
  placeholder,
  value,
  vehicleType,
  onChange,
  onCreateNew,
  disabled = false,
  required = false,
  vehicles,
  isLoading = false
}: OptimizedVehicleSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [localSearch, setLocalSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounce search para evitar muitas re-renderizações
  const debouncedSearch = useCallback(
    debounce((term: string) => {
      setSearchTerm(term);
    }, 300),
    []
  );

  useEffect(() => {
    debouncedSearch(localSearch);
    return () => {
      debouncedSearch.cancel();
    };
  }, [localSearch, debouncedSearch]);

  // Filtrar veículos do tipo correto e por busca
  const filteredVehicles = useMemo(() => {
    if (!vehicles) return [];
    
    let filtered;
    
    // Tipo especial "mixed_trailer" aceita tanto semi_trailer quanto trailer
    if (vehicleType === 'mixed_trailer') {
      filtered = vehicles.filter(v => v.type === 'semi_trailer' || v.type === 'trailer');
    } else {
      filtered = vehicles.filter(v => v.type === vehicleType);
    }
    
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(v => 
        v.plate?.toLowerCase().includes(term) ||
        v.brand?.toLowerCase().includes(term) ||
        v.model?.toLowerCase().includes(term)
      );
    }
    
    // Limitar a 50 resultados para performance
    return filtered.slice(0, 50);
  }, [vehicles, vehicleType, searchTerm]);

  // Veículo selecionado
  const selectedVehicle = useMemo(() => 
    vehicles?.find(v => v.id === value), [vehicles, value]
  );

  const handleSelect = useCallback((vehicle: Vehicle) => {
    onChange(vehicle.id);
    setIsOpen(false);
    setLocalSearch("");
    setSearchTerm("");
  }, [onChange]);

  const handleClear = useCallback(() => {
    onChange(null);
    setLocalSearch("");
    setSearchTerm("");
  }, [onChange]);

  const handleOpenChange = useCallback((open: boolean) => {
    setIsOpen(open);
    if (!open) {
      setLocalSearch("");
      setSearchTerm("");
    } else if (inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, []);

  // Ícone do tipo de veículo
  const getVehicleIcon = (type: string) => {
    switch (type) {
      case 'tractor_unit':
        return <Truck className="h-4 w-4 text-blue-600" />;
      case 'semi_trailer':
        return <div className="w-4 h-4 bg-green-600 rounded-sm flex items-center justify-center text-white text-xs font-bold">S</div>;
      case 'trailer':
        return <div className="w-4 h-4 bg-purple-600 rounded-sm flex items-center justify-center text-white text-xs font-bold">T</div>;
      case 'mixed_trailer':
        return <div className="w-4 h-4 bg-cyan-600 rounded-sm flex items-center justify-center text-white text-xs font-bold">C</div>;
      case 'dolly':
        return <div className="w-4 h-4 bg-orange-600 rounded-full flex items-center justify-center text-white text-xs font-bold">D</div>;
      default:
        return <Truck className="h-4 w-4 text-gray-400" />;
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium flex items-center gap-2">
          {getVehicleIcon(vehicleType)}
          {title}
          {required && <span className="text-red-500">*</span>}
        </label>
        {description && (
          <span className="text-xs text-muted-foreground">
            {description}
          </span>
        )}
      </div>

      <div className="relative">
        <Popover open={isOpen} onOpenChange={handleOpenChange}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={isOpen}
              className="w-full justify-between h-10"
              disabled={disabled || isLoading}
            >
              <div className="flex items-center gap-2 flex-1 text-left">
                {selectedVehicle ? (
                  <>
                    {getVehicleIcon(vehicleType)}
                    <span className="font-medium">{selectedVehicle.plate}</span>
                    <span className="text-muted-foreground">
                      {selectedVehicle.brand} {selectedVehicle.model}
                    </span>
                  </>
                ) : (
                  <>
                    {getVehicleIcon(vehicleType)}
                    <span className="text-muted-foreground">{placeholder}</span>
                  </>
                )}
              </div>
              
              <div className="flex items-center gap-1">
                {selectedVehicle && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 hover:bg-red-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleClear();
                    }}
                  >
                    <X className="h-3 w-3 text-red-500" />
                  </Button>
                )}
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
              </div>
            </Button>
          </PopoverTrigger>

          <PopoverContent className="w-80 p-0" align="start">
            <div className="border-b p-3">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  ref={inputRef}
                  placeholder={`Buscar ${title.toLowerCase()}...`}
                  value={localSearch}
                  onChange={(e) => setLocalSearch(e.target.value)}
                  className="pl-8"
                  autoFocus
                />
              </div>
            </div>

            <div className="max-h-60 overflow-auto">
              {isLoading ? (
                <div className="flex items-center justify-center p-4">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Carregando...
                </div>
              ) : filteredVehicles.length === 0 ? (
                <div className="p-4 space-y-2">
                  <p className="text-sm text-muted-foreground text-center">
                    {searchTerm ? 'Nenhum veículo encontrado' : `Nenhum ${title.toLowerCase()} disponível`}
                  </p>
                  {onCreateNew && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={onCreateNew}
                      className="w-full"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Cadastrar novo
                    </Button>
                  )}
                </div>
              ) : (
                <div className="p-1">
                  {filteredVehicles.map((vehicle) => (
                    <button
                      key={vehicle.id}
                      type="button"
                      onClick={() => handleSelect(vehicle)}
                      className="w-full flex items-center gap-2 p-2 text-sm hover:bg-accent rounded-sm"
                    >
                      {getVehicleIcon(vehicle.type)}
                      <div className="flex-1 text-left">
                        <div className="font-medium">{vehicle.plate}</div>
                        <div className="text-muted-foreground text-xs">
                          {vehicle.brand} {vehicle.model} ({vehicle.year})
                        </div>
                      </div>
                      {vehicle.id === value && (
                        <Check className="h-4 w-4 text-green-600" />
                      )}
                    </button>
                  ))}
                  
                  {filteredVehicles.length >= 50 && (
                    <div className="p-2 text-xs text-muted-foreground text-center border-t">
                      Mostrando primeiros 50 resultados. Refine sua busca para ver mais.
                    </div>
                  )}
                </div>
              )}
            </div>

            {onCreateNew && (
              <div className="border-t p-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={onCreateNew}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Cadastrar novo {title.toLowerCase()}
                </Button>
              </div>
            )}
          </PopoverContent>
        </Popover>
      </div>

      {selectedVehicle && (
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="bg-green-100 text-green-800">
            <Check className="h-3 w-3 mr-1" />
            Selecionado
          </Badge>
          <span className="text-xs text-muted-foreground">
            {selectedVehicle.brand} {selectedVehicle.model} - {selectedVehicle.year}
          </span>
        </div>
      )}
    </div>
  );
}