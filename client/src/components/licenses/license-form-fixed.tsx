import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, X, AlertTriangle } from "lucide-react";
import { useLicenseValidation, type LicenseConflict } from "@/hooks/use-license-validation";
import { LicenseConflictModal } from "./license-conflict-modal";

// Schema básico para o formulário
const licenseFormSchema = z.object({
  transporterId: z.number().min(1, "Selecione um transportador"),
  type: z.string().min(1, "Selecione o tipo de licença"),
  states: z.array(z.string()).min(1, "Selecione pelo menos um estado"),
  mainVehiclePlate: z.string().min(1, "Placa principal é obrigatória"),
  additionalPlates: z.array(z.string()).optional(),
  length: z.coerce.number().min(1, "Comprimento é obrigatório"),
  width: z.coerce.number().min(1, "Largura é obrigatória"),
  height: z.coerce.number().min(1, "Altura é obrigatória"),
  weight: z.coerce.number().min(1, "Peso é obrigatório"),
  comments: z.string().optional(),
});

type LicenseFormValues = z.infer<typeof licenseFormSchema>;

interface LicenseFormProps {
  onSuccess?: () => void;
  draft?: any;
}

const brazilianStates = [
  { value: "AC", label: "Acre" },
  { value: "AL", label: "Alagoas" },
  { value: "AP", label: "Amapá" },
  { value: "AM", label: "Amazonas" },
  { value: "BA", label: "Bahia" },
  { value: "CE", label: "Ceará" },
  { value: "DF", label: "Distrito Federal" },
  { value: "ES", label: "Espírito Santo" },
  { value: "GO", label: "Goiás" },
  { value: "MA", label: "Maranhão" },
  { value: "MT", label: "Mato Grosso" },
  { value: "MS", label: "Mato Grosso do Sul" },
  { value: "MG", label: "Minas Gerais" },
  { value: "PA", label: "Pará" },
  { value: "PB", label: "Paraíba" },
  { value: "PR", label: "Paraná" },
  { value: "PE", label: "Pernambuco" },
  { value: "PI", label: "Piauí" },
  { value: "RJ", label: "Rio de Janeiro" },
  { value: "RN", label: "Rio Grande do Norte" },
  { value: "RS", label: "Rio Grande do Sul" },
  { value: "RO", label: "Rondônia" },
  { value: "RR", label: "Roraima" },
  { value: "SC", label: "Santa Catarina" },
  { value: "SP", label: "São Paulo" },
  { value: "SE", label: "Sergipe" },
  { value: "TO", label: "Tocantins" },
];

