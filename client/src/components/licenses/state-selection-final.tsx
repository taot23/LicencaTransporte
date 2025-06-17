import { useEffect, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { useLicenseValidationFinal } from "@/hooks/use-license-validation-final";

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

interface StateSelectionFinalProps {
  selectedStates: string[];
  onStatesChange: (states: string[]) => void;
  placas: Placas;
  disabled?: boolean;
}

export function StateSelectionFinal({ selectedStates, onStatesChange, placas, disabled }: StateSelectionFinalProps) {
  const { validarEstados, getEstadosBloqueados, isChecking } = useLicenseValidationFinal();
  const [validationTrigger, setValidationTrigger] = useState(0);

  // Validar automaticamente quando placas mudarem
  useEffect(() => {
    if (placas && Object.values(placas).some(Boolean) && selectedStates.length > 0) {
      console.log('[STATE SELECTION FINAL] Triggering validation for placas:', placas);
      setValidationTrigger(prev => prev + 1);
    }
  }, [placas, selectedStates]);

  // Executar validação quando trigger mudar
  useEffect(() => {
    if (validationTrigger > 0 && selectedStates.length > 0) {
      validarEstados(selectedStates, placas).then(estadosLiberados => {
        const estadosBloqueados = selectedStates.filter(estado => !estadosLiberados.includes(estado));
        if (estadosBloqueados.length > 0) {
          console.log('[STATE SELECTION FINAL] Estados bloqueados detectados:', estadosBloqueados);
          // Remover estados bloqueados da seleção
          onStatesChange(estadosLiberados);
        }
      });
    }
  }, [validationTrigger, selectedStates, placas, validarEstados, onStatesChange]);

  const handleStateToggle = async (stateCode: string) => {
    if (disabled || isChecking) return;

    const isCurrentlySelected = selectedStates.includes(stateCode);

    if (isCurrentlySelected) {
      // Remover estado
      const newStates = selectedStates.filter(s => s !== stateCode);
      onStatesChange(newStates);
    } else {
      // Adicionar estado - validar antes se há placas
      if (placas && Object.values(placas).some(Boolean)) {
        console.log(`[STATE SELECTION FINAL] Validando estado ${stateCode} antes de adicionar`);
        
        const estadosParaValidar = [stateCode];
        const estadosLiberados = await validarEstados(estadosParaValidar, placas);
        
        if (estadosLiberados.includes(stateCode)) {
          // Estado liberado, pode adicionar
          console.log(`[STATE SELECTION FINAL] Estado ${stateCode} liberado, adicionando`);
          const newStates = [...selectedStates, stateCode];
          onStatesChange(newStates);
        } else {
          // Estado bloqueado, mostrar alerta
          const estadosBloqueados = getEstadosBloqueados();
          const estadoBloqueado = estadosBloqueados[stateCode];
          
          if (estadoBloqueado) {
            alert(
              `Estado ${stateCode} possui licença vigente até ${formatDate(estadoBloqueado.validade)} ` +
              `(${estadoBloqueado.diasRestantes} dias restantes).\n\n` +
              `Só é possível renovar quando restarem 60 dias ou menos para evitar custos desnecessários.`
            );
          } else {
            alert(`Estado ${stateCode} não pode ser selecionado devido a licença vigente.`);
          }
        }
      } else {
        // Sem placas, adicionar sem validação
        const newStates = [...selectedStates, stateCode];
        onStatesChange(newStates);
      }
    }
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('pt-BR');
    } catch {
      return dateString;
    }
  };

  const estadosBloqueados = getEstadosBloqueados();

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Estados de Circulação</h3>
        {isChecking && (
          <div className="text-sm text-blue-600 flex items-center gap-2">
            <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
            Validando licenças...
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {ESTADOS_BRASIL.map((estado) => {
          const isSelected = selectedStates.includes(estado.code);
          const estadoBloqueado = estadosBloqueados[estado.code];
          const isBloqueado = estadoBloqueado && estadoBloqueado.diasRestantes > 60;
          
          return (
            <div key={estado.code} className="space-y-1">
              <div 
                className={`
                  flex items-center space-x-2 p-3 rounded-lg border cursor-pointer transition-all
                  ${isBloqueado 
                    ? 'bg-yellow-50 border-yellow-300 cursor-not-allowed' 
                    : isSelected 
                      ? 'bg-blue-50 border-blue-300' 
                      : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                  }
                  ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
                `}
                onClick={() => handleStateToggle(estado.code)}
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
              
              {isBloqueado && estadoBloqueado && (
                <div className="text-xs text-yellow-700 bg-yellow-100 p-2 rounded border border-yellow-200">
                  <div className="font-medium">⚠️ Licença vigente:</div>
                  <div>Nº: {estadoBloqueado.numero}</div>
                  <div>Vence: {formatDate(estadoBloqueado.validade)}</div>
                  <div>Restam: {estadoBloqueado.diasRestantes} dias</div>
                  <div className="text-xs mt-1 text-yellow-600">
                    Renovação permitida apenas com ≤60 dias
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      
      {Object.keys(estadosBloqueados).length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="text-sm text-yellow-800">
            <div className="font-medium mb-2">⚠️ Estados com licenças vigentes (bloqueados):</div>
            <div className="space-y-1">
              {Object.entries(estadosBloqueados).map(([estado, info]) => (
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