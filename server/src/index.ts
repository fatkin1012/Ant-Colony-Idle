import cors from 'cors';
import express from 'express';
import { loadGameState, saveGameState, type SavedGameState } from './stateStore';
import { calculateOfflineProgress } from './offlineProgress';

const app = express();

app.use(cors());
app.use(express.json());

app.get('/api/health', (_request, response) => {
  response.json({ ok: true });
});

app.post('/api/save', async (request, response) => {
  const body = request.body as Partial<SavedGameState>;

  if (!isValidSavedGameState(body)) {
    response.status(400).json({ error: 'Invalid save payload.' });
    return;
  }

  const nextState = {
    colony_size: Math.max(0, Math.floor(body.colony_size)),
    food_amount: Math.max(0, Math.floor(body.food_amount)),
    upgrade_levels: {
      queenSpawnRate: Math.max(0, Math.floor(body.upgrade_levels.queenSpawnRate)),
      carryCapacity: Math.max(0, Math.floor(body.upgrade_levels.carryCapacity)),
      antSpeed: Math.max(0, Math.floor(body.upgrade_levels.antSpeed)),
      nestRecovery: Math.max(0, Math.floor(body.upgrade_levels.nestRecovery)),
      foodCapacity: Math.max(0, Math.floor(body.upgrade_levels.foodCapacity)),
      forageRadius: Math.max(0, Math.floor(body.upgrade_levels.forageRadius)),
    },
    last_sync_timestamp: Date.now(),
  } satisfies SavedGameState;

  await saveGameState(nextState);
  response.json({ state: nextState });
});

app.get('/api/load', async (_request, response) => {
  const savedState = await loadGameState();
  const offlineProgress = calculateOfflineProgress(savedState, Date.now());

  await saveGameState(offlineProgress.state);
  response.json({ state: offlineProgress.state, offline_progress: offlineProgress });
});

const port = Number(process.env.PORT ?? 3001);

app.listen(port, () => {
  console.log(`Ant Colony Idle backend listening on http://localhost:${port}`);
});

function isValidSavedGameState(value: unknown): value is SavedGameState {
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
    typeof upgradeLevels.forageRadius === 'number'
  );
}