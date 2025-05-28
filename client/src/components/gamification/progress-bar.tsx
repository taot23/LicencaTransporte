import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Zap, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { GamificationStats, getLevelInfo } from "@/hooks/use-gamification";

interface ProgressBarProps {
  stats: GamificationStats;
  className?: string;
}

export function ProgressBar({ stats, className }: ProgressBarProps) {
  const progressPercentage = stats.pointsToNextLevel > 0 
    ? ((100 - (stats.pointsToNextLevel / (stats.totalPoints + stats.pointsToNextLevel)) * 100))
    : 100;

  const levelInfo = getLevelInfo(stats.currentLevel);

  return (
    <Card className={cn("overflow-hidden bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Star className="h-5 w-5 text-yellow-500" />
            Nível {stats.currentLevel}
          </CardTitle>
          <Badge className={cn("text-white", levelInfo.color)}>
            {levelInfo.name}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1">
              <Zap className="h-4 w-4 text-yellow-500" />
              {stats.totalPoints.toLocaleString()} pontos
            </span>
            <span className="text-muted-foreground">
              {stats.pointsToNextLevel > 0 
                ? `${stats.pointsToNextLevel} para próximo nível`
                : "Nível máximo!"
              }
            </span>
          </div>
          
          <Progress 
            value={progressPercentage} 
            className="h-3 bg-gray-200 dark:bg-gray-700"
          />
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="text-center p-2 bg-white/50 dark:bg-gray-800/50 rounded-lg">
            <div className="font-semibold text-green-600">{stats.totalLicenses}</div>
            <div className="text-muted-foreground">Licenças</div>
          </div>
          
          <div className="text-center p-2 bg-white/50 dark:bg-gray-800/50 rounded-lg">
            <div className="font-semibold text-blue-600">{stats.totalVehicles}</div>
            <div className="text-muted-foreground">Veículos</div>
          </div>
        </div>

        {stats.currentStreak > 0 && (
          <div className="text-center p-3 bg-gradient-to-r from-orange-100 to-yellow-100 dark:from-orange-900 dark:to-yellow-900 rounded-lg">
            <div className="flex items-center justify-center gap-2">
              <span className="text-2xl">🔥</span>
              <div>
                <div className="font-semibold text-orange-600">
                  {stats.currentStreak} dias de sequência!
                </div>
                <div className="text-xs text-muted-foreground">
                  Continue assim para manter o ritmo
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}