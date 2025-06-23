import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Transporter, InsertTransporter, personTypeEnum, documentSchema, subsidiarySchema, allBrazilianStates } from "@shared/schema";
import { useState, useEffect } from "react";

import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { LoadingSpinner } from "../ui/loading-spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Plus, Trash2, Upload, File, FileText, Search as SearchIcon } from "lucide-react";
import { UserSelect } from "./user-select";

// Função para formatar CNPJ
const formatCNPJ = (value: string): string => {
  // Remove tudo que não é número
  const numbers = value.replace(/\D/g, '');
  
  // Aplica máscara de CNPJ
  if (numbers.length <= 14) {
    return numbers.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  }
  
  return numbers.slice(0, 14).replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
};

// Função para formatar CPF
const formatCPF = (value: string): string => {
  // Remove tudo que não é número
  const numbers = value.replace(/\D/g, '');
  
  // Aplica máscara de CPF
  if (numbers.length <= 11) {
    return numbers.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
  }
  
  return numbers.slice(0, 11).replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
};

// Função para extrair apenas números do documento (CNPJ/CPF)
const extractDocumentNumbers = (value: string): string => {
  return value.replace(/\D/g, '');
};

// Função para validar CNPJ
const isValidCNPJ = (cnpj: string): boolean => {
  const numbers = extractDocumentNumbers(cnpj);
  return numbers.length === 14;
};

// Função para validar CPF
const isValidCPF = (cpf: string): boolean => {
  const numbers = extractDocumentNumbers(cpf);
  return numbers.length === 11;
};

// Função para detectar tipo de documento e formatar
const formatDocument = (value: string): string => {
  const numbers = extractDocumentNumbers(value);
  
  if (numbers.length === 11) {
    return formatCPF(value);
  } else if (numbers.length === 14) {
    return formatCNPJ(value);
  }
  
  return value; // Retorna o valor original se não for CPF nem CNPJ válido
};

// Função para validar documento (CPF ou CNPJ)
const isValidDocument = (document: string): boolean => {
  return isValidCPF(document) || isValidCNPJ(document);
};

// Interface para filial
interface Subsidiary {
  cnpj: string;
  name: string;
  tradeName?: string;
  street?: string;
  number?: string;
  complement?: string;
  zipCode?: string;
  city?: string;
  state?: string;
  documents: string[];
}

// Interface para documento
interface Document {
  type: string;
  url: string;
  filename: string;
}

interface TransporterFormProps {
  transporter?: Transporter;
  onSuccess?: () => void;
}

