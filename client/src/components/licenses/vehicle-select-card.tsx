import React from 'react';
import { Button } from "@/components/ui/button";
import { 
  Truck, FileText, Check, AlertTriangle, 
  ArrowRight, Settings, PlusCircle, Edit
} from "lucide-react";
import { Vehicle } from "@shared/schema";
import { SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface VehicleSelectCardProps {
  title: string;
  description?: string;
  value: number | null | undefined;
  vehicleOptions: Vehicle[];
  isLoading: boolean;
  onChange: (value: number) => void;
  onAdd?: () => void;
  onEdit?: (vehicle: Vehicle) => void;
  requiredForProgress?: boolean;
  vehicleType: string;
  disabled?: boolean;
}

// Função para obter o ícone apropriado para o tipo de veículo
const getVehicleIcon = (type: string) => {
  switch (type) {
    case 'tractor_unit':
      return <Truck className="h-5 w-5 text-blue-600" />;
    case 'semi_trailer':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-600" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="8" width="18" height="10" rx="2" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="7" y1="8" x2="7" y2="18" />
        </svg>
      );
    case 'trailer':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-purple-600" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="7" width="16" height="10" rx="2" />
          <line x1="2" y1="12" x2="18" y2="12" />
          <line x1="6" y1="7" x2="6" y2="17" />
        </svg>
      );
    case 'dolly':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-orange-600" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="8" cy="16" r="3" />
          <circle cx="16" cy="16" r="3" />
          <rect x="2" y="8" width="20" height="4" />
          <line x1="6" y1="8" x2="6" y2="12" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="18" y1="8" x2="18" y2="12" />
        </svg>
      );
    case 'flatbed':
      return <FileText className="h-5 w-5 text-gray-600" />;
    default:
      return <Settings className="h-5 w-5 text-gray-400" />;
  }
};

export function VehicleSelectCard({
  title,
  description,
  value,
  vehicleOptions,
  isLoading,
  onChange,
  onAdd,
  onEdit,
  requiredForProgress = false,
  vehicleType,
  disabled = false
}: VehicleSelectCardProps) {
  // Encontrar o veículo selecionado
  const selectedVehicle = vehicleOptions.find(v => v.id === value);

  // Estado de preenchimento
  const isFilled = !!selectedVehicle;
  
  return (
    <Card className={`border ${
      isFilled 
        ? 'border-green-200' 
        : requiredForProgress 
          ? 'border-amber-200' 
          : 'border-gray-200'
    } ${disabled ? 'opacity-70' : ''}`}>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            {getVehicleIcon(vehicleType)}
            <CardTitle className="text-base">{title}</CardTitle>
            
            {/* Badge de status */}
            {requiredForProgress && !isFilled && (
              <Badge variant="outline" className="bg-red-100 text-red-800 border-red-200 px-2 text-xs flex items-center gap-1 h-6 animate-pulse">
                <AlertTriangle className="h-3 w-3" />
                OBRIGATÓRIO
              </Badge>
            )}
            
            {isFilled && (
              <Badge variant="outline" className="bg-green-100 text-green-800 border-green-200 px-2 text-xs flex items-center gap-1 h-6">
                <Check className="h-3 w-3" />
                Selecionado
              </Badge>
            )}
          </div>
          
          {/* Botões de ação principais */}
          <div className="flex items-center gap-1">
            {onAdd && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onAdd}
                className="h-8 w-8 p-0"
                disabled={disabled}
              >
                <PlusCircle className="h-4 w-4" />
              </Button>
            )}
            
            {selectedVehicle && onEdit && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onEdit(selectedVehicle)}
                className="h-8 w-8 p-0 text-gray-500 hover:text-blue-600"
                disabled={disabled}
              >
                <Edit className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
        
        {description && (
          <CardDescription>{description}</CardDescription>
        )}
      </CardHeader>
      
      <CardContent className="pt-0">
        {/* Seleção de veículo */}
        {!selectedVehicle ? (
          <div 
            className={`flex flex-col p-3 rounded-md ${
              requiredForProgress 
                ? 'bg-amber-50 border border-amber-100 text-amber-700'
                : 'bg-gray-50 border border-gray-100 text-gray-700'
            }`}
          >
            {vehicleOptions.length === 0 ? (
              <div className="text-center py-2">
                <p className="text-sm font-medium mb-2">Nenhum veículo disponível</p>
                {onAdd && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={onAdd}
                    className="bg-white"
                    disabled={disabled}
                  >
                    <PlusCircle className="h-4 w-4 mr-1" />
                    Cadastrar Novo
                  </Button>
                )}
              </div>
            ) : (
              <>
                <p className="text-sm mb-2">Selecione um veículo:</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {vehicleOptions.map(vehicle => (
                    <Button
                      key={vehicle.id}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onChange(vehicle.id)}
                      className="justify-start bg-white text-left px-3 py-2 h-auto"
                      disabled={disabled}
                    >
                      <div className="flex items-center gap-2 w-full">
                        {getVehicleIcon(vehicle.type)}
                        <div className="overflow-hidden">
                          <div className="font-medium truncate">{vehicle.plate}</div>
                          <div className="text-xs text-gray-500 truncate">
                            {vehicle.brand} {vehicle.model}
                          </div>
                        </div>
                      </div>
                    </Button>
                  ))}
                </div>
              </>
            )}
          </div>
        ) : (
          // Mostrar detalhes do veículo selecionado
          <div className="bg-green-50 border border-green-100 rounded-md p-3">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-2">
                {getVehicleIcon(selectedVehicle.type)}
                <div>
                  <div className="font-medium text-green-800">{selectedVehicle.plate}</div>
                  <div className="text-xs text-green-600">
                    {selectedVehicle.brand} {selectedVehicle.model}
                  </div>
                  <div className="text-xs text-green-500 mt-1">
                    {selectedVehicle.year} • {selectedVehicle.renavam?.slice(-6) || 'N/A'}
                  </div>
                </div>
              </div>
              
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onChange(0)}
                className="text-red-500 hover:text-red-600 h-6 w-6 p-0"
                disabled={disabled}
                title="Remover seleção"
              >
                ×
              </Button>
            </div>
          </div>
        )}
        
        {/* Indicador de progresso para campos obrigatórios */}
        {requiredForProgress && (
          <div className="mt-3 flex justify-between items-center">
            <div 
              className={`text-xs ${
                isFilled 
                  ? 'text-green-600' 
                  : 'text-amber-600'
              }`}
            >
              {isFilled 
                ? 'Veículo selecionado com sucesso!' 
                : 'Selecione um veículo para continuar'}
            </div>
            
            {isFilled && (
              <div className="flex items-center text-green-600 text-xs">
                Avanço disponível
                <ArrowRight className="h-3 w-3 ml-1" />
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}