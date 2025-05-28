import { db } from "./db";
import { users, userGamificationStats, userAchievements, userActivityLog, licenseRequests, vehicles } from "@shared/schema";
import { eq, and, gte, lte, count, sql } from "drizzle-orm";
import type { 
  UserGamificationStats, 
  InsertUserGamificationStats, 
  UserAchievement, 
  InsertUserAchievement,
  InsertUserActivityLog,
  AchievementType 
} from "@shared/schema";

export class GamificationService {
  
  // Achievement definitions with exciting rewards!
  private achievementDefinitions = {
    first_license: {
      name: "Primeira Jornada",
      description: "Criou sua primeira licença AET!",
      points: 100,
      icon: "Trophy",
      color: "gold"
    },
    vehicle_master: {
      name: "Mestre dos Veículos",
      description: "Cadastrou 10 ou mais veículos",
      points: 250,
      icon: "Truck",
      color: "blue"
    },
    license_streak: {
      name: "Sequência Perfeita",
      description: "Criou 5 licenças em sequência",
      points: 300,
      icon: "Zap",
      color: "purple"
    },
    state_explorer: {
      name: "Explorador de Estados",
      description: "Obteve licenças em 3 ou mais estados",
      points: 200,
      icon: "Map",
      color: "green"
    },
    veteran: {
      name: "Veterano AET",
      description: "Impressionantes 50+ licenças criadas!",
      points: 1000,
      icon: "Crown",
      color: "gold"
    },
    speed_demon: {
      name: "Raio da Velocidade",
      description: "Licença aprovada em menos de 5 dias",
      points: 150,
      icon: "Rocket",
      color: "orange"
    },
    perfect_record: {
      name: "Histórico Perfeito",
      description: "10 licenças consecutivas sem rejeição",
      points: 500,
      icon: "Star",
      color: "yellow"
    },
    early_bird: {
      name: "Madrugador",
      description: "Primeira licença criada hoje",
      points: 50,
      icon: "Sunrise",
      color: "pink"
    },
    monthly_champion: {
      name: "Campeão do Mês",
      description: "Mais licenças criadas no mês",
      points: 400,
      icon: "Medal",
      color: "gold"
    },
    diversity_master: {
      name: "Mestre da Diversidade",
      description: "Usou todos os tipos de veículo",
      points: 350,
      icon: "Package",
      color: "rainbow"
    }
  };

  // Calculate level based on points
  private calculateLevel(points: number): { level: number; pointsToNext: number } {
    // Level progression: 100, 250, 500, 1000, 1500, 2500, 4000, 6000, 10000, 15000...
    const levels = [0, 100, 250, 500, 1000, 1500, 2500, 4000, 6000, 10000, 15000];
    
    let level = 1;
    for (let i = levels.length - 1; i >= 0; i--) {
      if (points >= levels[i]) {
        level = i + 1;
        break;
      }
    }
    
    const nextLevelPoints = levels[level] || levels[levels.length - 1] + (level - levels.length + 1) * 5000;
    const pointsToNext = Math.max(0, nextLevelPoints - points);
    
    return { level, pointsToNext };
  }

  // Initialize gamification stats for new user
  async initializeUserStats(userId: number): Promise<UserGamificationStats> {
    const existingStats = await db.select()
      .from(userGamificationStats)
      .where(eq(userGamificationStats.userId, userId))
      .limit(1);

    if (existingStats.length > 0) {
      return existingStats[0];
    }

    const [newStats] = await db.insert(userGamificationStats)
      .values({
        userId,
        totalPoints: 0,
        currentLevel: 1,
        pointsToNextLevel: 100,
        currentStreak: 0,
        longestStreak: 0,
        totalLicenses: 0,
        totalVehicles: 0,
        totalStatesUsed: 0,
        totalRejections: 0,
        perfectLicenseStreak: 0,
        monthlyLicenseCount: 0
      })
      .returning();

    return newStats;
  }

  // Award points and check for level up
  async awardPoints(userId: number, points: number, activityType: string, description: string, relatedEntityType?: string, relatedEntityId?: number): Promise<{ levelUp: boolean; newLevel?: number }> {
    const stats = await this.initializeUserStats(userId);
    
    const newTotalPoints = stats.totalPoints + points;
    const levelInfo = this.calculateLevel(newTotalPoints);
    
    const levelUp = levelInfo.level > stats.currentLevel;
    
    await db.update(userGamificationStats)
      .set({
        totalPoints: newTotalPoints,
        currentLevel: levelInfo.level,
        pointsToNextLevel: levelInfo.pointsToNext,
        updatedAt: new Date()
      })
      .where(eq(userGamificationStats.userId, userId));

    // Log the activity
    await db.insert(userActivityLog).values({
      userId,
      activityType,
      activityDescription: description,
      pointsEarned: points,
      relatedEntityType,
      relatedEntityId,
      metadata: { pointsAwarded: points, totalPoints: newTotalPoints }
    });

    return { levelUp, newLevel: levelUp ? levelInfo.level : undefined };
  }

