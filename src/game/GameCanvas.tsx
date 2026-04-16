import { useEffect, useRef } from 'react';
import { GameEngine } from './engine/GameEngine';
import { useGameStore } from '../state/gameStore';
import type { GameMode } from '../state/gamePersistence';

interface GameCanvasProps {
  gameMode: GameMode;
}

export function GameCanvas({ gameMode }: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<GameEngine | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const engine = new GameEngine(canvas, {
      gameMode,
      initialState: useGameStore.getState().engineState,
      onFoodCollected: (amount) => {
        useGameStore.getState().earnFood(amount);
      },
      getFoodAmount: () => useGameStore.getState().foodAmount,
      onAntSpawned: (amount) => {
        useGameStore.getState().incrementColonySize(amount);
      },
      onAntLost: (amount) => {
        useGameStore.getState().loseColonySize(amount);
      },
      onPopulationUsageChanged: (amount) => {
        useGameStore.getState().syncColonySize(amount);
      },
      onNestHealthChanged: (health) => {
        useGameStore.getState().setNestHealth(health);
      },
      onNestDamaged: () => {
        useGameStore.getState().notifyNestHit();
      },
      onNextEnemyWaveTimeChanged: (seconds) => {
        useGameStore.getState().setNextEnemyWaveInSeconds(seconds);
      },
      onStateChanged: (state) => {
        useGameStore.getState().setEngineState(state);
      },
      getNestHealth: () => useGameStore.getState().nestHealth,
      getPopulationUsage: () => useGameStore.getState().colonySize,
      consumeBattleDeployments: () => useGameStore.getState().pullBattleDeployments(),
      getUpgradeLevels: () => useGameStore.getState().upgradeLevels,
    });
    engineRef.current = engine;
    engine.start();

    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, [gameMode]);

  return <canvas ref={canvasRef} className="game-canvas" aria-label="Ant colony game canvas" role="img" />;
}