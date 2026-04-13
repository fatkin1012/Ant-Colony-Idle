import { useEffect, useRef } from 'react';
import { GameEngine } from './engine/GameEngine';
import { useGameStore } from '../state/gameStore';

export function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<GameEngine | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const engine = new GameEngine(canvas, {
      onFoodCollected: (amount) => {
        useGameStore.getState().earnFood(amount);
      },
      getFoodAmount: () => useGameStore.getState().foodAmount,
      onAntSpawned: (amount) => {
        useGameStore.getState().incrementColonySize(amount);
      },
      getUpgradeLevels: () => useGameStore.getState().upgradeLevels,
    });
    engineRef.current = engine;
    engine.start();

    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  return <canvas ref={canvasRef} className="game-canvas" aria-label="Ant colony game canvas" role="img" />;
}