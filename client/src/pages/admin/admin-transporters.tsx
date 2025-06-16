import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useWebSocketContext } from "@/hooks/use-websocket-context";
import { apiRequest } from "@/lib/queryClient";
import { Transporter } from "@shared/schema";
import { AdminLayout } from "@/components/layout/admin-layout";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { TransporterForm } from "@/components/admin/transporter-form";
import { TransporterLinkUser } from "@/components/admin/transporter-link-user";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { exportToCSV, formatDateForCSV } from "@/lib/csv-export";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Plus, MoreVertical, Edit, Trash, Link as LinkIcon, UserCircle2, Download, Search, X } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { SkeletonTable } from "@/components/ui/skeleton-table";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function AdminTransporters() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isLinkUserDialogOpen, setIsLinkUserDialogOpen] = useState(false);
  const [selectedTransporter, setSelectedTransporter] = useState<Transporter | null>(null);
  const [searchFilter, setSearchFilter] = useState("");
  const { lastMessage } = useWebSocketContext();

  // Effect para invalidar cache quando houver atualizações via WebSocket
  useEffect(() => {
    if (lastMessage && lastMessage.data) {
      try {
        const message = JSON.parse(lastMessage.data);
        
        // Invalidar cache para qualquer tipo de atualização
        if (message.type === 'STATUS_UPDATE' || message.type === 'LICENSE_UPDATE') {
          console.log('[REALTIME] Transporters: Recebida atualização, invalidando cache:', message);
          
          // Invalidar todas as queries relacionadas a transportadores
          queryClient.invalidateQueries({ queryKey: ['/api/admin/transporters'] });
          queryClient.invalidateQueries({ queryKey: ['/api/public/transporters'] });
          queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
          
          // Forçar refetch imediato
          queryClient.refetchQueries({ queryKey: ['/api/admin/transporters'] });
        }
      } catch (error) {
        console.log('[REALTIME] Transporters: Erro ao processar mensagem WebSocket:', error);
      }
    }
  }, [lastMessage, queryClient]);

  const { data: transporters = [], isLoading } = useQuery<Transporter[]>({
    queryKey: ['/api/admin/transporters'],
  });

  // Filtragem inteligente por CNPJ/CPF/Nome
  const filteredTransporters = useMemo(() => {
    if (!searchFilter.trim()) {
      return transporters;
    }

    const searchTerm = searchFilter.toLowerCase().trim();
    
    return transporters.filter((transporter: Transporter) => {
      // Buscar por nome/razão social
      const nameMatch = transporter.name?.toLowerCase().includes(searchTerm);
      
      // Buscar por nome fantasia
      const tradeNameMatch = transporter.tradeName?.toLowerCase().includes(searchTerm);
      
      // Buscar por CPF/CNPJ (removendo pontuação para busca mais flexível)
      const documentMatch = transporter.documentNumber?.replace(/[^\d]/g, '').includes(searchTerm.replace(/[^\d]/g, ''));
      
      // Buscar por email
      const emailMatch = transporter.email?.toLowerCase().includes(searchTerm);
      
      // Buscar por cidade
      const cityMatch = transporter.city?.toLowerCase().includes(searchTerm);
      
      return nameMatch || tradeNameMatch || documentMatch || emailMatch || cityMatch;
    });
  }, [transporters, searchFilter]);

  // Mutation para exclusão de transportador
  const deleteTransporterMutation = useMutation({
    mutationFn: async (transporterId: number) => {
      const response = await apiRequest("DELETE", `/api/admin/transporters/${transporterId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/transporters'] });
      toast({
        title: "Transportador excluído com sucesso",
        description: "O transportador foi removido do sistema.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao excluir transportador",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const handleEditTransporter = (transporter: Transporter) => {
    setSelectedTransporter(transporter);
    setIsEditDialogOpen(true);
  };

  const handleDeleteTransporter = (transporterId: number) => {
    if (confirm("Tem certeza que deseja excluir este transportador?")) {
      deleteTransporterMutation.mutate(transporterId);
    }
  };
  
  const handleLinkUser = (transporter: Transporter) => {
    setSelectedTransporter(transporter);
    setIsLinkUserDialogOpen(true);
  };

  const handleExportCSV = () => {
    if (!filteredTransporters || filteredTransporters.length === 0) {
      toast({
        title: "Nenhum dado para exportar",
        description: "Não há transportadores para exportar",
        variant: "destructive",
      });
      return;
    }

    try {
      const headers = [
        "ID",
        "Nome/Razão Social",
        "CPF/CNPJ",
        "Email",
        "Telefone",
        "Contato Principal",
        "Tipo de Pessoa",
        "Data de Criação"
      ];

      const formattedData = filteredTransporters.map((transporter: Transporter) => ({
        ID: transporter.id,
        "Nome/Razão Social": transporter.name,
        "CPF/CNPJ": transporter.documentNumber,
        Email: transporter.email,
        Telefone: transporter.phone,
        "Contato Principal": transporter.contact1Name,
        "Tipo de Pessoa": transporter.personType === "pf" ? "Pessoa Física" : "Pessoa Jurídica",
        "Data de Criação": formatDateForCSV(transporter.createdAt)
      }));

      exportToCSV({
        filename: "transportadores",
        headers,
        data: formattedData
      });

      toast({
        title: "Exportação concluída",
        description: `${filteredTransporters.length} transportadores exportados com sucesso`,
      });
    } catch (error) {
      toast({
        title: "Erro na exportação",
        description: "Ocorreu um erro ao exportar os dados",
        variant: "destructive",
      });
    }
  };

  const renderTransportersList = () => {
    if (isLoading) {
      return <SkeletonTable columns={5} rows={5} />;
    }

    if (transporters.length === 0) {
      return (
        <Alert className="my-4">
          <AlertDescription>
            Nenhum transportador cadastrado. Clique no botão "Novo" para adicionar.
          </AlertDescription>
        </Alert>
      );
    }

    if (isMobile) {
      return (
        <div className="space-y-4">
          {transporters.map((transporter: Transporter) => (
            <Card key={transporter.id} className="overflow-hidden">
              <CardContent className="p-0">
                <div className="p-4 bg-gray-50 flex justify-between items-center">
                  <h3 className="font-medium">{transporter.name}</h3>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreVertical size={16} />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleEditTransporter(transporter)}>
                        <Edit size={16} className="mr-2" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleLinkUser(transporter)}>
                        <UserCircle2 size={16} className="mr-2" />
                        Vincular Usuário
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDeleteTransporter(transporter.id)} className="text-red-600">
                        <Trash size={16} className="mr-2" />
                        Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div className="p-4 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">CPF/CNPJ:</span>
                    <span className="text-sm font-medium">{transporter.documentNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">Email:</span>
                    <span className="text-sm">{transporter.email}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">Contato:</span>
                    <span className="text-sm">{transporter.contact1Name}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      );
    }

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome/Razão Social</TableHead>
            <TableHead>CPF/CNPJ</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Contato Principal</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {transporters.map((transporter: Transporter) => (
            <TableRow key={transporter.id}>
              <TableCell className="font-medium">{transporter.name}</TableCell>
              <TableCell>{transporter.documentNumber}</TableCell>
              <TableCell>{transporter.email}</TableCell>
              <TableCell>{transporter.contact1Name}</TableCell>
              <TableCell className="text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreVertical size={16} />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleEditTransporter(transporter)}>
                      <Edit size={16} className="mr-2" />
                      Editar
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleLinkUser(transporter)}>
                      <UserCircle2 size={16} className="mr-2" />
                      Vincular Usuário
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleDeleteTransporter(transporter.id)} className="text-red-600">
                      <Trash size={16} className="mr-2" />
                      Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  };

  return (
    <AdminLayout>
      <div className="container mx-auto py-6 max-w-6xl">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Cadastro Transportador</h1>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              disabled={isLoading}
              title="Exportar dados dos transportadores"
            >
              <Download className="h-4 w-4 mr-2" />
              Exportar
            </Button>
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus size={16} className="mr-2" />
                  Novo
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-6xl max-h-[95vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Novo Transportador</DialogTitle>
                </DialogHeader>
                <div className="pb-4">
                  <TransporterForm 
                    onSuccess={() => {
                      setIsCreateDialogOpen(false);
                    }} 
                  />
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Lista de transportadores */}
        {renderTransportersList()}

        {/* Modal de edição de transportador */}
        {selectedTransporter && (
          <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
            <DialogContent className="max-w-6xl max-h-[95vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Editar Transportador</DialogTitle>
              </DialogHeader>
              <div className="pb-4">
                <TransporterForm 
                  transporter={selectedTransporter} 
                  onSuccess={() => {
                    setIsEditDialogOpen(false);
                    setSelectedTransporter(null);
                  }} 
                />
              </div>
            </DialogContent>
          </Dialog>
        )}

        {/* Modal de vinculação de usuário */}
        {selectedTransporter && (
          <Dialog open={isLinkUserDialogOpen} onOpenChange={setIsLinkUserDialogOpen}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Vincular Usuário ao Transportador</DialogTitle>
              </DialogHeader>
              <div className="py-4">
                <TransporterLinkUser 
                  transporter={selectedTransporter}
                  onSuccess={() => {
                    setIsLinkUserDialogOpen(false);
                    setSelectedTransporter(null);
                  }}
                />
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </AdminLayout>
  );
}