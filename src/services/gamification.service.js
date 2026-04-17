const prisma = require("../config/prisma");

// XP thresholds for each level
const LEVEL_THRESHOLDS = [
  0,     // Level 1: 0 XP
  50,    // Level 2: 50 XP
  150,   // Level 3: 150 XP
  300,   // Level 4: 300 XP
  500,   // Level 5: 500 XP
  800,   // Level 6: 800 XP
  1200,  // Level 7: 1200 XP
  1800,  // Level 8: 1800 XP
  2500,  // Level 9: 2500 XP
  3500,  // Level 10: 3500 XP
];

const LEVEL_NAMES = [
  "Débutant",       // 1
  "Apprenti",       // 2
  "Intermédiaire",  // 3
  "Avancé",         // 4
  "Expert",         // 5
  "Maître",         // 6
  "Grand Maître",   // 7
  "Champion",       // 8
  "Légende",        // 9
  "Mythique",       // 10
];

function getLevelForXP(xp) {
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (xp >= LEVEL_THRESHOLDS[i]) return i + 1;
  }
  return 1;
}

function getLevelName(level) {
  return LEVEL_NAMES[Math.min(level - 1, LEVEL_NAMES.length - 1)] || "Mythique";
}

function getXPForNextLevel(level) {
  if (level >= LEVEL_THRESHOLDS.length) return null; // max level
  return LEVEL_THRESHOLDS[level]; // next level threshold
}

/**
 * GamificationService — XP, levels, badges, rewards.
 */
