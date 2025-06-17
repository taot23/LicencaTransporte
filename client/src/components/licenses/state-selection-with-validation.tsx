import { useState, useEffect } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, Clock } from 'lucide-react';
import { useLicenseValidationV2 } from '@/hooks/use-license-validation-v2';

interface Placas {
  cavalo?: string;
  primeiraCarreta?: string;
  segundaCarreta?: string;
  dolly?: string;
  prancha?: string;
  reboque?: string;
}

interface StateSelectionProps {
  selectedStates: string[];
  onStatesChange: (states: string[]) => void;
  placas: Placas;
  disabled?: boolean;
}

const BRAZILIAN_STATES = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 
  'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 
  'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
];

export function StateSelectionWithValidation({ 
  selectedStates, 
  onStatesChange, 
  placas, 
  disabled = false 
}: StateSelectionProps) {
  const { 
    estadosBloqueados, 
    isChecking, 
    verificarEstadoComLicencaVigente, 
    limparValidacao,
    formatarData 
  } = useLicenseValidationV2();

  const [pendingValidations, setPendingValidations] = useState<Set<string>>(new Set());

  // Limpar validações quando placas mudarem
  useEffect(() => {
    limparValidacao();
    setPendingValidations(new Set());
  }, [placas, limparValidacao]);

  // Validar estados selecionados quando placas mudarem
  useEffect(() => {
    if (selectedStates.length > 0 && Object.keys(placas).some(key => placas[key as keyof Placas])) {
      selectedStates.forEach(estado => {
        validarEstado(estado);
      });
    }
  }, [placas]);

  const validarEstado = async (estado: string) => {
    // Não validar se não temos placas suficientes
    if (!Object.keys(placas).some(key => placas[key as keyof Placas])) {
      return;
    }

    setPendingValidations(prev => new Set([...prev, estado]));
    
    try {
      await verificarEstadoComLicencaVigente(estado, placas);
    } finally {
      setPendingValidations(prev => {
        const updated = new Set(prev);
        updated.delete(estado);
        return updated;
      });
    }
  };

  const handleStateToggle = async (estado: string, checked: boolean) => {
    if (checked) {
      // Adicionar estado
      const newStates = [...selectedStates, estado];
      onStatesChange(newStates);
      
      // Validar o novo estado
      await validarEstado(estado);
    } else {
      // Remover estado
      const newStates = selectedStates.filter(s => s !== estado);
      onStatesChange(newStates);
    }
  };

  const isEstadoBloqueado = (estado: string) => {
    return estadosBloqueados[estado]?.diasRestantes > 30;
  };

  const getEstadoInfo = (estado: string) => {
    return estadosBloqueados[estado];
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span>Estados para Circulação</span>
          {(isChecking || pendingValidations.size > 0) && (
            <Clock className="h-4 w-4 animate-spin text-blue-500" />
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 md:grid-cols-6 lg:grid-cols-9 gap-4">
          {BRAZILIAN_STATES.map((estado) => {
            const bloqueado = isEstadoBloqueado(estado);
            const estadoInfo = getEstadoInfo(estado);
            const isValidating = pendingValidations.has(estado);
            const isSelected = selectedStates.includes(estado);

            return (
              <div
                key={estado}
                className={`
                  p-3 rounded-lg border transition-all duration-200
                  ${bloqueado 
                    ? 'border-yellow-400 bg-yellow-50 cursor-not-allowed' 
                    : 'border-gray-200 bg-white hover:border-blue-300'
                  }
                  ${isSelected && !bloqueado ? 'border-blue-500 bg-blue-50' : ''}
                  ${isValidating ? 'opacity-70' : ''}
                `}
              >
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id={`state-${estado}`}
                    checked={isSelected}
                    disabled={disabled || bloqueado || isValidating}
                    onCheckedChange={(checked) => handleStateToggle(estado, checked as boolean)}
                  />
                  <label 
                    htmlFor={`state-${estado}`}
                    className={`
                      text-sm font-medium cursor-pointer
                      ${bloqueado ? 'text-yellow-700' : 'text-gray-900'}
                      ${disabled || bloqueado ? 'cursor-not-allowed' : ''}
                    `}
                  >
                    {estado}
                  </label>
                  {bloqueado && (
                    <AlertTriangle className="h-3 w-3 text-yellow-600" />
                  )}
                  {isValidating && (
                    <Clock className="h-3 w-3 animate-spin text-blue-500" />
                  )}
                </div>
                
                {estadoInfo && bloqueado && (
                  <div className="mt-2 text-xs text-yellow-700">
                    <div className="font-semibold">Licença vigente até:</div>
                    <div>{formatarData(estadoInfo.validade)}</div>
                    <div className="text-yellow-600">
                      Nº {estadoInfo.numero}
                    </div>
                    <div className="text-yellow-600 mt-1">
                      {estadoInfo.diasRestantes} dias restantes
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        
        {Object.keys(estadosBloqueados).length > 0 && (
          <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="text-sm font-semibold text-yellow-800">
                  Estados com Licenças Vigentes
                </h4>
                <p className="text-sm text-yellow-700 mt-1">
                  Os estados marcados em amarelo possuem licenças vigentes com mais de 30 dias até o vencimento.
                  Você só pode solicitar uma nova licença quando restarem 30 dias ou menos.
                </p>
              </div>
            </div>
          </div>
        )}

        {selectedStates.length > 0 && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="text-sm text-blue-800">
              <strong>Estados selecionados:</strong> {selectedStates.join(', ')}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}