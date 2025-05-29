import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Building2, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

interface TransporterWithSubsidiariesProps {
  transporterId: number;
  compact?: boolean;
}

interface Subsidiary {
  name: string;
  documentNumber: string;
  city: string;
  state: string;
  isActive?: boolean;
}

interface TransporterData {
  id: number;
  name: string;
  tradeName?: string;
  documentNumber: string;
  city: string;
  state: string;
  subsidiaries: Subsidiary[];
}

export function TransporterWithSubsidiaries({ transporterId, compact = false }: TransporterWithSubsidiariesProps) {
  const { data: transporter, isLoading } = useQuery<TransporterData>({
    queryKey: [`/api/public/transporters/${transporterId}`],
    enabled: !!transporterId,
  });

  if (isLoading) {
    return <div className="text-sm text-gray-500">Carregando...</div>;
  }

  if (!transporter) {
    return <div className="text-sm text-gray-500">Transportador não encontrado</div>;
  }

  const subsidiaries = Array.isArray(transporter.subsidiaries) ? transporter.subsidiaries : [];
  const hasSubsidiaries = subsidiaries.length > 0;

  // Formato compacto (para tabelas)
  if (compact) {
    if (!hasSubsidiaries) {
      return (
        <div className="text-sm">
          <div className="font-medium text-gray-900 truncate max-w-[200px]" title={transporter.tradeName || transporter.name}>
            {transporter.tradeName || transporter.name}
          </div>
          <div className="text-xs text-gray-500 flex items-center">
            <MapPin className="h-3 w-3 mr-1" />
            {transporter.city}/{transporter.state}
          </div>
        </div>
      );
    }

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-auto p-1 justify-start text-left">
            <div className="text-sm">
              <div className="font-medium text-gray-900 truncate max-w-[180px] flex items-center" title={transporter.tradeName || transporter.name}>
                <Building2 className="h-3 w-3 mr-1 text-blue-600" />
                {transporter.tradeName || transporter.name}
                <ChevronDown className="h-3 w-3 ml-1" />
              </div>
              <div className="text-xs text-gray-500 flex items-center">
                <MapPin className="h-3 w-3 mr-1" />
                {transporter.city}/{transporter.state}
                {hasSubsidiaries && (
                  <span className="ml-1 text-blue-600">
                    +{subsidiaries.length} filial{subsidiaries.length > 1 ? 'is' : ''}
                  </span>
                )}
              </div>
            </div>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-80">
          <DropdownMenuItem className="flex-col items-start p-3 cursor-default">
            <div className="font-medium text-gray-900 flex items-center">
              <Building2 className="h-4 w-4 mr-2 text-blue-600" />
              Matriz
            </div>
            <div className="text-sm text-gray-700 mt-1">
              {transporter.tradeName || transporter.name}
            </div>
            <div className="text-xs text-gray-500 mt-1 flex items-center">
              <MapPin className="h-3 w-3 mr-1" />
              {transporter.city}/{transporter.state}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              CNPJ: {transporter.documentNumber}
            </div>
          </DropdownMenuItem>
          
          {hasSubsidiaries && (
            <>
              <DropdownMenuSeparator />
              <div className="px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">
                Filiais ({subsidiaries.length})
              </div>
              {subsidiaries.map((subsidiary, index) => (
                <DropdownMenuItem key={index} className="flex-col items-start p-3 cursor-default">
                  <div className="font-medium text-gray-800 flex items-center">
                    <Building2 className="h-4 w-4 mr-2 text-green-600" />
                    {subsidiary.name}
                  </div>
                  <div className="text-xs text-gray-500 mt-1 flex items-center">
                    <MapPin className="h-3 w-3 mr-1" />
                    {subsidiary.city}/{subsidiary.state}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    CNPJ: {subsidiary.documentNumber}
                  </div>
                </DropdownMenuItem>
              ))}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  // Formato expandido (para formulários e visualizações detalhadas)
  return (
    <div className="space-y-3">
      <div className="p-3 border border-gray-200 rounded-lg bg-blue-50">
        <div className="font-medium text-gray-900 flex items-center">
          <Building2 className="h-4 w-4 mr-2 text-blue-600" />
          Matriz
        </div>
        <div className="text-sm text-gray-700 mt-1">
          {transporter.tradeName || transporter.name}
        </div>
        <div className="text-xs text-gray-500 mt-1 flex items-center">
          <MapPin className="h-3 w-3 mr-1" />
          {transporter.city}/{transporter.state}
        </div>
        <div className="text-xs text-gray-500 mt-1">
          CNPJ: {transporter.documentNumber}
        </div>
      </div>

      {hasSubsidiaries && (
        <div className="space-y-2">
          <div className="text-sm font-medium text-gray-700">
            Filiais ({subsidiaries.length})
          </div>
          {subsidiaries.map((subsidiary, index) => (
            <div key={index} className="p-3 border border-gray-200 rounded-lg bg-green-50">
              <div className="font-medium text-gray-800 flex items-center">
                <Building2 className="h-4 w-4 mr-2 text-green-600" />
                {subsidiary.name}
              </div>
              <div className="text-xs text-gray-500 mt-1 flex items-center">
                <MapPin className="h-3 w-3 mr-1" />
                {subsidiary.city}/{subsidiary.state}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                CNPJ: {subsidiary.documentNumber}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}