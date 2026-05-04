package sunanticheat.jobs;

import java.util.Map;

public record CustomJob(
        String id,
        String name,
        String description,
        String icon,
        int maxLevel,
        int baseXpPerLevel,
        double levelMultiplier,
        int antiFarmCooldownSeconds,
        boolean antiFarmEnabled,
        // actionType (break/kill/fish/craft) -> target (material/entity) -> reward
        Map<String, Map<String, JobAction>> actions
) {
    /** XP needed to reach the given level (1-indexed). Level 1 requires 0. */
    public long xpForLevel(int level) {
        if (level <= 1) return 0;
        double total = 0;
        for (int l = 2; l <= level; l++) {
            total += baseXpPerLevel * Math.pow(levelMultiplier, l - 2);
        }
        return Math.round(total);
    }

    /** XP needed to go from current level to next. */
    public long xpForNextLevel(int currentLevel) {
        return xpForLevel(currentLevel + 1) - xpForLevel(currentLevel);
    }

    public boolean isMaxLevel(int level) {
        return maxLevel > 0 && level >= maxLevel;
    }

    /** Reward multiplier at a given level. Level 1 = 1.0, each level adds 10%. */
    public double rewardMultiplier(int level) {
        return 1.0 + (level - 1) * 0.10;
    }
}
