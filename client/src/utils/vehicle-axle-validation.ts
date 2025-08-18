import { LicenseType, Vehicle } from "@shared/schema";

export interface AxleConfiguration {
  tractorAxles: number;
  firstTrailerAxles: number;
  secondTrailerAxles: number;
  dollyAxles?: number;
  totalAxles: number;
  requiresDolly: boolean;
}

// Configurações de eixos por tipo de licença
export const AXLE_CONFIGURATIONS: Record<LicenseType, AxleConfiguration> = {
  "bitrain_9_axles": {
    tractorAxles: 3,
    firstTrailerAxles: 3,
    secondTrailerAxles: 3,
    totalAxles: 9,
    requiresDolly: false
  },
  "roadtrain_9_axles": {
    tractorAxles: 3,
    firstTrailerAxles: 2,
    secondTrailerAxles: 2,
    dollyAxles: 1,
    totalAxles: 9,
    requiresDolly: true
  },
  "bitrain_7_axles": {
    tractorAxles: 3,
    firstTrailerAxles: 2,
    secondTrailerAxles: 2,
    totalAxles: 7,
    requiresDolly: false
  },
  "bitrain_6_axles": {
    tractorAxles: 2,
    firstTrailerAxles: 2,
    secondTrailerAxles: 2,
    totalAxles: 6,
    requiresDolly: false
  },
  "flatbed": {
    tractorAxles: 3,
    firstTrailerAxles: 3,
    secondTrailerAxles: 0,
    totalAxles: 6,
    requiresDolly: false
  },
  "romeo_and_juliet": {
    tractorAxles: 3,
    firstTrailerAxles: 3,
    secondTrailerAxles: 0,
    totalAxles: 6,
    requiresDolly: false
  }
};

export interface VehicleValidationResult {
  isValid: boolean;
  error?: string;
  warning?: string;
}

// Validar se um veículo é compatível com uma posição específica na composição
export function validateVehicleForPosition(
  vehicle: Vehicle,
  position: 'tractor' | 'firstTrailer' | 'secondTrailer' | 'dolly',
  licenseType: LicenseType
): VehicleValidationResult {
  const config = AXLE_CONFIGURATIONS[licenseType];
  
  if (!vehicle.axleCount) {
    return {
      isValid: false,
      error: "Veículo não possui informação de quantidade de eixos cadastrada"
    };
  }

  let expectedAxles: number;
  let expectedType: string;
  
  switch (position) {
    case 'tractor':
      expectedAxles = config.tractorAxles;
      expectedType = 'tractor_unit';
      break;
    case 'firstTrailer':
      expectedAxles = config.firstTrailerAxles;
      expectedType = 'semi_trailer';
      break;
    case 'secondTrailer':
      expectedAxles = config.secondTrailerAxles;
      expectedType = 'semi_trailer';
      break;
    case 'dolly':
      expectedAxles = config.dollyAxles || 1;
      expectedType = 'dolly';
      break;
    default:
      return { isValid: false, error: "Posição inválida" };
  }

  // Verificar tipo de veículo
  if (vehicle.type !== expectedType) {
    return {
      isValid: false,
      error: `Este veículo é do tipo "${getVehicleTypeLabel(vehicle.type)}", mas para esta posição é necessário "${getVehicleTypeLabel(expectedType)}"`
    };
  }

  // Verificar quantidade de eixos
  if (vehicle.axleCount !== expectedAxles) {
    return {
      isValid: false,
      error: `Este veículo possui ${vehicle.axleCount} eixos, mas para ${getLicenseTypeLabel(licenseType)} é necessário ${expectedAxles} eixos nesta posição`
    };
  }

  return { isValid: true };
}

// Validar a composição completa
export function validateCompleteComposition(
  licenseType: LicenseType,
  tractor?: Vehicle,
  firstTrailer?: Vehicle,
  secondTrailer?: Vehicle,
  dolly?: Vehicle
): VehicleValidationResult {
  const config = AXLE_CONFIGURATIONS[licenseType];
  
  // Verificar se o dolly é obrigatório
  if (config.requiresDolly && !dolly) {
    return {
      isValid: false,
      error: `Para ${getLicenseTypeLabel(licenseType)} é obrigatório selecionar um dolly`
    };
  }

  // Verificar se o dolly não deve ser usado
  if (!config.requiresDolly && dolly) {
    return {
      isValid: false,
      error: `Para ${getLicenseTypeLabel(licenseType)} não é necessário dolly`
    };
  }

  // Calcular total de eixos da composição
  let totalAxles = 0;
  
  if (tractor) totalAxles += tractor.axleCount || 0;
  if (firstTrailer) totalAxles += firstTrailer.axleCount || 0;
  if (secondTrailer) totalAxles += secondTrailer.axleCount || 0;
  if (dolly) totalAxles += dolly.axleCount || 0;

  if (totalAxles !== config.totalAxles) {
    return {
      isValid: false,
      error: `A composição atual possui ${totalAxles} eixos, mas ${getLicenseTypeLabel(licenseType)} requer exatamente ${config.totalAxles} eixos`
    };
  }

  return { isValid: true };
}

// Filtrar veículos compatíveis para uma posição específica
export function filterVehiclesForPosition(
  vehicles: Vehicle[],
  position: 'tractor' | 'firstTrailer' | 'secondTrailer' | 'dolly',
  licenseType: LicenseType
): Vehicle[] {
  const config = AXLE_CONFIGURATIONS[licenseType];
  
  let expectedAxles: number;
  let expectedType: string;
  
  switch (position) {
    case 'tractor':
      expectedAxles = config.tractorAxles;
      expectedType = 'tractor_unit';
      break;
    case 'firstTrailer':
      expectedAxles = config.firstTrailerAxles;
      expectedType = 'semi_trailer';
      break;
    case 'secondTrailer':
      expectedAxles = config.secondTrailerAxles;
      expectedType = 'semi_trailer';
      break;
    case 'dolly':
      expectedAxles = config.dollyAxles || 1;
      expectedType = 'dolly';
      break;
    default:
      return [];
  }

  return vehicles.filter(vehicle => 
    vehicle.type === expectedType && 
    vehicle.axleCount === expectedAxles &&
    vehicle.status === 'active'
  );
}

// Labels para exibição
function getVehicleTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    'tractor_unit': 'Unidade Tratora',
    'semi_trailer': 'Semirreboque',
    'trailer': 'Reboque',
    'dolly': 'Dolly',
    'truck': 'Caminhão',
    'flatbed': 'Prancha'
  };
  return labels[type] || type;
}

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

// Obter resumo das especificações para um tipo de licença
export function getAxleSpecificationSummary(licenseType: LicenseType): string {
  const config = AXLE_CONFIGURATIONS[licenseType];
  
  let summary = `${getLicenseTypeLabel(licenseType)}:\n`;
  summary += `• Cavalo: ${config.tractorAxles} eixos\n`;
  summary += `• 1ª Carreta: ${config.firstTrailerAxles} eixos\n`;
  
  if (config.secondTrailerAxles > 0) {
    summary += `• 2ª Carreta: ${config.secondTrailerAxles} eixos\n`;
  }
  
  if (config.requiresDolly) {
    summary += `• Dolly: ${config.dollyAxles} eixo(s)\n`;
  }
  
  summary += `• Total: ${config.totalAxles} eixos`;
  
  return summary;
}