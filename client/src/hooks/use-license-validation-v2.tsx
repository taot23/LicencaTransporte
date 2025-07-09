import { useState, useCallback } from 'react';

interface Placas {
  cavalo?: string;
  primeiraCarreta?: string;
  segundaCarreta?: string;
  dolly?: string;
  prancha?: string;
  reboque?: string;
}

interface LicencaVigente {
  numero_licenca: string;
  data_validade: string;
  diasRestantes: number;
  bloqueado: boolean;
  placas: {
    tratora: string | null;
    primeira: string | null;
    segunda: string | null;
    dolly: string | null;
    prancha: string | null;
    reboque: string | null;
  };
}

interface EstadoBloqueado {
  numero: string;
  validade: string;
  diasRestantes: number;
}

interface ComposicaoVeicular {
  cavalo: string;
  carreta1: string;
  carreta2: string;
}

export function useLicenseValidationV2() {
  const [estadosBloqueados, setEstadosBloqueados] = useState<Record<string, EstadoBloqueado>>({});
  const [isChecking, setIsChecking] = useState(false);

  const verificarEstadoComLicencaVigente = useCallback(async (estado: string, placas: Placas, composicao?: ComposicaoVeicular): Promise<boolean> => {
    if (!estado || !placas) return false;

    setIsChecking(true);
    
    try {
      // Converter placas object para array de strings
      const placasArray = Object.values(placas).filter(Boolean);
      
      console.log(`[VALIDAÇÃO INTELIGENTE] Verificando estado: ${estado} com placas:`, placas);
      
      if (placasArray.length === 0) {
        console.log(`[VALIDAÇÃO INTELIGENTE] Nenhuma placa fornecida`);
        return false;
      }

      // ✅ NOVA LÓGICA: Validação por combinação específica
      let requestBody: any = {
        estado: estado,
        placas: placasArray
      };

      if (composicao && composicao.cavalo && composicao.carreta1 && composicao.carreta2) {
        console.log(`[VALIDAÇÃO COMBINAÇÃO] Usando validação por combinação específica:`, composicao);
        requestBody.composicao = composicao;
        
        // Usar endpoint de validação por combinação específica
        const response = await fetch('/api/licencas-vigentes-by-combination', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            estado: estado,
            composicao: composicao
          })
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[VALIDAÇÃO COMBINAÇÃO] Erro na requisição ${response.status}:`, errorText);
          return false;
        }

        const data = await response.json();
        console.log(`[VALIDAÇÃO COMBINAÇÃO] Resposta da API para ${estado}:`, data);
        
        if (data.bloqueado && data.diasRestantes > 60) {
          console.log(`[VALIDAÇÃO COMBINAÇÃO] Estado ${estado} BLOQUEADO: ${data.diasRestantes} dias > 60 - COMBINAÇÃO IDÊNTICA`);
          setEstadosBloqueados((prev) => ({
            ...prev,
            [estado]: {
              numero: data.numero_licenca,
              validade: data.data_validade,
              diasRestantes: data.diasRestantes
            }
          }));
          return true;
        }
        
        console.log(`[VALIDAÇÃO COMBINAÇÃO] Estado ${estado} LIBERADO - Combinação diferente ou dentro do prazo`);
        return false;
      }

      // VALIDAÇÃO TRADICIONAL: Consulta na tabela licencas_emitidas por placas individuais
      const response = await fetch('/api/licencas-vigentes-by-state', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[VALIDAÇÃO CRÍTICA] Erro na requisição ${response.status}:`, errorText);
        return false;
      }

      const data = await response.json();
      console.log(`[VALIDAÇÃO CRÍTICA] Resposta da API para ${estado}:`, data);
      
      // Nova lógica baseada no endpoint específico por estado
      if (data.bloqueado && data.diasRestantes > 60) {
        console.log(`[VALIDAÇÃO CRÍTICA] Estado ${estado} BLOQUEADO: ${data.diasRestantes} dias > 60 - EVITANDO CUSTO DESNECESSÁRIO`);
        setEstadosBloqueados((prev) => ({
          ...prev,
          [estado]: {
            numero: data.numero_licenca,
            validade: data.data_validade,
            diasRestantes: data.diasRestantes
          }
        }));
        return true; // Estado bloqueado
      }
      
      console.log(`[VALIDAÇÃO CRÍTICA] Estado ${estado} LIBERADO: ${data.bloqueado ? `${data.diasRestantes} dias ≤ 60` : 'sem licença vigente'}`);
      // Remover o estado dos bloqueados se estava bloqueado antes
      setEstadosBloqueados((prev) => {
        const updated = { ...prev };
        delete updated[estado];
        return updated;
      });
      return false; // Estado liberado
    } catch (error) {
      console.error('Erro na validação:', error);
      return false; // Em caso de erro, liberar
    } finally {
      setIsChecking(false);
    }
  }, []);

  const limparValidacao = useCallback(() => {
    setEstadosBloqueados({});
  }, []);

  const diasRestantes = useCallback((dataValidade: string): number => {
    const now = new Date();
    const validade = new Date(dataValidade);
    return Math.ceil((validade.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  }, []);

  const formatarData = useCallback((dataISO: string): string => {
    const data = new Date(dataISO);
    return data.toLocaleDateString('pt-BR');
  }, []);

  return {
    estadosBloqueados,
    setEstadosBloqueados,
    isChecking,
    verificarEstadoComLicencaVigente,
    limparValidacao,
    diasRestantes,
    formatarData
  };
}