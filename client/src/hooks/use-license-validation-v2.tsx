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

export function useLicenseValidationV2() {
  const [estadosBloqueados, setEstadosBloqueados] = useState<Record<string, EstadoBloqueado>>({});
  const [isChecking, setIsChecking] = useState(false);

  const verificarEstadoComLicencaVigente = useCallback(async (estado: string, placas: Placas) => {
    if (!estado || !placas) return;

    setIsChecking(true);
    
    try {
      console.log(`[VALIDAÇÃO V2] Verificando estado ${estado} com placas:`, placas);
      
      const response = await fetch('/api/licencas-vigentes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ estado, placas }),
      });

      if (!response.ok) {
        throw new Error(`Erro na requisição: ${response.status}`);
      }

      const licenca: LicencaVigente | null = await response.json();

      if (licenca && licenca.diasRestantes > 30) {
        console.log(`[VALIDAÇÃO V2] Estado ${estado} bloqueado - licença vigente por ${licenca.diasRestantes} dias`);
        
        setEstadosBloqueados((prev) => ({
          ...prev,
          [estado]: {
            numero: licenca.numero_licenca,
            validade: licenca.data_validade,
            diasRestantes: licenca.diasRestantes
          }
        }));
      } else {
        console.log(`[VALIDAÇÃO V2] Estado ${estado} liberado`);
        
        // Remover o estado dos bloqueados se estava bloqueado antes
        setEstadosBloqueados((prev) => {
          const updated = { ...prev };
          delete updated[estado];
          return updated;
        });
      }
    } catch (error) {
      console.error(`[VALIDAÇÃO V2] Erro ao verificar estado ${estado}:`, error);
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
    isChecking,
    verificarEstadoComLicencaVigente,
    limparValidacao,
    diasRestantes,
    formatarData
  };
}