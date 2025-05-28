import { MainLayout } from "@/components/layout/main-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatsCard } from "@/components/dashboard/stats-card";
import { LicenseTable } from "@/components/dashboard/license-table";
import { StatusChart } from "@/components/dashboard/status-chart";
import { useDashboardStats } from "@/hooks/use-dashboard-stats";
import { CheckCircle, Clock, Truck, AlertCircle, AlertTriangle } from "lucide-react";
import { SkeletonCardGroup } from "@/components/ui/skeleton-card";
import { PageTransition } from "@/components/ui/page-transition";
import { useAuth } from "@/hooks/use-auth";
import { useEffect } from "react";
import { useLocation } from "wouter";

/**
 * Esta página é um dashboard específico para usuários regulares
 * e redireciona usuários administrativos para a página de gerenciamento de licenças
 */
export default function RegularDashboardPage() {
  const { checkRole } = useAuth();
  const [, setLocation] = useLocation();
  const { data: stats, isLoading, error } = useDashboardStats();
  
  useEffect(() => {
    // Redireciona usuários administrativos para a página de licenças
    if (checkRole('operational')) {
      setLocation("/admin/licenses");
    }
  }, [checkRole, setLocation]);
  
  // Apenas exibe o Dashboard para usuários regulares
  return (
    <MainLayout contentKey="regular-dashboard">
      <PageTransition>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-0 mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
          <div className="flex items-center w-full sm:w-auto">
            <div className="relative w-full sm:w-64">
              <input 
                type="text" 
                placeholder="Pesquisar..." 
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <span className="absolute left-3 top-2.5 text-gray-400">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </span>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="mb-8">
            <SkeletonCardGroup count={3} />
          </div>
        ) : error ? (
          <Card className="mb-8">
            <CardContent className="pt-6 flex items-center">
              <AlertCircle className="h-8 w-8 text-red-500 mr-2" />
              <p>Erro ao carregar estatísticas. Por favor, tente novamente mais tarde.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <StatsCard 
              title="Licenças Emitidas"
              value={stats?.issuedLicenses || 0}
              icon={<CheckCircle className="h-8 w-8" />}
              trend={12}
              trendText="esta semana"
              color="primary"
            />
            <StatsCard 
              title="Licenças Pendentes"
              value={stats?.pendingLicenses || 0}
              icon={<Clock className="h-8 w-8" />}
              trend={4}
              trendText="em processamento"
              color="yellow"
            />
            <StatsCard 
              title="Licenças a Vencer"
              value={stats?.expiringLicenses || 0}
              icon={<AlertTriangle className="h-8 w-8" />}
              secondaryText="próximos 30 dias"
              color="red"
            />
            <StatsCard 
              title="Veículos Cadastrados"
              value={stats?.registeredVehicles || 0}
              icon={<Truck className="h-8 w-8" />}
              secondaryText={`${stats?.activeVehicles || 0} ativos`}
              color="blue"
            />
          </div>
        )}

        <div className="bg-white rounded-lg shadow mb-8">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-800">Licenças Recentes</h2>
          </div>
          <LicenseTable licenses={stats?.recentLicenses || []} isLoading={isLoading} />
          <div className="px-6 py-4 border-t border-gray-200">
            <a href="/issued-licenses" className="text-sm text-blue-600 hover:text-blue-800 font-medium">Ver todas as licenças →</a>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Tabs defaultValue="vehicle-status" className="bg-white rounded-lg shadow p-6">
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
          
          <Card>
            <CardContent className="p-6">
              <h2 className="text-lg font-medium text-gray-800 mb-4">Licenças por Estado</h2>
              <div className="h-64">
                <StatusChart
                  type="state"
                  isLoading={isLoading}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </PageTransition>
    </MainLayout>
  );
}