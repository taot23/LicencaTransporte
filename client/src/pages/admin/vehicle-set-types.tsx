import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, Settings, Truck } from "lucide-react";
import { VehicleSetType } from "@shared/vehicle-set-types";
import { VehicleSetTypeForm } from "@/components/admin";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

export default function VehicleSetTypesPage() {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingType, setEditingType] = useState<VehicleSetType | null>(null);

  // Buscar tipos de conjunto
  const { data: vehicleSetTypes = [], isLoading } = useQuery<VehicleSetType[]>({
    queryKey: ['/api/admin/vehicle-set-types'],
  });

  // Mutação para deletar tipo
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/vehicle-set-types/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Erro ao deletar tipo de conjunto');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/vehicle-set-types'] });
    },
  });

  const handleEdit = (type: VehicleSetType) => {
    setEditingType(type);
    setIsFormOpen(true);
  };

  const handleDelete = async (id: string) => {
    await deleteMutation.mutateAsync(id);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingType(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Carregando tipos de conjunto...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Tipos de Conjunto</h1>
          <p className="text-gray-600">
            Gerencie os tipos de conjunto de veículos e suas regras de validação
          </p>
        </div>
        <Button onClick={() => setIsFormOpen(true)} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Novo Tipo
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {vehicleSetTypes.map((type) => (
          <Card key={type.id} className="relative">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Truck className="h-5 w-5" />
                  {type.label}
                </CardTitle>
                <div className="flex gap-1">
                  <Badge variant={type.isActive ? "default" : "secondary"}>
                    {type.isActive ? "Ativo" : "Inativo"}
                  </Badge>
                  {type.axleConfiguration.isFlexible && (
                    <Badge variant="outline">Flexível</Badge>
                  )}
                </div>
              </div>
              {type.description && (
                <p className="text-sm text-gray-600">{type.description}</p>
              )}
            </CardHeader>
            
            <CardContent className="space-y-4">
              {/* Configuração de Eixos */}
              <div className="space-y-2">
                <h4 className="font-medium text-sm">Configuração de Eixos</h4>
                {type.axleConfiguration.isFlexible ? (
                  <div className="text-sm text-gray-600">
                    <Badge variant="outline">Sem restrições de eixos</Badge>
                  </div>
                ) : (
                  <div className="text-xs space-y-1">
                    <div>• Cavalo: {type.axleConfiguration.tractorAxles} eixos</div>
                    <div>• 1ª Carreta: {type.axleConfiguration.firstTrailerAxles} eixos</div>
                    {type.axleConfiguration.secondTrailerAxles > 0 && (
                      <div>• 2ª Carreta: {type.axleConfiguration.secondTrailerAxles} eixos</div>
                    )}
                    <div className="font-medium">• Total: {type.axleConfiguration.totalAxles} eixos</div>
                    {type.axleConfiguration.requiresDolly && (
                      <div className="text-orange-600">• Requer Dolly</div>
                    )}
                  </div>
                )}
              </div>

              {/* Limites de Dimensões */}
              <div className="space-y-2">
                <h4 className="font-medium text-sm">Limites de Dimensões</h4>
                <div className="text-xs space-y-1">
                  {type.dimensionLimits.minLength && (
                    <div>• Comprimento mín: {type.dimensionLimits.minLength}m</div>
                  )}
                  {type.dimensionLimits.maxLength && (
                    <div>• Comprimento máx: {type.dimensionLimits.maxLength}m</div>
                  )}
                  {type.dimensionLimits.maxWidth && (
                    <div>• Largura máx: {type.dimensionLimits.maxWidth}m</div>
                  )}
                  {type.dimensionLimits.maxHeight && (
                    <div>• Altura máx: {type.dimensionLimits.maxHeight}m</div>
                  )}
                </div>
              </div>

              {/* Ações */}
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleEdit(type)}
                  className="flex-1"
                >
                  <Edit className="h-3 w-3 mr-1" />
                  Editar
                </Button>
                
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700">
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                      <AlertDialogDescription>
                        Tem certeza que deseja excluir o tipo "{type.label}"? 
                        Esta ação não pode ser desfeita.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleDelete(type.id)}
                        className="bg-red-600 hover:bg-red-700"
                      >
                        Excluir
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Formulário Modal */}
      {isFormOpen && (
        <VehicleSetTypeForm
          vehicleSetType={editingType}
          onClose={handleCloseForm}
          onSuccess={() => {
            handleCloseForm();
            queryClient.invalidateQueries({ queryKey: ['/api/admin/vehicle-set-types'] });
          }}
        />
      )}
    </div>
  );
}