import { useState } from "react";
import { AdminLayout } from "@/components/layout/admin-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TractorUnitSelector, SemiTrailerSelector } from "@/components/forms/optimized-vehicle-selector";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Truck, Settings } from "lucide-react";

export default function TestOptimizedSelectorsPage() {
  const [tractorUnitId, setTractorUnitId] = useState<number | null>(null);
  const [firstTrailerId, setFirstTrailerId] = useState<number | null>(null);
  const [secondTrailerId, setSecondTrailerId] = useState<number | null>(null);

  const handleSubmit = () => {
    console.log('Veículos selecionados:', {
      tractorUnit: tractorUnitId,
      firstTrailer: firstTrailerId,
      secondTrailer: secondTrailerId
    });
  };

  const handleReset = () => {
    setTractorUnitId(null);
    setFirstTrailerId(null);
    setSecondTrailerId(null);
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <Settings className="h-6 w-6" />
              Teste - Campos de Seleção Otimizados
            </h1>
            <p className="text-gray-600 mt-1">
              Demonstração dos novos campos otimizados para formulários de licença
            </p>
          </div>
          <Badge variant="outline" className="bg-blue-50 text-blue-700">
            Sistema Otimizado para 40.000+ veículos
          </Badge>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Formulário de teste */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Truck className="h-5 w-5" />
                Formulário de Seleção de Veículos
              </CardTitle>
              <CardDescription>
                Teste os novos campos otimizados com busca em tempo real e paginação server-side
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Unidade Tratora */}
              <TractorUnitSelector
                value={tractorUnitId}
                onValueChange={setTractorUnitId}
                required
              />

              {/* Primeira Carreta */}
              <SemiTrailerSelector
                value={firstTrailerId}
                onValueChange={setFirstTrailerId}
                label="1ª Carreta"
                description="Selecione o primeiro semirreboque da composição"
              />

              {/* Segunda Carreta */}
              <SemiTrailerSelector
                value={secondTrailerId}
                onValueChange={setSecondTrailerId}
                label="2ª Carreta"
                description="Selecione o segundo semirreboque da composição"
              />

              <div className="flex gap-3 pt-4">
                <Button onClick={handleSubmit} className="flex-1">
                  Testar Seleção
                </Button>
                <Button variant="outline" onClick={handleReset}>
                  Limpar
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Informações técnicas */}
          <Card>
            <CardHeader>
              <CardTitle>Otimizações Implementadas</CardTitle>
              <CardDescription>
                Funcionalidades do sistema de busca otimizada
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <Badge className="mt-1 bg-green-100 text-green-800">API</Badge>
                  <div>
                    <div className="font-medium text-sm">Endpoints Otimizados</div>
                    <div className="text-sm text-gray-600">
                      • /api/vehicles/tractor-units<br/>
                      • /api/vehicles/semi-trailers<br/>
                      • /api/vehicles/search-plate
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Badge className="mt-1 bg-blue-100 text-blue-800">Performance</Badge>
                  <div>
                    <div className="font-medium text-sm">Otimizações de Performance</div>
                    <div className="text-sm text-gray-600">
                      • Debounce 500ms para reduzir calls<br/>
                      • Paginação server-side (50 por página)<br/>
                      • Cache inteligente de 30 segundos
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Badge className="mt-1 bg-purple-100 text-purple-800">UX</Badge>
                  <div>
                    <div className="font-medium text-sm">Experiência do Usuário</div>
                    <div className="text-sm text-gray-600">
                      • Busca em tempo real por placa<br/>
                      • Auto-complete inteligente<br/>
                      • Estados de loading e erro<br/>
                      • Seleção visual com informações detalhadas
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Badge className="mt-1 bg-orange-100 text-orange-800">Capacidade</Badge>
                  <div>
                    <div className="font-medium text-sm">Escalabilidade</div>
                    <div className="text-sm text-gray-600">
                      • Suporta 40.000+ placas de veículos<br/>
                      • Queries SQL otimizadas com índices<br/>
                      • Filtros por permissão de usuário<br/>
                      • Busca por tipo específico de veículo
                    </div>
                  </div>
                </div>
              </div>

              {/* Valores selecionados para debug */}
              {(tractorUnitId || firstTrailerId || secondTrailerId) && (
                <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                  <div className="font-medium text-sm mb-2">Valores selecionados:</div>
                  <div className="space-y-1 text-sm text-gray-600">
                    <div>Unidade Tratora ID: {tractorUnitId || 'Não selecionada'}</div>
                    <div>1ª Carreta ID: {firstTrailerId || 'Não selecionada'}</div>
                    <div>2ª Carreta ID: {secondTrailerId || 'Não selecionada'}</div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Instruções de teste */}
        <Card>
          <CardHeader>
            <CardTitle>Como Testar</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <div className="font-medium text-sm">1. Busca por Placa</div>
                <div className="text-sm text-gray-600">
                  Digite algumas letras da placa para ver a busca em tempo real funcionando
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="font-medium text-sm">2. Seleção por Lista</div>
                <div className="text-sm text-gray-600">
                  Clique na seta para ver a lista paginada de veículos disponíveis
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="font-medium text-sm">3. Performance</div>
                <div className="text-sm text-gray-600">
                  Observe como o sistema mantém boa performance mesmo com grandes volumes
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}