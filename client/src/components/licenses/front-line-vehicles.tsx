import React from 'react';
import { Vehicle } from "@shared/schema";
import { VehicleTypeImage } from "@/components/ui/vehicle-type-image";
import { VehicleSelectorPaginated } from "@/components/ui/vehicle-selector-paginated";

interface FrontLineVehiclesProps {
  licenseType: string;
  tractorUnitId?: number | null;
  firstTrailerId?: number | null;
  dollyId?: number | null;
  secondTrailerId?: number | null;
  // Placas manuais para os campos que permitem entrada manual
  firstTrailerManualPlate?: string | null;
  dollyManualPlate?: string | null;
  secondTrailerManualPlate?: string | null;
  vehicles: Vehicle[];
  isLoadingVehicles: boolean;
  onTractorChange: (id: number | null) => void;
  onFirstTrailerChange: (id: number | null) => void;
  onDollyChange: (id: number | null) => void;
  onSecondTrailerChange: (id: number | null) => void;
  // Handlers para placas manuais
  onFirstTrailerManualPlateChange?: (plate: string | null) => void;
  onDollyManualPlateChange?: (plate: string | null) => void;
  onSecondTrailerManualPlateChange?: (plate: string | null) => void;
  onCreateNewVehicle?: () => void;
}

export function FrontLineVehicles({
  licenseType,
  tractorUnitId,
  firstTrailerId,
  dollyId,
  secondTrailerId,
  firstTrailerManualPlate,
  dollyManualPlate,
  secondTrailerManualPlate,
  onTractorChange,
  onFirstTrailerChange,
  onDollyChange,
  onSecondTrailerChange,
  onFirstTrailerManualPlateChange,
  onDollyManualPlateChange,
  onSecondTrailerManualPlateChange,
  onCreateNewVehicle,
}: FrontLineVehiclesProps) {
  
  // Definir quais campos devem ser mostrados baseado no tipo de licença
  const showDolly = ['roadtrain_9_axles', 'dolly_only'].includes(licenseType);
  const showSecondTrailer = ['bitrain_6_axles', 'bitrain_7_axles', 'bitrain_9_axles', 'roadtrain_9_axles'].includes(licenseType);

  return (
    <div className="space-y-6">
      {/* Header com título e tipo de composição */}
      <div className="flex items-center gap-3 mb-4">
        <VehicleTypeImage type={licenseType} className="w-16 h-8" />
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            Composição Principal do {licenseType.includes('rodotrem') ? 'Rodotrem' : 
                                   licenseType.includes('bitrem') ? 'Bitrem' : 
                                   licenseType.includes('dolly') ? 'Conjunto com Dolly' : 
                                   licenseType.includes('flatbed') ? 'Conjunto com Prancha' : 'Conjunto'}
          </h3>
          <p className="text-sm text-gray-600">Configure os veículos que farão parte desta composição</p>
        </div>
      </div>

      {/* Unidade Tratora - SEMPRE obrigatória */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <VehicleSelectorPaginated
          vehicleType="tractor_unit"
          value={tractorUnitId || undefined}
          onSelect={(vehicleId) => onTractorChange(vehicleId || null)}
          label="Unidade Tratora (Cavalo Mecânico)"
          placeholder="Digite a placa ou busque o cavalo mecânico..."
          onCreateNew={onCreateNewVehicle}
        />
        <p className="text-xs text-gray-600 mt-2">Esta é a unidade principal que irá puxar o conjunto</p>
      </div>

      {/* 1ª Carreta - Aparece em todos os tipos exceto dolly_only */}
      {!['dolly_only'].includes(licenseType) && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <VehicleSelectorPaginated
            vehicleType={licenseType === 'flatbed' ? 'flatbed' : 'semi_trailer'}
            value={firstTrailerId || undefined}
            onSelect={(vehicleId, manualPlate) => {
              onFirstTrailerChange(vehicleId || null);
              if (onFirstTrailerManualPlateChange) {
                onFirstTrailerManualPlateChange(manualPlate || null);
              }
            }}
            label={licenseType === 'flatbed' ? 'Prancha' : '1ª Carreta'}
            placeholder={licenseType === 'flatbed' ? 'Digite a placa ou busque a prancha...' : 'Digite a placa ou busque a 1ª carreta...'}
            allowManualEntry={!licenseType.includes('flatbed')}
            onCreateNew={onCreateNewVehicle}
          />
          <p className="text-xs text-gray-600 mt-2">
            {licenseType === 'flatbed' ? 'Prancha que transportará a carga' : 'Primeiro semirreboque da composição'}
          </p>
        </div>
      )}

      {/* Dolly - Aparece apenas quando necessário */}
      {showDolly && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <VehicleSelectorPaginated
            vehicleType="dolly"
            value={dollyId || undefined}
            onSelect={(vehicleId, manualPlate) => {
              onDollyChange(vehicleId || null);
              if (onDollyManualPlateChange) {
                onDollyManualPlateChange(manualPlate || null);
              }
            }}
            label="Dolly"
            placeholder="Digite a placa ou busque o dolly..."
            allowManualEntry={true}
            onCreateNew={onCreateNewVehicle}
          />
          <p className="text-xs text-gray-600 mt-2">Equipamento de ligação entre carretas</p>
        </div>
      )}

      {/* 2ª Carreta - Aparece quando necessário */}
      {showSecondTrailer && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <VehicleSelectorPaginated
            vehicleType="trailer"
            value={secondTrailerId || undefined}
            onSelect={(vehicleId, manualPlate) => {
              onSecondTrailerChange(vehicleId || null);
              if (onSecondTrailerManualPlateChange) {
                onSecondTrailerManualPlateChange(manualPlate || null);
              }
            }}
            label="2ª Carreta"
            placeholder="Digite a placa ou busque a 2ª carreta..."
            allowManualEntry={true}
            onCreateNew={onCreateNewVehicle}
          />
          <p className="text-xs text-gray-600 mt-2">Segunda carreta da composição</p>
        </div>
      )}
    </div>
  );
}