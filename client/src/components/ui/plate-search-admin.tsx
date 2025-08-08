import { useState, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, ChevronLeft, ChevronRight, Truck, Filter, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";

interface Plate {
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

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

interface PlateSearchAdminProps {
  onSelect: (plate: Plate) => void;
  selectedPlate?: Plate;
  vehicleType?: string;
  className?: string;
  placeholder?: string;
}

const vehicleTypeLabels: Record<string, string> = {
  'tractor_unit': 'Unidade Tratora',
  'semi_trailer': 'Semirreboque',
  'trailer': 'Reboque',
  'dolly': 'Dolly',
  'flatbed': 'Prancha'
};

export function PlateSearchAdmin({
  onSelect,
  selectedPlate,
  vehicleType = '',
  className,
  placeholder = "Digite a placa para buscar..."
}: PlateSearchAdminProps) {
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedType, setSelectedType] = useState(vehicleType);
  const [ownedOnly, setOwnedOnly] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Debounce para otimização
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setCurrentPage(1); // Reset página ao mudar busca
    }, 300);

    return () => clearTimeout(timer);
  }, [search]);

  // Query otimizada para busca de placas
  const { data, isLoading, error } = useQuery({
    queryKey: ['plates-search-admin', debouncedSearch, currentPage, selectedType, ownedOnly],
    queryFn: async () => {
      if (!debouncedSearch || debouncedSearch.length < 2) return null;
      
      const params = new URLSearchParams({
        search: debouncedSearch,
        page: currentPage.toString(),
        limit: '12',
        vehicleType: selectedType,
        ownedOnly: ownedOnly.toString()
      });

      const response = await fetch(`/api/plates/search?${params}`);
      if (!response.ok) {
        throw new Error('Erro na busca de placas');
      }
      return response.json();
    },
    enabled: debouncedSearch.length >= 2,
    staleTime: 2 * 60 * 1000, // Cache por 2 minutos
  });

  const handlePlateSelect = useCallback((plate: Plate) => {
    onSelect(plate);
    setSearch(plate.plate);
    setIsOpen(false);
  }, [onSelect]);

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
      {/* Campo de busca principal */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
        <Input
          type="text"
          placeholder={placeholder}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value.toUpperCase());
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          className="pl-10 pr-4"
        />
        {selectedPlate && (
          <Check className="absolute right-3 top-1/2 transform -translate-y-1/2 text-green-500 h-4 w-4" />
        )}
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-4 mt-2">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-500" />
          <Select value={selectedType} onValueChange={setSelectedType}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todos os tipos</SelectItem>
              {Object.entries(vehicleTypeLabels).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div className="flex items-center space-x-2">
          <Switch
            id="owned-only"
            checked={ownedOnly}
            onCheckedChange={setOwnedOnly}
          />
          <Label htmlFor="owned-only" className="text-sm">Apenas próprios</Label>
        </div>
      </div>

      {/* Resultados */}
      {isOpen && debouncedSearch.length >= 2 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-96 overflow-hidden">
          {isLoading && (
            <div className="p-4 text-center text-gray-500">
              <div className="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-2"></div>
              Buscando placas...
            </div>
          )}

          {error && (
            <div className="p-4 text-center text-red-500">
              Erro na busca. Tente novamente.
            </div>
          )}

          {data && data.plates && (
            <>
              {/* Lista de placas */}
              <div className="max-h-64 overflow-y-auto">
                {data.plates.length === 0 ? (
                  <div className="p-4 text-center text-gray-500">
                    Nenhuma placa encontrada para "{debouncedSearch}"
                  </div>
                ) : (
                  data.plates.map((plate: Plate) => (
                    <div
                      key={plate.id}
                      onClick={() => handlePlateSelect(plate)}
                      className="p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Truck className="h-4 w-4 text-gray-400" />
                          <div>
                            <div className="font-mono font-medium text-gray-900">
                              {plate.plate}
                            </div>
                            <div className="text-sm text-gray-500">
                              {plate.brand} {plate.model} ({plate.year})
                            </div>
                            {plate.transporterName && (
                              <div className="text-xs text-gray-400">
                                {plate.transporterName}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <Badge className={getTypeColor(plate.type)}>
                            {vehicleTypeLabels[plate.type] || plate.type}
                          </Badge>
                          {plate.ownershipType === 'terceiro' && (
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
                      <span className="ml-2">({data.pagination.total} placas)</span>
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
                </div>
              )}
            </>
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