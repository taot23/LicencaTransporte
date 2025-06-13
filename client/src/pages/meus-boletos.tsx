import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, FileText, Receipt, Search, Filter } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Boleto } from "@shared/schema";

const statusColors = {
  "pendente": "bg-yellow-100 text-yellow-800",
  "pago": "bg-green-100 text-green-800",
  "vencido": "bg-red-100 text-red-800",
  "cancelado": "bg-gray-100 text-gray-800",
};

const statusLabels = {
  "pendente": "Aguardando Pagamento",
  "pago": "Pago",
  "vencido": "Vencido",
  "cancelado": "Cancelado",
};

export default function MeusBoletos() {
  const [filtroStatus, setFiltroStatus] = useState<string>("");
  const [filtroVencimento, setFiltroVencimento] = useState<string>("");
  const [termoBusca, setTermoBusca] = useState("");

  const { data: boletos = [], isLoading, error } = useQuery<Boleto[]>({
    queryKey: ["/api/meus-boletos"],
  });

  // Filtrar boletos
  const boletosFiltrados = boletos.filter((boleto) => {
    const matchStatus = !filtroStatus || boleto.status === filtroStatus;
    const matchVencimento = !filtroVencimento || 
      new Date(boleto.dataVencimento).toISOString().split('T')[0] >= filtroVencimento;
    const matchBusca = !termoBusca || 
      boleto.numeroBoleto.toLowerCase().includes(termoBusca.toLowerCase()) ||
      boleto.nomeTransportador.toLowerCase().includes(termoBusca.toLowerCase());
    
    return matchStatus && matchVencimento && matchBusca;
  });

  const handleDownload = (url: string | null, filename: string) => {
    if (!url) return;
    
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">Carregando seus boletos...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-red-600">
              Erro ao carregar boletos. Verifique se você tem permissão para acessar esta página.
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Meus Boletos</h1>
          <p className="text-muted-foreground">
            Visualize e baixe seus boletos e notas fiscais
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Receipt className="h-5 w-5" />
          <span className="text-sm font-medium">
            {boletosFiltrados.length} boleto(s) encontrado(s)
          </span>
        </div>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Buscar</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Número do boleto ou transportador..."
                  value={termoBusca}
                  onChange={(e) => setTermoBusca(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos os status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todos os status</SelectItem>
                  <SelectItem value="pendente">Aguardando Pagamento</SelectItem>
                  <SelectItem value="pago">Pago</SelectItem>
                  <SelectItem value="vencido">Vencido</SelectItem>
                  <SelectItem value="cancelado">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Vencimento a partir de</label>
              <Input
                type="date"
                value={filtroVencimento}
                onChange={(e) => setFiltroVencimento(e.target.value)}
              />
            </div>
          </div>

          {(filtroStatus || filtroVencimento || termoBusca) && (
            <div className="mt-4 pt-4 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setFiltroStatus("");
                  setFiltroVencimento("");
                  setTermoBusca("");
                }}
              >
                Limpar Filtros
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabela de Boletos */}
      <Card>
        <CardHeader>
          <CardTitle>Seus Boletos</CardTitle>
        </CardHeader>
        <CardContent>
          {boletosFiltrados.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {boletos.length === 0 
                ? "Nenhum boleto encontrado." 
                : "Nenhum boleto corresponde aos filtros aplicados."
              }
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nº Boleto</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Emissão</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Boleto</TableHead>
                    <TableHead>Nota Fiscal</TableHead>
                    <TableHead>Observações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {boletosFiltrados.map((boleto) => (
                    <TableRow key={boleto.id}>
                      <TableCell className="font-medium">
                        {boleto.numeroBoleto}
                      </TableCell>
                      <TableCell className="font-semibold">
                        {formatCurrency(boleto.valor)}
                      </TableCell>
                      <TableCell>
                        {formatDate(boleto.dataEmissao)}
                      </TableCell>
                      <TableCell>
                        {formatDate(boleto.dataVencimento)}
                      </TableCell>
                      <TableCell>
                        <Badge 
                          className={statusColors[boleto.status as keyof typeof statusColors] || "bg-gray-100 text-gray-800"}
                          variant="secondary"
                        >
                          {statusLabels[boleto.status as keyof typeof statusLabels] || boleto.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {boleto.uploadBoletoUrl ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDownload(boleto.uploadBoletoUrl, `boleto-${boleto.numeroBoleto}.pdf`)}
                            className="flex items-center gap-1"
                          >
                            <Download className="h-4 w-4" />
                            PDF
                          </Button>
                        ) : (
                          <span className="text-gray-400 text-sm">Não disponível</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {boleto.uploadNfUrl ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDownload(boleto.uploadNfUrl, `nf-${boleto.numeroBoleto}.pdf`)}
                            className="flex items-center gap-1"
                          >
                            <FileText className="h-4 w-4" />
                            NF
                          </Button>
                        ) : (
                          <span className="text-gray-400 text-sm">Não disponível</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {boleto.observacoes ? (
                          <span className="text-sm text-gray-600">
                            {boleto.observacoes.length > 50 
                              ? `${boleto.observacoes.substring(0, 50)}...`
                              : boleto.observacoes
                            }
                          </span>
                        ) : (
                          <span className="text-gray-400 text-sm">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Resumo */}
      {boletosFiltrados.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Resumo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">
                  {boletosFiltrados.filter(b => b.status === 'pendente').length}
                </div>
                <div className="text-sm text-gray-600">Aguardando Pagamento</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {boletosFiltrados.filter(b => b.status === 'pago').length}
                </div>
                <div className="text-sm text-gray-600">Pagos</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">
                  {boletosFiltrados.filter(b => b.status === 'vencido').length}
                </div>
                <div className="text-sm text-gray-600">Vencidos</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {formatCurrency(
                    boletosFiltrados
                      .filter(b => b.status === 'pendente')
                      .reduce((sum, b) => sum + parseFloat(b.valor.replace(/[^\d,]/g, '').replace(',', '.')), 0)
                      .toString()
                  )}
                </div>
                <div className="text-sm text-gray-600">Total Pendente</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}