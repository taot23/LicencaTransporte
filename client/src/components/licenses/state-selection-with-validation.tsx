import React, { useEffect, useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { useLicenseValidationV2 } from '@/hooks/use-license-validation-v2';

interface Placas {
  cavalo?: string;
  primeiraCarreta?: string;
  segundaCarreta?: string;
  dolly?: string;
  prancha?: string;
  reboque?: string;
}

interface StateSelectionWithValidationProps {
  selectedStates: string[];
  onStatesChange: (states: string[]) => void;
  placas: Placas;
  disabled?: boolean;
}

const ESTADOS_BRASIL = [
  { code: 'AC', name: 'Acre' },
  { code: 'AL', name: 'Alagoas' },
  { code: 'AP', name: 'Amapá' },
  { code: 'AM', name: 'Amazonas' },
  { code: 'BA', name: 'Bahia' },
  { code: 'CE', name: 'Ceará' },
  { code: 'DF', name: 'Distrito Federal' },
  { code: 'ES', name: 'Espírito Santo' },
  { code: 'GO', name: 'Goiás' },
  { code: 'MA', name: 'Maranhão' },
  { code: 'MT', name: 'Mato Grosso' },
  { code: 'MS', name: 'Mato Grosso do Sul' },
  { code: 'MG', name: 'Minas Gerais' },
  { code: 'PA', name: 'Pará' },
  { code: 'PB', name: 'Paraíba' },
  { code: 'PR', name: 'Paraná' },
  { code: 'PE', name: 'Pernambuco' },
  { code: 'PI', name: 'Piauí' },
  { code: 'RJ', name: 'Rio de Janeiro' },
  { code: 'RN', name: 'Rio Grande do Norte' },
  { code: 'RS', name: 'Rio Grande do Sul' },
  { code: 'RO', name: 'Rondônia' },
  { code: 'RR', name: 'Roraima' },
  { code: 'SC', name: 'Santa Catarina' },
  { code: 'SP', name: 'São Paulo' },
  { code: 'SE', name: 'Sergipe' },
  { code: 'TO', name: 'Tocantins' },
];

export function StateSelectionWithValidation({ selectedStates, onStatesChange, placas, disabled }: StateSelectionWithValidationProps) {
  const { verificarEstadoComLicencaVigente, estadosBloqueados, isChecking, setEstadosBloqueados } = useLicenseValidationV2();
  const [validatedStates, setValidatedStates] = useState<Set<string>>(new Set());

  // Verificar estados quando placas ou estados selecionados mudam
  useEffect(() => {
    if (!placas || Object.keys(placas).length === 0) {
      return;
    }

    const placasArray = Object.values(placas).filter(Boolean);
    if (placasArray.length === 0) {
      return;
    }

    // Verificar cada estado selecionado
    selectedStates.forEach(estado => {
      if (!validatedStates.has(estado)) {
        verificarEstadoComLicencaVigente(estado, placas);
        setValidatedStates(prev => new Set([...prev, estado]));
      }
    });
  }, [selectedStates, placas, verificarEstadoComLicencaVigente, validatedStates]);

  const handleStateToggle = async (stateCode: string) => {
    if (disabled) return;

    const isCurrentlySelected = selectedStates.includes(stateCode);

    if (isCurrentlySelected) {
      // Remover estado da seleção
      const newStates = selectedStates.filter(s => s !== stateCode);
      setValidatedStates(prev => {
        const updated = new Set(prev);
        updated.delete(stateCode);
        return updated;
      });
      onStatesChange(newStates);
    } else {
      // Verificar ANTES de adicionar o estado
      if (placas && Object.values(placas).some(Boolean)) {
        // Executar validação síncrona
        try {
          const isBloqueado = await verificarEstadoComLicencaVigente(stateCode, placas);
          
          if (isBloqueado) {
            // Estado bloqueado - buscar dados do estado bloqueado
            const estadoBloqueado = estadosBloqueados[stateCode];
            if (estadoBloqueado) {
              alert(`Estado ${stateCode} possui licença vigente até ${formatDate(estadoBloqueado.validade)} (${estadoBloqueado.diasRestantes} dias restantes). Só é possível renovar quando restarem 60 dias ou menos.`);
            } else {
              alert(`Estado ${stateCode} possui licença vigente. Só é possível renovar quando restarem 60 dias ou menos.`);
            }
            return; // Não adicionar à seleção
          }
          
          // Se passou na validação, adicionar à seleção
          const newStates = [...selectedStates, stateCode];
          setValidatedStates(prev => new Set([...prev, stateCode]));
          onStatesChange(newStates);
        } catch (error) {
          console.error('Erro na validação:', error);
          // Em caso de erro, permitir seleção
          const newStates = [...selectedStates, stateCode];
          onStatesChange(newStates);
        }
      } else {
        // Se não há placas, adicionar sem validação
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

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium">Estados de Circulação</h3>
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
                  <div className="font-medium">Licença vigente:</div>
                  <div>Nº: {estadoBloqueado.numero}</div>
                  <div>Vence: {formatDate(estadoBloqueado.validade)}</div>
                  <div>Restam: {estadoBloqueado.diasRestantes} dias</div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      
      {isChecking && (
        <div className="text-sm text-blue-600 flex items-center gap-2">
          <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
          Verificando licenças vigentes...
        </div>
      )}
      
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
            <div className="mt-2 text-xs">
              Estados só podem ser renovados quando restam 60 dias ou menos para o vencimento.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}