import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  insertLicenseRequestSchema, 
  insertDraftLicenseSchema, 
  brazilianStates, 
  Vehicle,
  LicenseRequest,
  Transporter,
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
import { LoaderCircle } from "lucide-react";
import { VehicleTypeImage } from "@/components/ui/vehicle-type-image";

interface LicenseFormProps {
  draft?: LicenseRequest | null;
  onComplete: () => void;
  onCancel: () => void;
  preSelectedTransporterId?: number | null;
}

export function LicenseForm({ draft, onComplete, onCancel, preSelectedTransporterId }: LicenseFormProps) {
  const { toast } = useToast();
  const [licenseType, setLicenseType] = useState<string>(draft?.type || "");

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
  const semiTrailers = vehicles?.filter(v => v.type === "semi_trailer") || [];

  // Define a schema that can be validated partially (for drafts)
  const formSchema = draft?.isDraft 
    ? insertDraftLicenseSchema 
    : insertLicenseRequestSchema;

  // Form setup
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: draft ? {
      type: draft.type,
      transporterId: draft.transporterId || undefined,
      mainVehiclePlate: draft.mainVehiclePlate,
      tractorUnitId: draft.tractorUnitId || undefined,
      firstTrailerId: draft.firstTrailerId || undefined,
      length: draft.length / 100, // Convert from cm to meters for display
      states: draft.states,
      isDraft: draft.isDraft,
      comments: draft.comments || undefined,
    } : {
      type: "",
      transporterId: preSelectedTransporterId || undefined,
      mainVehiclePlate: "",
      tractorUnitId: undefined,
      firstTrailerId: undefined,
      length: 0,
      states: [],
      isDraft: true,
      comments: "",
    },
  });

  // Watch for type changes
  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (name === "type") {
        setLicenseType(value.type as string);
      }
    });
    
    return () => subscription.unsubscribe();
  }, [form]);

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
    // Adjust length from meters to centimeters for storage
    const dataToSubmit = {
      ...values,
      length: Math.round((values.length || 0) * 100), // Convert to centimeters
    };
    
    if (values.isDraft) {
      saveAsDraftMutation.mutate(dataToSubmit as any);
    } else {
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

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="transporterId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Transportador</FormLabel>
              <Select 
                onValueChange={(value) => field.onChange(parseInt(value))} 
                defaultValue={field.value?.toString()}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o transportador" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {isLoadingTransporters ? (
                    <SelectItem value="loading">Carregando transportadores...</SelectItem>
                  ) : transporters.length > 0 ? (
                    transporters.map((transporter) => (
                      <SelectItem key={transporter.id} value={transporter.id.toString()}>
                        {transporter.name} {transporter.documentNumber ? `- ${transporter.documentNumber}` : ''}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="no_transporter">Nenhum transportador vinculado</SelectItem>
                  )}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tipo de Conjunto</FormLabel>
              <div className="flex flex-col space-y-3">
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um tipo" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="roadtrain_9_axles">Rodotrem 9 eixos</SelectItem>
                    <SelectItem value="bitrain_9_axles">Bitrem 9 eixos</SelectItem>
                    <SelectItem value="bitrain_7_axles">Bitrem 7 eixos</SelectItem>
                    <SelectItem value="bitrain_6_axles">Bitrem 6 eixos</SelectItem>
                    <SelectItem value="flatbed">Prancha</SelectItem>
                    <SelectItem value="romeo_and_juliet">Romeu e Julieta</SelectItem>
                  </SelectContent>
                </Select>
                
                {licenseType && (
                  <div className="p-3 border rounded-md flex flex-col items-center">
                    <VehicleTypeImage type={licenseType} iconSize={100} />
                    <p className="text-sm text-muted-foreground mt-2">
                      {licenseType === 'roadtrain_9_axles' && 'Rodotrem 9 eixos'}
                      {licenseType === 'bitrain_9_axles' && 'Bitrem 9 eixos'}
                      {licenseType === 'bitrain_7_axles' && 'Bitrem 7 eixos'}
                      {licenseType === 'bitrain_6_axles' && 'Bitrem 6 eixos'}
                      {licenseType === 'flatbed' && 'Prancha'}
                      {licenseType === 'romeo_and_juliet' && 'Romeu e Julieta'}
                    </p>
                  </div>
                )}
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="tractorUnitId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Unidade Tratora</FormLabel>
              <Select 
                onValueChange={(value) => field.onChange(parseInt(value))} 
                defaultValue={field.value?.toString()}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a unidade tratora" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {isLoadingVehicles ? (
                    <SelectItem value="loading">Carregando...</SelectItem>
                  ) : tractorUnits.length > 0 ? (
                    tractorUnits.map((vehicle) => (
                      <SelectItem key={vehicle.id} value={vehicle.id.toString()}>
                        {vehicle.plate}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="no_tractor">Nenhuma unidade tratora cadastrada</SelectItem>
                  )}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="firstTrailerId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>1ª Carreta</FormLabel>
              <Select 
                onValueChange={(value) => field.onChange(parseInt(value))} 
                defaultValue={field.value?.toString()}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a 1ª carreta" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {isLoadingVehicles ? (
                    <SelectItem value="loading">Carregando...</SelectItem>
                  ) : semiTrailers.length > 0 ? (
                    semiTrailers.map((vehicle) => (
                      <SelectItem key={vehicle.id} value={vehicle.id.toString()}>
                        {vehicle.plate}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="no_trailer">Nenhuma carreta cadastrada</SelectItem>
                  )}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="length"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Comprimento (metros)</FormLabel>
              <FormControl>
                <Input 
                  type="text" 
                  placeholder="Ex.: 19,80" 
                  {...field}
                  value={
                    typeof field.value === 'number' 
                      ? field.value.toString().replace('.', ',') 
                      : field.value || ''
                  }
                  onChange={(e) => {
                    // Convert comma to dot for calculations
                    const numericValue = parseFloat(e.target.value.replace(',', '.'));
                    field.onChange(isNaN(numericValue) ? 0 : numericValue);
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="states"
          render={() => (
            <FormItem>
              <div className="mb-4">
                <FormLabel>Estados</FormLabel>
                <FormDescription>
                  Selecione os estados para os quais a licença será solicitada
                </FormDescription>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                {Object.entries(brazilianStates).map(([state, label]) => (
                  <FormField
                    key={state}
                    control={form.control}
                    name="states"
                    render={({ field }) => {
                      return (
                        <FormItem
                          key={state}
                          className="flex flex-row items-start space-x-3 space-y-0 p-2 border rounded-md"
                        >
                          <FormControl>
                            <Checkbox
                              checked={field.value?.includes(state)}
                              onCheckedChange={(checked) => {
                                return checked
                                  ? field.onChange([...field.value, state])
                                  : field.onChange(
                                      field.value?.filter(
                                        (value) => value !== state
                                      )
                                    );
                              }}
                            />
                          </FormControl>
                          <FormLabel className="font-normal">
                            {typeof label === 'string' ? label : state}
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

        <FormField
          control={form.control}
          name="comments"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Observações</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Insira aqui quaisquer observações relevantes para esta solicitação"
                  className="resize-y"
                  {...field}
                  value={field.value || ''}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex flex-col sm:flex-row justify-between items-center space-y-3 sm:space-y-0 sm:space-x-2 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isProcessing}
            className="w-full sm:w-auto order-3 sm:order-1"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleSaveDraft}
            disabled={isProcessing}
            className="border-yellow-500 text-yellow-500 hover:text-yellow-700 hover:bg-yellow-50 w-full sm:w-auto order-2"
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