import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { insertVehicleSchema, Vehicle } from "@shared/schema";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Constante para tipos de veículos
// Tipos de veículo disponíveis para cadastro
const VEHICLE_TYPES = {
  tractor_unit: "Unidade Tratora (Cavalo)",
  truck: "Caminhão", 
  semi_trailer: "Semirreboque",
  trailer: "Reboque",
  dolly: "Dolly",
  flatbed: "Prancha",
  crane: "Guindastes"
};

// Constante para tipos de carroceria
const BODY_TYPES = {
  open: "Aberta",
  dump: "Basculante",
  cattle: "Boiadeiro",
  sugar_cane: "Cana de Açúcar",
  container: "Container",
  closed: "Fechada",
  mechanical_operational: "Mecânico operacional",
  platform: "Plataforma",
  flatbed: "Prancha",
  car_carrier: "Prancha - Cegonha",
  extendable_flatbed: "Prancha Extensiva",
  dump_truck: "Rodo Caçamba",
  roll_on_roll_off: "Rollon Rollof",
  silo: "SILO",
  mobile_substation: "Subestação Móvel",
  tank: "Tanque",
  log_carrier: "Tran Toras",
  vtav: "VTAV"
};

// Esquema estendido para validação do formulário
const formSchema = insertVehicleSchema.extend({
  // PLACA - obrigatório
  plate: z.string()
    .min(1, "A placa é obrigatória")
    .refine(
      (value) => /^[A-Za-z]{3}\d[A-Za-z0-9]\d{2}$/.test(value.toUpperCase()), 
      { message: "Formato de placa inválido. Use o formato Mercosul (AAA1A11) ou antigo (AAA1111)." }
    ),
  // RENAVAM - obrigatório
  renavam: z.string()
    .min(1, "O RENAVAM é obrigatório"),
  // TIPO DE VEÍCULO - já é obrigatório por padrão
  type: z.string().min(1, "O tipo do veículo é obrigatório"),
  // MARCA - obrigatório
  brand: z.string()
    .min(1, "A marca do veículo é obrigatória"),
  // MODELO - obrigatório
  model: z.string()
    .min(1, "O modelo do veículo é obrigatório"),
  // QTD EIXO - obrigatório
  axleCount: z.coerce.number()
    .min(1, "A quantidade de eixos é obrigatória")
    .refine(value => value > 0, "A quantidade de eixos deve ser maior que zero")
    .or(z.string()),
  // TARA - obrigatório
  tare: z.coerce.number()
    .min(1, "O peso (TARA) é obrigatório")
    .refine(value => value > 0, "O peso deve ser maior que zero")
    .or(z.string()), 
  // ANO DE FABRICAÇÃO - obrigatório
  year: z.number()
    .min(1950, "O ano deve ser maior que 1950")
    .max(new Date().getFullYear() + 1, `O ano deve ser no máximo ${new Date().getFullYear() + 1}`)
    .refine(value => value > 0, "O ano de fabricação é obrigatório"),
  // Ano do CRLV
  crlvYear: z.number().default(new Date().getFullYear())
});

type VehicleFormValues = z.infer<typeof formSchema>;

interface VehicleFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (vehicle: Vehicle) => void;
  plateToEdit?: string;
}

