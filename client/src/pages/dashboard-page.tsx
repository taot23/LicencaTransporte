import { MainLayout } from "@/components/layout/main-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatsCard } from "@/components/dashboard/stats-card";
import { LicenseTable } from "@/components/dashboard/license-table";
import { StatusChart } from "@/components/dashboard/status-chart";
import { useDashboardStats } from "@/hooks/use-dashboard-stats";
import { useIsMobile } from "@/hooks/use-mobile";
import { useWebSocketContext } from "@/hooks/use-websocket-context";
import { CheckCircle, Clock, AlertCircle, Search } from "lucide-react";

// Importar ícone personalizado de veículo
import genericTruckIcon from '@assets/{F9464883-3F10-4933-AF74-76A8D67A0F59}_1756866800903.png';
import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonCardGroup } from "@/components/ui/skeleton-card";
import { PageTransition, FadeIn } from "@/components/ui/page-transition";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

export default function DashboardPage() {
  const { data: stats, isLoading, error } = useDashboardStats();
  const isMobile = useIsMobile();
  
  // Hook para tempo real INSTANTÂNEO
  const { isConnected } = useWebSocketContext();

  return (
    <MainLayout>
      <PageTransition>
        {/* Header responsivo */}
        <div className={`${isMobile ? 'mb-4' : 'mb-6'} ${isMobile ? 'flex flex-col gap-3' : 'flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-0'}`}>
          <div>
            <h1 className={`${isMobile ? 'text-xl' : 'text-2xl'} font-bold text-foreground`}>
              Dashboard
            </h1>
            <div className={`flex items-center gap-2 mt-1 ${isMobile ? 'text-xs' : 'text-sm'}`}>
              <div className={`flex items-center gap-1 px-2 py-1 rounded-full ${isMobile ? 'text-xs' : 'text-xs'} ${isConnected ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400' : 'bg-gray-400'}`}></div>
                {isConnected ? 'Tempo Real Ativo' : 'Offline'}
              </div>
            </div>
          </div>
          
          {/* Barra de pesquisa responsiva */}
          <div className={`${isMobile ? 'w-full' : 'flex items-center w-full sm:w-auto'}`}>
            <div className={`relative ${isMobile ? 'w-full' : 'w-full sm:w-64'}`}>
              <input 
                type="text" 
                placeholder="Pesquisar..." 
                className={`w-full pl-10 pr-4 ${isMobile ? 'py-3 text-base' : 'py-2'} border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary`}
              />
              <Search className={`absolute left-3 ${isMobile ? 'top-3.5' : 'top-2.5'} text-muted-foreground h-5 w-5`} />
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className={`${isMobile ? 'mb-4' : 'mb-8'}`}>
            <SkeletonCardGroup count={3} />
          </div>
        ) : error ? (
          <Card className={`${isMobile ? 'mb-4' : 'mb-8'}`}>
            <CardContent className={`${isMobile ? 'pt-4 p-4' : 'pt-6'} flex items-center`}>
              <AlertCircle className={`${isMobile ? 'h-6 w-6' : 'h-8 w-8'} text-red-500 mr-2`} />
              <p className={`${isMobile ? 'text-sm' : ''}`}>
                Erro ao carregar estatísticas. Tente novamente.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className={`${isMobile ? 'grid grid-cols-1 gap-3 mb-4' : 'grid grid-cols-1 md:grid-cols-3 gap-6 mb-8'}`}>
            <StatsCard 
              title="Licenças Emitidas"
              value={stats?.issuedLicenses || 0}
              icon={<CheckCircle className={`${isMobile ? 'h-6 w-6' : 'h-8 w-8'}`} />}
              trend={12}
              trendText="esta semana"
              color="primary"
            />
            <StatsCard 
              title="Licenças Pendentes"
              value={stats?.pendingLicenses || 0}
              icon={<Clock className={`${isMobile ? 'h-6 w-6' : 'h-8 w-8'}`} />}
              trend={4}
              trendText="em processamento"
              color="yellow"
            />
            <StatsCard 
              title="Veículos Cadastrados"
              value={stats?.registeredVehicles || 0}
              icon={<img src={genericTruckIcon} className={`${isMobile ? 'h-6 w-6' : 'h-8 w-8'}`} alt="Veículos" />}
              secondaryText={`${stats?.activeVehicles || 0} ativos`}
              color="blue"
            />
          </div>
        )}

        <Card className="mb-8">
          <div className="p-6 border-b border-border">
            <h2 className="text-lg font-medium text-foreground">Licenças Recentes</h2>
          </div>
          <LicenseTable licenses={stats?.recentLicenses || []} isLoading={isLoading} />
          <div className="px-6 py-4 border-t border-border">
            <a href="/issued-licenses" className="text-sm text-primary hover:text-primary/80 font-medium">Ver todas as licenças →</a>
          </div>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="p-6">
            <Tabs defaultValue="vehicle-status">
              <TabsList className="mb-4">
                <TabsTrigger value="vehicle-status">Status de Veículos</TabsTrigger>
                <TabsTrigger value="license-states">Licenças por Estado</TabsTrigger>
              </TabsList>
              <TabsContent value="vehicle-status">
                <div className="h-64">
                  <StatusChart
                    type="vehicle"
                    isLoading={isLoading}
                  />
                </div>
              </TabsContent>
              <TabsContent value="license-states">
                <div className="h-64">
                  <StatusChart
                    type="state"
                    isLoading={isLoading}
                  />
                </div>
              </TabsContent>
            </Tabs>
          </Card>
          
          <Card className="p-6">
            <h2 className="text-lg font-medium text-foreground mb-4">Licenças por Estado</h2>
            <div className="h-64">
              <StatusChart
                type="state"
                isLoading={isLoading}
              />
            </div>
          </Card>
        </div>
      </PageTransition>
    </MainLayout>
  );
}
