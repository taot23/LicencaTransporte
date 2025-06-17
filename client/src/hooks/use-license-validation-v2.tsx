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
      // Converter placas object para array de strings
      const placasArray = Object.values(placas).filter(Boolean);
      
      if (placasArray.length === 0) {
        return;
      }

      const response = await fetch('/api/licenses/check-existing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          states: [estado],
          plates: placasArray 
        }),
      });

      if (!response.ok) {
        throw new Error(`Erro na requisição: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.hasConflicts && data.conflicts) {
        // Encontrar o conflito específico para este estado
        const conflictoEstado = data.conflicts.find((c: any) => c.state === estado);
        
        if (conflictoEstado && conflictoEstado.daysUntilExpiry > 30) {
          setEstadosBloqueados((prev) => ({
            ...prev,
            [estado]: {
              numero: conflictoEstado.aetNumber || conflictoEstado.requestNumber,
              validade: conflictoEstado.validUntil,
              diasRestantes: conflictoEstado.daysUntilExpiry
            }
          }));
        } else {
          // Remover o estado dos bloqueados se estava bloqueado antes
          setEstadosBloqueados((prev) => {
            const updated = { ...prev };
            delete updated[estado];
            return updated;
          });
        }
      } else {
        // Remover o estado dos bloqueados se estava bloqueado antes
        setEstadosBloqueados((prev) => {
          const updated = { ...prev };
          delete updated[estado];
          return updated;
        });
      }
    } catch (error) {
      // Silencioso em caso de erro
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