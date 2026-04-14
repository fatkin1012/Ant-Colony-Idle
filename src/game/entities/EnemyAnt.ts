import type { GameEntity, GameWorld } from '../engine/types';
import { ENEMY_ANT_TUNING, ENEMY_TACTIC_TUNING } from '../antTuning';

export enum EnemyAntRole {
  BRUTE = 'BRUTE',
  RUNNER = 'RUNNER',
  SPITTER = 'SPITTER',
}

export enum EnemySquadTactic {
  SIEGE = 'SIEGE',
  RAID = 'RAID',
  HARASS = 'HARASS',
}

export interface EnemyAntConfig {
  id: string;
  nestId: string;
  role: EnemyAntRole;
  tactic: EnemySquadTactic;
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
  public readonly role: EnemyAntRole;
  public readonly tactic: EnemySquadTactic;

  private x: number;
  private y: number;
  private hp: number;
  private readonly maxHp: number;
  private readonly rawDamage: number;
  private readonly rawSpeed: number;
  private readonly rawAttackRange: number;
  private readonly baseAttackCooldownSeconds: number;
  private attackCooldownSeconds = 0;
  private timeSinceSpawn = 0;
  private readonly runChargeDelaySeconds: number;

  constructor(config: EnemyAntConfig) {
    this.id = config.id;
    this.nestId = config.nestId;
    this.role = config.role;
    this.tactic = config.tactic;
    this.x = config.x;
    this.y = config.y;
    this.hp = Math.max(1, config.health);
    this.maxHp = this.hp;
    this.rawDamage = Math.max(1, config.damage);
    this.rawSpeed = Math.max(8, config.speed);
    this.rawAttackRange =
      this.role === EnemyAntRole.SPITTER ? ENEMY_ANT_TUNING.baseAttackRange + 8 : ENEMY_ANT_TUNING.baseAttackRange;
    this.baseAttackCooldownSeconds = Math.max(0.25, config.attackCooldownSeconds);
    this.timeSinceSpawn = 0;
    this.runChargeDelaySeconds = ENEMY_TACTIC_TUNING.HARASS.runnerChargeDelaySeconds;
  }

  get position() {
    return { x: this.x, y: this.y };
  }

  get damage() {
    return this.rawDamage;
  }

  get attackRange() {
    return this.rawAttackRange;
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

    // Track how long this enemy has existed; Runners should wait before charging the nest.
    this.timeSinceSpawn += deltaTime;

    if (this.role === EnemyAntRole.RUNNER && this.timeSinceSpawn < this.runChargeDelaySeconds) {
      const harassOffset = ENEMY_TACTIC_TUNING.HARASS.runnerOrbitRadiusOffset;
      const orbitRadius = world.nestRadius + harassOffset;
      const hash = this.hashId();
      const angle = world.time * 0.55 + hash;
      const targetX = world.center.x + Math.cos(angle) * orbitRadius;
      const targetY = world.center.y + Math.sin(angle) * orbitRadius;
      this.moveTowards(targetX, targetY, deltaTime);
      this.x = clamp(this.x, 0, Math.max(0, world.width - 2));
      this.y = clamp(this.y, 0, Math.max(0, world.height - 2));
      return;
    }

    if (this.moveTowardsTauntingGuardian(world, deltaTime)) {
      this.x = clamp(this.x, 0, Math.max(0, world.width - 2));
      this.y = clamp(this.y, 0, Math.max(0, world.height - 2));
      return;
    }

    if (this.tactic === EnemySquadTactic.HARASS) {
      const harassOffset =
        this.role === EnemyAntRole.RUNNER
          ? ENEMY_TACTIC_TUNING.HARASS.runnerOrbitRadiusOffset
          : ENEMY_TACTIC_TUNING.HARASS.orbitRadiusOffset;
      const orbitRadius = world.nestRadius + harassOffset;
      const hash = this.hashId();
      const angle = world.time * 0.55 + hash;
      const targetX = world.center.x + Math.cos(angle) * orbitRadius;
      const targetY = world.center.y + Math.sin(angle) * orbitRadius;
      this.moveTowards(targetX, targetY, deltaTime);
    } else if (this.tactic === EnemySquadTactic.SIEGE && this.role === EnemyAntRole.SPITTER) {
      const preferredDistance = world.nestRadius + 22;
      const dx = world.center.x - this.x;
      const dy = world.center.y - this.y;
      const distance = Math.hypot(dx, dy);

      if (distance > preferredDistance + 2) {
        this.moveTowards(world.center.x, world.center.y, deltaTime);
      } else if (distance < preferredDistance - 2) {
        this.moveAwayFrom(world.center.x, world.center.y, deltaTime);
      }
    } else {
      const stopFactor = this.tactic === EnemySquadTactic.RAID ? 0.45 : 0.65;
      const dx = world.center.x - this.x;
      const dy = world.center.y - this.y;
      const distance = Math.hypot(dx, dy);

      if (distance > world.nestRadius * stopFactor) {
        this.moveTowards(world.center.x, world.center.y, deltaTime);
      }
    }

    this.x = clamp(this.x, 0, Math.max(0, world.width - 2));
    this.y = clamp(this.y, 0, Math.max(0, world.height - 2));
  }

