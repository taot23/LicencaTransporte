import { useEffect, useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { StateSelectorWithValidation } from './state-selector-with-validation';
import { DimensionField } from "./dimension-field";
import { 
  insertLicenseRequestSchema, 
  insertDraftLicenseSchema, 
  brazilianStates, 
  licenseTypeEnum,
  Vehicle,
  LicenseRequest,
  Transporter,
  insertVehicleSchema
} from "@shared/schema";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { CampoPlacaAdicional } from "./placas-adicionais";
import { VehicleSelectCard } from "./vehicle-select-card";
import { StateValidationSimple } from "./state-validation-simple";
import { 
  LoaderCircle,
  X, 
  Plus, 
  Truck, 
  Search, 
  Upload, 
  Building2, 
  Link as LinkIcon,
  FileUp,
  Check
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Link } from "wouter";
import { useOnClickOutside } from "@/hooks/use-on-click-outside";
import { VehicleTypeImage } from "@/components/ui/vehicle-type-image";
import { useLicenseValidation, type LicenseConflict } from "@/hooks/use-license-validation";
import { LicenseConflictModal } from "./license-conflict-modal";

// Tipos de carga por categoria
const NON_FLATBED_CARGO_TYPES = [
  { value: "dry_cargo", label: "Carga Seca" },
  { value: "liquid_cargo", label: "Líquida" },
  { value: "live_cargo", label: "Viva" },
  { value: "sugar_cane", label: "Cana de Açúcar" }
];

const FLATBED_CARGO_TYPES = [
  { value: "indivisible_cargo", label: "Carga Indivisível" },
  { value: "agricultural_machinery", label: "Máquinas Agrícolas" },
  { value: "oversized", label: "SUPERDIMENSIONADA" }
];

// Limites dimensionais
const DIMENSION_LIMITS = {
  default: {
    maxLength: 30.00,
    minLength: 19.80,
    maxWidth: 2.60,
    maxHeight: 4.40
  },
  flatbed: {
    maxLength: 25.00,
    minLength: 0,
    maxWidth: 3.20,
    maxHeight: 4.95
  },
  oversized: {
    // Sem limites pré-definidos
    maxLength: 999.99,
    minLength: 0,
    maxWidth: 999.99,
    maxHeight: 999.99
  }
};
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface LicenseFormProps {
  draft?: LicenseRequest | null;
  onComplete: () => void;
  onCancel: () => void;
  preSelectedTransporterId?: number | null;
}

export function LicenseForm({ draft, onComplete, onCancel, preSelectedTransporterId }: LicenseFormProps) {
  const { toast } = useToast();
  const [licenseType, setLicenseType] = useState<string>(draft?.type || "");
  const [cargoType, setCargoType] = useState<string>("");
  const [showVehicleDialog, setShowVehicleDialog] = useState(false);
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [licenseConflicts, setLicenseConflicts] = useState<LicenseConflict[]>([]);
  
  // Hook para validação de licenças
  const { validateLicenses, isValidating } = useLicenseValidation();

  // Função para validar licenças vigentes
  const validateExistingLicenses = async (selectedStates: string[], selectedPlates: string[]) => {
    if (selectedStates.length === 0 || selectedPlates.length === 0) {
      return { hasConflicts: false, validStates: selectedStates };
    }

    try {
      const result = await validateLicenses(selectedStates, selectedPlates);

      if (result.hasConflicts) {
        setLicenseConflicts(result.conflicts);
        setShowConflictModal(true);
        
        // Remover estados com conflitos da seleção
        const conflictStates = result.conflicts.map((c: LicenseConflict) => c.state);
        const validStates = selectedStates.filter(state => !conflictStates.includes(state));
        
        // Atualizar o formulário removendo estados conflitantes
        form.setValue("states", validStates);
        
        toast({
          title: "Licenças vigentes detectadas",
          description: `${conflictStates.length} estado(s) removido(s) por ter licenças ativas`,
          variant: "destructive",
        });
        
        return { hasConflicts: true, validStates };
      }
      
      return { hasConflicts: false, validStates: selectedStates };
    } catch (error) {
      console.error("Erro ao validar licenças:", error);
      toast({
        title: "Erro na validação",
        description: "Não foi possível verificar licenças existentes. Prosseguindo com a solicitação.",
        variant: "destructive",
      });
      return { hasConflicts: false, validStates: selectedStates };
    }
  };

  // Fetch vehicles for the dropdown selectors
  const { data: vehicles, isLoading: isLoadingVehicles } = useQuery<Vehicle[]>({
    queryKey: ["/api/vehicles"],
  });
  
  // Fetch transporters linked to the user
  const { data: transporters = [], isLoading: isLoadingTransporters } = useQuery<Transporter[]>({
    queryKey: ["/api/user/transporters"],
  });

  // Define filtered vehicle lists based on type
  const tractorUnits = vehicles?.filter(v => v.type === "tractor_unit") || [];
  const trucks = vehicles?.filter(v => v.type === "truck") || [];
  const semiTrailers = vehicles?.filter(v => v.type === "semi_trailer") || [];
  const trailers = vehicles?.filter(v => v.type === "trailer") || [];
  const dollys = vehicles?.filter(v => v.type === "dolly") || [];
  const flatbeds = vehicles?.filter(v => v.type === "flatbed") || [];

  // Define a schema that can be validated partially (for drafts)
  const formSchema = draft?.isDraft 
    ? insertDraftLicenseSchema 
    : insertLicenseRequestSchema;

  // Usar o transportador pré-selecionado quando disponível
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: draft ? {
      type: draft.type,
      transporterId: draft.transporterId || undefined,
      mainVehiclePlate: draft.mainVehiclePlate,
      tractorUnitId: draft.tractorUnitId || undefined,
      firstTrailerId: draft.firstTrailerId || undefined,
      dollyId: draft.dollyId || undefined,
      secondTrailerId: draft.secondTrailerId || undefined,
      flatbedId: draft.flatbedId || undefined,
      length: draft.length / 100, // Convert from cm to meters for display
      width: draft.width ? draft.width / 100 : undefined, // Convert from cm to meters for display
      height: draft.height ? draft.height / 100 : undefined, // Convert from cm to meters for display
      additionalPlates: draft.additionalPlates || [],
      additionalPlatesDocuments: draft.additionalPlatesDocuments || [],
      states: draft.states,
      isDraft: draft.isDraft,
      comments: draft.comments || undefined,
      cargoType: undefined, // Adicionado para support ao tipo de carga
    } : {
      type: "",
      transporterId: preSelectedTransporterId || undefined, // Usar o transportador pré-selecionado
      mainVehiclePlate: "",
      tractorUnitId: undefined,
      firstTrailerId: undefined,
      dollyId: undefined,
      secondTrailerId: undefined,
      flatbedId: undefined,
      length: undefined, // Valor não preenchido inicialmente
      width: undefined,
      height: undefined,
      additionalPlates: [],
      states: [],
      additionalPlatesDocuments: [],
      isDraft: true,
      comments: "",
      cargoType: undefined, // Adicionado para support ao tipo de carga
    },
  });

  // Efeito para mostrar notificação quando tiver transportador pré-selecionado
  useEffect(() => {
    if (preSelectedTransporterId && transporters && transporters.length > 0) {
      const selectedTransporter = transporters.find(t => t.id === preSelectedTransporterId);
      if (selectedTransporter) {
        toast({
          title: "Transportador selecionado",
          description: `Usando ${selectedTransporter.name} como transportador para esta solicitação`,
        });
      }
    }
  }, [preSelectedTransporterId, transporters, toast]);

  // Watch for type changes to conditionally render fields
  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (name === "type") {
        setLicenseType(value.type as string);
        
        // Reset cargo type when changing license type
        form.setValue("cargoType", undefined);
        setCargoType("");
      }
      
      if (name === "cargoType") {
        setCargoType(value.cargoType as string);
      }
      
      // Set main vehicle plate based on tractor unit selection
      if (name === "tractorUnitId" && value.tractorUnitId) {
        const selectedVehicle = vehicles?.find(v => v.id === value.tractorUnitId);
        if (selectedVehicle) {
          form.setValue("mainVehiclePlate", selectedVehicle.plate);
        }
      }
      
      // Apply dynamic validation based on license type and cargo type
      const currentType = value.type as string;
      const currentCargoType = value.cargoType as string;
      
      // Ajustar validações de dimensões com base no tipo de conjunto e carga
      if (currentType && (name === "type" || name === "cargoType" || name === "length" || name === "width" || name === "height")) {
        let limits = DIMENSION_LIMITS.default;
        
        if (currentType === 'flatbed') {
          limits = currentCargoType === 'oversized' 
            ? DIMENSION_LIMITS.oversized 
            : DIMENSION_LIMITS.flatbed;
        }
        
        // Aplicar validações de comprimento específicas
        if (currentType === 'flatbed' && currentCargoType === 'oversized') {
          // Sem limites para carga superdimensionada
          form.clearErrors('length');
          form.clearErrors('width');
          form.clearErrors('height');
        } else {
          // Verificar e validar dimensões atuais
          const currentLength = form.getValues('length');
          const currentWidth = form.getValues('width');
          const currentHeight = form.getValues('height');
          
          // Validar comprimento se estiver definido
          if (currentLength !== undefined) {
            if (currentType === 'flatbed') {
              // Para pranchas, a restrição de comprimento mínimo não se aplica
              if (currentLength > limits.maxLength) {
                form.setError('length', { 
                  type: 'manual', 
                  message: `O comprimento máximo para este tipo de conjunto é ${limits.maxLength.toFixed(2).replace('.', ',')} metros` 
                });
              } else {
                form.clearErrors('length');
              }
            } else {
              // Para outros tipos, validar tanto mínimo quanto máximo
              if (currentLength < limits.minLength) {
                form.setError('length', { 
                  type: 'manual', 
                  message: `O comprimento mínimo para este tipo de conjunto é ${limits.minLength.toFixed(2).replace('.', ',')} metros` 
                });
              } else if (currentLength > limits.maxLength) {
                form.setError('length', { 
                  type: 'manual', 
                  message: `O comprimento máximo para este tipo de conjunto é ${limits.maxLength.toFixed(2).replace('.', ',')} metros` 
                });
              } else {
                form.clearErrors('length');
              }
            }
          }
          
          // Validar largura se estiver definida
          if (currentWidth !== undefined) {
            if (currentWidth > limits.maxWidth) {
              form.setError('width', { 
                type: 'manual', 
                message: `A largura máxima para este tipo de conjunto é ${limits.maxWidth.toFixed(2).replace('.', ',')} metros` 
              });
            } else {
              form.clearErrors('width');
            }
          }
          
          // Validar altura se estiver definida
          if (currentHeight !== undefined) {
            if (currentHeight > limits.maxHeight) {
              form.setError('height', { 
                type: 'manual', 
                message: `A altura máxima para este tipo de conjunto é ${limits.maxHeight.toFixed(2).replace('.', ',')} metros` 
              });
            } else {
              form.clearErrors('height');
            }
          }
        }
        
        // Atualizar textos descritivos para as dimensões
        const lengthDesc = currentType === 'flatbed' && currentCargoType === 'oversized'
          ? 'Digite o comprimento em metros (sem limite para carga superdimensionada)'
          : currentType === 'flatbed'
            ? `Digite o comprimento em metros (max: ${limits.maxLength.toFixed(2).replace('.', ',')})`
            : `Digite o comprimento em metros (min: ${limits.minLength.toFixed(2).replace('.', ',')} - max: ${limits.maxLength.toFixed(2).replace('.', ',')})`;
            
        const widthDesc = currentType === 'flatbed' && currentCargoType === 'oversized'
          ? 'Informe a largura total do conjunto em metros (sem limite para carga superdimensionada)'
          : currentType === 'flatbed'
            ? `Informe a largura total do conjunto em metros (max: ${limits.maxWidth.toFixed(2).replace('.', ',')})`
            : `Informe a largura total do conjunto em metros (max: ${limits.maxWidth.toFixed(2).replace('.', ',')})`;
            
        const heightDesc = currentType === 'flatbed' && currentCargoType === 'oversized'
          ? 'Informe a altura total do conjunto em metros (sem limite para carga superdimensionada)'
          : currentType === 'flatbed'
            ? `Informe a altura total do conjunto em metros (max: ${limits.maxHeight.toFixed(2).replace('.', ',')})`
            : `Informe a altura total do conjunto em metros (max: ${limits.maxHeight.toFixed(2).replace('.', ',')})`;
      }
    });
    
    return () => subscription.unsubscribe();
  }, [form, vehicles]);

  // Handle form submissions
  const saveAsDraftMutation = useMutation({
    mutationFn: async (data: z.infer<typeof insertDraftLicenseSchema>) => {
      const url = draft ? `/api/licenses/drafts/${draft.id}` : '/api/licenses/drafts';
      const method = draft ? "PATCH" : "POST";
      const res = await apiRequest(method, url, data);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Rascunho salvo",
        description: "O rascunho da licença foi salvo com sucesso",
      });
      onComplete();
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message || "Não foi possível salvar o rascunho",
        variant: "destructive",
      });
    },
  });

  const submitRequestMutation = useMutation({
    mutationFn: async (data: z.infer<typeof insertLicenseRequestSchema>) => {
      const url = draft ? `/api/licenses/drafts/${draft.id}/submit` : '/api/licenses';
      const method = "POST";
      const res = await apiRequest(method, url, data);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Solicitação enviada",
        description: "A solicitação de licença foi enviada com sucesso",
      });
      onComplete();
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message || "Não foi possível enviar a solicitação",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    // Adjust dimensions from meters to centimeters for storage
    const dataToSubmit = {
      ...values,
      length: Math.round((values.length || 0) * 100), // Convert to centimeters
      width: values.width ? Math.round(values.width * 100) : undefined, // Convert to centimeters if exists
      height: values.height ? Math.round(values.height * 100) : undefined, // Convert to centimeters if exists
    };
    
    if (values.isDraft) {
      // Cast to appropriate types to satisfy TypeScript
      saveAsDraftMutation.mutate(dataToSubmit as any);
    } else {
      // Remove isDraft from payload when submitting a license request
      const { isDraft, ...requestData } = dataToSubmit;
      submitRequestMutation.mutate(requestData as any);
    }
  };

  const handleSaveDraft = () => {
    form.setValue("isDraft", true);
    form.handleSubmit(onSubmit)();
  };

  const handleSubmitRequest = () => {
    form.setValue("isDraft", false);
    form.handleSubmit(onSubmit)();
  };

  const isProcessing = saveAsDraftMutation.isPending || submitRequestMutation.isPending;

  // Mutation para criar um novo veículo
  const createVehicleMutation = useMutation({
    mutationFn: async (data: z.infer<typeof insertVehicleSchema>) => {
      const res = await apiRequest("POST", "/api/vehicles", data);
      return await res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Veículo cadastrado",
        description: "O veículo foi cadastrado com sucesso",
      });
      
      // Atualizar a lista de veículos
      queryClient.invalidateQueries({
        queryKey: ["/api/vehicles"]
      });
      
      setShowVehicleDialog(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message || "Não foi possível cadastrar o veículo",
        variant: "destructive",
      });
    },
  });
  
  // Formulário para cadastro de veículo
  const vehicleForm = useForm<z.infer<typeof insertVehicleSchema>>({
    resolver: zodResolver(insertVehicleSchema),
    defaultValues: {
      plate: "",
      type: "",
      brand: "",
      model: "",
      year: undefined,
      axleCount: undefined,
      renavam: "",
      remarks: ""
    }
  });
  
  const handleCreateVehicle = (data: z.infer<typeof insertVehicleSchema>) => {
    createVehicleMutation.mutate(data);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      
      <Dialog open={showVehicleDialog} onOpenChange={setShowVehicleDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Cadastrar Novo Veículo</DialogTitle>
            <DialogDescription>
              Preencha as informações do veículo para adicioná-lo ao sistema
            </DialogDescription>
          </DialogHeader>
          
          <Form {...vehicleForm}>
            <form onSubmit={vehicleForm.handleSubmit(handleCreateVehicle)} className="space-y-4">
              <FormField
                control={vehicleForm.control}
                name="plate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Placa</FormLabel>
                    <FormControl>
                      <Input placeholder="ABC-1234" {...field} className="uppercase" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={vehicleForm.control}
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
                        <SelectItem value="tractor_unit">Unidade Tratora (Cavalo)</SelectItem>
                        <SelectItem value="truck">Caminhão</SelectItem>
                        <SelectItem value="semi_trailer">Semirreboque</SelectItem>
                        <SelectItem value="trailer">Reboque</SelectItem>
                        <SelectItem value="dolly">Dolly</SelectItem>
                        <SelectItem value="flatbed">Prancha</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={vehicleForm.control}
                  name="brand"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Marca</FormLabel>
                      <FormControl>
                        <Input placeholder="Marca" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={vehicleForm.control}
                  name="model"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Modelo</FormLabel>
                      <FormControl>
                        <Input placeholder="Modelo" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={vehicleForm.control}
                  name="year"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ano</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          placeholder="2023" 
                          {...field}
                          value={field.value || ''} 
                          onChange={(e) => field.onChange(e.target.valueAsNumber)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={vehicleForm.control}
                  name="axleCount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Quantidade de Eixos</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          placeholder="2" 
                          {...field}
                          value={field.value || ''} 
                          onChange={(e) => field.onChange(e.target.valueAsNumber)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <FormField
                control={vehicleForm.control}
                name="renavam"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Renavam</FormLabel>
                    <FormControl>
                      <Input placeholder="Renavam" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={vehicleForm.control}
                name="remarks"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Observações</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Observações sobre o veículo..." 
                        className="resize-none" 
                        {...field} 
                        value={field.value || ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setShowVehicleDialog(false)}
                >
                  Cancelar
                </Button>
                <Button 
                  type="submit"
                  disabled={createVehicleMutation.isPending}
                >
                  {createVehicleMutation.isPending && (
                    <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Cadastrar Veículo
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
        <div className="border border-gray-200 rounded-lg p-5 shadow-sm">
          <h3 className="font-semibold text-gray-800 text-lg mb-4 flex items-center">
            <Building2 className="mr-2 h-5 w-5" />
            Dados do Transportador
          </h3>
          
          <div className="grid grid-cols-1 gap-4">
            <FormField
              control={form.control}
              name="transporterId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-base font-medium">Transportador</FormLabel>
                  <div className="relative">
                    <Select 
                      onValueChange={(value) => field.onChange(parseInt(value))} 
                      defaultValue={field.value?.toString()}
                    >
                      <FormControl>
                        <SelectTrigger className="h-10 pr-10">
                          <SelectValue placeholder="Buscar transportador..." />
                          <Search className="absolute right-3 top-2.5 h-5 w-5 text-muted-foreground" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {isLoadingTransporters ? (
                          <SelectItem value="loading">
                            <div className="flex items-center space-x-2">
                              <LoaderCircle className="h-4 w-4 animate-spin" />
                              <span>Carregando transportadores...</span>
                            </div>
                          </SelectItem>
                        ) : transporters.length > 0 ? (
                          transporters.map((transporter) => (
                            <SelectItem key={transporter.id} value={transporter.id.toString()}>
                              <div className="font-medium">{transporter.name}</div>
                              {transporter.documentNumber && (
                                <div className="text-xs text-muted-foreground">{transporter.documentNumber}</div>
                              )}
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem value="no_transporter">Nenhum transportador vinculado</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        <div className="border border-gray-200 rounded-lg p-5 shadow-sm">
          <h3 className="font-semibold text-gray-800 text-lg mb-4 flex items-center">
            <Truck className="mr-2 h-5 w-5" />
            Tipo de Conjunto
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-base font-medium">Tipo de Conjunto</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder="Selecione um tipo" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="roadtrain_9_axles">
                        <div className="flex items-center">
                          <VehicleTypeImage type="roadtrain_9_axles" className="mr-2" iconSize={24} />
                          <span>Rodotrem 9 eixos</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="bitrain_9_axles">
                        <div className="flex items-center">
                          <VehicleTypeImage type="bitrain_9_axles" className="mr-2" iconSize={24} />
                          <span>Bitrem 9 eixos</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="bitrain_7_axles">
                        <div className="flex items-center">
                          <VehicleTypeImage type="bitrain_7_axles" className="mr-2" iconSize={24} />
                          <span>Bitrem 7 eixos</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="bitrain_6_axles">
                        <div className="flex items-center">
                          <VehicleTypeImage type="bitrain_6_axles" className="mr-2" iconSize={24} />
                          <span>Bitrem 6 eixos</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="flatbed">
                        <div className="flex items-center">
                          <VehicleTypeImage type="flatbed" className="mr-2" iconSize={24} />
                          <span>Prancha</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="romeo_and_juliet">
                        <div className="flex items-center">
                          <VehicleTypeImage type="romeo_and_juliet" className="mr-2" iconSize={24} />
                          <span>Romeu e Julieta</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Campo de Tipo de Carga - varia conforme tipo de conjunto */}
            {licenseType && (
              <FormField
                control={form.control}
                name="cargoType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base font-medium">Tipo de Carga</FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger className="h-10">
                          <SelectValue placeholder="Selecione o tipo de carga" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {licenseType === 'flatbed' 
                          ? FLATBED_CARGO_TYPES.map(option => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))
                          : NON_FLATBED_CARGO_TYPES.map(option => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))
                        }
                      </SelectContent>
                    </Select>
                    <FormDescription className="text-xs text-muted-foreground mt-1">
                      {licenseType === 'flatbed' 
                        ? 'Selecione o tipo de carga para este conjunto de prancha'
                        : 'Selecione o tipo de carga para este conjunto'
                      }
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="length"
              render={({ field }) => (
                <DimensionField
                  field={field}
                  fieldType="comprimento"
                  label="Comprimento (metros)"
                  placeholder="Ex.: 19,80"
                  description={
                    licenseType === 'flatbed' && form.watch('cargoType') === 'oversized'
                      ? 'Digite o comprimento em metros (sem limite para carga superdimensionada)'
                      : licenseType === 'flatbed'
                        ? 'Digite o comprimento em metros (max: 25,00)'
                        : 'Digite o comprimento em metros (min: 19,80 - max: 30,00)'
                  }
                />
              )}
            />
            
            <FormField
              control={form.control}
              name="width"
              render={({ field }) => (
                <DimensionField
                  field={field}
                  fieldType="largura"
                  label="Largura do Conjunto (metros)"
                  placeholder="Ex.: 2,60"
                  description={
                    licenseType === 'flatbed' && form.watch('cargoType') === 'oversized'
                      ? 'Informe a largura total do conjunto em metros (sem limite para carga superdimensionada)'
                      : licenseType === 'flatbed'
                        ? 'Informe a largura total do conjunto em metros (max: 3,20)'
                        : 'Informe a largura total do conjunto em metros (max: 2,60)'
                  }
                />
              )}
            />
            
            <FormField
              control={form.control}
              name="height"
              render={({ field }) => (
                <DimensionField
                  field={field}
                  fieldType="altura"
                  label="Altura do Conjunto (metros)"
                  placeholder="Ex.: 4,40"
                  description={
                    licenseType === 'flatbed' && form.watch('cargoType') === 'oversized'
                      ? 'Informe a altura total do conjunto em metros (sem limite para carga superdimensionada)'
                      : licenseType === 'flatbed'
                        ? 'Informe a altura total do conjunto em metros (max: 4,95)'
                        : 'Informe a altura total do conjunto em metros (max: 4,40)'
                  }
                />
              )}
            />
          </div>
        </div>

        {/* Dynamic fields for Rodotrem 9 eixos */}
        {licenseType === 'roadtrain_9_axles' && (
          <div className="border border-gray-200 rounded-lg p-5 shadow-sm">
            <h3 className="font-semibold text-gray-800 text-lg mb-4 flex items-center">
              <VehicleTypeImage type="roadtrain_9_axles" className="mr-2" iconSize={32} />
              Composição Principal do Rodotrem
            </h3>
            
            {/* Unidade Tratora - Esta é a unidade principal que desbloqueia a linha de frente */}
            <div className="mb-6">
              <FormField
                control={form.control}
                name="tractorUnitId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-medium">Unidade Tratora (Cavalo Mecânico)</FormLabel>
                    <Select 
                      onValueChange={(value) => field.onChange(parseInt(value))} 
                      defaultValue={field.value?.toString()}
                    >
                      <FormControl>
                        <SelectTrigger className="h-10 bg-blue-50 border-blue-200">
                          <SelectValue placeholder="Selecione a unidade tratora" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {isLoadingVehicles ? (
                          <SelectItem value="loading">Carregando...</SelectItem>
                        ) : tractorUnits.length > 0 ? (
                          tractorUnits.map((vehicle) => (
                            <SelectItem key={vehicle.id} value={vehicle.id.toString()}>
                              {vehicle.plate} - {vehicle.brand} {vehicle.model}
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem value="no_tractor">Nenhum cavalo mecânico cadastrado</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    <FormDescription className="text-xs text-muted-foreground mt-1">
                      Esta é a unidade principal que irá puxar o conjunto
                    </FormDescription>
                      }}
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            {/* Linha de Frente - Com destaque visual como componente principal */}
            <div className="border border-red-300 rounded-md p-4 bg-red-50 mb-6">
              <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1 text-red-600" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                Linha de Frente (Componentes Principais)
              </h4>
              
              {/* Sequência lógica de componentes do Rodotrem */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="firstTrailerId"
                  render={({ field }) => (
                    <FormItem>
                      <VehicleSelectCard
                        title="1ª Carreta"
                        description="Primeiro semirreboque da composição"
                        value={field.value}
                        vehicleOptions={semiTrailers}
                        isLoading={isLoadingVehicles}
                        onChange={(value) => field.onChange(value)}
                        onAdd={() => setShowVehicleDialog(true)} 
                        requiredForProgress={true}
                        vehicleType="semi_trailer"
                        onEdit={(vehicle) => {
                          setShowVehicleDialog(true);
                        }}
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="dollyId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-medium">Dolly</FormLabel>
                      <Select 
                        onValueChange={(value) => field.onChange(parseInt(value))} 
                        defaultValue={field.value?.toString()}
                      >
                        <FormControl>
                          <SelectTrigger className="h-10 bg-yellow-50 border-yellow-200">
                            <SelectValue placeholder="Selecione o dolly" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {isLoadingVehicles ? (
                            <SelectItem value="loading">Carregando...</SelectItem>
                          ) : dollys.length > 0 ? (
                            dollys.map((vehicle) => (
                              <SelectItem key={vehicle.id} value={vehicle.id.toString()}>
                                {vehicle.plate} - {vehicle.brand} {vehicle.model}
                              </SelectItem>
                            ))
                          ) : (
                            <SelectItem value="no_dolly">Nenhum dolly cadastrado</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                      <FormDescription className="text-xs text-muted-foreground mt-1">
                        Dispositivo de acoplamento
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="secondTrailerId"
                  render={({ field }) => (
                    <FormItem>
                        title="2ª Carreta"
                        description="Segundo semirreboque da composição"
                        value={field.value}
                        vehicleOptions={semiTrailers}
                        isLoading={isLoadingVehicles}
                        onChange={(value) => field.onChange(value)}
                        onAdd={() => setShowVehicleDialog(true)} 
                        requiredForProgress={true}
                        vehicleType="semi_trailer"
                        onEdit={(vehicle) => {
                          setShowVehicleDialog(true);
                        }}
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
            
            {/* Resumo da composição */}
            <div className="bg-gray-50 p-3 rounded-md border border-gray-200">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Composição selecionada:</h4>
              <div className="flex flex-wrap gap-2">
                {form.watch("tractorUnitId") && (
                  <div className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-md flex items-center">
                    <Truck className="h-3 w-3 mr-1" />
                    Unidade Tratora: {
                      tractorUnits.find(v => v.id === form.watch("tractorUnitId"))?.plate || "Selecionado"
                    }
                  </div>
                )}
                {form.watch("firstTrailerId") && (
                  <div className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-md">
                    1ª Carreta: {
                      semiTrailers.find(v => v.id === form.watch("firstTrailerId"))?.plate || "Selecionado"
                    }
                  </div>
                )}
                {form.watch("dollyId") && (
                  <div className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-md">
                    Dolly: {
                      dollys.find((v) => v.id === form.watch("dollyId"))?.plate || "Selecionado"
                    }
                  </div>
                )}
                {form.watch("secondTrailerId") && (
                  <div className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded-md">
                    2ª Carreta: {
                      semiTrailers.find(v => v.id === form.watch("secondTrailerId"))?.plate || "Selecionado"
                    }
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Dynamic fields for Bitrem */}
        {(licenseType === 'bitrain_9_axles' || licenseType === 'bitrain_7_axles' || licenseType === 'bitrain_6_axles') && (
          <div className="border border-gray-200 rounded-lg p-5 shadow-sm">
            <h3 className="font-semibold text-gray-800 text-lg mb-4 flex items-center">
              {licenseType === 'bitrain_6_axles' ? (
                <VehicleTypeImage type="bitrain_6_axles" className="mr-2" iconSize={32} />
              ) : licenseType === 'bitrain_9_axles' ? (
                <VehicleTypeImage type="bitrain_9_axles" className="mr-2" iconSize={32} />
              ) : licenseType === 'bitrain_7_axles' ? (
                <VehicleTypeImage type="bitrain_7_axles" className="mr-2" iconSize={32} />
              ) : (
                <Truck className="mr-2 h-8 w-8" />
              )}
              Composição Principal do Bitrem
            </h3>
            
            {/* Unidade Tratora - Esta é a unidade principal que desbloqueia a linha de frente */}
            <div className="mb-6">
              <FormField
                control={form.control}
                name="tractorUnitId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-medium">Unidade Tratora (Cavalo Mecânico)</FormLabel>
                    <Select 
                      onValueChange={(value) => field.onChange(parseInt(value))} 
                      defaultValue={field.value?.toString()}
                    >
                      <FormControl>
                        <SelectTrigger className="h-10 bg-blue-50 border-blue-200">
                          <SelectValue placeholder="Selecione a unidade tratora" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {isLoadingVehicles ? (
                          <SelectItem value="loading">Carregando...</SelectItem>
                        ) : tractorUnits.length > 0 ? (
                          tractorUnits.map((vehicle) => (
                            <SelectItem key={vehicle.id} value={vehicle.id.toString()}>
                              {vehicle.plate} - {vehicle.brand} {vehicle.model}
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem value="no_tractor">Nenhum cavalo mecânico cadastrado</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    <FormDescription className="text-xs text-muted-foreground mt-1">
                      Esta é a unidade principal que irá puxar o conjunto
                    </FormDescription>
                      }}
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            {/* Linha de Frente - Com destaque visual como componente principal */}
            <div className="border border-red-300 rounded-md p-4 bg-red-50 mb-6">
              <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1 text-red-600" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                Linha de Frente (Componentes Principais)
              </h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="firstTrailerId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-medium">1ª Carreta</FormLabel>
                      <Select 
                        onValueChange={(value) => field.onChange(parseInt(value))} 
                        defaultValue={field.value?.toString()}
                      >
                        <FormControl>
                          <SelectTrigger className="h-10 bg-green-50 border-green-200">
                            <SelectValue placeholder="Selecione a 1ª carreta" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {isLoadingVehicles ? (
                            <SelectItem value="loading">Carregando...</SelectItem>
                          ) : semiTrailers.length > 0 ? (
                            semiTrailers.map((vehicle) => (
                              <SelectItem key={vehicle.id} value={vehicle.id.toString()}>
                                {vehicle.plate} - {vehicle.brand} {vehicle.model}
                              </SelectItem>
                            ))
                          ) : (
                            <SelectItem value="no_semi_trailer">Nenhum semirreboque cadastrado</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                      <FormDescription className="text-xs text-muted-foreground mt-1">
                        Selecione o primeiro semirreboque da composição
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="secondTrailerId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-medium">2ª Carreta</FormLabel>
                      <Select 
                        onValueChange={(value) => field.onChange(parseInt(value))} 
                        defaultValue={field.value?.toString()}
                      >
                        <FormControl>
                          <SelectTrigger className="h-10 bg-purple-50 border-purple-200">
                            <SelectValue placeholder="Selecione a 2ª carreta" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {isLoadingVehicles ? (
                            <SelectItem value="loading">Carregando...</SelectItem>
                          ) : semiTrailers.length > 0 ? (
                            semiTrailers.map((vehicle) => (
                              <SelectItem key={vehicle.id} value={vehicle.id.toString()}>
                                {vehicle.plate} - {vehicle.brand} {vehicle.model}
                              </SelectItem>
                            ))
                          ) : (
                            <SelectItem value="no_semi_trailer">Nenhum semirreboque cadastrado</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                      <FormDescription className="text-xs text-muted-foreground mt-1">
                        Selecione o segundo semirreboque da composição
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
            
            {/* Resumo da composição */}
            <div className="bg-gray-50 p-3 rounded-md border border-gray-200">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Composição selecionada:</h4>
              <div className="flex flex-wrap gap-2">
                {form.watch("tractorUnitId") && (
                  <div className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-md flex items-center">
                    <Truck className="h-3 w-3 mr-1" />
                    Unidade Tratora: {
                      tractorUnits.find(v => v.id === form.watch("tractorUnitId"))?.plate || "Selecionado"
                    }
                  </div>
                )}
                {form.watch("firstTrailerId") && (
                  <div className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-md">
                    1ª Carreta: {
                      semiTrailers.find(v => v.id === form.watch("firstTrailerId"))?.plate || "Selecionado"
                    }
                  </div>
                )}
                {form.watch("secondTrailerId") && (
                  <div className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded-md">
                    2ª Carreta: {
                      semiTrailers.find(v => v.id === form.watch("secondTrailerId"))?.plate || "Selecionado"
                    }
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Dynamic fields for Prancha */}
        {licenseType === 'flatbed' && (
          <div className="border border-gray-200 rounded-lg p-5 shadow-sm">
            <h3 className="font-semibold text-gray-800 text-lg mb-4 flex items-center">
              <VehicleTypeImage type="flatbed" className="mr-2" iconSize={32} />
              Composição Principal da Prancha
            </h3>
            
            {/* Unidade Tratora - Esta é a unidade principal que desbloqueia a linha de frente */}
            <div className="mb-6">
              <FormField
                control={form.control}
                name="tractorUnitId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-medium">Unidade Tratora (Cavalo Mecânico)</FormLabel>
                    <Select 
                      onValueChange={(value) => field.onChange(parseInt(value))} 
                      defaultValue={field.value?.toString()}
                    >
                      <FormControl>
                        <SelectTrigger className="h-10 bg-blue-50 border-blue-200">
                          <SelectValue placeholder="Selecione a unidade tratora" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {isLoadingVehicles ? (
                          <SelectItem value="loading">Carregando...</SelectItem>
                        ) : tractorUnits.length > 0 ? (
                          tractorUnits.map((vehicle) => (
                            <SelectItem key={vehicle.id} value={vehicle.id.toString()}>
                              {vehicle.plate} - {vehicle.brand} {vehicle.model}
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem value="no_tractor">Nenhum cavalo mecânico cadastrado</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    <FormDescription className="text-xs text-muted-foreground mt-1">
                      Esta é a unidade principal que irá puxar o conjunto
                    </FormDescription>
                      }}
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            {/* Linha de Frente - Com destaque visual como componente principal */}
            <div className="border border-red-300 rounded-md p-4 bg-red-50 mb-6">
              <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1 text-red-600" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                Linha de Frente (Componente Principal)
              </h4>
              
              <FormField
                control={form.control}
                name="flatbedId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-medium">Prancha</FormLabel>
                    <Select 
                      onValueChange={(value) => field.onChange(parseInt(value))} 
                      defaultValue={field.value?.toString()}
                    >
                      <FormControl>
                        <SelectTrigger className="h-10 bg-red-50 border-red-200">
                          <SelectValue placeholder="Selecione a prancha" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {isLoadingVehicles ? (
                          <SelectItem value="loading">Carregando...</SelectItem>
                        ) : flatbeds.length > 0 ? (
                          flatbeds.map((vehicle) => (
                            <SelectItem key={vehicle.id} value={vehicle.id.toString()}>
                              {vehicle.plate} - {vehicle.brand} {vehicle.model}
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem value="no_flatbed">Nenhuma prancha cadastrada</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    <FormDescription className="text-xs text-muted-foreground mt-1">
                      Veículo para transporte de cargas excepcionais
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            {/* Resumo da composição */}
            <div className="bg-gray-50 p-3 rounded-md border border-gray-200">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Composição selecionada:</h4>
              <div className="flex flex-wrap gap-2">
                {form.watch("tractorUnitId") && (
                  <div className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-md flex items-center">
                    <Truck className="h-3 w-3 mr-1" />
                    Unidade Tratora: {
                      tractorUnits.find(v => v.id === form.watch("tractorUnitId"))?.plate || "Selecionado"
                    }
                  </div>
                )}
                {form.watch("flatbedId") && (
                  <div className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-md">
                    Prancha: {
                      flatbeds.find(v => v.id === form.watch("flatbedId"))?.plate || "Selecionado"
                    }
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Dynamic fields for Romeo and Juliet */}
        {licenseType === 'romeo_and_juliet' && (
          <div className="border border-gray-200 rounded-lg p-5 shadow-sm">
            <h3 className="font-semibold text-gray-800 text-lg mb-4 flex items-center">
              <VehicleTypeImage type="romeo_and_juliet" className="mr-2" iconSize={32} />
              Composição Principal do Romeu e Julieta
            </h3>
            
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
              <p className="text-sm text-blue-800 flex items-center">
                <Check className="h-4 w-4 mr-2 flex-shrink-0" />
                Para o conjunto "Romeu e Julieta", a unidade tratora deve ser do tipo "Caminhão" e a 1ª carreta deve ser do tipo "Reboque".
              </p>
            </div>
            
            {/* Unidade Tratora - Esta é a unidade principal que desbloqueia a linha de frente */}
            <div className="mb-6">
              <FormField
                control={form.control}
                name="tractorUnitId"
                render={({ field }) => (
                  <FormItem>
                      title="Caminhão"
                      description="Unidade principal do Romeu e Julieta"
                      value={field.value}
                      vehicleOptions={trucks}
                      isLoading={isLoadingVehicles}
                      onChange={(value) => field.onChange(value)}
                      onAdd={() => setShowVehicleDialog(true)} 
                      requiredForProgress={true}
                      vehicleType="truck"
                      onEdit={(vehicle) => {
                        setShowVehicleDialog(true);
                      }}
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            {/* Linha de Frente - Com destaque visual como componente principal */}
            <div className="border border-red-300 rounded-md p-4 bg-red-50 mb-6">
              <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1 text-red-600" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                Reboque (Componente Principal)
              </h4>
              
              <FormField
                control={form.control}
                name="firstTrailerId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-medium">Reboque</FormLabel>
                    <Select 
                      onValueChange={(value) => field.onChange(parseInt(value))} 
                      defaultValue={field.value?.toString()}
                    >
                      <FormControl>
                        <SelectTrigger className="h-10 bg-amber-50 border-amber-200">
                          <SelectValue placeholder="Selecione o reboque" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {isLoadingVehicles ? (
                          <SelectItem value="loading">Carregando...</SelectItem>
                        ) : trailers.length > 0 ? (
                          trailers.map((vehicle) => (
                            <SelectItem key={vehicle.id} value={vehicle.id.toString()}>
                              {vehicle.plate} - {vehicle.brand} {vehicle.model}
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem value="no_trailer">Nenhum reboque cadastrado</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    <FormDescription className="text-xs text-muted-foreground mt-1">
                      Componente principal do Romeu e Julieta
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            {/* Resumo da composição */}
            <div className="bg-gray-50 p-3 rounded-md border border-gray-200">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Composição selecionada:</h4>
              <div className="flex flex-wrap gap-2">
                {form.watch("tractorUnitId") && (
                  <div className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-md flex items-center">
                    <Truck className="h-3 w-3 mr-1" />
                    Caminhão: {
                      trucks.find(v => v.id === form.watch("tractorUnitId"))?.plate || "Selecionado"
                    }
                  </div>
                )}
                {form.watch("firstTrailerId") && (
                  <div className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-md">
                    Reboque: {
                      trailers.find(v => v.id === form.watch("firstTrailerId"))?.plate || "Selecionado"
                    }
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="border border-gray-200 rounded-lg p-5 shadow-sm">
          <h3 className="font-semibold text-gray-800 text-lg mb-4 flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-gray-600" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="6" width="20" height="12" rx="2" ry="2"></rect>
              <path d="M2 13h20"></path>
            </svg>
            Placas Adicionais (Veículos Secundários)
          </h3>
          
          <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-md">
            <div className="flex items-start">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-gray-500 mt-0.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <path d="M12 16v-4"></path>
                <path d="M12 8h.01"></path>
              </svg>
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-1">Veículos Complementares</h4>
                <p className="text-xs text-gray-600">
                  Nesta seção você pode adicionar placas de veículos que fazem parte da composição 
                  mas não são considerados parte da linha de frente. Estes veículos complementam 
                  o conjunto principal selecionado acima.
                </p>
              </div>
            </div>
            
            <div className="mt-3 flex flex-wrap gap-2">
              {form.watch("tractorUnitId") && (
                <div className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-md flex items-center">
                  <Truck className="h-3 w-3 mr-1" />
                  Linha de frente já inclui: {
                    tractorUnits.find(v => v.id === form.watch("tractorUnitId"))?.plate || "Unidade tratora"
                  }
                </div>
              )}
              {form.watch("firstTrailerId") && (
                <div className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-md">
                  1ª Carreta já incluída
                </div>
              )}
              {form.watch("secondTrailerId") && (
                <div className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded-md">
                  2ª Carreta já incluída
                </div>
              )}
              {form.watch("dollyId") && (
                <div className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-md">
                  Dolly já incluído
                </div>
              )}
              {form.watch("flatbedId") && (
                <div className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-md">
                  Prancha já incluída
                </div>
              )}
            </div>
          </div>
          
          <div className="text-sm text-gray-700 mb-3 font-medium">
            <span className="flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1 text-gray-600" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 11 12 14 22 4"></polyline>
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
              </svg>
              Gerenciamento de Placas Adicionais
            </span>
          </div>
          
          {/* Componente de campo de placas adicionais com autopreenchimento */}
          <div className="border-dashed border-2 border-gray-300 rounded-md p-4 bg-gray-50">
            <CampoPlacaAdicional 
              form={form} 
              vehicles={vehicles} 
              isLoadingVehicles={isLoadingVehicles}
              licenseType={licenseType}
            />
          </div>
          
          {/* Total de veículos */}
          <div className="mt-4 flex justify-between items-center text-sm">
            <span className="text-gray-600">
              Tipo de conjunto: <span className="font-medium">{
                licenseType === 'bitrain_6_axles' ? 'Bitrem 6 Eixos' : 
                licenseType === 'bitrain_7_axles' ? 'Bitrem 7 Eixos' : 
                licenseType === 'bitrain_9_axles' ? 'Bitrem 9 Eixos' : 
                licenseType === 'roadtrain_9_axles' ? 'Rodotrem 9 Eixos' : 
                licenseType === 'flatbed' ? 'Prancha' : 
                licenseType === 'romeo_and_juliet' ? 'Romeu e Julieta' : 'Outro'
              }</span>
            </span>
            <span className="bg-gray-100 text-gray-800 px-2.5 py-1 rounded-md flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1 text-gray-600" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2z"></path>
                <path d="M10 22V4"></path>
                <path d="M15 4v18"></path>
              </svg>
              Total de Veículos: <span className="font-medium ml-1">{
                // Contabilizar principais + adicionais
                (form.watch("tractorUnitId") ? 1 : 0) + 
                (form.watch("firstTrailerId") ? 1 : 0) + 
                (form.watch("secondTrailerId") ? 1 : 0) + 
                (form.watch("dollyId") ? 1 : 0) + 
                (form.watch("flatbedId") ? 1 : 0) + 
                (form.watch("additionalPlates")?.length || 0)
              }</span>
            </span>
          </div>
        </div>

        <div className="border border-gray-200 rounded-lg p-5 shadow-sm">
          <h3 className="font-semibold text-gray-800 text-lg mb-4 flex items-center">
            <FileUp className="mr-2 h-5 w-5" />
            Documentos
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="bg-blue-50 p-4 rounded-md border border-blue-100">
              <h4 className="text-blue-700 font-medium mb-2 flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
                  <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
                  <polyline points="14 2 14 8 20 8"/>
                </svg>
                Documentação dos Veículos
              </h4>
              <p className="text-sm text-blue-600 mb-3">
                Os CRLVs dos veículos serão vinculados automaticamente a partir do cadastro de veículos.
                Caso não encontre algum veículo, cadastre-o clicando no +:
              </p>
              <div className="text-xs text-gray-500">
                Formatos aceitos: PDF, JPG, PNG
              </div>
            </div>

            <div className="bg-amber-50 p-4 rounded-md border border-amber-100">
              <h4 className="text-amber-700 font-medium mb-2 flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
                  <path d="M12 8v4l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"/>
                </svg>
                Tempo de Processamento
              </h4>
              <p className="text-sm text-amber-600 mb-3">
                Após o envio, a solicitação passará por análise do órgão competente.
                O prazo médio para análise varia de acordo com cada estado.
              </p>
              <div className="text-xs text-gray-500">
                Acompanhe o status na página "Acompanhar Licença"
              </div>
            </div>
          </div>
          
          <FormField
            control={form.control}
            name="comments"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-base font-medium">Observações</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Adicione observações relevantes para este pedido de licença..."
                    className="min-h-[120px] resize-y"
                    value={field.value as string || ""}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    name={field.name}
                    ref={field.ref}
                  />
                </FormControl>
                <FormDescription>
                  Inclua quaisquer informações adicionais importantes para a análise desta solicitação
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="states"
          render={({ field }) => {
            // Coletar placas dos veículos para validação
            const getPlacasParaValidacao = () => {
              const placas: any = {};
              
              console.log('[PLACAS-VALIDACAO] Iniciando coleta de placas...');
              console.log('[PLACAS-VALIDACAO] Vehicles disponíveis:', vehicles?.length || 0);
              
              // Placa do cavalo/trator
              const tractorId = form.watch("tractorUnitId");
              console.log('[PLACAS-VALIDACAO] TractorId:', tractorId);
              
              if (tractorId && vehicles) {
                const tractor = vehicles.find(v => v.id === tractorId);
                console.log('[PLACAS-VALIDACAO] Tractor encontrado:', tractor);
                if (tractor?.plate) {
                  placas.cavalo = tractor.plate;
                  console.log('[PLACAS-VALIDACAO] Placa do cavalo:', tractor.plate);
                }
              } else {
                const mainPlate = form.watch("mainVehiclePlate");
                console.log('[PLACAS-VALIDACAO] MainPlate fallback:', mainPlate);
                if (mainPlate) {
                  placas.cavalo = mainPlate;
                  console.log('[PLACAS-VALIDACAO] Usando mainPlate como cavalo:', mainPlate);
                }
              }
              
              // Primeira carreta
              const firstTrailerId = form.watch("firstTrailerId");
              console.log('[PLACAS-VALIDACAO] FirstTrailerId:', firstTrailerId);
              
              if (firstTrailerId && vehicles) {
                const firstTrailer = vehicles.find(v => v.id === firstTrailerId);
                console.log('[PLACAS-VALIDACAO] FirstTrailer encontrado:', firstTrailer);
                if (firstTrailer?.plate) {
                  placas.primeiraCarreta = firstTrailer.plate;
                  console.log('[PLACAS-VALIDACAO] Placa da primeira carreta:', firstTrailer.plate);
                }
              }
              
              // Segunda carreta
              const secondTrailerId = form.watch("secondTrailerId");
              console.log('[PLACAS-VALIDACAO] SecondTrailerId:', secondTrailerId);
              
              if (secondTrailerId && vehicles) {
                const secondTrailer = vehicles.find(v => v.id === secondTrailerId);
                console.log('[PLACAS-VALIDACAO] SecondTrailer encontrado:', secondTrailer);
                if (secondTrailer?.plate) {
                  placas.segundaCarreta = secondTrailer.plate;
                  console.log('[PLACAS-VALIDACAO] Placa da segunda carreta:', secondTrailer.plate);
                }
              }
              
              // Dolly
              const dollyId = form.watch("dollyId");
              console.log('[PLACAS-VALIDACAO] DollyId:', dollyId);
              
              if (dollyId && vehicles) {
                const dolly = vehicles.find(v => v.id === dollyId);
                console.log('[PLACAS-VALIDACAO] Dolly encontrado:', dolly);
                if (dolly?.plate) {
                  placas.dolly = dolly.plate;
                  console.log('[PLACAS-VALIDACAO] Placa do dolly:', dolly.plate);
                }
              }
              
              // Prancha
              const flatbedId = form.watch("flatbedId");
              console.log('[PLACAS-VALIDACAO] FlatbedId:', flatbedId);
              
              if (flatbedId && vehicles) {
                const flatbed = vehicles.find(v => v.id === flatbedId);
                console.log('[PLACAS-VALIDACAO] Flatbed encontrado:', flatbed);
                if (flatbed?.plate) {
                  placas.prancha = flatbed.plate;
                  console.log('[PLACAS-VALIDACAO] Placa da prancha:', flatbed.plate);
                }
              }
              
              // Reboque (usando firstTrailerId para romeu_julieta)
              const licenseType = form.watch("type");
              console.log('[PLACAS-VALIDACAO] LicenseType:', licenseType);
              
              if (licenseType === "romeu_julieta" && firstTrailerId && vehicles) {
                const reboque = vehicles.find(v => v.id === firstTrailerId);
                console.log('[PLACAS-VALIDACAO] Reboque encontrado:', reboque);
                if (reboque?.plate) {
                  placas.reboque = reboque.plate;
                  console.log('[PLACAS-VALIDACAO] Placa do reboque:', reboque.plate);
                }
              }
              
              console.log('[PLACAS-VALIDACAO] Placas coletadas final:', placas);
              return placas;
            };

            const placasColetadas = getPlacasParaValidacao();
            console.log('[FORM-PRINCIPAL] Placas enviadas para validação:', placasColetadas);
            
            // Preparar placas para validação
            const placasArray = Object.values(placasColetadas).filter(Boolean) as string[];

            return (
              <StateSelectorWithValidation
                selectedStates={field.value || []}
                onStatesChange={(newStates) => field.onChange(newStates)}
                placas={placasArray}
              />
            );
          }}
        />



        <div className="flex flex-col sm:flex-row justify-end gap-4 sm:space-x-4 pt-4">
          <Button 
            type="button" 
            variant="outline" 
            onClick={onCancel}
            className="w-full sm:w-auto order-3 sm:order-1"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleSaveDraft}
            disabled={isProcessing}
            className="w-full sm:w-auto order-2"
          >
            {saveAsDraftMutation.isPending && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
            Salvar Rascunho
          </Button>
          <Button
            type="button"
            onClick={handleSubmitRequest}
            disabled={isProcessing}
            className="bg-blue-600 hover:bg-blue-700 text-white w-full sm:w-auto order-1 sm:order-3"
          >
            {submitRequestMutation.isPending && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
            Enviar Pedido
          </Button>
        </div>
      </form>
    </Form>
  );
}
