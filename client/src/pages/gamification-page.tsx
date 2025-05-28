import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trophy, Star, Zap, Activity, Users, Target } from "lucide-react";
import { 
  useGamificationProfile, 
  useLeaderboard, 
  useMarkAchievementsViewed,
  Achievement 
} from "@/hooks/use-gamification";
import { AchievementBadge } from "@/components/gamification/achievement-badge";
import { ProgressBar } from "@/components/gamification/progress-bar";
import { useToast } from "@/hooks/use-toast";

export default function GamificationPage() {
  const { data: profile, isLoading: profileLoading } = useGamificationProfile();
  const { data: leaderboard, isLoading: leaderboardLoading } = useLeaderboard();
  const markViewed = useMarkAchievementsViewed();
  const { toast } = useToast();
  const [newAchievements, setNewAchievements] = useState<Achievement[]>([]);

  // Show new achievements notification
  useEffect(() => {
    if (profile?.newAchievements && profile.newAchievements.length > 0) {
      setNewAchievements(profile.newAchievements);
      
      // Show toast for new achievements
      profile.newAchievements.forEach(achievement => {
        toast({
          title: "🎉 Nova Conquista Desbloqueada!",
          description: `${achievement.achievementName}: ${achievement.achievementDescription}`,
          duration: 5000,
        });
      });

      // Mark as viewed after 3 seconds
      setTimeout(() => {
        const achievementIds = profile.newAchievements.map(a => a.id);
        markViewed.mutate(achievementIds);
        setNewAchievements([]);
      }, 3000);
    }
  }, [profile?.newAchievements, markViewed, toast]);

  if (profileLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-6 text-center">
            <Trophy className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-semibold mb-2">Sistema de Gamificação</h2>
            <p className="text-muted-foreground">
              Erro ao carregar dados de gamificação. Tente novamente.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold flex items-center justify-center gap-2">
          <Trophy className="h-8 w-8 text-yellow-500" />
          Sistema de Conquistas
        </h1>
        <p className="text-muted-foreground">
          Acompanhe seu progresso e desbloqueie conquistas incríveis!
        </p>
      </div>

      {/* Progress Overview */}
      <ProgressBar stats={profile.stats} />

      {/* New Achievements Alert */}
      {newAchievements.length > 0 && (
        <Card className="border-yellow-400 bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-950 dark:to-orange-950">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-yellow-700 dark:text-yellow-300">
              <Star className="h-5 w-5 animate-bounce" />
              Novas Conquistas Desbloqueadas!
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {newAchievements.map((achievement) => (
                <AchievementBadge 
                  key={achievement.id} 
                  achievement={achievement} 
                  isNew={true}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content Tabs */}
      <Tabs defaultValue="achievements" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="achievements" className="flex items-center gap-2">
            <Trophy className="h-4 w-4" />
            Conquistas
          </TabsTrigger>
          <TabsTrigger value="activity" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Atividades
          </TabsTrigger>
          <TabsTrigger value="leaderboard" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Ranking
          </TabsTrigger>
        </TabsList>

        {/* Achievements Tab */}
        <TabsContent value="achievements" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5" />
                Suas Conquistas ({profile.achievements.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {profile.achievements.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {profile.achievements.map((achievement) => (
                    <AchievementBadge key={achievement.id} achievement={achievement} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Target className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-semibold mb-2">Nenhuma conquista ainda</h3>
                  <p className="text-muted-foreground">
                    Comece criando licenças e cadastrando veículos para desbloquear suas primeiras conquistas!
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Activity Tab */}
        <TabsContent value="activity" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Atividades Recentes
              </CardTitle>
            </CardHeader>
            <CardContent>
              {profile.recentActivities.length > 0 ? (
                <div className="space-y-3">
                  {profile.recentActivities.map((activity) => (
                    <div key={activity.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                        <div>
                          <p className="font-medium">{activity.activityDescription}</p>
                          <p className="text-sm text-muted-foreground">
                            {new Date(activity.createdAt).toLocaleString('pt-BR')}
                          </p>
                        </div>
                      </div>
                      {activity.pointsEarned > 0 && (
                        <Badge variant="secondary" className="flex items-center gap-1">
                          <Zap className="h-3 w-3" />
                          +{activity.pointsEarned}
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Activity className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-semibold mb-2">Nenhuma atividade registrada</h3>
                  <p className="text-muted-foreground">
                    Suas atividades na plataforma aparecerão aqui.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Leaderboard Tab */}
        <TabsContent value="leaderboard" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Ranking Global
              </CardTitle>
            </CardHeader>
            <CardContent>
              {leaderboardLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : leaderboard && leaderboard.length > 0 ? (
                <div className="space-y-2">
                  {leaderboard.map((entry, index) => (
                    <div key={entry.userId} className={`flex items-center justify-between p-4 rounded-lg ${
                      index === 0 ? 'bg-gradient-to-r from-yellow-100 to-orange-100 dark:from-yellow-900 dark:to-orange-900' :
                      index === 1 ? 'bg-gradient-to-r from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700' :
                      index === 2 ? 'bg-gradient-to-r from-orange-100 to-yellow-100 dark:from-orange-900 dark:to-yellow-900' :
                      'bg-muted/50'
                    }`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                          index === 0 ? 'bg-yellow-500 text-white' :
                          index === 1 ? 'bg-gray-400 text-white' :
                          index === 2 ? 'bg-orange-500 text-white' :
                          'bg-muted text-muted-foreground'
                        }`}>
                          {index + 1}
                        </div>
                        <div>
                          <p className="font-semibold">{entry.fullName}</p>
                          <p className="text-sm text-muted-foreground">
                            Nível {entry.currentLevel} • {entry.totalLicenses} licenças
                          </p>
                        </div>
                      </div>
                      <Badge variant="secondary" className="flex items-center gap-1">
                        <Zap className="h-3 w-3" />
                        {entry.totalPoints.toLocaleString()}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-semibold mb-2">Ranking em breve</h3>
                  <p className="text-muted-foreground">
                    O ranking será exibido quando mais usuários começarem a usar o sistema.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}