import { useState, useEffect, useMemo, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { X, UploadCloud, LoaderCircle, Check, ChevronsUpDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

// Types
interface Vehicle {
  id?: number;
  plate: string;
  type: string;
  brand: string;
  model: string;
  year: number;
  renavam: string;
  tare: number;
  axleCount: number;
  bodyType?: string;
  crlvYear: number;
  status: string;
  remarks?: string;
  crlvUrl?: string;
  ownerName?: string;
  ownershipType: "proprio" | "terceiro";
}

interface VehicleModel {
  id: number;
  brand: string;
  model: string;
  vehicleType: string;
  createdAt: string;
}

interface VehicleFormProps {
  vehicle?: Vehicle | null;
  onSuccess: () => void;
  onCancel: () => void;
}

// Schema de validação com mensagens humanizadas
const vehicleSchema = z.object({
  plate: z.string()
    .min(1, "Por favor, informe a placa do veículo")
    .refine(val => {
      const cleanPlate = val.replace(/\s/g, '').toUpperCase();
      const oldFormat = /^[A-Z]{3}-?\d{4}$/;
      const mercosulFormat = /^[A-Z]{3}-?\d{1}[A-Z]{1}\d{2}$/;
      return oldFormat.test(cleanPlate) || mercosulFormat.test(cleanPlate);
    }, "Placa deve estar no formato ABC-1234 ou BRA2E19"),
  
  type: z.string().min(1, "Selecione o tipo de veículo (Unidade Tratora, Caminhão, etc.)"),
  
  brand: z.string().min(1, "Selecione a marca do veículo"),
  
  model: z.string().min(1, "Selecione o modelo do veículo"),
  
  year: z.number({
    required_error: "Informe o ano de fabricação",
    invalid_type_error: "Ano deve ser um número válido"
  }).min(1980, "Ano de fabricação deve ser a partir de 1980")
    .max(new Date().getFullYear() + 1, "Ano não pode ser futuro"),
    
  renavam: z.string()
    .min(1, "Informe o número do RENAVAM")
    .min(11, "RENAVAM deve ter 11 dígitos")
    .max(11, "RENAVAM deve ter 11 dígitos")
    .regex(/^\d+$/, "RENAVAM deve conter apenas números"),
    
  tare: z.union([z.number(), z.string()]).transform((val) => {
    if (typeof val === 'string') {
      const parsed = parseFloat(val.replace(',', '.'));
      if (isNaN(parsed)) return 0;
      return parsed;
    }
    return val;
  }).refine((val) => val > 0, "Informe a tara (peso vazio) do veículo"),
  
  axleCount: z.number({
    required_error: "Informe a quantidade de eixos",
    invalid_type_error: "Quantidade de eixos deve ser um número"
  }).min(1, "Veículo deve ter pelo menos 1 eixo")
    .max(10, "Quantidade de eixos não pode exceder 10"),
    
  bodyType: z.string().optional(),
  
  crlvYear: z.number({
    required_error: "Informe o ano do CRLV",
    invalid_type_error: "Ano do CRLV deve ser um número válido"
  }).min(1980, "Ano do CRLV deve ser a partir de 1980")
    .max(new Date().getFullYear(), "Ano do CRLV não pode ser futuro"),
    
  status: z.string().default("active"),
  remarks: z.string().optional(),
  ownerName: z.string().optional(),
  ownershipType: z.enum(["proprio", "terceiro"]).default("proprio"),
  cmt: z.number().optional(),
}).refine((data) => {
  // Validação condicional para tipo de carroceria
  if (["truck", "semi_trailer", "trailer"].includes(data.type) && !data.bodyType) {
    return false;
  }
  return true;
}, {
  message: "Selecione o tipo de carroceria para este veículo",
  path: ["bodyType"]
}).refine((data) => {
  // Validação condicional para CMT (unidade tratora)
  if (data.type === "tractor_unit" && (!data.cmt || data.cmt <= 0)) {
    return false;
  }
  return true;
}, {
  message: "Informe a Capacidade Máxima de Tração (CMT) para unidade tratora",
  path: ["cmt"]
});

type VehicleFormData = z.infer<typeof vehicleSchema>;

// Opções de tipos de veículos
const vehicleTypeOptions = [
  { value: "tractor_unit", label: "Unidade Tratora" },
  { value: "truck", label: "Caminhão" },
  { value: "semi_trailer", label: "Semirreboque" },
  { value: "trailer", label: "Reboque" },
  { value: "dolly", label: "Dolly" },
];

// Opções de tipos de carroceria
const bodyTypeOptions = [
  { value: "open", label: "Aberta" },
  { value: "dump", label: "Basculante" },
  { value: "cattle", label: "Boiadeiro" },
  { value: "sugar_cane", label: "Cana de Açúcar" },
  { value: "container", label: "Container" },
  { value: "closed", label: "Fechada" },
  { value: "mechanical_operational", label: "Mecânico operacional" },
  { value: "platform", label: "Plataforma" },
  { value: "flatbed", label: "Prancha" },
  { value: "car_carrier", label: "Prancha - Cegonha" },
  { value: "extendable_flatbed", label: "Prancha Extensiva" },
  { value: "dump_truck", label: "Rodo Caçamba" },
  { value: "roll_on_roll_off", label: "Rollon Rollof" },
  { value: "silo", label: "SILO" },
  { value: "mobile_substation", label: "Subestação Móvel" },
  { value: "tank", label: "Tanque" },
  { value: "log_carrier", label: "Tran Toras" },
  { value: "vtav", label: "VTAV" },
];

// Componente de busca inteligente para dropdowns
interface SearchableSelectProps {
  options: string[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder: string;
  disabled?: boolean;
  emptyMessage?: string;
}

function SearchableSelect({ options, value, onValueChange, placeholder, disabled, emptyMessage = "Nenhum resultado encontrado" }: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");

  // Função memoizada para normalizar string
  const normalizeString = useCallback((str: string) => {
    return str.normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  }, []);

  // Filtrar opções baseado na busca (memoizado para estabilidade)
  const filteredOptions = useMemo(() => {
    if (!searchValue) return options;
    const normalizedSearch = normalizeString(searchValue);
    return options.filter((option) => 
      normalizeString(option).includes(normalizedSearch)
    );
  }, [options, searchValue, normalizeString]);

  // Reset search quando fechar o popover
  useEffect(() => {
    if (!open) {
      setSearchValue("");
    }
  }, [open]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="h-10 w-full justify-between"
          disabled={disabled}
        >
          {value ? options.find((option) => option === value) : placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput 
            placeholder={`Buscar...`} 
            value={searchValue}
            onValueChange={setSearchValue}
          />
          <CommandList>
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            <CommandGroup>
              {filteredOptions.map((option) => (
                <CommandItem
                  key={option}
                  value={option}
                  onSelect={() => {
                    onValueChange(option === value ? "" : option);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === option ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {option}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function VehicleForm({ vehicle, onSuccess, onCancel }: VehicleFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedBrand, setSelectedBrand] = useState(vehicle?.brand || "");
  const [vehicleType, setVehicleType] = useState(vehicle?.type || "");
  const [plateDisplay, setPlateDisplay] = useState(vehicle?.plate || "");
  const [tareDisplay, setTareDisplay] = useState(vehicle?.tare ? vehicle.tare.toString() : "");
  const [file, setFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);


  const form = useForm<VehicleFormData>({
    resolver: zodResolver(vehicleSchema),
    defaultValues: {
      plate: vehicle?.plate || "",
      type: vehicle?.type || "",
      brand: vehicle?.brand || "",
      model: vehicle?.model || "",
      year: vehicle?.year || undefined,
      renavam: vehicle?.renavam || "",
      tare: vehicle?.tare || undefined,
      axleCount: vehicle?.axleCount || undefined,
      bodyType: vehicle?.bodyType || "",
      crlvYear: vehicle?.crlvYear || undefined,
      status: vehicle?.status || "active",
      remarks: vehicle?.remarks || "",
      ownerName: vehicle?.ownerName || "",
      ownershipType: vehicle?.ownershipType || undefined,
      cmt: undefined,
    },
  });

  // Sincronizar estados quando o vehicle prop muda (SEM dependência instável 'form')
  useEffect(() => {
    if (vehicle) {
      setSelectedBrand(vehicle.brand || "");
      setVehicleType(vehicle.type || "");
      setPlateDisplay(vehicle.plate || "");
      setTareDisplay(vehicle.tare ? vehicle.tare.toString() : "");
      
      // Resetar os valores do formulário APENAS quando vehicle muda
      form.reset({
        plate: vehicle.plate || "",
        type: vehicle.type || "",
        brand: vehicle.brand || "",
        model: vehicle.model || "",
        year: vehicle.year || undefined,
        renavam: vehicle.renavam || "",
        tare: vehicle.tare || undefined,
        axleCount: vehicle.axleCount || undefined,
        bodyType: vehicle.bodyType || "",
        crlvYear: vehicle.crlvYear || undefined,
        status: vehicle.status || "active",
        remarks: vehicle.remarks || "",
        ownerName: vehicle.ownerName || "",
        ownershipType: vehicle.ownershipType || undefined,
        cmt: (vehicle as any).cmt ? parseFloat((vehicle as any).cmt.toString()) : undefined,
      });
    }
  }, [vehicle]); // ← REMOVIDA dependência 'form' que causava loops

  // Query para buscar modelos de veículos
  const { data: vehicleModels = [] } = useQuery<VehicleModel[]>({
    queryKey: ['/api/vehicle-models'],
    staleTime: 5 * 60 * 1000,
  });

  // Função estável para validar placas brasileiras
  const validateBrazilianPlate = useCallback((plate: string): boolean => {
    const cleanPlate = plate.replace(/\s/g, '').toUpperCase();
    const oldFormat = /^[A-Z]{3}-?\d{4}$/;
    const mercosulFormat = /^[A-Z]{3}-?\d{1}[A-Z]{1}\d{2}$/;
    return oldFormat.test(cleanPlate) || mercosulFormat.test(cleanPlate);
  }, []);

  // Função estável para formatar placa
  const formatPlate = useCallback((value: string): string => {
    const clean = value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    if (clean.length <= 3) {
      return clean;
    } else if (clean.length <= 7) {
      const letters = clean.slice(0, 3);
      const numbers = clean.slice(3);
      if (numbers.length >= 2 && /\d/.test(numbers[0]) && /[A-Z]/.test(numbers[1])) {
        return letters + numbers;
      } else {
        return letters + (numbers ? '-' + numbers : '');
      }
    }
    return clean.slice(0, 7);
  }, []);

  // Funções estáveis para filtrar marcas e modelos (memoizadas para evitar re-renders)
  const getFilteredBrands = useCallback((type: string): string[] => {
    if (!type) return [];

    const allowedTypes = type === "tractor_unit" ? ["tractor_unit", "truck"] : 
                        type === "semi_trailer" ? ["semi_trailer", "trailer"] : [type];

    const filteredModels = vehicleModels.filter(model => 
      allowedTypes.includes(model.vehicleType)
    );

    return Array.from(new Set(filteredModels.map(model => model.brand))).sort();
  }, [vehicleModels]);

  const getFilteredModels = useCallback((brand: string, type: string): string[] => {
    if (!brand || !type) return [];

    const allowedTypes = type === "tractor_unit" ? ["tractor_unit", "truck"] : 
                        type === "semi_trailer" ? ["semi_trailer", "trailer"] : [type];

    return Array.from(new Set(
      vehicleModels
        .filter(model => 
          model.brand === brand && allowedTypes.includes(model.vehicleType)
        )
        .map(model => model.model)
    )).sort();
  }, [vehicleModels]);

  // Mutations
  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const response = await fetch("/api/vehicles", {
        method: "POST",
        body: data,
      });
      
      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(errorData || `Erro HTTP: ${response.status}`);
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      console.log('Veículo cadastrado com sucesso:', data);
      toast({ title: "Veículo cadastrado com sucesso!" });
      queryClient.invalidateQueries({ queryKey: ["/api/vehicles"] });
      onSuccess();
    },
    onError: (error: Error) => {
      console.error('Erro ao cadastrar veículo:', error);
      const humanizedMessage = humanizeErrorMessage(error.message || "Erro desconhecido");
      toast({
        title: "Não foi possível cadastrar o veículo",
        description: humanizedMessage,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const response = await fetch(`/api/vehicles/${vehicle?.id}`, {
        method: "PUT",
        body: data,
      });
      
      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(errorData || `Erro HTTP: ${response.status}`);
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      console.log('Veículo atualizado com sucesso:', data);
      toast({ title: "Veículo atualizado com sucesso!" });
      queryClient.invalidateQueries({ queryKey: ["/api/vehicles"] });
      onSuccess();
    },
    onError: (error: Error) => {
      console.error('Erro ao atualizar veículo:', error);
      const humanizedMessage = humanizeErrorMessage(error.message || "Erro desconhecido");
      toast({
        title: "Não foi possível atualizar o veículo",
        description: humanizedMessage,
        variant: "destructive",
      });
    },
  });

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  // Handlers de arquivo
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.size > 10 * 1024 * 1024) {
        toast({
          title: "Arquivo muito grande",
          description: "O arquivo deve ter no máximo 10MB",
          variant: "destructive",
        });
        return;
      }
      setFile(selectedFile);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      if (droppedFile.size > 10 * 1024 * 1024) {
        toast({
          title: "Arquivo muito grande",
          description: "O arquivo deve ter no máximo 10MB",
          variant: "destructive",
        });
        return;
      }
      setFile(droppedFile);
    }
  };

  // Função para humanizar mensagens de erro do backend
  const humanizeErrorMessage = (errorMessage: string): string => {
    const errorMappings: Record<string, string> = {
      'Placa já cadastrada': 'Esta placa já está cadastrada no sistema. Verifique se não foi digitada incorretamente.',
      'Vehicle with this plate already exists': 'Esta placa já está cadastrada no sistema. Verifique se não foi digitada incorretamente.',
      'RENAVAM já cadastrado': 'Este RENAVAM já está cadastrado no sistema. Cada veículo deve ter um RENAVAM único.',
      'renavam already exists': 'Este RENAVAM já está cadastrado no sistema. Cada veículo deve ter um RENAVAM único.',
      'duplicate key value': 'Já existe um registro com estes dados. Verifique se o veículo não foi cadastrado anteriormente.',
      'null value in column "crlv_year"': 'O ano do CRLV é obrigatório para finalizar o cadastro',
      'violates not-null constraint': 'Alguns campos obrigatórios não foram preenchidos corretamente',
      'Erro ao criar veículo': 'Não foi possível cadastrar o veículo. Verifique se todos os dados estão corretos.',
      'Erro ao atualizar veículo': 'Não foi possível atualizar o veículo. Verifique se todos os dados estão corretos.',
      'Permission denied': 'Você não tem permissão para cadastrar veículos. Contate o administrador.',
      'User not authenticated': 'Sua sessão expirou. Faça login novamente para continuar.',
      'Internal server error': 'Erro interno do sistema. Aguarde alguns momentos e tente novamente.',
      'Invalid file format': 'Formato de arquivo inválido. Use apenas PDF, JPG ou PNG.',
      'File too large': 'Arquivo muito grande. O tamanho máximo é de 10MB.'
    };

    // Procurar por correspondências parciais
    for (const [key, value] of Object.entries(errorMappings)) {
      if (errorMessage.toLowerCase().includes(key.toLowerCase())) {
        return value;
      }
    }

    return errorMessage;
  };

  // Submit handler
  const onSubmit = async (data: VehicleFormData) => {
    // Validar campos condicionais antes de enviar
    if (data.type === "tractor_unit" && !data.cmt) {
      form.setError("cmt", { message: "Informe a Capacidade Máxima de Tração (CMT) para unidade tratora" });
      return;
    }

    if (["truck", "semi_trailer", "trailer"].includes(data.type) && !data.bodyType) {
      form.setError("bodyType", { message: "Selecione o tipo de carroceria para este veículo" });
      return;
    }

    const formData = new FormData();
    
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        formData.append(key, value.toString());
      }
    });

    if (data.cmt) {
      formData.append("cmt", data.cmt.toString());
    }

    if (file) {
      formData.append("crlvFile", file);
    }

    if (vehicle) {
      updateMutation.mutate(formData);
    } else {
      createMutation.mutate(formData);
    }
  };

  return (
    <Form {...form}>
      <div className="bg-white w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-primary text-white rounded-t-lg">
          <h2 className="text-lg font-semibold">
            {vehicle ? "Editar Veículo" : "Cadastrar Novo Veículo"}
          </h2>
          <Button type="button" variant="ghost" size="icon" onClick={onCancel} className="h-5 w-5 text-white hover:bg-primary/90">
            <X className="h-3 w-3" />
          </Button>
        </div>
        
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <div className="p-6 space-y-4">
            {/* Primeira linha: PLACA | RENAVAM */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="plate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">
                      PLACA <span className="text-red-500">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="ABC-1234 ou BRA2E19" 
                        value={plateDisplay}
                        onChange={(e) => {
                          const formatted = formatPlate(e.target.value);
                          setPlateDisplay(formatted);
                          if (formatted.length >= 7 && validateBrazilianPlate(formatted)) {
                            field.onChange(formatted);
                          } else if (formatted.length < 7) {
                            field.onChange(formatted);
                          }
                        }}
                        className={`h-10 w-full ${plateDisplay.length >= 7 && !validateBrazilianPlate(plateDisplay) ? 'border-red-500' : ''}`}
                        maxLength={8}
                        required 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="renavam"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">
                      RENAVAM <span className="text-red-500">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="Renavam" {...field} className="h-10 w-full" required />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Segunda linha: Nome Proprietário (campo largo) */}
            <FormField
              control={form.control}
              name="ownerName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium">
                    Nome Proprietário
                  </FormLabel>
                  <FormControl>
                    <Input placeholder="Nome do proprietário" {...field} className="h-10 w-full" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Terceira linha: Tipo de Veículo | Veículo */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">
                      Tipo de Veículo <span className="text-red-500">*</span>
                    </FormLabel>
                    <Select 
                      onValueChange={(value) => {
                        field.onChange(value);
                        setVehicleType(value);
                        console.log("Selected vehicle type:", value);
                      }} 
                      value={field.value}
                      defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="h-10 w-full">
                          <SelectValue placeholder="Selecione" />
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
                name="ownershipType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">
                      Veículo <span className="text-red-500">*</span>
                    </FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="h-10 w-full">
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="proprio">Próprio</SelectItem>
                        <SelectItem value="terceiro">Terceiro</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Quarta linha: Marca | Modelo */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="brand"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">
                      Marca <span className="text-red-500">*</span>
                    </FormLabel>
                    <FormControl>
                      <SearchableSelect
                        options={getFilteredBrands(vehicleType)}
                        value={field.value}
                        onValueChange={(value) => {
                          field.onChange(value);
                          setSelectedBrand(value);
                          form.setValue("model", "");
                        }}
                        placeholder={vehicleType ? "Digite para buscar marca..." : "Primeiro selecione o tipo de veículo"}
                        disabled={!vehicleType}
                        emptyMessage={!vehicleType ? "Selecione primeiro o tipo de veículo" : "Nenhuma marca encontrada para este tipo"}
                      />
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
                    <FormLabel className="text-sm font-medium">
                      Modelo <span className="text-red-500">*</span>
                    </FormLabel>
                    <FormControl>
                      <SearchableSelect
                        options={getFilteredModels(selectedBrand, vehicleType)}
                        value={field.value}
                        onValueChange={field.onChange}
                        placeholder={selectedBrand ? "Digite para buscar modelo..." : "Primeiro selecione a marca"}
                        disabled={!selectedBrand || !vehicleType}
                        emptyMessage={!selectedBrand ? "Selecione primeiro a marca" : "Nenhum modelo encontrado para esta marca"}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Quinta linha: Qtd. Eixos | Ano CRLV */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="axleCount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">
                      Qtd. Eixos <span className="text-red-500">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        placeholder="Mínimo 1" 
                        {...field} 
                        value={field.value || ''} 
                        onChange={(e) => {
                          const value = e.target.valueAsNumber;
                          field.onChange(value && value > 0 ? value : '');
                        }}
                        min="1"
                        className="h-10 w-full"
                        required
                      />
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
                    <FormLabel className="text-sm font-medium">
                      Ano CRLV <span className="text-red-500">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        placeholder="Ex: 2020" 
                        {...field}
                        value={field.value || ''} 
                        onChange={(e) => {
                          const value = e.target.valueAsNumber;
                          field.onChange(value && value > 0 ? value : '');
                        }}
                        className="h-10 w-full" 
                        required
                        min="1980"
                        max="2030"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Sexta linha: Tara (kg) | Ano de Fabricação */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="tare"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">
                      Tara (kg) <span className="text-red-500">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input 
                        type="text" 
                        placeholder="Ex: 7.500 ou 7,500" 
                        value={tareDisplay}
                        onChange={(e) => {
                          const rawValue = e.target.value;
                          let cleanValue = rawValue.replace(/[^\d.,]/g, '');
                          
                          // Permitir apenas um separador decimal (vírgula ou ponto)
                          const separatorCount = (cleanValue.match(/[.,]/g) || []).length;
                          if (separatorCount > 1) {
                            // Manter apenas o primeiro separador
                            const firstSeparatorIndex = cleanValue.search(/[.,]/);
                            cleanValue = cleanValue.substring(0, firstSeparatorIndex + 1) + 
                                        cleanValue.substring(firstSeparatorIndex + 1).replace(/[.,]/g, '');
                          }
                          
                          // Limitar a 3 casas decimais após vírgula ou ponto
                          const decimalMatch = cleanValue.match(/^(\d+)[.,](\d{0,3})/);
                          if (decimalMatch) {
                            cleanValue = decimalMatch[1] + ',' + decimalMatch[2];
                          } else if (cleanValue.match(/^(\d+)$/)) {
                            // Apenas números inteiros são válidos
                            cleanValue = cleanValue;
                          }
                          
                          setTareDisplay(cleanValue);
                          
                          if (cleanValue === '') {
                            field.onChange('');
                            return;
                          }
                          
                          // Converter vírgula para ponto para processamento numérico
                          const normalizedValue = cleanValue.replace(',', '.');
                          const numericValue = parseFloat(normalizedValue);
                          
                          if (!isNaN(numericValue) && numericValue > 0) {
                            field.onChange(numericValue);
                          }
                        }}
                        onBlur={(e) => {
                          // Formatizar com 3 casas decimais quando sair do campo
                          const currentValue = e.target.value;
                          if (currentValue && currentValue !== '') {
                            const normalizedValue = currentValue.replace(',', '.');
                            const numericValue = parseFloat(normalizedValue);
                            if (!isNaN(numericValue) && numericValue > 0) {
                              const formattedValue = numericValue.toFixed(3).replace('.', ',');
                              setTareDisplay(formattedValue);
                              field.onChange(numericValue);
                            }
                          }
                        }}
                        className="h-10 w-full"
                        required
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="year"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">
                      Ano de Fabricação <span className="text-red-500">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        placeholder="" 
                        {...field} 
                        value={field.value || ''} 
                        onChange={(e) => field.onChange(e.target.valueAsNumber)}
                        className="h-10 w-full"
                        required
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* CMT (apenas para unidade tratora) */}
            {vehicleType === "tractor_unit" && (
              <FormField
                control={form.control}
                name="cmt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">
                      CMT (kg) <span className="text-red-500">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        placeholder="Ex: 80.00" 
                        step="0.01"
                        min="0"
                        max="200000"
                        {...field}
                        value={field.value || ''} 
                        onChange={(e) => {
                          const value = parseFloat(e.target.value) || undefined;
                          field.onChange(value);
                        }}
                        className="h-10 w-full" 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Status do Veículo (só quando editando) */}
            {vehicle && (
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">
                      Status do Veículo
                    </FormLabel>
                    <Select 
                      onValueChange={(value) => field.onChange(value)} 
                      value={field.value}
                      defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="h-10 w-full">
                          <SelectValue placeholder="Selecione o status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="active">Ativo</SelectItem>
                        <SelectItem value="maintenance">Em Manutenção</SelectItem>
                        <SelectItem value="inactive">Inativo</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Tipo de Carroceria (campo largo quando necessário) */}
            {(vehicleType === "truck" || vehicleType === "semi_trailer" || vehicleType === "trailer") && (
              <FormField
                control={form.control}
                name="bodyType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">
                      Tipo de Carroceria <span className="text-red-500">*</span>
                    </FormLabel>
                    <Select 
                      onValueChange={(value) => field.onChange(value)} 
                      value={field.value}
                      defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="h-10 w-full">
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {bodyTypeOptions.map((option) => (
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
            )}

            {/* Observações (campo largo) */}
            <FormField
              control={form.control}
              name="remarks"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium">Observações</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Observações sobre o veículo..." 
                      className="resize-none h-16 w-full" 
                      {...field} 
                      value={field.value || ''} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {/* Upload do CRLV (campo largo) */}
            <div>
              <FormLabel htmlFor="crlvFile" className="text-sm font-medium">Upload do CRLV (PDF/imagem)</FormLabel>
              <div 
                className={`flex justify-center px-3 py-2 border-2 border-dashed rounded-md transition-colors ${
                  isDragOver 
                    ? 'border-blue-400 bg-blue-50' 
                    : 'border-gray-300'
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <div className="space-y-1 text-center py-1">
                  <UploadCloud className={`mx-auto h-5 w-5 ${isDragOver ? 'text-blue-500' : 'text-gray-400'}`} />
                  <div className="flex text-xs text-gray-600">
                    <label
                      htmlFor="crlvFile"
                      className="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none"
                    >
                      <span>Carregar arquivo</span>
                      <input
                        id="crlvFile"
                        name="crlvFile"
                        type="file"
                        className="sr-only"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={handleFileChange}
                      />
                    </label>
                    <p className="pl-1">ou arraste e solte</p>
                  </div>
                  <p className="text-xs text-gray-500">
                    PDF, JPG, PNG até 10MB
                  </p>
                  {file && (
                    <p className="text-xs text-green-600">
                      Arquivo: {file.name}
                    </p>
                  )}
                  {vehicle?.crlvUrl && !file && (
                    <p className="text-xs text-blue-600">
                      <a href={vehicle.crlvUrl} target="_blank" rel="noopener noreferrer">
                        Visualizar CRLV atual
                      </a>
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
            
          <div className="flex justify-end gap-2 py-4 px-6 border-t">
            <Button type="button" variant="outline" onClick={onCancel} className="h-10 px-4">
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting} className="h-10 px-4 bg-primary">
              {isSubmitting && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
              {vehicle ? "Atualizar" : "Cadastrar Veículo"}
            </Button>
          </div>
        </form>
      </div>
    </Form>
  );
}