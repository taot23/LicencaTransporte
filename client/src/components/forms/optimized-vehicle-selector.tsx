import { useState, useRef, useEffect } from "react";
import { Check, ChevronDown, Search, Truck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from "@/components/ui/popover";
import { 
  Command, 
  CommandEmpty, 
  CommandGroup, 
  CommandItem, 
  CommandList 
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useOptimizedVehicleSelector, VehicleOption } from "@/hooks/use-optimized-vehicle-selector";

interface OptimizedVehicleSelectorProps {
  value?: number | null;
  onValueChange: (value: number | null) => void;
  placeholder?: string;
  vehicleType: 'tractor_unit' | 'semi_trailer';
  disabled?: boolean;
  error?: string;
  required?: boolean;
  label?: string;
  description?: string;
}

export function OptimizedVehicleSelector({
  value,
  onValueChange,
  placeholder = "Digite a placa ou selecione um veículo",
  vehicleType,
  disabled = false,
  error,
  required = false,
  label,
  description
}: OptimizedVehicleSelectorProps) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const {
    searchTerm,
    setSearchTerm,
    vehicles,
    isLoading,
    error: searchError,
    hasResults,
    formatVehicleLabel,
    getVehicleById
  } = useOptimizedVehicleSelector({
    vehicleType,
    searchEnabled: true,
    limit: 50,
    autoFocus: false
  });

  // Sincronizar busca com input
  useEffect(() => {
    setSearchTerm(inputValue);
  }, [inputValue, setSearchTerm]);

  // Obter veículo selecionado
  const selectedVehicle = value ? getVehicleById(value) : null;

  // Atualizar input quando veículo é selecionado
  useEffect(() => {
    if (selectedVehicle && !open) {
      setInputValue(selectedVehicle.plate);
    }
  }, [selectedVehicle, open]);

  const handleSelect = (vehicleId: number) => {
    const vehicle = getVehicleById(vehicleId);
    if (vehicle) {
      onValueChange(vehicleId);
      setInputValue(vehicle.plate);
      setOpen(false);
    }
  };

  const handleClear = () => {
    onValueChange(null);
    setInputValue('');
    setSearchTerm('');
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleInputChange = (newValue: string) => {
    setInputValue(newValue);
    if (!open) {
      setOpen(true);
    }
  };

  const getTypeLabel = (type: string): string => {
    switch (type) {
      case 'tractor_unit':
        return 'Unidade Tratora';
      case 'semi_trailer':
        return 'Semirreboque';
      default:
        return type;
    }
  };

  const showError = error || searchError?.message;

  return (
    <div className="space-y-2">
      {label && (
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">
            {label}
            {required && <span className="text-red-500 ml-1">*</span>}
          </label>
          <Badge variant="outline" className="text-xs">
            {getTypeLabel(vehicleType)}
          </Badge>
        </div>
      )}
      
      {description && (
        <p className="text-sm text-gray-500">{description}</p>
      )}

      <Popover open={open} onOpenChange={setOpen}>
        <div className="relative">
          <Input
            ref={inputRef}
            value={inputValue}
            onChange={(e) => handleInputChange(e.target.value)}
            placeholder={placeholder}
            disabled={disabled}
            className={cn(
              "pr-20",
              showError && "border-red-300 focus:border-red-300 focus:ring-red-200"
            )}
          />
          
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {selectedVehicle && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 hover:bg-gray-100"
                onClick={handleClear}
                disabled={disabled}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
            
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 hover:bg-gray-100"
                disabled={disabled}
              >
                <ChevronDown className="h-3 w-3" />
              </Button>
            </PopoverTrigger>
          </div>
        </div>

        <PopoverContent className="w-full p-0" align="start">
          <Command>
            <div className="flex items-center border-b px-3">
              <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
              <Input
                value={inputValue}
                onChange={(e) => handleInputChange(e.target.value)}
                placeholder={`Buscar ${getTypeLabel(vehicleType).toLowerCase()}...`}
                className="border-0 outline-none focus:ring-0 h-10"
              />
            </div>
            
            <CommandList>
              {isLoading && (
                <CommandEmpty>
                  <div className="flex items-center justify-center py-6">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                    <span className="ml-2">Buscando veículos...</span>
                  </div>
                </CommandEmpty>
              )}
              
              {!isLoading && !hasResults && inputValue.length >= 2 && (
                <CommandEmpty>
                  <div className="flex flex-col items-center justify-center py-6">
                    <Truck className="h-8 w-8 text-gray-400 mb-2" />
                    <p className="text-sm text-gray-500">
                      Nenhum veículo encontrado para "{inputValue}"
                    </p>
                  </div>
                </CommandEmpty>
              )}
              
              {!isLoading && !hasResults && inputValue.length < 2 && (
                <CommandEmpty>
                  <div className="flex flex-col items-center justify-center py-6">
                    <Search className="h-8 w-8 text-gray-400 mb-2" />
                    <p className="text-sm text-gray-500">
                      Digite pelo menos 2 caracteres para buscar
                    </p>
                  </div>
                </CommandEmpty>
              )}

              {hasResults && (
                <CommandGroup>
                  {vehicles.map((vehicle) => (
                    <CommandItem
                      key={vehicle.id}
                      value={vehicle.plate}
                      onSelect={() => handleSelect(vehicle.id)}
                      className="flex items-center justify-between cursor-pointer"
                    >
                      <div className="flex-1">
                        <div className="font-medium">{vehicle.plate}</div>
                        <div className="text-sm text-gray-500">
                          {vehicle.brand && vehicle.model 
                            ? `${vehicle.brand} ${vehicle.model}` 
                            : 'Marca/modelo não informado'
                          }
                          {vehicle.year && ` (${vehicle.year})`}
                        </div>
                        {vehicle.transporter_name && (
                          <div className="text-xs text-gray-400">
                            {vehicle.transporter_name}
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">
                          {vehicle.tare} kg
                        </Badge>
                        {value === vehicle.id && (
                          <Check className="h-4 w-4 text-primary" />
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

      {showError && (
        <p className="text-sm text-red-600 flex items-center gap-1">
          <X className="h-3 w-3" />
          {showError}
        </p>
      )}
      
      {selectedVehicle && (
        <div className="text-sm text-gray-600 bg-gray-50 rounded p-2">
          <div className="font-medium">{formatVehicleLabel(selectedVehicle)}</div>
          {selectedVehicle.transporter_name && (
            <div className="text-xs text-gray-500 mt-1">
              Transportador: {selectedVehicle.transporter_name}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Componentes específicos para facilitar o uso
export function TractorUnitSelector(props: Omit<OptimizedVehicleSelectorProps, 'vehicleType'>) {
  return (
    <OptimizedVehicleSelector
      {...props}
      vehicleType="tractor_unit"
      placeholder="Digite a placa da unidade tratora ou selecione"
      label={props.label || "Unidade Tratora (Cavalo Mecânico)"}
      description={props.description || "Esta é a unidade principal que irá puxar o conjunto"}
    />
  );
}

export function SemiTrailerSelector(props: Omit<OptimizedVehicleSelectorProps, 'vehicleType'>) {
  return (
    <OptimizedVehicleSelector
      {...props}
      vehicleType="semi_trailer" 
      placeholder="Digite a placa da carreta ou selecione"
      label={props.label || "Semirreboque (Carreta)"}
      description={props.description || "Selecione o semirreboque da composição"}
    />
  );
}