  draw(context: CanvasRenderingContext2D) {
    const lowHealthAlpha = this.maxHp <= 0 ? 1 : 0.6 + 0.4 * (this.hp / this.maxHp);
    if (this.role === EnemyAntRole.BRUTE) {
      context.fillStyle = `rgba(223, 92, 78, ${lowHealthAlpha.toFixed(2)})`;
      context.fillRect(Math.round(this.x), Math.round(this.y), 3, 3);
      return;
    }

    if (this.role === EnemyAntRole.SPITTER) {
      context.fillStyle = `rgba(245, 177, 82, ${lowHealthAlpha.toFixed(2)})`;
      context.fillRect(Math.round(this.x), Math.round(this.y), 2, 2);
      return;
    }

    context.fillStyle = `rgba(214, 108, 167, ${lowHealthAlpha.toFixed(2)})`;
    context.fillRect(Math.round(this.x), Math.round(this.y), 2, 2);
  }

  private moveTowards(targetX: number, targetY: number, deltaTime: number) {
    const angle = Math.atan2(targetY - this.y, targetX - this.x);
    this.x += Math.cos(angle) * this.rawSpeed * deltaTime;
    this.y += Math.sin(angle) * this.rawSpeed * deltaTime;
  }

  private moveAwayFrom(targetX: number, targetY: number, deltaTime: number) {
    const angle = Math.atan2(this.y - targetY, this.x - targetX);
    this.x += Math.cos(angle) * this.rawSpeed * deltaTime;
    this.y += Math.sin(angle) * this.rawSpeed * deltaTime;
  }

  private moveTowardsTauntingGuardian(world: GameWorld, deltaTime: number) {
    const guardians = world.tauntingGuardians ?? [];
    let nearest: { id: string; x: number; y: number; tauntRadius: number } | null = null;
    let nearestDistance = Number.POSITIVE_INFINITY;

    for (const guardian of guardians) {
      const distance = Math.hypot(guardian.x - this.x, guardian.y - this.y);

      if (distance > guardian.tauntRadius + 8) {
        continue;
      }

      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = guardian;
      }
    }

    if (!nearest) {
      return false;
    }

    this.moveTowards(nearest.x, nearest.y, deltaTime);
    return true;
  }

  private hashId() {
    let hash = 0;

    for (let index = 0; index < this.id.length; index += 1) {
      hash = (hash * 31 + this.id.charCodeAt(index)) | 0;
    }

    const unsigned = hash >>> 0;
    return (unsigned % 628) / 100;
  }
}
