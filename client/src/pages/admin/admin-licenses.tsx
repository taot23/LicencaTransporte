import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useWebSocketContext } from "@/hooks/use-websocket-context";
import { AdminLayout } from "@/components/layout/admin-layout";
import { getQueryFn, apiRequest, queryClient } from "@/lib/queryClient";
import { getLicenseTypeLabel, getCargoTypeLabel } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { exportToCSV, formatDateForCSV } from "@/lib/csv-export";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Loader2, Search, FileText, CheckCircle, XCircle, File, Clock, 
  MapPin, X, UploadCloud, Pencil, AlertCircle, Eye, EyeOff, Trash2,
  RefreshCw, Download
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { StatusBadge } from "@/components/licenses/status-badge";
import { ProgressFlow, StateProgressFlow } from "@/components/licenses/progress-flow";
import { LicenseDetailsCard } from "@/components/licenses/license-details-card";
import { TransporterWithSubsidiaries } from "@/components/transporters/transporter-with-subsidiaries";
import { TransporterCnpjSelector } from "@/components/transporters/transporter-cnpj-selector";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { LicenseRequest, brazilianStates, Transporter } from "@shared/schema";
import { TransporterInfo } from "@/components/transporters/transporter-info";
import { usePaginatedList } from "@/hooks/use-paginated-list";
import { ListPagination, MobileListPagination } from "@/components/ui/list-pagination";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";


import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Schema para atualização de status
const updateStatusSchema = z.object({
  status: z.string({
    required_error: "O status é obrigatório",
  }),
  comments: z.string().optional(),
  licenseFile: z.any().optional(),
});

// Schema para atualização de status por estado
const updateStateStatusSchema = z.object({
  state: z.string({
    required_error: "O estado é obrigatório",
  }),
  status: z.string({
    required_error: "O status é obrigatório",
  }),
  comments: z.string().optional(),
  validUntil: z.string().optional(),
  issuedAt: z.string().optional(),
  aetNumber: z.string().optional(),
  selectedCnpj: z.string().optional(),
  licenseFile: z
    .any()
    .optional()
    .refine(
      (file) => {
        if (!file) return true;
        return file && typeof file === 'object' && 'type' in file && 
          file.type === "application/pdf";
      },
      {
        message: "Apenas arquivos PDF são permitidos para a licença",
      }
    ),
}).superRefine(async (data, ctx) => {
  // Se o status for "approved", validade e data de emissão são obrigatórias
  if (data.status === "approved") {
    if (!data.validUntil) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A data de validade é obrigatória quando o status é Liberada",
        path: ["validUntil"]
      });
    }
    if (!data.issuedAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A data de emissão é obrigatória quando o status é Liberada",
        path: ["issuedAt"]
      });
    }
  }
  
  // Se o status for "under_review" ou "pending_approval", número da AET é obrigatório
  if ((data.status === "under_review" || data.status === "pending_approval") && !data.aetNumber) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `O número da AET é obrigatório quando o status é ${data.status === "under_review" ? "Análise do Órgão" : "Pendente Liberação"}`,
      path: ["aetNumber"]
    });
  }
  
  // Para o status "approved", o número da AET deve ser informado apenas se não houver um número anterior
  if (data.status === "approved" && !data.aetNumber) {
    // Não vamos adicionar o erro aqui, pois o backend vai buscar o valor do status anterior
    // Mas podemos melhorar isso com validação do lado do cliente se necessário
  }
});

// Constantes e funções auxiliares para status

