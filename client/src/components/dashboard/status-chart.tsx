import { useEffect, useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

interface ChartData {
  name: string;
  value: number;
}

interface StatusChartProps {
  type: "vehicle" | "state";
  isLoading: boolean;
}

export function StatusChart({ type, isLoading }: StatusChartProps) {
  const { data: chartData } = useQuery<ChartData[]>({
    queryKey: [type === "vehicle" ? "/api/dashboard/vehicle-stats" : "/api/dashboard/state-stats"],
    queryFn: async ({ queryKey }) => {
      const res = await fetch(queryKey[0] as string, {
        credentials: "include"
      });
      if (!res.ok) {
        throw new Error(`Erro ao buscar estatísticas de ${type === "vehicle" ? "veículos" : "estados"}`);
      }
      return res.json();
    }
  });

  const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884D8", "#82CA9D"];

  const renderChart = () => {
    if (isLoading || !chartData) {
      return (
        <div className="flex flex-col items-center justify-center h-full">
          <LoadingSpinner size="lg" color="primary" className="mb-4" />
          <p className="text-sm text-gray-500">
            Carregando {type === "vehicle" ? "estatísticas de veículos" : "dados por estados"}...
          </p>
        </div>
      );
    }

    if (type === "vehicle") {
      return (
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(value: number) => [value, 'Quantidade']} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      );
    } else {
      return (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{
              top: 5,
              right: 30,
              left: 20,
              bottom: 5,
            }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis tickFormatter={(value) => Math.floor(value).toString()} />
            <Tooltip />
            <Bar dataKey="value" fill="#3B82F6" />
          </BarChart>
        </ResponsiveContainer>
      );
    }
  };

  return (
    <div className="h-full">
      {renderChart()}
    </div>
  );
}
