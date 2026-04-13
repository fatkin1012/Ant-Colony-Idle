import { EntityManager } from './EntityManager';
import type { GameWorld } from './types';
import { Ant } from '../entities/Ant';
import { Food } from '../entities/Food';

const BACKGROUND_COLOR = '#222222';
const NEST_FILL = '#3b3026';
const NEST_RING = '#6f5a45';
const MAX_FOOD_ON_FIELD = 14;
const FOOD_VALUE_PER_PICKUP = 1;
const ANT_PICKUP_RADIUS = 1.5;

interface GameEngineOptions {
  onFoodCollected?: (amount: number) => void;
  getFoodAmount?: () => number;
}

export class GameEngine {
  private readonly canvas: HTMLCanvasElement;
  private readonly context: CanvasRenderingContext2D;
  private readonly entityManager = new EntityManager();
  private readonly resizeObserver: ResizeObserver;
  private animationFrameId: number | null = null;
  private lastTimestamp = 0;
  private width = 0;
  private height = 0;
  private time = 0;
  private foods: Food[] = [];
  private nextFoodId = 0;
  private readonly onFoodCollected?: (amount: number) => void;
  private readonly getFoodAmount?: () => number;

  constructor(canvas: HTMLCanvasElement, options: GameEngineOptions = {}) {
    const context = canvas.getContext('2d');

    if (!context) {
      throw new Error('Canvas 2D context is unavailable.');
    }

    this.canvas = canvas;
    this.context = context;
    this.onFoodCollected = options.onFoodCollected;
    this.getFoodAmount = options.getFoodAmount;
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.resize();
    this.seedAnts();
    this.seedFood();
  }

  start() {
    if (this.animationFrameId !== null) {
      return;
    }

    this.lastTimestamp = performance.now();
    this.animationFrameId = requestAnimationFrame(this.tick);
  }

  stop() {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  destroy() {
    this.stop();
    this.resizeObserver.disconnect();
    this.entityManager.clear();
  }

  private readonly tick = (timestamp: number) => {
    const deltaTime = Math.min((timestamp - this.lastTimestamp) / 1000, 0.05);
    this.lastTimestamp = timestamp;
    this.time += deltaTime;

    const world = this.createWorld();
    this.entityManager.update(deltaTime, world);
    this.resolveFoodPickups(world);
    this.pruneFood();
    this.ensureFoodPopulation(world);
    this.render(world);

    this.animationFrameId = requestAnimationFrame(this.tick);
  };

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
    return {
      width: this.width,
      height: this.height,
      center: {
        x: this.width / 2,
        y: this.height / 2,
      },
      nestRadius: Math.max(38, Math.min(this.width, this.height) * 0.08),
      time: this.time,
    };
  }

  private render(world: GameWorld) {
    this.context.clearRect(0, 0, world.width, world.height);
    this.context.fillStyle = BACKGROUND_COLOR;
    this.context.fillRect(0, 0, world.width, world.height);

    this.drawFood(world);
    this.drawNest(world);
    this.entityManager.draw(this.context, world);
    this.drawScore();
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

  private drawScore() {
    const foodAmount = this.getFoodAmount ? this.getFoodAmount() : 0;

    this.context.save();
    this.context.fillStyle = '#d8f0b0';
    this.context.font = '600 14px Inter, system-ui, sans-serif';
    this.context.textBaseline = 'top';
    this.context.fillText(`Food: ${foodAmount}`, 16, 16);
    this.context.restore();
  }

  private seedAnts() {
    const seedCount = 12;
    const centerX = this.width / 2;
    const centerY = this.height / 2;

    for (let index = 0; index < seedCount; index += 1) {
      const offsetX = (Math.random() - 0.5) * 18;
      const offsetY = (Math.random() - 0.5) * 18;

      this.entityManager.add(
        new Ant({
          id: `ant-${index}`,
          x: centerX + offsetX,
          y: centerY + offsetY,
          state: index === 0 ? 'IDLE' : 'SEARCHING',
        }),
      );
    }
  }

  private seedFood() {
    this.foods = [];

    const world = this.createWorld();

    for (let index = 0; index < MAX_FOOD_ON_FIELD; index += 1) {
      this.foods.push(this.createFood(world, index));
    }
  }

  private ensureFoodPopulation(world: GameWorld) {
    while (this.foods.filter((food) => food.alive).length < MAX_FOOD_ON_FIELD) {
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

    const spawn = () => {
      const x = minX + Math.random() * (maxX - minX);
      const y = minY + Math.random() * (maxY - minY);

      const dx = x - world.center.x;
      const dy = y - world.center.y;
      const distanceFromNest = Math.hypot(dx, dy);

      if (distanceFromNest < world.nestRadius + 24) {
        return spawn();
      }

      return new Food({
        id: `food-${foodIndex}`,
        x,
        y,
        size,
      });
    };

    return spawn();
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
        const pickupX = antPosition.x + ANT_PICKUP_RADIUS;
        const pickupY = antPosition.y + ANT_PICKUP_RADIUS;
        const isInsideFood = food.containsPoint(pickupX, pickupY) || food.containsPoint(antPosition.x, antPosition.y);

        if (isInsideFood) {
          food.alive = false;
          ant.markFound();
          this.onFoodCollected?.(FOOD_VALUE_PER_PICKUP);
          break;
        }

        const distanceToFood = Math.hypot(antPosition.x - foodPosition.x, antPosition.y - foodPosition.y);

        if (distanceToFood <= Math.max(2, food.size)) {
          food.alive = false;
          ant.markFound();
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