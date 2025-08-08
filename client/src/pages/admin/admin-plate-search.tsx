import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { PlateSearchAdmin } from "@/components/ui/plate-search-admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Truck, Search, Clock, Database } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface SelectedPlate {
  id: number;
  plate: string;
  type: string;
  brand: string;
  model: string;
  year: number;
  status: string;
  ownershipType: string;
  ownerName: string;
  userEmail: string;
  userName: string;
  transporterName: string;
  displayText: string;
}

export default function AdminPlateSearch() {
  const [selectedPlate, setSelectedPlate] = useState<SelectedPlate | null>(null);
  const [searchHistory, setSearchHistory] = useState<SelectedPlate[]>([]);
  const { toast } = useToast();

  const handlePlateSelect = (plate: SelectedPlate) => {
    setSelectedPlate(plate);
    
    // Adicionar ao histórico (máximo 5 itens)
    setSearchHistory(prev => {
      const filtered = prev.filter(p => p.id !== plate.id);
      return [plate, ...filtered].slice(0, 5);
    });

    toast({
      title: "Placa selecionada",
      description: `${plate.plate} - ${plate.brand} ${plate.model}`,
    });
  };

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      'tractor_unit': 'bg-blue-100 text-blue-800',
      'semi_trailer': 'bg-green-100 text-green-800',
      'trailer': 'bg-purple-100 text-purple-800',
      'dolly': 'bg-yellow-100 text-yellow-800',
      'flatbed': 'bg-orange-100 text-orange-800'
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  const vehicleTypeLabels: Record<string, string> = {
    'tractor_unit': 'Unidade Tratora',
    'semi_trailer': 'Semirreboque',
    'trailer': 'Reboque',
    'dolly': 'Dolly',
    'flatbed': 'Prancha'
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Search className="h-8 w-8 text-blue-600" />
          Busca Ultra-Rápida de Placas
        </h1>
        <p className="text-gray-600 mt-2">
          Sistema otimizado para administradores buscarem placas de cavalos e carretas rapidamente
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Busca Principal */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Busca de Placas com Paginação
              </CardTitle>
            </CardHeader>
            <CardContent>
              <PlateSearchAdmin
                onSelect={handlePlateSelect}
                selectedPlate={selectedPlate || undefined}
                placeholder="Digite a placa, marca ou modelo para buscar..."
                className="mb-6"
              />

              {/* Características da busca */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">50K+</div>
                  <div className="text-sm text-blue-800">Placas no sistema</div>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">~150ms</div>
                  <div className="text-sm text-green-800">Primeira busca</div>
                </div>
                <div className="text-center p-4 bg-purple-50 rounded-lg">
                  <div className="text-2xl font-bold text-purple-600">~70ms</div>
                  <div className="text-sm text-purple-800">Buscas em cache</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Detalhes da Placa Selecionada */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Truck className="h-5 w-5" />
                Placa Selecionada
              </CardTitle>
            </CardHeader>
            <CardContent>
              {selectedPlate ? (
                <div className="space-y-4">
                  <div className="text-center">
                    <div className="text-2xl font-mono font-bold text-gray-900 mb-2">
                      {selectedPlate.plate}
                    </div>
                    <Badge className={getTypeColor(selectedPlate.type)}>
                      {vehicleTypeLabels[selectedPlate.type] || selectedPlate.type}
                    </Badge>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="text-sm font-medium text-gray-500">Veículo</label>
                      <div className="text-gray-900">
                        {selectedPlate.brand} {selectedPlate.model} ({selectedPlate.year})
                      </div>
                    </div>

                    {selectedPlate.transporterName && (
                      <div>
                        <label className="text-sm font-medium text-gray-500">Transportador</label>
                        <div className="text-gray-900">{selectedPlate.transporterName}</div>
                      </div>
                    )}

                    <div>
                      <label className="text-sm font-medium text-gray-500">Usuário</label>
                      <div className="text-gray-900">{selectedPlate.userName}</div>
                      <div className="text-sm text-gray-500">{selectedPlate.userEmail}</div>
                    </div>

                    <div>
                      <label className="text-sm font-medium text-gray-500">Propriedade</label>
                      <div className="flex items-center gap-2">
                        <Badge variant={selectedPlate.ownershipType === 'proprio' ? 'default' : 'outline'}>
                          {selectedPlate.ownershipType === 'proprio' ? 'Próprio' : 'Terceiro'}
                        </Badge>
                      </div>
                      {selectedPlate.ownerName && (
                        <div className="text-sm text-gray-600 mt-1">
                          Proprietário: {selectedPlate.ownerName}
                        </div>
                      )}
                    </div>
                  </div>

                  <Button 
                    className="w-full"
                    onClick={() => {
                      toast({
                        title: "Simulação",
                        description: "Aqui seria criada uma nova licença com esta placa",
                      });
                    }}
                  >
                    Criar Licença com Esta Placa
                  </Button>
                </div>
              ) : (
                <div className="text-center text-gray-500 py-8">
                  <Truck className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <div>Nenhuma placa selecionada</div>
                  <div className="text-sm">Digite uma placa para buscar</div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Histórico de Buscas */}
          {searchHistory.length > 0 && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Histórico Recente
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {searchHistory.map((plate) => (
                    <div
                      key={plate.id}
                      onClick={() => setSelectedPlate(plate)}
                      className="p-3 rounded-lg border hover:bg-gray-50 cursor-pointer"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-mono font-medium">{plate.plate}</div>
                          <div className="text-sm text-gray-500">
                            {plate.brand} {plate.model}
                          </div>
                        </div>
                        <Badge className={getTypeColor(plate.type)} variant="outline">
                          {vehicleTypeLabels[plate.type]?.split(' ')[0] || plate.type}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Informações Técnicas */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Otimizações Implementadas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-2">Paginação Inteligente</h4>
              <p className="text-sm text-gray-600">
                Máximo 25 resultados por página para performance otimizada
              </p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-2">Cache de 2 minutos</h4>
              <p className="text-sm text-gray-600">
                Buscas idênticas são servidas do cache para maior velocidade
              </p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-2">Busca Trigram</h4>
              <p className="text-sm text-gray-600">
                Para termos curtos, usa índices trigram para máxima performance
              </p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-2">Filtros Avançados</h4>
              <p className="text-sm text-gray-600">
                Por tipo de veículo e propriedade (próprio/terceiro)
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}