export function LicenseFormFixed({ onSuccess, draft }: LicenseFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [licenseConflicts, setLicenseConflicts] = useState<LicenseConflict[]>([]);
  
  // Hook para validação de licenças
  const { validateLicenses, isValidating } = useLicenseValidation();

  const form = useForm<LicenseFormValues>({
    resolver: zodResolver(licenseFormSchema),
    defaultValues: {
      transporterId: draft?.transporterId || 0,
      type: draft?.type || "",
      states: draft?.states || [],
      mainVehiclePlate: draft?.mainVehiclePlate || "",
      additionalPlates: draft?.additionalPlates || [],
      length: draft?.length || 0,
      width: draft?.width || 0,
      height: draft?.height || 0,
      weight: draft?.weight || 0,
      comments: draft?.comments || "",
    },
  });

  // Buscar transportadores
  const { data: transporters = [] } = useQuery({
    queryKey: ["/api/transporters"],
  });

  // Buscar veículos
  const { data: vehicles = [] } = useQuery({
    queryKey: ["/api/vehicles"],
  });

  // Mutação para criar licença
  const createLicenseMutation = useMutation({
    mutationFn: async (data: LicenseFormValues) => {
      const response = await fetch("/api/licenses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error("Erro ao criar licença");
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Sucesso",
        description: "Licença criada com sucesso!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/licenses"] });
      onSuccess?.();
    },
    onError: (error) => {
      toast({
        title: "Erro",
        description: `Erro ao criar licença: ${error.message}`,
        variant: "destructive",
      });
    },
  });

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
      console.error("Erro na validação:", error);
      return { hasConflicts: false, validStates: selectedStates };
    }
  };

  // Colettar todas as placas do formulário
  const getAllPlates = () => {
    const plates = [];
    const mainPlate = form.watch("mainVehiclePlate");
    const additionalPlates = form.watch("additionalPlates") || [];
    
    if (mainPlate) plates.push(mainPlate);
    plates.push(...additionalPlates);
    
    return plates.filter(plate => plate && plate.length > 0);
  };

  // Validar estados selecionados
  const handleStateSelection = async (selectedStates: string[]) => {
    const allPlates = getAllPlates();
    
    if (allPlates.length > 0 && selectedStates.length > 0) {
      await validateExistingLicenses(selectedStates, allPlates);
    }
  };

  const onSubmit = async (data: LicenseFormValues) => {
    // Validação final antes de enviar
    const allPlates = getAllPlates();
    const validationResult = await validateExistingLicenses(data.states, allPlates);
    
    if (validationResult.hasConflicts && validationResult.validStates.length === 0) {
      toast({
        title: "Não é possível prosseguir",
        description: "Todos os estados selecionados possuem licenças vigentes",
        variant: "destructive",
      });
      return;
    }

    // Usar apenas estados válidos
    const finalData = {
      ...data,
      states: validationResult.validStates,
    };

    createLicenseMutation.mutate(finalData);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Nova Solicitação de Licença AET</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Transportador */}
              <FormField
                control={form.control}
                name="transporterId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Transportador</FormLabel>
                    <Select
                      onValueChange={(value) => field.onChange(parseInt(value))}
                      value={field.value?.toString()}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um transportador" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {transporters.map((transporter: any) => (
                          <SelectItem key={transporter.id} value={transporter.id.toString()}>
                            {transporter.nomeRazaoSocial}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Tipo de Licença */}
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de Licença</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o tipo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="non_flatbed">Não Prancha</SelectItem>
                        <SelectItem value="flatbed">Prancha</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Estados */}
              <FormField
                control={form.control}
                name="states"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Estados de Circulação</FormLabel>
                    <div className="grid grid-cols-4 gap-2">
                      {brazilianStates.map((state) => (
                        <div key={state.value} className="flex items-center space-x-2">
                          <Checkbox
                            id={state.value}
                            checked={field.value?.includes(state.value)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                const newStates = [...(field.value || []), state.value];
                                field.onChange(newStates);
                                handleStateSelection(newStates);
                              } else {
                                const newStates = field.value?.filter((s) => s !== state.value) || [];
                                field.onChange(newStates);
                              }
                            }}
                          />
                          <label htmlFor={state.value} className="text-sm">
                            {state.value}
                          </label>
                        </div>
                      ))}
                    </div>
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
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a placa principal" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {vehicles.map((vehicle: any) => (
                          <SelectItem key={vehicle.id} value={vehicle.plate}>
                            {vehicle.plate} - {vehicle.brand} {vehicle.model}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Dimensões */}
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="length"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Comprimento (m)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" {...field} />
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
                        <Input type="number" step="0.01" {...field} />
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
                        <Input type="number" step="0.01" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="weight"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Peso (kg)</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Comentários */}
              <FormField
                control={form.control}
                name="comments"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Observações</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Observações sobre a licença..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Botões */}
              <div className="flex gap-4">
                <Button
                  type="submit"
                  disabled={createLicenseMutation.isPending || isValidating}
                  className="flex-1"
                >
                  {createLicenseMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Criando...
                    </>
                  ) : (
                    "Criar Licença"
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Modal de conflitos de licenças */}
      <LicenseConflictModal
        isOpen={showConflictModal}
        onClose={() => setShowConflictModal(false)}
        onProceed={(statesWithoutConflicts) => {
          form.setValue("states", statesWithoutConflicts);
          setShowConflictModal(false);
        }}
        conflicts={licenseConflicts}
        selectedStates={form.watch("states") || []}
      />
    </>
  );
}