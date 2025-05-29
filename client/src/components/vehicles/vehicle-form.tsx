import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { insertVehicleSchema, vehicleTypeOptions, bodyTypeOptions, Vehicle, VehicleModel } from "@shared/schema";
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

import { LoaderCircle, UploadCloud, X } from "lucide-react";
import { getVehicleTypeLabel } from "@/lib/utils";

interface VehicleFormProps {
  vehicle?: Vehicle | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export function VehicleForm({ vehicle, onSuccess, onCancel }: VehicleFormProps) {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  
  // Extend the schema to handle file upload
  const formSchema = insertVehicleSchema.extend({
    tare: z.coerce.number().min(0.1, "O peso deve ser maior que zero"),
    crlvYear: z.coerce.number().min(1990, "O ano deve ser posterior a 1990"),
    axleCount: z.coerce.number().min(1, "A quantidade de eixos deve ser maior que zero").optional(),
  });

  // Estado para controlar os placeholders dinâmicos
  const [vehicleType, setVehicleType] = useState<string>(vehicle?.type || "");
  const [selectedBrand, setSelectedBrand] = useState<string>(vehicle?.brand || "");
  
  // Buscar modelos de veículos
  const { data: vehicleModels = [] } = useQuery<VehicleModel[]>({
    queryKey: ["/api/vehicle-models"],
  });
  
  // Função para filtrar marcas baseado no tipo de veículo
  const getFilteredBrands = (type: string): string[] => {
    console.log("getFilteredBrands called with type:", type);
    console.log("vehicleModels length:", vehicleModels.length);
    console.log("vehicleModels sample:", vehicleModels.slice(0, 3));
    
    if (!vehicleModels.length) return [];
    
    let allowedTypes: string[] = [];
    
    switch (type) {
      case "tractor_unit":
        allowedTypes = ["tractor_unit", "truck"];
        break;
      case "truck":
        allowedTypes = ["truck", "tractor_unit"];
        break;
      case "semi_trailer":
        allowedTypes = ["semi_trailer", "trailer"];
        break;
      case "trailer":
        allowedTypes = ["trailer", "semi_trailer"];
        break;
      case "crane":
      case "dolly":
      case "flatbed":
        allowedTypes = [type];
        break;
      default:
        allowedTypes = [type];
    }
    
    console.log("allowedTypes:", allowedTypes);
    
    const filteredModels = vehicleModels.filter(model => allowedTypes.includes(model.vehicleType));
    console.log("filteredModels:", filteredModels.length);
    
    const brands = filteredModels
      .map(model => model.brand)
      .filter((brand, index, array) => array.indexOf(brand) === index)
      .sort();
    
    console.log("final brands:", brands);
    return brands;
  };
  
  // Função para filtrar modelos baseado na marca e tipo
  const getFilteredModels = (brand: string, type: string): string[] => {
    if (!vehicleModels.length || !brand) return [];
    
    let allowedTypes: string[] = [];
    
    switch (type) {
      case "tractor_unit":
        allowedTypes = ["tractor_unit", "truck"];
        break;
      case "truck":
        allowedTypes = ["truck", "tractor_unit"];
        break;
      case "semi_trailer":
        allowedTypes = ["semi_trailer", "trailer"];
        break;
      case "trailer":
        allowedTypes = ["trailer", "semi_trailer"];
        break;
      case "crane":
      case "dolly":
      case "flatbed":
        allowedTypes = [type];
        break;
      default:
        allowedTypes = [type];
    }
    
    const models = vehicleModels
      .filter(model => model.brand === brand && allowedTypes.includes(model.vehicleType))
      .map(model => model.model)
      .filter((model, index, array) => array.indexOf(model) === index)
      .sort();
    
    return models;
  };
  const [tareDisplay, setTareDisplay] = useState<string>(vehicle?.tare ? vehicle.tare.toString().replace('.', ',') : '');
  const [plateDisplay, setPlateDisplay] = useState<string>(vehicle?.plate || '');
  
  // Função para validar placas brasileiras
  const validateBrazilianPlate = (plate: string): boolean => {
    // Remove espaços e converte para maiúscula
    const cleanPlate = plate.replace(/\s/g, '').toUpperCase();
    
    // Formato antigo: ABC-1234 ou ABC1234
    const oldFormat = /^[A-Z]{3}-?\d{4}$/;
    
    // Formato Mercosul: BRA2E19 ou BRA-2E19
    const mercosulFormat = /^[A-Z]{3}-?\d{1}[A-Z]{1}\d{2}$/;
    
    return oldFormat.test(cleanPlate) || mercosulFormat.test(cleanPlate);
  };
  
  // Função para formatar placa
  const formatPlate = (value: string): string => {
    // Remove tudo que não for letra ou número
    const clean = value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    
    if (clean.length <= 3) {
      return clean;
    } else if (clean.length <= 7) {
      // Formato antigo: ABC1234 -> ABC-1234
      const letters = clean.slice(0, 3);
      const numbers = clean.slice(3);
      
      // Verifica se é formato Mercosul (4º caractere é número, 5º é letra)
      if (numbers.length >= 2 && /\d/.test(numbers[0]) && /[A-Z]/.test(numbers[1])) {
        // Formato Mercosul: BRA2E19
        return letters + numbers;
      } else {
        // Formato antigo: ABC-1234
        return letters + (numbers ? '-' + numbers : '');
      }
    }
    
    return clean.slice(0, 7);
  };
  
  // Atualizar vehicleType quando o veículo mudar
  useEffect(() => {
    if (vehicle?.type) {
      setVehicleType(vehicle.type);
      console.log("Tipo de veículo do banco:", vehicle.type);
    }
  }, [vehicle]);
  
  // Estado para o CMT (Capacidade Máxima de Tração)
  const [cmt, setCmt] = useState<number | undefined>(undefined);
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: vehicle ? {
      plate: vehicle.plate,
      type: vehicle.type,
      bodyType: vehicle.bodyType || "",
      tare: vehicle.tare,
      crlvYear: vehicle.crlvYear,
      brand: vehicle.brand || "",
      model: vehicle.model || "",
      year: vehicle.year || undefined,
      renavam: vehicle.renavam || "",
      axleCount: vehicle.axleCount || undefined,
      remarks: vehicle.remarks || "",
      status: vehicle.status || "active",
    } : {
      plate: "",
      type: "", // Sem valor padrão para o tipo
      bodyType: "", // Sem valor padrão para o tipo de carroceria
      tare: undefined,
      crlvYear: new Date().getFullYear(),
      brand: "",
      model: "",
      year: undefined,
      renavam: "",
      axleCount: undefined,
      remarks: "",
      status: "active",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const res = await apiRequest("POST", "/api/vehicles", data);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Veículo cadastrado",
        description: "O veículo foi cadastrado com sucesso",
      });
      onSuccess();
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message || "Não foi possível cadastrar o veículo",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: FormData) => {
      // Semelhante ao método para novo veículo
      const res = await apiRequest("PATCH", `/api/vehicles/${vehicle?.id}`, data);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Veículo atualizado",
        description: "O veículo foi atualizado com sucesso",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/vehicles"] });
      onSuccess();
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message || "Não foi possível atualizar o veículo",
        variant: "destructive",
      });
    },
  });
  
  const createWithoutFileMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/vehicles", data);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Veículo cadastrado",
        description: "O veículo foi cadastrado com sucesso",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/vehicles"] });
      onSuccess();
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message || "Não foi possível cadastrar o veículo",
        variant: "destructive",
      });
    },
  });
  
  const updateWithoutFileMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("PATCH", `/api/vehicles/${vehicle?.id}`, data);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Veículo atualizado", 
        description: "O veículo foi atualizado com sucesso",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/vehicles"] });
      onSuccess();
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message || "Não foi possível atualizar o veículo",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    if (file) {
      // Se tiver arquivo, usar FormData
      const formData = new FormData();
      
      const vehicleData = {
        plate: values.plate.toUpperCase(),
        type: values.type,
        bodyType: values.bodyType || undefined,
        tare: Number(values.tare),
        crlvYear: Number(values.crlvYear),
        brand: values.brand,
        model: values.model,
        year: values.year,
        renavam: values.renavam,
        axleCount: values.axleCount,
        remarks: values.remarks
      };
      
      // Para veículos sem arquivo, enviar diretamente como JSON
      formData.append("plate", vehicleData.plate);
      formData.append("type", vehicleData.type);
      formData.append("tare", vehicleData.tare.toString());
      formData.append("crlvYear", vehicleData.crlvYear.toString());
      
      if (vehicleData.bodyType) formData.append("bodyType", vehicleData.bodyType);
      if (vehicleData.brand) formData.append("brand", vehicleData.brand);
      if (vehicleData.model) formData.append("model", vehicleData.model);
      if (vehicleData.year) formData.append("year", vehicleData.year.toString());
      if (vehicleData.renavam) formData.append("renavam", vehicleData.renavam);
      if (vehicleData.axleCount) formData.append("axleCount", vehicleData.axleCount.toString());
      if (vehicleData.remarks) formData.append("remarks", vehicleData.remarks);
      if (values.status) formData.append("status", values.status);
      
      formData.append("crlvFile", file);
      
      console.log("Sending vehicle data with file:", vehicleData);
      
      if (vehicle) {
        updateMutation.mutate(formData);
      } else {
        createMutation.mutate(formData);
      }
    } else {
      // Se não tiver arquivo, enviar diretamente como JSON
      const vehicleData = {
        plate: values.plate.toUpperCase(),
        type: values.type,
        bodyType: values.bodyType || undefined,
        tare: Number(values.tare),
        crlvYear: Number(values.crlvYear),
        brand: values.brand,
        model: values.model,
        year: values.year,
        renavam: values.renavam,
        axleCount: values.axleCount,
        remarks: values.remarks,
        status: values.status || "active"
      };
      
      console.log("Sending vehicle data as JSON:", vehicleData);
      
      if (vehicle) {
        updateWithoutFileMutation.mutate(vehicleData);
      } else {
        createWithoutFileMutation.mutate(vehicleData);
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles.length > 0) {
      const file = droppedFiles[0];
      
      // Verificar se é um tipo de arquivo aceito
      const acceptedTypes = ['.pdf', '.jpg', '.jpeg', '.png'];
      const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
      
      if (acceptedTypes.includes(fileExtension)) {
        // Verificar tamanho (10MB)
        if (file.size <= 10 * 1024 * 1024) {
          setFile(file);
        } else {
          toast({
            title: "Arquivo muito grande",
            description: "O arquivo deve ter no máximo 10MB",
            variant: "destructive",
          });
        }
      } else {
        toast({
          title: "Tipo de arquivo não suportado",
          description: "Use apenas arquivos PDF, JPG, JPEG ou PNG",
          variant: "destructive",
        });
      }
    }
  };
  
  // Limpar campo de carroceria quando o tipo de veículo mudar para um não compatível
  useEffect(() => {
    console.log("Current vehicleType:", vehicleType);
    console.log("Condition result:", vehicleType !== "truck" && vehicleType !== "semi_trailer" && vehicleType !== "trailer");
    console.log("Should show bodyType field:", vehicleType === "truck" || vehicleType === "semi_trailer" || vehicleType === "trailer");
    if (vehicleType !== "truck" && vehicleType !== "semi_trailer" && vehicleType !== "trailer") {
      form.setValue("bodyType", "");
    }
  }, [vehicleType, form]);

  const isSubmitting = createMutation.isPending || updateMutation.isPending || 
    createWithoutFileMutation.isPending || updateWithoutFileMutation.isPending;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="relative w-full max-w-lg mx-auto">
        <div className="flex justify-between items-center py-1 px-4 border-b bg-primary text-white">
          <h2 className="text-xs font-medium">{vehicle ? "Editar Veículo" : "Cadastrar Novo Veículo"}</h2>
          <Button type="button" variant="ghost" size="icon" onClick={onCancel} className="h-5 w-5 text-white hover:bg-primary/90">
            <X className="h-3 w-3" />
          </Button>
        </div>
        
        <div className="p-6 space-y-6">
          {/* Grid principal de 2 colunas com distribuição uniforme */}
          <div className="grid grid-cols-2 gap-6">
            {/* Coluna 1 */}
            <div className="space-y-4">
              {/* Placa */}
              <FormField
                control={form.control}
                name="plate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">
                      Placa <span className="text-red-500">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="ABC-1234 ou BRA2E19" 
                        value={plateDisplay}
                        onChange={(e) => {
                          const formatted = formatPlate(e.target.value);
                          setPlateDisplay(formatted);
                          
                          // Só salva no form se for válido
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
                    {plateDisplay.length >= 7 && !validateBrazilianPlate(plateDisplay) && (
                      <p className="text-xs text-red-500 mt-1">
                        Formato inválido. Use ABC-1234 (antigo) ou BRA2E19 (Mercosul)
                      </p>
                    )}
                    {plateDisplay.length >= 3 && plateDisplay.length < 7 && (
                      <p className="text-xs text-gray-500 mt-1">
                        Continue digitando...
                      </p>
                    )}
                  </FormItem>
                )}
              />

              {/* Tipo de Veículo */}
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

              {/* Marca e Modelo lado a lado */}
              <div className="grid grid-cols-2 gap-4">
                {/* Marca */}
                <FormField
                  control={form.control}
                  name="brand"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium">
                        Marca <span className="text-red-500">*</span>
                      </FormLabel>
                      <Select 
                        value={field.value} 
                        onValueChange={(value) => {
                          field.onChange(value);
                          setSelectedBrand(value);
                          // Limpar o modelo quando trocar de marca
                          form.setValue("model", "");
                        }}
                        disabled={!vehicleType}
                      >
                        <FormControl>
                          <SelectTrigger className="h-10 w-full">
                            <SelectValue placeholder={vehicleType ? "Selecione a marca" : "Selecione primeiro o tipo"} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {getFilteredBrands(vehicleType).map((brand) => (
                            <SelectItem key={brand} value={brand}>
                              {brand}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Modelo */}
                <FormField
                  control={form.control}
                  name="model"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium">
                        Modelo <span className="text-red-500">*</span>
                      </FormLabel>
                      <Select 
                        value={field.value} 
                        onValueChange={field.onChange}
                        disabled={!selectedBrand || !vehicleType}
                      >
                        <FormControl>
                          <SelectTrigger className="h-10 w-full">
                            <SelectValue placeholder={selectedBrand ? "Selecione o modelo" : "Selecione primeiro a marca"} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {getFilteredModels(selectedBrand, vehicleType).map((model) => (
                            <SelectItem key={model} value={model}>
                              {model}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>



              {/* Qtd. Eixos */}
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
                    {field.value === 0 && (
                      <p className="text-xs text-red-500 mt-1">A quantidade de eixos não pode ser zero</p>
                    )}
                  </FormItem>
                )}
              />

              {/* Tara */}
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
                          
                          // Permite apenas números, vírgula e ponto
                          const cleanValue = rawValue.replace(/[^\d.,]/g, '');
                          
                          // Atualiza o display sempre
                          setTareDisplay(cleanValue);
                          
                          // Se está vazio, limpa o campo
                          if (cleanValue === '') {
                            field.onChange('');
                            return;
                          }
                          
                          // Converte vírgula para ponto para validação numérica
                          const normalizedValue = cleanValue.replace(',', '.');
                          const numericValue = parseFloat(normalizedValue);
                          
                          // Se é um número completo e válido, salva no form
                          if (!isNaN(numericValue) && numericValue > 0) {
                            field.onChange(numericValue);
                          }
                        }}
                        className="h-10 w-full"
                        required
                      />
                    </FormControl>
                    <FormMessage />
                    {field.value === 0 && (
                      <p className="text-xs text-red-500 mt-1">O peso (TARA) não pode ser zero</p>
                    )}
                  </FormItem>
                )}
              />

              {/* Ano de Fabricação */}
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

            {/* Coluna 2 */}
            <div className="space-y-4">
              {/* Renavam */}
              <FormField
                control={form.control}
                name="renavam"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">
                      Renavam <span className="text-red-500">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="Renavam" {...field} className="h-10 w-full" required />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Veículo (Próprio/Terceiro) */}
              <FormField
                control={form.control}
                name="ownershipType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">
                      Veículo <span className="text-red-500">*</span>
                    </FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} defaultValue="proprio">
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

              {/* Nome Proprietário */}
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

              {/* Status do Veículo (só quando editando) */}
              {vehicle ? (
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
              ) : (
                <div className="h-[76px]"></div> /* Espaço vazio para manter alinhamento */
              )}

              {/* Modelo */}
              <FormField
                control={form.control}
                name="model"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">
                      Modelo <span className="text-red-500">*</span>
                    </FormLabel>
                    <Select 
                      value={field.value} 
                      onValueChange={field.onChange}
                      disabled={!selectedBrand || !vehicleType}
                    >
                      <FormControl>
                        <SelectTrigger className="h-10 w-full">
                          <SelectValue placeholder={selectedBrand ? "Selecione o modelo" : "Selecione primeiro a marca"} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {getFilteredModels(selectedBrand, vehicleType).map((model) => (
                          <SelectItem key={model} value={model}>
                            {model}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* CMT (apenas para unidade tratora) */}
              {vehicleType === "tractor_unit" ? (
                <FormItem>
                  <FormLabel className="text-sm font-medium">CMT (kg)</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      placeholder="" 
                      value={cmt || ''} 
                      onChange={(e) => setCmt(e.target.valueAsNumber || undefined)}
                      className="h-10 w-full" 
                    />
                  </FormControl>
                </FormItem>
              ) : (
                <div className="h-[76px]"></div> /* Espaço vazio para manter alinhamento */
              )}

              {/* Ano CRLV */}
              <FormField
                control={form.control}
                name="crlvYear"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">Ano CRLV</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        placeholder="" 
                        {...field}
                        value={field.value || ''} 
                        onChange={(e) => field.onChange(e.target.valueAsNumber)}
                        className="h-10 w-full" 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          {/* Nome Proprietário (campo largo que se estende pelas duas colunas) */}
          <div className="grid grid-cols-2 gap-6">
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

            <FormField
              control={form.control}
              name="ownershipType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium">
                    Veículo <span className="text-red-500">*</span>
                  </FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} defaultValue="proprio">
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

          {/* Tipo de Carroceria (campo largo quando necessário) */}
          {(vehicleType === "truck" || vehicleType === "semi_trailer" || vehicleType === "trailer") && (
            <FormField
              control={form.control}
              name="bodyType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium">
                    Tipo de Carroceria
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
        
        <div className="flex justify-end gap-2 py-2 px-4 border-t">
          <Button type="button" variant="outline" onClick={onCancel} className="h-10 px-4">
            Cancelar
          </Button>
          <Button type="submit" disabled={isSubmitting} className="h-10 px-4 bg-primary">
            {isSubmitting && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
            {vehicle ? "Atualizar" : "Cadastrar Veículo"}
          </Button>
        </div>
      </form>
    </Form>
  );
}