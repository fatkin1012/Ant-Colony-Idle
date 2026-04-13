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

export class Ant implements GameEntity {
  public alive = true;
  public state: AntState;
  public readonly id: string;

  private x: number;
  private y: number;
  private direction = Math.random() * Math.PI * 2;
  private wanderClock = Math.random() * 1000;
  private idlePulse = Math.random() * Math.PI * 2;

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

  update(deltaTime: number, world: GameWorld) {
    if (this.state === 'FOUND') {
      this.moveTowards(world.center.x, world.center.y, RETURN_SPEED, deltaTime);

      if (distanceSquared(this.x, this.y, world.center.x, world.center.y) <= world.nestRadius * world.nestRadius) {
        this.state = 'IDLE';
      }

      return;
    }

    if (this.state === 'IDLE') {
      this.idlePulse += deltaTime * 3;

      const targetX = world.center.x + Math.cos(this.idlePulse) * NEST_IDLE_RADIUS;
      const targetY = world.center.y + Math.sin(this.idlePulse * 1.3) * NEST_IDLE_RADIUS;

      this.moveTowards(targetX, targetY, SEARCH_SPEED * 0.45, deltaTime);
      return;
    }

    this.wanderClock += deltaTime;

    if (Math.random() < TURN_CHANCE) {
      this.direction += (Math.random() - 0.5) * 1.5;
    }

    const noise = Math.sin(this.wanderClock * 2.7 + this.x * 0.01 + this.y * 0.015) * 0.65;
    this.direction = normalizeAngle(this.direction + noise * deltaTime);

    const speed = SEARCH_SPEED * (0.85 + Math.sin(this.wanderClock * 1.8) * 0.15);
    this.x += Math.cos(this.direction) * speed * deltaTime;
    this.y += Math.sin(this.direction) * speed * deltaTime;

    const offsetX = this.x - world.center.x;
    const offsetY = this.y - world.center.y;
    const distanceFromNest = Math.hypot(offsetX, offsetY);

    if (distanceFromNest < IDLE_RADIUS) {
      this.state = 'IDLE';
    }

    if (distanceFromNest > Math.min(world.width, world.height) * 0.48) {
      this.direction = Math.atan2(world.center.y - this.y, world.center.x - this.x);
    }

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