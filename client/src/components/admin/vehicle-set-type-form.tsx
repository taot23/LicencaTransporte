import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { VehicleSetType } from "@shared/vehicle-set-types";
import { Truck, Plus, X } from "lucide-react";
import { ImageUploader } from "./image-uploader";

const formSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  label: z.string().min(1, "Rótulo é obrigatório"),
  description: z.string().optional(),
  axleConfiguration: z.object({
    tractorAxles: z.number().min(0),
    firstTrailerAxles: z.number().min(0),
    secondTrailerAxles: z.number().min(0),
    totalAxles: z.number().min(0),
    requiresDolly: z.boolean(),
    isFlexible: z.boolean(),
  }),
  dimensionLimits: z.object({
    minLength: z.number().optional(),
    maxLength: z.number().optional(),
    maxWidth: z.number().optional(),
    maxHeight: z.number().optional(),
  }),
  vehicleTypes: z.object({
    tractor: z.array(z.string()),
    firstTrailer: z.array(z.string()),
    secondTrailer: z.array(z.string()).optional(),
    dolly: z.array(z.string()).optional(),
  }),
  imageUrl: z.string().optional(),
  isActive: z.boolean(),
});

type FormData = z.infer<typeof formSchema>;

interface VehicleSetTypeFormProps {
  vehicleSetType?: VehicleSetType | null;
  onClose: () => void;
  onSuccess: () => void;
}

const AVAILABLE_VEHICLE_TYPES = [
  "tractor_unit",
  "semi_trailer", 
  "flatbed",
  "dolly",
  "truck",
  "trailer",
];

