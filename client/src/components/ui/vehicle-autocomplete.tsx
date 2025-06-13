import { useState, useRef, useEffect } from "react";
import { Vehicle } from "@shared/schema";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Check, ChevronDown, Search, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface VehicleAutocompleteProps {
  vehicles: Vehicle[];
  value?: number;
  onSelect: (vehicleId: number | undefined, plate?: string) => void;
  placeholder?: string;
  disabled?: boolean;
  allowManualEntry?: boolean;
  className?: string;
  label?: string;
  onCreateNew?: () => void;
}

export function VehicleAutocomplete({
  vehicles,
  value,
  onSelect,
  placeholder = "Digite a placa ou selecione...",
  disabled = false,
  allowManualEntry = false,
  className,
  label,
  onCreateNew,
}: VehicleAutocompleteProps) {
  const [inputValue, setInputValue] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Sincronizar input com valor selecionado
  useEffect(() => {
    if (value) {
      const selectedVehicle = vehicles.find(v => v.id === value);
      if (selectedVehicle) {
        setInputValue(selectedVehicle.plate);
      }
    } else {
      setInputValue("");
    }
  }, [value, vehicles]);

  // Filtrar veículos baseado no texto digitado
  const filteredVehicles = vehicles.filter(vehicle =>
    vehicle.plate.toLowerCase().includes(inputValue.toLowerCase()) ||
    (vehicle.brand && vehicle.brand.toLowerCase().includes(inputValue.toLowerCase())) ||
    (vehicle.model && vehicle.model.toLowerCase().includes(inputValue.toLowerCase()))
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value.toUpperCase();
    setInputValue(newValue);
    setIsOpen(true);
    setHighlightedIndex(-1);

    // Se permitir entrada manual e não há veículo correspondente
    if (allowManualEntry) {
      const exactMatch = vehicles.find(v => v.plate === newValue);
      if (!exactMatch && newValue.length >= 3) {
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "Enter") {
        setIsOpen(true);
        return;
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev < filteredVehicles.length - 1 ? prev + 1 : prev
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case "Enter":
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < filteredVehicles.length) {
          handleVehicleSelect(filteredVehicles[highlightedIndex]);
        } else if (filteredVehicles.length === 1) {
          handleVehicleSelect(filteredVehicles[0]);
        }
        break;
      case "Escape":
        setIsOpen(false);
        setHighlightedIndex(-1);
        break;
    }
  };

  const handleBlur = () => {
    // Delay para permitir clique nas opções
    setTimeout(() => {
      setIsOpen(false);
      setHighlightedIndex(-1);
    }, 200);
  };

  const handleFocus = () => {
    if (filteredVehicles.length > 0) {
      setIsOpen(true);
    }
  };

  // Scroll automático para item destacado
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
      <div className="relative">
        <Input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          onFocus={handleFocus}
          disabled={disabled}
          className="pr-10"
        />
        <div className="absolute inset-y-0 right-0 flex items-center pr-2">
          <Search className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto">
          {filteredVehicles.length > 0 ? (
            <ul ref={listRef} className="py-1">
              {filteredVehicles.map((vehicle, index) => (
                <li
                  key={vehicle.id}
                  className={cn(
                    "px-3 py-2 cursor-pointer text-sm hover:bg-gray-100 flex items-center justify-between",
                    highlightedIndex === index && "bg-gray-100",
                    value === vehicle.id && "bg-blue-50 text-blue-700"
                  )}
                  onClick={() => handleVehicleSelect(vehicle)}
                >
                  <div className="flex flex-col">
                    <span className="font-medium">{vehicle.plate}</span>
                    <span className="text-xs text-gray-500">
                      {vehicle.brand} {vehicle.model} - {vehicle.year || 'S/Ano'}
                    </span>
                  </div>
                  {value === vehicle.id && (
                    <Check className="h-4 w-4 text-blue-600" />
                  )}
                </li>
              ))}
            </ul>
          ) : inputValue.length > 0 ? (
            <div className="px-3 py-2 text-sm text-gray-500">
              Nenhum veículo encontrado para "{inputValue}"
              {onCreateNew && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="mt-1 w-full justify-start"
                  onClick={() => {
                    onCreateNew();
                    setIsOpen(false);
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Cadastrar novo veículo
                </Button>
              )}
            </div>
          ) : (
            <div className="px-3 py-2 text-sm text-gray-500">
              Digite para buscar veículos...
            </div>
          )}
        </div>
      )}
    </div>
  );
}