import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, FileText, Receipt, Search, Filter, DollarSign, Calendar } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Boleto } from "@shared/schema";
import { UnifiedLayout } from "@/components/layout/unified-layout";
import { useToast } from "@/hooks/use-toast";
import { useWebSocketContext } from "@/hooks/use-websocket-context";

const getStatusBadgeVariant = (status: string) => {
  switch (status) {
    case "pago":
      return "default";
    case "pendente":
      return "secondary";
    case "vencido":
      return "destructive";
    case "cancelado":
      return "outline";
    default:
      return "secondary";
  }
};

const getStatusLabel = (status: string) => {
  switch (status) {
    case "pago":
      return "Pago";
    case "pendente":
      return "Aguardando Pagamento";
    case "vencido":
      return "Vencido";
    case "cancelado":
      return "Cancelado";
    default:
      return status;
  }
};

export default function MeusBoletos() {
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");
  const [filtroVencimento, setFiltroVencimento] = useState<string>("todos");
  const [termoBusca, setTermoBusca] = useState("");
  const { toast } = useToast();
  const { lastMessage } = useWebSocketContext();

  const { data: boletos = [], isLoading, error, refetch } = useQuery<Boleto[]>({
    queryKey: ["/api/meus-boletos"],
    refetchInterval: 30000, // Atualiza a cada 30 segundos
  });

  // Atualização em tempo real via WebSocket
  useEffect(() => {
    if (lastMessage?.type === 'DASHBOARD_UPDATE' || lastMessage?.type === 'USER_UPDATE') {
      refetch();
    }
  }, [lastMessage, refetch]);

  // Função para verificar se boleto está vencido
  const isVencido = (dataVencimento: string | Date) => {
    if (!dataVencimento) return false;
    return new Date(dataVencimento) < new Date();
  };

  // Filtrar boletos com lógica melhorada
  const boletosFiltrados = boletos.filter((boleto) => {
    // Filtro por status
    let matchStatus = true;
    if (filtroStatus && filtroStatus !== "todos") {
      if (filtroStatus === "aguardando_pagamento") {
        matchStatus = boleto.status === "pendente";
      } else if (filtroStatus === "vencido") {
        matchStatus = isVencido(boleto.dataVencimento);
      } else {
        matchStatus = boleto.status === filtroStatus;
      }
    }
    
    // Filtro por vencimento
    let matchVencimento = true;
    if (filtroVencimento && filtroVencimento !== "todos") {
      const hoje = new Date();
      const vencimento = new Date(boleto.dataVencimento);
      const seteDiasDepois = new Date();
      seteDiasDepois.setDate(hoje.getDate() + 7);
      
      if (filtroVencimento === "vencidos") {
        matchVencimento = vencimento < hoje;
      } else if (filtroVencimento === "vencendo") {
        matchVencimento = vencimento >= hoje && vencimento <= seteDiasDepois;
      } else if (filtroVencimento === "futuros") {
        matchVencimento = vencimento > seteDiasDepois;
      }
    }
    
    // Filtro de busca
    const matchBusca = !termoBusca || 
      boleto.numeroBoleto.toLowerCase().includes(termoBusca.toLowerCase()) ||
      boleto.nomeTransportador.toLowerCase().includes(termoBusca.toLowerCase()) ||
      boleto.cpfCnpj.includes(termoBusca);
    
    return matchStatus && matchVencimento && matchBusca;
  });

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

  const exportToCSV = () => {
    if (!boletosFiltrados || boletosFiltrados.length === 0) {
      toast({
        title: "Nenhum dado para exportar",
        description: "Não há boletos para exportar",
        variant: "destructive"
      });
      return;
    }

    const headers = ['Número', 'Transportador', 'CPF/CNPJ', 'Valor', 'Emissão', 'Vencimento', 'Status'];
    const csvContent = [
      headers.join(','),
      ...boletosFiltrados.map(boleto => [
        boleto.numeroBoleto,
        `"${boleto.nomeTransportador}"`,
        boleto.cpfCnpj,
        boleto.valor,
        boleto.dataEmissao ? formatDate(new Date(boleto.dataEmissao)) : "-",
        boleto.dataVencimento ? formatDate(new Date(boleto.dataVencimento)) : "-",
        getStatusLabel(boleto.status)
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

    toast({
      title: "Exportação concluída",
      description: `${boletosFiltrados.length} boletos exportados com sucesso`
    });
  };

  // Estatísticas resumidas
  const totalBoletos = boletosFiltrados.length;
  const valorTotal = boletosFiltrados.reduce((sum, boleto) => 
    sum + parseFloat(boleto.valor.toString().replace(/[^\d.,]/g, '').replace(',', '.')), 0
  );
  const boletosPendentes = boletosFiltrados.filter(b => b.status === 'pendente').length;
  const boletosVencidos = boletosFiltrados.filter(b => isVencido(b.dataVencimento)).length;

  if (error) {
    return (
      <UnifiedLayout>
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
      </UnifiedLayout>
    );
  }

  if (isLoading) {
    return (
      <UnifiedLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Meus Boletos</h1>
            <p className="text-muted-foreground">Gerencie seus boletos financeiros</p>
          </div>
          <Card>
            <CardContent className="p-6">
              <p>Carregando boletos...</p>
            </CardContent>
          </Card>
        </div>
      </UnifiedLayout>
    );
  }

  return (
    <UnifiedLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Meus Boletos</h1>
            <p className="text-muted-foreground">Gerencie seus boletos financeiros</p>
          </div>
          <Button onClick={exportToCSV} className="ml-4">
            <Download className="h-4 w-4 mr-2" />
            Exportar CSV
          </Button>
        </div>

        {/* Estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
              <div className="text-2xl font-bold">{boletosPendentes}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Vencidos</CardTitle>
              <Calendar className="h-4 w-4 text-red-500" />
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
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="busca">Buscar</Label>
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="busca"
                    placeholder="Número ou transportador..."
                    value={termoBusca}
                    onChange={(e) => setTermoBusca(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="filtro-status">Status</Label>
                <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos os status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os status</SelectItem>
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
                    <SelectValue placeholder="Período de vencimento" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="vencidos">Vencidos</SelectItem>
                    <SelectItem value="vencendo">Vencendo (7 dias)</SelectItem>
                    <SelectItem value="futuros">Futuros</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setFiltroStatus("todos");
                    setFiltroVencimento("todos");
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
        {boletosFiltrados.length === 0 ? (
          <Card>
            <CardContent className="py-8">
              <div className="text-center">
                <Receipt className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Nenhum boleto encontrado
                </h3>
                <p className="text-gray-500">
                  {boletos.length === 0 
                    ? "Ainda não há boletos cadastrados para você."
                    : "Nenhum boleto corresponde aos filtros aplicados."
                  }
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Boletos ({boletosFiltrados.length})</CardTitle>
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
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {boletosFiltrados.map((boleto: Boleto) => (
                    <TableRow key={boleto.id}>
                      <TableCell className="font-medium">
                        {boleto.numeroBoleto}
                      </TableCell>
                      <TableCell>{boleto.nomeTransportador}</TableCell>
                      <TableCell>{boleto.cpfCnpj}</TableCell>
                      <TableCell>{formatCurrency(parseFloat(boleto.valor.toString()))}</TableCell>
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
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </UnifiedLayout>
  );
}