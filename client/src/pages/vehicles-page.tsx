import React, { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/main-layout";
import { VehicleList } from "@/components/vehicles/vehicle-list";
import { VehicleForm } from "@/components/vehicles/vehicle-form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Plus, RefreshCw, Download } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Vehicle } from "@shared/schema";
import { Input } from "@/components/ui/input";
import { useWebSocket } from "@/hooks/use-websocket";
import { useToast } from "@/hooks/use-toast";
import { exportToCSV } from "@/lib/csv-export";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";

export default function VehiclesPage() {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [currentVehicle, setCurrentVehicle] = useState<Vehicle | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { isConnected } = useWebSocket();
  
  // Checar se existe uma placa pré-preenchida no localStorage
  // (Vindo de outro componente como a tela de adicionar placas adicionais)
  useEffect(() => {
    const preFillPlate = localStorage.getItem('preFillPlate');
    if (preFillPlate) {
      // Abre automaticamente o formulário com a placa pré-preenchida
      setIsFormOpen(true);
      // Remove do localStorage depois de usar
      localStorage.removeItem('preFillPlate');
    }
  });

  const { data: vehicles, isLoading, refetch } = useQuery<Vehicle[]>({
    queryKey: ["/api/vehicles"],
    queryFn: async () => {
      const res = await fetch("/api/vehicles", {
        credentials: "include"
      });
      if (!res.ok) {
        throw new Error("Erro ao buscar veículos");
      }
      return res.json();
    }
  });

  // Função de atualização melhorada
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      // Invalidar cache primeiro
      await queryClient.invalidateQueries({ queryKey: ["/api/vehicles"] });
      
      // Forçar nova busca
      await refetch();
      
      toast({
        title: "Lista atualizada",
        description: "A lista de veículos foi atualizada com sucesso.",
      });
    } catch (error) {
      toast({
        title: "Erro ao atualizar",
        description: "Não foi possível atualizar a lista de veículos.",
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const filteredVehicles = vehicles?.filter(vehicle => {
    const matchesSearch = !searchTerm || 
      vehicle.plate.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = !typeFilter || typeFilter === "all_types" || vehicle.type === typeFilter;
    const matchesStatus = !statusFilter || statusFilter === "all_status" || vehicle.status === statusFilter;
    return matchesSearch && matchesType && matchesStatus;
  });

  const handleAddVehicle = () => {
    setCurrentVehicle(null);
    setIsFormOpen(true);
  };

  const handleEditVehicle = (vehicle: Vehicle) => {
    setCurrentVehicle(vehicle);
    setIsFormOpen(true);
  };

  const handleFormClose = () => {
    setIsFormOpen(false);
    setCurrentVehicle(null);
  };

  const handleFormSuccess = async () => {
    try {
      // Invalidar cache e atualizar dados
      await queryClient.invalidateQueries({ queryKey: ["/api/vehicles"] });
      await refetch();
      
      toast({
        title: "Sucesso",
        description: "Veículo salvo com sucesso.",
      });
    } catch (error) {
      toast({
        title: "Aviso",
        description: "Veículo salvo, mas pode ser necessário atualizar a lista.",
        variant: "default",
      });
    } finally {
      setIsFormOpen(false);
      setCurrentVehicle(null);
    }
  };

  const handleExportCSV = () => {
    if (!vehicles || vehicles.length === 0) {
      toast({
        title: "Nenhum dado para exportar",
        description: "Não há veículos para exportar",
        variant: "destructive",
      });
      return;
    }

    try {
      const headers = [
        "ID",
        "Placa",
        "Tipo",
        "Marca",
        "Modelo",
        "Ano",
        "Tara (kg)",
        "Eixos",
        "Status",
        "Transportador"
      ];

      const getVehicleTypeLabel = (type: string) => {
        const types: Record<string, string> = {
          tractor_unit: "Unidade Tratora",
          semi_trailer: "Semirreboque",
          trailer: "Reboque",
          dolly: "Dolly",
          flatbed: "Prancha"
        };
        return types[type] || type;
      };

      const formattedData = vehicles.map((vehicle) => ({
        ID: vehicle.id,
        Placa: vehicle.plate,
        Tipo: getVehicleTypeLabel(vehicle.type),
        Marca: vehicle.brand || "-",
        Modelo: vehicle.model || "-",
        Ano: vehicle.year || "-",
        "Tara (kg)": vehicle.tare || "-",
        Eixos: vehicle.axleCount || "-",
        Status: vehicle.status === "active" ? "Ativo" : 
                vehicle.status === "inactive" ? "Inativo" : 
                vehicle.status === "maintenance" ? "Manutenção" : vehicle.status,
        Transportador: vehicle.transporter?.name || vehicle.transporter?.tradeName || "-"
      }));

      exportToCSV({
        filename: "veiculos",
        headers,
        data: formattedData
      });

      toast({
        title: "Exportação concluída",
        description: `${vehicles.length} veículos exportados com sucesso`,
      });
    } catch (error) {
      toast({
        title: "Erro na exportação",
        description: "Ocorreu um erro ao exportar os dados",
        variant: "destructive",
      });
    }
  };

  return (
    <MainLayout>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-0 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Veículos Cadastrados</h1>
          <p className="text-gray-600 mt-1">Gerencie todos os veículos cadastrados no sistema</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button 
            onClick={handleRefresh}
            variant="outline" 
            className={`flex items-center gap-1 bg-white ${isConnected ? 'border-green-200' : 'border-gray-200'}`}
            title={`Atualizar lista de veículos ${isConnected ? '(Tempo real ativo)' : '(Offline)'}`}
            disabled={isRefreshing || isLoading}
          >
            <div className="flex items-center">
              <RefreshCw className={`h-4 w-4 mr-1 ${isRefreshing ? 'animate-spin' : ''}`} />
              {isConnected && (
                <div className="w-2 h-2 bg-green-500 rounded-full mr-1" title="Conectado em tempo real" />
              )}
            </div>
            {isRefreshing ? 'Atualizando...' : 'Atualizar'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            disabled={isLoading}
            title="Exportar dados dos veículos"
          >
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>
          <Button onClick={handleAddVehicle} className="w-full sm:w-auto">
            <Plus className="mr-2 h-4 w-4" /> Cadastrar Veículo
          </Button>
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="w-full">
            <label htmlFor="vehicle-search" className="block text-sm font-medium text-gray-700 mb-1">
              Pesquisar
            </label>
            <div className="relative">
              <Input
                id="vehicle-search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Placa ou tipo de veículo..."
                className="pl-10"
              />
              <span className="absolute left-3 top-2.5 text-gray-400">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </span>
            </div>
          </div>
          
          <div className="w-full">
            <label htmlFor="type-filter" className="block text-sm font-medium text-gray-700 mb-1">
              Tipo de Veículo
            </label>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Todos os tipos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all_types">Todos os tipos</SelectItem>
                <SelectItem value="tractor_unit">Unidade Tratora (Cavalo)</SelectItem>
                <SelectItem value="semi_trailer">Semirreboque</SelectItem>
                <SelectItem value="trailer">Reboque</SelectItem>
                <SelectItem value="dolly">Dolly</SelectItem>
                <SelectItem value="flatbed">Prancha</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="w-full">
            <label htmlFor="status-filter" className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Todos os status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all_status">Todos os status</SelectItem>
                <SelectItem value="active">Ativo</SelectItem>
                <SelectItem value="maintenance">Em Manutenção</SelectItem>
                <SelectItem value="inactive">Inativo</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <VehicleList 
        vehicles={filteredVehicles || []} 
        isLoading={isLoading} 
        onEdit={handleEditVehicle}
        onRefresh={handleRefresh}
      />

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-[520px] p-0 max-h-[90vh] overflow-auto" hideCloseButton>
          <DialogTitle className="sr-only">
            {currentVehicle ? "Editar Veículo" : "Cadastrar Veículo"}
          </DialogTitle>
          <VehicleForm 
            vehicle={currentVehicle as any} 
            onSuccess={handleFormSuccess} 
            onCancel={handleFormClose}
          />
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
