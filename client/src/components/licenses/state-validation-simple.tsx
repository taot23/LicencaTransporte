import { useEffect, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";

const ESTADOS_BRASIL = [
  { code: "AL", name: "Alagoas" },
  { code: "BA", name: "Bahia" },
  { code: "CE", name: "Ceará" },
  { code: "DF", name: "Distrito Federal" },
  { code: "DNIT", name: "FEDERAL" },
  { code: "ES", name: "Espírito Santo" },
  { code: "GO", name: "Goiás" },
  { code: "MA", name: "Maranhão" },
  { code: "MG", name: "Minas Gerais" },
  { code: "MS", name: "Mato Grosso do Sul" },
  { code: "MT", name: "Mato Grosso" },
  { code: "PA", name: "Pará" },
  { code: "PE", name: "Pernambuco" },
  { code: "PR", name: "Paraná" },
  { code: "RJ", name: "Rio de Janeiro" },
  { code: "RS", name: "Rio Grande do Sul" },
  { code: "SC", name: "Santa Catarina" },
  { code: "SE", name: "Sergipe" },
  { code: "SP", name: "São Paulo" },
  { code: "TO", name: "Tocantins" }
];

interface Placas {
  cavalo?: string;
  primeiraCarreta?: string;
  segundaCarreta?: string;
  dolly?: string;
  prancha?: string;
  reboque?: string;
}

interface LicencaVigente {
  estado: string;
  numero: string;
  validade: string;
  diasRestantes: number;
}

interface StateValidationSimpleProps {
  selectedStates: string[];
  onStatesChange: (states: string[]) => void;
  placas: Placas;
  disabled?: boolean;
}

export function StateValidationSimple({ selectedStates, onStatesChange, placas, disabled }: StateValidationSimpleProps) {
  const [licencasVigentes, setLicencasVigentes] = useState<Record<string, LicencaVigente>>({});
  const [isValidating, setIsValidating] = useState(false);

  // Função para validar um estado específico
  const validarEstado = async (estado: string, placasArray: string[]): Promise<LicencaVigente | null> => {
    try {
      console.log(`[VALIDAÇÃO SIMPLES] Validando ${estado} com placas:`, placasArray);
      
      const response = await fetch('/api/validacao-critica', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          estado: estado,
          placas: placasArray
        })
      });

      if (response.ok) {
        const data = await response.json();
        console.log(`[VALIDAÇÃO SIMPLES] Resposta ${estado}:`, data);
        
        if (data.bloqueado && data.diasRestantes > 60) {
          return {
            estado: estado,
            numero: data.numero,
            validade: data.validade,
            diasRestantes: data.diasRestantes
          };
        }
      } else {
        console.error(`[VALIDAÇÃO SIMPLES] Erro HTTP ${response.status} para ${estado}`);
      }
    } catch (error) {
      console.error(`[VALIDAÇÃO SIMPLES] Erro ao validar ${estado}:`, error);
    }
    
    return null;
  };

  // Função para validar todos os estados selecionados
  const validarTodos = async () => {
    if (!placas || selectedStates.length === 0) return;
    
    const placasArray = Object.values(placas).filter(Boolean);
    if (placasArray.length === 0) return;

    console.log('[VALIDAÇÃO SIMPLES] Iniciando validação para estados:', selectedStates);
    setIsValidating(true);
    
    const novasLicencasVigentes: Record<string, LicencaVigente> = {};
    const estadosLiberados: string[] = [];
    
    try {
      for (const estado of selectedStates) {
        const licencaVigente = await validarEstado(estado, placasArray);
        
        if (licencaVigente) {
          console.log(`[VALIDAÇÃO SIMPLES] ${estado} BLOQUEADO: ${licencaVigente.diasRestantes} dias`);
          novasLicencasVigentes[estado] = licencaVigente;
        } else {
          console.log(`[VALIDAÇÃO SIMPLES] ${estado} LIBERADO`);
          estadosLiberados.push(estado);
        }
      }
      
      setLicencasVigentes(novasLicencasVigentes);
      
      // Se há estados bloqueados, remover da seleção e avisar
      const estadosBloqueados = Object.keys(novasLicencasVigentes);
      if (estadosBloqueados.length > 0) {
        console.log('[VALIDAÇÃO SIMPLES] Removendo estados bloqueados:', estadosBloqueados);
        onStatesChange(estadosLiberados);
        
        // Mostrar alerta sobre estados bloqueados
        const detalhes = estadosBloqueados.map(estado => {
          const info = novasLicencasVigentes[estado];
          return `${estado}: ${info.numero} (${info.diasRestantes} dias restantes)`;
        }).join('\n');
        
        alert(
          `⚠️ ESTADOS BLOQUEADOS POR LICENÇAS VIGENTES:\n\n${detalhes}\n\n` +
          `💰 ECONOMIA: Renovação só é permitida quando restam 60 dias ou menos.\n` +
          `Isso evita custos desnecessários de pedidos duplicados.`
        );
      }
      
    } finally {
      setIsValidating(false);
    }
  };

  // Validar quando placas ou estados mudarem
  useEffect(() => {
    if (placas && Object.values(placas).some(Boolean) && selectedStates.length > 0) {
      console.log('[VALIDAÇÃO SIMPLES] Trigger de validação - placas:', placas, 'estados:', selectedStates);
      validarTodos();
    }
  }, [placas, selectedStates]);

  const handleStateToggle = async (stateCode: string) => {
    if (disabled || isValidating) return;

    const isCurrentlySelected = selectedStates.includes(stateCode);

    if (isCurrentlySelected) {
      // Remover estado
      const newStates = selectedStates.filter(s => s !== stateCode);
      onStatesChange(newStates);
    } else {
      // Adicionar estado - primeiro adiciona, depois valida
      const newStates = [...selectedStates, stateCode];
      onStatesChange(newStates);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('pt-BR');
    } catch {
      return dateString;
    }
  };

  const isEstadoBloqueado = (estado: string) => {
    return licencasVigentes[estado] !== undefined;
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Estados de Circulação</h3>
        {isValidating && (
          <div className="text-sm text-blue-600 flex items-center gap-2">
            <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
            Validando licenças vigentes...
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {ESTADOS_BRASIL.map((estado) => {
          const isSelected = selectedStates.includes(estado.code);
          const licencaVigente = licencasVigentes[estado.code];
          const isBloqueado = isEstadoBloqueado(estado.code);
          
          return (
            <div key={estado.code} className="space-y-1">
              <div 
                className={`
                  flex items-center space-x-2 p-3 rounded-lg border cursor-pointer transition-all
                  ${isBloqueado 
                    ? 'bg-yellow-50 border-yellow-300 cursor-not-allowed opacity-75' 
                    : isSelected 
                      ? 'bg-blue-50 border-blue-300' 
                      : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                  }
                  ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
                `}
                onClick={() => !isBloqueado && handleStateToggle(estado.code)}
              >
                <Checkbox 
                  id={estado.code}
                  checked={isSelected}
                  disabled={disabled || isBloqueado}
                  onChange={() => {}} // Controlled by parent click
                />
                <div className="flex-1">
                  <label 
                    htmlFor={estado.code} 
                    className={`text-sm font-medium cursor-pointer ${
                      isBloqueado ? 'text-yellow-800' : 'text-gray-900'
                    }`}
                  >
                    {estado.code}
                  </label>
                  <div className="text-xs text-gray-600">{estado.name}</div>
                </div>
              </div>
              
              {isBloqueado && licencaVigente && (
                <div className="text-xs text-yellow-700 bg-yellow-100 p-2 rounded border border-yellow-200">
                  <div className="font-medium">⚠️ Licença vigente:</div>
                  <div>Nº: {licencaVigente.numero}</div>
                  <div>Vence: {formatDate(licencaVigente.validade)}</div>
                  <div>Restam: {licencaVigente.diasRestantes} dias</div>
                  <div className="text-xs mt-1 text-yellow-600">
                    Renovação permitida apenas com ≤60 dias
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      
      {Object.keys(licencasVigentes).length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="text-sm text-yellow-800">
            <div className="font-medium mb-2">⚠️ Estados com licenças vigentes (bloqueados):</div>
            <div className="space-y-1">
              {Object.entries(licencasVigentes).map(([estado, info]) => (
                <div key={estado} className="text-xs">
                  <strong>{estado}:</strong> {info.numero} - Vence em {info.diasRestantes} dias ({formatDate(info.validade)})
                </div>
              ))}
            </div>
            <div className="mt-2 text-xs font-medium">
              💰 ECONOMIA: Sistema previne custos desnecessários bloqueando pedidos duplicados
            </div>
          </div>
        </div>
      )}
    </div>
  );
}