import React, { useState, useMemo } from 'react';
import { Vehicle } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown, Search, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
// Implementação simples de debounce sem lodash-es
const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

interface FastVehicleSelectorProps {
  title: string;
  description?: string;
  value: number | null;
  vehicleOptions: Vehicle[];
  isLoading: boolean;
  onChange: (value: number | null) => void;
  onAdd?: () => void;
  placeholder?: string;
  emptyMessage?: string;
  vehicleType?: string;
  colorTheme?: 'blue' | 'green' | 'purple' | 'amber' | 'red';
}

export function FastVehicleSelector({
  title,
  description,
  value,
  vehicleOptions,
  isLoading,
  onChange,
  onAdd,
  placeholder = "Selecione um veículo",
  emptyMessage = "Nenhum veículo encontrado",
  vehicleType,
  colorTheme = 'blue'
}: FastVehicleSelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  
  // Filtrar e limitar veículos para performance
  const filteredVehicles = useMemo(() => {
    if (!vehicleOptions) return [];
    
    let filtered = vehicleOptions;
    
    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(vehicle => 
        vehicle.plate?.toLowerCase().includes(searchLower) ||
        vehicle.brand?.toLowerCase().includes(searchLower) ||
        vehicle.model?.toLowerCase().includes(searchLower)
      );
    }
    
    // Limitar a 50 resultados para performance
    return filtered.slice(0, 50);
  }, [vehicleOptions, search]);

  const selectedVehicle = useMemo(() => 
    vehicleOptions?.find(v => v.id === value),
    [vehicleOptions, value]
  );

  const debouncedSearch = debounce((value: string) => {
    setSearch(value);
  }, 300);

  const getThemeClasses = () => {
    const themes = {
      blue: 'bg-blue-50 border-blue-200 hover:bg-blue-100',
      green: 'bg-green-50 border-green-200 hover:bg-green-100',
      purple: 'bg-purple-50 border-purple-200 hover:bg-purple-100',
      amber: 'bg-amber-50 border-amber-200 hover:bg-amber-100',
      red: 'bg-red-50 border-red-200 hover:bg-red-100'
    };
    return themes[colorTheme];
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-900">{title}</label>
        {onAdd && (
          <Button 
            type="button" 
            variant="outline" 
            size="sm" 
            onClick={onAdd}
            className="h-6 px-2"
          >
            <Plus className="h-3 w-3 mr-1" />
            Novo
          </Button>
        )}
      </div>
      
      {description && (
        <p className="text-xs text-gray-600">{description}</p>
      )}
      
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              "w-full justify-between h-10 font-normal",
              getThemeClasses()
            )}
            disabled={isLoading}
          >
            {selectedVehicle ? (
              <span className="flex items-center gap-2">
                <span className="font-mono text-sm">{selectedVehicle.plate}</span>
                <span className="text-xs text-gray-600">
                  {selectedVehicle.brand} {selectedVehicle.model}
                </span>
              </span>
            ) : (
              <span className="text-gray-500">{placeholder}</span>
            )}
            {isLoading ? (
              <div className="animate-spin h-4 w-4 border-2 border-gray-300 border-t-gray-600 rounded-full" />
            ) : (
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            )}
          </Button>
        </PopoverTrigger>
        
        <PopoverContent className="w-[400px] p-0" align="start">
          <Command shouldFilter={false}>
            <div className="flex items-center border-b px-3">
              <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
              <CommandInput
                placeholder="Buscar por placa, marca ou modelo..."
                onValueChange={debouncedSearch}
                className="flex h-9 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
            
            <CommandList className="max-h-[300px] overflow-y-auto">
              {isLoading ? (
                <div className="py-6 text-center text-sm text-gray-500">
                  Carregando veículos...
                </div>
              ) : filteredVehicles.length === 0 ? (
                <CommandEmpty className="py-6 text-center text-sm">
                  {emptyMessage}
                </CommandEmpty>
              ) : (
                <CommandGroup>
                  {value && (
                    <CommandItem
                      onSelect={() => {
                        onChange(null);
                        setOpen(false);
                      }}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <X className="mr-2 h-4 w-4" />
                      Limpar seleção
                    </CommandItem>
                  )}
                  
                  {filteredVehicles.map((vehicle) => (
                    <CommandItem
                      key={vehicle.id}
                      value={`${vehicle.plate}-${vehicle.brand}-${vehicle.model}`}
                      onSelect={() => {
                        onChange(vehicle.id);
                        setOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          value === vehicle.id ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className="font-mono text-xs">
                            {vehicle.plate}
                          </Badge>
                          <span className="text-sm">
                            {vehicle.brand} {vehicle.model}
                          </span>
                        </div>
                        {vehicle.year && (
                          <span className="text-xs text-gray-500">
                            {vehicle.year}
                          </span>
                        )}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      
      {selectedVehicle && (
        <div className="flex items-center gap-2 text-xs text-gray-600">
          <Badge variant="secondary" className="font-mono">
            {selectedVehicle.plate}
          </Badge>
          <span>{selectedVehicle.brand} {selectedVehicle.model}</span>
          {selectedVehicle.year && <span>({selectedVehicle.year})</span>}
        </div>
      )}
    </div>
  );
}