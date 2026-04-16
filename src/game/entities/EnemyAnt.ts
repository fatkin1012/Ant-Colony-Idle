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
  private readonly runnerOrbitDirection: number;

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
    this.runnerOrbitDirection = (this.hashId() % 2 === 0 ? 1 : -1) as 1 | -1;
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
      this.orbitNestAsRunner(world, deltaTime);
      this.x = clamp(this.x, 0, Math.max(0, world.width - 2));
      this.y = clamp(this.y, 0, Math.max(0, world.height - 2));
      return;
    }

    if (this.moveTowardsTauntingGuardian(world, deltaTime)) {
      this.x = clamp(this.x, 0, Math.max(0, world.width - 2));
      this.y = clamp(this.y, 0, Math.max(0, world.height - 2));
      return;
    }

    if (this.moveTowardsNearbyPlayerUnit(world, deltaTime)) {
      this.x = clamp(this.x, 0, Math.max(0, world.width - 2));
      this.y = clamp(this.y, 0, Math.max(0, world.height - 2));
      return;
    }

    if (this.tactic === EnemySquadTactic.HARASS) {
      if (this.role === EnemyAntRole.RUNNER) {
        this.orbitNestAsRunner(world, deltaTime);
        this.x = clamp(this.x, 0, Math.max(0, world.width - 2));
        this.y = clamp(this.y, 0, Math.max(0, world.height - 2));
        return;
      }

      const harassOffset = ENEMY_TACTIC_TUNING.HARASS.orbitRadiusOffset;
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
    const x = Math.round(this.x);
    const y = Math.round(this.y);
    const lowHealthAlpha = this.maxHp <= 0 ? 1 : 0.6 + 0.4 * (this.hp / this.maxHp);

    context.beginPath();
    context.fillStyle = 'rgba(0, 0, 0, 0.22)';
    context.ellipse(x + 1.5, y + 3, 2.1, 0.85, 0, 0, Math.PI * 2);
    context.fill();

    if (this.role === EnemyAntRole.BRUTE) {
      context.fillStyle = `rgba(236, 67, 67, ${lowHealthAlpha.toFixed(2)})`;
      context.fillRect(x, y, 3, 3);
      context.strokeStyle = `rgba(78, 9, 12, ${Math.max(0.8, lowHealthAlpha).toFixed(2)})`;
      context.lineWidth = 1;
      context.strokeRect(x - 0.5, y - 0.5, 4, 4);
      context.fillStyle = `rgba(255, 214, 214, ${Math.max(0.82, lowHealthAlpha).toFixed(2)})`;
      context.fillRect(x + 1, y + 1, 1, 1);
      return;
    }

    if (this.role === EnemyAntRole.SPITTER) {
      context.fillStyle = `rgba(255, 131, 40, ${lowHealthAlpha.toFixed(2)})`;
      context.fillRect(x, y, 2, 2);
      context.strokeStyle = `rgba(90, 31, 5, ${Math.max(0.8, lowHealthAlpha).toFixed(2)})`;
      context.lineWidth = 1;
      context.strokeRect(x - 0.5, y - 0.5, 3, 3);
      context.fillStyle = `rgba(255, 226, 188, ${Math.max(0.82, lowHealthAlpha).toFixed(2)})`;
      context.beginPath();
      context.moveTo(x + 1, y + 0.2);
      context.lineTo(x + 1.7, y + 1.8);
      context.lineTo(x + 0.3, y + 1.8);
      context.closePath();
      context.fill();
      return;
    }

    context.fillStyle = `rgba(193, 70, 255, ${lowHealthAlpha.toFixed(2)})`;
    context.fillRect(x, y, 2, 2);
    context.strokeStyle = `rgba(58, 13, 87, ${Math.max(0.8, lowHealthAlpha).toFixed(2)})`;
    context.lineWidth = 1;
    context.strokeRect(x - 0.5, y - 0.5, 3, 3);
    context.fillStyle = `rgba(242, 219, 255, ${Math.max(0.82, lowHealthAlpha).toFixed(2)})`;
    context.beginPath();
    context.moveTo(x + 1, y + 0.1);
    context.lineTo(x + 1.9, y + 1);
    context.lineTo(x + 1, y + 1.9);
    context.lineTo(x + 0.1, y + 1);
    context.closePath();
    context.fill();
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

  private orbitNestAsRunner(world: GameWorld, deltaTime: number) {
    const dx = this.x - world.center.x;
    const dy = this.y - world.center.y;
    const distance = Math.hypot(dx, dy);
    const safeRadius = world.nestRadius + ENEMY_TACTIC_TUNING.HARASS.runnerOrbitSafetyBuffer;

    if (distance < safeRadius) {
      this.moveAwayFrom(world.center.x, world.center.y, deltaTime);
      return;
    }

    const desiredRadius = world.nestRadius + ENEMY_TACTIC_TUNING.HARASS.runnerOrbitRadiusOffset;
    const currentDistance = Math.max(0.001, distance);
    const radialX = dx / currentDistance;
    const radialY = dy / currentDistance;
    const tangentX = this.runnerOrbitDirection * -radialY;
    const tangentY = this.runnerOrbitDirection * radialX;
    const normalizedError = clamp((desiredRadius - currentDistance) / Math.max(1, desiredRadius), -1, 1);
    const correction = normalizedError * ENEMY_TACTIC_TUNING.HARASS.runnerOrbitRadialCorrection;
    const velocityX = tangentX + radialX * correction;
    const velocityY = tangentY + radialY * correction;
    const magnitude = Math.hypot(velocityX, velocityY);

    if (magnitude <= 0.0001) {
      return;
    }

    this.x += (velocityX / magnitude) * this.rawSpeed * deltaTime;
    this.y += (velocityY / magnitude) * this.rawSpeed * deltaTime;
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

  private moveTowardsNearbyPlayerUnit(world: GameWorld, deltaTime: number) {
    const playerUnits = world.playerUnits ?? [];

    if (playerUnits.length === 0) {
      return false;
    }

    const baseAggroRadius = this.role === EnemyAntRole.RUNNER ? 34 : this.role === EnemyAntRole.SPITTER ? 44 : 40;
    const aggroRadius = Math.max(baseAggroRadius, this.rawAttackRange + 18);
    let nearest: { x: number; y: number; distance: number } | null = null;

    for (const unit of playerUnits) {
      const distance = Math.hypot(unit.x - this.x, unit.y - this.y);

      if (distance > aggroRadius) {
        continue;
      }

      if (nearest === null || distance < nearest.distance) {
        nearest = { x: unit.x, y: unit.y, distance };
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
