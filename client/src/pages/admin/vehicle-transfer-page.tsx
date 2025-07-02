import { AdminLayout } from "@/components/layout/admin-layout";
import { VehicleTransfer } from "@/components/admin/vehicle-transfer";

export default function VehicleTransferPage() {
  return (
    <AdminLayout>
      <div className="space-y-6 p-6">
        <div>
          <h1 className="text-3xl font-bold">Transferir Veículos</h1>
          <p className="text-gray-600 mt-2">
            Gerencie a propriedade dos veículos transferindo-os entre usuários. 
            Útil para organizar veículos importados sem vinculação correta.
          </p>
        </div>
        
        <VehicleTransfer />
      </div>
    </AdminLayout>
  );
}