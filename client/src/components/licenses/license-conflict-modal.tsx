import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Calendar, FileText, Truck } from "lucide-react";
import type { LicenseConflict } from "@/hooks/use-license-validation";

interface LicenseConflictModalProps {
  isOpen: boolean;
  onClose: () => void;
  conflicts: LicenseConflict[];
}

export function LicenseConflictModal({ isOpen, onClose, conflicts }: LicenseConflictModalProps) {
  if (!conflicts || conflicts.length === 0) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl" aria-describedby="conflict-description">
        <DialogHeader>
          <DialogTitle className="flex items-center text-amber-700">
            <AlertTriangle className="h-5 w-5 mr-2" />
            Atenção: Licenças Vigentes Encontradas
          </DialogTitle>
          <DialogDescription id="conflict-description">
            Foram encontradas licenças ativas que impedem a solicitação para os estados selecionados.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <p className="text-sm text-amber-800 mb-3">
              <strong>Regra do Sistema:</strong> Não é permitido solicitar nova licença para um estado quando já existe uma licença ativa com mais de 30 dias até o vencimento.
            </p>
          </div>

          <div className="space-y-3">
            {conflicts.map((conflict, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4 bg-white">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <Badge variant="outline" className="bg-red-50 border-red-200 text-red-800">
                      {conflict.estado}
                    </Badge>
                    <span className="text-sm font-medium text-gray-600">Estado Bloqueado</span>
                  </div>
                  <Badge variant="destructive" className="text-xs">
                    {conflict.licenca.diasRestantes} dias restantes
                  </Badge>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center space-x-2">
                    <FileText className="h-4 w-4 text-blue-600" />
                    <div>
                      <span className="text-gray-500">Licença:</span>
                      <span className="ml-1 font-medium">{conflict.licenca.requestNumber}</span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Calendar className="h-4 w-4 text-green-600" />
                    <div>
                      <span className="text-gray-500">Vencimento:</span>
                      <span className="ml-1 font-medium text-green-700">
                        {new Intl.DateTimeFormat('pt-BR').format(new Date(conflict.licenca.validUntil))}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Truck className="h-4 w-4 text-gray-600" />
                    <div>
                      <span className="text-gray-500">Placa Principal:</span>
                      <span className="ml-1 font-medium">{conflict.licenca.mainVehiclePlate}</span>
                    </div>
                  </div>

                  {conflict.licenca.placasConflitantes.length > 1 && (
                    <div className="flex items-start space-x-2">
                      <Truck className="h-4 w-4 text-gray-600 mt-0.5" />
                      <div>
                        <span className="text-gray-500">Placas Conflitantes:</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {conflict.licenca.placasConflitantes.map((placa, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs">
                              {placa}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              <strong>O que fazer:</strong> Os estados listados acima foram removidos automaticamente da sua seleção. 
              Você pode renovar essas licenças quando faltarem 30 dias ou menos para o vencimento.
            </p>
          </div>
        </div>

        <div className="flex justify-end pt-4">
          <Button onClick={onClose} className="min-w-[100px]">
            Entendi
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}