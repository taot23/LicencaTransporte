import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Edit, Trash2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { VehicleModel, InsertVehicleModel } from "@shared/schema";
import { VehicleModelForm } from "@/components/admin/vehicle-model-form";

export default function VehicleModelsPage() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingModel, setEditingModel] = useState<VehicleModel | null>(null);
  const { toast } = useToast();

  const {
    data: vehicleModels = [],
    isLoading,
    refetch,
  } = useQuery<VehicleModel[]>({
    queryKey: ["/api/admin/vehicle-models"],
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
    if (confirm("Tem certeza que deseja excluir este modelo de veículo?")) {
      deleteMutation.mutate(id);
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

  // Agrupar modelos por marca
  const groupedModels = vehicleModels.reduce((acc, model) => {
    const brand = model.brand;
    if (!acc[brand]) {
      acc[brand] = [];
    }
    acc[brand].push(model);
    return acc;
  }, {} as Record<string, VehicleModel[]>);

  return (
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

      <Card>
        <CardHeader>
          <CardTitle>Lista de Modelos</CardTitle>
          <CardDescription>
            Total de {vehicleModels.length} modelo(s) cadastrado(s)
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
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedModels)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([brand, models]) => (
                  <div key={brand} className="space-y-3">
                    <h3 className="text-lg font-semibold text-primary">{brand}</h3>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Modelo</TableHead>
                          <TableHead>Tipo de Veículo</TableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {models
                          .sort((a, b) => a.model.localeCompare(b.model))
                          .map((model) => (
                            <TableRow key={model.id}>
                              <TableCell className="font-medium">{model.model}</TableCell>
                              <TableCell>
                                <Badge variant="outline">
                                  {getVehicleTypeLabel(model.vehicleType)}
                                </Badge>
                              </TableCell>
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
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}