const GamificationService = {

  /**
   * Award XP + check level up + check badges after quiz completion.
   */
  async processQuizCompletion(userId, attemptId, { score, maxScore, duration, quizTitle, xpReward, couponReward, passingScore }) {
    const percentage = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
    const passed = percentage >= passingScore;

    let xpEarned = passed ? xpReward : Math.round(xpReward * 0.3); // 30% XP even if failed
    let couponsEarned = passed ? couponReward : 0;

    // Bonus XP for perfect score
    if (percentage === 100) xpEarned = Math.round(xpEarned * 1.5);

    // Update user stats
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        xp: { increment: xpEarned },
        totalPoints: { increment: score },
        coupons: { increment: couponsEarned },
      },
    });

    // Check level up
    const newLevel = getLevelForXP(user.xp);
    let leveledUp = false;
    if (newLevel > user.level) {
      await prisma.user.update({
        where: { id: userId },
        data: { level: newLevel },
      });
      leveledUp = true;

      // Notification
      await prisma.notification.create({
        data: {
          userId,
          type: "level_up",
          title: "Niveau supérieur !",
          message: `Félicitations ! Vous êtes maintenant niveau ${newLevel} — ${getLevelName(newLevel)} !`,
        },
      });
    }

    // Update attempt
    await prisma.attempt.update({
      where: { id: attemptId },
      data: { passed, xpEarned, couponsEarned },
    });

    // Points history
    await prisma.pointsHistory.create({
      data: {
        userId,
        points: score,
        reason: `Quiz terminé : ${quizTitle}`,
        attemptId,
      },
    });

    // Check badges
    const newBadges = await this.checkBadges(userId);

    return {
      xpEarned,
      couponsEarned,
      passed,
      leveledUp,
      newLevel: leveledUp ? newLevel : user.level,
      levelName: getLevelName(leveledUp ? newLevel : user.level),
      newBadges,
    };
  },

  /**
   * Check and award any new badges the user qualifies for.
   */
  async checkBadges(userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        totalPoints: true,
        xp: true,
        level: true,
        badges: { select: { badgeId: true } },
        _count: {
          select: {
            attempts: { where: { completedAt: { not: null } } },
            orders: true,
          },
        },
      },
    });

    const earnedBadgeIds = new Set(user.badges.map((b) => b.badgeId));
    const allBadges = await prisma.badge.findMany();

    // Check perfect scores
    const perfectScores = await prisma.attempt.count({
      where: { userId, completedAt: { not: null }, passed: true, score: { gt: 0 } },
    });

    // Check speed completions
    const speedCompletions = await prisma.attempt.count({
      where: { userId, completedAt: { not: null }, duration: { lt: 60, gt: 0 } },
    });

    const completedQuizzes = user._count.attempts;
    const completedOrders = user._count.orders;

    const newBadges = [];

    for (const badge of allBadges) {
      if (earnedBadgeIds.has(badge.id)) continue;

      const [type, value] = badge.condition.split(":");
      const threshold = parseInt(value, 10);
      let qualified = false;

      switch (type) {
        case "quizzes_completed":
          qualified = completedQuizzes >= threshold;
          break;
        case "perfect_score":
          qualified = perfectScores >= threshold;
          break;
        case "orders_completed":
          qualified = completedOrders >= threshold;
          break;
        case "level_reached":
          qualified = user.level >= threshold;
          break;
        case "speed_completion":
          qualified = speedCompletions >= 1;
          break;
        case "total_points":
          qualified = user.totalPoints >= threshold;
          break;
        case "win_streak":
          // Simplified: check last N attempts passed
          const recentAttempts = await prisma.attempt.findMany({
            where: { userId, completedAt: { not: null } },
            orderBy: { completedAt: "desc" },
            take: threshold,
            select: { passed: true },
          });
          qualified = recentAttempts.length >= threshold && recentAttempts.every((a) => a.passed);
          break;
      }

      if (qualified) {
        await prisma.userBadge.create({
          data: { userId, badgeId: badge.id },
        });

        if (badge.xpReward > 0) {
          await prisma.user.update({
            where: { id: userId },
            data: { xp: { increment: badge.xpReward } },
          });
        }

        await prisma.notification.create({
          data: {
            userId,
            type: "badge_earned",
            title: "Badge débloqué !",
            message: `Vous avez obtenu le badge "${badge.name}" ${badge.icon} ! +${badge.xpReward} XP`,
          },
        });

        newBadges.push({ id: badge.id, name: badge.name, icon: badge.icon, xpReward: badge.xpReward });
      }
    }

    return newBadges;
  },

  /**
   * Get user gamification profile.
   */
  async getProfile(userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        xp: true,
        level: true,
        totalPoints: true,
        coupons: true,
        badges: {
          include: { badge: true },
          orderBy: { earnedAt: "desc" },
        },
      },
    });

    if (!user) return null;

    const currentLevel = user.level;
    const xpForNext = getXPForNextLevel(currentLevel);
    const currentThreshold = LEVEL_THRESHOLDS[currentLevel - 1] || 0;

    return {
      xp: user.xp,
      level: currentLevel,
      levelName: getLevelName(currentLevel),
      totalPoints: user.totalPoints,
      coupons: user.coupons,
      xpForNextLevel: xpForNext,
      xpProgress: xpForNext ? Math.round(((user.xp - currentThreshold) / (xpForNext - currentThreshold)) * 100) : 100,
      badges: user.badges.map((ub) => ({
        id: ub.badge.id,
        name: ub.badge.name,
        description: ub.badge.description,
        icon: ub.badge.icon,
        earnedAt: ub.earnedAt,
      })),
      allLevels: LEVEL_THRESHOLDS.map((xp, i) => ({
        level: i + 1,
        name: LEVEL_NAMES[i],
        xpRequired: xp,
        reached: user.xp >= xp,
      })),
    };
  },

  /**
   * Get all badges with earned status for a user.
   */
  async getAllBadges(userId) {
    const [allBadges, userBadges] = await prisma.$transaction([
      prisma.badge.findMany({ orderBy: { id: "asc" } }),
      prisma.userBadge.findMany({
        where: { userId },
        select: { badgeId: true, earnedAt: true },
      }),
    ]);

    const earnedMap = new Map(userBadges.map((ub) => [ub.badgeId, ub.earnedAt]));

    return allBadges.map((badge) => ({
      id: badge.id,
      name: badge.name,
      description: badge.description,
      icon: badge.icon,
      xpReward: badge.xpReward,
      earned: earnedMap.has(badge.id),
      earnedAt: earnedMap.get(badge.id) || null,
    }));
  },

  LEVEL_THRESHOLDS,
  LEVEL_NAMES,
  getLevelForXP,
  getLevelName,
};

module.exports = GamificationService;
