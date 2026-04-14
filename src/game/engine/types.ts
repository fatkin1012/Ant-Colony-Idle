export interface Vec2 {
  x: number;
  y: number;
}

export interface GameWorld {
  readonly width: number;
  readonly height: number;
  readonly center: Vec2;
  readonly nestRadius: number;
  readonly time: number;
  readonly antSpeedMultiplier: number;
  readonly idleCooldownMultiplier: number;
  readonly carryCapacityBonus: number;
  readonly maxFoodOnField: number;
  readonly maxForageRadius: number;
  readonly foodPositions: Vec2[];
  readonly enemyAnts?: Array<{ id: string; x: number; y: number; role?: 'BRUTE' | 'RUNNER' | 'SPITTER' }>;
  readonly tauntingGuardians?: Array<{ id: string; x: number; y: number; tauntRadius: number }>;
  readonly enemyNests?: Array<{ id: string; x: number; y: number; radius: number }>;
}

export interface GameEntity {
  id: string;
  alive: boolean;
  update(deltaTime: number, world: GameWorld): void;
  draw(context: CanvasRenderingContext2D, world: GameWorld): void;
}

export interface AntView {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly state: 'SEARCHING' | 'FOUND' | 'IDLE';
}