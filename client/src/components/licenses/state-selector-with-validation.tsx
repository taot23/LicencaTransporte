import { useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { brazilianStates } from '@shared/schema';

interface StateSelectorProps {
  selectedStates: string[];
  onStatesChange: (states: string[]) => void;
  placas: string[];
}

export function StateSelectorWithValidation({ selectedStates, onStatesChange, placas }: StateSelectorProps) {
  const [validatingState, setValidatingState] = useState<string | null>(null);

  const validateState = async (estado: string): Promise<boolean> => {
    console.log(`[STATE VALIDATION] Validando ${estado} com placas:`, placas);
    
    if (!placas || placas.length === 0) {
      console.log(`[STATE VALIDATION] Nenhuma placa fornecida - liberando ${estado}`);
      return false;
    }

    setValidatingState(estado);

    try {
      const response = await fetch('/api/validacao-critica', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          estado,
          placas
        })
      });

      if (!response.ok) {
        console.error(`[STATE VALIDATION] Erro HTTP ${response.status} para ${estado}`);
        return false;
      }

      const result = await response.json();
      console.log(`[STATE VALIDATION] Resultado para ${estado}:`, result);

      if (result.bloqueado && result.diasRestantes > 60) {
        const mensagem = `
🚫 ESTADO ${estado} BLOQUEADO

Existe uma licença vigente com mais de 60 dias restantes:
📋 Número: ${result.numero}
📅 Válida até: ${new Date(result.validade).toLocaleDateString('pt-BR')}
⏰ Dias restantes: ${result.diasRestantes}
🚗 Placas: ${result.placasConflitantes?.join(', ')}

❌ Não é possível solicitar nova licença para este estado.
✅ Aguarde até 60 dias antes do vencimento para renovar.
        `.trim();

        alert(mensagem);
        console.log(`[STATE VALIDATION] ${estado} BLOQUEADO - ${result.diasRestantes} dias restantes`);
        return true;
      }

      console.log(`[STATE VALIDATION] ${estado} LIBERADO`);
      return false;

    } catch (error) {
      console.error(`[STATE VALIDATION] Erro ao validar ${estado}:`, error);
      return false;
    } finally {
      setValidatingState(null);
    }
  };

  const handleStateToggle = async (stateCode: string) => {
    console.log(`[HANDLE STATE CLICK] Clicando em ${stateCode}, validating: ${validatingState}`);
    
    if (validatingState) {
      console.log(`[HANDLE STATE CLICK] Validação em andamento para ${validatingState} - bloqueando`);
      return;
    }

    const isCurrentlySelected = selectedStates.includes(stateCode);
    
    if (isCurrentlySelected) {
      // Remover estado
      console.log(`[HANDLE STATE CLICK] Removendo estado ${stateCode}`);
      const newStates = selectedStates.filter(s => s !== stateCode);
      onStatesChange(newStates);
    } else {
      // Adicionar estado - validar primeiro
      console.log(`[HANDLE STATE CLICK] Adicionando estado ${stateCode} - iniciando validação`);
      
      const bloqueado = await validateState(stateCode);
      
      if (!bloqueado) {
        console.log(`[HANDLE STATE CLICK] Estado ${stateCode} liberado - adicionando`);
        const newStates = [...selectedStates, stateCode];
        onStatesChange(newStates);
      } else {
        console.log(`[HANDLE STATE CLICK] Estado ${stateCode} bloqueado - não adicionando`);
      }
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Estados de Circulação</h3>
        {validatingState && (
          <div className="text-sm text-blue-600 flex items-center gap-2">
            <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
            Validando {validatingState}...
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {brazilianStates.map((estado) => {
          const isSelected = selectedStates.includes(estado.code);
          const isValidatingThis = validatingState === estado.code;
          
          return (
            <div 
              key={estado.code}
              className={`
                flex items-center space-x-2 p-3 rounded-lg border cursor-pointer transition-all
                ${isSelected 
                  ? 'bg-blue-50 border-blue-300' 
                  : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                }
                ${isValidatingThis ? 'opacity-50' : ''}
              `}
              onClick={() => handleStateToggle(estado.code)}
            >
              <Checkbox 
                checked={isSelected}
                disabled={!!validatingState}
                onChange={() => {}}
              />
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-900">
                  {estado.code}
                </div>
                <div className="text-xs text-gray-600">{estado.name}</div>
              </div>
              {isValidatingThis && (
                <div className="text-blue-600">
                  <div className="animate-spin h-3 w-3 border border-blue-600 border-t-transparent rounded-full"></div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <div className="text-sm text-blue-800">
          <strong>💡 Dica:</strong> O sistema valida automaticamente se há licenças vigentes para evitar custos desnecessários.
          Estados com licenças válidas por mais de 60 dias serão bloqueados.
        </div>
      </div>
    </div>
  );
}