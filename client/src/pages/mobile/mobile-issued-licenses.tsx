import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MobileLayout } from "@/components/layouts/mobile-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { SearchIcon, X, FileText, ArrowUpRight, CalendarIcon, AlertCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { StatusBadge } from "@/components/licenses/status-badge";
import { getLicenseTypeLabel, formatShortDate, getStateLabel } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RenewLicenseDialog } from "@/components/licenses/renew-license-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

// Componente de cartão de licença emitida versão mobile
function MobileIssuedLicenseCard({ license, onRenew }: { license: any, onRenew: (license: any, state: string) => void }) {
  // Obter a data de validade mais próxima para exibição no cartão
  const getNextExpiryDate = () => {
    if (!license.stateStatuses || !Array.isArray(license.stateStatuses)) return null;
    
    const expiryDates = license.stateStatuses
      .filter((ss: string) => ss.includes(':approved:'))
      .map((ss: string) => {
        const parts = ss.split(':');
        return { state: parts[0], date: new Date(parts[2]) };
      })
      .sort((a, b) => a.date.getTime() - b.date.getTime());
    
    if (expiryDates.length === 0) return null;
    
    return {
      state: expiryDates[0].state,
      date: expiryDates[0].date,
      isExpiringSoon: isExpiringSoon(expiryDates[0].date)
    };
  };
  
  // Verificar se a data está expirando em breve (30 dias)
  const isExpiringSoon = (date: Date) => {
    if (!date) return false;
    const today = new Date();
    const days = Math.floor((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return days <= 30 && days >= 0;
  };
  
  // Buscar o número da AET
  const getAETNumber = () => {
    if (!license.stateAETNumbers || !Array.isArray(license.stateAETNumbers)) return null;
    
    // Pegar o primeiro AET disponível para exibição no cartão
    const aetEntry = license.stateAETNumbers[0];
    if (!aetEntry) return null;
    
    const parts = aetEntry.split(':');
    return parts.length > 1 ? parts[1] : null;
  };
  
  const expiryInfo = getNextExpiryDate();
  const aetNumber = getAETNumber();
  
  return (
    <Card className="cursor-pointer hover:bg-accent/50 transition-colors">
      <CardContent className="p-4">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="font-semibold text-sm">
              {license.requestNumber}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {getLicenseTypeLabel(license.type)}
            </p>
          </div>
          <div className="flex flex-col items-end">
            {aetNumber && (
              <span className="text-xs font-medium text-muted-foreground mb-1">
                AET: {aetNumber}
              </span>
            )}
            <StatusBadge status="approved" size="sm" />
          </div>
        </div>
        
        <div className="mt-3 flex justify-between items-center">
          <div className="text-xs">
            <span className="text-muted-foreground mr-1">Placa:</span>
            <span className="font-medium">{license.mainVehiclePlate}</span>
          </div>
          {expiryInfo && (
            <div className="text-xs">
              <span className={`font-medium ${expiryInfo.isExpiringSoon ? 'text-amber-600' : ''}`}>
                {formatShortDate(expiryInfo.date)}
              </span>
            </div>
          )}
        </div>
        
        {license.states && license.states.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {license.states.map((state: string) => (
              <Badge key={state} variant="outline" className="text-xs py-0">
                {state}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function MobileIssuedLicensesPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLicense, setSelectedLicense] = useState<any>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [renewInfo, setRenewInfo] = useState<{ license: any, state: string } | null>(null);
  
  // Buscar licenças emitidas
  const { data: issuedLicenses, isLoading } = useQuery({
    queryKey: ["/api/licenses/issued"],
    staleTime: 1000 * 60 * 5, // 5 minutos
  });
  
  // Filtrar licenças baseado no termo de busca
  const filteredLicenses = issuedLicenses?.filter((license: any) => {
    if (!searchTerm) return true;
    
    const search = searchTerm.toLowerCase();
    return (
      (license.requestNumber && license.requestNumber.toLowerCase().includes(search)) ||
      (license.mainVehiclePlate && license.mainVehiclePlate.toLowerCase().includes(search)) ||
      (license.states && license.states.some((state: string) => state.toLowerCase().includes(search))) ||
      (license.stateAETNumbers && license.stateAETNumbers.some((aet: string) => aet.toLowerCase().includes(search)))
    );
  });
  
  // Iniciar processo de renovação
  const handleRenew = (license: any, state: string) => {
    setRenewInfo({ license, state });
  };
  
  return (
    <MobileLayout title="Licenças Emitidas">
      <div className="space-y-4">
        {/* Barra de busca */}
        <div className="relative">
          <SearchIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Buscar por número, placa, estado ou AET..."
            className="pl-9"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        
        {/* Lista de licenças emitidas */}
        <div className="space-y-3">
          {isLoading ? (
            Array(3).fill(0).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <div className="flex justify-between items-start">
                    <Skeleton className="h-5 w-[120px]" />
                    <Skeleton className="h-6 w-[80px]" />
                  </div>
                  <Skeleton className="h-4 w-[200px] mt-2" />
                  <div className="flex justify-between mt-3">
                    <Skeleton className="h-4 w-[100px]" />
                    <Skeleton className="h-4 w-[60px]" />
                  </div>
                </CardContent>
              </Card>
            ))
          ) : filteredLicenses?.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">
                {searchTerm 
                  ? "Nenhuma licença encontrada para esta busca" 
                  : "Você ainda não tem licenças emitidas"}
              </p>
            </div>
          ) : (
            filteredLicenses?.map((license: any) => (
              <Dialog 
                key={license.id}
                onOpenChange={(open) => {
                  if (open) setSelectedLicense(license);
                  setIsDialogOpen(open);
                }}
              >
                <DialogTrigger asChild>
                  <div>
                    <MobileIssuedLicenseCard 
                      license={license} 
                      onRenew={handleRenew} 
                    />
                  </div>
                </DialogTrigger>
                
                <DialogContent className="sm:max-w-[425px] p-0 h-[90vh] overflow-y-auto mobile-form-dialog">
                  <DialogHeader className="sticky top-0 z-10 bg-background p-4 border-b">
                    <DialogTitle>{selectedLicense?.requestNumber}</DialogTitle>
                  </DialogHeader>
                  
                  {selectedLicense && (
                    <div className="p-4">
                      <Alert className="mb-4">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Licença Aprovada</AlertTitle>
                        <AlertDescription>
                          Esta licença possui aprovação em pelo menos um estado.
                        </AlertDescription>
                      </Alert>
                      
                      <div className="mb-4">
                        <p className="text-sm text-muted-foreground">
                          {getLicenseTypeLabel(selectedLicense.type)}
                        </p>
                        <div className="text-sm mt-2">
                          <span className="text-muted-foreground mr-1">Placa principal:</span>
                          <span className="font-medium">{selectedLicense.mainVehiclePlate}</span>
                        </div>
                      </div>
                      
                      <Tabs defaultValue="states">
                        <TabsList className="w-full mb-4">
                          <TabsTrigger value="states" className="flex-1">Estados</TabsTrigger>
                          <TabsTrigger value="details" className="flex-1">Detalhes</TabsTrigger>
                        </TabsList>
                        
                        <TabsContent value="states">
                          {selectedLicense.states?.map((state: string, index: number) => {
                            // Obter o status do estado
                            const stateStatusEntry = selectedLicense.stateStatuses?.find((ss: string) => 
                              ss.startsWith(`${state}:`)
                            );
                            
                            // Verificar se o estado está aprovado
                            const isApproved = stateStatusEntry?.includes(':approved:');
                            
                            // Obter a data de validade
                            const validUntil = isApproved 
                              ? stateStatusEntry.split(':')[2]
                              : null;
                              
                            // Verificar se está expirando em breve
                            const isExpiring = validUntil ? isExpiringSoon(new Date(validUntil)) : false;
                            
                            // Função para verificar se a data está expirando em breve (30 dias)
                            function isExpiringSoon(date: Date) {
                              if (!date) return false;
                              const today = new Date();
                              const days = Math.floor((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                              return days <= 30 && days >= 0;
                            }
                            
                            // Obter o número AET para este estado
                            const aetNumber = selectedLicense.stateAETNumbers?.find((aet: string) => 
                              aet.startsWith(`${state}:`)
                            )?.split(':')[1];
                            
                            // Obter URL do arquivo para este estado
                            const fileUrl = selectedLicense.stateFiles?.find((sf: string) => 
                              sf.startsWith(`${state}:`)
                            )?.split(':')[1];
                            
                            return (
                              <Card key={state} className={index > 0 ? 'mt-3' : ''}>
                                <CardContent className="p-3">
                                  <div className="flex justify-between items-center">
                                    <div className="flex items-center">
                                      <Badge variant="outline" className="mr-2">
                                        {getStateLabel(state)}
                                      </Badge>
                                      <StatusBadge status={isApproved ? 'approved' : 'pending_registration'} size="sm" />
                                    </div>
                                    
                                    {aetNumber && (
                                      <div className="text-xs">
                                        <span className="text-muted-foreground mr-1">AET:</span>
                                        <span className="font-medium">{aetNumber}</span>
                                      </div>
                                    )}
                                  </div>
                                  
                                  {validUntil && (
                                    <div className="mt-2 flex justify-between items-center">
                                      <div className="text-xs flex items-center">
                                        <CalendarIcon className="h-3 w-3 mr-1" />
                                        <span className="text-muted-foreground mr-1">Válido até:</span>
                                        <span className={`font-medium ${isExpiring ? 'text-amber-600' : ''}`}>
                                          {formatShortDate(validUntil)}
                                        </span>
                                      </div>
                                      
                                      <Button 
                                        variant="outline" 
                                        size="sm" 
                                        className="h-7 text-xs"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setIsDialogOpen(false);
                                          handleRenew(selectedLicense, state);
                                        }}
                                      >
                                        Renovar
                                      </Button>
                                    </div>
                                  )}
                                  
                                  {fileUrl && (
                                    <div className="mt-2">
                                      <Button 
                                        variant="secondary" 
                                        size="sm" 
                                        className="w-full text-xs h-8"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          window.open(fileUrl, '_blank');
                                        }}
                                      >
                                        <FileText className="mr-1 h-3 w-3" />
                                        Ver documento
                                        <ArrowUpRight className="ml-1 h-3 w-3" />
                                      </Button>
                                    </div>
                                  )}
                                </CardContent>
                              </Card>
                            );
                          })}
                        </TabsContent>
                        
                        <TabsContent value="details">
                          <div className="space-y-4">
                            <div>
                              <h4 className="text-sm font-medium mb-1">Dimensões</h4>
                              <div className="grid grid-cols-3 gap-2">
                                <div className="text-center">
                                  <p className="text-xs text-muted-foreground">Comprimento</p>
                                  <p className="font-medium">{(selectedLicense.length / 100).toFixed(2)}m</p>
                                </div>
                                <div className="text-center">
                                  <p className="text-xs text-muted-foreground">Largura</p>
                                  <p className="font-medium">{(selectedLicense.width / 100).toFixed(2)}m</p>
                                </div>
                                <div className="text-center">
                                  <p className="text-xs text-muted-foreground">Altura</p>
                                  <p className="font-medium">{(selectedLicense.height / 100).toFixed(2)}m</p>
                                </div>
                              </div>
                            </div>
                            
                            <Separator />
                            
                            {selectedLicense.additionalPlates && selectedLicense.additionalPlates.length > 0 && (
                              <>
                                <div>
                                  <h4 className="text-sm font-medium mb-1">Placas Adicionais</h4>
                                  <div className="flex flex-wrap gap-1">
                                    {selectedLicense.additionalPlates.map((plate: string) => (
                                      <Badge key={plate} variant="secondary">
                                        {plate}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                                <Separator />
                              </>
                            )}
                            
                            <div>
                              <h4 className="text-sm font-medium mb-1">Informações do Pedido</h4>
                              <div className="space-y-1 text-sm">
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Número do pedido:</span>
                                  <span className="font-medium">{selectedLicense.requestNumber}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Data de criação:</span>
                                  <span>{formatShortDate(selectedLicense.createdAt)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Última atualização:</span>
                                  <span>{formatShortDate(selectedLicense.updatedAt)}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </TabsContent>
                      </Tabs>
                    </div>
                  )}
                </DialogContent>
              </Dialog>
            ))
          )}
        </div>
      </div>
      
      {/* Diálogo de renovação */}
      {renewInfo && (
        <RenewLicenseDialog
          isOpen={!!renewInfo}
          onClose={() => setRenewInfo(null)}
          licenseId={renewInfo.license.id}
          state={renewInfo.state}
        />
      )}
    </MobileLayout>
  );
}