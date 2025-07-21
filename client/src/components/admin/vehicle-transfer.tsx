import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { UserSelect } from "./user-select";
import { Vehicle, User } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ArrowRight, Truck, Search, X } from "lucide-react";
import { usePaginatedList } from "@/hooks/use-paginated-list";
import { ListPagination, MobileListPagination } from "@/components/ui/list-pagination";

export function VehicleTransfer() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedVehicleIds, setSelectedVehicleIds] = useState<number[]>([]);
  const [targetUserId, setTargetUserId] = useState<number | null>(null);

  // Função para obter nome traduzido do tipo de veículo
  const getVehicleTypeName = (type: string) => {
    const typeMap: Record<string, string> = {
      'tractor_unit': 'Unidade Tratora',
      'semi_trailer': 'Semirreboque',
      'trailer': 'Reboque',
      'dolly': 'Dolly',
      'flatbed': 'Prancha',
      'truck': 'Caminhão'
    };
    return typeMap[type] || type;
  };

  // Carregar todos os veículos
  const { data: vehicles = [], isLoading: vehiclesLoading } = useQuery<Vehicle[]>({
    queryKey: ["/api/vehicles/all"],
  });

  // Carregar todos os usuários
  const { data: users = [], isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
  });



  // Hook de paginação
  const {
    paginatedItems: paginatedVehicles,
    pagination,
    currentPage,
    setCurrentPage,
    searchTerm,
    setSearchTerm,
    filteredItems: filteredVehicles
  } = usePaginatedList({
    items: vehicles,
    itemsPerPage: 10
  });

  // Mutação para transferir veículos
  const transferMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/admin/vehicles/transfer", {
        vehicleIds: selectedVehicleIds,
        targetUserId
      });
      return await response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Transferência realizada com sucesso",
        description: `${data.transferredCount} veículos foram transferidos`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/vehicles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/vehicles/all"] });
      setSelectedVehicleIds([]);
      setTargetUserId(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Erro na transferência",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const handleSelectVehicle = (vehicleId: number, checked: boolean) => {
    if (checked) {
      setSelectedVehicleIds(prev => [...prev, vehicleId]);
    } else {
      setSelectedVehicleIds(prev => prev.filter(id => id !== vehicleId));
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedVehicleIds(filteredVehicles.map(v => v.id));
    } else {
      setSelectedVehicleIds([]);
    }
  };

  const getUserName = (userId: number | null) => {
    if (userId === null) return "Usuário undefined";
    const user = users.find(u => u.id === userId);
    return user ? user.fullName : `Usuário ${userId}`;
  };

  if (vehiclesLoading || usersLoading) {
    return <LoadingSpinner />;
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Truck className="h-5 w-5" />
          Transferir Veículos
        </CardTitle>
        <CardDescription>
          Selecione veículos para transferir para outro usuário. Útil para organizar veículos importados sem vinculação correta.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Campo de busca de veículos */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Buscar veículos:</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              type="text"
              placeholder="Buscar por placa, marca, modelo ou tipo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-10"
            />
            {searchTerm && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0 hover:bg-gray-100"
                onClick={() => setSearchTerm("")}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          {searchTerm && (
            <p className="text-sm text-gray-600">
              Mostrando {filteredVehicles.length} de {vehicles.length} veículos
            </p>
          )}
        </div>

        {/* Seleção de usuário de destino */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Transferir para usuário:</label>
          <UserSelect
            selectedUserId={targetUserId}
            onChange={setTargetUserId}
            description="Selecione o usuário que receberá os veículos selecionados"
          />
        </div>

        {/* Lista de veículos */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">
              Veículos Disponíveis 
              {filteredVehicles.length > 0 
                ? ` (${pagination.startItem}-${pagination.endItem} de ${pagination.total})`
                : ` (${vehicles.length})`
              }
            </h3>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="select-all"
                checked={filteredVehicles.length > 0 && selectedVehicleIds.length === filteredVehicles.length}
                onCheckedChange={handleSelectAll}
              />
              <label htmlFor="select-all" className="text-sm">
                Selecionar todos {searchTerm ? 'filtrados' : ''}
              </label>
            </div>
          </div>

          {/* Versão Desktop */}
          <div className="hidden md:block">
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">Sel.</TableHead>
                    <TableHead>Placa</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Marca/Modelo</TableHead>
                    <TableHead>Usuário Atual</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredVehicles.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                        {searchTerm ? 
                          `Nenhum veículo encontrado para "${searchTerm}"` : 
                          "Nenhum veículo disponível"
                        }
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedVehicles.map((vehicle) => (
                      <TableRow key={vehicle.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedVehicleIds.includes(vehicle.id)}
                            onCheckedChange={(checked) => 
                              handleSelectVehicle(vehicle.id, checked as boolean)
                            }
                          />
                        </TableCell>
                        <TableCell className="font-mono font-semibold">
                          {vehicle.plate}
                        </TableCell>
                        <TableCell>{getVehicleTypeName(vehicle.type)}</TableCell>
                        <TableCell>{vehicle.brand} {vehicle.model}</TableCell>
                        <TableCell>{getUserName(vehicle.userId)}</TableCell>
                        <TableCell>
                          <Badge variant={vehicle.status === 'active' ? 'default' : 'secondary'}>
                            {vehicle.status === 'active' ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Paginação Desktop */}
            {filteredVehicles.length > 0 && (
              <ListPagination
                currentPage={currentPage}
                totalPages={pagination.totalPages}
                onPageChange={setCurrentPage}
                totalItems={pagination.total}
                itemsPerPage={pagination.itemsPerPage}
                itemName="veículo"
              />
            )}
          </div>

          {/* Versão Mobile */}
          <div className="md:hidden space-y-3">
            {filteredVehicles.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                {searchTerm ? 
                  `Nenhum veículo encontrado para "${searchTerm}"` : 
                  "Nenhum veículo disponível"
                }
              </div>
            ) : (
              paginatedVehicles.map((vehicle) => (
                <Card key={vehicle.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-3">
                        <Checkbox
                          checked={selectedVehicleIds.includes(vehicle.id)}
                          onCheckedChange={(checked) => 
                            handleSelectVehicle(vehicle.id, checked as boolean)
                          }
                          className="mt-1"
                        />
                        <div className="space-y-1">
                          <p className="font-mono font-semibold">{vehicle.plate}</p>
                          <p className="text-sm text-gray-600">{getVehicleTypeName(vehicle.type)}</p>
                          <p className="text-sm">{vehicle.brand} {vehicle.model}</p>
                          <p className="text-xs text-gray-500">{getUserName(vehicle.userId)}</p>
                        </div>
                      </div>
                      <Badge variant={vehicle.status === 'active' ? 'default' : 'secondary'}>
                        {vehicle.status === 'active' ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}

            {/* Paginação Mobile */}
            {filteredVehicles.length > 0 && (
              <MobileListPagination
                currentPage={currentPage}
                totalPages={pagination.totalPages}
                onPageChange={setCurrentPage}
                totalItems={pagination.total}
                itemName="veículo"
              />
            )}
          </div>
        </div>

        {/* Resumo da transferência */}
        {selectedVehicleIds.length > 0 && targetUserId && (
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="font-medium text-blue-900">
                  Transferência Selecionada
                </p>
                <p className="text-blue-700 text-sm">
                  {selectedVehicleIds.length} veículo(s) → {getUserName(targetUserId)}
                </p>
              </div>
              <ArrowRight className="h-8 w-8 text-blue-600" />
            </div>
          </div>
        )}

        {/* Botão de transferência */}
        <div className="flex justify-end">
          <Button
            onClick={() => transferMutation.mutate()}
            disabled={
              selectedVehicleIds.length === 0 || 
              !targetUserId || 
              transferMutation.isPending
            }
            className="min-w-32"
          >
            {transferMutation.isPending ? (
              <>
                <LoadingSpinner size="sm" />
                <span className="ml-2">Transferindo...</span>
              </>
            ) : (
              `Transferir ${selectedVehicleIds.length} Veículo(s)`
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}