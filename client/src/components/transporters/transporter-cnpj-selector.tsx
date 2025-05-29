import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Building2, ChevronDown } from "lucide-react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface TransporterCnpjSelectorProps {
  transporterId: number;
  onCnpjSelect?: (cnpj: string, name: string) => void;
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

interface CnpjOption {
  value: string;
  label: string;
  type: "matriz" | "filial";
  location: string;
}

export function TransporterCnpjSelector({
  transporterId,
  onCnpjSelect,
}: TransporterCnpjSelectorProps) {
  const [selectedCnpj, setSelectedCnpj] = useState<string>("");

  const { data: transporter, isLoading } = useQuery<TransporterData>({
    queryKey: [`/api/public/transporters/${transporterId}`],
    enabled: !!transporterId,
  });

  if (isLoading) {
    return (
      <div className="mb-4">
        <Label className="text-sm font-medium text-gray-700 mb-2 block">
          CNPJ Cadastrado
        </Label>
        <div className="text-sm text-gray-500 p-3 border border-gray-200 rounded-lg">
          Carregando CNPJs...
        </div>
      </div>
    );
  }

  if (!transporter) {
    return (
      <div className="mb-4">
        <Label className="text-sm font-medium text-gray-700 mb-2 block">
          CNPJ Cadastrado
        </Label>
        <div className="text-sm text-gray-500 p-3 border border-gray-200 rounded-lg">
          Transportador não encontrado
        </div>
      </div>
    );
  }

  // Construir lista de opções de CNPJ
  const cnpjOptions: CnpjOption[] = [];

  // Adicionar matriz
  cnpjOptions.push({
    value: transporter.documentNumber,
    label: `${transporter.tradeName || transporter.name} - ${transporter.documentNumber}`,
    type: "matriz",
    location: `${transporter.city}/${transporter.state}`,
  });

  // Adicionar filiais
  const subsidiaries = Array.isArray(transporter.subsidiaries)
    ? transporter.subsidiaries
    : [];
  subsidiaries.forEach((subsidiary) => {
    cnpjOptions.push({
      value: subsidiary.documentNumber,
      label: `${subsidiary.name} - ${subsidiary.documentNumber}`,
      type: "filial",
      location: `${subsidiary.city}/${subsidiary.state}`,
    });
  });

  const handleCnpjChange = (value: string) => {
    setSelectedCnpj(value);
    const selectedOption = cnpjOptions.find((option) => option.value === value);
    if (selectedOption && onCnpjSelect) {
      onCnpjSelect(value, selectedOption.label);
    }
  };

  return (
    <div className="mb-4">
      <Label className="text-sm font-medium text-gray-700 mb-2 block">
        CNPJs da Empresa <span className="text-red-500">*</span>
      </Label>
      <Select value={selectedCnpj} onValueChange={handleCnpjChange}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Selecione um CNPJ cadastrado" />
        </SelectTrigger>
        <SelectContent>
          {cnpjOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              <div className="flex items-center space-x-2 w-full">
                <Building2
                  className={`h-4 w-4 ${option.type === "matriz" ? "text-blue-600" : "text-green-600"}`}
                />
                <div className="flex-1">
                  <div className="font-medium text-sm">
                    {option.type === "matriz" ? "(Matriz)" : "(Filial)"}{" "}
                    {option.label.split(" - ")[0]}
                  </div>
                  <div className="text-xs text-gray-500 flex items-center space-x-2">
                    <span>CNPJ: {option.value}</span>
                    <span>•</span>
                    <span>{option.location}</span>
                  </div>
                </div>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {selectedCnpj && (
        <div className="mt-2 text-xs text-gray-600">
          <div className="bg-blue-50 p-2 rounded border border-blue-200">
            <span className="font-medium">CNPJ Selecionado:</span>{" "}
            {selectedCnpj}
          </div>
        </div>
      )}

      {cnpjOptions.length === 0 && (
        <div className="text-sm text-gray-500 p-3 border border-gray-200 rounded-lg">
          Nenhum CNPJ encontrado para este transportador
        </div>
      )}
    </div>
  );
}
