import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Calendar, FileText, Upload } from "lucide-react";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

// Schema para validação do formulário
const boletoSchema = z.object({
  transportadorId: z.number().min(1, "Selecione um transportador"),
  nomeTransportador: z.string().min(1, "Nome do transportador é obrigatório"),
  cpfCnpj: z.string().regex(/^(\d{11}|\d{14})$/, "CPF deve ter 11 dígitos ou CNPJ deve ter 14 dígitos"),
  numeroBoleto: z.string().min(1, "Número do boleto é obrigatório"),
  valor: z.coerce.number().positive("O valor deve ser positivo"),
  dataEmissao: z.string().refine((date) => !isNaN(Date.parse(date)), {
    message: "Data de emissão inválida",
  }),
  dataVencimento: z.string().refine((date) => !isNaN(Date.parse(date)), {
    message: "Data de vencimento inválida",
  }),
  status: z.enum(["aguardando_pagamento", "pago", "vencido"]),
  observacoes: z.string().optional(),
}).refine((val) => {
  const emissao = new Date(val.dataEmissao);
  const vencimento = new Date(val.dataVencimento);
  return emissao < vencimento;
}, {
  message: "A data de emissão deve ser anterior à data de vencimento",
  path: ["dataVencimento"],
});

type BoletoFormData = z.infer<typeof boletoSchema>;

interface Transporter {
  id: number;
  name: string;
  documentNumber: string;
}

interface Boleto {
  id: number;
  transportadorId: number;
  nomeTransportador: string;
  cpfCnpj: string;
  numeroBoleto: string;
  valor: string;
  dataEmissao: string;
  dataVencimento: string;
  status: string;
  uploadBoletoUrl?: string;
  uploadNfUrl?: string;
  observacoes?: string;
}

interface BoletoFormProps {
  boleto?: Boleto | null;
  onSuccess: () => void;
  onCancel: () => void;
}

function BoletoForm({ boleto, onSuccess, onCancel }: BoletoFormProps) {
  const [uploadBoleto, setUploadBoleto] = useState<File | null>(null);
  const [uploadNf, setUploadNf] = useState<File | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Buscar transportadores para o select
  const { data: transporters = [] } = useQuery<Transporter[]>({
    queryKey: ["/api/admin/transporters"],
  });

  const form = useForm<BoletoFormData>({
    resolver: zodResolver(boletoSchema),
    defaultValues: {
      transportadorId: boleto?.transportadorId || 0,
      nomeTransportador: boleto?.nomeTransportador || "",
      cpfCnpj: boleto?.cpfCnpj || "",
      numeroBoleto: boleto?.numeroBoleto || "",
      valor: boleto ? parseFloat(boleto.valor) : 0,
      dataEmissao: boleto?.dataEmissao ? new Date(boleto.dataEmissao).toISOString().split('T')[0] : "",
      dataVencimento: boleto?.dataVencimento ? new Date(boleto.dataVencimento).toISOString().split('T')[0] : "",
      status: (boleto?.status as any) || "aguardando_pagamento",
      observacoes: boleto?.observacoes || "",
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: FormData) => apiRequest("/api/boletos", "POST", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/boletos"] });
      toast({
        title: "Sucesso",
        description: "Boleto criado com sucesso",
      });
      onSuccess();
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao criar boleto",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: FormData) => apiRequest(`/api/boletos/${boleto!.id}`, "PUT", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/boletos"] });
      toast({
        title: "Sucesso",
        description: "Boleto atualizado com sucesso",
      });
      onSuccess();
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao atualizar boleto",
        variant: "destructive",
      });
    },
  });

  // Atualizar dados do transportador quando selecionado
  const handleTransporterChange = (transporterId: string) => {
    const transporter = transporters.find(t => t.id === parseInt(transporterId));
    if (transporter) {
      form.setValue("transportadorId", transporter.id);
      form.setValue("nomeTransportador", transporter.name);
      form.setValue("cpfCnpj", transporter.documentNumber);
    }
  };

  const onSubmit = (data: BoletoFormData) => {
    const formData = new FormData();
    
    // Adicionar dados do boleto
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        formData.append(key, value.toString());
      }
    });

    // Adicionar arquivos se fornecidos
    if (uploadBoleto) {
      formData.append("uploadBoleto", uploadBoleto);
    }
    if (uploadNf) {
      formData.append("uploadNf", uploadNf);
    }

    if (boleto) {
      updateMutation.mutate(formData);
    } else {
      createMutation.mutate(formData);
    }
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Seleção de Transportador */}
          <FormField
            control={form.control}
            name="transportadorId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Transportador</FormLabel>
                <Select
                  value={field.value?.toString()}
                  onValueChange={handleTransporterChange}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um transportador" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {transporters.map((transporter) => (
                      <SelectItem key={transporter.id} value={transporter.id.toString()}>
                        {transporter.name} - {transporter.documentNumber}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Número do Boleto */}
          <FormField
            control={form.control}
            name="numeroBoleto"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Número do Boleto</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="Ex: 001234567890" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Valor */}
          <FormField
            control={form.control}
            name="valor"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Valor (R$)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    {...field}
                    placeholder="0,00"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Status */}
          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Status</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="aguardando_pagamento">Aguardando Pagamento</SelectItem>
                    <SelectItem value="pago">Pago</SelectItem>
                    <SelectItem value="vencido">Vencido</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Data de Emissão */}
          <FormField
            control={form.control}
            name="dataEmissao"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Data de Emissão</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Data de Vencimento */}
          <FormField
            control={form.control}
            name="dataVencimento"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Data de Vencimento</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Upload de Arquivos */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="uploadBoleto">Arquivo do Boleto (PDF)</Label>
            <div className="mt-1">
              <Input
                id="uploadBoleto"
                type="file"
                accept=".pdf"
                onChange={(e) => setUploadBoleto(e.target.files?.[0] || null)}
                className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
              {boleto?.uploadBoletoUrl && (
                <p className="text-sm text-gray-500 mt-1">
                  Arquivo atual: <a href={boleto.uploadBoletoUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Ver arquivo</a>
                </p>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="uploadNf">Nota Fiscal (PDF)</Label>
            <div className="mt-1">
              <Input
                id="uploadNf"
                type="file"
                accept=".pdf"
                onChange={(e) => setUploadNf(e.target.files?.[0] || null)}
                className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
              />
              {boleto?.uploadNfUrl && (
                <p className="text-sm text-gray-500 mt-1">
                  Arquivo atual: <a href={boleto.uploadNfUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Ver arquivo</a>
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Observações */}
        <FormField
          control={form.control}
          name="observacoes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Observações</FormLabel>
              <FormControl>
                <Textarea
                  {...field}
                  placeholder="Informações adicionais sobre o boleto..."
                  rows={3}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Botões de Ação */}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? "Salvando..." : boleto ? "Atualizar" : "Criar Boleto"}
          </Button>
        </div>
      </form>
    </Form>
  );
}

export { BoletoForm };