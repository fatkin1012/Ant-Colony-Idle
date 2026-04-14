import { create } from 'zustand';
import { BASE_POPULATION_CAPACITY, MAX_UPGRADE_LEVEL, POPULATION_CAPACITY_PER_LEVEL } from '../game/upgradeBalances';
import type { PersistedGameState } from './gamePersistence';
import type { AntRole, SquadMode } from '../game/combat/antTypes';

const DEV_FIXED_FOOD = import.meta.env.DEV ? 9999 : null;

export type UpgradeKey =
  | 'queenSpawnRate'
  | 'carryCapacity'
  | 'antSpeed'
  | 'nestRecovery'
  | 'foodCapacity'
  | 'forageRadius'
  | 'populationCapacity';

export interface UpgradeState {
  queenSpawnRate: number;
  carryCapacity: number;
  antSpeed: number;
  nestRecovery: number;
  foodCapacity: number;
  forageRadius: number;
  populationCapacity: number;
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
  lastNestHitAt: number;
  battleDeployments: BattleDeployment[];
  upgradeLevels: UpgradeState;
  hydrateFromPersistence: (state: PersistedGameState) => void;
  syncColonySize: (amount: number) => void;
  incrementColonySize: (amount?: number) => void;
  loseColonySize: (amount?: number) => void;
  setNestHealth: (health: number) => void;
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
  nestRecovery: 25,
  foodCapacity: 30,
  forageRadius: 35,
  populationCapacity: 55,
};

const UPGRADE_COST_GROWTH = 1.45;

function calculateCost(baseCost: number, level: number) {
  return Math.floor(baseCost * Math.pow(UPGRADE_COST_GROWTH, level));
}

function clampUpgradeLevel(level: number) {
  return Math.min(MAX_UPGRADE_LEVEL, Math.max(0, Math.floor(level)));
}

export const useGameStore = create<GameState>((set, get) => ({
  colonySize: 12,
  foodAmount: DEV_FIXED_FOOD ?? 0,
  nestHealth: 100,
  lastNestHitAt: 0,
  battleDeployments: [],
  upgradeLevels: {
    queenSpawnRate: 0,
    carryCapacity: 0,
    antSpeed: 0,
    nestRecovery: 0,
    foodCapacity: 0,
    forageRadius: 0,
    populationCapacity: 0,
  },
  hydrateFromPersistence: (state) => {
    set({
      colonySize: Math.max(0, Math.floor(state.colonySize)),
      foodAmount: DEV_FIXED_FOOD ?? Math.max(0, Math.floor(state.foodAmount)),
      nestHealth: Math.max(0, Math.floor(state.nestHealth)),
      upgradeLevels: {
        queenSpawnRate: clampUpgradeLevel(state.upgradeLevels.queenSpawnRate),
        carryCapacity: clampUpgradeLevel(state.upgradeLevels.carryCapacity),
        antSpeed: clampUpgradeLevel(state.upgradeLevels.antSpeed),
        nestRecovery: clampUpgradeLevel(state.upgradeLevels.nestRecovery),
        foodCapacity: clampUpgradeLevel(state.upgradeLevels.foodCapacity),
        forageRadius: clampUpgradeLevel(state.upgradeLevels.forageRadius),
        populationCapacity: clampUpgradeLevel(state.upgradeLevels.populationCapacity),
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
    set({
      nestHealth: Math.max(0, Math.floor(health)),
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

    if (DEV_FIXED_FOOD !== null) {
      set({
        foodAmount: DEV_FIXED_FOOD,
      });
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

    if (DEV_FIXED_FOOD !== null) {
      set({
        foodAmount: DEV_FIXED_FOOD,
      });
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
  state: Pick<GameState, 'colonySize' | 'foodAmount' | 'nestHealth' | 'upgradeLevels'>,
): PersistedGameState {
  return {
    colonySize: state.colonySize,
    foodAmount: state.foodAmount,
    nestHealth: state.nestHealth,
    upgradeLevels: state.upgradeLevels,
  };
}

export function getPopulationLimit(upgradeLevels: Pick<UpgradeState, 'populationCapacity'>) {
  return BASE_POPULATION_CAPACITY + Math.max(0, upgradeLevels.populationCapacity) * POPULATION_CAPACITY_PER_LEVEL;
}