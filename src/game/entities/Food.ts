import type { GameWorld } from '../engine/types';

export interface FoodConfig {
  id: string;
  x: number;
  y: number;
  size: number;
}

export class Food {
  public alive = true;
  public readonly id: string;
  public readonly size: number;

  private readonly x: number;
  private readonly y: number;

  constructor(config: FoodConfig) {
    this.id = config.id;
    this.x = config.x;
    this.y = config.y;
    this.size = config.size;
  }

  get position() {
    return {
      x: this.x,
      y: this.y,
    };
  }

  draw(context: CanvasRenderingContext2D, _world: GameWorld) {
    context.fillStyle = '#6adb4b';
    context.fillRect(Math.round(this.x), Math.round(this.y), this.size, this.size);
  }

  containsPoint(x: number, y: number) {
    return x >= this.x && x <= this.x + this.size && y >= this.y && y <= this.y + this.size;
  }
}