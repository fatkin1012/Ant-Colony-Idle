import { EntityManager } from './EntityManager';
import type { GameWorld } from './types';
import { Ant } from '../entities/Ant';
import { Food } from '../entities/Food';
import {
  ANT_SPEED_MULTIPLIER_PER_LEVEL,
  BASE_ANT_FORAGE_RADIUS_FACTOR,
  BASE_MAX_FOOD_ON_FIELD,
  BASE_SPAWN_INTERVAL_SECONDS,
  FOOD_CAPACITY_PER_LEVEL,
  FORAGE_RADIUS_FACTOR_PER_LEVEL,
  IDLE_COOLDOWN_REDUCTION_PER_LEVEL,
  MAX_ANT_FORAGE_RADIUS_FACTOR,
  MAX_ANT_SPEED_MULTIPLIER,
  MAX_FOOD_ON_FIELD,
  MAX_SPAWN_REDUCTION,
  MIN_IDLE_COOLDOWN_MULTIPLIER,
  MIN_SPAWN_INTERVAL_SECONDS,
  SPAWN_REDUCTION_PER_LEVEL,
} from '../upgradeBalances';

const BACKGROUND_COLOR = '#222222';
const NEST_FILL = '#3b3026';
const NEST_RING = '#6f5a45';
const FOOD_VALUE_PER_PICKUP = 1;
const ANT_PICKUP_RADIUS = 1.5;
const FOOD_SPAWN_MARGIN = 10;

interface GameEngineOptions {
  onFoodCollected?: (amount: number) => void;
  getFoodAmount?: () => number;
  onAntSpawned?: (amount: number) => void;
  getUpgradeLevels?: () => {
    queenSpawnRate: number;
    carryCapacity: number;
    antSpeed: number;
    nestRecovery: number;
    foodCapacity: number;
    forageRadius: number;
  };
}

export class GameEngine {
  private readonly canvas: HTMLCanvasElement;
  private readonly context: CanvasRenderingContext2D;
  private readonly entityManager = new EntityManager();
  private readonly resizeObserver: ResizeObserver;
  private readonly handleVisibilityChange = () => {
    this.scheduleNextTick();
  };
  private tickTimeoutId: number | null = null;
  private lastTimestamp = 0;
  private accumulatedSeconds = 0;
  private width = 0;
  private height = 0;
  private time = 0;
  private foods: Food[] = [];
  private nextFoodId = 0;
  private nextAntId = 12;
  private spawnAccumulatorSeconds = 0;
  private readonly onFoodCollected?: (amount: number) => void;
  private readonly getFoodAmount?: () => number;
  private readonly onAntSpawned?: (amount: number) => void;
  private readonly getUpgradeLevels?: () => {
    queenSpawnRate: number;
    carryCapacity: number;
    antSpeed: number;
    nestRecovery: number;
    foodCapacity: number;
    forageRadius: number;
  };

  constructor(canvas: HTMLCanvasElement, options: GameEngineOptions = {}) {
    const context = canvas.getContext('2d');

    if (!context) {
      throw new Error('Canvas 2D context is unavailable.');
    }

    this.canvas = canvas;
    this.context = context;
    this.onFoodCollected = options.onFoodCollected;
    this.getFoodAmount = options.getFoodAmount;
    this.onAntSpawned = options.onAntSpawned;
    this.getUpgradeLevels = options.getUpgradeLevels;
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    this.resize();
    this.seedAnts();
    this.seedFood();
  }

  start() {
    if (this.tickTimeoutId !== null) {
      return;
    }

    this.lastTimestamp = performance.now();
    this.scheduleNextTick();
  }

  stop() {
    if (this.tickTimeoutId !== null) {
      window.clearTimeout(this.tickTimeoutId);
      this.tickTimeoutId = null;
    }
  }

  destroy() {
    this.stop();
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    this.resizeObserver.disconnect();
    this.entityManager.clear();
  }

  private readonly tick = () => {
    const timestamp = performance.now();
    const deltaTime = Math.max(0, (timestamp - this.lastTimestamp) / 1000);
    this.lastTimestamp = timestamp;
    this.accumulatedSeconds += deltaTime;

    const maxSimulationSecondsPerTick = 2;
    const simulationStepSeconds = 0.05;
    let processedSeconds = 0;

    while (this.accumulatedSeconds >= simulationStepSeconds && processedSeconds < maxSimulationSecondsPerTick) {
      const world = this.createWorld();
      this.stepSimulation(simulationStepSeconds, world);
      this.accumulatedSeconds -= simulationStepSeconds;
      processedSeconds += simulationStepSeconds;
    }

    if (this.accumulatedSeconds > 0 && processedSeconds < maxSimulationSecondsPerTick) {
      const world = this.createWorld();
      const finalStep = Math.min(this.accumulatedSeconds, maxSimulationSecondsPerTick - processedSeconds);
      this.stepSimulation(finalStep, world);
      this.accumulatedSeconds -= finalStep;
    }

    if (!document.hidden) {
      this.render(this.createWorld());
    }

    this.scheduleNextTick();
  };

