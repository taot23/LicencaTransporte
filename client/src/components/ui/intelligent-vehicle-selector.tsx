import { useState, useEffect } from "react";
import { Vehicle, LicenseType } from "@shared/schema";
import { PaginatedVehicleSelector } from "@/components/ui/paginated-vehicle-selector";
import { 
  validateVehicleForPosition, 
  filterVehiclesForPosition,
  getAxleSpecificationSummary,
  AXLE_CONFIGURATIONS
} from "@/utils/vehicle-axle-validation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info, AlertTriangle, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface IntelligentVehicleSelectorProps {
  value?: number;
  onSelect: (vehicleId: number | undefined, plate?: string) => void;
  placeholder?: string;
  disabled?: boolean;
  allowManualEntry?: boolean;
  className?: string;
  label?: string;
  onCreateNew?: () => void;
  
  // Propriedades específicas para validação de eixos
  licenseType: LicenseType;
  position: 'tractor' | 'firstTrailer' | 'secondTrailer' | 'dolly';
  selectedVehicle?: Vehicle | null;
  
  // Para validação da composição completa
  tractorVehicle?: Vehicle | null;
  firstTrailerVehicle?: Vehicle | null;
  secondTrailerVehicle?: Vehicle | null;
  dollyVehicle?: Vehicle | null;
}

export function IntelligentVehicleSelector({
  value,
  onSelect,
  placeholder,
  disabled = false,
  allowManualEntry = false,
  className,
  label,
  onCreateNew,
  licenseType,
  position,
  selectedVehicle,
  tractorVehicle,
  firstTrailerVehicle,
  secondTrailerVehicle,
  dollyVehicle,
}: IntelligentVehicleSelectorProps) {
  const [validationResult, setValidationResult] = useState<{
    isValid: boolean;
    error?: string;
    warning?: string;
  } | null>(null);

  const config = AXLE_CONFIGURATIONS[licenseType];
  
  // Determinar o tipo de veículo e quantidade de eixos esperados
  const getExpectedSpecs = () => {
    switch (position) {
      case 'tractor':
        return { 
          axles: config.tractorAxles, 
          type: 'tractor_unit',
          typeLabel: 'Unidade Tratora' 
        };
      case 'firstTrailer':
        return { 
          axles: config.firstTrailerAxles, 
          type: 'semi_trailer',
          typeLabel: 'Semirreboque' 
        };
      case 'secondTrailer':
        return { 
          axles: config.secondTrailerAxles, 
          type: 'semi_trailer',
          typeLabel: 'Semirreboque' 
        };
      case 'dolly':
        return { 
          axles: config.dollyAxles || 1, 
          type: 'dolly',
          typeLabel: 'Dolly' 
        };
      default:
        return { axles: 0, type: '', typeLabel: '' };
    }
  };

  const expectedSpecs = getExpectedSpecs();

  // Validar veículo selecionado quando mudar
  useEffect(() => {
    if (selectedVehicle) {
      const result = validateVehicleForPosition(selectedVehicle, position, licenseType);
      setValidationResult(result);
    } else {
      setValidationResult(null);
    }
  }, [selectedVehicle, position, licenseType]);

  // Verificar se esta posição é obrigatória ou opcional
  const isPositionRequired = () => {
    switch (position) {
      case 'tractor':
      case 'firstTrailer':
        return true;
      case 'secondTrailer':
        return expectedSpecs.axles > 0; // Só é obrigatório se for maior que 0 eixos
      case 'dolly':
        return config.requiresDolly;
      default:
        return false;
    }
  };

  const isRequired = isPositionRequired();

  // Mensagem de ajuda baseada na configuração
  const getHelpMessage = () => {
    if (!isRequired) {
      return `Opcional para ${getLicenseTypeLabel(licenseType)}`;
    }
    
    return `Necessário: ${expectedSpecs.typeLabel} com ${expectedSpecs.axles} eixos`;
  };

  // Placeholder dinâmico baseado na configuração
  const dynamicPlaceholder = placeholder || 
    `Selecione ${expectedSpecs.typeLabel.toLowerCase()} (${expectedSpecs.axles} eixos)...`;

  return (
    <div className="space-y-2">
      {/* Seletor de veículo com filtro automático */}
      <PaginatedVehicleSelector
        value={value}
        onSelect={onSelect}
        placeholder={dynamicPlaceholder}
        disabled={disabled}
        allowManualEntry={allowManualEntry}
        className={cn(
          className,
          validationResult && !validationResult.isValid && "border-red-500"
        )}
        label={label}
        onCreateNew={onCreateNew}
        vehicleType={expectedSpecs.type as any}
        axleFilter={expectedSpecs.axles} // FILTRO CRÍTICO: Apenas veículos com eixos corretos
      />

      {/* Mensagem de ajuda */}
      <div className="text-xs text-gray-500">
        {getHelpMessage()}
      </div>

      {/* Resultado da validação */}
      {validationResult && !validationResult.isValid && (
        <Alert className="border-red-200 bg-red-50">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-700 text-sm">
            {validationResult.error}
          </AlertDescription>
        </Alert>
      )}

      {/* Aviso quando a posição não é obrigatória */}
      {!isRequired && (
        <Alert className="border-blue-200 bg-blue-50">
          <Info className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-700 text-sm">
            Esta posição é opcional para {getLicenseTypeLabel(licenseType)}
          </AlertDescription>
        </Alert>
      )}

      {/* Confirmação quando válido */}
      {validationResult && validationResult.isValid && selectedVehicle && (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-700 text-sm">
            ✓ {selectedVehicle.plate} - {selectedVehicle.axleCount} eixos - Compatível
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

// Helper function
function getLicenseTypeLabel(type: LicenseType): string {
  const labels: Record<LicenseType, string> = {
    'bitrain_9_axles': 'Bitrem 9 eixos',
    'roadtrain_9_axles': 'Rodotrem 9 eixos',
    'bitrain_7_axles': 'Bitrem 7 eixos',
    'bitrain_6_axles': 'Bitrem 6 eixos',
    'flatbed': 'Prancha',
    'romeo_and_juliet': 'Romeu e Julieta'
  };
  return labels[type] || type;
}