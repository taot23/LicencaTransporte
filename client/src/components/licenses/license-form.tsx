import { useEffect, useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { VehicleForm } from "@/components/vehicles/vehicle-form";

// Função para formatar entrada numérica removendo caracteres inválidos
function formatNumericInput(value: string, maxDigits: number = 6): string {
  // Remove todos os caracteres que não são dígitos
  const numbersOnly = value.replace(/\D/g, '');
  
  // Limita ao número máximo de dígitos
  const limited = numbersOnly.slice(0, maxDigits);
  
  return limited;
}

// Esta função completa os zeros para o formato visual final (00,00)
function formatFinalValue(value: string): string {
  if (!value) return '';
  
  // Remover qualquer caractere que não seja número, vírgula ou ponto
  let cleanValue = value.replace(/[^\d.,]/g, '');
  
  // Substituir ponto por vírgula para padronização
  cleanValue = cleanValue.replace('.', ',');
  
  // Separar parte inteira e decimal
  const parts = cleanValue.split(',');
  const integerPart = parts[0] || '0';
  
  // Se não tem parte decimal, adicionar ,00
  if (parts.length === 1) {
    return integerPart + ',00';
  }
  
  // Se tem parte decimal, garantir que tenha 2 dígitos
  const decimalPart = parts[1].slice(0, 2).padEnd(2, '0');
  
  return integerPart + ',' + decimalPart;
}

function formatLengthInput(value: string, licenseType: string, cargoType?: string): { 
  displayValue: string; 
  numericValue: number; 
} {
  const cleanValue = formatNumericInput(value, 6);
  
  if (!cleanValue) {
    return { displayValue: '', numericValue: 0 };
  }
  
  const numericValue = parseInt(cleanValue);
  let formattedValue = '';
  
  if (licenseType === "carga_fracionada" && cargoType === "container") {
    // Para containers: formato 00,00 m (metros com 2 casas decimais)
    if (cleanValue.length <= 2) {
      formattedValue = cleanValue.padStart(2, '0') + ',00';
    } else {
      const integerPart = cleanValue.slice(0, -2);
      const decimalPart = cleanValue.slice(-2);
      formattedValue = integerPart + ',' + decimalPart;
    }
  } else {
    // Para outros tipos: formato 00,00 m (metros com 2 casas decimais)
    if (cleanValue.length <= 2) {
      formattedValue = cleanValue.padStart(2, '0') + ',00';
    } else {
      const integerPart = cleanValue.slice(0, -2);
      const decimalPart = cleanValue.slice(-2);
      formattedValue = integerPart + ',' + decimalPart;
    }
  }
  
  return {
    displayValue: formattedValue,
    numericValue: numericValue
  };
}

function formatWidthInput(value: string, licenseType: string, cargoType?: string): { 
  displayValue: string; 
  numericValue: number; 
} {
  const cleanValue = formatNumericInput(value, 4);
  
  if (!cleanValue) {
    return { displayValue: '', numericValue: 0 };
  }
  
  const numericValue = parseInt(cleanValue);
  let finalValue = '';
  
  if (licenseType === "carga_fracionada" && cargoType === "container") {
    // Para containers: formato 0,00 m (metros com 2 casas decimais)
    if (cleanValue.length === 1) {
      finalValue = '0,0' + cleanValue;
    } else if (cleanValue.length === 2) {
      finalValue = '0,' + cleanValue;
    } else if (cleanValue.length === 3) {
      finalValue = cleanValue.slice(0, 1) + ',' + cleanValue.slice(1);
    } else {
      finalValue = cleanValue.slice(0, 2) + ',' + cleanValue.slice(2, 4);
    }
  } else {
    // Para outros tipos: formato 0,00 m (metros com 2 casas decimais)
    if (cleanValue.length === 1) {
      finalValue = '0,0' + cleanValue;
    } else if (cleanValue.length === 2) {
      finalValue = '0,' + cleanValue;
    } else if (cleanValue.length === 3) {
      finalValue = cleanValue.slice(0, 1) + ',' + cleanValue.slice(1);
    } else {
      finalValue = cleanValue.slice(0, 2) + ',' + cleanValue.slice(2, 4);
    }
  }
  
  return {
    displayValue: finalValue,
    numericValue: numericValue
  };
}

function formatHeightInput(value: string, licenseType: string, cargoType?: string): { 
  displayValue: string; 
  numericValue: number; 
} {
  const cleanValue = formatNumericInput(value, 4);
  
  if (!cleanValue) {
    return { displayValue: '', numericValue: 0 };
  }
  
  const numericValue = parseInt(cleanValue);
  let finalValue = '';
  
  if (licenseType === "carga_fracionada" && cargoType === "container") {
    // Para containers: formato 0,00 m (metros com 2 casas decimais)
    if (cleanValue.length === 1) {
      finalValue = '0,0' + cleanValue;
    } else if (cleanValue.length === 2) {
      finalValue = '0,' + cleanValue;
    } else if (cleanValue.length === 3) {
      finalValue = cleanValue.slice(0, 1) + ',' + cleanValue.slice(1);
    } else {
      finalValue = cleanValue.slice(0, 2) + ',' + cleanValue.slice(2, 4);
    }
  } else {
    // Para outros tipos: formato 0,00 m (metros com 2 casas decimais)  
    if (cleanValue.length === 1) {
      finalValue = '0,0' + cleanValue;
    } else if (cleanValue.length === 2) {
      finalValue = '0,' + cleanValue;
    } else if (cleanValue.length === 3) {
      finalValue = cleanValue.slice(0, 1) + ',' + cleanValue.slice(1);
    } else {
      finalValue = cleanValue.slice(0, 2) + ',' + cleanValue.slice(2, 4);
    }
  }
  
  return {
    displayValue: finalValue,
    numericValue: numericValue
  };
}

interface LicenseFormProps {
  draft?: LicenseRequest | null;
  onComplete: () => void;
  onCancel: () => void;
  preSelectedTransporterId?: number | null;
}

export function LicenseForm({ draft, onComplete, onCancel, preSelectedTransporterId }: LicenseFormProps) {
  const { toast } = useToast();
  const [licenseType, setLicenseType] = useState<string>(draft?.type || "");
  const [placasAdicionais, setPlacasAdicionais] = useState<string[]>(draft?.additionalPlates ? JSON.parse(draft.additionalPlates) : []);
  const [showVehicleDialog, setShowVehicleDialog] = useState(false);
  const [showRequiredFieldsWarning, setShowRequiredFieldsWarning] = useState(false);

  // Fetch vehicles for the dropdown selectors
  const { data: vehicles, isLoading: isLoadingVehicles } = useQuery<Vehicle[]>({
    queryKey: ["/api/vehicles"],
  });
  
  // Fetch transporters linked to the user
  const { data: transporters = [], isLoading: isLoadingTransporters } = useQuery<Transporter[]>({
    queryKey: ["/api/user/transporters"],
  });

  // Debug: mostrar transportadores carregados
  console.log("🔍 [DEBUG] Transportadores carregados:", transporters);
  console.log("🔍 [DEBUG] Quantidade de transportadores:", transporters?.length || 0);

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

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      type: draft?.type || "",
      transporterId: preSelectedTransporterId || draft?.transporterId || null,
      originState: draft?.originState || "",
      destinationState: draft?.destinationState || "",
      route: draft?.route || "",
      cargoDescription: draft?.cargoDescription || "",
      cargoType: draft?.cargoType || "",
      cargoWeight: draft?.cargoWeight || "",
      cargoLength: draft?.cargoLength || "",
      cargoWidth: draft?.cargoWidth || "",
      cargoHeight: draft?.cargoHeight || "",
      mainVehicleId: draft?.mainVehicleId || null,
      trailerVehicleId: draft?.trailerVehicleId || null,
      dollyVehicleId: draft?.dollyVehicleId || null,
      additionalPlates: draft?.additionalPlates || "[]",
      isDraft: draft?.isDraft || false,
    },
  });

  const createLicenseMutation = useMutation({
    mutationFn: async (data: z.infer<typeof formSchema>) => {
      return apiRequest("/api/licenses", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      toast({
        title: "Sucesso",
        description: "Licença criada com sucesso!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/licenses"] });
      onComplete();
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao criar licença",
        variant: "destructive",
      });
    },
  });

  const updateLicenseMutation = useMutation({
    mutationFn: async (data: z.infer<typeof formSchema>) => {
      return apiRequest(`/api/licenses/${draft?.id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      toast({
        title: "Sucesso",
        description: "Licença atualizada com sucesso!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/licenses"] });
      onComplete();
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao atualizar licença",
        variant: "destructive",
      });
    },
  });

  const saveDraftMutation = useMutation({
    mutationFn: async (data: z.infer<typeof insertDraftLicenseSchema>) => {
      const draftData = { ...data, isDraft: true };
      if (draft?.id) {
        return apiRequest(`/api/licenses/${draft.id}`, {
          method: "PATCH",
          body: JSON.stringify(draftData),
        });
      } else {
        return apiRequest("/api/licenses", {
          method: "POST",
          body: JSON.stringify(draftData),
        });
      }
    },
    onSuccess: () => {
      toast({
        title: "Rascunho salvo",
        description: "Suas alterações foram salvas automaticamente!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/licenses"] });
    },
    onError: (error: Error) => {
      console.error("Erro ao salvar rascunho:", error);
    },
  });

  // Auto-save draft logic
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout>();
  const watchedValues = form.watch();

  useEffect(() => {
    // Clear existing timeout
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    // Don't auto-save if form is empty or if it's not a draft
    const hasAnyValue = Object.values(watchedValues).some(value => 
      value !== "" && value !== null && value !== undefined
    );

    if (!hasAnyValue) return;

    // Set new timeout for auto-save
    autoSaveTimeoutRef.current = setTimeout(() => {
      const formData = form.getValues();
      const draftData = {
        ...formData,
        additionalPlates: JSON.stringify(placasAdicionais),
        isDraft: true,
      };

      // Only save if we have at least a type selected
      if (draftData.type) {
        saveDraftMutation.mutate(draftData);
      }
    }, 3000); // Auto-save after 3 seconds of inactivity

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [watchedValues, placasAdicionais, saveDraftMutation, form]);

  const onSubmit = (data: z.infer<typeof formSchema>) => {
    const finalData = {
      ...data,
      additionalPlates: JSON.stringify(placasAdicionais),
      isDraft: false,
    };

    if (draft?.id) {
      updateLicenseMutation.mutate(finalData);
    } else {
      createLicenseMutation.mutate(finalData);
    }
  };

  const handleSaveDraft = () => {
    const formData = form.getValues();
    const draftData = {
      ...formData,
      additionalPlates: JSON.stringify(placasAdicionais),
      isDraft: true,
    };
    saveDraftMutation.mutate(draftData);
  };

  // Check if required fields are filled for the specific license type
  const checkRequiredFields = () => {
    const values = form.getValues();
    const requiredFields: (keyof typeof values)[] = ["type", "transporterId", "originState", "destinationState", "route", "cargoDescription"];
    
    if (values.type === "carga_fracionada") {
      requiredFields.push("cargoType");
    }
    
    const missingFields = requiredFields.filter(field => !values[field]);
    return missingFields.length === 0;
  };

  const handleSubmitWithValidation = () => {
    if (!checkRequiredFields()) {
      setShowRequiredFieldsWarning(true);
      setTimeout(() => setShowRequiredFieldsWarning(false), 5000);
      return;
    }
    form.handleSubmit(onSubmit)();
  };

  // Show loading if transporters are still loading
  if (isLoadingTransporters) {
    return (
      <div className="flex items-center justify-center p-8">
        <LoaderCircle className="h-8 w-8 animate-spin" />
        <span className="ml-2">Carregando transportadores...</span>
      </div>
    );
  }

  // Show message if no transporters are found
  if (!transporters || transporters.length === 0) {
    return (
      <div className="p-6 text-center">
        <Building2 className="h-12 w-12 mx-auto mb-4 text-gray-400" />
        <h3 className="text-lg font-semibold mb-2">Nenhum transportador encontrado</h3>
        <p className="text-gray-600 mb-4">
          Você precisa estar vinculado a um transportador para solicitar licenças AET.
        </p>
        <p className="text-sm text-gray-500">
          Entre em contato com o administrador do sistema para vincular sua conta a um transportador.
        </p>
        <Button onClick={onCancel} variant="outline" className="mt-4">
          Voltar
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {showRequiredFieldsWarning && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
          <div className="flex">
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">
                Campos obrigatórios não preenchidos
              </h3>
              <div className="mt-2 text-sm text-yellow-700">
                <p>Por favor, preencha todos os campos obrigatórios antes de enviar a solicitação.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de Licença *</FormLabel>
                  <Select
                    onValueChange={(value) => {
                      field.onChange(value);
                      setLicenseType(value);
                    }}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o tipo" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {licenseTypeEnum.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type === "carga_fracionada" ? "Carga Fracionada" : 
                           type === "carga_indivisivel" ? "Carga Indivisível" :
                           type === "carga_perigosa" ? "Carga Perigosa" : type}
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
              name="transporterId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Transportador *</FormLabel>
                  <Select
                    onValueChange={(value) => field.onChange(parseInt(value))}
                    value={field.value?.toString()}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o transportador" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {transporters.map((transporter) => (
                        <SelectItem key={transporter.id} value={transporter.id.toString()}>
                          {transporter.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              control={form.control}
              name="originState"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Estado de Origem *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o estado" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {brazilianStates.map((state) => (
                        <SelectItem key={state.value} value={state.value}>
                          {state.label}
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
              name="destinationState"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Estado de Destino *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o estado" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {brazilianStates.map((state) => (
                        <SelectItem key={state.value} value={state.value}>
                          {state.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="route"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Rota *</FormLabel>
                <FormControl>
                  <Textarea 
                    placeholder="Descreva a rota detalhadamente..."
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              control={form.control}
              name="cargoDescription"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição da Carga *</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Descreva a carga..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {licenseType === "carga_fracionada" && (
              <FormField
                control={form.control}
                name="cargoType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de Carga *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ""}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o tipo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="container">Container</SelectItem>
                        <SelectItem value="carga_geral">Carga Geral</SelectItem>
                        <SelectItem value="graneis">Granéis</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <FormField
              control={form.control}
              name="cargoWeight"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Peso (kg)</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="0"
                      {...field}
                      onChange={(e) => {
                        const formatted = formatNumericInput(e.target.value, 8);
                        field.onChange(formatted);
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="cargoLength"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Comprimento (m)</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="00,00"
                      value={field.value ? formatLengthInput(field.value, licenseType, form.watch("cargoType")).displayValue : ""}
                      onChange={(e) => {
                        const { numericValue } = formatLengthInput(e.target.value, licenseType, form.watch("cargoType"));
                        field.onChange(numericValue.toString());
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="cargoWidth"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Largura (m)</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="0,00"
                      value={field.value ? formatWidthInput(field.value, licenseType, form.watch("cargoType")).displayValue : ""}
                      onChange={(e) => {
                        const { numericValue } = formatWidthInput(e.target.value, licenseType, form.watch("cargoType"));
                        field.onChange(numericValue.toString());
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="cargoHeight"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Altura (m)</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="0,00"
                      value={field.value ? formatHeightInput(field.value, licenseType, form.watch("cargoType")).displayValue : ""}
                      onChange={(e) => {
                        const { numericValue } = formatHeightInput(e.target.value, licenseType, form.watch("cargoType"));
                        field.onChange(numericValue.toString());
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Vehicle Selection Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium">Veículos</h3>
              <Dialog open={showVehicleDialog} onOpenChange={setShowVehicleDialog}>
                <DialogTrigger asChild>
                  <Button type="button" variant="outline" size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Cadastrar Veículo
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Cadastrar Novo Veículo</DialogTitle>
                    <DialogDescription>
                      Adicione um novo veículo ao sistema
                    </DialogDescription>
                  </DialogHeader>
                  <VehicleForm 
                    onComplete={() => {
                      setShowVehicleDialog(false);
                      queryClient.invalidateQueries({ queryKey: ["/api/vehicles"] });
                    }} 
                    onCancel={() => setShowVehicleDialog(false)}
                  />
                </DialogContent>
              </Dialog>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="mainVehicleId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Veículo Principal</FormLabel>
                    <Select
                      onValueChange={(value) => field.onChange(parseInt(value))}
                      value={field.value?.toString()}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o veículo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {[...tractorUnits, ...trucks].map((vehicle) => (
                          <SelectItem key={vehicle.id} value={vehicle.id.toString()}>
                            {vehicle.plate} - {vehicle.brand} {vehicle.model}
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
                name="trailerVehicleId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reboque/Semirreboque</FormLabel>
                    <Select
                      onValueChange={(value) => field.onChange(parseInt(value))}
                      value={field.value?.toString()}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o reboque" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="">Nenhum</SelectItem>
                        {[...semiTrailers, ...trailers, ...flatbeds].map((vehicle) => (
                          <SelectItem key={vehicle.id} value={vehicle.id.toString()}>
                            {vehicle.plate} - {vehicle.brand} {vehicle.model}
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
                name="dollyVehicleId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Dolly</FormLabel>
                    <Select
                      onValueChange={(value) => field.onChange(parseInt(value))}
                      value={field.value?.toString()}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o dolly" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="">Nenhum</SelectItem>
                        {dollys.map((vehicle) => (
                          <SelectItem key={vehicle.id} value={vehicle.id.toString()}>
                            {vehicle.plate} - {vehicle.brand} {vehicle.model}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          {/* Additional Plates */}
          <CampoPlacaAdicional 
            placas={placasAdicionais}
            onChange={setPlacasAdicionais}
          />

          <div className="flex justify-end space-x-4 pt-6">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancelar
            </Button>
            <Button 
              type="button" 
              variant="secondary" 
              onClick={handleSaveDraft}
              disabled={saveDraftMutation.isPending}
            >
              {saveDraftMutation.isPending ? (
                <>
                  <LoaderCircle className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                "Salvar Rascunho"
              )}
            </Button>
            <Button 
              type="submit"
              disabled={createLicenseMutation.isPending || updateLicenseMutation.isPending}
              onClick={handleSubmitWithValidation}
            >
              {(createLicenseMutation.isPending || updateLicenseMutation.isPending) ? (
                <>
                  <LoaderCircle className="h-4 w-4 mr-2 animate-spin" />
                  Enviando...
                </>
              ) : draft?.id ? (
                "Atualizar Licença"
              ) : (
                "Solicitar AET"
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}