export function TransporterForm({ transporter, onSuccess }: TransporterFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [personType, setPersonType] = useState<"pj" | "pf">(transporter?.personType as "pj" | "pf" || "pj");
  const [subsidiaries, setSubsidiaries] = useState<Subsidiary[]>(() => {
    if (!transporter?.subsidiaries) return [];
    try {
      return typeof transporter.subsidiaries === 'string' 
        ? JSON.parse(transporter.subsidiaries) 
        : Array.isArray(transporter.subsidiaries) 
        ? transporter.subsidiaries 
        : [];
    } catch (error) {
      console.error('Erro ao fazer parse das subsidiárias:', error);
      return [];
    }
  });
  const [documents, setDocuments] = useState<Document[]>(() => {
    if (!transporter?.documents) return [];
    try {
      return typeof transporter.documents === 'string' 
        ? JSON.parse(transporter.documents) 
        : Array.isArray(transporter.documents) 
        ? transporter.documents 
        : [];
    } catch (error) {
      console.error('Erro ao fazer parse dos documentos:', error);
      return [];
    }
  });
  const [selectedFiles, setSelectedFiles] = useState<{ [key: string]: File | null }>({
    socialContract: null,
    powerOfAttorney: null,
  });
  const [isLoadingCnpj, setIsLoadingCnpj] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(transporter?.userId || null);
  
  // Formulário para pessoa jurídica
  const pjForm = useForm<InsertTransporter>({
    resolver: zodResolver(z.object({
      personType: personTypeEnum,
      name: z.string().min(3, "A razão social deve ter pelo menos 3 caracteres"),
      documentNumber: z.string()
        .min(1, "CNPJ é obrigatório")
        .refine((val) => {
          const numbers = extractDocumentNumbers(val);
          return numbers.length === 14;
        }, "CNPJ deve conter 14 dígitos"),
      tradeName: z.string().optional(),
      legalResponsible: z.string().min(3, "Nome do responsável legal é obrigatório"),
      email: z.string().email("Email inválido"),
      phone: z.string().min(10, "Telefone deve ter pelo menos 10 dígitos"),
      street: z.string().min(3, "Logradouro é obrigatório"),
      number: z.string().min(1, "Número é obrigatório"),
      complement: z.string().optional(),
      district: z.string().min(2, "Bairro é obrigatório"),
      zipCode: z.string().min(8, "CEP deve ter 8 dígitos"),
      city: z.string().min(2, "Cidade é obrigatória"),
      state: z.string().min(2, "Estado é obrigatório"),
      // Campos para retro-compatibilidade
      contact1Name: z.string().optional(),
      contact1Phone: z.string().optional(),
      contact2Name: z.string().optional(),
      contact2Phone: z.string().optional(),
    })),
    defaultValues: {
      personType: "pj",
      name: transporter?.name || "",
      documentNumber: transporter?.documentNumber || "",
      tradeName: transporter?.tradeName || "",
      legalResponsible: transporter?.legalResponsible || "",
      email: transporter?.email || "",
      phone: transporter?.phone || "",
      street: transporter?.street || "",
      number: transporter?.number || "",
      complement: transporter?.complement || "",
      district: transporter?.district || "",
      zipCode: transporter?.zipCode || "",
      city: transporter?.city || "",
      state: transporter?.state || "",
      // Campos para retro-compatibilidade
      contact1Name: transporter?.contact1Name || "",
      contact1Phone: transporter?.contact1Phone || "",
    }
  });
  
  // Formulário para pessoa física
  const pfForm = useForm<InsertTransporter>({
    resolver: zodResolver(z.object({
      personType: personTypeEnum,
      name: z.string().min(3, "O nome completo deve ter pelo menos 3 caracteres"),
      documentNumber: z.string().min(11, "CPF deve ter 11 dígitos"),
      birthDate: z.string().min(8, "Data de nascimento é obrigatória"),
      nationality: z.string().min(2, "Nacionalidade é obrigatória"),
      idNumber: z.string().min(5, "RG é obrigatório"),
      idIssuer: z.string().min(2, "Órgão emissor é obrigatório"),
      idState: z.string().min(2, "UF do RG é obrigatória"),
      email: z.string().email("Email inválido"),
      phone: z.string().min(10, "Telefone deve ter pelo menos 10 dígitos"),
      // Campos para retro-compatibilidade
      contact1Name: z.string().optional(),
      contact1Phone: z.string().optional(),
    })),
    defaultValues: {
      personType: "pf",
      name: transporter?.name || "",
      documentNumber: transporter?.documentNumber || "",
      birthDate: transporter?.birthDate || "",
      nationality: transporter?.nationality || "Brasileira",
      idNumber: transporter?.idNumber || "",
      idIssuer: transporter?.idIssuer || "",
      idState: transporter?.idState || "",
      email: transporter?.email || "",
      phone: transporter?.phone || "",
      // Campos para retro-compatibilidade
      contact1Name: transporter?.name || "",
      contact1Phone: transporter?.phone || "",
    }
  });

  // Efeito para atualizar o tipo de pessoa quando o formulário mudar
  useEffect(() => {
    if (personType === "pj") {
      pjForm.setValue("personType", "pj");
    } else {
      pfForm.setValue("personType", "pf");
    }
  }, [personType, pjForm, pfForm]);

  // Adicionar uma nova filial
  const addSubsidiary = () => {
    setSubsidiaries([
      ...subsidiaries,
      {
        cnpj: "",
        name: "",
        tradeName: "",
        street: "",
        number: "",
        complement: "",
        zipCode: "",
        city: "",
        state: "",
        documents: []
      }
    ]);
  };

  // Remover uma filial
  const removeSubsidiary = (index: number) => {
    setSubsidiaries(subsidiaries.filter((_, i) => i !== index));
  };

  // Atualizar uma filial
  const updateSubsidiary = (index: number, field: keyof Subsidiary, value: any) => {
    const newSubsidiaries = [...subsidiaries];
    newSubsidiaries[index] = {
      ...newSubsidiaries[index],
      [field]: value
    };
    setSubsidiaries(newSubsidiaries);
  };

  // Lidar com upload de arquivos
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, fileType: string) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFiles({
        ...selectedFiles,
        [fileType]: e.target.files[0]
      });
    }
  };

  // Mutação para criar transportador
  const createTransporterMutation = useMutation({
    mutationFn: async (data: InsertTransporter) => {
      // Adicionar filiais e documentos
      const formData = new FormData();
      
      // Adicionar campos básicos
      Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          formData.append(key, value.toString());
        }
      });
      
      // Adicionar id do usuário selecionado (se houver)
      if (selectedUserId !== null) {
        formData.append("userId", selectedUserId.toString());
      }
      
      // Adicionar filiais se for PJ
      if (data.personType === "pj") {
        formData.append("subsidiaries", JSON.stringify(subsidiaries));
      }
      
      // Adicionar arquivos
      Object.entries(selectedFiles).forEach(([key, file]) => {
        if (file) {
          formData.append(`document_${key}`, file);
        }
      });
      
      const response = await apiRequest("POST", "/api/admin/transporters", formData, { isFormData: true });
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Transportador criado",
        description: "O transportador foi cadastrado com sucesso",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/transporters"] });
      
      // Resetar formulários
      pjForm.reset();
      pfForm.reset();
      setSubsidiaries([]);
      setDocuments([]);
      setSelectedFiles({
        socialContract: null,
        powerOfAttorney: null,
      });
      
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao criar transportador",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Mutação para atualizar transportador
  const updateTransporterMutation = useMutation({
    mutationFn: async (data: InsertTransporter) => {
      if (!transporter) throw new Error("Transportador não encontrado");
      
      // Adicionar filiais e documentos
      const formData = new FormData();
      
      // Adicionar campos básicos
      Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          formData.append(key, value.toString());
        }
      });
      
      // Adicionar id do usuário selecionado (se houver)
      if (selectedUserId !== null) {
        formData.append("userId", selectedUserId.toString());
      }
      
      // Adicionar filiais se for PJ
      if (data.personType === "pj") {
        formData.append("subsidiaries", JSON.stringify(subsidiaries));
      }
      
      // Adicionar arquivos
      Object.entries(selectedFiles).forEach(([key, file]) => {
        if (file) {
          formData.append(`document_${key}`, file);
        }
      });
      
      const response = await apiRequest("PATCH", `/api/admin/transporters/${transporter.id}`, formData, { isFormData: true });
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Transportador atualizado",
        description: "O transportador foi atualizado com sucesso",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/transporters"] });
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao atualizar transportador",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Handler para submissão do formulário
  const onSubmit = (data: InsertTransporter) => {
    // Extrair apenas números do CNPJ/CPF antes de enviar para o backend
    data.documentNumber = extractCNPJNumbers(data.documentNumber);
    
    // Limpar CNPJs das filiais também
    if (personType === "pj" && subsidiaries.length > 0) {
      subsidiaries.forEach((subsidiary, index) => {
        if (subsidiary.cnpj) {
          subsidiary.cnpj = extractCNPJNumbers(subsidiary.cnpj);
        }
      });
    }
    
    // Copiar dados dos contatos para retro-compatibilidade
    if (personType === "pj") {
      data.contact1Name = data.legalResponsible;
      data.contact1Phone = data.phone;
    } else {
      data.contact1Name = data.name;
      data.contact1Phone = data.phone;
    }
    
    if (transporter) {
      updateTransporterMutation.mutate(data);
    } else {
      createTransporterMutation.mutate(data);
    }
  };

  const isPending = createTransporterMutation.isPending || updateTransporterMutation.isPending;

  return (
    <div className="space-y-6 w-full max-w-6xl mx-auto overflow-visible px-1 pb-24 sm:px-4 md:px-6">
      {/* Seleção de tipo de pessoa */}
      <div className="space-y-2">
        <Label>Tipo de Cadastro</Label>
        <RadioGroup 
          defaultValue={personType} 
          onValueChange={(value) => setPersonType(value as "pj" | "pf")}
          className="flex space-x-4"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="pj" id="pj" />
            <Label htmlFor="pj">Pessoa Jurídica</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="pf" id="pf" />
            <Label htmlFor="pf">Pessoa Física</Label>
          </div>
        </RadioGroup>
      </div>
      
      <Separator />

      {/* SEÇÃO DE VINCULAÇÃO COM USUÁRIO */}
      <Card className="w-full overflow-hidden">
        <CardHeader className="bg-muted/50">
          <CardTitle>Vinculação com Usuário</CardTitle>
          <CardDescription>
            Selecione o usuário que será responsável por gerenciar este transportador
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <UserSelect
            selectedUserId={selectedUserId}
            onChange={setSelectedUserId}
            description="O usuário selecionado terá acesso para gerenciar este transportador, seus veículos e licenças."
          />
        </CardContent>
      </Card>
      
      {/* Formulário de Pessoa Jurídica */}
      {personType === "pj" && (
        <Form {...pjForm}>
          <form onSubmit={pjForm.handleSubmit(onSubmit)} className="space-y-6">
            <Card className="w-full overflow-hidden">
              <CardHeader>
                <CardTitle>Dados do Transportador (Matriz)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6 overflow-visible">
                {/* CNPJ e Razão Social */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-4">
                    <FormField
                      control={pjForm.control}
                      name="documentNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>CNPJ Principal</FormLabel>
                          <div className="flex gap-2">
                            <FormControl>
                              <Input 
                                placeholder="00.000.000/0000-00 ou 00000000000000" 
                                {...field}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  // Mantém o valor original no estado do formulário (pode ser com ou sem formatação)
                                  field.onChange(value);
                                }}
                                onBlur={(e) => {
                                  // Ao sair do campo, formatar automaticamente
                                  const value = e.target.value;
                                  const formatted = formatDocument(value);
                                  if (formatted !== value) {
                                    field.onChange(formatted);
                                  }
                                }}
                              />
                            </FormControl>
                            <Button 
                              type="button" 
                              variant="outline" 
                              size="icon" 
                              disabled={isLoadingCnpj || !field.value || !isValidCNPJ(field.value)}
                              onClick={async () => {
                                const cnpjNumbers = extractCNPJNumbers(field.value);
                                
                                if (cnpjNumbers && cnpjNumbers.length === 14) {
                                  try {
                                    setIsLoadingCnpj(true);
                                    // Usar apenas números para consulta na API
                                    const response = await fetch(`/api/external/cnpj/${cnpjNumbers}`, {
                                      headers: {
                                        'Accept': 'application/json',
                                        'X-Requested-With': 'XmlHttpRequest'
                                      }
                                    });
                                    
                                    if (!response.ok) {
                                      throw new Error(`Erro ao consultar CNPJ: ${response.status}`);
                                    }
                                    
                                    const data = await response.json();
                                    
                                    if (!data.razao_social) {
                                      throw new Error('Não foi possível obter dados do CNPJ');
                                    }
                                    
                                    // Preencher os campos com os dados da empresa
                                    pjForm.setValue('name', data.razao_social);
                                    pjForm.setValue('tradeName', data.nome_fantasia || '');
                                    
                                    // Preencher endereço
                                    if (data.logradouro) pjForm.setValue('street', data.logradouro);
                                    if (data.numero) pjForm.setValue('number', data.numero);
                                    if (data.complemento) pjForm.setValue('complement', data.complemento);
                                    if (data.bairro) pjForm.setValue('district', data.bairro);
                                    if (data.cep) pjForm.setValue('zipCode', data.cep.replace(/\D/g, ''));
                                    if (data.municipio) pjForm.setValue('city', data.municipio);
                                    if (data.uf) pjForm.setValue('state', data.uf);
                                    
                                    toast({
                                      title: "CNPJ consultado com sucesso",
                                      description: "Dados preenchidos automaticamente",
                                    });
                                  } catch (error) {
                                    console.error("Erro ao consultar CNPJ:", error);
                                    
                                    toast({
                                      title: "Serviço de consulta CNPJ indisponível",
                                      description: "Não foi possível consultar o CNPJ automaticamente. Por favor, preencha os dados manualmente.",
                                      variant: "destructive",
                                    });
                                    
                                    // Se o CNPJ parece válido, habilitar os campos para preenchimento manual
                                    if (isValidCNPJ(field.value)) {
                                      toast({
                                        title: "Preenchimento manual habilitado",
                                        description: "Continue o cadastro preenchendo os dados manualmente.",
                                      });
                                    }
                                  } finally {
                                    setIsLoadingCnpj(false);
                                  }
                                }
                              }}
                            >
                              {isLoadingCnpj ? <LoadingSpinner size="sm" /> : <SearchIcon className="h-4 w-4" />}
                            </Button>
                          </div>
                          <FormDescription>
                            Informe o CNPJ com ou sem formatação (ex: 00.000.000/0000-00 ou 00000000000000)
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={pjForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Razão Social</FormLabel>
                        <FormControl>
                          <Input placeholder="Razão social" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={pjForm.control}
                    name="tradeName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome Fantasia</FormLabel>
                        <FormControl>
                          <Input placeholder="Nome Fantasia" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                {/* Informações de Contato */}
                <div className="space-y-4">
                  <h3 className="text-md font-medium">Informações de Contato</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={pjForm.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Telefone</FormLabel>
                          <FormControl>
                            <Input placeholder="(00) 00000-0000" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={pjForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>E-mail</FormLabel>
                          <FormControl>
                            <Input type="email" placeholder="email@empresa.com" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <FormField
                    control={pjForm.control}
                    name="legalResponsible"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Responsável Legal</FormLabel>
                        <FormControl>
                          <Input placeholder="Nome do responsável legal" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                {/* Endereço da Matriz */}
                <div className="space-y-4">
                  <h3 className="text-md font-medium">Endereço da Matriz</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={pjForm.control}
                      name="street"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Logradouro</FormLabel>
                          <FormControl>
                            <Input placeholder="Rua, Avenida, etc." {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={pjForm.control}
                        name="number"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Número</FormLabel>
                            <FormControl>
                              <Input placeholder="Nº" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={pjForm.control}
                        name="complement"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Complemento</FormLabel>
                            <FormControl>
                              <Input placeholder="Sala, conjunto, etc." {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    <FormField
                      control={pjForm.control}
                      name="district"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Bairro</FormLabel>
                          <FormControl>
                            <Input placeholder="Bairro" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={pjForm.control}
                      name="zipCode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>CEP</FormLabel>
                          <FormControl>
                            <Input placeholder="Somente números" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={pjForm.control}
                        name="city"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Cidade</FormLabel>
                            <FormControl>
                              <Input placeholder="Cidade" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={pjForm.control}
                        name="state"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>UF</FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              defaultValue={field.value}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="UF" />
                              </SelectTrigger>
                              <SelectContent>
                                {allBrazilianStates.map((state) => (
                                  <SelectItem key={state.code} value={state.code}>
                                    {state.code} - {state.name}
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
                </div>
                
                {/* Documentos Anexos */}
                <div className="space-y-4">
                  <h3 className="text-md font-medium">Documentos Anexos</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="socialContract">Contrato Social</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          id="socialContract"
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png"
                          onChange={(e) => handleFileChange(e, "socialContract")}
                          className="flex-1"
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="powerOfAttorney">Procuração (se aplicável)</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          id="powerOfAttorney"
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png"
                          onChange={(e) => handleFileChange(e, "powerOfAttorney")}
                          className="flex-1"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {/* Filiais */}
            <Card className="w-full overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Filiais</CardTitle>
                  <CardDescription>Adicione as filiais que serão incluídas na AET (opcional)</CardDescription>
                </div>
                <Button type="button" onClick={addSubsidiary}>
                  <Plus className="mr-2 h-4 w-4" />
                  Adicionar Filial
                </Button>
              </CardHeader>
              <CardContent className="space-y-6">
                {subsidiaries.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhuma filial cadastrada
                  </div>
                ) : (
                  <div className="space-y-8">
                    {subsidiaries.map((subsidiary, index) => (
                      <div key={index} className="border p-4 rounded-md space-y-4 relative">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-2 top-2"
                          onClick={() => removeSubsidiary(index)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>CNPJ Filial</Label>
                            <Input
                              value={subsidiary.cnpj}
                              onChange={(e) => updateSubsidiary(index, "cnpj", e.target.value)}
                              onBlur={(e) => {
                                // Ao sair do campo, formatar se contém apenas números
                                const value = e.target.value;
                                const numbersOnly = extractCNPJNumbers(value);
                                
                                if (numbersOnly.length === 14) {
                                  // Se tem 14 dígitos, formatar
                                  const formatted = formatCNPJ(value);
                                  updateSubsidiary(index, "cnpj", formatted);
                                }
                              }}
                              placeholder="00.000.000/0000-00 ou 00000000000000"
                            />
                          </div>
                          
                          <div className="space-y-2">
                            <Label>Razão Social</Label>
                            <Input
                              value={subsidiary.name}
                              onChange={(e) => updateSubsidiary(index, "name", e.target.value)}
                              placeholder="Razão social da filial"
                            />
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <Label>Nome Fantasia</Label>
                          <Input
                            value={subsidiary.tradeName || ""}
                            onChange={(e) => updateSubsidiary(index, "tradeName", e.target.value)}
                            placeholder="Nome fantasia da filial"
                          />
                        </div>
                        
                        <div className="space-y-4">
                          <h4 className="text-sm font-medium">Endereço da Filial</h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label>Logradouro</Label>
                              <Input
                                value={subsidiary.street || ""}
                                onChange={(e) => updateSubsidiary(index, "street", e.target.value)}
                                placeholder="Rua, Avenida, etc."
                              />
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label>Número</Label>
                                <Input
                                  value={subsidiary.number || ""}
                                  onChange={(e) => updateSubsidiary(index, "number", e.target.value)}
                                  placeholder="Nº"
                                />
                              </div>
                              
                              <div className="space-y-2">
                                <Label>Complemento</Label>
                                <Input
                                  value={subsidiary.complement || ""}
                                  onChange={(e) => updateSubsidiary(index, "complement", e.target.value)}
                                  placeholder="Complemento"
                                />
                              </div>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="space-y-2">
                              <Label>CEP</Label>
                              <Input
                                value={subsidiary.zipCode || ""}
                                onChange={(e) => updateSubsidiary(index, "zipCode", e.target.value)}
                                placeholder="CEP"
                              />
                            </div>
                            
                            <div className="space-y-2">
                              <Label>Cidade</Label>
                              <Input
                                value={subsidiary.city || ""}
                                onChange={(e) => updateSubsidiary(index, "city", e.target.value)}
                                placeholder="Cidade"
                              />
                            </div>
                            
                            <div className="space-y-2">
                              <Label>UF</Label>
                              <Select
                                value={subsidiary.state || ""}
                                onValueChange={(value) => updateSubsidiary(index, "state", value)}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="UF" />
                                </SelectTrigger>
                                <SelectContent>
                                  {allBrazilianStates.map((state) => (
                                    <SelectItem key={state.code} value={state.code}>
                                      {state.code} - {state.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <div className="flex items-center space-x-2">
                            <Checkbox id={`contractFile-${index}`} />
                            <Label htmlFor={`contractFile-${index}`}>Contrato Social (com alteração de filial)</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Checkbox id={`powerOfAttorneyFile-${index}`} />
                            <Label htmlFor={`powerOfAttorneyFile-${index}`}>Procuração (se aplicável)</Label>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
            
            <div className="flex justify-end mt-6">
              <Button type="submit" disabled={isPending}>
                {isPending ? (
                  <>
                    <LoadingSpinner size="sm" />
                    <span className="ml-2">Processando...</span>
                  </>
                ) : transporter ? (
                  "Atualizar Transportador"
                ) : (
                  "Cadastrar Transportador"
                )}
              </Button>
            </div>
          </form>
        </Form>
      )}
      
      {/* Formulário de Pessoa Física */}
      {personType === "pf" && (
        <Form {...pfForm}>
          <form onSubmit={pfForm.handleSubmit(onSubmit)} className="space-y-6">
            <Card className="w-full overflow-hidden">
              <CardHeader>
                <CardTitle>Dados do Transportador Autônomo</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* CPF e Nome */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={pfForm.control}
                    name="documentNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>CPF</FormLabel>
                        <FormControl>
                          <Input placeholder="Somente números" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={pfForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome Completo</FormLabel>
                        <FormControl>
                          <Input placeholder="Nome completo" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                {/* Data de nascimento e nacionalidade */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={pfForm.control}
                    name="birthDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Data de Nascimento</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={pfForm.control}
                    name="nationality"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nacionalidade</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: Brasileira" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                {/* Documento de Identidade */}
                <div className="space-y-4">
                  <h3 className="text-md font-medium">Documento de Identidade</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <FormField
                      control={pfForm.control}
                      name="idNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>RG</FormLabel>
                          <FormControl>
                            <Input placeholder="Número do RG" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={pfForm.control}
                      name="idIssuer"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Órgão Emissor</FormLabel>
                          <FormControl>
                            <Input placeholder="Ex: SSP" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={pfForm.control}
                      name="idState"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>UF</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="UF" />
                            </SelectTrigger>
                            <SelectContent>
                              {allBrazilianStates.map((state) => (
                                <SelectItem key={state.code} value={state.code}>
                                  {state.code} - {state.name}
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
                
                {/* Informações de Contato */}
                <div className="space-y-4">
                  <h3 className="text-md font-medium">Informações de Contato</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={pfForm.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Telefone</FormLabel>
                          <FormControl>
                            <Input placeholder="(00) 00000-0000" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={pfForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>E-mail</FormLabel>
                          <FormControl>
                            <Input type="email" placeholder="email@exemplo.com" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
                
                {/* Documentos Anexos */}
                <div className="space-y-4">
                  <h3 className="text-md font-medium">Documentos Anexos</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="rgCpfDoc">RG e CPF (frente e verso)</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          id="rgCpfDoc"
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png"
                          onChange={(e) => handleFileChange(e, "rgCpfDoc")}
                          className="flex-1"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <div className="flex justify-end mt-6">
              <Button type="submit" disabled={isPending}>
                {isPending ? (
                  <>
                    <LoadingSpinner size="sm" />
                    <span className="ml-2">Processando...</span>
                  </>
                ) : transporter ? (
                  "Atualizar Transportador"
                ) : (
                  "Cadastrar Transportador"
                )}
              </Button>
            </div>
          </form>
        </Form>
      )}
    </div>
  );
}