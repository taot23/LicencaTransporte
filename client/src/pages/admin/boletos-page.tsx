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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Sidebar } from "@/components/layout/sidebar";

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
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: boletos = [], isLoading } = useQuery({
    queryKey: ["/api/boletos"],
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
      const { exportToCSV, formatDateForCSV, formatStatusForCSV } = require("@/lib/csv-export");
      
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
        id: boleto.id,
        transportador: boleto.nomeTransportador,
        "cpf/cnpj": boleto.cpfCnpj,
        "número do boleto": boleto.numeroBoleto,
        valor: boleto.valor,
        "data emissão": formatDateForCSV(boleto.dataEmissao),
        "data vencimento": formatDateForCSV(boleto.dataVencimento),
        status: formatStatusForCSV(boleto.status),
        observações: boleto.observacoes || "",
        "criado em": formatDateForCSV(boleto.criadoEm)
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
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-lg">Carregando boletos...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 overflow-hidden">
        <div className="h-full overflow-y-auto">
          <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Módulo Financeiro</h1>
                <p className="text-gray-600 mt-2">
                  Gerencie boletos e pagamentos dos transportadores
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleExportCSV}
                  className="flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Exportar
                </Button>
                <Button
                  onClick={() => setIsFormOpen(true)}
                  className="flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
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
                <div className="p-4">
                  <p className="text-center text-gray-500">
                    Formulário de boletos em desenvolvimento
                  </p>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>
    </div>
  );
}