import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/licenses/status-badge";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { SkeletonTable } from "@/components/ui/skeleton-table";
import { SkeletonCard } from "@/components/ui/skeleton-card";
import { useIsMobile } from "@/hooks/use-mobile";

interface License {
  id: number;
  requestNumber: string;
  type: string;
  mainVehiclePlate: string;
  states: string[];
  status: string;
  createdAt: string;
}

interface LicenseTableProps {
  licenses: License[];
  isLoading: boolean;
}

export function LicenseTable({ licenses, isLoading }: LicenseTableProps) {
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const isTransporter = user?.role === 'user'; // Usuários comuns são transportadores
  
  if (isLoading) {
    return (
      <>
        {/* Mobile skeleton */}
        <div className="md:hidden p-4">
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="border rounded-lg p-4">
                <div className="flex justify-between items-start mb-4">
                  <Skeleton className="h-5 w-1/3" />
                  <Skeleton className="h-5 w-16" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {Array.from({ length: 4 }).map((_, idx) => (
                    <div key={idx}>
                      <Skeleton className="h-4 w-12 mb-2" />
                      <Skeleton className="h-5 w-24" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Desktop skeleton */}
        <div className="hidden md:block p-4">
          <SkeletonTable columns={6} rows={4} />
        </div>
      </>
    );
  }

  // Renderização móvel - cards em vez de tabela
  if (isMobile) {
    return (
      <div className="p-4 md:hidden">
        {licenses.length > 0 ? (
          <div className="space-y-4">
            {licenses.map((license) => (
              <div key={license.id} className="bg-white border rounded-lg p-4 shadow-sm">
                <div className="flex justify-between items-start mb-2">
                  <div className="font-medium">{license.requestNumber}</div>
                  <StatusBadge status={license.status} isTransporter={isTransporter} />
                </div>
                
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <div className="text-gray-500">Placa</div>
                    <div>{license.mainVehiclePlate}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">Conjunto</div>
                    <div>
                      {license.type === "roadtrain_9_axles" && "Rodotrem 9 eixos"}
                      {license.type === "bitrain_9_axles" && "Bitrem 9 eixos"}
                      {license.type === "bitrain_7_axles" && "Bitrem 7 eixos"}
                      {license.type === "bitrain_6_axles" && "Bitrem 6 eixos"}
                      {license.type === "flatbed" && "Prancha"}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-500">Estados</div>
                    <div className="truncate">{license.states.join(", ")}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">Data</div>
                    <div>{license.createdAt && format(new Date(license.createdAt), "dd/MM/yyyy")}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 text-gray-500">Nenhuma licença encontrada.</div>
        )}
      </div>
    );
  }

  // Renderização desktop - tabela
  return (
    <div className="overflow-x-auto hidden md:block">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nº do Pedido</TableHead>
            <TableHead>Conjunto</TableHead>
            <TableHead>Placa</TableHead>
            <TableHead>Estados</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Data</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {licenses.length > 0 ? (
            licenses.map((license) => (
              <TableRow key={license.id}>
                <TableCell className="font-medium">{license.requestNumber}</TableCell>
                <TableCell>
                  {license.type === "roadtrain_9_axles" && "Rodotrem 9 eixos"}
                  {license.type === "bitrain_9_axles" && "Bitrem 9 eixos"}
                  {license.type === "bitrain_7_axles" && "Bitrem 7 eixos"}
                  {license.type === "bitrain_6_axles" && "Bitrem 6 eixos"}
                  {license.type === "flatbed" && "Prancha"}
                </TableCell>
                <TableCell>{license.mainVehiclePlate}</TableCell>
                <TableCell>{license.states.join(", ")}</TableCell>
                <TableCell>
                  <StatusBadge status={license.status} isTransporter={isTransporter} />
                </TableCell>
                <TableCell>
                  {license.createdAt && format(new Date(license.createdAt), "dd/MM/yyyy")}
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={6} className="h-24 text-center">Nenhuma licença encontrada.</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
