import React, { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { DimensionField } from "./dimension-field";
import {
  insertLicenseRequestSchema,
  insertDraftLicenseSchema,
  brazilianStates,
  licenseTypeEnum,
  Vehicle,
  LicenseRequest,
  Transporter,
  insertVehicleSchema,
} from "@shared/schema";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
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
import { CampoPlacaAdicional } from "./placas-adicionais";
import { VehicleSelectCard } from "./vehicle-select-card";
import {
  LoaderCircle,
  X,
  Plus,
  Truck,
  Search,
  Upload,
  Building2,
  Link as LinkIcon,
  FileUp,
  Check,
  Shield,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Link } from "wouter";
import { useOnClickOutside } from "@/hooks/use-on-click-outside";
import { VehicleTypeImage } from "@/components/ui/vehicle-type-image";
import { VehicleAutocomplete } from "@/components/ui/vehicle-autocomplete";
import { OptimizedTransporterSelector } from "@/components/forms/optimized-transporter-selector";

// Tipos de carga por categoria
const NON_FLATBED_CARGO_TYPES = [
  { value: "dry_cargo", label: "Carga Seca" },
  { value: "liquid_cargo", label: "Líquida" },
  { value: "live_cargo", label: "Viva" },
  { value: "sugar_cane", label: "Cana de Açúcar" },
];

const FLATBED_CARGO_TYPES = [
  { value: "indivisible_cargo", label: "Carga Indivisível" },
  { value: "agricultural_machinery", label: "Máquinas Agrícolas" },
  { value: "oversized", label: "SUPERDIMENSIONADA" },
];

// Limites dimensionais
const DIMENSION_LIMITS = {
  default: {
    maxLength: 30.0,
    minLength: 19.8,
    maxWidth: 2.6,
    maxHeight: 4.4,
  },
  flatbed: {
    maxLength: 25.0,
    minLength: 0,
    maxWidth: 3.2,
    maxHeight: 4.95,
  },
  agricultural_machinery: {
    maxLength: 25.0,
    minLength: 0,
    maxWidth: 3.2,
    maxHeight: 4.95,
  },
  oversized: {
    // Sem limites pré-definidos
    maxLength: 999.99,
    minLength: 0,
    maxWidth: 999.99,
    maxHeight: 999.99,
  },
};
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface LicenseFormProps {
  draft?: LicenseRequest | null;
  onComplete: () => void;
  onCancel: () => void;
  preSelectedTransporterId?: number | null;
}

export function LicenseForm({
  draft,
  onComplete,
  onCancel,
  preSelectedTransporterId,
}: LicenseFormProps) {
  const { toast } = useToast();
  const [licenseType, setLicenseType] = useState<string>(draft?.type || "");
  const [cargoType, setCargoType] = useState<string>("");
  const [showVehicleDialog, setShowVehicleDialog] = useState(false);
  const [showRequiredFieldsWarning, setShowRequiredFieldsWarning] =
    useState(false);
  const [showThirdPartyConfirmation, setShowThirdPartyConfirmation] = useState(false);
  const [pendingVehicleSelection, setPendingVehicleSelection] = useState<{
    vehicleId: number;
    fieldName: string;
  } | null>(null);
  
  // Estados para confirmação de envio com veículos de terceiros
  const [showSubmitConfirmation, setShowSubmitConfirmation] = useState(false);
  const [pendingSubmitData, setPendingSubmitData] = useState<any>(null);
  const [thirdPartyVehiclesInSubmit, setThirdPartyVehiclesInSubmit] = useState<string[]>([]);
  
  // Estados para validação de licenças
  const [validatingState, setValidatingState] = useState<string | null>(null);
  const [blockedStates, setBlockedStates] = useState<Record<string, any>>({});
  const [stateValidationStatus, setStateValidationStatus] = useState<Record<string, 'loading' | 'valid' | 'blocked' | 'error'>>({});
  const [preventiveValidationRunning, setPreventiveValidationRunning] = useState(false);

  // Fetch vehicles for the dropdown selectors
  const { data: vehicles, isLoading: isLoadingVehicles } = useQuery<Vehicle[]>({
    queryKey: ["/api/vehicles"],
  });

  // Fetch transporters linked to the user
  const { data: transporters = [], isLoading: isLoadingTransporters } =
    useQuery<Transporter[]>({
      queryKey: ["/api/user/transporters"],
    });

  // Define basic vehicle lists
  const tractorUnits = vehicles?.filter((v) => v.type === "tractor_unit") || [];
  const trucks = vehicles?.filter((v) => v.type === "truck") || [];
  const allSemiTrailers = vehicles?.filter((v) => v.type === "semi_trailer") || [];
  const trailers = vehicles?.filter((v) => v.type === "trailer") || [];
  const allDollys = vehicles?.filter((v) => v.type === "dolly") || [];
  const flatbeds = vehicles?.filter((v) => v.type === "flatbed") || [];

  // ✅ NOVA FUNÇÃO: Validação por combinação específica
  const validateState = async (estado: string): Promise<boolean> => {
    console.log(`[STATE VALIDATION] Iniciando validação para ${estado}, validating: ${validatingState}`);
    
    if (validatingState) {
      console.log(`[STATE VALIDATION] Já validando ${validatingState} - ignorando ${estado}`);
      return false;
    }
    
    // Coletar placas do formulário
    const watchedValues = form.watch();
    
    // ✅ NOVA LÓGICA: Verificar se temos combinação completa (Cavalo + Carreta1 + Carreta2)
    let composicao = null;
    
    // Placa do cavalo/trator
    let cavalo = null;
    if (watchedValues.tractorUnitId) {
      const tractor = vehicles?.find(v => v.id === watchedValues.tractorUnitId);
      if (tractor?.plate) cavalo = tractor.plate;
    } else if (watchedValues.mainVehiclePlate) {
      cavalo = watchedValues.mainVehiclePlate;
    }
    
    // Primeira carreta
    let carreta1 = null;
    if (watchedValues.firstTrailerId) {
      const first = vehicles?.find(v => v.id === watchedValues.firstTrailerId);
      if (first?.plate) carreta1 = first.plate;
    }
    
    // Segunda carreta
    let carreta2 = null;
    if (watchedValues.secondTrailerId) {
      const second = vehicles?.find(v => v.id === watchedValues.secondTrailerId);
      if (second?.plate) carreta2 = second.plate;
    }
    
    // Se temos combinação completa, usar validação específica
    if (cavalo && carreta1 && carreta2) {
      composicao = { cavalo, carreta1, carreta2 };
      console.log(`[STATE VALIDATION] ✅ COMBINAÇÃO COMPLETA para ${estado}:`, composicao);
    } else {
      console.log(`[STATE VALIDATION] ⚠️ Combinação incompleta para ${estado} - usando validação tradicional`);
      console.log(`[STATE VALIDATION] Cavalo: ${cavalo}, Carreta1: ${carreta1}, Carreta2: ${carreta2}`);
      
      // Fallback para validação tradicional por placas individuais
      const placas = [];
      if (cavalo) placas.push(cavalo);
      if (carreta1) placas.push(carreta1);
      if (carreta2) placas.push(carreta2);
      
      // Adicionar outras placas
      if (watchedValues.dollyId) {
        const dolly = vehicles?.find(v => v.id === watchedValues.dollyId);
        if (dolly?.plate) placas.push(dolly.plate);
      }
      
      if (watchedValues.flatbedId) {
        const flatbed = vehicles?.find(v => v.id === watchedValues.flatbedId);
        if (flatbed?.plate) placas.push(flatbed.plate);
      }
      
      if (watchedValues.additionalPlates) {
        watchedValues.additionalPlates.forEach((plate: string) => {
          if (plate) placas.push(plate);
        });
      }
      
      if (placas.length === 0) {
        console.log(`[STATE VALIDATION] Nenhuma placa - liberando ${estado}`);
        return false;
      }
    }
    
    setValidatingState(estado);
    
    try {
      // Escolher endpoint correto baseado no tipo de validação
      const endpoint = composicao ? '/api/licencas-vigentes-by-combination' : '/api/validacao-critica';
      const requestBody = composicao 
        ? { estado, composicao }
        : { estado, placas: [cavalo, carreta1, carreta2].filter(Boolean) };
      
      console.log(`[STATE VALIDATION] Usando endpoint ${endpoint} para ${estado}`);
      console.log(`[STATE VALIDATION] Request body:`, requestBody);
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(requestBody)
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }
      
      const result = await response.json();
      console.log(`[STATE VALIDATION] Resultado para ${estado}:`, result);
      
      if (result.bloqueado && result.diasRestantes > 60) {
        console.log(`[STATE VALIDATION] ${estado} BLOQUEADO - ${result.diasRestantes} dias > 60`);
        if (composicao) {
          console.log(`[STATE VALIDATION] 🚫 COMBINAÇÃO IDÊNTICA BLOQUEADA:`, result.composicao_encontrada);
        }
        
        setBlockedStates(prev => ({ ...prev, [estado]: result }));
        
        // Remover estado da seleção se foi bloqueado
        const currentStates = form.getValues().states || [];
        if (currentStates.includes(estado)) {
          console.log(`[STATE VALIDATION] Removendo ${estado} da seleção pois foi bloqueado`);
          form.setValue('states', currentStates.filter(s => s !== estado));
        }
        
        const message = composicao 
          ? `Combinação idêntica (${composicao.cavalo} + ${composicao.carreta1} + ${composicao.carreta2}) já possui licença vigente com ${result.diasRestantes} dias restantes.`
          : `Já existe licença vigente (${result.numero_licenca || result.numero}) com ${result.diasRestantes} dias restantes.`;
        
        toast({
          title: `Estado ${estado} bloqueado`,
          description: message + " Renovação permitida apenas com ≤60 dias.",
          variant: "destructive",
          duration: 8000,
        });
        
        return true; // bloqueado
      }
      
      console.log(`[STATE VALIDATION] ${estado} LIBERADO`);
      if (composicao && result.tipo_liberacao) {
        console.log(`[STATE VALIDATION] ✅ Motivo: ${result.tipo_liberacao}`);
      }
      
      // Limpar dos bloqueados se estava bloqueado antes
      setBlockedStates(prev => {
        const updated = { ...prev };
        delete updated[estado];
        return updated;
      });
      
      return false; // liberado
    } catch (error) {
      console.error(`[STATE VALIDATION] Erro ao validar ${estado}:`, error);
      return false; // em caso de erro, liberar
    } finally {
      setValidatingState(null);
    }
  };

  // Define a schema that can be validated partially (for drafts)
  const formSchema = draft?.isDraft
    ? insertDraftLicenseSchema
    : insertLicenseRequestSchema;

  // Usar o transportador pré-selecionado quando disponível
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: draft
      ? {
          type: draft.type,
          transporterId: draft.transporterId || undefined,
          mainVehiclePlate: draft.mainVehiclePlate,
          tractorUnitId: draft.tractorUnitId || undefined,
          firstTrailerId: draft.firstTrailerId || undefined,
          dollyId: draft.dollyId || undefined,
          secondTrailerId: draft.secondTrailerId || undefined,
          flatbedId: draft.flatbedId || undefined,
          length: draft.length / 100, // Convert from cm to meters for display
          width: draft.width ? draft.width / 100 : undefined, // Convert from cm to meters for display
          height: draft.height ? draft.height / 100 : undefined, // Convert from cm to meters for display
          additionalPlates: draft.additionalPlates || [],
          additionalPlatesDocuments: draft.additionalPlatesDocuments || [],
          states: draft.states,
          isDraft: draft.isDraft,
          comments: draft.comments || undefined,
          cargoType: draft.cargoType || undefined, // Preservar o tipo de carga do rascunho
        }
      : {
          type: "",
          transporterId: preSelectedTransporterId || undefined, // Usar o transportador pré-selecionado
          mainVehiclePlate: "",
          tractorUnitId: undefined,
          firstTrailerId: undefined,
          dollyId: undefined,
          secondTrailerId: undefined,
          flatbedId: undefined,
          length: undefined, // Valor não preenchido inicialmente
          width: undefined, // Sem valor padrão inicialmente
          height: undefined, // Sem valor padrão inicialmente
          additionalPlates: [],
          states: [],
          additionalPlatesDocuments: [],
          isDraft: true,
          comments: "",
          cargoType: undefined, // Adicionado para support ao tipo de carga
        },
  });

  // Efeito para mostrar notificação quando tiver transportador pré-selecionado
  useEffect(() => {
    if (preSelectedTransporterId && transporters && transporters.length > 0) {
      const selectedTransporter = transporters.find(
        (t) => t.id === preSelectedTransporterId,
      );
      if (selectedTransporter) {
        toast({
          title: "Transportador selecionado",
          description: `Usando ${selectedTransporter.name} como transportador para esta solicitação`,
        });
      }
    }
  }, [preSelectedTransporterId, transporters, toast]);

  // Função para coletar todas as placas do formulário atual
  const getFormPlates = () => {
    const placas = [];
    const watchedValues = form.watch();
    
    // Placa principal
    if (watchedValues.mainVehiclePlate) {
      placas.push(watchedValues.mainVehiclePlate);
    }
    
    // Placas dos veículos selecionados
    if (watchedValues.tractorUnitId) {
      const tractor = vehicles?.find(v => v.id === watchedValues.tractorUnitId);
      if (tractor?.plate) placas.push(tractor.plate);
    }
    
    if (watchedValues.firstTrailerId) {
      const first = vehicles?.find(v => v.id === watchedValues.firstTrailerId);
      if (first?.plate) placas.push(first.plate);
    }
    
    if (watchedValues.secondTrailerId) {
      const second = vehicles?.find(v => v.id === watchedValues.secondTrailerId);
      if (second?.plate) placas.push(second.plate);
    }
    
    if (watchedValues.dollyId) {
      const dolly = vehicles?.find(v => v.id === watchedValues.dollyId);
      if (dolly?.plate) placas.push(dolly.plate);
    }
    
    if (watchedValues.flatbedId) {
      const flatbed = vehicles?.find(v => v.id === watchedValues.flatbedId);
      if (flatbed?.plate) placas.push(flatbed.plate);
    }
    
    // Placas adicionais
    if (watchedValues.additionalPlates) {
      watchedValues.additionalPlates.forEach((plate: string) => {
        if (plate) placas.push(plate);
      });
    }
    
    return placas;
  };

  // ✅ BOTÃO MANUAL PARA VALIDAÇÃO PREVENTIVA (resolve o loop)
  const validateAllStatesManual = async () => {
    if (preventiveValidationRunning) return;
    
    const watchedValues = form.watch();
    
    // Verificar se temos combinação completa
    const cavalo = watchedValues.tractorUnitId ? 
      vehicles?.find(v => v.id === watchedValues.tractorUnitId)?.plate || watchedValues.mainVehiclePlate :
      watchedValues.mainVehiclePlate;
    const carreta1 = watchedValues.firstTrailerId ? 
      vehicles?.find(v => v.id === watchedValues.firstTrailerId)?.plate : null;
    const carreta2 = watchedValues.secondTrailerId ? 
      vehicles?.find(v => v.id === watchedValues.secondTrailerId)?.plate : null;
    const dolly = watchedValues.dollyId ? 
      vehicles?.find(v => v.id === watchedValues.dollyId)?.plate : null;
    
    // Se não temos pelo menos cavalo + carreta1
    if (!cavalo || !carreta1) {
      toast({
        title: "Combinação incompleta",
        description: "Selecione pelo menos Cavalo + Carreta 1 para validar estados",
        variant: "destructive"
      });
      return;
    }
    
    // Determinar tipo de composição
    const isSimples = !carreta2 && !dolly;
    const isBitrem = carreta2 && !dolly;
    const isRodotrem = dolly && carreta2;
    const isDollyOnly = dolly && !carreta2;
    
    // Aceitar qualquer configuração válida
    if (!isSimples && !isBitrem && !isRodotrem && !isDollyOnly) {
      toast({
        title: "Composição inválida",
        description: "Configuração de veículos não reconhecida",
        variant: "destructive"
      });
      return;
    }
    
    const tipoComposicao = isSimples ? "SIMPLES" : isBitrem ? "BITREM" : isRodotrem ? "RODOTREM" : "DOLLY";
    console.log(`[MANUAL] Tipo de composição: ${tipoComposicao}`);
    
    console.log('[MANUAL] ✅ INICIANDO validação manual para combinação:', { cavalo, carreta1, carreta2, dolly });
    
    setPreventiveValidationRunning(true);
    
    // Marcar todos como carregando
    const loadingStatus: Record<string, 'loading'> = {};
    brazilianStates.forEach(state => {
      loadingStatus[state.code] = 'loading';
    });
    setStateValidationStatus(loadingStatus);
    
    // Validar cada estado
    const newStatus: Record<string, 'valid' | 'blocked' | 'error'> = {};
    const newBlockedStates: Record<string, any> = {};
    
    for (const state of brazilianStates) {
      try {
        const response = await fetch('/api/licencas-vigentes-by-combination', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ estado: state.code, composicao: { cavalo, carreta1, carreta2, dolly } })
        });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.bloqueado && result.diasRestantes > 60) {
          newStatus[state.code] = 'blocked';
          newBlockedStates[state.code] = result;
          console.log(`[MANUAL] ${state.code} bloqueado - ${result.diasRestantes} dias`);
        } else {
          newStatus[state.code] = 'valid';
        }
      } catch (error) {
        newStatus[state.code] = 'error';
        console.log(`[MANUAL] ${state.code} erro na validação:`, error);
      }
    }
    
    setStateValidationStatus(newStatus);
    setBlockedStates(newBlockedStates);
    setPreventiveValidationRunning(false);
    
    console.log('[MANUAL] ✅ Validação manual concluída');
    
    const blockedCount = Object.values(newStatus).filter(s => s === 'blocked').length;
    const validCount = Object.values(newStatus).filter(s => s === 'valid').length;
    
    toast({
      title: "Validação concluída",
      description: `${validCount} estados disponíveis, ${blockedCount} bloqueados`
    });
  };
  
  // ✅ VALIDAÇÃO AUTOMÁTICA INTELIGENTE: Monitora mudanças nos veículos sem loops
  const [lastValidatedCombination, setLastValidatedCombination] = useState<string>("");
  
  // Função para obter combinação atual dos veículos
  const getCurrentCombination = () => {
    if (!vehicles || vehicles.length === 0) return { cavalo: "", carreta1: "", carreta2: "", dolly: "" };
    
    const tractorId = form.watch("tractorUnitId");
    const firstTrailerId = form.watch("firstTrailerId");
    const secondTrailerId = form.watch("secondTrailerId");
    const dollyId = form.watch("dollyId");
    
    const tractor = vehicles.find(v => v.id === tractorId);
    const firstTrailer = vehicles.find(v => v.id === firstTrailerId);
    const secondTrailer = vehicles.find(v => v.id === secondTrailerId);
    const dolly = vehicles.find(v => v.id === dollyId);
    
    return {
      cavalo: tractor?.plate || "",
      carreta1: firstTrailer?.plate || "",
      carreta2: secondTrailer?.plate || "",
      dolly: dolly?.plate || ""
    };
  };

  // ✅ VALIDAÇÃO AUTOMÁTICA SILENCIOSA: Executa validação e aplica resultados automaticamente
  const executeAutomaticValidation = useCallback(async () => {
    console.log('[AUTO] 🎯 INICIO executeAutomaticValidation');
    
    if (!vehicles || vehicles.length === 0) {
      console.log('[AUTO] ❌ Sem veículos disponíveis');
      return;
    }
    
    const currentCombination = getCurrentCombination();
    console.log('[AUTO] 📋 Combinação atual:', currentCombination);
    
    // Verificar se tem configuração mínima
    if (!currentCombination.cavalo || !currentCombination.carreta1) {
      console.log('[AUTO] ⚠️ Configuração mínima não atendida - aguardando cavalo + carreta1');
      return;
    }
    
    console.log('[AUTO] 🚀 Executando validação automática silenciosa...');
    setPreventiveValidationRunning(true);
    
    try {
      // Determinar tipo de composição automaticamente
      const hasSecondTrailer = !!currentCombination.carreta2;
      const hasDolly = !!currentCombination.dolly;
      
      let tipoComposicao = "SIMPLES";
      if (hasDolly && hasSecondTrailer) {
        tipoComposicao = "RODOTREM";
      } else if (hasDolly && !hasSecondTrailer) {
        tipoComposicao = "DOLLY_ONLY";
      } else if (!hasDolly && hasSecondTrailer) {
        tipoComposicao = "BITREM";
      }
      
      console.log(`[AUTO] Tipo de composição: ${tipoComposicao}`);
      console.log('[AUTO] ✅ INICIANDO validação automática para combinação:', currentCombination);
      
      const newStatus: Record<string, string> = {};
      const newBlockedStates: Record<string, any> = {};
      
      // Validar todos os estados em paralelo
      const validationPromises = brazilianStates.map(async (state) => {
        try {
          const composicao = {
            cavalo: currentCombination.cavalo,
            carreta1: currentCombination.carreta1,
            carreta2: currentCombination.carreta2 || undefined,
            dolly: currentCombination.dolly || undefined
          };
          
          const response = await fetch('/api/licencas-vigentes-by-combination', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              estado: state.code,
              composicao
            })
          });
          
          const result = await response.json();
          
          if (result.bloqueado) {
            newStatus[state.code] = 'blocked';
            newBlockedStates[state.code] = result;
            console.log(`[AUTO] ${state.code} bloqueado - ${result.dias_restantes || 'N/A'} dias`);
          } else {
            newStatus[state.code] = 'valid';
            console.log(`[AUTO] ${state.code} liberado`);
          }
        } catch (error) {
          newStatus[state.code] = 'error';
          console.log(`[AUTO] ${state.code} erro na validação:`, error);
        }
      });
      
      // Aguardar todas as validações
      await Promise.all(validationPromises);
      
      // Aplicar resultados
      setStateValidationStatus(newStatus);
      setBlockedStates(newBlockedStates);
      
      console.log('[AUTO] ✅ Validação automática concluída - status atualizado');
      
      // Remover estados bloqueados da seleção atual
      const currentSelectedStates = form.getValues().states || [];
      const blockedStatesCodes = Object.keys(newBlockedStates);
      const newSelectedStates = currentSelectedStates.filter(state => !blockedStatesCodes.includes(state));
      
      if (newSelectedStates.length !== currentSelectedStates.length) {
        console.log(`[AUTO] Removendo estados bloqueados da seleção:`, blockedStatesCodes);
        form.setValue('states', newSelectedStates);
      }
    } catch (error) {
      console.error('[AUTO] ❌ Erro na validação automática:', error);
    } finally {
      setPreventiveValidationRunning(false);
    }
  }, [vehicles, getCurrentCombination, setPreventiveValidationRunning, setStateValidationStatus, setBlockedStates, form]);
  
  useEffect(() => {
    if (!vehicles || vehicles.length === 0) return;
    
    // Obter combinação atual
    const currentCombination = getCurrentCombination();
    const combinationKey = `${currentCombination.cavalo}-${currentCombination.carreta1}-${currentCombination.carreta2}-${currentCombination.dolly}`;
    
    // Só executar se:
    // 1. Combinação mínima (cavalo + carreta1) 
    // 2. Combinação diferente da última validada
    // 3. Não está executando validação
    const hasMinimumCombination = currentCombination.cavalo && currentCombination.carreta1;
    
    if (hasMinimumCombination &&
        combinationKey !== lastValidatedCombination &&
        !preventiveValidationRunning) {
      
      console.log(`[AUTO] 🚀 Executando validação automática para nova combinação: ${combinationKey}`);
      
      // Marcar como validada ANTES de executar para evitar loops
      setLastValidatedCombination(combinationKey);
      
      // Executar validação automática IMEDIATAMENTE (sem timeout)
      executeAutomaticValidation();
    }
  }, [
    form.watch("tractorUnitId"),
    form.watch("firstTrailerId"), 
    form.watch("secondTrailerId"),
    form.watch("dollyId"),
    vehicles,
    preventiveValidationRunning,
    lastValidatedCombination,
    executeAutomaticValidation
  ]);

  // ✅ LIMPEZA AUTOMÁTICA: Limpa validações quando combinação muda
  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (name && (
        name === 'tractorUnitId' ||
        name === 'firstTrailerId' ||
        name === 'secondTrailerId' ||
        name === 'dollyId'
      )) {
        console.log(`[CLEANUP] Campo ${name} alterado - limpando validações antigas`);
        setStateValidationStatus({});
        setBlockedStates({});
        // Resetar combinação validada para permitir nova validação
        setLastValidatedCombination("");
      }
    });
    
    return () => subscription.unsubscribe();
  }, [form]);

  // Função para verificar e confirmar seleção de veículo de terceiro
  const handleVehicleSelection = (vehicleId: number, fieldName: string) => {
    const vehicle = vehicles?.find(v => v.id === vehicleId);
    if (vehicle && vehicle.ownershipType === 'terceiro') {
      // Se é veículo de terceiro, mostrar modal de confirmação
      setPendingVehicleSelection({ vehicleId, fieldName });
      setShowThirdPartyConfirmation(true);
    } else {
      // Se é veículo próprio, aplicar diretamente
      form.setValue(fieldName as any, vehicleId);
    }
  };

  // Função para confirmar a seleção de veículo de terceiro
  const confirmThirdPartyVehicle = () => {
    if (pendingVehicleSelection) {
      form.setValue(pendingVehicleSelection.fieldName as any, pendingVehicleSelection.vehicleId);
      setShowThirdPartyConfirmation(false);
      setPendingVehicleSelection(null);
    }
  };

  // Função para cancelar a seleção de veículo de terceiro
  const cancelThirdPartyVehicle = () => {
    setShowThirdPartyConfirmation(false);
    setPendingVehicleSelection(null);
  };

  // Função para confirmar o envio com veículos de terceiros
  const confirmSubmitWithThirdParty = async () => {
    if (pendingSubmitData) {
      try {
        const url = draft ? `/api/licenses/drafts/${draft.id}/submit` : '/api/licenses';
        const method = "POST";
        const res = await apiRequest(method, url, pendingSubmitData);
        const result = await res.json();
        
        toast({
          title: "Solicitação enviada",
          description: "A solicitação de licença foi enviada com sucesso",
        });
        onComplete();
      } catch (error: any) {
        toast({
          title: "Erro",
          description: error.message || "Não foi possível enviar a solicitação",
          variant: "destructive",
        });
      } finally {
        setShowSubmitConfirmation(false);
        setPendingSubmitData(null);
        setThirdPartyVehiclesInSubmit([]);
      }
    }
  };

  // Função para cancelar o envio com veículos de terceiros
  const cancelSubmitWithThirdParty = () => {
    setShowSubmitConfirmation(false);
    setPendingSubmitData(null);
    setThirdPartyVehiclesInSubmit([]);
  };

  // Dynamic vehicle filters based on license type
  const semiTrailers = useMemo(() => {
    return allSemiTrailers.filter((v) => {
      // Rodotrem 9 eixos: pode selecionar semi-reboques de 2 eixos
      if (licenseType === "roadtrain_9_axles") {
        return v.axleCount === 2;
      }
      
      // Bitrem 9 eixos: só pode selecionar semi-reboques de 3 eixos
      if (licenseType === "bitrain_9_axles") {
        return v.axleCount === 3;
      }
      
      // Bitrem 7 eixos: pode selecionar semi-reboques de 2 eixos
      if (licenseType === "bitrain_7_axles") {
        return v.axleCount === 2;
      }
      
      // Bitrem 6 eixos: pode selecionar semi-reboques de 2 eixos
      if (licenseType === "bitrain_6_axles") {
        return v.axleCount === 2;
      }
      
      // Para outros tipos, permitir todos
      return true;
    });
  }, [allSemiTrailers, licenseType]);
  
  const dollys = useMemo(() => {
    return allDollys.filter((v) => {
      // Rodotrem 9 eixos: pode selecionar dollys de 2 eixos
      if (licenseType === "roadtrain_9_axles") {
        return v.axleCount === 2;
      }
      
      // Para outros tipos, permitir todos
      return true;
    });
  }, [allDollys, licenseType]);

  // Watch for type changes to conditionally render fields
  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (name === "type") {
        setLicenseType(value.type as string);

        // Reset cargo type when changing license type
        form.setValue("cargoType", undefined);
        setCargoType("");

        // Aplicar valores padrão apenas para tipos que não são prancha
        if (value.type === "flatbed") {
          // Para pranchas, manter campos vazios
          form.setValue("width", undefined);
          form.setValue("height", undefined);
        } else {
          // Para outros tipos, aplicar valores padrão
          form.setValue("width", 2.6);
          form.setValue("height", 4.4);
        }
      }

      if (name === "cargoType") {
        setCargoType(value.cargoType as string);
      }

      // Set main vehicle plate based on tractor unit selection
      if (name === "tractorUnitId" && value.tractorUnitId) {
        const selectedVehicle = vehicles?.find(
          (v) => v.id === value.tractorUnitId,
        );
        if (selectedVehicle) {
          form.setValue("mainVehiclePlate", selectedVehicle.plate);
        }
      }

      // Apply dynamic validation based on license type and cargo type
      const currentType = value.type as string;
      const currentCargoType = value.cargoType as string;

      // Ajustar validações de dimensões com base no tipo de conjunto e carga
      if (
        currentType &&
        (name === "type" ||
          name === "cargoType" ||
          name === "length" ||
          name === "width" ||
          name === "height")
      ) {
        let limits = DIMENSION_LIMITS.default;

        if (currentType === "flatbed") {
          limits =
            currentCargoType === "oversized"
              ? DIMENSION_LIMITS.oversized
              : DIMENSION_LIMITS.flatbed;
        } else if (
          currentCargoType === "agricultural_machinery" ||
          currentCargoType === "indivisible_cargo"
        ) {
          limits = DIMENSION_LIMITS.agricultural_machinery;
        }

        // Verificar e validar dimensões atuais
        const currentLength = form.getValues("length");
        const currentWidth = form.getValues("width");
        const currentHeight = form.getValues("height");

        if (currentType === "flatbed") {
          // Para pranchas: aplicar validações específicas para prancha

          // Validar comprimento para prancha
          if (currentLength !== undefined && currentLength !== null) {
            if (currentLength > limits.maxLength) {
              form.setError("length", {
                type: "manual",
                message: `O comprimento máximo para pranchas é ${limits.maxLength.toFixed(2).replace(".", ",")} metros`,
              });
            } else {
              form.clearErrors("length");
            }
          }

          // Validar largura para prancha
          if (currentWidth !== undefined && currentWidth !== null) {
            if (currentWidth > limits.maxWidth) {
              form.setError("width", {
                type: "manual",
                message: `A largura máxima para pranchas é ${limits.maxWidth.toFixed(2).replace(".", ",")} metros`,
              });
            } else {
              form.clearErrors("width");
            }
          }

          // Validar altura para prancha
          if (currentHeight !== undefined && currentHeight !== null) {
            if (currentHeight > limits.maxHeight) {
              form.setError("height", {
                type: "manual",
                message: `A altura máxima para pranchas é ${limits.maxHeight.toFixed(2).replace(".", ",")} metros`,
              });
            } else {
              form.clearErrors("height");
            }
          }
        } else {
          // Para outros tipos que NÃO são prancha: aplicar validações

          // Validar comprimento
          if (currentLength !== undefined && currentLength !== null) {
            if (currentLength < limits.minLength) {
              form.setError("length", {
                type: "manual",
                message: `O comprimento mínimo para este tipo de conjunto é ${limits.minLength.toFixed(2).replace(".", ",")} metros`,
              });
            } else if (currentLength > limits.maxLength) {
              form.setError("length", {
                type: "manual",
                message: `O comprimento máximo para este tipo de conjunto é ${limits.maxLength.toFixed(2).replace(".", ",")} metros`,
              });
            } else {
              form.clearErrors("length");
            }
          }

          // Validar largura
          if (currentWidth !== undefined && currentWidth !== null) {
            if (currentWidth > limits.maxWidth) {
              form.setError("width", {
                type: "manual",
                message: `A largura máxima para este tipo de conjunto é ${limits.maxWidth.toFixed(2).replace(".", ",")} metros`,
              });
            } else {
              form.clearErrors("width");
            }
          }

          // Validar altura
          if (currentHeight !== undefined && currentHeight !== null) {
            if (currentHeight > limits.maxHeight) {
              form.setError("height", {
                type: "manual",
                message: `A altura máxima para este tipo de conjunto é ${limits.maxHeight.toFixed(2).replace(".", ",")} metros`,
              });
            } else {
              form.clearErrors("height");
            }
          }
        }

        // Atualizar textos descritivos para as dimensões
        const lengthDesc =
          currentType === "flatbed" && currentCargoType === "oversized"
            ? "Digite o comprimento em metros (sem limite para carga superdimensionada)"
            : currentType === "flatbed"
              ? `Digite o comprimento em metros - Comprimento Máximo ${limits.maxLength.toFixed(2).replace(".", ",")} Metros`
              : currentCargoType === "agricultural_machinery" ||
                  currentCargoType === "indivisible"
                ? `Digite o comprimento em metros - Comprimento Máximo ${limits.maxLength.toFixed(2).replace(".", ",")} Metros`
                : `Digite o comprimento em metros (min: ${limits.minLength.toFixed(2).replace(".", ",")} - max: ${limits.maxLength.toFixed(2).replace(".", ",")})`;

        const widthDesc =
          currentType === "flatbed" && currentCargoType === "oversized"
            ? "Informe a largura total do conjunto em metros (sem limite para carga superdimensionada)"
            : currentType === "flatbed"
              ? `Informe a largura total do conjunto em metros - Largura Máxima ${limits.maxWidth.toFixed(2).replace(".", ",")} metros`
              : currentCargoType === "agricultural_machinery" ||
                  currentCargoType === "indivisible"
                ? `Informe a largura total do conjunto em metros - Largura Máxima ${limits.maxWidth.toFixed(2).replace(".", ",")} metros`
                : `Informe a largura total do conjunto em metros (max: ${limits.maxWidth.toFixed(2).replace(".", ",")})`;

        const heightDesc =
          currentType === "flatbed" && currentCargoType === "oversized"
            ? "Informe a altura total do conjunto em metros (sem limite para carga superdimensionada)"
            : currentType === "flatbed"
              ? `Informe a altura total do conjunto em metros - Altura Máxima ${limits.maxHeight.toFixed(2).replace(".", ",")} metros`
              : currentCargoType === "agricultural_machinery" ||
                  currentCargoType === "indivisible"
                ? `Informe a altura total do conjunto em metros - Altura Máxima ${limits.maxHeight.toFixed(2).replace(".", ",")} metros`
                : `Informe a altura total do conjunto em metros (max: ${limits.maxHeight.toFixed(2).replace(".", ",")})`;
      }
    });

    return () => subscription.unsubscribe();
  }, [form, vehicles]);

  // Handle form submissions
  const saveAsDraftMutation = useMutation({
    mutationFn: async (data: z.infer<typeof insertDraftLicenseSchema>) => {
      const url = draft
        ? `/api/licenses/drafts/${draft.id}`
        : "/api/licenses/drafts";
      const method = draft ? "PATCH" : "POST";
      const res = await apiRequest(method, url, data);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Rascunho salvo",
        description: "O rascunho da licença foi salvo com sucesso",
      });
      onComplete();
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message || "Não foi possível salvar o rascunho",
        variant: "destructive",
      });
    },
  });

  // Função para verificar se há veículos não cadastrados
  const checkForUnregisteredVehicles = (): string[] => {
    const additionalPlates = form.getValues('additionalPlates') || [];
    const unregisteredPlates: string[] = [];
    
    additionalPlates.forEach((plate: string) => {
      if (plate && !vehicles?.some(v => v.plate === plate)) {
        unregisteredPlates.push(plate);
      }
    });
    
    return unregisteredPlates;
  };

  // Função para verificar se há veículos de terceiros no pedido
  const checkForThirdPartyVehicles = (data: z.infer<typeof insertLicenseRequestSchema>): string[] => {
    const thirdPartyVehicles: string[] = [];
    
    // Verificar unidade tratora
    if (data.tractorUnitId) {
      const vehicle = vehicles?.find(v => v.id === data.tractorUnitId);
      if (vehicle && vehicle.ownershipType === 'terceiro') {
        thirdPartyVehicles.push(`${vehicle.plate} (Unidade Tratora)`);
      }
    }

    // Verificar primeiro semi-reboque
    if (data.firstTrailerId) {
      const vehicle = vehicles?.find(v => v.id === data.firstTrailerId);
      if (vehicle && vehicle.ownershipType === 'terceiro') {
        thirdPartyVehicles.push(`${vehicle.plate} (Primeiro Semi-reboque)`);
      }
    }

    // Verificar segundo semi-reboque
    if (data.secondTrailerId) {
      const vehicle = vehicles?.find(v => v.id === data.secondTrailerId);
      if (vehicle && vehicle.ownershipType === 'terceiro') {
        thirdPartyVehicles.push(`${vehicle.plate} (Segundo Semi-reboque)`);
      }
    }

    // Verificar dolly
    if (data.dollyId) {
      const vehicle = vehicles?.find(v => v.id === data.dollyId);
      if (vehicle && vehicle.ownershipType === 'terceiro') {
        thirdPartyVehicles.push(`${vehicle.plate} (Dolly)`);
      }
    }
    
    return thirdPartyVehicles;
  };

  const submitRequestMutation = useMutation({
    mutationFn: async (data: z.infer<typeof insertLicenseRequestSchema>) => {
      try {
        // Verificar se há veículos não cadastrados antes de enviar
        const unregisteredPlates = checkForUnregisteredVehicles();
        
        if (unregisteredPlates.length > 0) {
          throw new Error(`Há veículos não cadastrados no pedido: ${unregisteredPlates.join(', ')}. Cadastre todos os veículos antes de finalizar o pedido.`);
        }

        // Verificar se há veículos de terceiros e mostrar aviso
        const thirdPartyVehicles = checkForThirdPartyVehicles(data);
        
        if (thirdPartyVehicles.length > 0) {
          // Preparar dados para confirmação no modal
          setPendingSubmitData(data);
          setThirdPartyVehiclesInSubmit(thirdPartyVehicles);
          setShowSubmitConfirmation(true);
          throw new Error('Aguardando confirmação do usuário para veículos de terceiros.');
        }

        // Adicionar log detalhado para debug
        console.log("Enviando licença:", JSON.stringify(data, null, 2));

        // Se for tipo prancha, exibir informações completas
        if (data.type === "flatbed") {
          console.log("Detalhes da prancha:", {
            tipo: data.type,
            carga: data.cargoType,
            dimensoes: {
              comprimento: data.length,
              largura: data.width,
              altura: data.height,
            },
            estados: data.states,
            placaPrincipal: data.mainVehiclePlate,
          });
        }

        // Usar o endpoint correto de submissão
        const url = draft
          ? `/api/licenses/drafts/${draft.id}/submit`
          : "/api/licenses/submit";
        const method = "POST";
        console.log(`Enviando para endpoint: ${url}`);
        console.log("Estados no payload final:", data.states);
        console.log("Payload completo:", JSON.stringify(data, null, 2));
        
        const res = await apiRequest(method, url, data);
        
        // Verificar se a resposta foi bem-sucedida
        if (!res.ok) {
          const errorText = await res.text();
          console.error("Erro da resposta do servidor:", errorText);
          throw new Error(`Erro ${res.status}: ${errorText || 'Erro desconhecido no servidor'}`);
        }
        
        const result = await res.json();
        console.log("Resposta do servidor:", result);
        return result;
      } catch (error) {
        console.error("Erro ao enviar pedido:", error);
        console.error("Tipo do erro:", typeof error);
        console.error("Stack trace:", error instanceof Error ? error.stack : 'Não disponível');
        throw error;
      }
    },
    onSuccess: (data) => {
      toast({
        title: "Solicitação enviada com sucesso!",
        description:
          "Sua solicitação de licença foi processada e enviada corretamente.",
        variant: "default",
        duration: 5000,
      });

      // Mostrar toast específico para pranchas
      if (licenseType === "flatbed") {
        toast({
          title: "Pedido de Prancha enviado",
          description:
            "Seu pedido para veículo tipo Prancha foi enviado com sucesso.",
          variant: "default",
        });
      }

      onComplete();
    },
    onError: (error: Error) => {
      console.error("Erro completo:", error);

      // Criar elemento de erro detalhado
      const ErrorMessage = () => (
        <div className="space-y-2">
          <div className="bg-red-950 text-red-100 p-2 rounded text-xs overflow-auto max-h-32">
            {error.message || "Erro desconhecido ao processar o pedido"}
          </div>
          <p className="text-sm mt-2">
            Tente selecionar um veículo diferente ou verificar os campos
            obrigatórios.
          </p>
        </div>
      );

      toast({
        title: "Erro no envio do pedido",
        description: <ErrorMessage />,
        variant: "destructive",
        duration: 8000,
      });
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    // Adjust dimensions from meters to centimeters for storage
    const dataToSubmit = {
      ...values,
      length: Math.round((values.length || 0) * 100), // Convert to centimeters
      width: values.width ? Math.round(values.width * 100) : undefined, // Convert to centimeters if exists
      height: values.height ? Math.round(values.height * 100) : undefined, // Convert to centimeters if exists
    };

    if (values.isDraft) {
      // Cast to appropriate types to satisfy TypeScript
      saveAsDraftMutation.mutate(dataToSubmit as any);
    } else {
      // Remove isDraft from payload when submitting a license request
      const { isDraft, ...requestData } = dataToSubmit;
      submitRequestMutation.mutate(requestData as any);
    }
  };

  // Função para verificar se os campos obrigatórios estão preenchidos
  const checkRequiredFields = () => {
    const values = form.getValues();
    const isWidthEmpty = values.width === undefined || values.width === null;
    const isHeightEmpty = values.height === undefined || values.height === null;
    const isCargoTypeEmpty = !values.cargoType;

    // Adicionar log detalhado para debug
    console.log("Valores do formulário:", {
      licenseType: values.type,
      cargoType: values.cargoType,
      width: values.width,
      height: values.height,
      length: values.length,
    });

    return isWidthEmpty || isHeightEmpty || isCargoTypeEmpty;
  };

  const handleSaveDraft = () => {
    form.setValue("isDraft", true);
    form.handleSubmit(onSubmit)();
  };

  const handleSubmitRequest = () => {
    // Acessar todos os valores do formulário
    const values = form.getValues();

    // Tratamento especial para veículos tipo Prancha
    if (values.type === "flatbed") {
      // Garantir que o formulário será enviado para tipo prancha, preenchendo valores padrão se necessário
      if (!values.width)
        form.setValue("width", values.cargoType === "oversized" ? 4 : 3.2);
      if (!values.height)
        form.setValue("height", values.cargoType === "oversized" ? 5 : 4.95);
      if (!values.length)
        form.setValue("length", values.cargoType === "oversized" ? 30 : 25);
      if (!values.cargoType) form.setValue("cargoType", "indivisible_cargo");
      if (!values.states || values.states.length === 0)
        form.setValue("states", ["SP"]);

      // Garantir que há um veículo principal selecionado
      if (!values.mainVehiclePlate && flatbeds.length > 0) {
        const firstVehicle = flatbeds[0];
        form.setValue("flatbedId", firstVehicle.id);
        form.setValue("mainVehiclePlate", firstVehicle.plate);
      }

      // Mostrar toast informativo
      toast({
        title: "Preparando envio",
        description: "Processando pedido para veículo tipo Prancha...",
      });

      // Agora que garantimos que tem os valores necessários, podemos continuar
      setShowRequiredFieldsWarning(false);
      form.setValue("isDraft", false);

      // Contornar qualquer validação e enviar de forma direta
      setTimeout(() => {
        // Debug: verificar estados antes da conversão (prancha)
        const currentFormValues = form.getValues();
        console.log("Estados no form.getValues() (prancha):", currentFormValues.states);
        
        // Obter valores atualizados após as modificações
        const updatedData = {
          ...currentFormValues,
          // Garantir que os estados selecionados são preservados
          states: currentFormValues.states,
          // Converter comprimento, largura e altura de metros para centímetros
          length: Math.round((currentFormValues.length || 0) * 100),
          width: Math.round((currentFormValues.width || 0) * 100),
          height: Math.round((currentFormValues.height || 0) * 100),
          isDraft: false,
        };

        // Remover isDraft do payload
        const { isDraft, ...requestData } = updatedData;

        // Debug final (prancha)
        console.log("Estados no requestData final (prancha):", requestData.states);
        console.log("Enviando dados prancha:", requestData);
        console.log("Campo states especificamente (prancha):", requestData.states, typeof requestData.states);
        submitRequestMutation.mutate(requestData as any);
      }, 500);
    } else {
      // Para outros tipos de veículos, manter a verificação normal
      if (checkRequiredFields()) {
        // Mostrar aviso e não prosseguir com a submissão
        setShowRequiredFieldsWarning(true);

        // Rolar para o topo para garantir que o usuário veja o aviso
        window.scrollTo({ top: 0, behavior: "smooth" });

        // Notificar o usuário através de toast
        toast({
          title: "Campos obrigatórios",
          description:
            "Preencha todos os campos obrigatórios para enviar sua solicitação",
          variant: "destructive",
        });

        return;
      }

      // Se tudo estiver preenchido, continuar com a submissão
      setShowRequiredFieldsWarning(false);
      form.setValue("isDraft", false);

      // Enviar diretamente para evitar problemas de validação no modal
      setTimeout(() => {
        // Debug: verificar estados antes da conversão
        const currentFormValues = form.getValues();
        console.log("Estados no form.getValues():", currentFormValues.states);
        
        const updatedData = {
          ...currentFormValues,
          // Garantir que os estados selecionados são preservados
          states: currentFormValues.states,
          // Converter comprimento, largura e altura de metros para centímetros
          length: Math.round((currentFormValues.length || 0) * 100),
          width: Math.round((currentFormValues.width || 0) * 100),
          height: Math.round((currentFormValues.height || 0) * 100),
          isDraft: false,
        };

        // Remover isDraft do payload
        const { isDraft, ...requestData } = updatedData;

        // Debug final  
        console.log("Estados no requestData final:", requestData.states);
        console.log("Enviando dados:", requestData);
        console.log("Campo states especificamente:", requestData.states, typeof requestData.states);
        submitRequestMutation.mutate(requestData as any);
      }, 300);
    }
  };

  const isProcessing =
    saveAsDraftMutation.isPending || submitRequestMutation.isPending;

  // Mutation para criar um novo veículo
  const createVehicleMutation = useMutation({
    mutationFn: async (data: z.infer<typeof insertVehicleSchema>) => {
      const res = await apiRequest("POST", "/api/vehicles", data);
      return await res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Veículo cadastrado",
        description: "O veículo foi cadastrado com sucesso",
      });

      // Atualizar a lista de veículos
      queryClient.invalidateQueries({
        queryKey: ["/api/vehicles"],
      });

      setShowVehicleDialog(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message || "Não foi possível cadastrar o veículo",
        variant: "destructive",
      });
    },
  });

  // Formulário para cadastro de veículo
  const vehicleForm = useForm<z.infer<typeof insertVehicleSchema>>({
    resolver: zodResolver(insertVehicleSchema),
    defaultValues: {
      plate: "",
      type: "",
      brand: "",
      model: "",
      year: undefined,
      axleCount: undefined,
      renavam: "",
      remarks: "",
    },
  });

  const handleCreateVehicle = (data: z.infer<typeof insertVehicleSchema>) => {
    createVehicleMutation.mutate(data);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Aviso de campos obrigatórios não preenchidos */}
        {showRequiredFieldsWarning && (
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4 rounded-md">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg
                  className="h-5 w-5 text-yellow-400"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800">
                  Atenção! Campos obrigatórios não preenchidos
                </h3>
                <div className="mt-2 text-sm text-yellow-700">
                  <p>
                    Os seguintes campos são obrigatórios para enviar a
                    solicitação:
                  </p>
                  <ul className="list-disc pl-5 mt-1 space-y-1">
                    {form.getValues("width") === undefined && (
                      <li>Largura do conjunto</li>
                    )}
                    {form.getValues("height") === undefined && (
                      <li>Altura do conjunto</li>
                    )}
                    {!form.getValues("cargoType") && <li>Tipo de carga</li>}
                  </ul>
                  <p className="mt-2">
                    Por favor, preencha todos os campos marcados como{" "}
                    <span className="text-yellow-600 font-medium">
                      Obrigatório
                    </span>{" "}
                    antes de enviar.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        <Dialog open={showVehicleDialog} onOpenChange={setShowVehicleDialog}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Cadastrar Novo Veículo</DialogTitle>
              <DialogDescription>
                Preencha as informações do veículo para adicioná-lo ao sistema
              </DialogDescription>
            </DialogHeader>

            <Form {...vehicleForm}>
              <form
                onSubmit={vehicleForm.handleSubmit(handleCreateVehicle)}
                className="space-y-4"
              >
                <FormField
                  control={vehicleForm.control}
                  name="plate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Placa</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="ABC-1234"
                          {...field}
                          className="uppercase"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={vehicleForm.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo de Veículo</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o tipo" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="tractor_unit">
                            Unidade Tratora (Cavalo)
                          </SelectItem>
                          <SelectItem value="truck">Caminhão</SelectItem>
                          <SelectItem value="semi_trailer">
                            Semirreboque
                          </SelectItem>
                          <SelectItem value="trailer">Reboque</SelectItem>
                          <SelectItem value="dolly">Dolly</SelectItem>
                          <SelectItem value="flatbed">Prancha</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={vehicleForm.control}
                    name="brand"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Marca</FormLabel>
                        <FormControl>
                          <Input placeholder="Marca" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={vehicleForm.control}
                    name="model"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Modelo</FormLabel>
                        <FormControl>
                          <Input placeholder="Modelo" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={vehicleForm.control}
                    name="year"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Ano</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="2023"
                            {...field}
                            value={field.value || ""}
                            onChange={(e) =>
                              field.onChange(e.target.valueAsNumber)
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={vehicleForm.control}
                    name="axleCount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Quantidade de Eixos</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="2"
                            {...field}
                            value={field.value || ""}
                            onChange={(e) =>
                              field.onChange(e.target.valueAsNumber)
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={vehicleForm.control}
                  name="renavam"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Renavam</FormLabel>
                      <FormControl>
                        <Input placeholder="Renavam" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={vehicleForm.control}
                  name="remarks"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Observações</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Observações sobre o veículo..."
                          className="resize-none"
                          {...field}
                          value={field.value || ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowVehicleDialog(false)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={createVehicleMutation.isPending}
                  >
                    {createVehicleMutation.isPending && (
                      <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Cadastrar Veículo
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
        <div className="border border-gray-200 rounded-lg p-5 shadow-sm">
          <h3 className="font-semibold text-gray-800 text-lg mb-4 flex items-center">
            <Building2 className="mr-2 h-5 w-5" />
            Dados do Transportador
          </h3>

          <div className="grid grid-cols-1 gap-4">
            <FormField
              control={form.control}
              name="transporterId"
              render={({ field }) => (
                <OptimizedTransporterSelector
                  value={field.value}
                  onValueChange={field.onChange}
                  placeholder="Digite o nome ou CNPJ do transportador..."
                  label="Transportador"
                  required
                />
              )}
            />
          </div>
        </div>

        <div className="border border-gray-200 rounded-lg p-5 shadow-sm">
          <h3 className="font-semibold text-gray-800 text-lg mb-4 flex items-center">
            <Truck className="mr-2 h-5 w-5" />
            Tipo de Conjunto
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-base font-medium">
                    Tipo de Conjunto
                  </FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder="Selecione um tipo" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="roadtrain_9_axles">
                        <div className="flex items-center">
                          <VehicleTypeImage
                            type="roadtrain_9_axles"
                            className="mr-2"
                            iconSize={24}
                          />
                          <span>Rodotrem 9 eixos</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="bitrain_9_axles">
                        <div className="flex items-center">
                          <VehicleTypeImage
                            type="bitrain_9_axles"
                            className="mr-2"
                            iconSize={24}
                          />
                          <span>Bitrem 9 eixos</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="bitrain_7_axles">
                        <div className="flex items-center">
                          <VehicleTypeImage
                            type="bitrain_7_axles"
                            className="mr-2"
                            iconSize={24}
                          />
                          <span>Bitrem 7 eixos</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="bitrain_6_axles">
                        <div className="flex items-center">
                          <VehicleTypeImage
                            type="bitrain_6_axles"
                            className="mr-2"
                            iconSize={24}
                          />
                          <span>Bitrem 6 eixos</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="flatbed">
                        <div className="flex items-center">
                          <VehicleTypeImage
                            type="flatbed"
                            className="mr-2"
                            iconSize={24}
                          />
                          <span>Prancha</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="romeo_and_juliet">
                        <div className="flex items-center">
                          <VehicleTypeImage
                            type="romeo_and_juliet"
                            className="mr-2"
                            iconSize={24}
                          />
                          <span>Romeu e Julieta</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Campo de Tipo de Carga - varia conforme tipo de conjunto */}
            {licenseType && (
              <FormField
                control={form.control}
                name="cargoType"
                render={({ field }) => {
                  // Verificar se o campo está vazio
                  const isEmpty = !field.value;

                  return (
                    <FormItem>
                      <FormLabel className="text-base font-medium flex items-center">
                        Tipo de Carga
                        {isEmpty && (
                          <span className="ml-2 text-xs font-normal px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                            Obrigatório
                          </span>
                        )}
                      </FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger
                            className={`h-10 ${isEmpty ? "border-amber-500 ring-1 ring-amber-500" : ""}`}
                          >
                            <SelectValue placeholder="Selecione o tipo de carga" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {licenseType === "flatbed"
                            ? FLATBED_CARGO_TYPES.map((option) => (
                                <SelectItem
                                  key={option.value}
                                  value={option.value}
                                >
                                  {option.label}
                                </SelectItem>
                              ))
                            : NON_FLATBED_CARGO_TYPES.map((option) => (
                                <SelectItem
                                  key={option.value}
                                  value={option.value}
                                >
                                  {option.label}
                                </SelectItem>
                              ))}
                        </SelectContent>
                      </Select>

                      {isEmpty && (
                        <div className="mt-1 text-sm text-amber-600 font-medium">
                          Este campo é obrigatório. Por favor, selecione um tipo
                          de carga.
                        </div>
                      )}

                      <FormDescription className="text-xs text-muted-foreground mt-1">
                        {licenseType === "flatbed"
                          ? "Selecione o tipo de carga para este conjunto de prancha"
                          : "Selecione o tipo de carga para este conjunto"}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />
            )}

            <FormField
              control={form.control}
              name="length"
              render={({ field }) => (
                <DimensionField
                  field={field}
                  fieldType="comprimento"
                  label="Comprimento (metros)"
                  placeholder="Ex.: 19,80"
                  licenseType={licenseType}
                  cargoType={form.watch("cargoType")}
                  description={
                    licenseType === "flatbed"
                      ? "Digite o comprimento em metros"
                      : form.watch("cargoType") === "agricultural_machinery" ||
                          form.watch("cargoType") === "indivisible_cargo"
                        ? "Digite o comprimento em metros - Comprimento Máximo 25,00 Metros"
                        : "Digite o comprimento em metros (min: 19,80 - max: 30,00)"
                  }
                />
              )}
            />

            <FormField
              control={form.control}
              name="width"
              render={({ field }) => (
                <DimensionField
                  field={field}
                  fieldType="largura"
                  label="Largura do Conjunto (metros)"
                  placeholder={
                    licenseType === "flatbed" ? "Ex.: 3,20" : "Ex.: 2,60"
                  }
                  licenseType={licenseType}
                  cargoType={form.watch("cargoType")}
                  description={
                    licenseType === "flatbed"
                      ? "Informe a largura total do conjunto em metros"
                      : form.watch("cargoType") === "agricultural_machinery" ||
                          form.watch("cargoType") === "indivisible_cargo"
                        ? "Informe a largura total do conjunto em metros - Largura Máxima 3,20 metros"
                        : "Informe a largura total do conjunto em metros (max: 2,60)"
                  }
                />
              )}
            />

            <FormField
              control={form.control}
              name="height"
              render={({ field }) => (
                <DimensionField
                  field={field}
                  fieldType="altura"
                  label="Altura do Conjunto (metros)"
                  placeholder={
                    licenseType === "flatbed" ? "Ex.: 4,95" : "Ex.: 4,40"
                  }
                  licenseType={licenseType}
                  cargoType={form.watch("cargoType")}
                  description={
                    licenseType === "flatbed"
                      ? "Informe a altura total do conjunto em metros"
                      : form.watch("cargoType") === "agricultural_machinery" ||
                          form.watch("cargoType") === "indivisible_cargo"
                        ? "Informe a altura total do conjunto em metros - Altura Máxima 4,95 metros"
                        : "Informe a altura total do conjunto em metros (max: 4,40)"
                  }
                />
              )}
            />
          </div>
        </div>

        {/* Dynamic fields for Rodotrem 9 eixos */}
        {licenseType === "roadtrain_9_axles" && (
          <div className="border border-gray-200 rounded-lg p-5 shadow-sm">
            <h3 className="font-semibold text-gray-800 text-lg mb-4 flex items-center">
              <VehicleTypeImage
                type="roadtrain_9_axles"
                className="mr-2"
                iconSize={32}
              />
              Composição Principal do Rodotrem
            </h3>

            {/* Unidade Tratora - Esta é a unidade principal que desbloqueia a linha de frente */}
            <div className="mb-6">
              <FormField
                control={form.control}
                name="tractorUnitId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-medium">
                      Unidade Tratora (Cavalo Mecânico)
                    </FormLabel>
                    <FormControl>
                      <VehicleAutocomplete
                        vehicles={tractorUnits}
                        value={field.value}
                        onSelect={(vehicleId) => {
                          field.onChange(vehicleId);
                          if (vehicleId) {
                            handleVehicleSelection(vehicleId, 'tractorUnitId');
                          }
                        }}
                        placeholder="Digite a placa ou selecione a unidade tratora"
                        disabled={isLoadingVehicles}
                        className="h-10 bg-blue-50 border-blue-200"
                      />
                    </FormControl>
                    <FormDescription className="text-xs text-muted-foreground mt-1">
                      Esta é a unidade principal que irá puxar o conjunto
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Linha de Frente - Com destaque visual como componente principal */}
            <div className="border border-red-300 rounded-md p-4 bg-red-50 mb-6">
              <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4 mr-1 text-red-600"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                Linha de Frente (Componentes Principais)
              </h4>

              {/* Sequência lógica de componentes do Rodotrem - Usando listas suspensas */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="firstTrailerId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-medium">1ª Carreta</FormLabel>
                      <FormControl>
                        <VehicleAutocomplete
                          vehicles={semiTrailers}
                          value={field.value}
                          onSelect={(vehicleId) => {
                            field.onChange(vehicleId);
                          }}
                          placeholder="Digite a placa ou selecione a 1ª carreta"
                          disabled={isLoadingVehicles}
                          className="h-10 bg-green-50 border-green-200"
                        />
                      </FormControl>
                      <FormDescription className="text-xs text-muted-foreground mt-1">
                        Primeiro semirreboque da composição
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="dollyId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-medium">Dolly</FormLabel>
                      <FormControl>
                        <VehicleAutocomplete
                          vehicles={dollys}
                          value={field.value}
                          onSelect={(vehicleId) => {
                            field.onChange(vehicleId);
                          }}
                          placeholder="Digite a placa ou selecione o dolly"
                          disabled={isLoadingVehicles}
                          className="h-10 bg-amber-50 border-amber-200"
                        />
                      </FormControl>
                      <FormDescription className="text-xs text-muted-foreground mt-1">
                        Dispositivo de acoplamento
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="secondTrailerId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-medium">2ª Carreta</FormLabel>
                      <FormControl>
                        <VehicleAutocomplete
                          vehicles={semiTrailers}
                          value={field.value}
                          onSelect={(vehicleId) => {
                            field.onChange(vehicleId);
                          }}
                          placeholder="Digite a placa ou selecione a 2ª carreta"
                          disabled={isLoadingVehicles}
                          className="h-10 bg-purple-50 border-purple-200"
                        />
                      </FormControl>
                      <FormDescription className="text-xs text-muted-foreground mt-1">
                        Segundo semirreboque da composição
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Resumo da composição */}
            <div className="bg-gray-50 p-3 rounded-md border border-gray-200">
              <h4 className="text-sm font-medium text-gray-700 mb-2">
                Composição selecionada:
              </h4>
              <div className="flex flex-col gap-3">
                {/* Veículos principais */}
                <div className="flex flex-wrap gap-2">
                  <div className="text-xs font-medium text-gray-600 mr-1">
                    Veículos principais:
                  </div>
                  {form.watch("tractorUnitId") && (
                    <div className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-md flex items-center">
                      <Truck className="h-3 w-3 mr-1" />
                      <span className="font-medium">
                        Unidade Principal:
                      </span>{" "}
                      {tractorUnits.find(
                        (v) => v.id === form.watch("tractorUnitId"),
                      )?.plate || "Selecionado"}
                    </div>
                  )}
                  {form.watch("firstTrailerId") && (
                    <div className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-md flex items-center">
                      <Truck className="h-3 w-3 mr-1" />
                      <span className="font-medium">1ª Carreta:</span>{" "}
                      {semiTrailers.find(
                        (v) => v.id === form.watch("firstTrailerId"),
                      )?.plate || "Selecionado"}
                    </div>
                  )}
                  {form.watch("dollyId") && (
                    <div className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded-md flex items-center">
                      <Truck className="h-3 w-3 mr-1" />
                      <span className="font-medium">Dolly:</span>{" "}
                      {dollys.find((v) => v.id === form.watch("dollyId"))
                        ?.plate || "Selecionado"}
                    </div>
                  )}
                  {form.watch("secondTrailerId") && (
                    <div className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded-md flex items-center">
                      <Truck className="h-3 w-3 mr-1" />
                      <span className="font-medium">2ª Carreta:</span>{" "}
                      {semiTrailers.find(
                        (v) => v.id === form.watch("secondTrailerId"),
                      )?.plate || "Selecionado"}
                    </div>
                  )}
                </div>

                {/* Placas adicionais */}
                {form.watch("additionalPlates") &&
                  form.watch("additionalPlates").length > 0 && (
                    <div className="flex flex-col">
                      <div className="text-xs font-medium text-gray-600 mb-1">
                        Placas adicionais:
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {form.watch("additionalPlates").map(
                          (plate, index) =>
                            plate && (
                              <div
                                key={index}
                                className="text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded-md flex items-center"
                              >
                                <span className="font-medium mr-1">
                                  {index + 1}:
                                </span>{" "}
                                {plate}
                              </div>
                            ),
                        )}
                      </div>
                    </div>
                  )}

                {/* Total de veículos */}
                <div className="text-xs text-gray-500 mt-1">
                  Total:{" "}
                  {[
                    form.watch("tractorUnitId") ? 1 : 0,
                    form.watch("firstTrailerId") ? 1 : 0,
                    form.watch("dollyId") ? 1 : 0,
                    form.watch("secondTrailerId") ? 1 : 0,
                    form.watch("additionalPlates")
                      ? form.watch("additionalPlates").filter((p) => p).length
                      : 0,
                  ].reduce((a, b) => a + b, 0)}{" "}
                  veículos
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Dynamic fields for Bitrem */}
        {(licenseType === "bitrain_9_axles" ||
          licenseType === "bitrain_7_axles" ||
          licenseType === "bitrain_6_axles") && (
          <div className="border border-gray-200 rounded-lg p-5 shadow-sm">
            <h3 className="font-semibold text-gray-800 text-lg mb-4 flex items-center">
              {licenseType === "bitrain_6_axles" ? (
                <VehicleTypeImage
                  type="bitrain_6_axles"
                  className="mr-2"
                  iconSize={32}
                />
              ) : licenseType === "bitrain_9_axles" ? (
                <VehicleTypeImage
                  type="bitrain_9_axles"
                  className="mr-2"
                  iconSize={32}
                />
              ) : licenseType === "bitrain_7_axles" ? (
                <VehicleTypeImage
                  type="bitrain_7_axles"
                  className="mr-2"
                  iconSize={32}
                />
              ) : (
                <Truck className="mr-2 h-8 w-8" />
              )}
              Composição Principal do Bitrem
            </h3>

            {/* Unidade Tratora - Esta é a unidade principal que desbloqueia a linha de frente */}
            <div className="mb-6">
              <FormField
                control={form.control}
                name="tractorUnitId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-medium">
                      Unidade Tratora (Cavalo Mecânico)
                    </FormLabel>
                    <FormControl>
                      <VehicleAutocomplete
                        vehicles={tractorUnits}
                        value={field.value}
                        onSelect={(vehicleId) => {
                          field.onChange(vehicleId);
                          if (vehicleId) {
                            handleVehicleSelection(vehicleId, 'tractorUnitId');
                          }
                        }}
                        placeholder="Digite a placa ou selecione a unidade tratora"
                        disabled={isLoadingVehicles}
                        className="h-10 bg-blue-50 border-blue-200"
                      />
                    </FormControl>
                    <FormDescription className="text-xs text-muted-foreground mt-1">
                      Esta é a unidade principal que irá puxar o conjunto
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Linha de Frente - Com destaque visual como componente principal */}
            <div className="border border-red-300 rounded-md p-4 bg-red-50 mb-6">
              <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4 mr-1 text-red-600"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                Linha de Frente (Componentes Principais)
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="firstTrailerId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-medium">1ª Carreta</FormLabel>
                      <FormControl>
                        <VehicleAutocomplete
                          vehicles={semiTrailers}
                          value={field.value}
                          onSelect={(vehicleId) => {
                            field.onChange(vehicleId);
                          }}
                          placeholder="Digite a placa ou selecione a 1ª carreta"
                          disabled={isLoadingVehicles}
                          className="h-10 bg-green-50 border-green-200"
                        />
                      </FormControl>
                      <FormDescription className="text-xs text-muted-foreground mt-1">
                        Selecione o primeiro semirreboque da composição
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="secondTrailerId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-medium">2ª Carreta</FormLabel>
                      <FormControl>
                        <VehicleAutocomplete
                          vehicles={semiTrailers}
                          value={field.value}
                          onSelect={(vehicleId) => {
                            field.onChange(vehicleId);
                          }}
                          placeholder="Digite a placa ou selecione a 2ª carreta"
                          disabled={isLoadingVehicles}
                          className="h-10 bg-purple-50 border-purple-200"
                        />
                      </FormControl>
                      <FormDescription className="text-xs text-muted-foreground mt-1">
                        Segundo semirreboque da composição
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Resumo da composição */}
            <div className="bg-gray-50 p-3 rounded-md border border-gray-200">
              <h4 className="text-sm font-medium text-gray-700 mb-2">
                Composição selecionada:
              </h4>
              <div className="flex flex-col gap-3">
                {/* Veículos principais */}
                <div className="flex flex-wrap gap-2">
                  <div className="text-xs font-medium text-gray-600 mr-1">
                    Veículos principais:
                  </div>
                  {form.watch("tractorUnitId") && (
                    <div className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-md flex items-center">
                      <Truck className="h-3 w-3 mr-1" />
                      <span className="font-medium">
                        Unidade Principal:
                      </span>{" "}
                      {tractorUnits.find(
                        (v) => v.id === form.watch("tractorUnitId"),
                      )?.plate || "Selecionado"}
                    </div>
                  )}
                  {form.watch("firstTrailerId") && (
                    <div className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-md flex items-center">
                      <Truck className="h-3 w-3 mr-1" />
                      <span className="font-medium">1ª Carreta:</span>{" "}
                      {semiTrailers.find(
                        (v) => v.id === form.watch("firstTrailerId"),
                      )?.plate || "Selecionado"}
                    </div>
                  )}
                  {form.watch("dollyId") && (
                    <div className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded-md flex items-center">
                      <Truck className="h-3 w-3 mr-1" />
                      <span className="font-medium">Dolly:</span>{" "}
                      {dollys.find((v) => v.id === form.watch("dollyId"))
                        ?.plate || "Selecionado"}
                    </div>
                  )}
                  {form.watch("secondTrailerId") && (
                    <div className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded-md flex items-center">
                      <Truck className="h-3 w-3 mr-1" />
                      <span className="font-medium">2ª Carreta:</span>{" "}
                      {semiTrailers.find(
                        (v) => v.id === form.watch("secondTrailerId"),
                      )?.plate || "Selecionado"}
                    </div>
                  )}
                  {form.watch("flatbedId") && (
                    <div className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded-md flex items-center">
                      <Truck className="h-3 w-3 mr-1" />
                      <span className="font-medium">Prancha:</span>{" "}
                      {flatbeds.find((v) => v.id === form.watch("flatbedId"))
                        ?.plate || "Selecionado"}
                    </div>
                  )}
                </div>

                {/* Placas adicionais */}
                {form.watch("additionalPlates") &&
                  form.watch("additionalPlates").length > 0 && (
                    <div className="flex flex-col">
                      <div className="text-xs font-medium text-gray-600 mb-1">
                        Placas adicionais:
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {form.watch("additionalPlates").map(
                          (plate, index) =>
                            plate && (
                              <div
                                key={index}
                                className="text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded-md flex items-center"
                              >
                                <span className="font-medium mr-1">
                                  {index + 1}:
                                </span>{" "}
                                {plate}
                              </div>
                            ),
                        )}
                      </div>
                    </div>
                  )}

                {/* Total de veículos */}
                <div className="text-xs text-gray-500 mt-1">
                  Total:{" "}
                  {[
                    form.watch("tractorUnitId") ? 1 : 0,
                    form.watch("firstTrailerId") ? 1 : 0,
                    form.watch("dollyId") ? 1 : 0,
                    form.watch("secondTrailerId") ? 1 : 0,
                    form.watch("flatbedId") ? 1 : 0,
                    form.watch("additionalPlates")
                      ? form.watch("additionalPlates").filter((p) => p).length
                      : 0,
                  ].reduce((a, b) => a + b, 0)}{" "}
                  veículos
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Dynamic fields for Prancha */}
        {licenseType === "flatbed" && (
          <div className="border border-gray-200 rounded-lg p-5 shadow-sm">
            <h3 className="font-semibold text-gray-800 text-lg mb-4 flex items-center">
              <VehicleTypeImage type="flatbed" className="mr-2" iconSize={32} />
              Composição Principal da Prancha
            </h3>

            {/* Unidade Tratora - Esta é a unidade principal que desbloqueia a linha de frente */}
            <div className="mb-6">
              <FormField
                control={form.control}
                name="tractorUnitId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-medium">
                      Unidade Tratora (Cavalo Mecânico)
                    </FormLabel>
                    <FormControl>
                      <VehicleAutocomplete
                        vehicles={tractorUnits}
                        value={field.value}
                        onSelect={(vehicleId) => {
                          field.onChange(vehicleId);
                          if (vehicleId) {
                            handleVehicleSelection(vehicleId, 'tractorUnitId');
                          }
                        }}
                        placeholder="Digite a placa ou selecione a unidade tratora"
                        disabled={isLoadingVehicles}
                        className="h-10 bg-blue-50 border-blue-200"
                      />
                    </FormControl>
                    <FormDescription className="text-xs text-muted-foreground mt-1">
                      Esta é a unidade principal que irá puxar o conjunto
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Linha de Frente - Com destaque visual como componente principal */}
            <div className="border border-red-300 rounded-md p-4 bg-red-50 mb-6">
              <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4 mr-1 text-red-600"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                Linha de Frente (Componente Principal)
              </h4>

              <FormField
                control={form.control}
                name="flatbedId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-medium">Prancha</FormLabel>
                    <FormControl>
                      <VehicleAutocomplete
                        vehicles={flatbeds}
                        value={field.value}
                        onSelect={(vehicleId) => {
                          field.onChange(vehicleId);
                        }}
                        placeholder="Digite a placa ou selecione a prancha"
                        disabled={isLoadingVehicles}
                        className="h-10 bg-red-50 border-red-200"
                      />
                    </FormControl>
                    <FormDescription className="text-xs text-muted-foreground mt-1">
                      Veículo para transporte de cargas excepcionais
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Resumo da composição */}
            <div className="bg-gray-50 p-3 rounded-md border border-gray-200">
              <h4 className="text-sm font-medium text-gray-700 mb-2">
                Composição selecionada:
              </h4>
              <div className="flex flex-col gap-3">
                {/* Veículos principais */}
                <div className="flex flex-wrap gap-2">
                  <div className="text-xs font-medium text-gray-600 mr-1">
                    Veículos principais:
                  </div>
                  {form.watch("tractorUnitId") && (
                    <div className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-md flex items-center">
                      <Truck className="h-3 w-3 mr-1" />
                      <span className="font-medium">
                        Unidade Principal:
                      </span>{" "}
                      {tractorUnits.find(
                        (v) => v.id === form.watch("tractorUnitId"),
                      )?.plate || "Selecionado"}
                    </div>
                  )}
                  {form.watch("flatbedId") && (
                    <div className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded-md flex items-center">
                      <Truck className="h-3 w-3 mr-1" />
                      <span className="font-medium">Prancha:</span>{" "}
                      {flatbeds.find((v) => v.id === form.watch("flatbedId"))
                        ?.plate || "Selecionado"}
                    </div>
                  )}
                </div>

                {/* Placas adicionais */}
                {form.watch("additionalPlates") &&
                  form.watch("additionalPlates").length > 0 && (
                    <div className="flex flex-col">
                      <div className="text-xs font-medium text-gray-600 mb-1">
                        Placas adicionais:
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {form.watch("additionalPlates").map(
                          (plate, index) =>
                            plate && (
                              <div
                                key={index}
                                className="text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded-md flex items-center"
                              >
                                <span className="font-medium mr-1">
                                  {index + 1}:
                                </span>{" "}
                                {plate}
                              </div>
                            ),
                        )}
                      </div>
                    </div>
                  )}

                {/* Total de veículos */}
                <div className="text-xs text-gray-500 mt-1">
                  Total:{" "}
                  {[
                    form.watch("tractorUnitId") ? 1 : 0,
                    form.watch("flatbedId") ? 1 : 0,
                    form.watch("additionalPlates")
                      ? form.watch("additionalPlates").filter((p) => p).length
                      : 0,
                  ].reduce((a, b) => a + b, 0)}{" "}
                  veículos
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Dynamic fields for Romeo and Juliet */}
        {licenseType === "romeo_and_juliet" && (
          <div className="border border-gray-200 rounded-lg p-5 shadow-sm">
            <h3 className="font-semibold text-gray-800 text-lg mb-4 flex items-center">
              <VehicleTypeImage
                type="romeo_and_juliet"
                className="mr-2"
                iconSize={32}
              />
              Composição Principal do Romeu e Julieta
            </h3>

            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
              <p className="text-sm text-blue-800 flex items-center">
                <Check className="h-4 w-4 mr-2 flex-shrink-0" />
                Para o conjunto "Romeu e Julieta", a unidade tratora deve ser do
                tipo "Caminhão" e a 1ª carreta deve ser do tipo "Reboque".
              </p>
            </div>

            {/* Unidade Tratora - Esta é a unidade principal que desbloqueia a linha de frente */}
            <div className="mb-6">
              <FormField
                control={form.control}
                name="tractorUnitId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-medium">Caminhão</FormLabel>
                    <FormControl>
                      <VehicleAutocomplete
                        vehicles={trucks}
                        value={field.value}
                        onSelect={(vehicleId) => {
                          field.onChange(vehicleId);
                        }}
                        placeholder="Digite a placa ou selecione o caminhão"
                        disabled={isLoadingVehicles}
                        className="h-10 bg-blue-50 border-blue-200"
                      />
                    </FormControl>
                    <FormDescription className="text-xs text-muted-foreground mt-1">
                      Unidade principal do Romeu e Julieta
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Linha de Frente - Com destaque visual como componente principal */}
            <div className="border border-red-300 rounded-md p-4 bg-red-50 mb-6">
              <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4 mr-1 text-red-600"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                Reboque (Componente Principal)
              </h4>

              <FormField
                control={form.control}
                name="firstTrailerId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-medium">Reboque</FormLabel>
                    <FormControl>
                      <VehicleAutocomplete
                        vehicles={trailers}
                        value={field.value}
                        onSelect={(vehicleId) => {
                          field.onChange(vehicleId);
                        }}
                        placeholder="Digite a placa ou selecione o reboque"
                        disabled={isLoadingVehicles}
                        className="h-10 bg-amber-50 border-amber-200"
                      />
                    </FormControl>
                    <FormDescription className="text-xs text-muted-foreground mt-1">
                      Componente principal do Romeu e Julieta
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Resumo da composição */}
            <div className="bg-gray-50 p-3 rounded-md border border-gray-200">
              <h4 className="text-sm font-medium text-gray-700 mb-2">
                Composição selecionada:
              </h4>
              <div className="flex flex-col gap-3">
                {/* Veículos principais */}
                <div className="flex flex-wrap gap-2">
                  <div className="text-xs font-medium text-gray-600 mr-1">
                    Veículos principais:
                  </div>
                  {form.watch("tractorUnitId") && (
                    <div className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-md flex items-center">
                      <Truck className="h-3 w-3 mr-1" />
                      <span className="font-medium">Caminhão:</span>{" "}
                      {trucks.find((v) => v.id === form.watch("tractorUnitId"))
                        ?.plate || "Selecionado"}
                    </div>
                  )}
                  {form.watch("firstTrailerId") && (
                    <div className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-md flex items-center">
                      <Truck className="h-3 w-3 mr-1" />
                      <span className="font-medium">Reboque:</span>{" "}
                      {trailers.find(
                        (v) => v.id === form.watch("firstTrailerId"),
                      )?.plate || "Selecionado"}
                    </div>
                  )}
                </div>

                {/* Placas adicionais */}
                {form.watch("additionalPlates") &&
                  form.watch("additionalPlates").length > 0 && (
                    <div className="flex flex-col">
                      <div className="text-xs font-medium text-gray-600 mb-1">
                        Placas adicionais:
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {form.watch("additionalPlates").map(
                          (plate, index) =>
                            plate && (
                              <div
                                key={index}
                                className="text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded-md flex items-center"
                              >
                                <span className="font-medium mr-1">
                                  {index + 1}:
                                </span>{" "}
                                {plate}
                              </div>
                            ),
                        )}
                      </div>
                    </div>
                  )}

                {/* Total de veículos */}
                <div className="text-xs text-gray-500 mt-1">
                  Total:{" "}
                  {[
                    form.watch("tractorUnitId") ? 1 : 0,
                    form.watch("firstTrailerId") ? 1 : 0,
                    form.watch("additionalPlates")
                      ? form.watch("additionalPlates").filter((p) => p).length
                      : 0,
                  ].reduce((a, b) => a + b, 0)}{" "}
                  veículos
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="border border-gray-200 rounded-lg p-5 shadow-sm">
          <h3 className="font-semibold text-gray-800 text-lg mb-4 flex items-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 mr-2 text-gray-600"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="2" y="6" width="20" height="12" rx="2" ry="2"></rect>
              <path d="M2 13h20"></path>
            </svg>
            Placas Adicionais (Veículos Secundários)
          </h3>

          <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-md">
            <div className="flex items-start">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 mr-2 text-gray-500 mt-0.5 flex-shrink-0"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10"></circle>
                <path d="M12 16v-4"></path>
                <path d="M12 8h.01"></path>
              </svg>
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-1">
                  Veículos Complementares
                </h4>
                <p className="text-xs text-gray-600">
                  Nesta seção você pode adicionar placas de veículos que fazem
                  parte da composição mas não são considerados parte da linha de
                  frente. Estes veículos complementam o conjunto principal
                  selecionado acima.
                </p>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {form.watch("tractorUnitId") && (
                <div className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-md flex items-center">
                  <Truck className="h-3 w-3 mr-1" />
                  Linha de frente já inclui:{" "}
                  {tractorUnits.find(
                    (v) => v.id === form.watch("tractorUnitId"),
                  )?.plate || "Unidade tratora"}
                </div>
              )}
              {form.watch("firstTrailerId") && (
                <div className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-md">
                  1ª Carreta já incluída
                </div>
              )}
              {form.watch("secondTrailerId") && (
                <div className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded-md">
                  2ª Carreta já incluída
                </div>
              )}
              {form.watch("dollyId") && (
                <div className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-md">
                  Dolly já incluído
                </div>
              )}
              {form.watch("flatbedId") && (
                <div className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-md">
                  Prancha já incluída
                </div>
              )}
            </div>
          </div>

          <div className="text-sm text-gray-700 mb-3 font-medium">
            <span className="flex items-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4 mr-1 text-gray-600"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="9 11 12 14 22 4"></polyline>
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
              </svg>
              Gerenciamento de Placas Adicionais
            </span>
          </div>

          {/* Componente de campo de placas adicionais com autopreenchimento */}
          <div className="border-dashed border-2 border-gray-300 rounded-md p-4 bg-gray-50">
            <CampoPlacaAdicional
              form={form}
              vehicles={vehicles}
              isLoadingVehicles={isLoadingVehicles}
              licenseType={licenseType}
            />
          </div>

          {/* Total de veículos */}
          <div className="mt-4 flex justify-between items-center text-sm">
            <span className="text-gray-600">
              Tipo de conjunto:{" "}
              <span className="font-medium">
                {licenseType === "bitrain_6_axles"
                  ? "Bitrem 6 Eixos"
                  : licenseType === "bitrain_7_axles"
                    ? "Bitrem 7 Eixos"
                    : licenseType === "bitrain_9_axles"
                      ? "Bitrem 9 Eixos"
                      : licenseType === "roadtrain_9_axles"
                        ? "Rodotrem 9 Eixos"
                        : licenseType === "flatbed"
                          ? "Prancha"
                          : licenseType === "romeo_and_juliet"
                            ? "Romeu e Julieta"
                            : "Outro"}
              </span>
            </span>
            <span className="bg-gray-100 text-gray-800 px-2.5 py-1 rounded-md flex items-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4 mr-1 text-gray-600"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2z"></path>
                <path d="M10 22V4"></path>
                <path d="M15 4v18"></path>
              </svg>
              Total de Veículos:{" "}
              <span className="font-medium ml-1">
                {
                  // Contabilizar principais + adicionais
                  (form.watch("tractorUnitId") ? 1 : 0) +
                    (form.watch("firstTrailerId") ? 1 : 0) +
                    (form.watch("secondTrailerId") ? 1 : 0) +
                    (form.watch("dollyId") ? 1 : 0) +
                    (form.watch("flatbedId") ? 1 : 0) +
                    (form.watch("additionalPlates")?.length || 0)
                }
              </span>
            </span>
          </div>
        </div>

        <div className="border border-gray-200 rounded-lg p-5 shadow-sm">
          <h3 className="font-semibold text-gray-800 text-lg mb-4 flex items-center">
            <FileUp className="mr-2 h-5 w-5" />
            Documentos
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="bg-blue-50 p-4 rounded-md border border-blue-100">
              <h4 className="text-blue-700 font-medium mb-2 flex items-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="mr-2"
                >
                  <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                Documentação dos Veículos
              </h4>
              <p className="text-sm text-blue-600 mb-3">
                Os CRLVs dos veículos serão vinculados automaticamente a partir
                do cadastro de veículos. Caso não encontre algum veículo,
                cadastre-o clicando no +:
              </p>
              <div className="text-xs text-gray-500">
                Formatos aceitos: PDF, JPG, PNG
              </div>
            </div>

            <div className="bg-amber-50 p-4 rounded-md border border-amber-100">
              <h4 className="text-amber-700 font-medium mb-2 flex items-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="mr-2"
                >
                  <path d="M12 8v4l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
                </svg>
                Tempo de Processamento
              </h4>
              <p className="text-sm text-amber-600 mb-3">
                Após o envio, a solicitação passará por análise do órgão
                competente. O prazo médio para análise varia de acordo com cada
                estado.
              </p>
              <div className="text-xs text-gray-500">
                Acompanhe o status na página "Acompanhar Licença"
              </div>
            </div>
          </div>

          <FormField
            control={form.control}
            name="comments"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-base font-medium">
                  Observações
                </FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Adicione observações relevantes para este pedido de licença..."
                    className="min-h-[120px] resize-y"
                    value={(field.value as string) || ""}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    name={field.name}
                    ref={field.ref}
                  />
                </FormControl>
                <FormDescription>
                  Inclua quaisquer informações adicionais importantes para a
                  análise desta solicitação
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="border border-gray-200 rounded-lg p-5 shadow-sm">
          <h3 className="font-semibold text-gray-800 text-lg mb-4 flex items-center">
            Estados Solicitados
          </h3>

          <FormField
            control={form.control}
            name="states"
            render={() => (
              <FormItem>
                <div className="mb-2">
                  <div className="flex justify-between items-center">
                    <FormLabel className="text-base font-medium">
                      Selecione os estados para emissão de licença
                    </FormLabel>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={validateAllStatesManual}
                        disabled={preventiveValidationRunning}
                        className="flex items-center gap-2 h-8 text-xs"
                      >
                        {preventiveValidationRunning ? (
                          <>
                            <div className="animate-spin h-3 w-3 border-2 border-gray-300 border-t-blue-600 rounded-full"></div>
                            Validando...
                          </>
                        ) : (
                          <>
                            <Shield className="h-3 w-3" />
                            Verificar Estados
                          </>
                        )}
                      </Button>
                      <FormField
                      control={form.control}
                      name="states"
                      render={({ field }) => {
                        const selectedStates = field.value || [];
                        const availableStates = brazilianStates.filter(state => 
                          !blockedStates[state.code] && stateValidationStatus[state.code] !== 'blocked'
                        );
                        const allAvailableSelected = availableStates.length > 0 && 
                          availableStates.every(state => selectedStates.includes(state.code));
                        const hasAnySelected = selectedStates.length > 0;
                        return (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs flex gap-1 items-center"
                            onClick={async () => {
                              if (hasAnySelected) {
                                // Desmarcar todos os estados selecionados
                                console.log('[UNSELECT ALL] Desmarcando todos os estados');
                                field.onChange([]);
                              } else {
                                // Selecionar apenas estados disponíveis (não bloqueados)
                                console.log('[SELECT ALL] Selecionando todos os estados disponíveis');
                                const validStates = availableStates.map(state => state.code);
                                console.log(`[SELECT ALL] Estados disponíveis selecionados:`, validStates);
                                field.onChange(validStates);
                              }
                            }}
                          >
                            {hasAnySelected ? (
                              <>
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  width="14"
                                  height="14"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                >
                                  <rect
                                    x="3"
                                    y="3"
                                    width="18"
                                    height="18"
                                    rx="2"
                                    ry="2"
                                  ></rect>
                                </svg>
                                Desmarcar Todos
                              </>
                            ) : (
                              <>
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  width="14"
                                  height="14"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                >
                                  <polyline points="9 11 12 14 22 4"></polyline>
                                  <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
                                </svg>
                                Selecionar Todos
                              </>
                            )}
                          </Button>
                        );
                      }}
                    />
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground mt-1 mb-3">
                    Escolha um ou mais estados onde a licença será utilizada
                  </div>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-2">
                  {brazilianStates.map((state) => (
                    <FormField
                      key={state.code}
                      control={form.control}
                      name="states"
                      render={({ field }) => {
                        const isSelected = (field.value || []).includes(
                          state.code,
                        );
                        return (
                          <FormItem key={state.code} className="m-0 p-0">
                            <FormControl>
                              <div
                                className={`cursor-pointer flex flex-col items-center justify-center p-2 rounded-md border ${
                                  isSelected
                                    ? "bg-blue-50 border-blue-300 text-blue-700 font-medium"
                                    : stateValidationStatus[state.code] === 'blocked' || blockedStates[state.code]
                                      ? "bg-yellow-100 border-yellow-400 cursor-not-allowed"
                                      : stateValidationStatus[state.code] === 'loading'
                                        ? "bg-gray-100 border-gray-300 opacity-60 cursor-not-allowed"
                                        : validatingState === state.code
                                          ? "bg-gray-100 border-gray-300 opacity-60 cursor-not-allowed"
                                          : stateValidationStatus[state.code] === 'valid'
                                            ? "bg-green-50 border-green-200 hover:bg-green-100"
                                            : "border-gray-200 hover:bg-gray-50"
                                }`}
                                onClick={async () => {
                                  console.log(`[HANDLE STATE CLICK] Clicando em ${state.code}, validating: ${validatingState}`);
                                  
                                  // Prevenir cliques múltiplos ou em estados já validando
                                  if (validatingState) {
                                    console.log(`[HANDLE STATE CLICK] Já validando ${validatingState} - ignorando clique em ${state.code}`);
                                    return;
                                  }
                                  
                                  // Verificar se estado já está bloqueado
                                  if (blockedStates[state.code]) {
                                    console.log(`[HANDLE STATE CLICK] Estado ${state.code} já bloqueado - ignorando clique`);
                                    return;
                                  }
                                  
                                  if (isSelected) {
                                    console.log(`[HANDLE STATE CLICK] Removendo estado ${state.code}`);
                                    // Limpar estado dos bloqueados se estava lá
                                    setBlockedStates(prev => {
                                      const updated = { ...prev };
                                      delete updated[state.code];
                                      return updated;
                                    });
                                    field.onChange(
                                      (field.value || []).filter(
                                        (value) => value !== state.code,
                                      ),
                                    );
                                  } else {
                                    console.log(`[HANDLE STATE CLICK] Adicionando estado ${state.code} - iniciando validação`);
                                    const isBloqueado = await validateState(state.code);
                                    
                                    // Verificação dupla após validação para evitar condição de corrida
                                    if (!isBloqueado && !blockedStates[state.code]) {
                                      console.log(`[HANDLE STATE CLICK] Estado ${state.code} liberado - adicionando`);
                                      field.onChange([
                                        ...(field.value || []),
                                        state.code,
                                      ]);
                                    } else {
                                      console.log(`[HANDLE STATE CLICK] Estado ${state.code} bloqueado - não adicionando`);
                                      // Garantir que estado bloqueado não seja adicionado
                                      field.onChange(
                                        (field.value || []).filter(
                                          (value) => value !== state.code,
                                        )
                                      );
                                    }
                                  }
                                }}
                              >
                                <span className="text-base font-medium">
                                  {state.code}
                                </span>
                                <span className="text-xs mt-1 text-center hidden md:block text-gray-500">
                                  {state.name}
                                </span>
                                {/* Mostrar status da validação como na imagem */}
                                {stateValidationStatus[state.code] === 'loading' && (
                                  <span className="text-xs mt-1 text-center text-gray-500">
                                    validando...
                                  </span>
                                )}
                                {validatingState === state.code && (
                                  <span className="text-xs mt-1 text-center text-gray-500">
                                    verificando...
                                  </span>
                                )}
                                {(stateValidationStatus[state.code] === 'blocked' || blockedStates[state.code]) && (
                                  <div className="text-xs mt-1 text-center">
                                    <div className="text-orange-600 font-medium">licença vigente</div>
                                    {(blockedStates[state.code]?.data_validade || blockedStates[state.code]?.validade) && (
                                      <div className="text-orange-500 text-xs">
                                        até {new Date(blockedStates[state.code]?.data_validade || blockedStates[state.code]?.validade).toLocaleDateString('pt-BR')}
                                      </div>
                                    )}
                                  </div>
                                )}
                                {stateValidationStatus[state.code] === 'valid' && !blockedStates[state.code] && (
                                  <span className="text-xs mt-1 text-center text-green-600 font-medium">
                                    disponível
                                  </span>
                                )}
                              </div>
                            </FormControl>
                          </FormItem>
                        );
                      }}
                    />
                  ))}
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex flex-col sm:flex-row justify-end gap-4 sm:space-x-4 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            className="w-full sm:w-auto order-3 sm:order-1"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleSaveDraft}
            disabled={isProcessing}
            className="w-full sm:w-auto order-2"
          >
            {saveAsDraftMutation.isPending && (
              <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
            )}
            Salvar Rascunho
          </Button>
          <Button
            type="button"
            onClick={handleSubmitRequest}
            disabled={isProcessing}
            className="bg-blue-600 hover:bg-blue-700 text-white w-full sm:w-auto order-1 sm:order-3"
          >
            {submitRequestMutation.isPending && (
              <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
            )}
            Enviar Pedido
          </Button>
        </div>
      </form>

      {/* Modal de confirmação para veículos de terceiros na seleção */}
      <AlertDialog open={showThirdPartyConfirmation} onOpenChange={setShowThirdPartyConfirmation}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Veículo em nome de Terceiro</AlertDialogTitle>
            <AlertDialogDescription>
              O veículo selecionado está registrado em nome de terceiro. Deseja continuar com esta seleção?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelThirdPartyVehicle}>
              Não
            </AlertDialogCancel>
            <AlertDialogAction onClick={confirmThirdPartyVehicle}>
              Sim
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal de confirmação para envio com veículos de terceiros */}
      <AlertDialog open={showSubmitConfirmation} onOpenChange={setShowSubmitConfirmation}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Envio com Veículos de Terceiros</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                O pedido contém os seguintes veículos em nome de terceiros:
                <div className="mt-2 p-3 bg-orange-50 border border-orange-200 rounded-md">
                  {thirdPartyVehiclesInSubmit.map((vehicle, index) => (
                    <div key={index} className="text-sm font-medium text-orange-800">
                      • {vehicle}
                    </div>
                  ))}
                </div>
                <div className="mt-3">
                  Deseja continuar com o envio da solicitação?
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelSubmitWithThirdParty}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction onClick={confirmSubmitWithThirdParty}>
              Confirmar Envio
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Form>
  );
}
