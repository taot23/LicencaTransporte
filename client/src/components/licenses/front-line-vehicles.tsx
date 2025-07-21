import React, { useMemo, useCallback } from 'react';
import { Vehicle } from "@shared/schema";
import { FastVehicleSelector } from './fast-vehicle-selector';
import { EnhancedVehicleSelector } from './enhanced-vehicle-selector';
import { Badge } from "@/components/ui/badge";
import { Truck } from "lucide-react";
import { VehicleTypeImage } from "@/components/ui/vehicle-type-image";

interface FrontLineVehiclesProps {
  licenseType: string;
  tractorUnitId?: number | null;
  firstTrailerId?: number | null;
  dollyId?: number | null;
  secondTrailerId?: number | null;
  // Placas manuais para os campos que permitem entrada manual (mantidas para compatibilidade)
  dollyManualPlate?: string | null;
  secondTrailerManualPlate?: string | null;
  vehicles: Vehicle[];
  isLoadingVehicles: boolean;
  onTractorChange: (id: number | null) => void;
  onFirstTrailerChange: (id: number | null) => void;
  onDollyChange: (id: number | null) => void;
  onSecondTrailerChange: (id: number | null) => void;
  // Handlers para placas manuais (mantidos para compatibilidade)
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
  dollyManualPlate,
  secondTrailerManualPlate,
  vehicles,
  isLoadingVehicles,
  onTractorChange,
  onFirstTrailerChange,
  onDollyChange,
  onSecondTrailerChange,
  onDollyManualPlateChange,
  onSecondTrailerManualPlateChange,
  onCreateNewVehicle
}: FrontLineVehiclesProps) {
  
  // Memoizar veículos por tipo para evitar recomputação
  const vehiclesByType = useMemo(() => {
    if (!vehicles) return { tractorUnits: [], semiTrailers: [], trailers: [], dollies: [] };
    
    return {
      tractorUnits: vehicles.filter(v => v.type === 'tractor_unit'),
      semiTrailers: vehicles.filter(v => v.type === 'semi_trailer'),
      trailers: vehicles.filter(v => v.type === 'trailer'),
      dollies: vehicles.filter(v => v.type === 'dolly')
    };
  }, [vehicles]);

  // Verificar quais veículos já foram selecionados para evitar duplicação
  const selectedVehicleIds = useMemo(() => {
    const ids = new Set<number>();
    if (tractorUnitId) ids.add(tractorUnitId);
    if (firstTrailerId) ids.add(firstTrailerId);
    if (dollyId) ids.add(dollyId);
    if (secondTrailerId) ids.add(secondTrailerId);
    return ids;
  }, [tractorUnitId, firstTrailerId, dollyId, secondTrailerId]);

  // Filtrar veículos disponíveis (excluindo os já selecionados)
  const availableVehiclesByType = useMemo(() => ({
    tractorUnits: vehiclesByType.tractorUnits,
    semiTrailers: vehiclesByType.semiTrailers.filter(v => !selectedVehicleIds.has(v.id) || v.id === firstTrailerId),
    trailers: vehiclesByType.trailers.filter(v => !selectedVehicleIds.has(v.id) || v.id === firstTrailerId),
    dollies: vehiclesByType.dollies.filter(v => !selectedVehicleIds.has(v.id) || v.id === dollyId)
  }), [vehiclesByType, selectedVehicleIds, firstTrailerId, dollyId]);

  // Handlers otimizados
  const handleTractorChange = useCallback((id: number | null) => {
    onTractorChange(id);
  }, [onTractorChange]);

  const handleFirstTrailerChange = useCallback((id: number | null) => {
    onFirstTrailerChange(id);
  }, [onFirstTrailerChange]);

  const handleDollyChange = useCallback((id: number | null) => {
    onDollyChange(id);
  }, [onDollyChange]);

  const handleSecondTrailerChange = useCallback((id: number | null) => {
    onSecondTrailerChange(id);
  }, [onSecondTrailerChange]);

  // Determinar se precisa mostrar dolly e 2ª carreta baseado no tipo de licença
  const showDolly = licenseType.includes('dolly') || licenseType.includes('rodotrem');
  const showSecondTrailer = licenseType.includes('bitrem') || licenseType.includes('rodotrem');

  // Função para obter semirreboques/trailers para 1ª carreta
  const getFirstTrailerVehicles = () => {
    return [...availableVehiclesByType.semiTrailers, ...availableVehiclesByType.trailers];
  };

  // Função para obter semirreboques/trailers para 2ª carreta (mesma lógica da 1ª)
  const getSecondTrailerVehicles = () => {
    return vehiclesByType.semiTrailers
      .concat(vehiclesByType.trailers)
      .filter(v => !selectedVehicleIds.has(v.id) || v.id === secondTrailerId);
  };

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
        <FastVehicleSelector
          title="Unidade Tratora (Cavalo Mecânico)"
          description="Esta é a unidade principal que irá puxar o conjunto"
          placeholder="Selecione a unidade tratora"
          value={tractorUnitId || null}
          vehicleOptions={availableVehiclesByType.tractorUnits}
          onChange={handleTractorChange}
          onAdd={onCreateNewVehicle}
          isLoading={isLoadingVehicles}
          vehicleType="tractor_unit"
          colorTheme="blue"
          emptyMessage="Nenhum cavalo mecânico cadastrado"
        />
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
            {/* 1ª Carreta */}
            <div className="space-y-2">
              <FastVehicleSelector
                title="1ª Carreta"
                description="Primeiro semirreboque da composição"
                placeholder="Selecione a 1ª carreta"
                value={firstTrailerId || null}
                vehicleOptions={getFirstTrailerVehicles()}
                onChange={handleFirstTrailerChange}
                onAdd={onCreateNewVehicle}
                isLoading={isLoadingVehicles}
                vehicleType="mixed_trailer"
                colorTheme="green"
                emptyMessage="Nenhum semirreboque cadastrado"
              />
            </div>

            {/* Dolly - Somente para tipos que precisam */}
            {showDolly && (
              <div className="space-y-2">
                <FastVehicleSelector
                  title="Dolly"
                  description="Dispositivo de acoplamento"
                  placeholder="Digite a placa ou selecione o dolly"
                  value={dollyId || null}
                  vehicleOptions={availableVehiclesByType.dollies}
                  onChange={handleDollyChange}
                  onAdd={onCreateNewVehicle}
                  isLoading={isLoadingVehicles}
                  vehicleType="dolly"
                  colorTheme="amber"
                  emptyMessage="Nenhum dolly cadastrado"
                  allowManualInput={true}
                  manualPlate={dollyManualPlate}
                  onManualPlateChange={onDollyManualPlateChange}
                />
              </div>
            )}

            {/* 2ª Carreta - Somente para bitrem e rodotrem */}
            {showSecondTrailer && (
              <div className="space-y-2">
                <FastVehicleSelector
                  title="2ª Carreta"
                  description="Segundo semirreboque da composição"
                  placeholder="Digite a placa ou selecione a 2ª carreta"
                  value={secondTrailerId || null}
                  vehicleOptions={getSecondTrailerVehicles()}
                  onChange={handleSecondTrailerChange}
                  onAdd={onCreateNewVehicle}
                  isLoading={isLoadingVehicles}
                  vehicleType="mixed_trailer"
                  colorTheme="purple"
                  emptyMessage="Nenhum semirreboque cadastrado"
                  allowManualInput={true}
                  manualPlate={secondTrailerManualPlate}
                  onManualPlateChange={onSecondTrailerManualPlateChange}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Resumo da composição selecionada */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <h4 className="font-medium text-gray-900 mb-2">Composição selecionada:</h4>
        <div className="flex flex-wrap gap-2">
          <span className="text-sm text-gray-700">Veículos principais:</span>
          
          {tractorUnitId && (
            <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-200">
              <Truck className="h-3 w-3 mr-1" />
              Unidade Principal: {vehicles?.find(v => v.id === tractorUnitId)?.plate || tractorUnitId}
            </Badge>
          )}
          
          {firstTrailerId && (
            <Badge variant="outline" className="bg-green-100 text-green-800 border-green-200">
              1ª Carreta: {vehicles?.find(v => v.id === firstTrailerId)?.plate || firstTrailerId}
            </Badge>
          )}
          
          {(dollyId || dollyManualPlate) && (
            <Badge variant="outline" className="bg-orange-100 text-orange-800 border-orange-200">
              Dolly: {dollyId ? (vehicles?.find(v => v.id === dollyId)?.plate || dollyId) : dollyManualPlate}
              {dollyManualPlate && !dollyId && <span className="ml-1 text-xs">(manual)</span>}
            </Badge>
          )}
          
          {(secondTrailerId || secondTrailerManualPlate) && (
            <Badge variant="outline" className="bg-purple-100 text-purple-800 border-purple-200">
              2ª Carreta: {secondTrailerId ? (vehicles?.find(v => v.id === secondTrailerId)?.plate || secondTrailerId) : secondTrailerManualPlate}
              {secondTrailerManualPlate && !secondTrailerId && <span className="ml-1 text-xs">(manual)</span>}
            </Badge>
          )}
        </div>
        
        <p className="text-xs text-gray-600 mt-2">
          Total: {[tractorUnitId, firstTrailerId, dollyId, secondTrailerId].filter(Boolean).length} veículos
        </p>
      </div>
    </div>
  );
}