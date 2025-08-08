import React from 'react';
import { Vehicle } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Truck, Search } from "lucide-react";
import { VehicleTypeImage } from "@/components/ui/vehicle-type-image";

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
  firstTrailerManualPlate,
  dollyManualPlate,
  secondTrailerManualPlate,
  onFirstTrailerManualPlateChange,
  onDollyManualPlateChange,
  onSecondTrailerManualPlateChange,
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
                                   licenseType.includes('dolly') ? 'Conjunto com Dolly' : 'Conjunto'}
          </h3>
          <p className="text-sm text-gray-600">Esta é a unidade principal que irá puxar o conjunto</p>
        </div>
      </div>

      {/* Unidade Tratora - SEMPRE obrigatória */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-900">Unidade Tratora (Cavalo Mecânico)</label>
          <p className="text-xs text-gray-600">Esta é a unidade principal que irá puxar o conjunto</p>
          <div className="relative">
            <Input
              type="text"
              placeholder="Digite a placa da unidade tratora"
              className="pr-10"
              maxLength={8}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0"
            >
              <Search className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Seção dos componentes principais */}
      {(licenseType !== "simple") && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 space-y-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-4 h-4 rounded bg-orange-600 flex items-center justify-center">
              <span className="text-white text-xs font-bold">!</span>
            </div>
            <span className="text-sm font-medium text-orange-800">
              Linha de Frente (Componentes Principais)
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 1ª Carreta - SEMPRE MOSTRAR COMO INPUT DE TEXTO */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-900">1ª Carreta</label>
              <p className="text-xs text-gray-600">Primeiro semirreboque da composição</p>
              <div className="relative">
                <Input
                  type="text"
                  placeholder="Digite a placa da 1ª carreta"
                  className="pr-10"
                  maxLength={8}
                  value={firstTrailerManualPlate || ''}
                  onChange={(e) => onFirstTrailerManualPlateChange?.(e.target.value || null)}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0"
                >
                  <Search className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Dolly - SEMPRE MOSTRAR COMO INPUT DE TEXTO quando necessário */}
            {showDolly && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-900">Dolly</label>
                <p className="text-xs text-gray-600">Dispositivo de acoplamento</p>
                <div className="relative">
                  <Input
                    type="text"
                    placeholder="Digite a placa do dolly"
                    className="pr-10"
                    maxLength={8}
                    value={dollyManualPlate || ''}
                    onChange={(e) => onDollyManualPlateChange?.(e.target.value || null)}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0"
                  >
                    <Search className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* 2ª Carreta - SEMPRE MOSTRAR COMO INPUT DE TEXTO quando necessário */}
            {showSecondTrailer && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-900">2ª Carreta</label>
                <p className="text-xs text-gray-600">Segundo semirreboque da composição</p>
                <div className="relative">
                  <Input
                    type="text"
                    placeholder="Digite a placa da 2ª carreta"
                    className="pr-10"
                    maxLength={8}
                    value={secondTrailerManualPlate || ''}
                    onChange={(e) => onSecondTrailerManualPlateChange?.(e.target.value || null)}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0"
                  >
                    <Search className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Resumo da composição selecionada */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <h4 className="font-medium text-gray-900 mb-2">Composição selecionada:</h4>
        <div className="flex flex-wrap gap-2">
          <span className="text-sm text-gray-700">Placas digitadas:</span>
          
          {firstTrailerManualPlate && (
            <Badge variant="outline" className="bg-green-100 text-green-800 border-green-200">
              1ª Carreta: {firstTrailerManualPlate} (manual)
            </Badge>
          )}
          
          {dollyManualPlate && (
            <Badge variant="outline" className="bg-orange-100 text-orange-800 border-orange-200">
              Dolly: {dollyManualPlate} (manual)
            </Badge>
          )}
          
          {secondTrailerManualPlate && (
            <Badge variant="outline" className="bg-purple-100 text-purple-800 border-purple-200">
              2ª Carreta: {secondTrailerManualPlate} (manual)
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}