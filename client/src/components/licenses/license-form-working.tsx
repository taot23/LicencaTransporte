import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { LoaderCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useLicenseValidation } from "@/hooks/use-license-validation";
import { LicenseConflictModal } from "@/components/licenses/license-conflict-modal";
import type { LicenseConflict } from "@/hooks/use-license-validation";

// Schema de validação
const formSchema = z.object({
  type: z.string().min(1, "Tipo é obrigatório"),
  transporterId: z.number().min(1, "Transportador é obrigatório"),
  mainVehiclePlate: z.string().min(1, "Placa principal é obrigatória"),
  tractorUnitId: z.number().optional(),
  firstTrailerId: z.number().optional(),
  secondTrailerId: z.number().optional(),
  dollyId: z.number().optional(),
  flatbedId: z.number().optional(),
  length: z.number().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  additionalPlates: z.array(z.string()).default([]),
  states: z.array(z.string()).min(1, "Selecione pelo menos um estado"),
  cargoType: z.string().optional(),
  isDraft: z.boolean().default(true),
  comments: z.string().optional(),
});

// Estados brasileiros
const brazilianStates = [
  { code: "AC", name: "Acre" },
  { code: "AL", name: "Alagoas" },
  { code: "AP", name: "Amapá" },
  { code: "AM", name: "Amazonas" },
  { code: "BA", name: "Bahia" },
  { code: "CE", name: "Ceará" },
  { code: "DF", name: "Distrito Federal" },
  { code: "ES", name: "Espírito Santo" },
  { code: "GO", name: "Goiás" },
  { code: "MA", name: "Maranhão" },
  { code: "MT", name: "Mato Grosso" },
  { code: "MS", name: "Mato Grosso do Sul" },
  { code: "MG", name: "Minas Gerais" },
  { code: "PA", name: "Pará" },
  { code: "PB", name: "Paraíba" },
  { code: "PR", name: "Paraná" },
  { code: "PE", name: "Pernambuco" },
  { code: "PI", name: "Piauí" },
  { code: "RJ", name: "Rio de Janeiro" },
  { code: "RN", name: "Rio Grande do Norte" },
  { code: "RS", name: "Rio Grande do Sul" },
  { code: "RO", name: "Rondônia" },
  { code: "RR", name: "Roraima" },
  { code: "SC", name: "Santa Catarina" },
  { code: "SP", name: "São Paulo" },
  { code: "SE", name: "Sergipe" },
  { code: "TO", name: "Tocantins" }
];

interface LicenseFormProps {
  draft?: any;
  preSelectedTransporterId?: number;
  onComplete: () => void;
  onCancel: () => void;
}