  private scheduleNextTick() {
    if (this.tickTimeoutId !== null) {
      window.clearTimeout(this.tickTimeoutId);
    }

    const delay = document.hidden ? 250 : 16;
    this.tickTimeoutId = window.setTimeout(this.tick, delay);
  }

  private stepSimulation(deltaTime: number, world: GameWorld) {
    this.time += deltaTime;

    this.updateRealtimeSpawning(deltaTime, world);
    this.entityManager.update(deltaTime, world);
    this.resolveFoodPickups(world);
    this.pruneFood();
    this.ensureFoodPopulation(world);
  }

  private resize() {
    const { width, height } = this.canvas.getBoundingClientRect();
    const devicePixelRatio = window.devicePixelRatio || 1;

    this.width = Math.max(1, Math.floor(width));
    this.height = Math.max(1, Math.floor(height));

    this.canvas.width = Math.floor(this.width * devicePixelRatio);
    this.canvas.height = Math.floor(this.height * devicePixelRatio);
    this.context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  }

  private createWorld(): GameWorld {
    const upgradeLevels = this.getUpgradeLevels?.() ?? {
      queenSpawnRate: 0,
      carryCapacity: 0,
      antSpeed: 0,
      nestRecovery: 0,
      foodCapacity: 0,
      forageRadius: 0,
    };

    const maxFoodOnField = Math.min(
      MAX_FOOD_ON_FIELD,
      BASE_MAX_FOOD_ON_FIELD + Math.max(0, upgradeLevels.foodCapacity) * FOOD_CAPACITY_PER_LEVEL,
    );

    const forageRadiusFactor = Math.min(
      MAX_ANT_FORAGE_RADIUS_FACTOR,
      BASE_ANT_FORAGE_RADIUS_FACTOR + Math.max(0, upgradeLevels.forageRadius) * FORAGE_RADIUS_FACTOR_PER_LEVEL,
    );

    const maxForageRadius = Math.max(56, Math.min(this.width, this.height) * forageRadiusFactor);

    return {
      width: this.width,
      height: this.height,
      center: {
        x: this.width / 2,
        y: this.height / 2,
      },
      nestRadius: Math.max(38, Math.min(this.width, this.height) * 0.08),
      time: this.time,
      antSpeedMultiplier: Math.min(
        MAX_ANT_SPEED_MULTIPLIER,
        1 + Math.max(0, upgradeLevels.antSpeed) * ANT_SPEED_MULTIPLIER_PER_LEVEL,
      ),
      idleCooldownMultiplier: Math.max(
        MIN_IDLE_COOLDOWN_MULTIPLIER,
        1 - Math.max(0, upgradeLevels.nestRecovery) * IDLE_COOLDOWN_REDUCTION_PER_LEVEL,
      ),
      carryCapacityBonus: Math.max(0, upgradeLevels.carryCapacity),
      maxFoodOnField,
      maxForageRadius,
      foodPositions: this.foods.filter((food) => food.alive).map((food) => food.position),
    };
  }

  private render(world: GameWorld) {
    this.context.clearRect(0, 0, world.width, world.height);
    this.context.fillStyle = BACKGROUND_COLOR;
    this.context.fillRect(0, 0, world.width, world.height);

    this.drawFood(world);
    this.drawNest(world);
    this.entityManager.draw(this.context, world);
  }

  private drawFood(world: GameWorld) {
    for (const food of this.foods) {
      if (food.alive) {
        food.draw(this.context, world);
      }
    }
  }

  private drawNest(world: GameWorld) {
    const { center, nestRadius } = world;

    this.context.beginPath();
    this.context.fillStyle = NEST_FILL;
    this.context.arc(center.x, center.y, nestRadius, 0, Math.PI * 2);
    this.context.fill();

    this.context.lineWidth = 4;
    this.context.strokeStyle = NEST_RING;
    this.context.stroke();
  }

  private seedAnts() {
    const seedCount = 12;
    const centerX = this.width / 2;
    const centerY = this.height / 2;
    const world = this.createWorld();

    for (let index = 0; index < seedCount; index += 1) {
      const angle = (Math.PI * 2 * index) / seedCount + Math.random() * 0.35;
      const distance = index === 0 ? 0 : world.nestRadius + 28 + Math.random() * 26;
      const offsetX = Math.cos(angle) * distance;
      const offsetY = Math.sin(angle) * distance;

      this.entityManager.add(
        new Ant({
          id: `ant-${index}`,
          x: centerX + offsetX,
          y: centerY + offsetY,
          state: index === 0 ? 'IDLE' : 'SEARCHING',
        }),
      );
    }

    this.nextAntId = seedCount;
  }

