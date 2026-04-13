import type { GameEntity, GameWorld } from '../engine/types';

export type AntState = 'SEARCHING' | 'FOUND' | 'IDLE';

export interface AntConfig {
  id: string;
  x: number;
  y: number;
  state?: AntState;
}

const ANT_PIXEL_SIZE = 1;
const SEARCH_SPEED = 26;
const RETURN_SPEED = 44;
const IDLE_RADIUS = 18;
const NEST_IDLE_RADIUS = 8;
const TURN_CHANCE = 0.015;
const IDLE_RETURN_MIN_SECONDS = 60;
const IDLE_RETURN_MAX_SECONDS = 180;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function distanceSquared(ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax;
  const dy = by - ay;
  return dx * dx + dy * dy;
}

function normalizeAngle(angle: number) {
  const tau = Math.PI * 2;
  return ((angle % tau) + tau) % tau;
}

function shortestAngleDifference(from: number, to: number) {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from));
}

function randomIdleReturnDurationSeconds(multiplier: number) {
  const clampedMultiplier = Math.min(1, Math.max(0.35, multiplier));
  const baseDuration = IDLE_RETURN_MIN_SECONDS + Math.random() * (IDLE_RETURN_MAX_SECONDS - IDLE_RETURN_MIN_SECONDS);
  return baseDuration * clampedMultiplier;
}

function findNearestFood(
  x: number,
  y: number,
  foodPositions: GameWorld['foodPositions'],
  sensingRadius: number,
) {
  let nearestFood = null as { x: number; y: number; distance: number } | null;

  for (const foodPosition of foodPositions) {
    const dx = foodPosition.x - x;
    const dy = foodPosition.y - y;
    const distance = Math.hypot(dx, dy);

    if (distance > sensingRadius) {
      continue;
    }

    if (nearestFood === null || distance < nearestFood.distance) {
      nearestFood = {
        x: foodPosition.x,
        y: foodPosition.y,
        distance,
      };
    }
  }

  return nearestFood;
}

export class Ant implements GameEntity {
  public alive = true;
  public state: AntState;
  public readonly id: string;

  private x: number;
  private y: number;
  private direction = Math.random() * Math.PI * 2;
  private wanderClock = Math.random() * 1000;
  private idlePulse = Math.random() * Math.PI * 2;
  private idleReturnCountdownSeconds: number | null = null;
  private carriedFoodCount = 0;

  constructor(config: AntConfig) {
    this.id = config.id;
    this.x = config.x;
    this.y = config.y;
    this.state = config.state ?? 'SEARCHING';
  }

  get position() {
    return { x: this.x, y: this.y };
  }

  setState(nextState: AntState) {
    this.state = nextState;
  }

  markFound() {
    this.state = 'FOUND';
  }

  collectFood() {
    this.carriedFoodCount += 1;
  }

  shouldReturnToNest(carryCapacityBonus: number) {
    const capacity = Math.max(1, 1 + Math.floor(Math.max(0, carryCapacityBonus)));
    return this.carriedFoodCount >= capacity;
  }

  update(deltaTime: number, world: GameWorld) {
    if (this.state === 'FOUND') {
      this.moveTowards(world.center.x, world.center.y, RETURN_SPEED * world.antSpeedMultiplier, deltaTime);

      if (distanceSquared(this.x, this.y, world.center.x, world.center.y) <= world.nestRadius * world.nestRadius) {
        this.carriedFoodCount = 0;
        this.state = 'IDLE';
        this.idleReturnCountdownSeconds = randomIdleReturnDurationSeconds(world.idleCooldownMultiplier);
      }

      return;
    }

    if (this.state === 'IDLE') {
      this.idlePulse += deltaTime * 3;

      const targetX = world.center.x + Math.cos(this.idlePulse) * NEST_IDLE_RADIUS;
      const targetY = world.center.y + Math.sin(this.idlePulse * 1.3) * NEST_IDLE_RADIUS;

      this.moveTowards(targetX, targetY, SEARCH_SPEED * 0.45 * world.antSpeedMultiplier, deltaTime);

      if (this.idleReturnCountdownSeconds !== null) {
        this.idleReturnCountdownSeconds -= deltaTime;

        if (this.idleReturnCountdownSeconds <= 0) {
          this.state = 'SEARCHING';
          this.idleReturnCountdownSeconds = null;

          const outwardDirection = Math.atan2(this.y - world.center.y, this.x - world.center.x);
          this.direction = outwardDirection + (Math.random() - 0.5) * 0.6;
        }
      }

      return;
    }

    this.wanderClock += deltaTime;

    if (Math.random() < TURN_CHANCE) {
      this.direction += (Math.random() - 0.5) * 1.5;
    }

    const noise = Math.sin(this.wanderClock * 2.7 + this.x * 0.01 + this.y * 0.015) * 0.65;
    const wanderDirection = normalizeAngle(this.direction + noise * deltaTime);
    let steerX = Math.cos(wanderDirection);
    let steerY = Math.sin(wanderDirection);

    const nearestFood = findNearestFood(this.x, this.y, world.foodPositions, world.maxForageRadius);
    let hasNearbyFood = false;
    let foodAttractionStrength = 0;
    if (nearestFood) {
      const foodAngle = Math.atan2(nearestFood.y - this.y, nearestFood.x - this.x);
      foodAttractionStrength = (1 - nearestFood.distance / world.maxForageRadius) * 0.34;
      steerX += Math.cos(foodAngle) * foodAttractionStrength;
      steerY += Math.sin(foodAngle) * foodAttractionStrength;
      hasNearbyFood = true;

      if (nearestFood.distance < 18) {
        steerX = Math.cos(foodAngle);
        steerY = Math.sin(foodAngle);
      }
    }

    const offsetX = this.x - world.center.x;
    const offsetY = this.y - world.center.y;
    const distanceFromNest = Math.hypot(offsetX, offsetY);

    if (distanceFromNest < world.nestRadius + IDLE_RADIUS) {
      const awayAngle = Math.atan2(offsetY, offsetX);
      const nestAvoidanceMultiplier = hasNearbyFood ? 0 : 1;
      const nestAvoidanceStrength = (1 - distanceFromNest / (world.nestRadius + IDLE_RADIUS)) * 0.42 * nestAvoidanceMultiplier;
      steerX += Math.cos(awayAngle) * nestAvoidanceStrength;
      steerY += Math.sin(awayAngle) * nestAvoidanceStrength;
    }

    const steerMagnitude = Math.hypot(steerX, steerY);
    if (steerMagnitude > 0.0001) {
      this.direction = Math.atan2(steerY, steerX);
    }

    const speed = SEARCH_SPEED * (0.85 + Math.sin(this.wanderClock * 1.8) * 0.15) * world.antSpeedMultiplier;
    this.x += Math.cos(this.direction) * speed * deltaTime;
    this.y += Math.sin(this.direction) * speed * deltaTime;

    this.x = clamp(this.x, 0, world.width - ANT_PIXEL_SIZE);
    this.y = clamp(this.y, 0, world.height - ANT_PIXEL_SIZE);
  }

  draw(context: CanvasRenderingContext2D) {
    context.fillStyle = '#f8f7f2';
    context.fillRect(Math.round(this.x), Math.round(this.y), ANT_PIXEL_SIZE, ANT_PIXEL_SIZE);
  }

  private moveTowards(targetX: number, targetY: number, speed: number, deltaTime: number) {
    const angle = Math.atan2(targetY - this.y, targetX - this.x);
    this.direction = angle;
    this.x += Math.cos(angle) * speed * deltaTime;
    this.y += Math.sin(angle) * speed * deltaTime;
  }
}