import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Edit, Trash2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { VehicleModel, InsertVehicleModel } from "@shared/schema";
import { VehicleModelForm } from "@/components/admin/vehicle-model-form";
import { AdminLayout } from "@/components/layout/admin-layout";
import { usePaginatedList } from "@/hooks/use-paginated-list";
import { StandardPagination } from "@/components/ui/standard-pagination";

export default function VehicleModelsPage() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingModel, setEditingModel] = useState<VehicleModel | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [modelToDelete, setModelToDelete] = useState<number | null>(null);
  const { toast } = useToast();

  const {
    data: vehicleModels = [],
    isLoading,
    refetch,
  } = useQuery<VehicleModel[]>({
    queryKey: ["/api/admin/vehicle-models"],
  });



  // Hook de paginação
  const {
    paginatedItems: paginatedModels,
    pagination,
    currentPage,
    setCurrentPage,
    searchTerm,
    setSearchTerm,
    filteredItems
  } = usePaginatedList({
    items: vehicleModels,
    itemsPerPage: 10
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertVehicleModel) => {
      const response = await apiRequest("POST", "/api/admin/vehicle-models", data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/vehicle-models"] });
      setIsCreateDialogOpen(false);
      toast({
        title: "Sucesso",
        description: "Modelo de veículo criado com sucesso!",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: InsertVehicleModel }) => {
      const response = await apiRequest("PUT", `/api/admin/vehicle-models/${id}`, data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/vehicle-models"] });
      setEditingModel(null);
      toast({
        title: "Sucesso",
        description: "Modelo de veículo atualizado com sucesso!",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/admin/vehicle-models/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/vehicle-models"] });
      toast({
        title: "Sucesso",
        description: "Modelo de veículo excluído com sucesso!",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleCreate = (data: InsertVehicleModel) => {
    createMutation.mutate(data);
  };

  const handleUpdate = (data: InsertVehicleModel) => {
    if (editingModel) {
      updateMutation.mutate({ id: editingModel.id, data });
    }
  };

  const handleDelete = (id: number) => {
    setModelToDelete(id);
    setIsDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (modelToDelete) {
      deleteMutation.mutate(modelToDelete);
      setIsDeleteDialogOpen(false);
      setModelToDelete(null);
    }
  };

  const getVehicleTypeLabel = (type: string) => {
    const typeLabels: Record<string, string> = {
      'tractor_unit': 'Unidade Tratora (Cavalo)',
      'semi_trailer': 'Semirreboque',
      'trailer': 'Reboque',
      'dolly': 'Dolly',
      'flatbed': 'Prancha',
      'truck': 'Caminhão',
      'crane': 'Guindaste'
    };
    return typeLabels[type] || type;
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Modelos de Veículos</h1>
            <p className="text-muted-foreground">
              Gerencie os modelos de veículos disponíveis no sistema
            </p>
          </div>
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }



  return (
    <AdminLayout contentKey="vehicle-models">
      <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Modelos de Veículos</h1>
          <p className="text-muted-foreground">
            Gerencie os modelos de veículos disponíveis no sistema
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading}
            className="bg-white"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Novo Modelo
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Criar Novo Modelo</DialogTitle>
              </DialogHeader>
              <VehicleModelForm
                onSubmit={handleCreate}
                onCancel={() => setIsCreateDialogOpen(false)}
                isSubmitting={createMutation.isPending}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Seção de Consulta/Filtros */}
      <Card>
        <CardHeader>
          <CardTitle>Consulta de Modelos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Input
              placeholder="Buscar por marca ou modelo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full"
            />
            {searchTerm && (
              <p className="text-sm text-gray-600">
                Encontrados {filteredItems.length} modelo(s) de {vehicleModels.length} total
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Modelos</CardTitle>
          <CardDescription>
            {filteredItems.length > 0 
              ? `Mostrando ${pagination.startItem}-${pagination.endItem} de ${pagination.total} modelo(s)`
              : `Total de ${vehicleModels.length} modelo(s) cadastrado(s)`
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {vehicleModels.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Nenhum modelo de veículo cadastrado</p>
              <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="mt-4">
                    <Plus className="h-4 w-4 mr-2" />
                    Cadastrar Primeiro Modelo
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Criar Novo Modelo</DialogTitle>
                  </DialogHeader>
                  <VehicleModelForm
                    onSubmit={handleCreate}
                    onCancel={() => setIsCreateDialogOpen(false)}
                    isSubmitting={createMutation.isPending}
                  />
                </DialogContent>
              </Dialog>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Nenhum resultado encontrado para "{searchTerm}"</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Versão Desktop */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Marca</TableHead>
                      <TableHead>Modelo</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedModels
                      .sort((a, b) => {
                        const brandCompare = a.brand.localeCompare(b.brand);
                        if (brandCompare !== 0) return brandCompare;
                        return a.model.localeCompare(b.model);
                      })
                      .map((model) => (
                        <TableRow key={model.id}>
                          <TableCell className="font-medium">{model.brand}</TableCell>
                          <TableCell>{model.model}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Dialog
                                open={editingModel?.id === model.id}
                                onOpenChange={(open) => {
                                  if (!open) setEditingModel(null);
                                  else setEditingModel(model);
                                }}
                              >
                                <DialogTrigger asChild>
                                  <Button variant="outline" size="sm">
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-md">
                                  <DialogHeader>
                                    <DialogTitle>Editar Modelo</DialogTitle>
                                  </DialogHeader>
                                  <VehicleModelForm
                                    initialData={model}
                                    onSubmit={handleUpdate}
                                    onCancel={() => setEditingModel(null)}
                                    isSubmitting={updateMutation.isPending}
                                  />
                                </DialogContent>
                              </Dialog>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDelete(model.id)}
                                disabled={deleteMutation.isPending}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
                
                {/* Paginação Padronizada */}
                <StandardPagination
                  currentPage={currentPage}
                  totalPages={pagination.totalPages}
                  onPageChange={setCurrentPage}
                  totalItems={pagination.total}
                  hasPrev={pagination.hasPrev}
                  hasNext={pagination.hasNext}
                  startItem={pagination.startItem}
                  endItem={pagination.endItem}
                  itemName="modelos"
                  showPageSizeSelect={false}
                />
              </div>

              {/* Versão Mobile */}
              <div className="md:hidden space-y-3">
                {paginatedModels
                  .sort((a, b) => {
                    const brandCompare = a.brand.localeCompare(b.brand);
                    if (brandCompare !== 0) return brandCompare;
                    return a.model.localeCompare(b.model);
                  })
                  .map((model) => (
                    <Card key={model.id}>
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start">
                          <div className="space-y-1">
                            <p className="font-medium">{model.brand}</p>
                            <p className="text-sm text-gray-600">{model.model}</p>
                          </div>
                          <div className="flex gap-2">
                            <Dialog
                              open={editingModel?.id === model.id}
                              onOpenChange={(open) => {
                                if (!open) setEditingModel(null);
                                else setEditingModel(model);
                              }}
                            >
                              <DialogTrigger asChild>
                                <Button variant="outline" size="sm">
                                  <Edit className="h-4 w-4" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-md">
                                <DialogHeader>
                                  <DialogTitle>Editar Modelo</DialogTitle>
                                </DialogHeader>
                                <VehicleModelForm
                                  initialData={model}
                                  onSubmit={handleUpdate}
                                  onCancel={() => setEditingModel(null)}
                                  isSubmitting={updateMutation.isPending}
                                />
                              </DialogContent>
                            </Dialog>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDelete(model.id)}
                              disabled={deleteMutation.isPending}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}

              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de confirmação de exclusão */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este modelo de veículo? Esta ação não pode ser desfeita e todos os dados relacionados serão removidos permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </div>
    </AdminLayout>
  );
}