  private updateRealtimeSpawning(deltaTime: number, world: GameWorld) {
    this.spawnAccumulatorSeconds += deltaTime;

    let spawnIntervalSeconds = this.getCurrentSpawnIntervalSeconds();

    while (this.spawnAccumulatorSeconds >= spawnIntervalSeconds) {
      this.spawnAccumulatorSeconds -= spawnIntervalSeconds;
      this.spawnSingleAnt(world);
      spawnIntervalSeconds = this.getCurrentSpawnIntervalSeconds();
    }
  }

  private getCurrentSpawnIntervalSeconds() {
    const queenSpawnRateLevel = Math.max(0, this.getUpgradeLevels ? this.getUpgradeLevels().queenSpawnRate : 0);
    const reduction = Math.min(MAX_SPAWN_REDUCTION, queenSpawnRateLevel * SPAWN_REDUCTION_PER_LEVEL);
    return Math.max(MIN_SPAWN_INTERVAL_SECONDS, BASE_SPAWN_INTERVAL_SECONDS * (1 - reduction));
  }

  private spawnSingleAnt(world: GameWorld) {
    const angle = Math.random() * Math.PI * 2;
    const distance = world.nestRadius + 16 + Math.random() * 10;
    const x = world.center.x + Math.cos(angle) * distance;
    const y = world.center.y + Math.sin(angle) * distance;

    this.entityManager.add(
      new Ant({
        id: `ant-${this.nextAntId}`,
        x,
        y,
        state: 'SEARCHING',
      }),
    );

    this.nextAntId += 1;
    this.onAntSpawned?.(1);
  }

  private seedFood() {
    this.foods = [];

    const world = this.createWorld();

    for (let index = 0; index < world.maxFoodOnField; index += 1) {
      this.foods.push(this.createFood(world, index));
    }
  }

  private ensureFoodPopulation(world: GameWorld) {
    while (this.foods.filter((food) => food.alive).length < world.maxFoodOnField) {
      this.foods.push(this.createFood(world, this.nextFoodId));
    }
  }

  private createFood(world: GameWorld, foodIndex: number) {
    this.nextFoodId = Math.max(this.nextFoodId, foodIndex + 1);

    const size = Math.random() < 0.5 ? 2 : 3;
    const padding = 18;
    const minX = padding;
    const minY = padding;
    const maxX = Math.max(minX, world.width - padding - size);
    const maxY = Math.max(minY, world.height - padding - size);
    for (let attempt = 0; attempt < 80; attempt += 1) {
      const x = minX + Math.random() * (maxX - minX);
      const y = minY + Math.random() * (maxY - minY);

      const centerX = x + size / 2;
      const centerY = y + size / 2;
      const dx = centerX - world.center.x;
      const dy = centerY - world.center.y;
      const distanceFromNest = Math.hypot(dx, dy);

      if (distanceFromNest < world.nestRadius + 24) {
        continue;
      }

      return new Food({
        id: `food-${foodIndex}`,
        x,
        y,
        size,
      });
    }

    const fallbackAngle = Math.random() * Math.PI * 2;
    const fallbackDistance = world.nestRadius + 26 + Math.random() * Math.min(world.width, world.height) * 0.45;
    const fallbackX = world.center.x + Math.cos(fallbackAngle) * fallbackDistance - size / 2;
    const fallbackY = world.center.y + Math.sin(fallbackAngle) * fallbackDistance - size / 2;

    return new Food({
      id: `food-${foodIndex}`,
      x: Math.min(maxX, Math.max(minX, fallbackX)),
      y: Math.min(maxY, Math.max(minY, fallbackY)),
      size,
    });
  }

  private resolveFoodPickups(world: GameWorld) {
    const ants = Array.from(this.entityManager.values()).filter((entity): entity is Ant => entity instanceof Ant);

    for (const ant of ants) {
      if (ant.state !== 'SEARCHING') {
        continue;
      }

      const antPosition = ant.position;

      for (const food of this.foods) {
        if (!food.alive) {
          continue;
        }

        const foodPosition = food.position;
        const antCenterX = antPosition.x + ANT_PICKUP_RADIUS;
        const antCenterY = antPosition.y + ANT_PICKUP_RADIUS;
        const pickupRadius = Math.max(6, food.size * 2.5);
        const isInsideFood =
          food.containsPoint(antPosition.x, antPosition.y) ||
          food.containsPoint(antCenterX, antCenterY);

        if (isInsideFood) {
          food.alive = false;
          ant.collectFood();
          if (ant.shouldReturnToNest(world.carryCapacityBonus)) {
            ant.markFound();
          }
          this.onFoodCollected?.(FOOD_VALUE_PER_PICKUP);
          break;
        }

        const distanceToFood = Math.hypot(antCenterX - foodPosition.x, antCenterY - foodPosition.y);

        if (distanceToFood <= pickupRadius) {
          food.alive = false;
          ant.collectFood();
          if (ant.shouldReturnToNest(world.carryCapacityBonus)) {
            ant.markFound();
          }
          this.onFoodCollected?.(FOOD_VALUE_PER_PICKUP);
          break;
        }
      }
    }
  }

  private pruneFood() {
    this.foods = this.foods.filter((food) => food.alive);
  }
}