import { useState } from "react";
import { AdminLayout } from "@/components/layout/admin-layout";
import { OptimizedVehicleList } from "@/components/vehicles/optimized-vehicle-list";
import { Vehicle, vehicleTypeOptions } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { 
  Dialog, 
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

// Schema de validação simples para edição
const editVehicleSchema = z.object({
  plate: z.string().min(1, "A placa é obrigatória"),
  type: z.string().min(1, "O tipo de veículo é obrigatório"),
  brand: z.string().optional(),
  model: z.string().optional(),
  tare: z.coerce.number().min(1, "A tara deve ser maior que zero"),
  crlvYear: z.coerce.number().min(1900, "Ano inválido"),
  status: z.enum(["active", "inactive"])
});

type EditVehicleFormValues = z.infer<typeof editVehicleSchema>;

// Função auxiliar para obter label do tipo de veículo
function getVehicleTypeLabel(type: string): string {
  const option = vehicleTypeOptions.find(opt => opt.value === type);
  return option ? option.label : type;
}

export default function AdminVehiclesOptimizedPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);

  // Form para edição
  const form = useForm<EditVehicleFormValues>({
    resolver: zodResolver(editVehicleSchema),
    defaultValues: {
      plate: "",
      type: "",
      brand: "",
      model: "",
      tare: 0,
      crlvYear: new Date().getFullYear(),
      status: "active"
    }
  });

  // Mutation para atualizar veículo
  const updateVehicleMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Vehicle> }) => 
      apiRequest(`/api/vehicles/${id}`, { 
        method: 'PUT', 
        body: JSON.stringify(data) 
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/vehicles/search'] });
      toast({
        title: "Veículo atualizado",
        description: "As alterações foram salvas com sucesso.",
      });
      setEditingVehicle(null);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao atualizar veículo",
        variant: "destructive",
      });
    },
  });

  const handleEditVehicle = (vehicle: Vehicle) => {
    setEditingVehicle(vehicle);
    form.reset({
      plate: vehicle.plate,
      type: vehicle.type,
      brand: vehicle.brand || "",
      model: vehicle.model || "",
      tare: vehicle.tare,
      crlvYear: vehicle.crlvYear,
      status: vehicle.status as "active" | "inactive"
    });
  };

  const onSubmit = (data: EditVehicleFormValues) => {
    if (editingVehicle) {
      updateVehicleMutation.mutate({ id: editingVehicle.id, data });
    }
  };

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/vehicles/search'] });
  };

  return (
    <AdminLayout>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Veículos Otimizados</h1>
          <p className="text-gray-600 mt-1">
            Sistema otimizado para grandes volumes de dados com busca paginada
          </p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Cadastrar Veículo
        </Button>
      </div>

      {/* Lista otimizada com busca paginada */}
      <OptimizedVehicleList 
        onEdit={handleEditVehicle}
        onRefresh={handleRefresh}
      />

      {/* Modal de Edição */}
      <Dialog open={!!editingVehicle} onOpenChange={(open) => !open && setEditingVehicle(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Editar Veículo</DialogTitle>
            <DialogDescription>
              Edite as informações do veículo {editingVehicle?.plate}
            </DialogDescription>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="plate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Placa</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: ABC-1234" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de Veículo</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o tipo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {vehicleTypeOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="brand"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Marca</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Volvo" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="model"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Modelo</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: FH460" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="tare"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tara (kg)</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="Ex: 8500" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="crlvYear"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ano CRLV</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="2024" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="active">Ativo</SelectItem>
                        <SelectItem value="inactive">Inativo</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="flex justify-end space-x-2 pt-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setEditingVehicle(null)}
                >
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  disabled={updateVehicleMutation.isPending}
                >
                  {updateVehicleMutation.isPending ? "Salvando..." : "Salvar"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}