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
      x: this.x + this.size / 2,
      y: this.y + this.size / 2,
    };
  }

  draw(context: CanvasRenderingContext2D, _world: GameWorld) {
    const centerX = this.x + this.size / 2;
    const centerY = this.y + this.size / 2;
    const radius = Math.max(1.3, this.size * 0.85);

    context.beginPath();
    context.moveTo(centerX, centerY - radius);
    context.lineTo(centerX + radius, centerY);
    context.lineTo(centerX, centerY + radius);
    context.lineTo(centerX - radius, centerY);
    context.closePath();
    context.fillStyle = '#3ed4ff';
    context.fill();

    context.lineWidth = 1;
    context.strokeStyle = '#0a3140';
    context.stroke();

    context.beginPath();
    context.arc(centerX, centerY, Math.max(0.6, this.size * 0.18), 0, Math.PI * 2);
    context.fillStyle = '#e9fbff';
    context.fill();
  }

  containsPoint(x: number, y: number) {
    return x >= this.x && x <= this.x + this.size && y >= this.y && y <= this.y + this.size;
  }
}