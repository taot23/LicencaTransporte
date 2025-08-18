import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { AdminLayout } from "@/components/layout/admin-layout";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Carregando tipos de conjunto...</div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Tipos de Conjunto de Veículos</h1>
            <p className="text-gray-600">
              Gerencie os tipos de conjunto disponíveis e suas regras de validação
            </p>
          </div>
          <Button onClick={() => setIsFormOpen(true)} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Novo Tipo
          </Button>
        </div>

        <div className="bg-white rounded-lg border shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo</TableHead>
                <TableHead>Configuração de Eixos</TableHead>
                <TableHead>Dimensões</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vehicleSetTypes.map((type) => (
                <TableRow key={type.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      {type.imageUrl ? (
                        <img 
                          src={type.imageUrl} 
                          alt={type.label}
                          className="w-12 h-8 object-contain rounded border"
                          onError={(e) => {
                            // Se a imagem falhar, mostra o ícone padrão
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            target.nextElementSibling?.classList.remove('hidden');
                          }}
                        />
                      ) : null}
                      <Truck className={`h-8 w-8 text-gray-400 p-1 border rounded ${type.imageUrl ? 'hidden' : ''}`} />
                      <div>
                        <div className="font-medium">{type.label}</div>
                        {type.description && (
                          <div className="text-sm text-gray-500">{type.description}</div>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {type.axleConfiguration.isFlexible ? (
                      <Badge variant="outline" className="text-green-700 bg-green-50">
                        Flexível
                      </Badge>
                    ) : (
                      <div className="text-sm space-y-1">
                        <div>Cavalo: {type.axleConfiguration.tractorAxles} eixos</div>
                        <div>1ª Carreta: {type.axleConfiguration.firstTrailerAxles} eixos</div>
                        {type.axleConfiguration.secondTrailerAxles > 0 && (
                          <div>2ª Carreta: {type.axleConfiguration.secondTrailerAxles} eixos</div>
                        )}
                        <div className="font-medium text-blue-600">
                          Total: {type.axleConfiguration.totalAxles} eixos
                        </div>
                        {type.axleConfiguration.requiresDolly && (
                          <Badge variant="secondary" className="text-xs">
                            Requer Dolly
                          </Badge>
                        )}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm space-y-1">
                      {type.dimensionLimits.minLength && (
                        <div>Compr. mín: {type.dimensionLimits.minLength}m</div>
                      )}
                      {type.dimensionLimits.maxLength && (
                        <div>Compr. máx: {type.dimensionLimits.maxLength}m</div>
                      )}
                      {type.dimensionLimits.maxWidth && (
                        <div>Larg. máx: {type.dimensionLimits.maxWidth}m</div>
                      )}
                      {type.dimensionLimits.maxHeight && (
                        <div>Alt. máx: {type.dimensionLimits.maxHeight}m</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={type.isActive ? "default" : "secondary"}>
                      {type.isActive ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-2 justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(type)}
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
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
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
    </AdminLayout>
  );
}