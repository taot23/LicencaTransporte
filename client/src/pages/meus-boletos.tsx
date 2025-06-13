import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, FileText, Receipt, Search, Filter, DollarSign, Calendar } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Boleto } from "@shared/schema";
import { AdminLayout } from "@/components/layout/admin-layout";

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
    const matchStatus = !filtroStatus || filtroStatus === "todos" || boleto.status === filtroStatus;
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
    link.click();
  };

  const exportToCSV = () => {
    const headers = ['Número', 'Transportador', 'CPF/CNPJ', 'Valor', 'Emissão', 'Vencimento', 'Status'];
    const csvContent = [
      headers.join(','),
      ...boletosFiltrados.map(boleto => [
        boleto.numeroBoleto,
        `"${boleto.nomeTransportador}"`,
        boleto.cpfCnpj,
        boleto.valor.replace(',', '.'),
        formatDate(new Date(boleto.dataEmissao)),
        formatDate(new Date(boleto.dataVencimento)),
        statusLabels[boleto.status as keyof typeof statusLabels]
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `meus-boletos-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Estatísticas resumidas
  const totalBoletos = boletosFiltrados.length;
  const valorTotal = boletosFiltrados.reduce((sum, boleto) => 
    sum + parseFloat(boleto.valor.replace(/[^\d,]/g, '').replace(',', '.')), 0
  );
  const boletosPendentes = boletosFiltrados.filter(b => b.status === 'pendente').length;
  const boletosVencidos = boletosFiltrados.filter(b => b.status === 'vencido').length;

  if (error) {
    return (
      <AdminLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Meus Boletos</h1>
            <p className="text-muted-foreground">Gerencie seus boletos financeiros</p>
          </div>
          <Card>
            <CardContent className="p-6">
              <p className="text-red-600">Erro ao carregar boletos. Tente novamente.</p>
            </CardContent>
          </Card>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Meus Boletos</h1>
            <p className="text-muted-foreground">Gerencie seus boletos financeiros</p>
          </div>
          <Button onClick={exportToCSV} variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Exportar CSV
          </Button>
        </div>

        {/* Estatísticas */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Boletos</CardTitle>
              <Receipt className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalBoletos}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Valor Total</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(valorTotal)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{boletosPendentes}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Vencidos</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{boletosVencidos}</div>
            </CardContent>
          </Card>
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
            <div className="grid gap-4 md:grid-cols-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Buscar</label>
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Número ou transportador..."
                    value={termoBusca}
                    onChange={(e) => setTermoBusca(e.target.value)}
                    className="pl-8"
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
                    <SelectItem value="todos">Todos os status</SelectItem>
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
              <div className="space-y-2">
                <label className="text-sm font-medium">Ações</label>
                <Button
                  variant="outline"
                  onClick={() => {
                    setFiltroStatus("todos");
                    setFiltroVencimento("");
                    setTermoBusca("");
                  }}
                  className="w-full"
                >
                  Limpar Filtros
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabela de Boletos */}
        <Card>
          <CardHeader>
            <CardTitle>Boletos ({boletosFiltrados.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center p-8">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                  <p className="mt-2 text-muted-foreground">Carregando boletos...</p>
                </div>
              </div>
            ) : boletosFiltrados.length === 0 ? (
              <div className="text-center p-8">
                <Receipt className="mx-auto h-12 w-12 text-muted-foreground" />
                <p className="mt-4 text-lg font-medium">Nenhum boleto encontrado</p>
                <p className="text-muted-foreground">
                  {boletos.length === 0 ? "Você ainda não possui boletos registrados." : "Tente ajustar os filtros para encontrar boletos."}
                </p>
              </div>
            ) : (
              <div className="rounded-md border">
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
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {boletosFiltrados.map((boleto) => (
                      <TableRow key={boleto.id}>
                        <TableCell className="font-medium">{boleto.numeroBoleto}</TableCell>
                        <TableCell>{boleto.nomeTransportador}</TableCell>
                        <TableCell>{boleto.cpfCnpj}</TableCell>
                        <TableCell>{formatCurrency(parseFloat(boleto.valor.replace(/[^\d,]/g, '').replace(',', '.')))}</TableCell>
                        <TableCell>
                          {boleto.dataEmissao ? formatDate(boleto.dataEmissao) : "-"}
                        </TableCell>
                        <TableCell>
                          {boleto.dataVencimento ? formatDate(boleto.dataVencimento) : "-"}
                        </TableCell>
                        <TableCell>
                          <Badge className={statusColors[boleto.status as keyof typeof statusColors]}>
                            {statusLabels[boleto.status as keyof typeof statusLabels]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {boleto.uploadBoletoUrl && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDownload(boleto.uploadBoletoUrl, `boleto-${boleto.numeroBoleto}.pdf`)}
                                title="Download Boleto"
                              >
                                <Receipt className="h-4 w-4" />
                              </Button>
                            )}
                            {boleto.uploadNfUrl && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDownload(boleto.uploadNfUrl, `nf-${boleto.numeroBoleto}.pdf`)}
                                title="Download Nota Fiscal"
                              >
                                <FileText className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}