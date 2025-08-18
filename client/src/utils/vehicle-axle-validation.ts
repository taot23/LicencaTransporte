import { LicenseType, Vehicle } from "@shared/schema";
import { VehicleSetType } from "@shared/vehicle-set-types";

export interface AxleConfiguration {
  tractorAxles: number;
  firstTrailerAxles: number;
  secondTrailerAxles: number;
  dollyAxles?: number;
  totalAxles: number;
  requiresDolly: boolean;
  isFlexible?: boolean;
}

// Configurações de eixos por tipo de licença (compatibilidade com tipos padrão)
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
    dollyAxles: 2,
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
    tractorAxles: 0, // Flexível - qualquer cavalo
    firstTrailerAxles: 0, // Flexível - qualquer prancha
    secondTrailerAxles: 0,
    totalAxles: 0, // Sem restrição específica
    requiresDolly: false
  },
  "romeo_and_juliet": {
    tractorAxles: 0, // Flexível - qualquer cavalo
    firstTrailerAxles: 0, // Flexível - qualquer semirreboque
    secondTrailerAxles: 0,
    totalAxles: 0, // Sem restrição específica
    requiresDolly: false
  }
};

export interface VehicleValidationResult {
  isValid: boolean;
  error?: string;
  warning?: string;
}

// Função para buscar configuração de eixos (dinâmica ou estática)
export function getAxleConfiguration(licenseType: string, vehicleSetTypes?: VehicleSetType[]): AxleConfiguration | null {
  // Primeiro, tentar buscar nos tipos dinâmicos
  if (vehicleSetTypes) {
    const dynamicType = vehicleSetTypes.find(type => type.name === licenseType);
    if (dynamicType) {
      return {
        tractorAxles: dynamicType.axleConfiguration.tractorAxles,
        firstTrailerAxles: dynamicType.axleConfiguration.firstTrailerAxles,
        secondTrailerAxles: dynamicType.axleConfiguration.secondTrailerAxles,
        dollyAxles: dynamicType.axleConfiguration.dollyAxles,
        totalAxles: dynamicType.axleConfiguration.totalAxles,
        requiresDolly: dynamicType.axleConfiguration.requiresDolly,
        isFlexible: dynamicType.axleConfiguration.isFlexible,
      };
    }
  }
  
  // Fallback para configurações estáticas (tipos padrão)
  return AXLE_CONFIGURATIONS[licenseType as LicenseType] || null;
}

// Validar se um veículo é compatível com uma posição específica na composição
export function validateVehicleForPosition(
  vehicle: Vehicle,
  position: 'tractor' | 'firstTrailer' | 'secondTrailer' | 'dolly',
  licenseType: LicenseType | string,
  vehicleSetTypes?: VehicleSetType[]
): VehicleValidationResult {
  const config = getAxleConfiguration(licenseType, vehicleSetTypes);
  
  if (!config) {
    return {
      isValid: false,
      error: "Configuração de tipo de licença não encontrada"
    };
  }
  
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
      expectedAxles = config.dollyAxles || 2;
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

  // REGRAS ESPECÍFICAS CRÍTICAS POR TIPO DE LICENÇA
  
  // TIPOS FLEXÍVEIS: SEM restrições de eixos 
  if (config?.isFlexible || licenseType === 'flatbed' || licenseType === 'romeo_and_juliet') {
    // Para tipos flexíveis, apenas verificar o tipo de veículo, não os eixos
    return { isValid: true };
  }
  
  // BITREM 7 EIXOS: Apenas semirreboques de 2 eixos
  if (licenseType === 'bitrain_7_axles' && (position === 'firstTrailer' || position === 'secondTrailer')) {
    if (vehicle.axleCount !== 2) {
      return {
        isValid: false,
        error: `⚠️ BITREM 7 EIXOS: Este semirreboque possui ${vehicle.axleCount} eixos. Para Bitrem 7 eixos são aceitos APENAS semirreboques de 2 eixos.`
      };
    }
  }
  
  // BITREM 6 EIXOS: Apenas semirreboques de 2 eixos
  if (licenseType === 'bitrain_6_axles' && (position === 'firstTrailer' || position === 'secondTrailer')) {
    if (vehicle.axleCount !== 2) {
      return {
        isValid: false,
        error: `⚠️ BITREM 6 EIXOS: Este semirreboque possui ${vehicle.axleCount} eixos. Para Bitrem 6 eixos são aceitos APENAS semirreboques de 2 eixos.`
      };
    }
  }
  
  // BITREM 9 EIXOS: Apenas semirreboques de 3 eixos
  if (licenseType === 'bitrain_9_axles' && (position === 'firstTrailer' || position === 'secondTrailer')) {
    if (vehicle.axleCount !== 3) {
      return {
        isValid: false,
        error: `⚠️ BITREM 9 EIXOS: Este semirreboque possui ${vehicle.axleCount} eixos. Para Bitrem 9 eixos são aceitos APENAS semirreboques de 3 eixos.`
      };
    }
  }
  
  // RODOTREM 9 EIXOS: Apenas semirreboques de 2 eixos
  if (licenseType === 'roadtrain_9_axles' && (position === 'firstTrailer' || position === 'secondTrailer')) {
    if (vehicle.axleCount !== 2) {
      return {
        isValid: false,
        error: `⚠️ RODOTREM 9 EIXOS: Este semirreboque possui ${vehicle.axleCount} eixos. Para Rodotrem 9 eixos são aceitos APENAS semirreboques de 2 eixos.`
      };
    }
  }
  
  // Verificar quantidade de eixos (regra geral) - pular se for 0 (flexível)
  if (expectedAxles > 0 && vehicle.axleCount !== expectedAxles) {
    return {
      isValid: false,
      error: `Este veículo possui ${vehicle.axleCount} eixos, mas para ${getLicenseTypeLabel(licenseType)} é necessário ${expectedAxles} eixos nesta posição`
    };
  }

  return { isValid: true };
}

// Validar a composição completa
export function validateCompleteComposition(
  licenseType: LicenseType | string,
  tractor?: Vehicle,
  firstTrailer?: Vehicle,
  secondTrailer?: Vehicle,
  dolly?: Vehicle,
  vehicleSetTypes?: VehicleSetType[]
): VehicleValidationResult {
  const config = getAxleConfiguration(licenseType, vehicleSetTypes);
  
  if (!config) {
    return {
      isValid: false,
      error: "Configuração de tipo de licença não encontrada"
    };
  }
  
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
  licenseType: LicenseType | string,
  vehicleSetTypes?: VehicleSetType[]
): Vehicle[] {
  const config = getAxleConfiguration(licenseType, vehicleSetTypes);
  
  if (!config) {
    return [];
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
      expectedAxles = config.dollyAxles || 2;
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

export function getLicenseTypeLabel(type: LicenseType | string): string {
  const labels: Record<string, string> = {
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
export function getAxleSpecificationSummary(licenseType: LicenseType | string, vehicleSetTypes?: VehicleSetType[]): string {
  const config = getAxleConfiguration(licenseType, vehicleSetTypes);
  
  if (!config) {
    return `Tipo de licença não encontrado: ${licenseType}`;
  }
  
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