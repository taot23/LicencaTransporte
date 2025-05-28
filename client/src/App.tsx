import { Switch, Route } from "wouter";
import { queryClient, getQueryFn } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth-page";
import RegularDashboardPage from "@/pages/regular-dashboard-page";
import VehiclesPage from "@/pages/vehicles-page";
import RequestLicensePage from "@/pages/request-license-page";
import TrackLicensePage from "@/pages/track-license-page";
import IssuedLicensesPage from "@/pages/issued-licenses-page";
import MyCompaniesPage from "@/pages/my-companies-page";
import GamificationPage from "@/pages/gamification-page";
import AdminDashboardPage from "@/pages/admin/admin-dashboard";
import AdminLicensesPage from "@/pages/admin/admin-licenses";
import AdminTransportersPage from "@/pages/admin/admin-transporters";
import AdminUsersPage from "@/pages/admin/admin-users";
import AdminVehiclesPage from "@/pages/admin/admin-vehicles";
import VehicleModelsPage from "@/pages/admin/vehicle-models-page";
import RedirectPage from "@/pages/redirect-page";
import { ProtectedRoute, AdminRoute, StaffRoute } from "./lib/protected-route";
import { AuthProvider } from "./hooks/use-auth";
import { WebSocketProvider } from "./hooks/use-websocket-context";
import { MobileProvider, useMobileContext } from "./hooks/use-mobile-context";
import { useEffect } from "react";

// Importar páginas mobile
import MobileDashboardPage from "@/pages/mobile/mobile-dashboard";
import MobileVehiclesPage from "@/pages/mobile/mobile-vehicles";
import MobileTrackLicensePage from "@/pages/mobile/mobile-track-license";
import MobileIssuedLicensesPage from "@/pages/mobile/mobile-issued-licenses";

function Router() {
  const { isMobile } = useMobileContext();
  
  return (
    <Switch>
      <Route path="/auth" component={AuthPage} />
      
      {/* Página inicial com redirecionamento inteligente baseado no papel */}
      <ProtectedRoute path="/" component={RedirectPage} />
      
      {/* Portal Admin - Rotas acessíveis via hierarquia de permissões */}
      <AdminRoute path="/admin" component={AdminDashboardPage} />
      <StaffRoute path="/admin/licenses" component={AdminLicensesPage} requiredRole="operational" />
      <StaffRoute path="/admin/transporters" component={AdminTransportersPage} requiredRole="operational" />
      <AdminRoute path="/admin/users" component={AdminUsersPage} />
      <StaffRoute path="/admin/vehicles" component={AdminVehiclesPage} requiredRole="operational" />
      <AdminRoute path="/admin/vehicle-models" component={VehicleModelsPage} />
      
      {/* Sistema de Controle de Licenças - Rotas do usuário (versão desktop ou mobile) */}
      <ProtectedRoute 
        path="/dashboard" 
        component={isMobile ? MobileDashboardPage : RegularDashboardPage} 
      />
      <ProtectedRoute
        path="/my-companies"
        component={MyCompaniesPage}
      />
      <ProtectedRoute 
        path="/vehicles" 
        component={isMobile ? MobileVehiclesPage : VehiclesPage} 
      />
      <ProtectedRoute 
        path="/request-license" 
        component={RequestLicensePage} 
      />
      <ProtectedRoute 
        path="/track-license" 
        component={isMobile ? MobileTrackLicensePage : TrackLicensePage} 
      />
      <ProtectedRoute 
        path="/issued-licenses" 
        component={isMobile ? MobileIssuedLicensesPage : IssuedLicensesPage} 
      />
      
      <Route component={NotFound} />
    </Switch>
  );
}

// Componente para pré-carregar dados importantes
function AppInitializer() {
  const { isMobile } = useMobileContext();
  
  // Efeito para carregar dados do usuário e outros recursos importantes
  useEffect(() => {
    // Pré-carregar dados da sessão atual
    queryClient.prefetchQuery({
      queryKey: ["/api/user"],
      queryFn: getQueryFn({ on401: "returnNull" }),
    });
    
    // Adicionar classe para identificar dispositivos móveis no body
    if (isMobile) {
      document.body.classList.add('mobile-device');
    } else {
      document.body.classList.remove('mobile-device');
    }
    
    // Configurar viewport para dispositivos móveis
    const viewportMeta = document.querySelector('meta[name="viewport"]');
    if (viewportMeta && isMobile) {
      viewportMeta.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
    }
  }, [isMobile]);
  
  return null;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <WebSocketProvider>
          <MobileProvider>
            <AppInitializer />
            <Router />
            <Toaster />
          </MobileProvider>
        </WebSocketProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
