import { useState } from "react";
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
  type InsertLicenseRequest,
  type InsertDraftLicense,
  type LicenseRequest,
  type Vehicle,
  type Transporter
} from "@shared/schema";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Save, Send, Plus, X } from "lucide-react";

interface LicenseFormProps {
  draft?: LicenseRequest | null;
  onComplete: () => void;
  onCancel: () => void;
  preSelectedTransporterId?: number | null;
}

const licenseFormSchema = insertLicenseRequestSchema.extend({
  additionalPlatesDocuments: insertLicenseRequestSchema.shape.additionalPlatesDocuments.optional()
});

const draftFormSchema = insertDraftLicenseSchema.extend({
  additionalPlatesDocuments: insertDraftLicenseSchema.shape.additionalPlatesDocuments.optional()
});

export function LicenseFormClean({ draft, onComplete, onCancel, preSelectedTransporterId }: LicenseFormProps) {
  const { toast } = useToast();
  const [additionalPlates, setAdditionalPlates] = useState<string[]>(draft?.additionalPlates || []);
  const [newPlate, setNewPlate] = useState("");

  // Query para buscar transportadores do usuário
  const { data: transporters = [] } = useQuery<Transporter[]>({
    queryKey: ["/api/user/transporters"]
  });

  // Query para buscar veículos do usuário
  const { data: vehicles = [] } = useQuery<Vehicle[]>({
    queryKey: ["/api/vehicles"]
  });

  const form = useForm<InsertLicenseRequest>({
    resolver: zodResolver(licenseFormSchema),
    defaultValues: {
      type: draft?.type || "bitrain_9_axles",
      transporterId: preSelectedTransporterId || draft?.transporterId || undefined,
      mainVehiclePlate: draft?.mainVehiclePlate || "",
      tractorUnitId: draft?.tractorUnitId || undefined,
      firstTrailerId: draft?.firstTrailerId || undefined,
      secondTrailerId: draft?.secondTrailerId || undefined,
      length: draft?.length || 2600,
      width: draft?.width || 260,
      height: draft?.height || 440,
      additionalPlates: draft?.additionalPlates || [],
      states: draft?.states || [],
      comments: draft?.comments || "",
      cargoType: draft?.cargoType || "general_cargo",
    },
  });

  // Mutação para enviar pedido de licença
  const submitRequestMutation = useMutation({
    mutationFn: async (data: InsertLicenseRequest) => {
      console.log("Enviando dados:", data);
      return apiRequest("/api/licenses", {
        method: "POST",
        body: JSON.stringify({ ...data, isDraft: false }),
      });
    },
    onSuccess: () => {
      toast({
        title: "Sucesso!",
        description: "Pedido de licença enviado com sucesso.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/licenses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/licenses/drafts"] });
      onComplete();
    },
    onError: (error: Error) => {
      console.error("Erro ao enviar pedido:", error);
      toast({
        title: "Erro",
        description: "Falha ao enviar pedido de licença.",
        variant: "destructive",
      });
    },
  });

  // Mutação para salvar como rascunho
  const saveAsDraftMutation = useMutation({
    mutationFn: async (data: InsertDraftLicense) => {
      const endpoint = draft ? `/api/licenses/drafts/${draft.id}` : "/api/licenses/drafts";
      const method = draft ? "PUT" : "POST";
      
      return apiRequest(endpoint, {
        method,
        body: JSON.stringify({ ...data, isDraft: true }),
      });
    },
    onSuccess: () => {
      toast({
        title: "Sucesso!",
        description: "Rascunho salvo com sucesso.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/licenses/drafts"] });
      onComplete();
    },
    onError: (error: Error) => {
      console.error("Erro ao salvar rascunho:", error);
      toast({
        title: "Erro",
        description: "Falha ao salvar rascunho.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InsertLicenseRequest) => {
    const finalData = {
      ...data,
      additionalPlates,
    };
    submitRequestMutation.mutate(finalData);
  };

  const onSaveAsDraft = () => {
    const data = form.getValues();
    const draftData: InsertDraftLicense = {
      ...data,
      additionalPlates,
    };
    saveAsDraftMutation.mutate(draftData);
  };

  const addPlate = () => {
    if (newPlate.trim() && !additionalPlates.includes(newPlate.trim())) {
      setAdditionalPlates([...additionalPlates, newPlate.trim()]);
      setNewPlate("");
    }
  };

  const removePlate = (plateToRemove: string) => {
    setAdditionalPlates(additionalPlates.filter(plate => plate !== plateToRemove));
  };

  // Filtrar veículos por tipo
  const getVehiclesByType = (type: string) => {
    return vehicles.filter(v => v.type === type);
  };

  // Coletar todas as placas para validação
  const getAllPlates = () => {
    const placas: string[] = [];
    
    // Placa principal
    const mainPlate = form.watch("mainVehiclePlate");
    if (mainPlate) placas.push(mainPlate);
    
    // Placas dos veículos selecionados
    const tractorId = form.watch("tractorUnitId");
    const firstTrailerId = form.watch("firstTrailerId");
    const secondTrailerId = form.watch("secondTrailerId");
    
    const tractor = vehicles.find(v => v.id === tractorId);
    const firstTrailer = vehicles.find(v => v.id === firstTrailerId);
    const secondTrailer = vehicles.find(v => v.id === secondTrailerId);
    
    if (tractor?.plate) placas.push(tractor.plate);
    if (firstTrailer?.plate) placas.push(firstTrailer.plate);
    if (secondTrailer?.plate) placas.push(secondTrailer.plate);
    
    // Placas adicionais
    placas.push(...additionalPlates);
    
    return placas.filter(Boolean);
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="outline" size="sm" onClick={onCancel}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
        <h1 className="text-2xl font-bold">
          {draft ? "Editar Rascunho" : "Nova Licença AET"}
        </h1>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Informações Básicas */}
          <Card>
            <CardHeader>
              <CardTitle>Informações Básicas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo de Conjunto</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o tipo" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="bitrain_9_axles">Bitrem 9 Eixos</SelectItem>
                          <SelectItem value="truck_trailer">Cavalo + Carreta</SelectItem>
                          <SelectItem value="truck_semi_trailer">Caminhão + Semi-reboque</SelectItem>
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
                      <FormLabel>Transportador</FormLabel>
                      <Select onValueChange={(value) => field.onChange(Number(value))} defaultValue={field.value?.toString()}>
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

              <FormField
                control={form.control}
                name="mainVehiclePlate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Placa Principal</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: ABC1234" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Seleção de Veículos */}
          <Card>
            <CardHeader>
              <CardTitle>Seleção de Veículos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="tractorUnitId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cavalo Mecânico</FormLabel>
                      <Select onValueChange={(value) => field.onChange(Number(value))} defaultValue={field.value?.toString()}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {getVehiclesByType("tractor_unit").map((vehicle) => (
                            <SelectItem key={vehicle.id} value={vehicle.id.toString()}>
                              {vehicle.plate} - {vehicle.brand}
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
                  name="firstTrailerId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Primeira Carreta</FormLabel>
                      <Select onValueChange={(value) => field.onChange(Number(value))} defaultValue={field.value?.toString()}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {getVehiclesByType("semi_trailer").map((vehicle) => (
                            <SelectItem key={vehicle.id} value={vehicle.id.toString()}>
                              {vehicle.plate} - {vehicle.brand}
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
                  name="secondTrailerId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Segunda Carreta</FormLabel>
                      <Select onValueChange={(value) => field.onChange(Number(value))} defaultValue={field.value?.toString()}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {getVehiclesByType("semi_trailer").map((vehicle) => (
                            <SelectItem key={vehicle.id} value={vehicle.id.toString()}>
                              {vehicle.plate} - {vehicle.brand}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Dimensões */}
          <Card>
            <CardHeader>
              <CardTitle>Dimensões</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="length"
                  render={({ field }) => (
                    <DimensionField
                      field={field}
                      label="Comprimento (cm)"
                      placeholder="2600"
                      description="Comprimento total do conjunto"
                      fieldType="comprimento"
                      licenseType={form.watch("type")}
                    />
                  )}
                />
                <FormField
                  control={form.control}
                  name="width"
                  render={({ field }) => (
                    <DimensionField
                      field={field}
                      label="Largura (cm)"
                      placeholder="260"
                      description="Largura máxima do conjunto"
                      fieldType="largura"
                      licenseType={form.watch("type")}
                    />
                  )}
                />
                <FormField
                  control={form.control}
                  name="height"
                  render={({ field }) => (
                    <DimensionField
                      field={field}
                      label="Altura (cm)"
                      placeholder="440"
                      description="Altura total do conjunto"
                      fieldType="altura"
                      licenseType={form.watch("type")}
                    />
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Estados de Circulação com Validação */}
          <Card>
            <CardHeader>
              <CardTitle>Estados de Circulação</CardTitle>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="states"
                render={({ field }) => (
                  <FormItem>
                    <StateSelectorWithValidation
                      selectedStates={field.value || []}
                      onStatesChange={(newStates) => field.onChange(newStates)}
                      placas={getAllPlates()}
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Placas Adicionais */}
          <Card>
            <CardHeader>
              <CardTitle>Placas Adicionais</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Ex: DEF5678"
                  value={newPlate}
                  onChange={(e) => setNewPlate(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), addPlate())}
                />
                <Button type="button" onClick={addPlate} size="sm">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              
              {additionalPlates.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {additionalPlates.map((plate, index) => (
                    <Badge key={index} variant="secondary" className="flex items-center gap-1">
                      {plate}
                      <X
                        className="h-3 w-3 cursor-pointer"
                        onClick={() => removePlate(plate)}
                      />
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Observações */}
          <Card>
            <CardHeader>
              <CardTitle>Observações</CardTitle>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="comments"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Textarea
                        placeholder="Informações adicionais..."
                        className="min-h-[100px]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Ações */}
          <div className="flex gap-4 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={onSaveAsDraft}
              disabled={saveAsDraftMutation.isPending}
            >
              <Save className="h-4 w-4 mr-2" />
              {saveAsDraftMutation.isPending ? "Salvando..." : "Salvar Rascunho"}
            </Button>
            
            <Button
              type="submit"
              disabled={submitRequestMutation.isPending}
            >
              <Send className="h-4 w-4 mr-2" />
              {submitRequestMutation.isPending ? "Enviando..." : "Enviar Pedido"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}