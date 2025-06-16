import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus, Edit, Download, FileText, Receipt, Filter } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useCallback, useState as useReactState } from "react";
import { Upload, X, File, Eye } from "lucide-react";
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

// Schema de validação para o formulário de boleto
const boletoFormSchema = z.object({
  transportadorId: z.number().min(1, "Selecione um transportador"),
  nomeTransportador: z.string().min(1, "Nome do transportador é obrigatório"),
  cpfCnpj: z.string().min(11, "CPF/CNPJ é obrigatório"),
  numeroBoleto: z.string().min(1, "Número do boleto é obrigatório"),
  valor: z.string().min(1, "Valor é obrigatório"),
  dataEmissao: z.string().min(1, "Data de emissão é obrigatória"),
  dataVencimento: z.string().min(1, "Data de vencimento é obrigatória"),
  status: z.string().min(1, "Status é obrigatório"),
  observacoes: z.string().optional(),
  uploadBoletoUrl: z.string().optional(),
  uploadNfUrl: z.string().optional(),
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
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");
  const [filtroVencimento, setFiltroVencimento] = useState<string>("todos");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: boletos = [], isLoading } = useQuery({
    queryKey: ["/api/boletos", filtroStatus, filtroVencimento],
    queryFn: () => {
      const params = new URLSearchParams();
      if (filtroStatus !== "todos") params.set("status", filtroStatus);
      if (filtroVencimento !== "todos") params.set("vencimento", filtroVencimento);
      params.set("_t", Date.now().toString()); // Quebra cache
      
      return fetch(`/api/boletos?${params.toString()}`, {
        headers: { 
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      }).then(res => res.json());
    },
    refetchInterval: 30000, // Atualização automática a cada 30 segundos
    refetchOnWindowFocus: true,
    staleTime: 0, // Dados sempre considerados obsoletos
  });

  const { data: transporters = [] } = useQuery({
    queryKey: ["/api/admin/transporters"],
  });

  // Estados para controlar uploads
  const [uploadedBoleto, setUploadedBoleto] = useReactState<File | null>(null);
  const [uploadedNf, setUploadedNf] = useReactState<File | null>(null);
  const [uploading, setUploading] = useReactState(false);
  
  // Estado para controlar dialog de confirmação de exclusão
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; boletoId: number | null }>({
    open: false,
    boletoId: null
  });

  // Configuração do formulário
  const form = useForm<BoletoFormData>({
    resolver: zodResolver(boletoFormSchema),
    defaultValues: {
      transportadorId: 0,
      nomeTransportador: "",
      cpfCnpj: "",
      numeroBoleto: "",
      valor: "",
      dataEmissao: new Date().toISOString().split('T')[0],
      dataVencimento: "",
      status: "pendente",
      observacoes: "",
      uploadBoletoUrl: "",
      uploadNfUrl: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: BoletoFormData) => apiRequest("POST", "/api/boletos", data),
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
      apiRequest("PATCH", `/api/boletos/${id}`, data),
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
    mutationFn: (id: number) => apiRequest("DELETE", `/api/boletos/${id}`),
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
      valor: boleto.valor,
      dataEmissao: new Date(boleto.dataEmissao).toISOString().split('T')[0],
      dataVencimento: new Date(boleto.dataVencimento).toISOString().split('T')[0],
      status: boleto.status,
      observacoes: boleto.observacoes || "",
      uploadBoletoUrl: boleto.uploadBoletoUrl || "",
      uploadNfUrl: boleto.uploadNfUrl || "",
    });
    
    setIsFormOpen(true);
  };

  const handleDelete = (id: number) => {
    setDeleteDialog({ open: true, boletoId: id });
  };

  const confirmDelete = () => {
    if (deleteDialog.boletoId) {
      deleteMutation.mutate(deleteDialog.boletoId);
      setDeleteDialog({ open: false, boletoId: null });
    }
  };

  const cancelDelete = () => {
    setDeleteDialog({ open: false, boletoId: null });
  };

  const handleFormClose = () => {
    setIsFormOpen(false);
    setEditingBoleto(null);
    setUploadedBoleto(null);
    setUploadedNf(null);
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

  // Função para upload de arquivos
  const uploadFile = async (file: File, type: string): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type);

    const response = await fetch('/api/upload/boleto', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error('Erro no upload do arquivo');
    }

    const result = await response.json();
    return result.url;
  };

  const handleFileUpload = async (file: File, type: 'boleto' | 'nf') => {
    // Validar arquivo
    if (file.type !== 'application/pdf') {
      toast({
        title: "Arquivo inválido",
        description: "Apenas arquivos PDF são aceitos",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 10 * 1024 * 1024) { // 10MB
      toast({
        title: "Arquivo muito grande",
        description: "O arquivo deve ter no máximo 10MB",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    try {
      const url = await uploadFile(file, type);
      
      if (type === 'boleto') {
        setUploadedBoleto(file);
        form.setValue('uploadBoletoUrl', url);
      } else {
        setUploadedNf(file);
        form.setValue('uploadNfUrl', url);
      }

      toast({
        title: "Upload realizado",
        description: `${type === 'boleto' ? 'Boleto' : 'Nota Fiscal'} enviado com sucesso`,
      });
    } catch (error) {
      toast({
        title: "Erro no upload",
        description: "Erro ao enviar arquivo. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const onSubmit = async (data: BoletoFormData) => {
    // Manter as datas como strings ISO para o schema Zod
    if (editingBoleto) {
      updateMutation.mutate({ id: editingBoleto.id, data });
    } else {
      createMutation.mutate(data);
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

  const handleDownloadFile = (url: string, fileName: string) => {
    if (!url) {
      toast({
        title: "Erro",
        description: "Arquivo não encontrado",
        variant: "destructive"
      });
      return;
    }
    
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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

      {/* Filtros */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="filtro-status">Status</Label>
              <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="aguardando_pagamento">Aguardando Pagamento</SelectItem>
                  <SelectItem value="pago">Pago</SelectItem>
                  <SelectItem value="vencido">Vencido</SelectItem>
                  <SelectItem value="pendente">Pendente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="filtro-vencimento">Vencimento</Label>
              <Select value={filtroVencimento} onValueChange={setFiltroVencimento}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione período" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="vencidos">Vencidos</SelectItem>
                  <SelectItem value="vencendo">Vencendo (7 dias)</SelectItem>
                  <SelectItem value="futuros">Futuros</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

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
                    <TableCell>
                      {boleto.dataEmissao ? formatDate(new Date(boleto.dataEmissao)) : "-"}
                    </TableCell>
                    <TableCell>
                      <div className={isVencido(boleto.dataVencimento) ? "text-red-600" : ""}>
                        {boleto.dataVencimento ? formatDate(new Date(boleto.dataVencimento)) : "-"}
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
                            onClick={() => handleDownloadFile(boleto.uploadBoletoUrl!, `boleto-${boleto.numeroBoleto}.pdf`)}
                            title="Baixar boleto"
                          >
                            <Receipt className="h-3 w-3" />
                          </Button>
                        )}
                        {boleto.uploadNfUrl && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDownloadFile(boleto.uploadNfUrl!, `nf-${boleto.numeroBoleto}.pdf`)}
                            title="Baixar nota fiscal"
                          >
                            <FileText className="h-3 w-3" />
                          </Button>
                        )}
                        {!boleto.uploadBoletoUrl && !boleto.uploadNfUrl && (
                          <span className="text-sm text-gray-500">Sem arquivos</span>
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

              {/* Upload de Boleto */}
              <div className="space-y-2">
                <Label>Upload do Boleto (PDF)</Label>
                <div 
                  className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                    uploading ? 'border-gray-300 bg-gray-50' : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'
                  }`}
                  onDrop={(e) => {
                    e.preventDefault();
                    const files = e.dataTransfer.files;
                    if (files.length > 0) {
                      handleFileUpload(files[0], 'boleto');
                    }
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onDragEnter={(e) => e.preventDefault()}
                >
                  {uploadedBoleto ? (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <File className="h-5 w-5 text-red-600" />
                        <span className="text-sm">{uploadedBoleto.name}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (form.getValues('uploadBoletoUrl')) {
                              window.open(form.getValues('uploadBoletoUrl'), '_blank');
                            }
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setUploadedBoleto(null);
                            form.setValue('uploadBoletoUrl', '');
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <Upload className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                      <p className="text-sm text-gray-600 mb-2">
                        Arraste e solte o arquivo do boleto aqui, ou clique para selecionar
                      </p>
                      <p className="text-xs text-gray-500">PDF • Máx. 10MB</p>
                      <Input
                        type="file"
                        accept=".pdf"
                        onChange={(e) => {
                          const files = e.target.files;
                          if (files && files.length > 0) {
                            handleFileUpload(files[0], 'boleto');
                          }
                        }}
                        className="hidden"
                        id="boleto-upload"
                        disabled={uploading}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => document.getElementById('boleto-upload')?.click()}
                        disabled={uploading}
                        className="mt-2"
                      >
                        {uploading ? "Enviando..." : "Selecionar Arquivo"}
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {/* Upload de Nota Fiscal */}
              <div className="space-y-2">
                <Label>Upload da Nota Fiscal (PDF)</Label>
                <div 
                  className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                    uploading ? 'border-gray-300 bg-gray-50' : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'
                  }`}
                  onDrop={(e) => {
                    e.preventDefault();
                    const files = e.dataTransfer.files;
                    if (files.length > 0) {
                      handleFileUpload(files[0], 'nf');
                    }
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onDragEnter={(e) => e.preventDefault()}
                >
                  {uploadedNf ? (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <File className="h-5 w-5 text-red-600" />
                        <span className="text-sm">{uploadedNf.name}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (form.getValues('uploadNfUrl')) {
                              window.open(form.getValues('uploadNfUrl'), '_blank');
                            }
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setUploadedNf(null);
                            form.setValue('uploadNfUrl', '');
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <Upload className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                      <p className="text-sm text-gray-600 mb-2">
                        Arraste e solte o arquivo da nota fiscal aqui, ou clique para selecionar
                      </p>
                      <p className="text-xs text-gray-500">PDF • Máx. 10MB</p>
                      <Input
                        type="file"
                        accept=".pdf"
                        onChange={(e) => {
                          const files = e.target.files;
                          if (files && files.length > 0) {
                            handleFileUpload(files[0], 'nf');
                          }
                        }}
                        className="hidden"
                        id="nf-upload"
                        disabled={uploading}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => document.getElementById('nf-upload')?.click()}
                        disabled={uploading}
                        className="mt-2"
                      >
                        {uploading ? "Enviando..." : "Selecionar Arquivo"}
                      </Button>
                    </div>
                  )}
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

      {/* Dialog de confirmação de exclusão */}
      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => !open && cancelDelete()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este boleto? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelDelete}>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}