import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { UnifiedLayout } from "@/components/layout/unified-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  ArrowRight, 
  Truck, 
  FileText, 
  ClipboardCheck, 
  Clock, 
  Users, 
  FileCheck, 
  AlertTriangle 
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

interface DashboardStats {
  issuedLicenses: number;
  pendingLicenses: number;
  registeredVehicles: number;
  activeVehicles: number;
  expiringLicenses: number;
  recentLicenses?: any[];
}

export default function MobileDashboardPage() {
  const { user } = useAuth();
  
  // Buscar estatísticas do dashboard
  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats"],
    staleTime: 1000 * 60 * 5, // 5 minutos
  });

  const isAdminUser = user?.role === 'admin' || user?.role === 'supervisor' || user?.role === 'operational' || user?.role === 'manager' || user?.role === 'financial';

  return (
    <UnifiedLayout>
      <div className="space-y-6 pb-6">
        {/* Saudação */}
        <section className="bg-gradient-to-r from-primary/5 to-primary/10 p-4 rounded-lg border border-primary/20">
          <h2 className="text-xl font-bold tracking-tight mb-1">
            Olá, {user?.fullName?.split(' ')[0] || 'Usuário'}
          </h2>
          <p className="text-sm text-muted-foreground">
            Bem-vindo ao sistema de controle de licenças AET
          </p>
        </section>
        
        {/* Ações rápidas */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Ações rápidas</h3>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <Link href="/vehicles" className="no-underline">
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-3 shadow-sm h-full border border-blue-100 hover:shadow-md transition-all flex flex-col items-center justify-center min-h-[100px]">
                <div className="w-10 h-10 bg-blue-500/10 rounded-full flex items-center justify-center mb-2">
                  <Truck className="h-5 w-5 text-blue-600" />
                </div>
                <span className="text-xs font-medium text-blue-800 text-center">Meus Veículos</span>
              </div>
            </Link>
            
            <Link href="/nova-licenca" className="no-underline">
              <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-3 shadow-sm h-full border border-green-100 hover:shadow-md transition-all flex flex-col items-center justify-center min-h-[100px]">
                <div className="w-10 h-10 bg-green-500/10 rounded-full flex items-center justify-center mb-2">
                  <FileText className="h-5 w-5 text-green-600" />
                </div>
                <span className="text-xs font-medium text-green-800 text-center">Nova Licença</span>
              </div>
            </Link>
            
            <Link href="/acompanhar-licenca" className="no-underline">
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-3 shadow-sm h-full border border-purple-100 hover:shadow-md transition-all flex flex-col items-center justify-center min-h-[100px]">
                <div className="w-10 h-10 bg-purple-500/10 rounded-full flex items-center justify-center mb-2">
                  <ClipboardCheck className="h-5 w-5 text-purple-600" />
                </div>
                <span className="text-xs font-medium text-purple-800 text-center">Acompanhar</span>
              </div>
            </Link>
            
            <Link href="/licencas-emitidas" className="no-underline">
              <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-xl p-3 shadow-sm h-full border border-amber-100 hover:shadow-md transition-all flex flex-col items-center justify-center min-h-[100px]">
                <div className="w-10 h-10 bg-amber-500/10 rounded-full flex items-center justify-center mb-2">
                  <Clock className="h-5 w-5 text-amber-600" />
                </div>
                <span className="text-xs font-medium text-amber-800 text-center">Licenças Emitidas</span>
              </div>
            </Link>
          </div>
        </section>
        
        {/* Estatísticas */}
        <section className="space-y-3">
          <h3 className="text-lg font-semibold">Estatísticas</h3>
          
          <div className="grid grid-cols-2 gap-3">
            {isLoading ? (
              Array(4).fill(0).map((_, i) => (
                <Card key={i} className="p-3">
                  <Skeleton className="h-4 w-[80px] mb-2" />
                  <div className="flex items-center">
                    <Skeleton className="w-8 h-8 rounded-full" />
                    <Skeleton className="h-6 w-12 ml-2" />
                  </div>
                </Card>
              ))
            ) : (
              <>
                <Card className="p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">Veículos</p>
                      <p className="text-lg font-bold">{stats?.registeredVehicles || 0}</p>
                    </div>
                    <div className="w-8 h-8 bg-blue-50 rounded-full flex items-center justify-center">
                      <Truck className="h-4 w-4 text-blue-500" />
                    </div>
                  </div>
                </Card>
                
                <Card className="p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">Licenças Emitidas</p>
                      <p className="text-lg font-bold text-green-600">{stats?.issuedLicenses || 0}</p>
                    </div>
                    <div className="w-8 h-8 bg-green-50 rounded-full flex items-center justify-center">
                      <FileCheck className="h-4 w-4 text-green-500" />
                    </div>
                  </div>
                </Card>
                
                <Card className="p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">Pendentes</p>
                      <p className="text-lg font-bold text-purple-600">{stats?.pendingLicenses || 0}</p>
                    </div>
                    <div className="w-8 h-8 bg-purple-50 rounded-full flex items-center justify-center">
                      <Clock className="h-4 w-4 text-purple-500" />
                    </div>
                  </div>
                </Card>
                
                <Card className="p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">A Vencer</p>
                      <p className="text-lg font-bold text-amber-600">{stats?.expiringLicenses || 0}</p>
                    </div>
                    <div className="w-8 h-8 bg-amber-50 rounded-full flex items-center justify-center">
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                    </div>
                  </div>
                </Card>
              </>
            )}
          </div>
        </section>
        
        {/* Admin Link (apenas para usuários administrativos) */}
        {user && isAdminUser && (
          <div className="mt-6">
            <Link href="/admin">
              <Button className="w-full" variant="outline">
                Acessar Painel Administrativo
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        )}
      </div>
    </UnifiedLayout>
  );
}