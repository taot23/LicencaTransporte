import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus, Edit, Download, FileText, Receipt } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AdminLayout } from "@/components/layout/admin-layout";
import { exportToCSV, formatDateForCSV, formatCurrencyForCSV } from "@/lib/csv-export";
import { SmartUpload } from "@/components/smart-upload";

// Schema de validação para o formulário de boleto
const boletoFormSchema = z.object({
  transportadorId: z.coerce.number().min(1, "Selecione um transportador"),
  nomeTransportador: z.string().min(1, "Nome do transportador é obrigatório"),
  cpfCnpj: z.string().min(11, "CPF/CNPJ é obrigatório"),
  numeroBoleto: z.string().min(1, "Número do boleto é obrigatório"),
  valor: z.coerce.number().positive("Valor deve ser positivo"),
  dataEmissao: z.string().min(1, "Data de emissão é obrigatória"),
  dataVencimento: z.string().min(1, "Data de vencimento é obrigatória"),
  status: z.string().min(1, "Status é obrigatório"),
  observacoes: z.string().optional(),
});

type BoletoFormData = z.infer<typeof boletoFormSchema>;

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
  criadoEm: string;
  atualizadoEm: string;
}

export default function BoletosPage() {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingBoleto, setEditingBoleto] = useState<Boleto | null>(null);
  const [uploadBoleto, setUploadBoleto] = useState<File | null>(null);
  const [uploadNf, setUploadNf] = useState<File | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: boletos = [], isLoading } = useQuery({
    queryKey: ["/api/boletos"],
  });

  const { data: transporters = [] } = useQuery({
    queryKey: ["/api/admin/transporters"],
  });

  // Configuração do formulário
  const form = useForm<BoletoFormData>({
    resolver: zodResolver(boletoFormSchema),
    defaultValues: {
      transportadorId: 0,
      nomeTransportador: "",
      cpfCnpj: "",
      numeroBoleto: "",
      valor: 0,
      dataEmissao: new Date().toISOString().split('T')[0],
      dataVencimento: "",
      status: "aguardando_pagamento",
      observacoes: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: BoletoFormData) => apiRequest("/api/boletos", "POST", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/boletos"] });
      toast({
        title: "Boleto criado",
        description: "Boleto criado com sucesso",
      });
      handleFormClose();
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao criar boleto",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: BoletoFormData }) =>
      apiRequest(`/api/boletos/${id}`, "PATCH", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/boletos"] });
      toast({
        title: "Boleto atualizado",
        description: "Boleto atualizado com sucesso",
      });
      handleFormClose();
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao atualizar boleto",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/boletos/${id}`, "DELETE"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/boletos"] });
      toast({
        title: "Sucesso",
        description: "Boleto excluído com sucesso",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao excluir boleto",
        variant: "destructive",
      });
    },
  });

  const handleEdit = (boleto: Boleto) => {
    setEditingBoleto(boleto);
    
    // Preencher o formulário com os dados do boleto
    form.reset({
      transportadorId: boleto.transportadorId,
      nomeTransportador: boleto.nomeTransportador,
      cpfCnpj: boleto.cpfCnpj,
      numeroBoleto: boleto.numeroBoleto,
      valor: parseFloat(boleto.valor),
      dataEmissao: new Date(boleto.dataEmissao).toISOString().split('T')[0],
      dataVencimento: new Date(boleto.dataVencimento).toISOString().split('T')[0],
      status: boleto.status,
      observacoes: boleto.observacoes || "",
    });
    
    setIsFormOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (confirm("Tem certeza que deseja excluir este boleto?")) {
      deleteMutation.mutate(id);
    }
  };

  const handleFormClose = () => {
    setIsFormOpen(false);
    setEditingBoleto(null);
    form.reset();
  };

  const handleTransporterChange = (transporterId: string) => {
    const transporter = transporters.find((t: any) => t.id === parseInt(transporterId));
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

    if (editingBoleto) {
      updateMutation.mutate({ id: editingBoleto.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "pago":
        return "default";
      case "vencido":
        return "destructive";
      default:
        return "secondary";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "aguardando_pagamento":
        return "Aguardando Pagamento";
      case "pago":
        return "Pago";
      case "vencido":
        return "Vencido";
      default:
        return status;
    }
  };

  const isVencido = (dataVencimento: string) => {
    return new Date(dataVencimento) < new Date();
  };

  const handleExportCSV = () => {
    if (!boletos || boletos.length === 0) {
      toast({
        title: "Nenhum dado para exportar",
        description: "Não há boletos para exportar",
        variant: "destructive",
      });
      return;
    }

    try {
      const headers = [
        "ID",
        "Transportador", 
        "CPF/CNPJ",
        "Número do Boleto",
        "Valor",
        "Data Emissão",
        "Data Vencimento", 
        "Status",
        "Observações",
        "Criado em"
      ];

      const formattedData = boletos.map(boleto => ({
        ID: boleto.id,
        Transportador: boleto.nomeTransportador,
        "CPF/CNPJ": boleto.cpfCnpj,
        "Número do Boleto": boleto.numeroBoleto,
        Valor: formatCurrencyForCSV(boleto.valor),
        "Data Emissão": formatDateForCSV(boleto.dataEmissao),
        "Data Vencimento": formatDateForCSV(boleto.dataVencimento),
        Status: boleto.status === "aguardando_pagamento" ? "Aguardando Pagamento" :
                boleto.status === "pago" ? "Pago" :
                boleto.status === "vencido" ? "Vencido" : boleto.status,
        Observações: boleto.observacoes || "",
        "Criado em": formatDateForCSV(boleto.criadoEm)
      }));

      exportToCSV({
        filename: "boletos",
        headers,
        data: formattedData
      });

      toast({
        title: "Exportação concluída",
        description: `${boletos.length} boletos exportados com sucesso`,
      });
    } catch (error) {
      toast({
        title: "Erro na exportação",
        description: "Ocorreu um erro ao exportar os dados",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Carregando boletos...</div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Módulo Financeiro</h1>
          <p className="text-gray-600 mt-1">
            Gerencie boletos e pagamentos dos transportadores
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            disabled={isLoading}
            title="Exportar dados dos boletos"
          >
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>
          <Button
            onClick={() => setIsFormOpen(true)}
            size="sm"
          >
            <Plus className="h-4 w-4 mr-2" />
            Novo Boleto
          </Button>
        </div>
      </div>

      {boletos.length === 0 ? (
        <Card>
          <CardContent className="py-8">
            <div className="text-center">
              <Receipt className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Nenhum boleto encontrado
              </h3>
              <p className="text-gray-500 mb-4">
                Ainda não há boletos cadastrados no sistema.
              </p>
              <Button onClick={() => setIsFormOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Criar Primeiro Boleto
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Lista de Boletos ({boletos.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Número</TableHead>
                  <TableHead>Transportador</TableHead>
                  <TableHead>CPF/CNPJ</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Emissão</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Arquivos</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {boletos.map((boleto: Boleto) => (
                  <TableRow key={boleto.id}>
                    <TableCell className="font-medium">
                      {boleto.numeroBoleto}
                    </TableCell>
                    <TableCell>{boleto.nomeTransportador}</TableCell>
                    <TableCell>{boleto.cpfCnpj}</TableCell>
                    <TableCell>{formatCurrency(parseFloat(boleto.valor))}</TableCell>
                    <TableCell>{formatDate(boleto.dataEmissao)}</TableCell>
                    <TableCell>
                      <div className={isVencido(boleto.dataVencimento) ? "text-red-600" : ""}>
                        {formatDate(boleto.dataVencimento)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(boleto.status)}>
                        {getStatusLabel(boleto.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {boleto.uploadBoletoUrl && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(boleto.uploadBoletoUrl, "_blank")}
                          >
                            <Download className="h-3 w-3" />
                          </Button>
                        )}
                        {boleto.uploadNfUrl && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(boleto.uploadNfUrl, "_blank")}
                          >
                            <FileText className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(boleto)}
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(boleto.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={isFormOpen} onOpenChange={handleFormClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingBoleto ? "Editar Boleto" : "Novo Boleto"}
            </DialogTitle>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 p-4">
              {!editingBoleto && (
                <FormField
                  control={form.control}
                  name="transportadorId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Transportador</FormLabel>
                      <Select 
                        onValueChange={handleTransporterChange}
                        value={field.value ? field.value.toString() : ""}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione um transportador" />
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
              )}

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="nomeTransportador"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome do Transportador</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Nome do transportador" readOnly />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="cpfCnpj"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>CPF/CNPJ</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="CPF/CNPJ" readOnly />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="numeroBoleto"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Número do Boleto</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Número do boleto" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="valor"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valor</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="R$ 0,00" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="dataEmissao"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data de Emissão</FormLabel>
                      <FormControl>
                        <Input {...field} type="date" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="dataVencimento"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data de Vencimento</FormLabel>
                      <FormControl>
                        <Input {...field} type="date" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="pendente">Pendente</SelectItem>
                        <SelectItem value="aguardando_pagamento">Aguardando Pagamento</SelectItem>
                        <SelectItem value="pago">Pago</SelectItem>
                        <SelectItem value="vencido">Vencido</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="observacoes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Observações</FormLabel>
                    <FormControl>
                      <Textarea 
                        {...field} 
                        placeholder="Observações opcionais"
                        rows={3}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Upload do Boleto (PDF)</Label>
                  <SmartUpload
                    onFileChange={setUploadBoleto}
                    accept=".pdf"
                    maxSize={10 * 1024 * 1024}
                    label="Arraste o arquivo PDF do boleto aqui"
                    description="Arquivo PDF até 10MB"
                    currentFileUrl={editingBoleto?.uploadBoletoUrl}
                    currentFileName="Boleto atual"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Upload da Nota Fiscal (PDF)</Label>
                  <SmartUpload
                    onFileChange={setUploadNf}
                    accept=".pdf"
                    maxSize={10 * 1024 * 1024}
                    label="Arraste o arquivo PDF da NF aqui"
                    description="Arquivo PDF até 10MB"
                    currentFileUrl={editingBoleto?.uploadNfUrl}
                    currentFileName="Nota Fiscal atual"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <Button type="button" variant="outline" onClick={handleFormClose}>
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {createMutation.isPending || updateMutation.isPending ? "Salvando..." : "Salvar"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}