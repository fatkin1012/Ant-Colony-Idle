import type { OfflineProgressResult, SavedGameState } from './types';

const MIN_SPAWN_INTERVAL_MS = 6000;
const BASE_SPAWN_INTERVAL_MS = 30000;
const BASE_FOOD_CONSUMPTION_PER_ANT_PER_MINUTE = 0.24;
const BASE_FOOD_GATHER_INTERVAL_MS = 15000;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function calculateSpawnIntervalMs(queenSpawnRateLevel: number) {
  const reduction = clamp(queenSpawnRateLevel * 0.1, 0, 0.75);
  return Math.max(MIN_SPAWN_INTERVAL_MS, BASE_SPAWN_INTERVAL_MS * (1 - reduction));
}

function calculateConsumptionPerMinute(colonySize: number, queenSpawnRateLevel: number) {
  return colonySize * (BASE_FOOD_CONSUMPTION_PER_ANT_PER_MINUTE + queenSpawnRateLevel * 0.03);
}

function calculateGatherAmount(carryCapacityLevel: number) {
  return 1 + carryCapacityLevel;
}

export function reconcileOfflineProgress(state: SavedGameState, nowTimestamp: number): SavedGameState {
  const result = calculateOfflineProgress(state, nowTimestamp);
  return result.state;
}

export function calculateOfflineProgress(state: SavedGameState, nowTimestamp: number): OfflineProgressResult {
  const elapsedMs = Math.max(0, nowTimestamp - state.last_sync_timestamp);
  const spawnIntervalMs = calculateSpawnIntervalMs(state.upgrade_levels.queenSpawnRate);
  const antsSpawned = Math.floor(elapsedMs / spawnIntervalMs);
  const colonySize = state.colony_size + antsSpawned;

  const foodGatheredCycles = Math.floor(elapsedMs / BASE_FOOD_GATHER_INTERVAL_MS);
  const foodGathered = foodGatheredCycles * calculateGatherAmount(state.upgrade_levels.carryCapacity);

  const consumptionPerMinute = calculateConsumptionPerMinute(colonySize, state.upgrade_levels.queenSpawnRate);
  const foodConsumed = Math.floor((elapsedMs / 60000) * consumptionPerMinute);

  const foodAmount = Math.max(0, state.food_amount + foodGathered - foodConsumed);

  return {
    state: {
      colony_size: colonySize,
      food_amount: foodAmount,
      upgrade_levels: {
        queenSpawnRate: state.upgrade_levels.queenSpawnRate,
        carryCapacity: state.upgrade_levels.carryCapacity,
      },
      last_sync_timestamp: nowTimestamp,
    },
    elapsedMs,
    antsSpawned,
    foodConsumed,
    foodGathered,
  };
}