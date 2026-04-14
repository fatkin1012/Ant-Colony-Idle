import type { UpgradeState } from './gameStore';

export type GameLanguage = 'zh-TW' | 'en';

export interface PersistedGameState {
  colonySize: number;
  foodAmount: number;
  upgradeLevels: UpgradeState;
}

interface LocalSavePayload {
  version: 1;
  updatedAt: number;
  state: PersistedGameState;
}

const LOCAL_SAVE_KEY = 'ant-colony-idle-save-v1';
const LANGUAGE_KEY = 'ant-colony-idle-language';

function sanitizeState(state: PersistedGameState): PersistedGameState {
  return {
    colonySize: Math.max(0, Math.floor(state.colonySize)),
    foodAmount: Math.max(0, Math.floor(state.foodAmount)),
    upgradeLevels: {
      queenSpawnRate: Math.max(0, Math.floor(state.upgradeLevels.queenSpawnRate)),
      carryCapacity: Math.max(0, Math.floor(state.upgradeLevels.carryCapacity)),
      antSpeed: Math.max(0, Math.floor(state.upgradeLevels.antSpeed)),
      nestRecovery: Math.max(0, Math.floor(state.upgradeLevels.nestRecovery)),
      foodCapacity: Math.max(0, Math.floor(state.upgradeLevels.foodCapacity)),
      forageRadius: Math.max(0, Math.floor(state.upgradeLevels.forageRadius)),
    },
  };
}

function isPersistedGameState(value: unknown): value is PersistedGameState {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  const upgradeLevels = candidate.upgradeLevels as Record<string, unknown> | undefined;

  return (
    typeof candidate.colonySize === 'number' &&
    typeof candidate.foodAmount === 'number' &&
    upgradeLevels !== undefined &&
    typeof upgradeLevels.queenSpawnRate === 'number' &&
    typeof upgradeLevels.carryCapacity === 'number' &&
    typeof upgradeLevels.antSpeed === 'number' &&
    typeof upgradeLevels.nestRecovery === 'number' &&
    typeof upgradeLevels.foodCapacity === 'number' &&
    typeof upgradeLevels.forageRadius === 'number'
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