import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { SavedGameState } from './types';

const DEFAULT_STATE: SavedGameState = {
  colony_size: 12,
  food_amount: 0,
  upgrade_levels: {
    queenSpawnRate: 0,
    carryCapacity: 0,
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

    return parsed;
  } catch (error) {
    return { ...DEFAULT_STATE, last_sync_timestamp: Date.now() };
  }
}

export async function saveGameState(state: SavedGameState): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(SAVE_FILE, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
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
    typeof upgradeLevels.carryCapacity === 'number'
  );
}