  // Award achievement
  async awardAchievement(userId: number, achievementType: AchievementType): Promise<UserAchievement | null> {
    // Check if user already has this achievement
    const existing = await db.select()
      .from(userAchievements)
      .where(and(
        eq(userAchievements.userId, userId),
        eq(userAchievements.achievementType, achievementType)
      ))
      .limit(1);

    if (existing.length > 0) {
      return null; // Already has this achievement
    }

    const definition = this.achievementDefinitions[achievementType];
    if (!definition) {
      return null;
    }

    // Award the achievement
    const [achievement] = await db.insert(userAchievements)
      .values({
        userId,
        achievementType,
        achievementName: definition.name,
        achievementDescription: definition.description,
        pointsAwarded: definition.points,
        iconName: definition.icon,
        badgeColor: definition.color
      })
      .returning();

    // Award points for the achievement
    await this.awardPoints(
      userId, 
      definition.points, 
      'achievement_unlocked', 
      `Conquista desbloqueada: ${definition.name}`,
      'achievement',
      achievement.id
    );

    return achievement;
  }

  // Check and award achievements based on user activity
  async checkAchievements(userId: number): Promise<UserAchievement[]> {
    const newAchievements: UserAchievement[] = [];
    
    // Get user stats
    const stats = await this.getUserStats(userId);
    
    // Get user data for checks
    const userLicenses = await db.select()
      .from(licenseRequests)
      .where(eq(licenseRequests.userId, userId));
      
    const userVehicles = await db.select()
      .from(vehicles)
      .where(eq(vehicles.userId, userId));

    // Check first license
    if (userLicenses.length >= 1) {
      const achievement = await this.awardAchievement(userId, 'first_license');
      if (achievement) newAchievements.push(achievement);
    }

    // Check vehicle master (10+ vehicles)
    if (userVehicles.length >= 10) {
      const achievement = await this.awardAchievement(userId, 'vehicle_master');
      if (achievement) newAchievements.push(achievement);
    }

    // Check state explorer (3+ different states)
    const statesUsed = new Set();
    userLicenses.forEach(license => {
      if (license.states && Array.isArray(license.states)) {
        license.states.forEach(state => statesUsed.add(state));
      }
    });
    
    if (statesUsed.size >= 3) {
      const achievement = await this.awardAchievement(userId, 'state_explorer');
      if (achievement) newAchievements.push(achievement);
    }

    // Check veteran (50+ licenses)
    if (userLicenses.filter(l => !l.isDraft).length >= 50) {
      const achievement = await this.awardAchievement(userId, 'veteran');
      if (achievement) newAchievements.push(achievement);
    }

    // Check diversity master (all vehicle types used)
    const vehicleTypes = new Set(userVehicles.map(v => v.type));
    const allTypes = ['tractor_unit', 'truck', 'semi_trailer', 'trailer', 'dolly', 'flatbed'];
    if (allTypes.every(type => vehicleTypes.has(type))) {
      const achievement = await this.awardAchievement(userId, 'diversity_master');
      if (achievement) newAchievements.push(achievement);
    }

    // Update stats
    await db.update(userGamificationStats)
      .set({
        totalLicenses: userLicenses.filter(l => !l.isDraft).length,
        totalVehicles: userVehicles.length,
        totalStatesUsed: statesUsed.size,
        updatedAt: new Date()
      })
      .where(eq(userGamificationStats.userId, userId));

    return newAchievements;
  }

  // Get user stats
  async getUserStats(userId: number): Promise<UserGamificationStats> {
    return await this.initializeUserStats(userId);
  }

  // Get user achievements
  async getUserAchievements(userId: number): Promise<UserAchievement[]> {
    return await db.select()
      .from(userAchievements)
      .where(eq(userAchievements.userId, userId))
      .orderBy(sql`${userAchievements.unlockedAt} DESC`);
  }

  // Get recent activities
  async getRecentActivities(userId: number, limit: number = 10) {
    return await db.select()
      .from(userActivityLog)
      .where(eq(userActivityLog.userId, userId))
      .orderBy(sql`${userActivityLog.createdAt} DESC`)
      .limit(limit);
  }

  // Mark achievements as viewed
  async markAchievementsViewed(userId: number, achievementIds: number[]): Promise<void> {
    await db.update(userAchievements)
      .set({ isViewed: true })
      .where(and(
        eq(userAchievements.userId, userId),
        sql`${userAchievements.id} = ANY(${achievementIds})`
      ));
  }

  // Get leaderboard
  async getLeaderboard(limit: number = 10) {
    return await db.select({
      userId: userGamificationStats.userId,
      fullName: users.fullName,
      totalPoints: userGamificationStats.totalPoints,
      currentLevel: userGamificationStats.currentLevel,
      totalLicenses: userGamificationStats.totalLicenses
    })
    .from(userGamificationStats)
    .leftJoin(users, eq(userGamificationStats.userId, users.id))
    .orderBy(sql`${userGamificationStats.totalPoints} DESC`)
    .limit(limit);
  }
}

export const gamificationService = new GamificationService();