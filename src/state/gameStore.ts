import { create } from 'zustand';
import {
  BASE_POPULATION_CAPACITY,
  BASE_PLAYER_NEST_MAX_HEALTH,
  MAX_UPGRADE_LEVEL,
  POPULATION_CAPACITY_PER_LEVEL,
  getPlayerNestMaxHealth,
} from '../game/upgradeBalances';
import type { PersistedGameState } from './gamePersistence';
import type { GameEngineSnapshot } from '../game/engine/GameEngine';
import type { AntRole, SquadMode } from '../game/combat/antTypes';

export const INITIAL_FOOD_AMOUNT = 500;

export type UpgradeKey =
  | 'queenSpawnRate'
  | 'carryCapacity'
  | 'antSpeed'
  | 'nestRecovery'
  | 'nestMaxHealth'
  | 'foodCapacity'
  | 'forageRadius'
  | 'populationCapacity'
  | 'soldierDamage'
  | 'soldierHealth'
  | 'soldierSpeed'
  | 'soldierTauntRange'
  | 'soldierAttackRange'
  | 'soldierAttackCooldown';

export interface UpgradeState {
  queenSpawnRate: number;
  carryCapacity: number;
  antSpeed: number;
  nestRecovery: number;
  nestMaxHealth: number;
  foodCapacity: number;
  forageRadius: number;
  populationCapacity: number;
  soldierDamage: number;
  soldierHealth: number;
  soldierSpeed: number;
  soldierTauntRange: number;
  soldierAttackRange: number;
  soldierAttackCooldown: number;
}

export interface BattleDeployment {
  id: string;
  composition: Partial<Record<AntRole, number>>;
  mode: SquadMode;
  createdAt: number;
}

interface GameState {
  colonySize: number;
  foodAmount: number;
  nestHealth: number;
  nextEnemyWaveInSeconds: number;
  engineState: GameEngineSnapshot | null;
  lastNestHitAt: number;
  battleDeployments: BattleDeployment[];
  upgradeLevels: UpgradeState;
  hydrateFromPersistence: (state: PersistedGameState) => void;
  syncColonySize: (amount: number) => void;
  incrementColonySize: (amount?: number) => void;
  loseColonySize: (amount?: number) => void;
  setNestHealth: (health: number) => void;
  setNextEnemyWaveInSeconds: (seconds: number) => void;
  setEngineState: (state: GameEngineSnapshot | null) => void;
  notifyNestHit: () => void;
  enqueueBattleDeployment: (deployment: Omit<BattleDeployment, 'id' | 'createdAt'>) => string;
  pullBattleDeployments: () => BattleDeployment[];
  earnFood: (amount: number) => void;
  spendFood: (amount: number) => boolean;
  purchaseUpgrade: (upgradeKey: UpgradeKey) => boolean;
  upgradeCost: (upgradeKey: UpgradeKey) => number;
}

const UPGRADE_BASE_COST: Record<UpgradeKey, number> = {
  queenSpawnRate: 25,
  carryCapacity: 25,
  antSpeed: 25,
  nestRecovery: 28,
  nestMaxHealth: 58,
  foodCapacity: 30,
  forageRadius: 35,
  populationCapacity: 55,
  soldierDamage: 20,
  soldierHealth: 20,
  soldierSpeed: 20,
  soldierTauntRange: 20,
  soldierAttackRange: 20,
  soldierAttackCooldown: 20,
};

const UPGRADE_COST_TIER_SIZE = 10;
const UPGRADE_COST_GROWTH_PER_TIER = 1.45;

function calculateCost(baseCost: number, level: number) {
  const safeLevel = Math.max(0, Math.floor(level));
  const tier = Math.floor(safeLevel / UPGRADE_COST_TIER_SIZE);
  return Math.floor(baseCost * Math.pow(UPGRADE_COST_GROWTH_PER_TIER, tier));
}

function clampUpgradeLevel(level: number) {
  return Math.min(MAX_UPGRADE_LEVEL, Math.max(0, Math.floor(level)));
}

