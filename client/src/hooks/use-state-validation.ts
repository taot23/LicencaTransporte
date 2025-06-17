import { useState, useCallback } from 'react';

interface ValidationResult {
  bloqueado: boolean;
  numero?: string;
  validade?: string;
  diasRestantes?: number;
  placasConflitantes?: string[];
  error?: string;
}

export function useStateValidation() {
  const [validating, setValidating] = useState<string | null>(null);

  const validateState = useCallback(async (estado: string, placas: string[]): Promise<boolean> => {
    console.log(`[USE STATE VALIDATION] Iniciando validação para ${estado} com placas:`, placas);
    
    if (!placas || placas.length === 0) {
      console.log(`[USE STATE VALIDATION] Nenhuma placa fornecida - liberando ${estado}`);
      return false;
    }

    setValidating(estado);

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
        console.error(`[USE STATE VALIDATION] Erro HTTP ${response.status}`);
        throw new Error(`Erro HTTP: ${response.status}`);
      }

      const result: ValidationResult = await response.json();
      console.log(`[USE STATE VALIDATION] Resultado da validação para ${estado}:`, result);

      if (result.bloqueado) {
        const mensagem = `
🚫 ESTADO ${estado} BLOQUEADO

Existe uma licença vigente com mais de 60 dias restantes:
📋 Número: ${result.numero}
📅 Válida até: ${new Date(result.validade!).toLocaleDateString('pt-BR')}
⏰ Dias restantes: ${result.diasRestantes}
🚗 Placas: ${result.placasConflitantes?.join(', ')}

❌ Não é possível solicitar nova licença para este estado.
✅ Aguarde até 60 dias antes do vencimento para renovar.
        `.trim();

        alert(mensagem);
        console.log(`[USE STATE VALIDATION] ${estado} BLOQUEADO - ${result.diasRestantes} dias restantes`);
        return true;
      }

      console.log(`[USE STATE VALIDATION] ${estado} LIBERADO`);
      return false;

    } catch (error) {
      console.error(`[USE STATE VALIDATION] Erro na validação:`, error);
      alert(`Erro ao validar estado ${estado}. Tente novamente.`);
      return false;
    } finally {
      setValidating(null);
    }
  }, []);

  return {
    validateState,
    validating
  };
}