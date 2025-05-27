import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { insertVehicleModelSchema, type InsertVehicleModel, type VehicleModel, vehicleTypeOptions } from "@shared/schema";

interface VehicleModelFormProps {
  initialData?: VehicleModel;
  onSubmit: (data: InsertVehicleModel) => void;
  onCancel: () => void;
  isSubmitting: boolean;
}

export function VehicleModelForm({ initialData, onSubmit, onCancel, isSubmitting }: VehicleModelFormProps) {
  const form = useForm<InsertVehicleModel>({
    resolver: zodResolver(insertVehicleModelSchema),
    defaultValues: {
      brand: initialData?.brand || "",
      model: initialData?.model || "",
      vehicleType: initialData?.vehicleType || "tractor_unit",
    },
  });

  const handleSubmit = (data: InsertVehicleModel) => {
    onSubmit(data);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="brand"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Marca *</FormLabel>
              <FormControl>
                <Input
                  placeholder="Ex: Mercedes-Benz, Volvo, Scania..."
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="model"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Modelo *</FormLabel>
              <FormControl>
                <Input
                  placeholder="Ex: Actros, FH, R450..."
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="vehicleType"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tipo de Veículo *</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo de veículo" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {vehicleTypeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Salvando..." : initialData ? "Atualizar" : "Criar"}
          </Button>
        </div>
      </form>
    </Form>
  );
}