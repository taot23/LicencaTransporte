import { useState, useRef, useEffect } from "react";
import { Check, ChevronDown, Search, Building2, X } from "lucide-react";
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
import { cn } from "@/lib/utils";
import { useOptimizedTransporterSelector, TransporterOption } from "@/hooks/use-optimized-transporter-selector";

interface OptimizedTransporterSelectorProps {
  value?: number | null;
  onValueChange: (value: number | null) => void;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  required?: boolean;
  label?: string;
  description?: string;
}

export function OptimizedTransporterSelector({
  value,
  onValueChange,
  placeholder = "Digite o nome ou CNPJ do transportador...",
  disabled = false,
  error,
  required = false,
  label = "Transportador",
  description
}: OptimizedTransporterSelectorProps) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const {
    searchTerm,
    setSearchTerm,
    transporters,
    isLoading,
    error: searchError,
    hasResults,
    formatTransporterLabel,
    getTransporterById
  } = useOptimizedTransporterSelector();

  // Sincronizar busca com input
  useEffect(() => {
    setSearchTerm(inputValue);
  }, [inputValue, setSearchTerm]);

  // Obter transportador selecionado
  const selectedTransporter = value ? getTransporterById(value) : null;

  // Atualizar input quando transportador é selecionado
  useEffect(() => {
    if (selectedTransporter && !open) {
      setInputValue(selectedTransporter.name);
    }
  }, [selectedTransporter, open]);

  const handleSelect = (transporterId: number) => {
    const transporter = getTransporterById(transporterId);
    if (transporter) {
      onValueChange(transporterId);
      setInputValue(transporter.name);
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
    // Limpar seleção se o input foi limpo
    if (!newValue && value) {
      onValueChange(null);
    }
  };

  const showError = error || searchError?.message;

  return (
    <div className="space-y-2">
      {label && (
        <label className="text-sm font-medium text-gray-700">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
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
            onFocus={() => setOpen(true)}
            placeholder={placeholder}
            disabled={disabled}
            className={cn(
              "pr-20",
              showError && "border-red-300 focus:border-red-300 focus:ring-red-200"
            )}
          />
          
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {selectedTransporter && (
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

        
      </Popover>

      {showError && (
        <p className="text-sm text-red-600 flex items-center gap-1">
          <X className="h-3 w-3" />
          {showError}
        </p>
      )}
      
      {selectedTransporter && (
        <div className="text-sm text-gray-600 bg-gray-50 rounded p-2">
          <div className="font-medium">{formatTransporterLabel(selectedTransporter)}</div>
          {selectedTransporter.email && (
            <div className="text-xs text-gray-500 mt-1">
              Email: {selectedTransporter.email}
            </div>
          )}
          {selectedTransporter.phone && (
            <div className="text-xs text-gray-500">
              Telefone: {selectedTransporter.phone}
            </div>
          )}
        </div>
      )}
    </div>
  );
}