import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export interface GamificationStats {
  id: number;
  userId: number;
  totalPoints: number;
  currentLevel: number;
  pointsToNextLevel: number;
  currentStreak: number;
  longestStreak: number;
  totalLicenses: number;
  totalVehicles: number;
  totalStatesUsed: number;
  totalRejections: number;
  perfectLicenseStreak: number;
  fastestApprovalDays?: number;
  monthlyLicenseCount: number;
}

export interface Achievement {
  id: number;
  userId: number;
  achievementType: string;
  achievementName: string;
  achievementDescription: string;
  pointsAwarded: number;
  iconName: string;
  badgeColor: string;
  unlockedAt: string;
  isViewed: boolean;
}

export interface ActivityLog {
  id: number;
  userId: number;
  activityType: string;
  activityDescription: string;
  pointsEarned: number;
  relatedEntityType?: string;
  relatedEntityId?: number;
  metadata?: any;
  createdAt: string;
}

export interface GamificationProfile {
  stats: GamificationStats;
  achievements: Achievement[];
  recentActivities: ActivityLog[];
  newAchievements: Achievement[];
}

export interface LeaderboardEntry {
  userId: number;
  fullName: string;
  totalPoints: number;
  currentLevel: number;
  totalLicenses: number;
}

export function useGamificationProfile() {
  return useQuery<GamificationProfile>({
    queryKey: ["/api/gamification/profile"],
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}

export function useLeaderboard() {
  return useQuery<LeaderboardEntry[]>({
    queryKey: ["/api/gamification/leaderboard"],
    refetchInterval: 60000, // Refresh every minute
  });
}

export function useMarkAchievementsViewed() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (achievementIds: number[]) => {
      const res = await apiRequest("POST", "/api/gamification/achievements/mark-viewed", {
        achievementIds
      });
      return res.json();
    },
    onSuccess: () => {
      // Invalidate gamification data to refresh
      queryClient.invalidateQueries({ queryKey: ["/api/gamification/profile"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: "Não foi possível atualizar as conquistas",
        variant: "destructive",
      });
    },
  });
}

// Helper function to get level info
export function getLevelInfo(level: number) {
  const levelNames = [
    "Iniciante", "Novato", "Explorador", "Experiente", "Especialista",
    "Veterano", "Expert", "Mestre", "Lenda", "Titã"
  ];
  
  const name = levelNames[Math.min(level - 1, levelNames.length - 1)] || "Supremo";
  
  // Level colors
  const colors = {
    1: "text-gray-600",
    2: "text-green-600",
    3: "text-blue-600",
    4: "text-purple-600",
    5: "text-orange-600",
    6: "text-red-600",
    7: "text-pink-600",
    8: "text-yellow-600",
    9: "text-indigo-600",
  };
  
  const color = colors[Math.min(level, 9) as keyof typeof colors] || "text-gradient-to-r from-purple-600 to-pink-600";
  
  return { name, color };
}

// Helper function to get badge color classes
export function getBadgeColorClasses(color: string) {
  const colorClasses = {
    gold: "bg-gradient-to-r from-yellow-400 to-orange-500 text-white",
    blue: "bg-gradient-to-r from-blue-500 to-cyan-500 text-white",
    purple: "bg-gradient-to-r from-purple-500 to-indigo-500 text-white",
    green: "bg-gradient-to-r from-green-500 to-emerald-500 text-white",
    orange: "bg-gradient-to-r from-orange-500 to-red-500 text-white",
    yellow: "bg-gradient-to-r from-yellow-400 to-yellow-600 text-white",
    pink: "bg-gradient-to-r from-pink-500 to-rose-500 text-white",
    rainbow: "bg-gradient-to-r from-red-500 via-purple-500 to-blue-500 text-white"
  };
  
  return colorClasses[color as keyof typeof colorClasses] || "bg-blue-500 text-white";
}