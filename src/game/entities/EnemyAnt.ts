import type { GameEntity, GameWorld } from '../engine/types';
import { ENEMY_ANT_ATTACK_RANGE } from '../upgradeBalances';

export interface EnemyAntConfig {
  id: string;
  nestId: string;
  x: number;
  y: number;
  health: number;
  damage: number;
  speed: number;
  attackCooldownSeconds: number;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export class EnemyAnt implements GameEntity {
  public alive = true;
  public readonly id: string;
  public readonly nestId: string;

  private x: number;
  private y: number;
  private hp: number;
  private readonly maxHp: number;
  private readonly rawDamage: number;
  private readonly rawSpeed: number;
  private readonly baseAttackCooldownSeconds: number;
  private attackCooldownSeconds = 0;

  constructor(config: EnemyAntConfig) {
    this.id = config.id;
    this.nestId = config.nestId;
    this.x = config.x;
    this.y = config.y;
    this.hp = Math.max(1, config.health);
    this.maxHp = this.hp;
    this.rawDamage = Math.max(1, config.damage);
    this.rawSpeed = Math.max(8, config.speed);
    this.baseAttackCooldownSeconds = Math.max(0.25, config.attackCooldownSeconds);
  }

  get position() {
    return { x: this.x, y: this.y };
  }

  get damage() {
    return this.rawDamage;
  }

  get attackRange() {
    return ENEMY_ANT_ATTACK_RANGE;
  }

  canAttack() {
    return this.attackCooldownSeconds <= 0;
  }

  triggerAttackCooldown() {
    this.attackCooldownSeconds = this.baseAttackCooldownSeconds;
  }

  distanceTo(x: number, y: number) {
    return Math.hypot(x - this.x, y - this.y);
  }

  applyDamage(amount: number) {
    if (!this.alive || amount <= 0) {
      return false;
    }

    this.hp -= amount;

    if (this.hp <= 0) {
      this.hp = 0;
      this.alive = false;
      return true;
    }

    return false;
  }

  update(deltaTime: number, world: GameWorld) {
    if (!this.alive) {
      return;
    }

    this.attackCooldownSeconds = Math.max(0, this.attackCooldownSeconds - deltaTime);

    const dx = world.center.x - this.x;
    const dy = world.center.y - this.y;
    const distance = Math.hypot(dx, dy);

    if (distance > world.nestRadius * 0.65) {
      const angle = Math.atan2(dy, dx);
      this.x += Math.cos(angle) * this.rawSpeed * deltaTime;
      this.y += Math.sin(angle) * this.rawSpeed * deltaTime;
    }

    this.x = clamp(this.x, 0, Math.max(0, world.width - 2));
    this.y = clamp(this.y, 0, Math.max(0, world.height - 2));
  }

  draw(context: CanvasRenderingContext2D) {
    const lowHealthAlpha = this.maxHp <= 0 ? 1 : 0.6 + 0.4 * (this.hp / this.maxHp);
    context.fillStyle = `rgba(234, 96, 82, ${lowHealthAlpha.toFixed(2)})`;
    context.fillRect(Math.round(this.x), Math.round(this.y), 2, 2);
  }
}
