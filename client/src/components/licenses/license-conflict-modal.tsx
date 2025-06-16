import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { AlertTriangle, Clock, FileText, CheckCircle2 } from "lucide-react";

interface LicenseConflict {
  state: string;
  licenseId: number;
  requestNumber: string;
  aetNumber: string;
  validUntil: string;
  daysUntilExpiry: number;
  conflictingPlates: string[];
  canRenew: boolean;
}

interface LicenseConflictModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProceed: (statesWithoutConflicts: string[]) => void;
  conflicts: LicenseConflict[];
  selectedStates: string[];
}

export function LicenseConflictModal({
  isOpen,
  onClose,
  onProceed,
  conflicts,
  selectedStates
}: LicenseConflictModalProps) {
  const conflictedStates = conflicts.map(c => c.state);
  const statesWithoutConflicts = selectedStates.filter(state => !conflictedStates.includes(state));
  
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const getStatusColor = (daysUntilExpiry: number) => {
    if (daysUntilExpiry <= 30) return "bg-green-100 text-green-800";
    if (daysUntilExpiry <= 60) return "bg-yellow-100 text-yellow-800";
    return "bg-red-100 text-red-800";
  };

  const handleProceed = () => {
    if (statesWithoutConflicts.length > 0) {
      onProceed(statesWithoutConflicts);
    }
    onClose();
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Licenças Vigentes Encontradas
          </AlertDialogTitle>
          <AlertDialogDescription>
            Foram encontradas licenças ativas que impedem a criação de novas licenças para alguns estados.
            Verifique os detalhes abaixo:
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4">
          {/* Resumo dos conflitos */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Resumo dos Conflitos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Estados com conflitos:</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {conflictedStates.map(state => (
                      <Badge key={state} variant="destructive">{state}</Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Estados disponíveis:</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {statesWithoutConflicts.map(state => (
                      <Badge key={state} variant="secondary" className="bg-green-100 text-green-800">{state}</Badge>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Detalhes dos conflitos */}
          <div className="space-y-3">
            <h3 className="font-semibold">Detalhes dos Conflitos:</h3>
            {conflicts.map((conflict, index) => (
              <Card key={index} className="border-l-4 border-l-amber-500">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Estado: {conflict.state}</CardTitle>
                    <Badge className={getStatusColor(conflict.daysUntilExpiry)}>
                      <Clock className="h-3 w-3 mr-1" />
                      {conflict.daysUntilExpiry} dias restantes
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium">AET Número:</span>
                      <p className="text-gray-600">{conflict.aetNumber || 'Não informado'}</p>
                    </div>
                    <div>
                      <span className="font-medium">Número da Solicitação:</span>
                      <p className="text-gray-600">{conflict.requestNumber}</p>
                    </div>
                    <div>
                      <span className="font-medium">Válida até:</span>
                      <p className="text-gray-600">{formatDate(conflict.validUntil)}</p>
                    </div>
                    <div>
                      <span className="font-medium">Pode renovar:</span>
                      <div className="flex items-center gap-1">
                        {conflict.canRenew ? (
                          <>
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                            <span className="text-green-600">Sim</span>
                          </>
                        ) : (
                          <>
                            <AlertTriangle className="h-4 w-4 text-red-500" />
                            <span className="text-red-600">Não (aguardar 30 dias)</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <Separator />
                  
                  <div>
                    <span className="font-medium text-sm">Placas em conflito:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {conflict.conflictingPlates.map(plate => (
                        <Badge key={plate} variant="outline" className="text-xs">
                          {plate}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Informações sobre a regra dos 30 dias */}
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="pt-4">
              <div className="flex items-start gap-2">
                <FileText className="h-5 w-5 text-blue-500 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-blue-800">Regra dos 30 dias:</p>
                  <p className="text-blue-700 mt-1">
                    Licenças só podem ser renovadas quando restam 30 dias ou menos para o vencimento.
                    Para estados com licenças vigentes por mais de 30 dias, você deve aguardar ou usar
                    placas diferentes.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>
            Cancelar Solicitação
          </AlertDialogCancel>
          {statesWithoutConflicts.length > 0 && (
            <AlertDialogAction onClick={handleProceed}>
              Continuar com Estados Disponíveis ({statesWithoutConflicts.length})
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}