import { AntRole, type AntTemplate } from './combat/antTypes';

export const ANT_TEMPLATES: Record<AntRole, AntTemplate> = {
  [AntRole.WORKER]: {
    role: AntRole.WORKER,
    base: {
      hp: 6,
      damage: 0,
      attackRange: 0,
      attackCooldownSeconds: 1.0,
      speed: 20,
      cost: 8,
      popCost: 1,
    },
    hpScale: 1.08,
    damageScale: 1.03,
    speedScale: 1.01,
    costGrowth: 1.06,
  },
  [AntRole.GUARDIAN]: {
    role: AntRole.GUARDIAN,
    base: {
      hp: 44,
      damage: 3,
      attackRange: 6,
      attackCooldownSeconds: 1.2,
      speed: 18,
      cost: 40,
      popCost: 2,
    },
    hpScale: 1.18,
    damageScale: 1.08,
    speedScale: 1.02,
    costGrowth: 1.12,
  },
  [AntRole.RAIDER]: {
    role: AntRole.RAIDER,
    base: {
      hp: 16,
      damage: 6,
      attackRange: 6,
      attackCooldownSeconds: 1.0,
      speed: 32,
      cost: 30,
      popCost: 1,
    },
    hpScale: 1.15,
    damageScale: 1.10,
    speedScale: 1.03,
    costGrowth: 1.10,
  },
  [AntRole.SPITTER]: {
    role: AntRole.SPITTER,
    base: {
      hp: 10,
      damage: 4,
      attackRange: 18,
      attackCooldownSeconds: 1.6,
      speed: 24,
      cost: 45,
      popCost: 1,
    },
    hpScale: 1.12,
    damageScale: 1.09,
    speedScale: 1.02,
    costGrowth: 1.11,
  },
};

export const WORKER_TUNING = {
  pixelSize: 1,
  searchSpeed: 26,
  returnSpeed: 44,
  idleRadius: 18,
  nestIdleRadius: 8,
  turnChance: 0.015,
  idleReturnMinSeconds: 60,
  idleReturnMaxSeconds: 180,
  maxHealth: 8,
  homeDefenseAlertRadius: 34,
  homeDefenseMoveSpeedMultiplier: 1.1,
} as const;

export const PLAYER_SOLDIER_TUNING = {
  defendScanRadiusBase: 120,
  guardianDefendScanRadiusBase: 54,
  assaultEngageRadius: 84,
  spitterPreferredThreatDistance: 15,
  spitterDistanceTolerance: 1.5,
  guardianDamageTakenMultiplier: 0.72,
  guardianTauntRadiusDefend: 26,
  guardianTauntRadiusAssault: 20,
  guardianDefenseHoldRadius: 20,
} as const;

export const ENEMY_ANT_TUNING = {
  baseHealth: 12,
  baseDamage: 2,
  baseSpeed: 30,
  baseAttackCooldownSeconds: 1.2,
  baseAttackRange: 7,
  healthScalePerLevel: 1.22,
  damageScalePerLevel: 1.12,
  speedScalePerLevel: 1.03,
} as const;

export const ENEMY_ROLE_TUNING = {
  BRUTE: {
    healthMultiplier: 1.55,
    damageMultiplier: 1.22,
    speedMultiplier: 0.82,
    cooldownMultiplier: 1.1,
  },
  SPITTER: {
    healthMultiplier: 0.88,
    damageMultiplier: 1.08,
    speedMultiplier: 1,
    cooldownMultiplier: 1.15,
  },
  RUNNER: {
    healthMultiplier: 0.78,
    damageMultiplier: 0.94,
    speedMultiplier: 1.35,
    cooldownMultiplier: 0.88,
  },
} as const;

export const ENEMY_TACTIC_TUNING = {
  RAID: {
    speedMultiplier: 1.08,
    damageMultiplier: 1,
  },
  HARASS: {
    speedMultiplier: 1,
    damageMultiplier: 1,
    orbitRadiusOffset: 120,
    runnerOrbitRadiusOffset: 86,
    runnerChargeDelaySeconds: 20,
    runnerOrbitSafetyBuffer: 8,
    runnerOrbitRadialCorrection: 0.8,
  },
  SIEGE: {
    speedMultiplier: 1,
    damageMultiplier: 1.06,
  },
} as const;

export const ANT_COMBAT_TUNING = {
  enemyGlobalCap: 90,
  workerAttackDamagePerSecond: 1,
  workerAttackRange: 7,
  enemyMarchWorkerHuntRange: 13,
  workerRetaliateDamage: 1,
  workerNestDefenseBonusDps: 1,
  workerNestDefenseBonusRange: 3,
  enemyWaveBaseIntervalSeconds: 22,
  enemyWaveIntervalDecayPerLevel: 0.97,
  enemyWaveMinIntervalSeconds: 9,
  enemyWaveMaxSpawnPerTick: 2,
} as const;
