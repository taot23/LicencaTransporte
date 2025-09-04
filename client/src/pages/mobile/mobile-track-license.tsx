import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MobileLayout } from "@/components/layouts/mobile-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { SearchIcon, X, ArrowUpRight, CalendarIcon } from "lucide-react";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { StatusBadge } from "@/components/licenses/status-badge";
import { getLicenseTypeLabel, formatShortDate } from "@/lib/utils";
import { ProgressFlow } from "@/components/licenses/progress-flow";
import { Badge } from "@/components/ui/badge";
import { DetailsSection } from "@/components/ui/details-section";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LicenseDetailsCard } from "@/components/licenses/license-details-card";

// Componente para o cartão de licença móvel (versão compacta)
function MobileLicenseCard({ license }: { license: any }) {
  return (
    <DialogTrigger asChild>
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
            <StatusBadge status={license.status} size="sm" isTransporter={true} />
          </div>
          
          <div className="mt-3 flex justify-between items-center">
            <div className="text-xs">
              <span className="text-muted-foreground mr-1">Placa:</span>
              <span className="font-medium">{license.mainVehiclePlate}</span>
            </div>
            <div className="text-xs">
              <span className="text-muted-foreground mr-1">Estados:</span>
              <span className="font-medium">{license.states?.length || 0}</span>
            </div>
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
    </DialogTrigger>
  );
}