export const useGameStore = create<GameState>((set, get) => ({
  colonySize: 12,
  foodAmount: INITIAL_FOOD_AMOUNT,
  nestHealth: 100,
  nextEnemyWaveInSeconds: 0,
  engineState: null,
  lastNestHitAt: 0,
  battleDeployments: [],
  upgradeLevels: {
    queenSpawnRate: 0,
    carryCapacity: 0,
    antSpeed: 0,
    nestRecovery: 0,
    nestMaxHealth: 0,
    foodCapacity: 0,
    forageRadius: 0,
    populationCapacity: 0,
    soldierDamage: 0,
    soldierHealth: 0,
    soldierSpeed: 0,
    soldierTauntRange: 0,
    soldierAttackRange: 0,
    soldierAttackCooldown: 0,
  },
  hydrateFromPersistence: (state) => {
    const nestMaxHealthLevel = clampUpgradeLevel((state.upgradeLevels as Partial<UpgradeState>).nestMaxHealth ?? 0);
    const maxNestHealth = getPlayerNestMaxHealth(nestMaxHealthLevel);

    set({
      colonySize: Math.max(0, Math.floor(state.colonySize)),
      foodAmount: Math.max(0, Math.floor(state.foodAmount)),
      nestHealth: Math.max(0, Math.min(maxNestHealth, Math.floor(state.nestHealth))),
      nextEnemyWaveInSeconds: Math.max(0, Math.floor(state.nextEnemyWaveInSeconds ?? 0)),
      engineState: state.engineState ?? null,
      lastNestHitAt: 0,
      battleDeployments: [],
      upgradeLevels: {
        queenSpawnRate: clampUpgradeLevel(state.upgradeLevels.queenSpawnRate),
        carryCapacity: clampUpgradeLevel(state.upgradeLevels.carryCapacity),
        antSpeed: clampUpgradeLevel(state.upgradeLevels.antSpeed),
        nestRecovery: clampUpgradeLevel(state.upgradeLevels.nestRecovery),
        nestMaxHealth: nestMaxHealthLevel,
        foodCapacity: clampUpgradeLevel(state.upgradeLevels.foodCapacity),
        forageRadius: clampUpgradeLevel(state.upgradeLevels.forageRadius),
        populationCapacity: clampUpgradeLevel(state.upgradeLevels.populationCapacity),
        soldierDamage: clampUpgradeLevel(state.upgradeLevels.soldierDamage),
        soldierHealth: clampUpgradeLevel(state.upgradeLevels.soldierHealth),
        soldierSpeed: clampUpgradeLevel(state.upgradeLevels.soldierSpeed),
        soldierTauntRange: clampUpgradeLevel(state.upgradeLevels.soldierTauntRange),
        soldierAttackRange: clampUpgradeLevel(state.upgradeLevels.soldierAttackRange),
        soldierAttackCooldown: clampUpgradeLevel((state.upgradeLevels as Partial<UpgradeState>).soldierAttackCooldown ?? 0),
      },
    });
  },
  syncColonySize: (amount) => {
    const next = Math.max(0, Math.floor(amount));

    set({ colonySize: next });
  },
  incrementColonySize: (amount = 1) => {
    if (amount <= 0) {
      return;
    }

    set((state) => ({
      colonySize: state.colonySize + Math.floor(amount),
    }));
  },
  loseColonySize: (amount = 1) => {
    if (amount <= 0) {
      return;
    }

    set((state) => ({
      colonySize: Math.max(0, state.colonySize - Math.floor(amount)),
    }));
  },
  setNestHealth: (health) => {
    const maxNestHealth = getNestMaxHealth(get().upgradeLevels);

    set({
      nestHealth: Math.max(0, Math.min(maxNestHealth, Math.floor(health))),
    });
  },
  setNextEnemyWaveInSeconds: (seconds) => {
    set({
      nextEnemyWaveInSeconds: Math.max(0, seconds),
    });
  },
  setEngineState: (state) => {
    set({
      engineState: state,
    });
  },
  notifyNestHit: () => {
    set({
      lastNestHitAt: Date.now(),
    });
  },
  enqueueBattleDeployment: (deployment) => {
    const id = `deployment-${Date.now().toString(36)}-${Math.floor(Math.random() * 10000)}`;

    set((state) => ({
      battleDeployments: [
        ...state.battleDeployments,
        {
          id,
          composition: deployment.composition,
          mode: deployment.mode,
          createdAt: Date.now(),
        },
      ],
    }));

    return id;
  },
  pullBattleDeployments: () => {
    const queued = get().battleDeployments;

    if (queued.length === 0) {
      return [];
    }

    set({ battleDeployments: [] });
    return queued;
  },
  earnFood: (amount) => {
    if (amount <= 0) {
      return;
    }

    set((state) => ({
      foodAmount: state.foodAmount + amount,
    }));
  },
  spendFood: (amount) => {
    if (amount <= 0) {
      return true;
    }

    const currentFood = get().foodAmount;

    if (currentFood < amount) {
      return false;
    }

    set((state) => ({
      foodAmount: state.foodAmount - amount,
    }));

    return true;
  },
  purchaseUpgrade: (upgradeKey) => {
    const currentLevel = get().upgradeLevels[upgradeKey];

    if (currentLevel >= MAX_UPGRADE_LEVEL) {
      return false;
    }

    const cost = calculateCost(UPGRADE_BASE_COST[upgradeKey], currentLevel);

    if (!get().spendFood(cost)) {
      return false;
    }

    set((state) => ({
      upgradeLevels: {
        ...state.upgradeLevels,
        [upgradeKey]: state.upgradeLevels[upgradeKey] + 1,
      },
    }));

    return true;
  },
  upgradeCost: (upgradeKey) => {
    const currentLevel = get().upgradeLevels[upgradeKey];
    return calculateCost(UPGRADE_BASE_COST[upgradeKey], currentLevel);
  },
}));

export function getPersistedGameSnapshot(
  state: Pick<GameState, 'colonySize' | 'foodAmount' | 'nestHealth' | 'nextEnemyWaveInSeconds' | 'upgradeLevels' | 'engineState'>,
): PersistedGameState {
  return {
    colonySize: state.colonySize,
    foodAmount: state.foodAmount,
    nestHealth: state.nestHealth,
    nextEnemyWaveInSeconds: state.nextEnemyWaveInSeconds,
    upgradeLevels: state.upgradeLevels,
    engineState: state.engineState,
  };
}

export function getPopulationLimit(upgradeLevels: Pick<UpgradeState, 'populationCapacity'>) {
  return BASE_POPULATION_CAPACITY + Math.max(0, upgradeLevels.populationCapacity) * POPULATION_CAPACITY_PER_LEVEL;
}

export function getNestMaxHealth(upgradeLevels: Pick<UpgradeState, 'nestMaxHealth'>) {
  return getPlayerNestMaxHealth(upgradeLevels.nestMaxHealth ?? 0);
}

export const DEFAULT_NEST_HEALTH = BASE_PLAYER_NEST_MAX_HEALTH;