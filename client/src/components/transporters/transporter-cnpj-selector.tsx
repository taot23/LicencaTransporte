import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Building2, ChevronDown } from "lucide-react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface TransporterCnpjSelectorProps {
  transporterId: number;
  selectedCnpj?: string;
  onCnpjSelect?: (cnpj: string, name: string) => void;
}

interface Subsidiary {
  name: string;
  documentNumber: string;
  city: string;
  state: string;
  isActive?: boolean;
}

interface TransporterData {
  id: number;
  name: string;
  tradeName?: string;
  documentNumber: string;
  city: string;
  state: string;
  subsidiaries: Subsidiary[];
}

interface CnpjOption {
  value: string;
  label: string;
  type: "matriz" | "filial";
  location: string;
}

export function TransporterCnpjSelector({
  transporterId,
  selectedCnpj: externalSelectedCnpj,
  onCnpjSelect,
}: TransporterCnpjSelectorProps) {
  const [selectedCnpj, setSelectedCnpj] = useState<string>(externalSelectedCnpj || "");

  // Atualizar o estado interno quando a prop externa mudar
  useEffect(() => {
    setSelectedCnpj(externalSelectedCnpj || "");
  }, [externalSelectedCnpj]);

  const { data: transporter, isLoading } = useQuery<TransporterData>({
    queryKey: [`/api/public/transporters/${transporterId}`],
    enabled: !!transporterId,
  });

  if (isLoading) {
    return (
      <div className="mb-4">
        <Label className="text-sm font-medium text-gray-700 mb-2 block">
          CNPJ Cadastrado
        </Label>
        <div className="text-sm text-gray-500 p-3 border border-gray-200 rounded-lg">
          Carregando CNPJs...
        </div>
      </div>
    );
  }

  if (!transporter) {
    return (
      <div className="mb-4">
        <Label className="text-sm font-medium text-gray-700 mb-2 block">
          CNPJ Cadastrado
        </Label>
        <div className="text-sm text-gray-500 p-3 border border-gray-200 rounded-lg">
          Transportador não encontrado
        </div>
      </div>
    );
  }

  // Construir lista de opções de CNPJ
  const cnpjOptions: CnpjOption[] = [];

  // Adicionar matriz
  cnpjOptions.push({
    value: transporter.documentNumber,
    label: `${transporter.tradeName || transporter.name} - ${transporter.documentNumber}`,
    type: "matriz",
    location: `${transporter.city}/${transporter.state}`,
  });

  // Adicionar filiais
  let subsidiaries = [];
  if (transporter.subsidiaries) {
    try {
      // Tentar analisar como JSON se for string
      subsidiaries = typeof transporter.subsidiaries === 'string' 
        ? JSON.parse(transporter.subsidiaries) 
        : transporter.subsidiaries;
    } catch (e) {
      console.log('Erro ao processar subsidiárias:', e);
      subsidiaries = [];
    }
  }

  // Garantir que é um array
  if (!Array.isArray(subsidiaries)) {
    subsidiaries = [];
  }

  console.log('[CNPJ Selector] Subsidiárias processadas:', subsidiaries);

  subsidiaries.forEach((subsidiary) => {
    // Verificar se tem documentNumber ou cnpj
    const cnpj = subsidiary.documentNumber || subsidiary.cnpj;
    if (cnpj) {
      cnpjOptions.push({
        value: cnpj,
        label: `${subsidiary.name} - ${cnpj}`,
        type: "filial",
        location: `${subsidiary.city}/${subsidiary.state}`,
      });
    }
  });

  console.log('[CNPJ Selector] Opções de CNPJ geradas:', cnpjOptions);

  const handleCnpjChange = async (value: string) => {
    console.log('[CNPJ Selector] CNPJ selecionado:', value);
    console.log('[CNPJ Selector] Props recebidas - licenseId:', licenseId, 'state:', state);
    console.log('[CNPJ Selector] onCnpjSelect callback existe:', !!onCnpjSelect);
    setSelectedCnpj(value);
    
    // Se temos licenceId e state, salvar diretamente no banco
    if (licenseId && state) {
      try {
        console.log('[CNPJ Selector] Salvando CNPJ por estado - Licença:', licenseId, 'Estado:', state, 'CNPJ:', value);
        
        const response = await fetch(`/api/admin/licenses/${licenseId}/state-cnpj`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            state: state,
            cnpj: value
          })
        });
        
        if (response.ok) {
          const result = await response.json();
          console.log('[CNPJ Selector] CNPJ salvo com sucesso:', result);
        } else {
          console.error('[CNPJ Selector] Erro ao salvar CNPJ:', response.status);
          const errorText = await response.text();
          console.error('[CNPJ Selector] Resposta do erro:', errorText);
        }
      } catch (error) {
        console.error('[CNPJ Selector] Erro na requisição:', error);
      }
    } else {
      console.log('[CNPJ Selector] Não salvando - licenseId ou state ausentes');
    }
    
    const selectedOption = cnpjOptions.find((option) => option.value === value);
    if (selectedOption && onCnpjSelect) {
      console.log('[CNPJ Selector] Chamando callback onCnpjSelect com:', value, selectedOption.label);
      onCnpjSelect(value, selectedOption.label);
    }
  };

  return (
    <div className="mb-4">
      <Select value={selectedCnpj} onValueChange={handleCnpjChange}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Selecione um CNPJ cadastrado" />
        </SelectTrigger>
        <SelectContent 
          className="z-[9999] max-h-60 overflow-auto" 
          position="popper" 
          sideOffset={4}
        >
          {cnpjOptions.map((option, index) => (
            <SelectItem key={`${option.value}-${index}`} value={option.value}>
              <div className="flex items-center space-x-2 w-full">
                <Building2
                  className={`h-4 w-4 ${option.type === "matriz" ? "text-blue-600" : "text-green-600"}`}
                />
                <div className="flex-1">
                  <div className="font-medium text-sm">
                    {option.type === "matriz" ? "(Matriz)" : "(Filial)"}{" "}
                    {option.label.split(" - ")[0]}
                  </div>
                  <div className="text-xs text-gray-500 flex items-center space-x-2">
                    <span>CNPJ: {option.value}</span>
                    <span>•</span>
                    <span>{option.location}</span>
                  </div>
                </div>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {selectedCnpj && (
        <div className="mt-2 text-xs text-gray-600">
          <div className="bg-blue-50 p-2 rounded border border-blue-200">
            <span className="font-medium">CNPJ Selecionado:</span>{" "}
            {selectedCnpj}
          </div>
        </div>
      )}

      {cnpjOptions.length === 0 && (
        <div className="text-sm text-gray-500 p-3 border border-gray-200 rounded-lg">
          Nenhum CNPJ encontrado para este transportador
        </div>
      )}
    </div>
  );
}
