import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useWebSocketContext } from "@/hooks/use-websocket-context";
import { apiRequest } from "@/lib/queryClient";
import { Transporter } from "@shared/schema";
import { AdminLayout } from "@/components/layout/admin-layout";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { TransporterForm } from "@/components/admin/transporter-form";
import { TransporterLinkUser } from "@/components/admin/transporter-link-user";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Plus, MoreVertical, Edit, Trash, Link as LinkIcon, UserCircle2, Download } from "lucide-react";
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

  // Fetch transporters
  const { data: transporters = [], isLoading } = useQuery({
    queryKey: ["/api/admin/transporters"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/admin/transporters");
      return await response.json();
    }
  });



  // Delete transporter mutation
  const deleteTransporterMutation = useMutation({
    mutationFn: async (transporterId: number) => {
      await apiRequest("DELETE", `/api/admin/transporters/${transporterId}`);
    },
    onSuccess: () => {
      toast({
        title: "Transportador excluído",
        description: "O transportador foi excluído com sucesso",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/transporters"] });
    },
    onError: (error: Error) => {
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
    if (!transporters || transporters.length === 0) {
      toast({
        title: "Nenhum dado para exportar",
        description: "Não há transportadores para exportar",
        variant: "destructive",
      });
      return;
    }

    try {
      const { exportToCSV, formatDateForCSV } = require("@/lib/csv-export");
      
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

      const formattedData = transporters.map(transporter => ({
        id: transporter.id,
        "nome/razão social": transporter.name,
        "cpf/cnpj": transporter.documentNumber,
        email: transporter.email,
        telefone: transporter.phone,
        "contato principal": transporter.contact1Name,
        "tipo de pessoa": transporter.personType === "pf" ? "Pessoa Física" : "Pessoa Jurídica",
        "data de criação": formatDateForCSV(transporter.createdAt)
      }));

      exportToCSV({
        filename: "transportadores",
        headers,
        data: formattedData
      });

      toast({
        title: "Exportação concluída",
        description: `${transporters.length} transportadores exportados com sucesso`,
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
            <TableHead className="w-[100px]">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {transporters.map((transporter: Transporter) => (
            <TableRow key={transporter.id}>
              <TableCell className="font-medium">{transporter.name}</TableCell>
              <TableCell>{transporter.documentNumber}</TableCell>
              <TableCell>{transporter.email}</TableCell>
              <TableCell>{transporter.contact1Name}</TableCell>
              <TableCell>
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