export interface SavedGameState {
  colony_size: number;
  food_amount: number;
  upgrade_levels: {
    queenSpawnRate: number;
    carryCapacity: number;
  };
  last_sync_timestamp: number;
}

export interface OfflineProgressResult {
  state: SavedGameState;
  elapsedMs: number;
  antsSpawned: number;
  foodConsumed: number;
  foodGathered: number;
}