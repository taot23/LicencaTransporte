import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/layout/admin-layout";
import { Vehicle, vehicleTypeOptions } from "@shared/schema";
import { OptimizedVehicleList } from "@/components/vehicles/optimized-vehicle-list";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2, Search, AlertCircle, Truck, Pencil, CheckCircle, XCircle, UploadCloud, FileText } from "lucide-react";
import { Label } from "@/components/ui/label";
import { 
  Dialog, 
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter 
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

// Esquema de validação para edição de veículos
const editVehicleSchema = z.object({
  plate: z.string().min(1, "A placa é obrigatória"),
  type: z.string().min(1, "O tipo de veículo é obrigatório"),
  tare: z.coerce.number().min(1, "A tara deve ser maior que zero"),
  crlvYear: z.coerce.number().min(1900, "Ano inválido"),
  status: z.enum(["active", "inactive"])
});

type EditVehicleFormValues = z.infer<typeof editVehicleSchema>;

export default function AdminVehiclesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadFileName, setUploadFileName] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Formulário para edição
  const form = useForm<EditVehicleFormValues>({
    resolver: zodResolver(editVehicleSchema),
    defaultValues: {
      plate: "",
      type: "",
      tare: 0,
      crlvYear: 0,
      status: "active"
    }
  });

  // Buscar todos os veículos
  // Redirect to optimized page immediately
  useEffect(() => {
    window.location.href = '/admin/vehicles-optimized';
  }, []);

  // Filtrar veículos pela placa
  const filteredVehicles = vehicles?.filter(
    (vehicle) => vehicle.plate.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getVehicleTypeLabel = (type: string): string => {
    const typeMapping: Record<string, string> = {
      tractor: "Unidade Tratora (Cavalo)",
      semitrailer: "Semirreboque",
      trailer: "Reboque",
      dolly: "Dolly",
      flatbed: "Prancha"
    };
    return typeMapping[type] || type;
  };

  // Gerenciar seleção de arquivo
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedFile(file);
      setUploadFileName(file.name);
    }
  };

  // Limpar arquivo selecionado
  const clearFileSelection = () => {
    setUploadedFile(null);
    setUploadFileName("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Acionar diálogo de escolha de arquivo
  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  // Mutation para atualizar veículo com suporte a upload de arquivo
  const updateVehicleMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: EditVehicleFormValues }) => {
      // Se tiver arquivo, usar FormData
      if (uploadedFile) {
        const formData = new FormData();
        formData.append("crlvFile", uploadedFile);
        
        // Adicionar os dados do veículo como campo json
        formData.append("plate", data.plate);
        formData.append("type", data.type);
        formData.append("tare", data.tare.toString());
        formData.append("crlvYear", data.crlvYear.toString());
        formData.append("status", data.status);
        
        const response = await fetch(`/api/admin/vehicles/${id}`, {
          method: 'PATCH',
          body: formData,
          credentials: 'include',
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Erro ao atualizar veículo');
        }
        
        return await response.json();
      } 
      // Sem arquivo, usar JSON normal
      else {
        const response = await fetch(`/api/admin/vehicles/${id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data),
          credentials: 'include',
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Erro ao atualizar veículo');
        }
        
        return await response.json();
      }
    },
    onSuccess: () => {
      // Invalidar cache para recarregar a lista
      queryClient.invalidateQueries({ queryKey: ['/api/vehicles'] });
      toast({
        title: 'Veículo atualizado',
        description: 'As informações do veículo foram atualizadas com sucesso.',
      });
      setEditingVehicle(null);
      setUploadedFile(null);
      setUploadFileName("");
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao atualizar veículo',
        description: error.message,
        variant: 'destructive',
      });
    }
  });

  // Abrir modal de detalhes
  const handleViewDetails = (vehicle: Vehicle) => {
    setSelectedVehicle(vehicle);
  };

  // Abrir modal de edição
  const handleEditVehicle = (vehicle: Vehicle) => {
    setEditingVehicle(vehicle);
    form.reset({
      plate: vehicle.plate,
      type: vehicle.type,
      tare: parseFloat(vehicle.tare.toString()),
      crlvYear: vehicle.crlvYear,
      status: vehicle.status as "active" | "inactive"
    });
  };

  // Processar submissão do formulário
  const onSubmit = (data: EditVehicleFormValues) => {
    if (editingVehicle) {
      updateVehicleMutation.mutate({ id: editingVehicle.id, data });
    }
  };

  return (
    <AdminLayout>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Veículos Cadastrados</h1>
          <p className="text-gray-600 mt-1">
            Gerencie todos os veículos cadastrados no sistema
          </p>
        </div>
      </div>

      {/* Lista de veículos otimizada para grandes volumes de dados */}
      <OptimizedVehicleList 
        onEdit={handleEditVehicle}
        onRefresh={() => queryClient.invalidateQueries({ queryKey: ["/api/vehicles"] })}
      />

      {/* Modal de Detalhes do Veículo */}
      {selectedVehicle && (
        <Dialog open={!!selectedVehicle} onOpenChange={(open) => !open && setSelectedVehicle(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Detalhes do Veículo</DialogTitle>
              <DialogDescription>
                Informações completas do veículo
              </DialogDescription>
            </DialogHeader>
            
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <div className="col-span-1 font-medium">Placa:</div>
                <div className="col-span-3">{selectedVehicle.plate}</div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <div className="col-span-1 font-medium">Tipo:</div>
                <div className="col-span-3">{getVehicleTypeLabel(selectedVehicle.type)}</div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <div className="col-span-1 font-medium">Tara:</div>
                <div className="col-span-3">{selectedVehicle.tare} kg</div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <div className="col-span-1 font-medium">Ano CRLV:</div>
                <div className="col-span-3">{selectedVehicle.crlvYear}</div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <div className="col-span-1 font-medium">Status:</div>
                <div className="col-span-3">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    selectedVehicle.status === "active" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                  }`}>
                    {selectedVehicle.status === "active" ? "Ativo" : "Inativo"}
                  </span>
                </div>
              </div>
              {selectedVehicle.crlvUrl && (
                <div className="grid grid-cols-4 items-center gap-4">
                  <div className="col-span-1 font-medium">CRLV:</div>
                  <div className="col-span-3">
                    <Button asChild variant="outline" size="sm">
                      <a href={selectedVehicle.crlvUrl} target="_blank" rel="noreferrer">
                        Visualizar CRLV
                      </a>
                    </Button>
                  </div>
                </div>
              )}
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedVehicle(null)}>
                Fechar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Modal de Edição do Veículo */}
      {editingVehicle && (
        <Dialog open={!!editingVehicle} onOpenChange={(open) => !open && setEditingVehicle(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Veículo</DialogTitle>
              <DialogDescription>
                Atualize as informações do veículo
              </DialogDescription>
            </DialogHeader>
            
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="plate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Placa*</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="AAA0000" />
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
                      <FormLabel>Tipo de Veículo*</FormLabel>
                      <Select 
                        onValueChange={field.onChange} 
                        defaultValue={field.value}
                      >
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
                
                <FormField
                  control={form.control}
                  name="tare"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tara (kg)*</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} placeholder="0" />
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
                      <FormLabel>Ano CRLV*</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} placeholder="2023" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status*</FormLabel>
                      <Select 
                        onValueChange={field.onChange} 
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o status" />
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
                
                {/* Upload de CRLV */}
                <div className="space-y-2">
                  <Label htmlFor="crlv-upload">Documento CRLV</Label>
                  <div className="grid gap-2">
                    <input
                      ref={fileInputRef}
                      id="crlv-upload"
                      type="file"
                      className="hidden"
                      accept="image/*,.pdf"
                      onChange={handleFileChange}
                    />
                    
                    {/* Área para fazer upload do arquivo */}
                    <Button
                      type="button"
                      variant="outline"
                      className={`h-auto p-4 justify-start text-left font-normal ${uploadedFile ? "border-primary" : ""}`}
                      onClick={triggerFileInput}
                    >
                      <div className="flex items-center gap-3">
                        {uploadedFile ? (
                          <FileText className="h-5 w-5 text-primary" />
                        ) : (
                          <UploadCloud className="h-5 w-5 text-muted-foreground" />
                        )}
                        <div className="flex flex-col text-sm gap-1">
                          {uploadedFile ? (
                            <div className="flex flex-col">
                              <span className="font-medium text-primary">Arquivo selecionado</span>
                              <span className="text-xs text-muted-foreground line-clamp-1">{uploadFileName}</span>
                            </div>
                          ) : (
                            <>
                              <span>Clique para fazer upload do CRLV</span>
                              <span className="text-xs text-muted-foreground">
                                Substitui o arquivo atual se existir
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </Button>
                    
                    {/* Botão para limpar arquivo selecionado */}
                    {uploadedFile && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="mt-1"
                        onClick={clearFileSelection}
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        Remover arquivo
                      </Button>
                    )}
                    
                    {/* Exibir documento atual */}
                    {editingVehicle?.crlvUrl && !uploadedFile && (
                      <div className="text-sm text-muted-foreground flex items-center">
                        <FileText className="h-4 w-4 mr-1" />
                        <span>CRLV atual disponível - </span>
                        <Button asChild variant="link" size="sm" className="h-auto p-0 ml-1">
                          <a href={editingVehicle.crlvUrl} target="_blank" rel="noreferrer">
                            Visualizar
                          </a>
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
                
                <DialogFooter className="gap-2 sm:gap-0">
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
                    {updateVehicleMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Salvando...
                      </>
                    ) : (
                      <>Salvar Alterações</>
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      )}
    </AdminLayout>
  );
}