export function VehicleFormModal({ 
  isOpen, 
  onClose, 
  onSuccess,
  plateToEdit 
}: VehicleFormModalProps) {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [selectedVehicleType, setSelectedVehicleType] = useState<string>('tractor_unit');
  
  // Removemos a busca automática de veículos existentes
  // conforme solicitado pelo cliente
  // O modal sempre abre vazio, sem preencher dados automaticamente
  const existingVehicle = undefined;
  const isLoadingVehicle = false;
  
  // Formulário
  const form = useForm<VehicleFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      plate: plateToEdit ? plateToEdit.toUpperCase() : '',
      brand: '',
      model: '',
      year: new Date().getFullYear(),
      type: 'tractor_unit',
      bodyType: '',
      renavam: '',
      tare: undefined, // Campo vazio para forçar preenchimento
      axleCount: undefined, // Campo vazio para forçar preenchimento
      crlvYear: new Date().getFullYear() // Ano CRLV padrão
    },
    mode: "onBlur", // Validar ao perder o foco
  });
  
  // Removemos a atualização automática do formulário
  // Conforme solicitado pelo cliente, o formulário deve sempre começar vazio
  // Exceto a placa quando informada
  
  // Mutação para salvar o veículo
  const saveMutation = useMutation({
    mutationFn: async (data: VehicleFormValues) => {
      try {
        // Como não estamos mais usando existingVehicle, sempre será um POST para novo veículo
        const endpoint = '/api/vehicles';
        const method = 'POST';
        
        console.log(`Enviando requisição ${method} para ${endpoint}`, data);
        
        const res = await apiRequest(method, endpoint, data);
        if (!res.ok) {
          const errorData = await res.json().catch(() => null);
          console.error('Erro na resposta da API:', errorData);
          throw new Error(errorData?.message || `Erro ao cadastrar o veículo.`);
        }
        return await res.json();
      } catch (error) {
        console.error('Erro ao enviar dados do veículo:', error);
        throw error;
      }
    },
    onSuccess: (savedVehicle: Vehicle) => {
      // Invalidar todas as queries relacionadas a veículos para garantir atualização
      queryClient.invalidateQueries({ queryKey: ['/api/vehicles'] });
      
      // Mostrar mensagem de sucesso
      toast({
        title: "Veículo cadastrado",
        description: `Placa ${savedVehicle.plate} cadastrada com sucesso!`,
      });
      
      // Chamar callback de sucesso se fornecido
      if (onSuccess) {
        onSuccess(savedVehicle);
      }
      
      // Limpar o formulário e fechar o modal
      form.reset();
      onClose();
    },
    onError: (error: Error) => {
      console.error('Erro na mutação:', error);
      toast({
        title: "Erro",
        description: `Não foi possível cadastrar o veículo: ${error.message}`,
        variant: "destructive",
      });
    },
    onSettled: () => {
      setIsSaving(false);
    }
  });

  const onSubmit = (data: VehicleFormValues) => {
    // Verificar todos os campos obrigatórios antes de salvar
    const camposObrigatorios = {
      plate: 'Placa',
      renavam: 'RENAVAM',
      type: 'Tipo de Veículo',
      brand: 'Marca',
      model: 'Modelo',
      axleCount: 'Quantidade de Eixos',
      tare: 'TARA',
      year: 'Ano de Fabricação'
    };
    
    const camposFaltantes = Object.entries(camposObrigatorios)
      .filter(([key, _]) => {
        const valor = data[key as keyof VehicleFormValues];
        return !valor || (typeof valor === 'number' && valor <= 0) || (typeof valor === 'string' && valor.trim() === '');
      })
      .map(([_, label]) => label);
    
    if (camposFaltantes.length > 0) {
      toast({
        title: "Campos obrigatórios",
        description: `Os seguintes campos são obrigatórios: ${camposFaltantes.join(', ')}`,
        variant: "destructive"
      });
      return; // Impede o envio se houver campos faltantes
    }
    
    setIsSaving(true);
    // Converte a placa para maiúsculas antes de salvar
    saveMutation.mutate({
      ...data,
      plate: data.plate.toUpperCase()
    });
  };
  
  // Mapear tipos de veículo para labels em português
  // Usar a constante global
  const vehicleTypeLabels = VEHICLE_TYPES;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md md:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl">
            Cadastrar Novo Veículo
          </DialogTitle>
          <DialogDescription>
            {plateToEdit 
              ? `Cadastrando novo veículo com placa ${plateToEdit}`
              : 'Preencha os dados do veículo para cadastrá-lo'
            }
          </DialogDescription>
          <div className="text-xs text-muted-foreground mt-1">
            Os campos marcados com <span className="text-red-500">*</span> são obrigatórios
          </div>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="plate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center">
                    Placa
                    <span className="text-red-500 ml-1">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input 
                      {...field} 
                      maxLength={7}
                      onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                      required
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="brand"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center">
                      Marca
                      <span className="text-red-500 ml-1">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input {...field} required />
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
                    <FormLabel className="flex items-center">
                      Modelo
                      <span className="text-red-500 ml-1">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input {...field} required />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="year"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center">
                      Ano de Fabricação
                      <span className="text-red-500 ml-1">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        type="number" 
                        min="1950"
                        max={new Date().getFullYear() + 1}
                        onChange={(e) => field.onChange(parseInt(e.target.value))}
                        required
                      />
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
                    <FormLabel className="flex items-center">
                      Tipo de Veículo
                      <span className="text-red-500 ml-1">*</span>
                    </FormLabel>
                    <Select 
                      value={field.value} 
                      onValueChange={(value) => {
                        console.log("Novo tipo de veículo selecionado:", value);
                        field.onChange(value);
                        setSelectedVehicleType(value);
                        
                        // Limpar campo carroceria se o novo tipo não for compatível
                        if (value !== "truck" && value !== "semi_trailer" && value !== "trailer") {
                          form.setValue("bodyType", "");
                        }
                      }}
                      required
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o tipo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(vehicleTypeLabels).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            {/* Campo de Tipo de Carroceria - só aparece para tipos compatíveis */}
            {(selectedVehicleType === "truck" || selectedVehicleType === "semi_trailer" || selectedVehicleType === "trailer") && (
              <FormField
                control={form.control}
                name="bodyType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center">
                      Tipo de Carroceria
                    </FormLabel>
                    <Select 
                      value={field.value} 
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o tipo de carroceria" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(BODY_TYPES).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="renavam"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center">
                    RENAVAM
                    <span className="text-red-500 ml-1">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input {...field} required />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="axleCount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center">
                      Quantidade de Eixos
                      <span className="text-red-500 ml-1">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        type="number" 
                        min="1"
                        onChange={(e) => {
                          const value = parseInt(e.target.value);
                          field.onChange(value && value > 0 ? value : '');
                        }}
                        required
                        placeholder="Mínimo 1"
                      />
                    </FormControl>
                    <FormMessage />
                    {field.value === 0 && (
                      <p className="text-xs text-red-500 mt-1">A quantidade de eixos não pode ser zero</p>
                    )}
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="tare"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center">
                      TARA (kg)
                      <span className="text-red-500 ml-1">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        type="number" 
                        min="1"
                        onChange={(e) => {
                          const value = parseInt(e.target.value);
                          field.onChange(value && value > 0 ? value : '');
                        }}
                        required
                        placeholder="Mínimo 1"
                      />
                    </FormControl>
                    <FormMessage />
                    {field.value === 0 && (
                      <p className="text-xs text-red-500 mt-1">O peso (TARA) não pode ser zero</p>
                    )}
                  </FormItem>
                )}
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="crlvYear"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ano do CRLV</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        type="number" 
                        min="1950"
                        max={new Date().getFullYear() + 1}
                        onChange={(e) => field.onChange(parseInt(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
                
              <FormField
                control={form.control}
                name="remarks"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Observações</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <DialogFooter className="mt-6">
              <Button 
                type="button" 
                variant="outline" 
                onClick={onClose}
                disabled={isSaving}
              >
                Cancelar
              </Button>
              <Button 
                type="submit"
                disabled={isSaving}
              >
                {isSaving ? 'Salvando...' : 'Cadastrar Veículo'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}