export function LicenseFormWorking({ draft, preSelectedTransporterId, onComplete, onCancel }: LicenseFormProps) {
  const queryClient = useQueryClient();
  const [licenseType, setLicenseType] = useState("");
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [licenseConflicts, setLicenseConflicts] = useState<LicenseConflict[]>([]);
  const { checkExistingLicenses } = useLicenseValidation();

  // Buscar transportadores
  const { data: transporters = [] } = useQuery({
    queryKey: ["/api/user/transporters"],
  });

  // Buscar veículos
  const { data: vehicles = [] } = useQuery({
    queryKey: ["/api/vehicles"],
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: draft ? {
      type: draft.type,
      transporterId: draft.transporterId,
      mainVehiclePlate: draft.mainVehiclePlate,
      tractorUnitId: draft.tractorUnitId || undefined,
      firstTrailerId: draft.firstTrailerId || undefined,
      dollyId: draft.dollyId || undefined,
      secondTrailerId: draft.secondTrailerId || undefined,
      flatbedId: draft.flatbedId || undefined,
      length: draft.length ? draft.length / 100 : undefined,
      width: draft.width ? draft.width / 100 : undefined,
      height: draft.height ? draft.height / 100 : undefined,
      additionalPlates: draft.additionalPlates || [],
      states: draft.states,
      isDraft: draft.isDraft,
      comments: draft.comments || undefined,
      cargoType: draft.cargoType || undefined,
    } : {
      type: "",
      transporterId: preSelectedTransporterId || 0,
      mainVehiclePlate: "",
      tractorUnitId: undefined,
      firstTrailerId: undefined,
      dollyId: undefined,
      secondTrailerId: undefined,
      flatbedId: undefined,
      length: undefined,
      width: undefined,
      height: undefined,
      additionalPlates: [],
      states: [],
      isDraft: true,
      comments: "",
      cargoType: undefined,
    },
  });

  // Mutation para salvar rascunho
  const saveAsDraftMutation = useMutation({
    mutationFn: async (data: any) => {
      const url = draft ? `/api/licenses/drafts/${draft.id}` : '/api/licenses/drafts';
      const method = draft ? "PUT" : "POST";
      const res = await apiRequest(method, url, data);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Rascunho salvo",
        description: "O rascunho foi salvo com sucesso",
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

  // Mutation para submeter licença
  const submitRequestMutation = useMutation({
    mutationFn: async (data: any) => {
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
    const dataToSubmit = {
      ...values,
      length: Math.round((values.length || 0) * 100),
      width: values.width ? Math.round(values.width * 100) : undefined,
      height: values.height ? Math.round(values.height * 100) : undefined,
    };
    
    if (values.isDraft) {
      saveAsDraftMutation.mutate(dataToSubmit);
    } else {
      const { isDraft, ...requestData } = dataToSubmit;
      submitRequestMutation.mutate(requestData);
    }
  };

  const handleSaveDraft = () => {
    form.setValue("isDraft", true);
    form.handleSubmit(onSubmit)();
  };

  const handleSubmitRequest = async () => {
    form.setValue("isDraft", false);
    
    // Validação inteligente individual por estado e emissão
    const formData = form.getValues();
    const estados = formData.states;
    
    // Coletar todas as placas para validação
    let placas = [];
    if (formData.mainVehiclePlate) {
      placas.push(formData.mainVehiclePlate);
    }
    if (formData.additionalPlates && formData.additionalPlates.length > 0) {
      placas.push(...formData.additionalPlates);
    }
    
    // Adicionar placas dos veículos selecionados
    if (formData.tractorUnitId && vehicles && Array.isArray(vehicles)) {
      const tractor = vehicles.find((v: any) => v.id === formData.tractorUnitId);
      if (tractor?.plate) placas.push(tractor.plate);
    }
    if (formData.firstTrailerId && vehicles && Array.isArray(vehicles)) {
      const trailer = vehicles.find((v: any) => v.id === formData.firstTrailerId);
      if (trailer?.plate) placas.push(trailer.plate);
    }
    if (formData.secondTrailerId && vehicles && Array.isArray(vehicles)) {
      const trailer = vehicles.find((v: any) => v.id === formData.secondTrailerId);
      if (trailer?.plate) placas.push(trailer.plate);
    }
    if (formData.dollyId && vehicles && Array.isArray(vehicles)) {
      const dolly = vehicles.find((v: any) => v.id === formData.dollyId);
      if (dolly?.plate) placas.push(dolly.plate);
    }
    if (formData.flatbedId && vehicles && Array.isArray(vehicles)) {
      const flatbed = vehicles.find((v: any) => v.id === formData.flatbedId);
      if (flatbed?.plate) placas.push(flatbed.plate);
    }
    
    console.log("[VALIDAÇÃO] Verificando conflitos antes da submissão:", { estados, placas });
    
    // Validar apenas se temos estados e placas
    if (estados && estados.length > 0 && placas.length > 0) {
      try {
        const validationResult = await checkExistingLicenses({ 
          placas: Array.from(new Set(placas)), // Remove duplicatas
          estados: estados || []
        });
        
        if (validationResult.conflitos && validationResult.conflitos.length > 0) {
          console.log("[VALIDAÇÃO] Conflitos encontrados:", validationResult.conflitos);
          setLicenseConflicts(validationResult.conflitos);
          setShowConflictModal(true);
          return; // Não submeter se há conflitos
        }
      } catch (error) {
        console.error("[VALIDAÇÃO] Erro na validação:", error);
        toast({
          title: "Erro na validação",
          description: "Não foi possível verificar licenças existentes. Tente novamente.",
          variant: "destructive",
        });
        return;
      }
    }
    
    // Se não há conflitos, proceder com a submissão
    form.handleSubmit(onSubmit)();
  };

  const isProcessing = saveAsDraftMutation.isPending || submitRequestMutation.isPending;

  // Watch for type changes
  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (name === "type") {
        setLicenseType(value.type as string);
      }
    });
    return () => subscription.unsubscribe();
  }, [form]);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Tipo de Licença */}
        <FormField
          control={form.control}
          name="type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tipo de Licença</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo de licença" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="bitrain_9_axles">Bitrem 9 Eixos</SelectItem>
                  <SelectItem value="truck_trailer">Cavalo + Reboque</SelectItem>
                  <SelectItem value="truck_semi_trailer">Cavalo + Semirreboque</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Transportador */}
        <FormField
          control={form.control}
          name="transporterId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Transportador</FormLabel>
              <Select onValueChange={(value) => field.onChange(Number(value))} defaultValue={field.value?.toString()}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o transportador" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {transporters?.map((transporter: any) => (
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

        {/* Placa Principal */}
        <FormField
          control={form.control}
          name="mainVehiclePlate"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Placa Principal</FormLabel>
              <FormControl>
                <Input placeholder="ABC1234" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Dimensões */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormField
            control={form.control}
            name="length"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Comprimento (m)</FormLabel>
                <FormControl>
                  <Input 
                    type="number" 
                    step="0.1" 
                    placeholder="26.0" 
                    {...field}
                    onChange={(e) => field.onChange(parseFloat(e.target.value) || undefined)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="width"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Largura (m)</FormLabel>
                <FormControl>
                  <Input 
                    type="number" 
                    step="0.1" 
                    placeholder="2.6" 
                    {...field}
                    onChange={(e) => field.onChange(parseFloat(e.target.value) || undefined)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="height"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Altura (m)</FormLabel>
                <FormControl>
                  <Input 
                    type="number" 
                    step="0.1" 
                    placeholder="4.4" 
                    {...field}
                    onChange={(e) => field.onChange(parseFloat(e.target.value) || undefined)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Estados */}
        <FormField
          control={form.control}
          name="states"
          render={() => (
            <FormItem>
              <div className="mb-4">
                <FormLabel className="text-base">Estados para Licenciamento</FormLabel>
                <FormDescription>
                  Selecione os estados onde a licença será válida
                </FormDescription>
              </div>
              <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                {brazilianStates.map((state) => (
                  <FormField
                    key={state.code}
                    control={form.control}
                    name="states"
                    render={({ field }) => {
                      return (
                        <FormItem
                          key={state.code}
                          className="flex flex-row items-start space-x-3 space-y-0"
                        >
                          <FormControl>
                            <Checkbox
                              checked={field.value?.includes(state.code)}
                              onCheckedChange={async (checked) => {
                                const currentStates = field.value || [];
                                if (checked) {
                                  const newStates = [...currentStates, state.code];
                                  
                                  // Validação individual por estado
                                  const formData = form.getValues();
                                  let allPlates = [];
                                  if (formData.mainVehiclePlate) allPlates.push(formData.mainVehiclePlate);
                                  if (formData.additionalPlates) allPlates.push(...formData.additionalPlates);
                                  
                                  if (allPlates.length > 0) {
                                    try {
                                      const validation = await checkExistingLicenses({
                                        placas: allPlates,
                                        estados: [state.code]
                                      });
                                      
                                      if (validation.conflitos && validation.conflitos.length > 0) {
                                        setLicenseConflicts(validation.conflitos);
                                        setShowConflictModal(true);
                                        return;
                                      }
                                    } catch (error) {
                                      console.error("[VALIDAÇÃO] Erro:", error);
                                    }
                                  }
                                  
                                  field.onChange(newStates);
                                } else {
                                  field.onChange(
                                    currentStates.filter((value) => value !== state.code)
                                  );
                                }
                              }}
                            />
                          </FormControl>
                          <FormLabel className="text-sm font-normal cursor-pointer">
                            {state.code}
                          </FormLabel>
                        </FormItem>
                      );
                    }}
                  />
                ))}
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Botões */}
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
      
      {/* Modal de conflitos de licenças */}
      <LicenseConflictModal
        isOpen={showConflictModal}
        onClose={() => setShowConflictModal(false)}
        conflicts={licenseConflicts}
      />
    </Form>
  );
}