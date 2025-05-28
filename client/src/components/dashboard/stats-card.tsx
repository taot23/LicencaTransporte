import { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatsCardProps {
  title: string;
  value: number;
  icon: ReactNode;
  trend?: number;
  trendText?: string;
  secondaryText?: string;
  color: "primary" | "yellow" | "blue" | "red";
}

export function StatsCard({ title, value, icon, trend, trendText, secondaryText, color }: StatsCardProps) {
  const colorClasses = {
    primary: {
      iconBg: "bg-blue-100",
      iconText: "text-blue-600",
      trendText: "text-green-600",
    },
    yellow: {
      iconBg: "bg-yellow-100",
      iconText: "text-yellow-600",
      trendText: "text-yellow-600",
    },
    blue: {
      iconBg: "bg-blue-100",
      iconText: "text-blue-600",
      trendText: "text-blue-600",
    },
    red: {
      iconBg: "bg-red-100",
      iconText: "text-red-600",
      trendText: "text-red-600",
    },
  };

  const classes = colorClasses[color];

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center">
          <div className={cn("p-3 rounded-full", classes.iconBg, classes.iconText)}>
            {icon}
          </div>
          <div className="ml-5">
            <p className="text-gray-500 text-sm">{title}</p>
            <h3 className="font-bold text-3xl text-gray-800">{value}</h3>
            {trend !== undefined && trendText && (
              <p className={cn("text-sm flex items-center", classes.trendText)}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                </svg>
                {trend}% {trendText}
              </p>
            )}
            {secondaryText && (
              <div className="flex items-center mt-1">
                <div className="h-2.5 w-2.5 rounded-full bg-green-500 mr-2"></div>
                <p className="text-sm text-gray-600">{secondaryText}</p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
