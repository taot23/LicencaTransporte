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

        <PopoverContent 
          className="w-[var(--radix-popover-trigger-width)] min-w-96 p-0" 
          align="start"
          side="bottom"
          sideOffset={2}
          alignOffset={0}
        >
          <Command shouldFilter={false}>
            <div className="flex items-center border-b px-3">
              <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
              <Input
                value={inputValue}
                onChange={(e) => handleInputChange(e.target.value)}
                placeholder="Buscar por nome ou CNPJ..."
                className="border-0 outline-none focus:ring-0 h-10"
              />
            </div>
            
            <CommandList className="max-h-72 overflow-y-auto">
              {isLoading && (
                <CommandEmpty>
                  <div className="flex items-center justify-center py-6">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                    <span className="ml-2">Carregando transportadores...</span>
                  </div>
                </CommandEmpty>
              )}
              
              {!isLoading && !hasResults && inputValue.length >= 1 && (
                <CommandEmpty>
                  <div className="flex flex-col items-center justify-center py-6">
                    <Building2 className="h-8 w-8 text-gray-400 mb-2" />
                    <p className="text-sm text-gray-500">
                      Nenhum transportador encontrado para "{inputValue}"
                    </p>
                  </div>
                </CommandEmpty>
              )}
              
              {!isLoading && !hasResults && inputValue.length === 0 && (
                <CommandEmpty>
                  <div className="flex flex-col items-center justify-center py-6">
                    <Search className="h-8 w-8 text-gray-400 mb-2" />
                    <p className="text-sm text-gray-500">
                      Digite para buscar transportadores
                    </p>
                  </div>
                </CommandEmpty>
              )}

              {hasResults && (
                <CommandGroup>
                  {transporters.map((transporter) => (
                    <CommandItem
                      key={transporter.id}
                      value={transporter.name}
                      onSelect={() => handleSelect(transporter.id)}
                      className="flex items-center justify-between cursor-pointer p-3"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900 truncate">
                          {transporter.name}
                        </div>
                        {transporter.tradeName && transporter.tradeName !== transporter.name && (
                          <div className="text-sm text-gray-600 truncate">
                            {transporter.tradeName}
                          </div>
                        )}
                        {transporter.documentNumber && (
                          <div className="text-xs text-gray-500 mt-1">
                            {transporter.personType === 'pj' ? 'CNPJ' : 'CPF'}: {transporter.documentNumber}
                          </div>
                        )}
                        {transporter.city && transporter.state && (
                          <div className="text-xs text-gray-400 mt-1">
                            {transporter.city} - {transporter.state}
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {value === transporter.id && (
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