export default function MobileTrackLicensePage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLicense, setSelectedLicense] = useState<any>(null);
  
  // Buscar licenças em progresso (usar a mesma rota que desktop)
  const { data: licenses, isLoading } = useQuery({
    queryKey: ["/api/licenses"],
    staleTime: 1000 * 60 * 2, // 2 minutos
  });
  
  // Filtrar licenças em progresso (excluir finalizadas) e aplicar busca
  const filteredLicenses = Array.isArray(licenses) ? licenses.filter((license: any) => {
    // Excluir licenças finalizadas (approved, rejected, cancelled)
    const inProgressStatuses = ['pending_registration', 'under_review', 'pending_payment', 'pending_documentation'];
    const isInProgress = inProgressStatuses.includes(license.status);
    
    if (!isInProgress) return false;
    
    // Aplicar filtro de busca se especificado
    if (!searchTerm) return true;
    
    const search = searchTerm.toLowerCase();
    return (
      (license.requestNumber && license.requestNumber.toLowerCase().includes(search)) ||
      (license.mainVehiclePlate && license.mainVehiclePlate.toLowerCase().includes(search)) ||
      (license.states && license.states.some((state: string) => state.toLowerCase().includes(search)))
    );
  }) : [];
  
  return (
    <MobileLayout title="Acompanhar Licenças">
      <div className="space-y-4">
        {/* Barra de busca */}
        <div className="relative">
          <SearchIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Buscar por número, placa ou estado..."
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
        
        {/* Lista de licenças */}
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
                  : "Você ainda não tem licenças em andamento"}
              </p>
            </div>
          ) : (
            filteredLicenses?.map((license: any) => (
              <Dialog 
                key={license.id}
                onOpenChange={(open) => {
                  if (open) setSelectedLicense(license);
                }}
              >
                <MobileLicenseCard license={license} />
                <DialogContent className="sm:max-w-[425px] p-0 h-[90vh] overflow-y-auto mobile-form-dialog">
                  {selectedLicense && (
                    <div className="overflow-y-auto">
                      <div className="p-4 sticky top-0 bg-background border-b z-10">
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-semibold">
                              {selectedLicense.requestNumber}
                            </h3>
                            <p className="text-sm text-muted-foreground">
                              {getLicenseTypeLabel(selectedLicense.type)}
                            </p>
                          </div>
                          <StatusBadge status={selectedLicense.status} />
                        </div>
                      </div>
                      
                      <div className="p-4">
                        <div className="mb-6">
                          <ProgressFlow status={selectedLicense.status} />
                        </div>
                        
                        <Tabs defaultValue="details">
                          <TabsList className="w-full mb-4">
                            <TabsTrigger value="details" className="flex-1">Detalhes</TabsTrigger>
                            <TabsTrigger value="states" className="flex-1">Estados</TabsTrigger>
                          </TabsList>
                          
                          <TabsContent value="details">
                            <DetailsSection title="Veículo Principal">
                              <p className="text-sm">{selectedLicense.mainVehiclePlate}</p>
                            </DetailsSection>
                            
                            <Separator className="my-3" />
                            
                            <DetailsSection title="Dimensões">
                              <div className="grid grid-cols-3 gap-2">
                                <div className="text-center">
                                  <p className="text-xs text-muted-foreground">Comprimento</p>
                                  <p className="font-medium">{(selectedLicense.length).toFixed(2)}m</p>
                                </div>
                                <div className="text-center">
                                  <p className="text-xs text-muted-foreground">Largura</p>
                                  <p className="font-medium">{(selectedLicense.width).toFixed(2)}m</p>
                                </div>
                                <div className="text-center">
                                  <p className="text-xs text-muted-foreground">Altura</p>
                                  <p className="font-medium">{(selectedLicense.height).toFixed(2)}m</p>
                                </div>
                              </div>
                            </DetailsSection>
                            
                            <Separator className="my-3" />
                            
                            {selectedLicense.comments && (
                              <>
                                <DetailsSection title="Observações">
                                  <p className="text-sm">{selectedLicense.comments}</p>
                                </DetailsSection>
                                <Separator className="my-3" />
                              </>
                            )}
                            
                            <DetailsSection title="Datas">
                              <div className="flex justify-between">
                                <div>
                                  <p className="text-xs text-muted-foreground">Data de criação</p>
                                  <div className="flex items-center mt-1">
                                    <CalendarIcon className="h-3 w-3 mr-1" />
                                    <p className="text-sm">{formatShortDate(selectedLicense.createdAt)}</p>
                                  </div>
                                </div>
                                {selectedLicense.updatedAt && (
                                  <div>
                                    <p className="text-xs text-muted-foreground">Última atualização</p>
                                    <div className="flex items-center mt-1">
                                      <CalendarIcon className="h-3 w-3 mr-1" />
                                      <p className="text-sm">{formatShortDate(selectedLicense.updatedAt)}</p>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </DetailsSection>
                          </TabsContent>
                          
                          <TabsContent value="states">
                            {selectedLicense.states?.map((state: string, index: number) => {
                              // Obter o status do estado
                              const stateStatus = selectedLicense.stateStatuses?.find((ss: string) => 
                                ss.startsWith(`${state}:`)
                              )?.split(':')?.[1] || 'pending_registration';
                              
                              return (
                                <Card key={state} className={index > 0 ? 'mt-3' : ''}>
                                  <CardContent className="p-3">
                                    <div className="flex justify-between items-center">
                                      <div className="flex items-center">
                                        <Badge variant="outline" className="mr-2">
                                          {state}
                                        </Badge>
                                        <StatusBadge status={stateStatus} size="sm" />
                                      </div>
                                      
                                      {/* Exibir número AET se disponível */}
                                      {selectedLicense.stateAETNumbers?.find((aet: string) => 
                                        aet.startsWith(`${state}:`)
                                      ) && (
                                        <div className="text-xs">
                                          <span className="text-muted-foreground mr-1">AET:</span>
                                          <span className="font-medium">
                                            {selectedLicense.stateAETNumbers.find((aet: string) => 
                                              aet.startsWith(`${state}:`)
                                            ).split(':')[1]}
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                    
                                    {/* Exibir validade se disponível */}
                                    {selectedLicense.stateStatuses?.find((ss: string) => 
                                      ss.startsWith(`${state}:approved:`)
                                    ) && (
                                      <div className="mt-2 text-xs">
                                        <span className="text-muted-foreground mr-1">Válido até:</span>
                                        <span className="font-medium">
                                          {formatShortDate(selectedLicense.stateStatuses.find((ss: string) => 
                                            ss.startsWith(`${state}:approved:`)
                                          ).split(':')[2])}
                                        </span>
                                      </div>
                                    )}
                                    
                                    {/* Exibir botão para visualizar documento se disponível */}
                                    {selectedLicense.stateFiles?.find((sf: string) => 
                                      sf.startsWith(`${state}:`)
                                    ) && (
                                      <div className="mt-2">
                                        <Button 
                                          variant="outline" 
                                          size="sm" 
                                          className="w-full text-xs h-8"
                                          onClick={() => {
                                            const fileUrl = selectedLicense.stateFiles.find((sf: string) => 
                                              sf.startsWith(`${state}:`)
                                            ).split(':')[1];
                                            window.open(fileUrl, '_blank');
                                          }}
                                        >
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
                        </Tabs>
                      </div>
                    </div>
                  )}
                </DialogContent>
              </Dialog>
            ))
          )}
        </div>
      </div>
    </MobileLayout>
  );
}