export function VehicleSetTypeForm({ vehicleSetType, onClose, onSuccess }: VehicleSetTypeFormProps) {
  const isEditing = !!vehicleSetType;
  
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: vehicleSetType ? {
      name: vehicleSetType.name,
      label: vehicleSetType.label,
      description: vehicleSetType.description || "",
      axleConfiguration: vehicleSetType.axleConfiguration,
      dimensionLimits: vehicleSetType.dimensionLimits,
      vehicleTypes: vehicleSetType.vehicleTypes,
      imageUrl: vehicleSetType.imageUrl || "",
      isActive: vehicleSetType.isActive,
    } : {
      name: "",
      label: "",
      description: "",
      axleConfiguration: {
        tractorAxles: 2,
        firstTrailerAxles: 2,
        secondTrailerAxles: 0,
        totalAxles: 4,
        requiresDolly: false,
        isFlexible: false,
      },
      dimensionLimits: {
        minLength: undefined,
        maxLength: undefined,
        maxWidth: undefined,
        maxHeight: undefined,
      },
      vehicleTypes: {
        tractor: ["tractor_unit"],
        firstTrailer: ["semi_trailer"],
        secondTrailer: [],
        dolly: [],
      },
      imageUrl: "",
      isActive: true,
    }
  });

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const url = isEditing 
        ? `/api/admin/vehicle-set-types/${vehicleSetType.id}`
        : '/api/admin/vehicle-set-types';
      
      console.log('[MUTATION] Enviando para:', url, 'Dados:', data);
      
      const res = await fetch(url, {
        method: isEditing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      
      const result = await res.json();
      console.log('[MUTATION] Resposta:', result);
      
      if (!res.ok) {
        throw new Error(result.message || 'Erro ao salvar tipo de conjunto');
      }
      
      return result;
    },
    onSuccess: (result) => {
      console.log('[MUTATION] Sucesso:', result);
      onSuccess();
    },
    onError: (error) => {
      console.error('[MUTATION] Erro:', error);
    },
  });

  const onSubmit = (data: FormData) => {
    // Calcular total de eixos automaticamente se não for flexível
    if (!data.axleConfiguration.isFlexible) {
      data.axleConfiguration.totalAxles = 
        data.axleConfiguration.tractorAxles + 
        data.axleConfiguration.firstTrailerAxles + 
        data.axleConfiguration.secondTrailerAxles;
    } else {
      data.axleConfiguration.totalAxles = 0;
    }
    
    // Limpar valores undefined dos limites de dimensões
    if (data.dimensionLimits.minLength === undefined) delete data.dimensionLimits.minLength;
    if (data.dimensionLimits.maxLength === undefined) delete data.dimensionLimits.maxLength;
    if (data.dimensionLimits.maxWidth === undefined) delete data.dimensionLimits.maxWidth;
    if (data.dimensionLimits.maxHeight === undefined) delete data.dimensionLimits.maxHeight;
    
    console.log('[VEHICLE SET TYPE FORM] Enviando dados:', data);
    mutation.mutate(data);
  };

  const isFlexible = form.watch("axleConfiguration.isFlexible");

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            {isEditing ? "Editar Tipo de Conjunto" : "Novo Tipo de Conjunto"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Informações Básicas */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Informações Básicas</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome (ID)</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="bitrain_8_axles" />
                        </FormControl>
                        <FormDescription>
                          Identificador único usado no sistema
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="label"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Rótulo</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Bitrem 8 eixos" />
                        </FormControl>
                        <FormDescription>
                          Nome exibido para os usuários
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Descrição</FormLabel>
                        <FormControl>
                          <Textarea {...field} placeholder="Descrição do tipo de conjunto" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Upload de Imagem */}
                  <FormField
                    control={form.control}
                    name="imageUrl"
                    render={({ field }) => (
                      <FormItem>
                        <ImageUploader
                          value={field.value}
                          onChange={field.onChange}
                        />
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="isActive"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                        <div className="space-y-0.5">
                          <FormLabel>Ativo</FormLabel>
                          <FormDescription>
                            Se este tipo estará disponível para seleção
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              {/* Configuração de Eixos */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Configuração de Eixos</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="axleConfiguration.isFlexible"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                        <div className="space-y-0.5">
                          <FormLabel>Validação Flexível</FormLabel>
                          <FormDescription>
                            Se marcado, não haverá restrições específicas de eixos
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  {!isFlexible && (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="axleConfiguration.tractorAxles"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Eixos do Cavalo</FormLabel>
                              <FormControl>
                                <Input 
                                  type="number" 
                                  {...field} 
                                  onChange={e => field.onChange(Number(e.target.value))}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="axleConfiguration.firstTrailerAxles"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Eixos 1ª Carreta</FormLabel>
                              <FormControl>
                                <Input 
                                  type="number" 
                                  {...field} 
                                  onChange={e => field.onChange(Number(e.target.value))}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={form.control}
                        name="axleConfiguration.secondTrailerAxles"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Eixos 2ª Carreta</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                {...field} 
                                onChange={e => field.onChange(Number(e.target.value))}
                              />
                            </FormControl>
                            <FormDescription>
                              Use 0 se não houver segunda carreta
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="axleConfiguration.requiresDolly"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                            <div className="space-y-0.5">
                              <FormLabel>Requer Dolly</FormLabel>
                              <FormDescription>
                                Se este tipo de conjunto precisa de dolly
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch checked={field.value} onCheckedChange={field.onChange} />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      {/* Resumo dos Eixos */}
                      <div className="bg-blue-50 p-3 rounded-lg">
                        <div className="text-sm font-medium text-blue-800">
                          Total de Eixos: {
                            form.watch("axleConfiguration.tractorAxles") + 
                            form.watch("axleConfiguration.firstTrailerAxles") + 
                            form.watch("axleConfiguration.secondTrailerAxles")
                          }
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Limites de Dimensões */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Limites de Dimensões</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <FormField
                    control={form.control}
                    name="dimensionLimits.minLength"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Comprimento Mín (m)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="0.1"
                            {...field} 
                            onChange={e => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="dimensionLimits.maxLength"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Comprimento Máx (m)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="0.1"
                            {...field} 
                            onChange={e => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="dimensionLimits.maxWidth"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Largura Máx (m)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="0.1"
                            {...field} 
                            onChange={e => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="dimensionLimits.maxHeight"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Altura Máx (m)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="0.1"
                            {...field} 
                            onChange={e => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Ações */}
            <div className="flex gap-3 justify-end">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? "Salvando..." : isEditing ? "Atualizar" : "Criar"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}