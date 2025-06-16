import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AdminLayout } from "@/components/layout/admin-layout";
import { formatCurrency, formatDate, getLicenseTypeLabel } from "@/lib/utils";
import { 
  FileText, 
  CheckCircle, 
  Clock, 
  XCircle, 
  Truck, 
  Receipt, 
  DollarSign,
  TrendingUp,
  Calendar,
  MapPin
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

interface DashboardAETData {
  aetsSolicitadasHoje: number;
  aetsEmitidasHoje: number;
  aetsPendentes: number;
  aetsVencidasHoje: number;
  totalVeiculos: number;
  boletosHoje: number;
  valorBoletosHoje: number;
  porEstado: Array<{ name: string; value: number }>;
  porTipoVeiculo: Array<{ name: string; value: number; color: string }>;
  ultimosBoletos: Array<{
    id: number;
    numeroBoleto: string;
    nomeTransportador: string;
    valor: string;
    status: string;
    dataVencimento: string;
  }>;
  ultimasLicencas: Array<{
    id: number;
    requestNumber: string;
    mainVehiclePlate: string;
    type: string;
    status: string;
    createdAt: string;
    transporterName: string;
  }>;
  licencasPorStatus7Dias: Array<{
    data: string;
    solicitada: number;
    emitida: number;
    recusada: number;
    expirada: number;
  }>;
}

const CORES_GRAFICO = [
  "#8884d8", "#82ca9d", "#ffc658", "#ff7300", "#8dd1e1", "#d084d0", "#ffb347"
];

export default function DashboardAET() {
  const queryClient = useQueryClient();
  const [lastUpdate, setLastUpdate] = useState(new Date());

  const { data: dashboardData, isLoading, error } = useQuery<DashboardAETData>({
    queryKey: ["/api/dashboard/aet"],
    refetchInterval: 30000, // Atualiza a cada 30 segundos
  });

  // WebSocket para atualizações em tempo real
  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    const socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      console.log("[DASHBOARD] WebSocket conectado");
    };

    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        console.log("[DASHBOARD] Mensagem WebSocket recebida:", message.type);
        
        // Atualiza o dashboard em mudanças relevantes
        if (['LICENSE_UPDATE', 'DASHBOARD_UPDATE', 'STATUS_UPDATE'].includes(message.type)) {
          console.log("[DASHBOARD] Atualizando dados do dashboard");
          queryClient.invalidateQueries({ queryKey: ["/api/dashboard/aet"] });
          setLastUpdate(new Date());
        }
      } catch (error) {
        console.error("[DASHBOARD] Erro ao processar mensagem WebSocket:", error);
      }
    };

    socket.onclose = () => {
      console.log("[DASHBOARD] WebSocket desconectado");
    };

    socket.onerror = (error) => {
      console.error("[DASHBOARD] Erro WebSocket:", error);
    };

    return () => {
      socket.close();
    };
  }, [queryClient]);

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Carregando dashboard...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (error) {
    return (
      <AdminLayout>
        <div className="text-center py-8">
          <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Erro ao carregar dashboard</h3>
          <p className="text-gray-600">Verifique sua conexão e tente novamente.</p>
        </div>
      </AdminLayout>
    );
  }

  const data = dashboardData!;

  return (
    <AdminLayout>
      <div className="container mx-auto p-6 max-w-7xl space-y-6">
        {/* Título */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Dashboard AET</h1>
            <p className="text-gray-600">Visão geral consolidada do sistema de licenças</p>
          </div>
          <Button variant="outline" size="sm">
            <Calendar className="h-4 w-4 mr-2" />
            Atualizado em {lastUpdate.toLocaleTimeString('pt-BR')}
          </Button>
        </div>

        {/* Cards Resumo Diário */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">AETs Solicitadas Hoje</CardTitle>
              <FileText className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{data.aetsSolicitadasHoje}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">AETs Emitidas Hoje</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{data.aetsEmitidasHoje}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">AETs Pendentes</CardTitle>
              <Clock className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{data.aetsPendentes}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">AETs Vencidas Hoje</CardTitle>
              <XCircle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{data.aetsVencidasHoje}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Veículos Cadastrados</CardTitle>
              <Truck className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">{data.totalVeiculos}</div>
              <p className="text-xs text-gray-600">ativos</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Boletos Gerados Hoje</CardTitle>
              <Receipt className="h-4 w-4 text-indigo-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-indigo-600">{data.boletosHoje}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Valor Total Boletos Hoje</CardTitle>
              <DollarSign className="h-4 w-4 text-emerald-600" />
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold text-emerald-600">{formatCurrency(data.valorBoletosHoje)}</div>
            </CardContent>
          </Card>
        </div>

        {/* Gráficos Operacionais */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Licenças por Status (últimos 7 dias) */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <TrendingUp className="h-5 w-5 mr-2" />
                Licenças por Status (últimos 7 dias)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data.licencasPorStatus7Dias}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="data" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="solicitada" fill="#3b82f6" name="Solicitada" />
                  <Bar dataKey="emitida" fill="#10b981" name="Emitida" />
                  <Bar dataKey="recusada" fill="#ef4444" name="Recusada" />
                  <Bar dataKey="expirada" fill="#6b7280" name="Expirada" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* AETs por Tipo de Veículo */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Truck className="h-5 w-5 mr-2" />
                AETs por Tipo de Veículo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={data.porTipoVeiculo}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {data.porTipoVeiculo.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={CORES_GRAFICO[index % CORES_GRAFICO.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Licenças por Estado */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <MapPin className="h-5 w-5 mr-2" />
              Licenças por Estado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={data.porEstado} layout="horizontal">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis type="category" dataKey="name" width={60} />
                <Tooltip />
                <Bar dataKey="value" fill="#8884d8" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Listagens de Apoio */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* AETs Recentes */}
          <Card>
            <CardHeader>
              <CardTitle>AETs Recentes</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nº Pedido</TableHead>
                    <TableHead>Placa</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.ultimasLicencas.map((licenca) => (
                    <TableRow key={licenca.id}>
                      <TableCell className="font-medium">{licenca.requestNumber}</TableCell>
                      <TableCell>{licenca.mainVehiclePlate}</TableCell>
                      <TableCell>{getLicenseTypeLabel(licenca.type)}</TableCell>
                      <TableCell>
                        <Badge variant={licenca.status === 'approved' ? 'default' : 'secondary'}>
                          {licenca.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDate(licenca.createdAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Últimos Boletos Gerados */}
          <Card>
            <CardHeader>
              <CardTitle>Últimos Boletos Gerados</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nº Boleto</TableHead>
                    <TableHead>Transportador</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Vencimento</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.ultimosBoletos.map((boleto) => (
                    <TableRow key={boleto.id}>
                      <TableCell className="font-medium">{boleto.numeroBoleto}</TableCell>
                      <TableCell className="max-w-[150px] truncate">{boleto.nomeTransportador}</TableCell>
                      <TableCell>{formatCurrency(parseFloat(boleto.valor))}</TableCell>
                      <TableCell>
                        <Badge variant={boleto.status === 'pago' ? 'default' : 'secondary'}>
                          {boleto.status === 'aguardando_pagamento' ? 'Aguardando' : boleto.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDate(boleto.dataVencimento)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}