export default function AdminLicensesPage() {
  const [includeRenewalDrafts, setIncludeRenewalDrafts] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState({
    id: true,
    requestNumber: true,
    plate: true,
    transporter: true,
    type: true,
    states: true,
    status: true,
    createdAt: true
  });
  
  // PAGINAÇÃO PARA 50K+ REGISTROS  
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  
  const { toast } = useToast();
  const [location, setLocation] = useLocation();
  const { user } = useAuth();
  const { isConnected, lastMessage } = useWebSocketContext();
  
  // Estados para controle de filtros e busca
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [transporterFilter, setTransporterFilter] = useState("all");
  const [transporterSearchTerm, setTransporterSearchTerm] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [stateFilter, setStateFilter] = useState("all_states");
  const [selectedLicense, setSelectedLicense] = useState<LicenseRequest | null>(null);
  const [licenseDetailsOpen, setLicenseDetailsOpen] = useState(false);
  const [stateStatusDialogOpen, setStateStatusDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedState, setSelectedState] = useState("");
  const [visibleStateFlows, setVisibleStateFlows] = useState<string[]>([]);
  
  // Estado para ordenação
  const [sortField, setSortField] = useState<string>("createdAt");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  
  // Estados para controle do botão de atualização
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [aetNumberValidationError, setAetNumberValidationError] = useState<string>("");

  // Effect para invalidar cache quando houver atualizações via WebSocket
  useEffect(() => {
    if (lastMessage && lastMessage.data) {
      try {
        const message = JSON.parse(lastMessage.data);
        
        // Invalidar cache para qualquer tipo de atualização
        if (message.type === 'STATUS_UPDATE' || message.type === 'LICENSE_UPDATE') {
          console.log('[REALTIME] Recebida atualização, invalidando cache:', message);
          
          // Invalidar todas as queries relacionadas
          queryClient.invalidateQueries({ queryKey: ['/api/admin/licenses'] });
          queryClient.invalidateQueries({ queryKey: ['/api/admin/transporters'] });
          queryClient.invalidateQueries({ queryKey: ['/api/public/transporters'] });
          queryClient.invalidateQueries({ queryKey: ['/api/vehicles'] });
          queryClient.invalidateQueries({ queryKey: ['/api/licenses'] });
          
          // Forçar refetch imediato
          queryClient.refetchQueries({ queryKey: ['/api/admin/licenses'] });
          
          toast({
            title: "Dados atualizados",
            description: "As informações foram atualizadas automaticamente.",
          });
        }
      } catch (error) {
        console.log('[REALTIME] Erro ao processar mensagem WebSocket:', error);
      }
    }
  }, [lastMessage, toast]);
  
  // Verificar se o usuário é do tipo operacional
  const isOperational = user?.role === 'operational';
  
  // Verificar se estamos na rota de gerenciar-licencas (staff) ou admin
  const isStaffRoute = location.includes('gerenciar-licencas');
  const apiEndpoint = isStaffRoute ? '/api/staff/licenses' : '/api/admin/licenses';
  
  // Efeito para atualizar o objeto selectedLicense em tempo real quando receber mensagem WebSocket
  useEffect(() => {
    if (
      lastMessage?.type === 'STATUS_UPDATE' && 
      lastMessage.data && 
      selectedLicense && 
      lastMessage.data.licenseId === selectedLicense.id
    ) {
      // Se o evento é para um estado específico
      if (lastMessage.data.state) {
        // Atualização de status de um estado específico
        const updatedStateStatuses = [...(selectedLicense.stateStatuses || [])];
        const stateStatusIndex = updatedStateStatuses.findIndex(
          entry => entry.startsWith(`${lastMessage.data.state}:`)
        );
        
        // Se o estado já existe nos status, atualizar
        if (stateStatusIndex >= 0) {
          updatedStateStatuses[stateStatusIndex] = `${lastMessage.data.state}:${lastMessage.data.status}`;
        } else {
          // Se não existe, adicionar
          updatedStateStatuses.push(`${lastMessage.data.state}:${lastMessage.data.status}`);
        }
        
        // Criar uma cópia atualizada da licença selecionada
        setSelectedLicense(prevLicense => {
          if (!prevLicense) return null;
          const updatedLicense = {
            ...prevLicense,
            stateStatuses: updatedStateStatuses,
            // Se também recebemos uma atualização completa da licença, usar todos os dados
            ...(lastMessage.data.license && lastMessage.data.license),
            // Se também recebemos uma atualização para o status geral da licença
            ...(lastMessage.data.license?.status && { status: lastMessage.data.license.status })
          };
          
          // Se o modal de edição de status está aberto para este estado, atualizar o formulário
          if (stateStatusDialogOpen && selectedState === lastMessage.data.state) {
            console.log('[WebSocket] Atualizando formulário em tempo real para estado:', lastMessage.data.state);
            // Usar setTimeout para garantir que o estado foi atualizado
            setTimeout(() => {
              // Determinar o CNPJ específico para este estado
              let currentStateCnpj = "";
              if (updatedLicense.stateCnpjs && updatedLicense.stateCnpjs.length > 0) {
                const stateCnpjEntry = updatedLicense.stateCnpjs.find((entry: string) => entry.startsWith(`${lastMessage.data.state}:`));
                if (stateCnpjEntry) {
                  const [_, cnpj] = stateCnpjEntry.split(':');
                  if (cnpj) {
                    currentStateCnpj = cnpj;
                  }
                }
              }
              
              // Fallback para o CNPJ global se não houver CNPJ específico para o estado
              if (!currentStateCnpj && updatedLicense.selectedCnpj) {
                currentStateCnpj = updatedLicense.selectedCnpj;
              }
              
              // Atualizar apenas o campo selectedCnpj do formulário se necessário
              const currentFormCnpj = stateStatusForm.getValues("selectedCnpj");
              if (currentFormCnpj !== currentStateCnpj) {
                console.log('[WebSocket] Atualizando CNPJ no formulário de', currentFormCnpj, 'para', currentStateCnpj);
                stateStatusForm.setValue("selectedCnpj", currentStateCnpj);
              }
            }, 100);
          }
          
          return updatedLicense;
        });
        
        console.log(`StatusUpdate em tempo real: Licença ${selectedLicense.id} estado ${lastMessage.data.state} => ${lastMessage.data.status}`);
      } 
      // Se o evento é para a licença inteira (sem estado específico)
      else if (lastMessage.data.license) {
        setSelectedLicense(prevLicense => {
          if (!prevLicense) return null;
          return {
            ...prevLicense,
            status: lastMessage.data.license.status,
            ...(lastMessage.data.license.stateStatuses && { stateStatuses: lastMessage.data.license.stateStatuses })
          };
        });
        
        console.log(`StatusUpdate em tempo real: Licença ${selectedLicense.id} => ${lastMessage.data.license.status}`);
      }
    }

    // ATUALIZAÇÃO EM TEMPO REAL PARA A LISTA PRINCIPAL
    // Atualizar também a lista principal de licenças quando houver mudanças de status
    if (
      lastMessage?.type === 'STATUS_UPDATE' && 
      lastMessage.data && 
      lastMessage.data.licenseId && 
      lastMessage.data.state && 
      lastMessage.data.status
    ) {
      // Invalidar a query da lista de licenças para recarregar com os dados atualizados
      queryClient.invalidateQueries({ queryKey: [apiEndpoint] });
      
      console.log(`[TEMPO REAL] Lista atualizada: Licença ${lastMessage.data.licenseId}, Estado ${lastMessage.data.state} => ${lastMessage.data.status}`);
    }
  }, [lastMessage, selectedLicense]);

  // Form removido para atualização de status geral
  
  // Form para atualização de status por estado
  const stateStatusForm = useForm<z.infer<typeof updateStateStatusSchema>>({
    resolver: zodResolver(updateStateStatusSchema),
    defaultValues: {
      state: "",
      status: "",
      comments: "",
      aetNumber: "", // Adicionar campo para número da AET
      licenseFile: undefined, // Adicionar valor padrão para licenseFile
      validUntil: "", // Corrigindo: iniciar como string vazia ao invés de undefined
    },
  });

  // Buscar todas as licenças (excluindo rascunhos de renovação)
  // QUERY OTIMIZADA PARA 50K+ REGISTROS - COM PAGINAÇÃO NO SERVIDOR
  const { data: response = { data: [], pagination: {} }, isLoading, refetch } = useQuery({
    queryKey: [apiEndpoint, {
      page: currentPage,
      limit: pageSize,
      search: searchTerm,
      status: statusFilter === "all" ? undefined : statusFilter,
      state: stateFilter === "all_states" ? undefined : stateFilter,
      transporter: transporterFilter === "all" ? undefined : transporterFilter,
      includeRenewal: false
    }],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: pageSize.toString(),
        includeRenewal: 'false'
      });
      
      if (searchTerm?.trim()) params.set('search', searchTerm.trim());
      if (statusFilter !== "all") params.set('status', statusFilter);
      if (stateFilter !== "all_states") params.set('state', stateFilter);
      if (transporterFilter !== "all") params.set('transporter', transporterFilter);
      
      console.log(`🚀 [FRONTEND] Buscando licenças: página ${currentPage}, tamanho ${pageSize}`);
      const startTime = Date.now();
      
      const res = await fetch(`${apiEndpoint}?${params.toString()}`, {
        credentials: "include"
      });
      
      if (!res.ok) {
        if (res.status === 401) {
          throw new Error("Não autorizado");
        }
        throw new Error("Erro ao buscar licenças");
      }
      
      const data = await res.json();
      const endTime = Date.now();
      
      console.log(`⚡ [FRONTEND] Licenças carregadas em ${endTime - startTime}ms - ${data.data?.length || 0} registros`);
      
      return data;
    },
    // TEMPO REAL OTIMIZADO
    staleTime: 1000, // 1 segundo para tempo real instantâneo
    refetchInterval: 15000, // Refetch a cada 15 segundos
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });
  
  const licenses = response.data || [];
  const pagination = response.pagination || {};

  // Buscar todos os transportadores para o filtro
  const { data: transporters = [] } = useQuery<Transporter[]>({
    queryKey: ['/api/admin/transporters'],
  });

  // Função para validar unicidade do número AET
  const validateAetNumberUniqueness = useCallback((aetNumber: string, currentState: string, currentLicense: LicenseRequest) => {
    if (!aetNumber || !currentLicense) return null;

    // Verificar se o número já existe em outros estados da mesma licença
    if (currentLicense.stateAETNumbers) {
      const duplicateInSameLicense = currentLicense.stateAETNumbers.find(entry => {
        const [state, number] = entry.split(':');
        return state !== currentState && number === aetNumber;
      });
      
      if (duplicateInSameLicense) {
        const [duplicateState] = duplicateInSameLicense.split(':');
        return `O número "${aetNumber}" já está sendo usado no estado ${duplicateState} desta licença`;
      }
    }

    // Verificar se o número já existe em outras licenças (busca global)
    const duplicateInOtherLicense = licenses.find(license => {
      if (license.id === currentLicense.id) return false; // Pular a licença atual
      
      return license.stateAETNumbers?.some(entry => {
        const [, number] = entry.split(':');
        return number === aetNumber;
      });
    });

    if (duplicateInOtherLicense) {
      return `O número "${aetNumber}" já está sendo usado na licença ${duplicateInOtherLicense.requestNumber}`;
    }

    return null; // Número é único
  }, [licenses]);

  // Função de atualização melhorada com feedback visual e integração WebSocket
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      // Invalidar cache primeiro
      await queryClient.invalidateQueries({ queryKey: [apiEndpoint] });
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/transporters"] });
      
      // Fazer refetch
      await refetch();
      
      toast({
        title: "Sucesso",
        description: "Lista de licenças atualizada com sucesso.",
      });
    } catch (error) {
      console.error("Erro ao atualizar:", error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar a lista. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  // Mutação para atualização de status geral foi removida - agora só usamos atualização por estado
  
  // Atualizar status por estado da licença
  const updateStateStatusMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number, data: z.infer<typeof updateStateStatusSchema> }) => {
      const formData = new FormData();
      formData.append("state", data.state);
      formData.append("status", data.status);
      if (data.comments) {
        formData.append("comments", data.comments);
      }
      
      // Incluir data de validade se fornecida
      if (data.validUntil) {
        formData.append("validUntil", data.validUntil);
      }
      
      // Incluir data de emissão se fornecida  
      if (data.issuedAt) {
        formData.append("issuedAt", data.issuedAt);
        console.log('[Frontend] Data de emissão sendo enviada:', data.issuedAt);
      }
      
      // Incluir arquivo da licença se o status for "approved" (Liberada)
      if (data.licenseFile && data.status === "approved") {
        formData.append("stateFile", data.licenseFile);
      }
      
      // Incluir número da AET se o status for "under_review" (Análise do Órgão), "pending_approval" (Pendente Liberação) ou "approved" (Liberada)
      if (data.aetNumber && (data.status === "under_review" || data.status === "pending_approval" || data.status === "approved")) {
        formData.append("aetNumber", data.aetNumber);
      }
      
      // Incluir CNPJ selecionado sempre (pode ser string vazia)
      formData.append("selectedCnpj", data.selectedCnpj || "");
      
      // Incluir CNPJ específico para este estado
      formData.append("stateCnpj", data.selectedCnpj || "");
      console.log('Enviando dados - selectedCnpj:', data.selectedCnpj);
      console.log('Enviando dados - stateCnpj:', data.selectedCnpj);
      console.log('Enviando dados - state:', data.state);
      
      const response = await apiRequest("PATCH", `/api/admin/licenses/${id}/state-status`, formData);
      return await response.json();
    },
    onSuccess: (updatedLicense) => {
      // Primeiro, mostrar a notificação de sucesso
      toast({
        title: "Status do estado atualizado",
        description: "Status do estado atualizado com sucesso!",
      });
      
      // Fechar o modal após sucesso
      setTimeout(() => {
        setStateStatusDialogOpen(false);
        setSelectedState("");
      }, 500);
      
      // Invalidar todas as queries relacionadas para garantir dados atualizados
      setTimeout(() => {
        // Invalidar as consultas específicas
        queryClient.invalidateQueries({ queryKey: [apiEndpoint] });
        queryClient.invalidateQueries({ queryKey: [`${apiEndpoint}/${updatedLicense.id}`] });
        queryClient.invalidateQueries({ queryKey: ['/api/licenses/issued'] });
        queryClient.invalidateQueries({ queryKey: ['/api/licenses'] });
        
        // Forçar uma nova busca dos dados (opcional, mas pode ajudar)
        refetch();
      }, 300);
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao atualizar status do estado",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Mutação para excluir licença
  const deleteLicenseMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest("DELETE", `/api/admin/licenses/${id}`);
      return response.ok;
    },
    onSuccess: () => {
      toast({
        title: "Licença excluída",
        description: "A licença foi excluída com sucesso!",
      });
      // Invalidar as queries para manter a consistência
      queryClient.invalidateQueries({ queryKey: [apiEndpoint] });
      setDeleteDialogOpen(false);
      setLicenseDetailsOpen(false);
      setSelectedLicense(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao excluir licença",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Filtrar licenças com critérios múltiplos
  // SISTEMA HÍBRIDO OTIMIZADO: Filtros principais no servidor, filtros extras no cliente
  const filteredLicenses = licenses
    .filter((license: LicenseRequest) => {
      // Busca por transportador (aplicada no cliente para busca em tempo real)
      let matchesTransporter = true;
      if (transporterSearchTerm.trim()) {
        const searchLower = transporterSearchTerm.toLowerCase().trim();
        const transporter = transporters.find(t => t.id === license.transporterId);
        
        if (transporter) {
          const nameMatch = Boolean(transporter.name?.toLowerCase().includes(searchLower));
          const documentMatch = Boolean(transporter.documentNumber?.toLowerCase().includes(searchLower));
          const tradeNameMatch = Boolean(transporter.tradeName?.toLowerCase().includes(searchLower));
          
          matchesTransporter = nameMatch || documentMatch || tradeNameMatch;
        } else {
          matchesTransporter = false;
        }
      }
      
      // Filtro de data (aplicado no cliente para precisão)
      let matchesDate = true;
      if (dateFilter) {
        const requestDate = license.createdAt ? new Date(license.createdAt) : null;
        const filterDate = new Date(dateFilter);
        
        if (requestDate) {
          // Comparar apenas ano, mês e dia
          matchesDate = 
            requestDate.getFullYear() === filterDate.getFullYear() &&
            requestDate.getMonth() === filterDate.getMonth() &&
            requestDate.getDate() === filterDate.getDate();
        } else {
          matchesDate = false;
        }
      }
      
      return matchesTransporter && matchesDate;
    })
    // Aplicar ordenação
    .sort((a, b) => {
      const getValue = (license: LicenseRequest, field: string) => {
        switch (field) {
          case 'requestNumber':
            return license.requestNumber || '';
          case 'type':
            return license.type || '';
          case 'mainVehiclePlate':
            return license.mainVehiclePlate || '';
          case 'status':
            return license.status || '';
          case 'createdAt':
            return new Date(license.createdAt || 0).getTime();
          default:
            return '';
        }
      };
      
      const aValue = getValue(a, sortField);
      const bValue = getValue(b, sortField);
      
      // Se ambos os valores são strings, ordenar ignorando case
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        const comparison = aValue.localeCompare(bValue);
        return sortDirection === 'asc' ? comparison : -comparison;
      }
      
      // Se são números (timestamp para datas)
      if (sortDirection === 'asc') {
        return (aValue as number) - (bValue as number);
      } else {
        return (bValue as number) - (aValue as number);
      }
    });

  // DADOS OTIMIZADOS: Paginação no servidor + filtros finos no cliente
  const paginatedLicenses = filteredLicenses;
  
  // Reset para primeira página quando filtros mudam
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, stateFilter, transporterFilter, transporterSearchTerm, dateFilter]);

  // Função removida pois o status agora só será editado por estado individual

  const handleViewDetails = (license: LicenseRequest) => {
    console.log("Detalhes da licença:", license);
    setSelectedLicense(license);
    // Inicialmente, todos os estados têm o fluxo oculto
    setVisibleStateFlows([]);
    setLicenseDetailsOpen(true);
  };

  // Função removida pois o status agora só é editado por estado individual
  
  const handleStateStatusUpdate = (license: LicenseRequest, state: string) => {
    setSelectedLicense(license);
    setSelectedState(state);
    
    // Determinar o status atual deste estado
    let currentStateStatus = "pending";
    
    // Parse dos stateStatuses (que são armazenados como "ESTADO:STATUS:VALIDUNTIL:ISSUEDDAT")
    let currentValidUntil = "";
    let currentIssuedAt = "";
    
    if (license.stateStatuses && license.stateStatuses.length > 0) {
      const stateStatusEntry = license.stateStatuses.find(entry => entry.startsWith(`${state}:`));
      if (stateStatusEntry) {
        const parts = stateStatusEntry.split(':');
        if (parts[1]) {
          currentStateStatus = parts[1];
        }
        // Extrair data de validade (3ª parte)
        if (parts[2]) {
          currentValidUntil = parts[2];
        }
        // Extrair data de emissão específica do estado (4ª parte)
        if (parts[3]) {
          // Converter a data ISO para formato do input (YYYY-MM-DD)
          try {
            const issuedDate = new Date(parts[3]);
            currentIssuedAt = issuedDate.toISOString().split('T')[0];
          } catch (e) {
            console.warn('Erro ao converter data de emissão do estado:', parts[3]);
            currentIssuedAt = "";
          }
        }
      }
    }
    
    // NÃO usar a data global - cada estado deve ter sua própria data de emissão
    
    // Determinar o CNPJ específico para este estado
    let currentStateCnpj = "";
    if (license.stateCnpjs && license.stateCnpjs.length > 0) {
      const stateCnpjEntry = license.stateCnpjs.find(entry => entry.startsWith(`${state}:`));
      if (stateCnpjEntry) {
        const [_, cnpj] = stateCnpjEntry.split(':');
        if (cnpj) {
          currentStateCnpj = cnpj;
        }
      }
    }
    
    // Fallback para o CNPJ global se não houver CNPJ específico para o estado
    if (!currentStateCnpj && license.selectedCnpj) {
      currentStateCnpj = license.selectedCnpj;
    }
    
    // Determinar o número da AET específico para este estado
    let currentStateAetNumber = "";
    if (license.stateAETNumbers && license.stateAETNumbers.length > 0) {
      const stateAetEntry = license.stateAETNumbers.find(entry => entry.startsWith(`${state}:`));
      if (stateAetEntry) {
        const [_, aetNumber] = stateAetEntry.split(':');
        if (aetNumber) {
          currentStateAetNumber = aetNumber;
        }
      }
    }
    
    // NÃO usar fallback para número AET global - cada estado deve ter seu próprio número
    // Apenas usar o número AET se for específico para este estado
    // currentStateAetNumber já foi extraído corretamente acima ou está vazio se não existir
    
    console.log('[Form Reset] Estado selecionado:', state);
    console.log('[Form Reset] CNPJ atual do estado:', currentStateCnpj);
    console.log('[Form Reset] stateCnpjs disponíveis:', license.stateCnpjs);
    console.log('[Form Reset] stateStatuses disponíveis:', license.stateStatuses);
    console.log('[Form Reset] Status atual:', currentStateStatus);
    console.log('[Form Reset] Data de validade extraída:', currentValidUntil);
    console.log('[Form Reset] Data de emissão extraída:', currentIssuedAt);
    console.log('[Form Reset] Número AET final:', currentStateAetNumber);
    
    stateStatusForm.reset({
      state: state,
      status: currentStateStatus,
      comments: "",
      aetNumber: currentStateAetNumber, // Preservar o número da AET existente ou deixar vazio
      selectedCnpj: currentStateCnpj, // Carregar o CNPJ específico do estado
      licenseFile: undefined, // Resetar o campo de arquivo
      validUntil: currentValidUntil, // Preservar a data de validade existente
      issuedAt: currentIssuedAt, // Preservar a data de emissão existente
    });
    
    setStateStatusDialogOpen(true);
  };
  
  const onSubmitStateStatus = (data: z.infer<typeof updateStateStatusSchema>) => {
    if (!selectedLicense) return;
    
    console.log('[Form Submit] Dados do formulário recebidos:', data);
    console.log('[Form Submit] CNPJ selecionado:', data.selectedCnpj);
    
    // Validação adicional para o status "approved": exigir arquivo PDF e data de validade
    if (data.status === "approved") {
      if (!data.licenseFile) {
        toast({
          title: "Erro de validação",
          description: "Para o status 'Liberada' é obrigatório anexar um documento PDF da licença.",
          variant: "destructive",
        });
        return;
      }
      
      if (!data.validUntil) {
        toast({
          title: "Erro de validação",
          description: "Para o status 'Liberada' é obrigatório definir uma data de validade.",
          variant: "destructive",
        });
        return;
      }
    }
    
    // Validação adicional para o status "under_review" ou "pending_approval": exigir número da AET
    if (data.status === "under_review" || data.status === "pending_approval") {
      if (!data.aetNumber) {
        toast({
          title: "Erro de validação",
          description: `Para o status '${data.status === "under_review" ? "Análise do Órgão" : "Pendente Liberação"}' é obrigatório informar o número da AET.`,
          variant: "destructive",
        });
        return;
      }
    }
    
    // Garantir que useEffect não crie conflitos durante o processamento
    const licenseId = selectedLicense.id;
    
    console.log('[Form Submit] Enviando dados para backend:', { id: licenseId, data });
    
    updateStateStatusMutation.mutate({ 
      id: licenseId,
      data
    });
  };
  
  // Função para excluir a licença selecionada
  const handleDeleteLicense = () => {
    if (!selectedLicense) return;
    setDeleteDialogOpen(true);
  };
  
  // Função para confirmar a exclusão da licença
  const handleConfirmDelete = () => {
    if (!selectedLicense) return;
    deleteLicenseMutation.mutate(selectedLicense.id);
  };
  
  // Função para fechar o diálogo de detalhes e limpar o estado
  const handleCloseLicenseDetails = () => {
    // Primeiro fechar o diálogo
    setLicenseDetailsOpen(false);
    // Depois de um pequeno atraso, limpar o estado selecionado
    setTimeout(() => {
      setSelectedLicense(null);
      setVisibleStateFlows([]);
    }, 100);
  };

  // Formatar data com tratamento de erros
  const formatDate = (dateString: string | Date | undefined | null) => {
    try {
      if (!dateString) {
        return "Data não disponível";
      }
      
      let date;
      if (typeof dateString === 'string') {
        date = new Date(dateString);
      } else {
        date = dateString;
      }
      
      if (!date || isNaN(date.getTime())) {
        return "Data inválida";
      }
      
      return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }).format(date);
    } catch (error) {
      console.error("Erro ao formatar data:", error);
      return "Data indisponível";
    }
  };

  const handleExportCSV = () => {
    if (!filteredLicenses || filteredLicenses.length === 0) {
      toast({
        title: "Nenhum dado para exportar",
        description: "Não há licenças para exportar",
        variant: "destructive",
      });
      return;
    }

    try {
      const headers = [
        "ID",
        "Número do Pedido",
        "Tipo de Licença",
        "Placa Principal",
        "Status",
        "Estados",
        "Transportador",
        "Data de Criação",
        "Última Atualização"
      ];

      const formattedData = filteredLicenses.map(license => ({
        ID: license.id,
        "Número do Pedido": license.requestNumber,
        "Tipo de Licença": getLicenseTypeLabel(license.type),
        "Placa Principal": license.mainVehiclePlate,
        Status: license.status === "pending_registration" ? "Pendente de Registro" :
                license.status === "registration_in_progress" ? "Registro em Andamento" :
                license.status === "pending_documentation" ? "Pendente Documentação" :
                license.status === "under_review" ? "Em Análise" :
                license.status === "pending_approval" ? "Pendente de Aprovação" :
                license.status === "approved" ? "Aprovado" :
                license.status === "rejected" ? "Rejeitado" :
                license.status === "canceled" ? "Cancelado" : license.status,
        Estados: license.states.join(", "),
        Transportador: (() => {
          const transporter = transporters.find(t => t.id === license.transporterId);
          return transporter?.name || transporter?.tradeName || `ID: ${license.transporterId}`;
        })(),
        "Data de Criação": formatDateForCSV(license.createdAt),
        "Última Atualização": formatDateForCSV(license.updatedAt)
      }));

      exportToCSV({
        filename: "licencas",
        headers,
        data: formattedData
      });

      toast({
        title: "Exportação concluída",
        description: `${filteredLicenses.length} licenças exportadas com sucesso`,
      });
    } catch (error) {
      toast({
        title: "Erro na exportação",
        description: "Ocorreu um erro ao exportar os dados",
        variant: "destructive",
      });
    }
  };

  // Opções de status para o select com descrições detalhadas
  const statusOptions = [
    { value: "pending_registration", label: "Pedido em Cadastramento", description: "Status inicial do pedido" },
    { value: "registration_in_progress", label: "Cadastro em Andamento", description: "Em fase de edição pelo usuário" },
    { value: "pending_documentation", label: "Pendente Documentação", description: "Aguardando documentos pendentes" },
    { value: "rejected", label: "Reprovado", description: "Com justificativa de pendências" },
    { value: "under_review", label: "Análise do Órgão", description: "Em avaliação oficial" },
    { value: "pending_approval", label: "Pendente Liberação", description: "Aguardando aprovação final" },
    { value: "approved", label: "Liberada", description: "Licença aprovada com documento disponível" },
    { value: "canceled", label: "Cancelado", description: "Licença cancelada pelo cliente ou pelo sistema" },
  ];

  return (
    <AdminLayout>
      <div className="container mx-auto py-4 px-3 md:px-6 md:py-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 md:mb-6">
          <div className="flex flex-col">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight leading-tight">Licenças</h1>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 bg-white"
                  onClick={handleExportCSV}
                  disabled={isLoading}
                  title="Exportar dados das licenças"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Exportar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className={`h-9 bg-white ${isConnected ? 'border-green-200' : 'border-gray-200'}`}
                  onClick={handleRefresh}
                  disabled={isRefreshing || isLoading}
                  title={`Atualizar lista de licenças ${isConnected ? '(Tempo real ativo)' : '(Offline)'}`}
                >
                  <div className="flex items-center">
                    {isRefreshing ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    {isConnected && (
                      <div className="w-2 h-2 bg-green-500 rounded-full mr-1" title="Conectado em tempo real" />
                    )}
                  </div>
                  {isRefreshing ? 'Atualizando...' : 'Atualizar'}
                </Button>
              </div>
            </div>
            <p className="text-sm md:text-base text-muted-foreground mt-1">
              Gerencie todas as licenças no sistema.
            </p>
          </div>
        </div>

        <div className="flex flex-col space-y-4">
          <Card>
            <CardContent className="pt-4 px-3 md:pt-6 md:px-6">
              {/* Novo layout de pesquisa conforme mockup, similar ao da página "Acompanhar Licença" */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 md:gap-4 mb-5">
                <div>
                  <div className="flex flex-col space-y-1">
                    <Label htmlFor="license-search" className="text-sm">Pesquisar</Label>
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-gray-500" />
                      <Input
                        id="license-search"
                        placeholder="Nº do pedido ou placa..."
                        className="pl-8 h-9 text-sm"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
                
                <div>
                  <div className="flex flex-col space-y-1">
                    <Label htmlFor="status-filter" className="text-sm">Status</Label>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger id="status-filter" className="h-9 text-sm">
                        <SelectValue placeholder="Todos os status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos os status</SelectItem>
                        {statusOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            <StatusBadge status={option.value} />
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div>
                  <div className="flex flex-col space-y-1">
                    <Label htmlFor="state-filter" className="text-sm">Estado</Label>
                    <Select value={stateFilter} onValueChange={setStateFilter}>
                      <SelectTrigger id="state-filter" className="h-9 text-sm">
                        <SelectValue placeholder="Todos os estados" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all_states">Todos os estados</SelectItem>
                        {brazilianStates.map((state) => (
                          <SelectItem key={state.code} value={state.code}>
                            {state.code} - {state.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div>
                  <div className="flex flex-col space-y-1">
                    <Label htmlFor="date-filter" className="text-sm">Data</Label>
                    <Input
                      id="date-filter"
                      type="date"
                      className="h-9 text-sm"
                      value={dateFilter}
                      onChange={(e) => setDateFilter(e.target.value)}
                    />
                  </div>
                </div>
                
                <div className="md:col-span-4">
                  <div className="flex flex-col space-y-1">
                    <Label htmlFor="transporter-search" className="text-sm">Transportador</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        id="transporter-search"
                        type="text"
                        placeholder="Digite o nome, CNPJ ou CPF do transportador"
                        value={transporterSearchTerm}
                        onChange={(e) => setTransporterSearchTerm(e.target.value)}
                        className="pl-10 h-9 text-sm"
                      />
                      {transporterSearchTerm && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setTransporterSearchTerm("")}
                          className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7 p-0 hover:bg-gray-100"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {isLoading ? (
                <div className="flex justify-center items-center h-60">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : (
                <>
                  {/* Visão Desktop */}
                  <div className="hidden md:block">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead 
                            className="cursor-pointer hover:bg-gray-50"
                            onClick={() => {
                              if (sortField === 'requestNumber') {
                                setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                              } else {
                                setSortField('requestNumber');
                                setSortDirection('asc');
                              }
                            }}
                          >
                            <div className="flex items-center">
                              Nº Solicitação
                              {sortField === 'requestNumber' && (
                                <span className="ml-1">
                                  {sortDirection === 'asc' ? '↑' : '↓'}
                                </span>
                              )}
                            </div>
                          </TableHead>
                          <TableHead
                            className="cursor-pointer hover:bg-gray-50"
                            onClick={() => {
                              if (sortField === 'type') {
                                setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                              } else {
                                setSortField('type');
                                setSortDirection('asc');
                              }
                            }}
                          >
                            <div className="flex items-center">
                              Tipo
                              {sortField === 'type' && (
                                <span className="ml-1">
                                  {sortDirection === 'asc' ? '↑' : '↓'}
                                </span>
                              )}
                            </div>
                          </TableHead>
                          <TableHead
                            className="cursor-pointer hover:bg-gray-50"
                            onClick={() => {
                              if (sortField === 'mainVehiclePlate') {
                                setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                              } else {
                                setSortField('mainVehiclePlate');
                                setSortDirection('asc');
                              }
                            }}
                          >
                            <div className="flex items-center">
                              Veículo Principal
                              {sortField === 'mainVehiclePlate' && (
                                <span className="ml-1">
                                  {sortDirection === 'asc' ? '↑' : '↓'}
                                </span>
                              )}
                            </div>
                          </TableHead>
                          <TableHead>Transportador</TableHead>
                          <TableHead>Estados</TableHead>
                          <TableHead
                            className="cursor-pointer hover:bg-gray-50"
                            onClick={() => {
                              if (sortField === 'status') {
                                setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                              } else {
                                setSortField('status');
                                setSortDirection('asc');
                              }
                            }}
                          >
                            <div className="flex items-center">
                              Status
                              {sortField === 'status' && (
                                <span className="ml-1">
                                  {sortDirection === 'asc' ? '↑' : '↓'}
                                </span>
                              )}
                            </div>
                          </TableHead>
                          <TableHead
                            className="cursor-pointer hover:bg-gray-50"
                            onClick={() => {
                              if (sortField === 'createdAt') {
                                setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                              } else {
                                setSortField('createdAt');
                                setSortDirection('desc'); // Padrão decrescente para datas
                              }
                            }}
                          >
                            <div className="flex items-center">
                              Data de Solicitação
                              {sortField === 'createdAt' && (
                                <span className="ml-1">
                                  {sortDirection === 'asc' ? '↑' : '↓'}
                                </span>
                              )}
                            </div>
                          </TableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredLicenses.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={8} className="text-center py-6">
                              Nenhuma licença encontrada
                            </TableCell>
                          </TableRow>
                        ) : (
                          (paginatedLicenses as LicenseRequest[]).map((license) => (
                            <TableRow key={license.id}>
                              <TableCell className="font-medium">{license.requestNumber}</TableCell>
                              <TableCell>
                                {getLicenseTypeLabel(license.type)}
                              </TableCell>
                              <TableCell>{license.mainVehiclePlate}</TableCell>
                              <TableCell>
                                {license.transporterId ? (
                                  <TransporterWithSubsidiaries 
                                    transporterId={license.transporterId} 
                                    compact={true}
                                  />
                                ) : (
                                  <div className="text-sm text-gray-500">Sem transportador</div>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-wrap gap-1">
                                  {license.states.map((state, idx) => {
                                    // Encontrar o status atual deste estado
                                    let stateStatus = "pending";
                                    if (license.stateStatuses && license.stateStatuses.length > 0) {
                                      const stateStatusEntry = license.stateStatuses.find(entry => entry.startsWith(`${state}:`));
                                      if (stateStatusEntry) {
                                        const [_, status] = stateStatusEntry.split(':');
                                        if (status) {
                                          stateStatus = status;
                                        }
                                      }
                                    }
                                    
                                    // Definir cores baseadas no status - seguindo o padrão do StatusBadge
                                    let badgeClass = "bg-gray-100 border-gray-200 text-gray-800"; // default/pending
                                    switch (stateStatus) {
                                      case "approved":
                                      case "released":
                                        badgeClass = "bg-green-100 border-green-200 text-green-800";
                                        break;
                                      case "rejected":
                                        badgeClass = "bg-red-100 border-red-200 text-red-800";
                                        break;
                                      case "pending_approval":
                                      case "pending_release":
                                        badgeClass = "bg-purple-100 border-purple-200 text-purple-800";
                                        break;
                                      case "in_progress":
                                      case "registration_in_progress":
                                        badgeClass = "bg-blue-100 border-blue-200 text-blue-800";
                                        break;
                                      case "pending_documentation":
                                        badgeClass = "bg-orange-100 border-orange-200 text-orange-800";
                                        break;
                                      case "analyzing":
                                      case "under_review":
                                        badgeClass = "bg-yellow-100 border-yellow-200 text-yellow-800";
                                        break;
                                      case "canceled":
                                        badgeClass = "bg-[#FFEDED] border-[#B22222] text-[#B22222]";
                                        break;
                                      case "pending":
                                      case "pending_registration":
                                      default:
                                        badgeClass = "bg-gray-100 border-gray-200 text-gray-800";
                                        break;
                                    }
                                    
                                    return (
                                      <Badge key={idx} variant="outline" className={`text-xs ${badgeClass}`}>
                                        {state}
                                      </Badge>
                                    );
                                  })}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center">
                                  <StatusBadge status={license.status} />
                                </div>
                              </TableCell>
                              <TableCell>{formatDate(license.createdAt)}</TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleViewDetails(license)}
                                    className="flex items-center"
                                  >
                                    <Pencil className="h-4 w-4 mr-1" />
                                    Detalhes
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Visão Mobile (Cards) */}
                  <div className="grid grid-cols-1 gap-4 md:hidden">
                    {paginatedLicenses.length === 0 ? (
                      <div className="text-center py-6 text-gray-500">
                        Nenhuma licença encontrada
                      </div>
                    ) : (
                      (paginatedLicenses as LicenseRequest[]).map((license) => (
                        <Card key={license.id} className="overflow-hidden">
                          <CardContent className="p-3">
                            <div className="flex flex-col gap-1.5">
                              <div className="flex justify-between items-start">
                                <div>
                                  <h3 className="font-medium text-base">{license.requestNumber}</h3>
                                  <p className="text-xs text-gray-500">
                                    {getLicenseTypeLabel(license.type)}
                                  </p>
                                </div>
                                <StatusBadge status={license.status} />
                              </div>
                              
                              <div className="mt-1.5 space-y-1">
                                <div className="flex items-center text-xs">
                                  <span className="font-medium min-w-[70px]">Veículo:</span> 
                                  <span className="truncate">{license.mainVehiclePlate}</span>
                                </div>
                                <div className="flex items-start text-xs">
                                  <span className="font-medium min-w-[70px] mt-0.5">Transportador:</span>
                                  <span className="truncate">
                                    <TransporterInfo transporterId={license.transporterId} compact={true} />
                                  </span>
                                </div>
                                <div className="flex items-center text-xs">
                                  <span className="font-medium min-w-[70px]">Data:</span> 
                                  <span>{formatDate(license.createdAt)}</span>
                                </div>
                                <div className="mt-1">
                                  <span className="text-xs font-medium">Estados:</span>
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {license.states.map((state, idx) => {
                                      // Encontrar o status atual deste estado
                                      let stateStatus = "pending";
                                      if (license.stateStatuses && license.stateStatuses.length > 0) {
                                        const stateStatusEntry = license.stateStatuses.find(entry => entry.startsWith(`${state}:`));
                                        if (stateStatusEntry) {
                                          const [_, status] = stateStatusEntry.split(':');
                                          if (status) {
                                            stateStatus = status;
                                          }
                                        }
                                      }
                                      
                                      // Definir cores baseadas no status
                                      let badgeClass = "bg-gray-100 border-gray-200 text-gray-800";
                                      if (stateStatus === "approved") {
                                        badgeClass = "bg-green-50 border-green-200 text-green-800";
                                      } else if (stateStatus === "rejected") {
                                        badgeClass = "bg-red-50 border-red-200 text-red-800";
                                      } else if (stateStatus === "pending_approval") {
                                        badgeClass = "bg-yellow-50 border-yellow-200 text-yellow-800";
                                      } else if (stateStatus === "under_review") {
                                        badgeClass = "bg-blue-50 border-blue-200 text-blue-800";
                                      }
                                      
                                      return (
                                        <Badge key={idx} variant="outline" className={`text-[10px] px-1.5 py-0.5 ${badgeClass}`}>
                                          {state}
                                        </Badge>
                                      );
                                    })}
                                  </div>
                                </div>
                              </div>

                              <div className="flex justify-center mt-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleViewDetails(license)}
                                  className="flex items-center h-8 text-xs"
                                >
                                  <Pencil className="h-3.5 w-3.5 mr-1" />
                                  Detalhes
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </div>
                </>
              )}

              {/* PAGINAÇÃO OTIMIZADA PARA 50K+ REGISTROS */}
              {pagination && pagination.total > 0 && (
                  <div className="mt-6 flex flex-col sm:flex-row gap-4 items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                      Mostrando {((pagination.page - 1) * pagination.limit) + 1} a {Math.min(pagination.page * pagination.limit, pagination.total)} de {pagination.total} licenças
                      {response.performance && (
                        <span className="ml-2 text-green-600 font-mono">
                          {response.performance.executionTime}ms
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <select 
                        value={pageSize} 
                        onChange={(e) => setPageSize(parseInt(e.target.value))}
                        className="border rounded px-2 py-1 text-sm"
                      >
                        <option value={10}>10 por página</option>
                        <option value={25}>25 por página</option>
                        <option value={50}>50 por página</option>
                        <option value={100}>100 por página</option>
                      </select>
                      
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(1)}
                          disabled={!pagination.hasPrev}
                        >
                          ««
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(currentPage - 1)}
                          disabled={!pagination.hasPrev}
                        >
                          ‹
                        </Button>
                        <span className="text-sm px-3">
                          {currentPage} de {pagination.totalPages}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(currentPage + 1)}
                          disabled={!pagination.hasNext}
                        >
                          ›
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(pagination.totalPages)}
                          disabled={!pagination.hasNext}
                        >
                          »»
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              
              {/* Controles de paginação - Versão mobile */}
              {pagination && pagination.total > 0 && (
                <div className="block md:hidden mt-6">
                  <MobileListPagination
                    currentPage={currentPage}
                    totalPages={pagination.totalPages}
                    totalItems={pagination.total}
                    itemsPerPage={pageSize}
                    hasPrev={pagination.hasPrev}
                    hasNext={pagination.hasNext}
                    startItem={((pagination.page - 1) * pagination.limit) + 1}
                    endItem={Math.min(pagination.page * pagination.limit, pagination.total)}
                    onPageChange={setCurrentPage}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* O diálogo para atualizar status foi removido pois o status agora só é editado por estado individual */}

      {/* Diálogo para atualizar status por estado */}
      <Dialog open={stateStatusDialogOpen} onOpenChange={setStateStatusDialogOpen}>
        <DialogContent className="w-full max-w-4xl mx-auto overflow-y-auto max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Editar Status do Estado {selectedState}</DialogTitle>
            <DialogDescription>
              Atualize as informações da licença para este estado
            </DialogDescription>
          </DialogHeader>
          <Form {...stateStatusForm}>
            <div className="mb-4 p-3 bg-gray-50 rounded-md border border-gray-200">
              <h4 className="font-medium text-sm mb-2">Guia de Fluxo de Status:</h4>
              <ul className="text-sm space-y-1">
                <li><span className="font-semibold">Pedido em Cadastramento:</span> Status inicial do pedido</li>
                <li><span className="font-semibold">Cadastro em Andamento:</span> Em fase de edição pelo usuário</li>
                <li><span className="font-semibold">Reprovado:</span> Com justificativa de pendências</li>
                <li><span className="font-semibold">Análise do Órgão:</span> Em avaliação oficial</li>
                <li><span className="font-semibold">Pendente Liberação:</span> Aguardando aprovação final</li>
                <li><span className="font-semibold">Liberada:</span> Licença aprovada com documento disponível</li>
                <li><span className="font-semibold">Cancelado:</span> Licença cancelada pelo cliente ou pelo sistema</li>
              </ul>
            </div>
            <form onSubmit={stateStatusForm.handleSubmit(onSubmitStateStatus)} className="space-y-6">
              {/* Campo Transportador */}
              <div className="mb-4">
                <FormLabel className="text-sm font-medium text-gray-700 mb-2 block">Solicitante</FormLabel>
                {selectedLicense?.transporterId ? (
                  <TransporterWithSubsidiaries 
                    transporterId={selectedLicense.transporterId} 
                    compact={false}
                  />
                ) : (
                  <div className="text-sm text-gray-500 p-3 border border-gray-200 rounded-lg">
                    Nenhum transportador vinculado
                  </div>
                )}
              </div>

              {/* Campo CNPJ Cadastrado */}
              {selectedLicense?.transporterId && (
                <FormField
                  control={stateStatusForm.control}
                  name="selectedCnpj"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-gray-700 mb-2 block">
                        CNPJ Transportador <span className="text-red-500">*</span>
                      </FormLabel>
                      <TransporterCnpjSelector 
                        transporterId={selectedLicense.transporterId!}
                        selectedCnpj={field.value}
                        licenseId={selectedLicense.id}
                        state={selectedState}
                        onCnpjSelect={(cnpj, label) => {
                          console.log('[Form] CNPJ selecionado para estado:', selectedState, cnpj);
                          field.onChange(cnpj);
                        }}
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={stateStatusForm.control}
                  name="state"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Estado</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value} disabled>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione um estado" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {brazilianStates.map((state) => (
                            <SelectItem key={state.code} value={state.code}>
                              {state.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={stateStatusForm.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione um status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {statusOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <FormField
                control={stateStatusForm.control}
                name="comments"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Comentários (opcional)</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Adicione comentários sobre a atualização do status" 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {/* Campo para Número de AET quando status for Análise do Órgão, Pendente Liberação ou Liberada */}
              {(stateStatusForm.watch("status") === "under_review" || 
                stateStatusForm.watch("status") === "pending_approval" || 
                stateStatusForm.watch("status") === "approved") && (
                <div className="space-y-4">
                  <h3 className="font-medium text-sm text-gray-800 mt-2 border-t pt-4">
                    {stateStatusForm.watch("status") === "under_review" && "Informações para Análise do Órgão"}
                    {stateStatusForm.watch("status") === "pending_approval" && "Informações para Pendente Liberação"}
                    {stateStatusForm.watch("status") === "approved" && "Número da AET"}
                  </h3>
                  <div className="grid grid-cols-1 gap-4">
                    <FormField
                      control={stateStatusForm.control}
                      name="aetNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            Número da AET para {selectedState} <span className="text-red-500">*</span>
                          </FormLabel>
                          <FormControl>
                            <Input
                              placeholder={`Digite o número da AET para ${selectedState}`}
                              {...field}
                              className="w-full"
                              onChange={(e) => {
                                field.onChange(e);
                                // Validar unicidade em tempo real
                                if (selectedLicense && e.target.value) {
                                  const error = validateAetNumberUniqueness(e.target.value, selectedState, selectedLicense);
                                  setAetNumberValidationError(error || "");
                                } else {
                                  setAetNumberValidationError("");
                                }
                              }}
                            />
                          </FormControl>
                          {aetNumberValidationError && (
                            <p className="text-xs text-red-600 mt-1">
                              ⚠️ {aetNumberValidationError}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground mt-1">
                            Número único para este estado específico
                          </p>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              )}
              
              {/* Campo de upload de arquivo PDF para status "Liberada" */}
              {stateStatusForm.watch("status") === "approved" && (
                <div className="space-y-4">
                  <h3 className="font-medium text-sm text-gray-800 mt-2 border-t pt-4">Informações para Licença Liberada</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={stateStatusForm.control}
                      name="issuedAt"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            Data de Emissão <span className="text-red-500">*</span>
                          </FormLabel>
                          <FormControl>
                            <Input
                              type="date"
                              value={field.value || ""}
                              onChange={field.onChange}
                              onBlur={field.onBlur}
                              name={field.name}
                              max={new Date().toISOString().split('T')[0]}
                              className="w-full"
                            />
                          </FormControl>
                          <p className="text-xs text-muted-foreground mt-1">
                            Data de emissão obrigatória para liberação
                          </p>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={stateStatusForm.control}
                      name="validUntil"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            Vencimento da Licença <span className="text-red-500">*</span>
                          </FormLabel>
                          <FormControl>
                            <Input
                              type="date"
                              value={field.value || ""}
                              onChange={field.onChange}
                              onBlur={field.onBlur}
                              name={field.name}
                              min={new Date().toISOString().split('T')[0]}
                              className="w-full"
                            />
                          </FormControl>
                          <p className="text-xs text-muted-foreground mt-1">
                            Data de vencimento obrigatória para liberação
                          </p>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-4">
                    <FormField
                      control={stateStatusForm.control}
                      name="licenseFile"
                      render={({ field: { value, onChange, ...field } }) => (
                        <FormItem>
                          <FormLabel>
                            Upload Licença para {selectedState} <span className="text-red-500">*</span>
                          </FormLabel>
                          <div 
                            className="mt-1 flex justify-center px-4 pt-4 pb-5 border-2 border-gray-300 border-dashed rounded-md"
                            onDragOver={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                            }}
                            onDrop={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              const files = e.dataTransfer.files;
                              if (files && files[0]) {
                                onChange(files[0]);
                              }
                            }}
                          >
                            <div className="space-y-1 text-center">
                              <UploadCloud className="mx-auto h-10 w-10 text-gray-400" />
                              <div className="flex text-sm text-gray-600">
                                <label
                                  htmlFor="licenseFile"
                                  className="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none"
                                >
                                  <span>Carregar arquivo</span>
                                  <input
                                    id="licenseFile"
                                    type="file"
                                    className="sr-only"
                                    accept=".pdf,application/pdf"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      onChange(file);
                                    }}
                                    {...field}
                                  />
                                </label>
                                <p className="pl-1">ou arraste e solte</p>
                              </div>
                              <p className="text-xs text-gray-500">
                                PDF até 10MB
                              </p>
                              {value && (
                                <p className="text-sm text-green-600">
                                  Arquivo selecionado: {value.name}
                                </p>
                              )}
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            Arquivo PDF específico para o estado {selectedState}
                          </p>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              )}
              
              {/* Campo de upload de arquivo PDF para status "Reprovado" */}
              {stateStatusForm.watch("status") === "rejected" && (
                <div className="space-y-4">
                  <h3 className="font-medium text-sm text-gray-800 mt-2 border-t pt-4">Informações para Licença Reprovada</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={stateStatusForm.control}
                      name="comments"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            Motivo da Reprovação <span className="text-red-500">*</span>
                          </FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Detalhe os motivos da reprovação"
                              className="min-h-[100px]"
                              {...field}
                            />
                          </FormControl>
                          <p className="text-xs text-muted-foreground mt-1">
                            Informações sobre o motivo da reprovação
                          </p>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={stateStatusForm.control}
                      name="licenseFile"
                      render={({ field: { value, onChange, ...field } }) => (
                        <FormItem>
                          <FormLabel>
                            Upload Documento de Reprovação <span className="text-red-500">*</span>
                          </FormLabel>
                          <div 
                            className="mt-1 flex justify-center px-4 pt-4 pb-5 border-2 border-gray-300 border-dashed rounded-md"
                            onDragOver={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                            }}
                            onDrop={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              const files = e.dataTransfer.files;
                              if (files && files[0]) {
                                onChange(files[0]);
                              }
                            }}
                          >
                            <div className="space-y-1 text-center">
                              <UploadCloud className="mx-auto h-10 w-10 text-gray-400" />
                              <div className="flex text-sm text-gray-600">
                                <label
                                  htmlFor="licenseFile-rejected"
                                  className="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none"
                                >
                                  <span>Carregar arquivo</span>
                                  <input
                                    id="licenseFile-rejected"
                                    type="file"
                                    className="sr-only"
                                    accept=".pdf,application/pdf"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      onChange(file);
                                    }}
                                    {...field}
                                  />
                                </label>
                                <p className="pl-1">ou arraste e solte</p>
                              </div>
                              <p className="text-xs text-gray-500">
                                PDF até 10MB
                              </p>
                              {value && (
                                <p className="text-sm text-green-600">
                                  Arquivo selecionado: {value.name}
                                </p>
                              )}
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            Documento com razões da reprovação
                          </p>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              )}
              <div className="mt-6 flex flex-col sm:flex-row justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setStateStatusDialogOpen(false);
                    setAetNumberValidationError("");
                    stateStatusForm.reset();
                  }}
                  disabled={updateStateStatusMutation.isPending}
                  className="w-full sm:w-auto"
                >
                  Cancelar
                </Button>
                <button 
                  type="submit" 
                  disabled={
                    updateStateStatusMutation.isPending || 
                    !!aetNumberValidationError ||
                    ((stateStatusForm.watch("status") === "under_review" || 
                      stateStatusForm.watch("status") === "pending_approval" || 
                      stateStatusForm.watch("status") === "approved") && 
                     !stateStatusForm.watch("aetNumber"))
                  }
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium text-sm w-full sm:w-auto flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={(e) => {
                    e.preventDefault();
                    stateStatusForm.handleSubmit(onSubmitStateStatus)();
                  }}
                >
                  {updateStateStatusMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Salvar
                </button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Diálogo para ver detalhes da licença */}
      <Dialog open={licenseDetailsOpen} onOpenChange={handleCloseLicenseDetails}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader className="pb-2">
            <DialogTitle className="text-xl">Detalhes da Licença</DialogTitle>
            <DialogDescription>
              Visualize todos os detalhes da licença
            </DialogDescription>
          </DialogHeader>
          {selectedLicense && (
            <div className="space-y-4">
              <div className="mb-4 p-3 bg-gray-50 rounded-md border border-gray-200 overflow-x-auto">
                <h4 className="font-medium text-sm mb-2">Fluxo de Progresso da Licença:</h4>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-medium text-gray-500">Status atual:</div>
                  <StatusBadge status={selectedLicense.status} licenseId={selectedLicense.id} />
                </div>
                <ProgressFlow 
                  currentStatus={selectedLicense.status} 
                  size="md" 
                  licenseId={selectedLicense.id}
                />
              </div>
              
              {/* Tabs para separar o conteúdo */}
              <Tabs defaultValue="details" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="details">Detalhes da Licença</TabsTrigger>
                  <TabsTrigger value="states">Status por Estado</TabsTrigger>
                </TabsList>
                
                {/* Aba de Detalhes */}
                <TabsContent value="details" className="pt-4">
                  {/* Utilizando o componente LicenseDetailsCard para exibição dos detalhes */}
                  <LicenseDetailsCard license={selectedLicense} />
                  
                  {/* Campo de Observações */}
                  {selectedLicense.comments && selectedLicense.comments.trim() && (
                    <div className="mt-4">
                      <h3 className="text-sm font-medium text-gray-500">Observações</h3>
                      <div className="mt-1 p-3 bg-gray-50 border border-gray-200 rounded-md">
                        <p className="text-gray-900 text-sm whitespace-pre-wrap">{selectedLicense.comments}</p>
                      </div>
                    </div>
                  )}
                </TabsContent>
                
                {/* Aba de Status por Estado */}
                <TabsContent value="states" className="pt-4">
                  <div className="bg-gray-50 p-4 rounded-lg shadow-sm border border-gray-200">
                    <h3 className="font-semibold text-base text-gray-700 mb-3 flex items-center">
                      <MapPin className="h-4 w-4 mr-2 text-blue-600" />
                      Status por Estado
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {selectedLicense.states.map((state) => {
                    // Encontrar o status atual deste estado
                    let stateStatus = "pending";
                    if (selectedLicense.stateStatuses && selectedLicense.stateStatuses.length > 0) {
                      const stateStatusEntry = selectedLicense.stateStatuses.find(entry => entry.startsWith(`${state}:`));
                      if (stateStatusEntry) {
                        const [_, status] = stateStatusEntry.split(':');
                        if (status) {
                          stateStatus = status;
                        }
                      }
                    }
                    
                    // Definir cores baseadas no status
                    let borderColor = "border-gray-200";
                    if (stateStatus === "approved") {
                      borderColor = "border-green-200";
                    } else if (stateStatus === "rejected") {
                      borderColor = "border-red-200";
                    } else if (stateStatus === "pending_approval") {
                      borderColor = "border-yellow-200";
                    }
                    
                    return (
                      <div 
                        key={state} 
                        className={`border-l-4 ${borderColor} rounded-md p-3 flex flex-col gap-2 bg-white shadow-sm hover:shadow-md transition-all duration-200`}
                      >
                        <div className="grid grid-cols-3 gap-2">
                          <div className="col-span-2 flex items-center gap-2">
                            <div className="bg-blue-50 text-blue-800 font-bold px-2 py-1 rounded text-sm min-w-[40px] text-center">
                              {state}
                            </div>
                            <StatusBadge 
                              status={stateStatus} 
                              licenseId={selectedLicense.id}
                              state={state}
                            />
                          </div>
                          <div className="col-span-1 flex items-center justify-end gap-1">
                            <Button 
                              size="icon"
                              variant="outline"
                              className="h-8 w-8 rounded-full border-blue-200 hover:bg-blue-50"
                              onClick={() => {
                                // Encontrar o estado no array de estados visíveis e alternar
                                const stateFlowVisible = visibleStateFlows.includes(state);
                                if (stateFlowVisible) {
                                  setVisibleStateFlows(visibleStateFlows.filter(s => s !== state));
                                } else {
                                  setVisibleStateFlows([...visibleStateFlows, state]);
                                }
                              }}
                              title={visibleStateFlows.includes(state) ? "Ocultar progresso" : "Mostrar progresso"}
                            >
                              {visibleStateFlows.includes(state) ? 
                                <Eye className="h-4 w-4 text-blue-600" /> : 
                                <EyeOff className="h-4 w-4 text-gray-600" />
                              }
                            </Button>
                            <Button 
                              size="icon"
                              variant="outline"
                              className="h-8 w-8 rounded-full border-green-200 hover:bg-green-50"
                              onClick={() => handleStateStatusUpdate(selectedLicense, state)}
                              title="Atualizar status"
                            >
                              <Pencil className="h-4 w-4 text-green-600" />
                            </Button>
                          </div>
                        </div>
                        
                        {/* Fluxo de Progresso do Estado */}
                        {visibleStateFlows.includes(state) && (
                          <div className="mt-2 pt-2 overflow-x-auto bg-gray-50 rounded-md p-2 border border-gray-100">
                            <StateProgressFlow 
                              stateStatus={stateStatus} 
                              size="sm" 
                              className="py-1"
                              licenseId={selectedLicense.id}
                              state={state}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                </div>
                </TabsContent>
              </Tabs>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {selectedLicense.comments && (
                  <div className="bg-gray-50 p-3 rounded-md">
                    <h3 className="font-medium text-sm text-gray-500 mb-2">Comentários</h3>
                    <div className="bg-white p-3 rounded border text-sm max-h-28 overflow-y-auto">
                      {selectedLicense.comments}
                    </div>
                  </div>
                )}


              </div>

              <div className="flex justify-center items-center gap-4 mt-6 mb-2">
                <div className="bg-gray-50 rounded-md px-8 py-3 shadow-sm mx-auto">
                  <Button 
                    onClick={handleCloseLicenseDetails}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-2 rounded-md"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Fechar detalhes
                  </Button>
                </div>
                
                {/* Botão de excluir licença - não visível para usuários operacionais */}
                {!isOperational && (
                  <div className="bg-gray-50 rounded-md px-8 py-3 shadow-sm mx-auto">
                    <Button 
                      onClick={handleDeleteLicense}
                      variant="destructive"
                      className="px-8 py-2 rounded-md"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Excluir Licença
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      
      {/* Diálogo de confirmação de exclusão */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Licença</AlertDialogTitle>
            <AlertDialogDescription>
              Você tem certeza que deseja excluir esta licença?
              Esta ação não pode ser desfeita e todos os dados associados serão perdidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteLicenseMutation.isPending}
            >
              {deleteLicenseMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Excluindo...
                </>
              ) : (
                "Excluir"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}