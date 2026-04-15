import type { UpgradeState } from './gameStore';
import type { GameEngineSnapshot } from '../game/engine/GameEngine';

export type GameLanguage = 'zh-TW' | 'en';

export interface PersistedGameState {
  colonySize: number;
  foodAmount: number;
  nestHealth: number;
  nextEnemyWaveInSeconds: number;
  upgradeLevels: UpgradeState;
  engineState?: GameEngineSnapshot | null;
}

type PersistedGameStateCandidate = Omit<PersistedGameState, 'nestHealth' | 'nextEnemyWaveInSeconds' | 'engineState'> & {
  nestHealth?: number;
  nextEnemyWaveInSeconds?: number;
  engineState?: unknown;
};

interface LocalSavePayload {
  version: 1;
  updatedAt: number;
  state: PersistedGameState;
}

const LOCAL_SAVE_KEY = 'ant-colony-idle-save-v1';
const LANGUAGE_KEY = 'ant-colony-idle-language';

function sanitizeState(state: PersistedGameStateCandidate): PersistedGameState {
  const rawPopulationCapacity = (state.upgradeLevels as unknown as Record<string, unknown>).populationCapacity;
  const populationCapacity = typeof rawPopulationCapacity === 'number' ? rawPopulationCapacity : 0;

  return {
    colonySize: Math.max(0, Math.floor(state.colonySize)),
    foodAmount: Math.max(0, Math.floor(state.foodAmount)),
    nestHealth: Math.max(0, Math.floor(state.nestHealth ?? 100)),
    nextEnemyWaveInSeconds: Math.max(0, Math.floor((state as PersistedGameStateCandidate & { nextEnemyWaveInSeconds?: number }).nextEnemyWaveInSeconds ?? 0)),
    upgradeLevels: {
      queenSpawnRate: Math.max(0, Math.floor(state.upgradeLevels.queenSpawnRate)),
      carryCapacity: Math.max(0, Math.floor(state.upgradeLevels.carryCapacity)),
      antSpeed: Math.max(0, Math.floor(state.upgradeLevels.antSpeed)),
      foodCapacity: Math.max(0, Math.floor(state.upgradeLevels.foodCapacity)),
      forageRadius: Math.max(0, Math.floor(state.upgradeLevels.forageRadius)),
      populationCapacity: Math.max(0, Math.floor(populationCapacity)),
    },
    engineState: isValidEngineState(state.engineState) ? state.engineState : null,
  };
}

function isValidEngineState(value: unknown): value is GameEngineSnapshot {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.time === 'number' &&
    typeof candidate.nextFoodId === 'number' &&
    typeof candidate.nextAntId === 'number' &&
    typeof candidate.nextEnemyAntId === 'number' &&
    typeof candidate.nextEnemyNestId === 'number' &&
    typeof candidate.nextEnemyCaveSpawnAtSeconds === 'number' &&
    Array.isArray(candidate.playerAnts) &&
    Array.isArray(candidate.playerSoldiers) &&
    Array.isArray(candidate.enemyNests)
  );
}

function isPersistedGameState(value: unknown): value is PersistedGameStateCandidate {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  const upgradeLevels = candidate.upgradeLevels as Record<string, unknown> | undefined;

  return (
    typeof candidate.colonySize === 'number' &&
    typeof candidate.foodAmount === 'number' &&
    (typeof candidate.nestHealth === 'number' || typeof candidate.nestHealth === 'undefined') &&
    (typeof candidate.nextEnemyWaveInSeconds === 'number' || typeof candidate.nextEnemyWaveInSeconds === 'undefined') &&
    upgradeLevels !== undefined &&
    typeof upgradeLevels.queenSpawnRate === 'number' &&
    typeof upgradeLevels.carryCapacity === 'number' &&
    typeof upgradeLevels.antSpeed === 'number' &&
    typeof upgradeLevels.foodCapacity === 'number' &&
    typeof upgradeLevels.forageRadius === 'number' &&
    (typeof upgradeLevels.populationCapacity === 'number' || typeof upgradeLevels.populationCapacity === 'undefined') &&
    (typeof candidate.engineState === 'undefined' || isValidEngineState(candidate.engineState))
  );
}

export async function loadPersistedGameState() {
  const raw = window.localStorage.getItem(LOCAL_SAVE_KEY);

  if (!raw) {
    throw new Error('No local save found.');
  }

  const data = JSON.parse(raw) as Partial<LocalSavePayload>;

  if (data.version !== 1 || !isPersistedGameState(data.state)) {
    throw new Error('Invalid local save payload.');
  }

  return sanitizeState(data.state);
}

export async function savePersistedGameState(state: PersistedGameState) {
  const sanitized = sanitizeState(state);
  const payload: LocalSavePayload = {
    version: 1,
    updatedAt: Date.now(),
    state: sanitized,
  };

  window.localStorage.setItem(LOCAL_SAVE_KEY, JSON.stringify(payload));
  return sanitized;
}

export function savePersistedGameStateOnPageHide(state: PersistedGameState) {
  const sanitized = sanitizeState(state);
  const payload: LocalSavePayload = {
    version: 1,
    updatedAt: Date.now(),
    state: sanitized,
  };

  window.localStorage.setItem(LOCAL_SAVE_KEY, JSON.stringify(payload));
  return true;
}

export function clearPersistedGameState() {
  window.localStorage.removeItem(LOCAL_SAVE_KEY);
}

export function loadGameLanguage(): GameLanguage {
  const value = window.localStorage.getItem(LANGUAGE_KEY);
  if (value === 'en' || value === 'zh-TW') {
    return value;
  }

  return 'zh-TW';
}

export function saveGameLanguage(language: GameLanguage) {
  window.localStorage.setItem(LANGUAGE_KEY, language);
}