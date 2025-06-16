import { useState } from 'react';

interface LicenseConflict {
  state: string;
  licenseId: number;
  requestNumber: string;
  aetNumber: string;
  validUntil: string;
  daysUntilExpiry: number;
  conflictingPlates: string[];
  canRenew: boolean;
}

interface ValidationResponse {
  hasConflicts: boolean;
  conflicts: LicenseConflict[];
  message: string;
}

export function useLicenseValidation() {
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResponse | null>(null);

  const validateLicenses = async (states: string[], plates: string[]): Promise<ValidationResponse> => {
    setIsValidating(true);
    
    try {
      console.log(`[VALIDAÇÃO FRONTEND] Verificando estados: ${states.join(', ')} e placas: ${plates.join(', ')}`);
      
      const response = await fetch('/api/licenses/check-existing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          states,
          plates
        }),
      });

      if (!response.ok) {
        throw new Error(`Erro na validação: ${response.status}`);
      }

      const result: ValidationResponse = await response.json();
      
      console.log(`[VALIDAÇÃO FRONTEND] Resultado: ${result.hasConflicts ? 'CONFLITOS ENCONTRADOS' : 'SEM CONFLITOS'}`);
      console.log(`[VALIDAÇÃO FRONTEND] Total de conflitos: ${result.conflicts.length}`);
      
      setValidationResult(result);
      return result;
      
    } catch (error) {
      console.error('[VALIDAÇÃO FRONTEND] Erro ao validar licenças:', error);
      const errorResult: ValidationResponse = {
        hasConflicts: false,
        conflicts: [],
        message: `Erro ao verificar licenças existentes: ${error}`
      };
      setValidationResult(errorResult);
      return errorResult;
    } finally {
      setIsValidating(false);
    }
  };

  const clearValidation = () => {
    setValidationResult(null);
  };

  return {
    isValidating,
    validationResult,
    validateLicenses,
    clearValidation,
  };
}