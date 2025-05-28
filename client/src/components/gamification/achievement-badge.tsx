import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import * as LucideIcons from "lucide-react";
import { Achievement, getBadgeColorClasses } from "@/hooks/use-gamification";

interface AchievementBadgeProps {
  achievement: Achievement;
  size?: "sm" | "md" | "lg";
  showDescription?: boolean;
  isNew?: boolean;
}

export function AchievementBadge({ 
  achievement, 
  size = "md", 
  showDescription = true,
  isNew = false 
}: AchievementBadgeProps) {
  const IconComponent = (LucideIcons as any)[achievement.iconName] || LucideIcons.Trophy;
  
  const sizeClasses = {
    sm: "h-12 w-12",
    md: "h-16 w-16", 
    lg: "h-20 w-20"
  };
  
  const iconSizes = {
    sm: 16,
    md: 20,
    lg: 24
  };

  return (
    <Card className={cn(
      "relative overflow-hidden transition-all duration-300 hover:scale-105",
      isNew && "ring-2 ring-yellow-400 animate-pulse",
      !achievement.isViewed && "ring-1 ring-blue-400"
    )}>
      {isNew && (
        <div className="absolute -top-1 -right-1 z-10">
          <Badge className="bg-yellow-500 text-white text-xs animate-bounce">
            NOVO!
          </Badge>
        </div>
      )}
      
      <CardContent className="p-4 text-center">
        <div className={cn(
          "mx-auto mb-3 rounded-full flex items-center justify-center",
          sizeClasses[size],
          getBadgeColorClasses(achievement.badgeColor)
        )}>
          <IconComponent size={iconSizes[size]} className="text-white" />
        </div>
        
        <h3 className="font-semibold text-sm mb-1">
          {achievement.achievementName}
        </h3>
        
        {showDescription && (
          <p className="text-xs text-muted-foreground mb-2">
            {achievement.achievementDescription}
          </p>
        )}
        
        <Badge variant="secondary" className="text-xs">
          +{achievement.pointsAwarded} pts
        </Badge>
        
        <p className="text-xs text-muted-foreground mt-2">
          {new Date(achievement.unlockedAt).toLocaleDateString('pt-BR')}
        </p>
      </CardContent>
    </Card>
  );
}