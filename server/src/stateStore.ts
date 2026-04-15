import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { SavedGameState } from './types.js';
import { MAX_UPGRADE_LEVEL } from './upgradeBalances.js';

const DEFAULT_STATE: SavedGameState = {
  colony_size: 12,
  food_amount: 0,
  upgrade_levels: {
    queenSpawnRate: 0,
    carryCapacity: 0,
    antSpeed: 0,
    nestRecovery: 0,
    foodCapacity: 0,
    forageRadius: 0,
    populationCapacity: 0,
    soldierDamage: 0,
    soldierHealth: 0,
    soldierSpeed: 0,
    soldierTauntRange: 0,
    soldierAttackRange: 0,
  },
  last_sync_timestamp: Date.now(),
};

const DATA_DIR = path.join(process.cwd(), 'server', 'data');
const SAVE_FILE = path.join(DATA_DIR, 'game-state.json');

export async function loadGameState(): Promise<SavedGameState> {
  try {
    const raw = await readFile(SAVE_FILE, 'utf8');
    const parsed = JSON.parse(raw) as SavedGameState;

    if (!isSavedGameState(parsed)) {
      return { ...DEFAULT_STATE, last_sync_timestamp: Date.now() };
    }

    return normalizeSavedGameState(parsed);
  } catch (error) {
    return { ...DEFAULT_STATE, last_sync_timestamp: Date.now() };
  }
}

export async function saveGameState(state: SavedGameState): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(SAVE_FILE, `${JSON.stringify(normalizeSavedGameState(state), null, 2)}\n`, 'utf8');
}

function isSavedGameState(value: unknown): value is SavedGameState {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  const upgradeLevels = candidate.upgrade_levels as Record<string, unknown> | undefined;

  return (
    typeof candidate.colony_size === 'number' &&
    typeof candidate.food_amount === 'number' &&
    typeof candidate.last_sync_timestamp === 'number' &&
    upgradeLevels !== undefined &&
    typeof upgradeLevels.queenSpawnRate === 'number' &&
    typeof upgradeLevels.carryCapacity === 'number' &&
    typeof upgradeLevels.antSpeed === 'number' &&
    typeof upgradeLevels.nestRecovery === 'number' &&
    typeof upgradeLevels.foodCapacity === 'number' &&
    typeof upgradeLevels.forageRadius === 'number' &&
    typeof upgradeLevels.populationCapacity === 'number' &&
    typeof upgradeLevels.soldierDamage === 'number' &&
    typeof upgradeLevels.soldierHealth === 'number' &&
    typeof upgradeLevels.soldierSpeed === 'number' &&
    typeof upgradeLevels.soldierTauntRange === 'number' &&
    typeof upgradeLevels.soldierAttackRange === 'number'
  );
}

function normalizeSavedGameState(state: SavedGameState): SavedGameState {
  return {
    ...state,
    upgrade_levels: {
      queenSpawnRate: clampUpgradeLevel(state.upgrade_levels.queenSpawnRate),
      carryCapacity: clampUpgradeLevel(state.upgrade_levels.carryCapacity),
      antSpeed: clampUpgradeLevel(state.upgrade_levels.antSpeed),
      nestRecovery: clampUpgradeLevel(state.upgrade_levels.nestRecovery),
      foodCapacity: clampUpgradeLevel(state.upgrade_levels.foodCapacity),
      forageRadius: clampUpgradeLevel(state.upgrade_levels.forageRadius),
      populationCapacity: clampUpgradeLevel(state.upgrade_levels.populationCapacity),
      soldierDamage: clampUpgradeLevel(state.upgrade_levels.soldierDamage),
      soldierHealth: clampUpgradeLevel(state.upgrade_levels.soldierHealth),
      soldierSpeed: clampUpgradeLevel(state.upgrade_levels.soldierSpeed),
      soldierTauntRange: clampUpgradeLevel(state.upgrade_levels.soldierTauntRange),
      soldierAttackRange: clampUpgradeLevel(state.upgrade_levels.soldierAttackRange),
    },
  };
}

function clampUpgradeLevel(level: number) {
  return Math.min(MAX_UPGRADE_LEVEL, Math.max(0, Math.floor(level)));
}