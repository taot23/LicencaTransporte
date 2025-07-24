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
import { useOnClickOutside } from "@/hooks/use-on-click-outside";
import { usePaginatedSelector } from "@/hooks/use-paginated-selector";
import { PaginationControls } from "@/components/ui/pagination-controls";

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
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fechar dropdown quando clicar fora
  useOnClickOutside(dropdownRef, () => setOpen(false));

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

  // Paginação dos transportadores (3 por página para demonstrar)
  const {
    currentItems: paginatedTransporters,
    currentPage,
    totalPages,
    totalItems,
    hasNextPage,
    hasPreviousPage,
    goToNextPage,
    goToPreviousPage,
    resetPagination
  } = usePaginatedSelector({
    items: transporters,
    itemsPerPage: 3
  });

  // Debug para paginação
  useEffect(() => {
    console.log('[TRANSPORTER PAGINATION DEBUG]', {
      totalTransporters: transporters.length,
      currentPage,
      totalPages,
      hasNextPage,
      hasPreviousPage,
      paginatedCount: paginatedTransporters.length,
      searchTerm: inputValue,
      hasResults: hasResults,
      shouldShowPagination: hasResults && totalPages > 1,
      open: open
    });
  }, [transporters, currentPage, totalPages, hasNextPage, hasPreviousPage, paginatedTransporters, inputValue, hasResults, open]);

  // Sincronizar busca com input e resetar paginação
  useEffect(() => {
    setSearchTerm(inputValue);
    resetPagination();
  }, [inputValue, setSearchTerm, resetPagination]);

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

      <div className="relative" ref={dropdownRef}>
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
          
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 hover:bg-gray-100"
            onClick={() => setOpen(!open)}
            disabled={disabled}
          >
            <ChevronDown className="h-3 w-3" />
          </Button>
        </div>

        {/* Dropdown absoluto */}
        {open && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-72 overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-100 p-2">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                <Input
                  value={inputValue}
                  onChange={(e) => handleInputChange(e.target.value)}
                  placeholder="Buscar por nome ou CNPJ..."
                  className="pl-8 h-9 text-sm"
                />
              </div>
            </div>
            
            <div className="max-h-60 overflow-y-auto">
              {isLoading && (
                <div className="flex items-center justify-center py-6">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                  <span className="ml-2 text-sm">Carregando transportadores...</span>
                </div>
              )}
              
              {!isLoading && !hasResults && inputValue.length >= 1 && (
                <div className="flex flex-col items-center justify-center py-6">
                  <Building2 className="h-8 w-8 text-gray-400 mb-2" />
                  <p className="text-sm text-gray-500">
                    Nenhum transportador encontrado para "{inputValue}"
                  </p>
                </div>
              )}
              
              {!isLoading && !hasResults && inputValue.length === 0 && (
                <div className="flex flex-col items-center justify-center py-6">
                  <Search className="h-8 w-8 text-gray-400 mb-2" />
                  <p className="text-sm text-gray-500">
                    Digite para buscar transportadores
                  </p>
                </div>
              )}

              {hasResults && paginatedTransporters.map((transporter) => (
                <div
                  key={transporter.id}
                  className="flex items-center justify-between cursor-pointer p-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                  onClick={() => handleSelect(transporter.id)}
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
                </div>
              ))}
            </div>
            
            {/* Controles de paginação */}
            {hasResults && totalPages > 1 && (
              <div className="sticky bottom-0 bg-white border-t border-gray-100 px-2 py-1">
                <PaginationControls
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalItems={totalItems}
                  itemsPerPage={3}
                  onPreviousPage={() => {
                    console.log('[TRANSPORTER PAGINATION] Botão Anterior clicado');
                    goToPreviousPage();
                  }}
                  onNextPage={() => {
                    console.log('[TRANSPORTER PAGINATION] Botão Próxima clicado');
                    goToNextPage();
                  }}
                  hasPreviousPage={hasPreviousPage}
                  hasNextPage={hasNextPage}
                  size="sm"
                  showItemCount={true}
                  className="text-xs"
                />
              </div>
            )}
          </div>
        )}
      </div>

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