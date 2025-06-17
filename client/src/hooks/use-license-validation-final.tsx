import { useState, useCallback } from 'react';
import { apiRequest } from '@/lib/queryClient';

interface Placas {
  cavalo?: string;
  primeiraCarreta?: string;
  segundaCarreta?: string;
  dolly?: string;
  prancha?: string;
  reboque?: string;
}

interface LicencaConflito {
  estado: string;
  numero: string;
  validade: string;
  diasRestantes: number;
  placas: string[];
}

export function useLicenseValidationFinal() {
  const [estadosBloqueados, setEstadosBloqueados] = useState<Record<string, LicencaConflito>>({});
  const [isChecking, setIsChecking] = useState(false);

  const validarEstados = useCallback(async (estados: string[], placas: Placas): Promise<string[]> => {
    if (!estados || estados.length === 0 || !placas) {
      return [];
    }

    const placasArray = Object.values(placas).filter(Boolean);
    if (placasArray.length === 0) {
      return [];
    }

    console.log(`[VALIDAÇÃO FINAL] Verificando estados:`, estados, 'com placas:', placasArray);
    
    setIsChecking(true);
    const estadosLiberados: string[] = [];
    const novosEstadosBloqueados: Record<string, LicencaConflito> = {};

    try {
      // Verificar cada estado individualmente para robustez
      for (const estado of estados) {
        try {
          console.log(`[VALIDAÇÃO FINAL] Verificando estado: ${estado}`);
          
          // Usar consulta SQL direta via endpoint específico
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
            console.log(`[VALIDAÇÃO FINAL] Resposta para ${estado}:`, data);
            
            if (data.bloqueado && data.diasRestantes > 60) {
              console.log(`[VALIDAÇÃO FINAL] ${estado} BLOQUEADO: ${data.diasRestantes} dias > 60`);
              novosEstadosBloqueados[estado] = {
                estado: estado,
                numero: data.numero,
                validade: data.validade,
                diasRestantes: data.diasRestantes,
                placas: data.placasConflitantes || placasArray
              };
            } else {
              console.log(`[VALIDAÇÃO FINAL] ${estado} LIBERADO: ${data.diasRestantes || 0} dias ≤ 60`);
              estadosLiberados.push(estado);
            }
          } else {
            console.error(`[VALIDAÇÃO FINAL] Erro HTTP ${response.status} para ${estado}`);
            // Em caso de erro, liberar o estado (fail-safe)
            estadosLiberados.push(estado);
          }
        } catch (error) {
          console.error(`[VALIDAÇÃO FINAL] Erro ao verificar ${estado}:`, error);
          // Em caso de erro, liberar o estado (fail-safe)
          estadosLiberados.push(estado);
        }
      }

      // Atualizar estados bloqueados
      setEstadosBloqueados(novosEstadosBloqueados);
      
      console.log(`[VALIDAÇÃO FINAL] Resultado: ${estadosLiberados.length} liberados, ${Object.keys(novosEstadosBloqueados).length} bloqueados`);
      
      return estadosLiberados;
      
    } catch (error) {
      console.error('[VALIDAÇÃO FINAL] Erro geral:', error);
      // Em caso de erro geral, liberar todos os estados
      return estados;
    } finally {
      setIsChecking(false);
    }
  }, []);

  const getEstadosBloqueados = useCallback(() => {
    return estadosBloqueados;
  }, [estadosBloqueados]);

  const isEstadoBloqueado = useCallback((estado: string) => {
    return estadosBloqueados[estado] !== undefined;
  }, [estadosBloqueados]);

  const clearValidation = useCallback(() => {
    setEstadosBloqueados({});
  }, []);

  return {
    validarEstados,
    getEstadosBloqueados,
    isEstadoBloqueado,
    clearValidation,
    isChecking,
    estadosBloqueados
  };
}