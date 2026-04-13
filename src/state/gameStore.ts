import { create } from 'zustand';

export type UpgradeKey = 'queenSpawnRate' | 'carryCapacity';

export interface UpgradeState {
  queenSpawnRate: number;
  carryCapacity: number;
}

interface GameState {
  colonySize: number;
  foodAmount: number;
  upgradeLevels: UpgradeState;
  earnFood: (amount: number) => void;
  spendFood: (amount: number) => boolean;
  purchaseUpgrade: (upgradeKey: UpgradeKey) => boolean;
  upgradeCost: (upgradeKey: UpgradeKey) => number;
}

const UPGRADE_BASE_COST: Record<UpgradeKey, number> = {
  queenSpawnRate: 25,
  carryCapacity: 30,
};

const UPGRADE_COST_GROWTH = 1.45;

function calculateCost(baseCost: number, level: number) {
  return Math.floor(baseCost * Math.pow(UPGRADE_COST_GROWTH, level));
}

export const useGameStore = create<GameState>((set, get) => ({
  colonySize: 12,
  foodAmount: 0,
  upgradeLevels: {
    queenSpawnRate: 0,
    carryCapacity: 0,
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