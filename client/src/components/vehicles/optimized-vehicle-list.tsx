import { useState, useEffect } from "react";
import { Vehicle } from "@shared/schema";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useOptimizedVehicleSearch } from "@/hooks/use-optimized-search";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Pencil, Trash, FileText, AlertCircle, ChevronLeft, ChevronRight, Search, X, ArrowUpDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { 
  Dialog, 
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface OptimizedVehicleListProps {
  onEdit: (vehicle: Vehicle) => void;
  onRefresh: () => void;
}

export function OptimizedVehicleList({ onEdit, onRefresh }: OptimizedVehicleListProps) {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  
  // Hook otimizado para busca de veículos
  const {
    vehicles,
    pagination,
    isLoading,
    searchTerm,
    setSearchTerm,
    currentPage,
    setCurrentPage,
    sortBy,
    sortOrder,
    handleSort,
    refetch
  } = useOptimizedVehicleSearch();
  
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [localSearchTerm, setLocalSearchTerm] = useState('');
  
  // Debounce local para evitar muitas chamadas da API
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setSearchTerm(localSearchTerm);
    }, 500);
    
    return () => clearTimeout(timeoutId);
  }, [localSearchTerm, setSearchTerm]);
  
  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/vehicles/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/vehicles'] });
      queryClient.invalidateQueries({ queryKey: ['/api/vehicles/search'] });
      toast({
        title: "Veículo excluído",
        description: "O veículo foi excluído com sucesso.",
      });
      setDeleteDialogOpen(false);
      setSelectedVehicle(null);
      refetch(); // Atualizar lista otimizada
      onRefresh(); // Callback opcional
    },
    onError: (error: any) => {
      console.error('Erro ao excluir veículo:', error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao excluir veículo",
        variant: "destructive",
      });
    },
  });
  
  // Traduzir tipos de veículos
  const getVehicleTypeLabel = (type: string): string => {
    const typeLabels: { [key: string]: string } = {
      'tractor_unit': 'Unidade Tratora',
      'semi_trailer': 'Semirreboque',
      'truck': 'Caminhão',
      'bitrain_7_axles': 'Bitrem 7 Eixos',
      'bitrain_9_axles': 'Bitrem 9 Eixos',
      'road_train': 'Rodotrem',
      'flatbed': 'Prancha',
      'dolly': 'Dolly'
    };
    return typeLabels[type] || type;
  };
  
  // Status badges
  const getStatusBadge = (status: string) => {
    const statusConfig: { [key: string]: { label: string; variant: "default" | "secondary" | "destructive" | "outline" } } = {
      'active': { label: 'Ativo', variant: 'default' },
      'inactive': { label: 'Inativo', variant: 'secondary' },
      'maintenance': { label: 'Manutenção', variant: 'outline' },
      'blocked': { label: 'Bloqueado', variant: 'destructive' }
    };
    
    const config = statusConfig[status] || { label: status, variant: 'outline' };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };
  
  const handleDeleteClick = (vehicle: Vehicle) => {
    setSelectedVehicle(vehicle);
    setDeleteDialogOpen(true);
  };
  
  const handleDocumentPreview = (vehicle: Vehicle) => {
    setSelectedVehicle(vehicle);
    setPreviewDialogOpen(true);
  };
  
  const clearSearch = () => {
    setLocalSearchTerm('');
    setSearchTerm('');
  };
  
  const getSortIcon = (field: string) => {
    if (sortBy !== field) return <ArrowUpDown className="h-4 w-4 opacity-30" />;
    return <ArrowUpDown className={`h-4 w-4 ${sortOrder === 'asc' ? 'rotate-180' : ''}`} />;
  };

  const DeleteConfirmDialog = () => (
    <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir Veículo</AlertDialogTitle>
          <AlertDialogDescription>
            Tem certeza de que deseja excluir o veículo <strong>{selectedVehicle?.plate}</strong>?
            Esta ação não pode ser desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => setSelectedVehicle(null)}>
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => selectedVehicle && deleteMutation.mutate(selectedVehicle.id)}
            className="bg-red-600 hover:bg-red-700"
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending ? "Excluindo..." : "Excluir"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  // Renderização mobile
  if (isMobile) {
    return (
      <>
        {/* Campo de busca - Mobile */}
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Buscar por placa, marca, modelo ou tipo..."
              value={localSearchTerm}
              onChange={(e) => setLocalSearchTerm(e.target.value)}
              className="pl-10 pr-10"
            />
            {localSearchTerm && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
                onClick={clearSearch}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          
          {/* Info de resultados */}
          <div className="mt-2 text-sm text-gray-600">
            {searchTerm ? (
              <>Encontrados {pagination.total} veículo{pagination.total !== 1 ? 's' : ''} para "{searchTerm}"</>
            ) : (
              <>Total: {pagination.total} veículo{pagination.total !== 1 ? 's' : ''}</>
            )}
          </div>
        </div>
        
        {isLoading ? (
          <div className="py-10 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-solid border-blue-500 border-r-transparent"></div>
            <p className="mt-2 text-gray-600">Carregando veículos...</p>
          </div>
        ) : vehicles.length > 0 ? (
          <div className="space-y-4">
            {vehicles.map((vehicle) => (
              <div key={vehicle.id} className="bg-white border rounded-lg p-4 shadow-sm">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex flex-col">
                    <div className="font-semibold text-lg">{vehicle.plate}</div>
                    <div className="text-sm text-gray-600">{getVehicleTypeLabel(vehicle.type)}</div>
                  </div>
                  {getStatusBadge(vehicle.status)}
                </div>
                
                <div className="grid grid-cols-2 gap-2 mb-4 text-sm">
                  <div>
                    <span className="text-gray-500">Marca:</span> {vehicle.brand || "-"}
                  </div>
                  <div>
                    <span className="text-gray-500">Modelo:</span> {vehicle.model || "-"}
                  </div>
                  <div>
                    <span className="text-gray-500">Eixos:</span> {vehicle.axleCount || "-"}
                  </div>
                  <div>
                    <span className="text-gray-500">Ano:</span> {vehicle.year || "-"}
                  </div>
                  <div>
                    <span className="text-gray-500">Tara:</span> {vehicle.tare.toLocaleString()} kg
                  </div>
                  <div>
                    <span className="text-gray-500">Ano CRLV:</span> {vehicle.crlvYear}
                  </div>
                </div>
                
                <div className="mt-4 flex justify-between items-center">
                  <div>
                    {vehicle.crlvUrl ? (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleDocumentPreview(vehicle)}
                      >
                        <FileText className="mr-1 h-4 w-4" /> Ver CRLV
                      </Button>
                    ) : (
                      <span className="text-gray-500 text-sm">CRLV não disponível</span>
                    )}
                  </div>
                  
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onEdit(vehicle)}
                      className="text-blue-600 border-blue-200"
                    >
                      <Pencil className="h-4 w-4 mr-1" /> Editar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteClick(vehicle)}
                      className="text-red-600 border-red-200"
                    >
                      <Trash className="h-4 w-4 mr-1" /> Excluir
                    </Button>
                  </div>
                </div>
              </div>
            ))}
            
            {/* Controles de paginação - Mobile */}
            {pagination.totalPages > 1 && (
              <div className="bg-white p-4 rounded-lg border">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-sm text-gray-600">
                    Página {currentPage} de {pagination.totalPages}
                  </span>
                  <span className="text-sm text-gray-600">
                    {((currentPage - 1) * pagination.limit) + 1}-{Math.min(currentPage * pagination.limit, pagination.total)} de {pagination.total} veículos
                  </span>
                </div>
                
                <div className="flex justify-center items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={!pagination.hasPrev}
                    className="flex items-center"
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Anterior
                  </Button>
                  
                  <span className="text-sm font-medium px-2">
                    {currentPage}/{pagination.totalPages}
                  </span>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.min(pagination.totalPages, prev + 1))}
                    disabled={!pagination.hasNext}
                    className="flex items-center"
                  >
                    Próxima
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-lg p-8 shadow text-center text-gray-500">
            <FileText className="h-12 w-12 mx-auto mb-2 text-gray-400" />
            {searchTerm ? (
              <>
                <p>Nenhum veículo encontrado para "{searchTerm}".</p>
                <Button variant="link" onClick={clearSearch} className="mt-2">
                  Limpar busca
                </Button>
              </>
            ) : (
              <p>Nenhum veículo cadastrado. Clique em "Cadastrar Veículo" para adicionar.</p>
            )}
          </div>
        )}

        <DeleteConfirmDialog />
      </>
    );
  }

  // Versão Desktop - Tabela
  return (
    <>
      {/* Campo de busca - Desktop */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            type="text"
            placeholder="Buscar veículos..."
            value={localSearchTerm}
            onChange={(e) => setLocalSearchTerm(e.target.value)}
            className="pl-10 pr-10"
          />
          {localSearchTerm && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
              onClick={clearSearch}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        
        <div className="mt-2 text-sm text-gray-600">
          {searchTerm ? (
            <>Encontrados {pagination.total} veículo{pagination.total !== 1 ? 's' : ''} para "{searchTerm}"</>
          ) : (
            <>Total: {pagination.total} veículo{pagination.total !== 1 ? 's' : ''}</>
          )}
        </div>
      </div>
      
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead 
                  className="cursor-pointer select-none hover:bg-gray-50"
                  onClick={() => handleSort('plate')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Placa</span>
                    {getSortIcon('plate')}
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer select-none hover:bg-gray-50"
                  onClick={() => handleSort('type')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Tipo</span>
                    {getSortIcon('type')}
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer select-none hover:bg-gray-50"
                  onClick={() => handleSort('brand')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Marca/Modelo</span>
                    {getSortIcon('brand')}
                  </div>
                </TableHead>
                <TableHead>Eixos</TableHead>
                <TableHead>Tara (kg)</TableHead>
                <TableHead>Ano</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Documentação</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-10">
                    Carregando veículos...
                  </TableCell>
                </TableRow>
              ) : vehicles.length > 0 ? (
                vehicles.map((vehicle) => (
                  <TableRow key={vehicle.id}>
                    <TableCell className="font-medium">{vehicle.plate}</TableCell>
                    <TableCell>{getVehicleTypeLabel(vehicle.type)}</TableCell>
                    <TableCell>
                      {vehicle.brand && vehicle.model 
                        ? `${vehicle.brand} / ${vehicle.model}` 
                        : vehicle.brand || vehicle.model || "-"}
                    </TableCell>
                    <TableCell>{vehicle.axleCount || "-"}</TableCell>
                    <TableCell>{vehicle.tare.toLocaleString()}</TableCell>
                    <TableCell>{vehicle.year || "-"}</TableCell>
                    <TableCell>{getStatusBadge(vehicle.status)}</TableCell>
                    <TableCell>
                      {vehicle.crlvUrl ? (
                        <Button 
                          variant="link" 
                          className="p-0 h-auto text-blue-600"
                          asChild
                        >
                          <a 
                            href={vehicle.crlvUrl?.startsWith('http') 
                              ? vehicle.crlvUrl 
                              : `${window.location.origin}${vehicle.crlvUrl}`
                            } 
                            target="_blank" 
                            rel="noopener noreferrer"
                          >
                            Ver CRLV
                          </a>
                        </Button>
                      ) : (
                        <span className="text-gray-500 text-sm">Não disponível</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onEdit(vehicle)}
                        className="text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteClick(vehicle)}
                        className="text-red-600 hover:text-red-800 hover:bg-red-50 ml-1"
                      >
                        <Trash className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-10 text-gray-500">
                    <FileText className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                    {searchTerm ? (
                      <>
                        <p>Nenhum veículo encontrado para "{searchTerm}".</p>
                        <Button variant="link" onClick={clearSearch} className="mt-2">
                          Limpar busca
                        </Button>
                      </>
                    ) : (
                      <p>Nenhum veículo cadastrado. Clique em "Cadastrar Veículo" para adicionar.</p>
                    )}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Paginação Desktop */}
        {pagination.totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-200">
            <div className="flex justify-between items-center">
              <div className="text-sm text-gray-600">
                Mostrando <span className="font-medium">{((currentPage - 1) * pagination.limit) + 1}-{Math.min(currentPage * pagination.limit, pagination.total)}</span> de <span className="font-medium">{pagination.total}</span> veículos
              </div>
              
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={!pagination.hasPrev}
                  className="flex items-center"
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Anterior
                </Button>
                
                <span className="text-sm font-medium px-3">
                  Página {currentPage} de {pagination.totalPages}
                </span>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(pagination.totalPages, prev + 1))}
                  disabled={!pagination.hasNext}
                  className="flex items-center"
                >
                  Próxima
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      <DeleteConfirmDialog />

      <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>CRLV do Veículo {selectedVehicle?.plate}</DialogTitle>
          </DialogHeader>
          
          {selectedVehicle?.crlvUrl ? (
            <div className="w-full h-[500px] flex flex-col items-center justify-center text-gray-500 bg-gray-50 rounded border p-6">
              <FileText className="h-16 w-16 text-gray-400 mb-4" />
              <p className="mb-4">O sistema não consegue exibir o documento diretamente.</p>
              <Button asChild>
                <a 
                  href={selectedVehicle.crlvUrl?.startsWith('http') 
                    ? selectedVehicle.crlvUrl 
                    : `${window.location.origin}${selectedVehicle.crlvUrl}`
                  } 
                  target="_blank" 
                  rel="noopener noreferrer"
                  onClick={(e) => {
                    if (!selectedVehicle.crlvUrl) {
                      e.preventDefault();
                      alert('Arquivo não disponível no momento.');
                    }
                  }}
                >
                  Abrir documento em nova aba
                </a>
              </Button>
            </div>
          ) : (
            <div className="py-12 text-center text-gray-500">
              <AlertCircle className="h-12 w-12 mx-auto mb-4" />
              <p>Documento não disponível.</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}