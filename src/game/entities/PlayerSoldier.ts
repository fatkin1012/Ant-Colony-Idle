import type { GameEntity, GameWorld } from '../engine/types';
import { PLAYER_SOLDIER_TUNING } from '../antTuning';
import { computeStats } from '../combat/antBalance';
import { AntRole, SquadMode } from '../combat/antTypes';

const GOLDEN_ANGLE_RAD = Math.PI * (3 - Math.sqrt(5));
const DEFEND_SCAN_RADIUS_BASE = PLAYER_SOLDIER_TUNING.defendScanRadiusBase;
const GUARDIAN_DEFEND_SCAN_RADIUS_BASE = PLAYER_SOLDIER_TUNING.guardianDefendScanRadiusBase;
const ASSAULT_ENGAGE_RADIUS = PLAYER_SOLDIER_TUNING.assaultEngageRadius;
const SPITTER_PREFERRED_THREAT_DISTANCE = PLAYER_SOLDIER_TUNING.spitterPreferredThreatDistance;
const SPITTER_DISTANCE_TOLERANCE = PLAYER_SOLDIER_TUNING.spitterDistanceTolerance;
const GUARDIAN_DEFENSE_HOLD_RADIUS = PLAYER_SOLDIER_TUNING.guardianDefenseHoldRadius;

function normalizeAngle(angle: number) {
  const tau = Math.PI * 2;
  return ((angle % tau) + tau) % tau;
}

function extractNumericSuffix(id: string) {
  const match = id.match(/(\d+)$/);
  return match ? Number(match[1]) : 0;
}

function hashString(value: string) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0;
  }

  return hash >>> 0;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export interface PlayerSoldierConfig {
  id: string;
  role: AntRole;
  mode: SquadMode;
  x: number;
  y: number;
  level?: number;
}

export class PlayerSoldier implements GameEntity {
  public alive = true;
  public readonly id: string;
  public readonly role: AntRole;
  public readonly mode: SquadMode;

  private x: number;
  private y: number;
  private hp: number;
  private readonly hpMax: number;
  private readonly rawDamage: number;
  private readonly rawSpeed: number;
  private readonly rawAttackRange: number;
  private readonly baseAttackCooldownSeconds: number;
  private readonly populationCost: number;
  private readonly defendOrbitPhase: number;
  private readonly defendRadiusOffset: number;
  private attackCooldownSeconds = 0;

  constructor(config: PlayerSoldierConfig) {
    this.id = config.id;
    this.role = config.role;
    this.mode = config.mode;
    this.x = config.x;
    this.y = config.y;

    const stats = computeStats(config.role, config.level ?? 1);
    this.hp = stats.hp;
    this.hpMax = stats.hp;
    this.rawDamage = stats.damage;
    this.rawSpeed = stats.speed;
    this.rawAttackRange = Math.max(5, stats.attackRange);
    this.baseAttackCooldownSeconds = Math.max(0.25, stats.attackCooldownSeconds);
    this.populationCost = Math.max(1, stats.popCost);

    const rolePhaseOffset =
      this.role === AntRole.GUARDIAN ? 0 : this.role === AntRole.RAIDER ? (Math.PI * 2) / 3 : (Math.PI * 4) / 3;
    const suffix = extractNumericSuffix(this.id);
    this.defendOrbitPhase = normalizeAngle(suffix * GOLDEN_ANGLE_RAD + rolePhaseOffset);

    const roleRadiusOffset = this.role === AntRole.GUARDIAN ? 5 : this.role === AntRole.RAIDER ? 0 : -5;
    const noise = (hashString(this.id) % 9) - 4;
    this.defendRadiusOffset = roleRadiusOffset + noise * 0.45;
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

  get popCost() {
    return this.populationCost;
  }

  get isGuardian() {
    return this.role === AntRole.GUARDIAN;
  }

  get tauntRadius() {
    if (!this.isGuardian) {
      return 0;
    }

    return this.mode === SquadMode.DEFEND
      ? PLAYER_SOLDIER_TUNING.guardianTauntRadiusDefend
      : PLAYER_SOLDIER_TUNING.guardianTauntRadiusAssault;
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

    const adjustedDamage = this.isGuardian ? amount * PLAYER_SOLDIER_TUNING.guardianDamageTakenMultiplier : amount;

    this.hp -= adjustedDamage;

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

    if (this.mode === SquadMode.DEFEND) {
      const defendScanBase = this.isGuardian ? GUARDIAN_DEFEND_SCAN_RADIUS_BASE : DEFEND_SCAN_RADIUS_BASE;
      const guardianHoldRadius = world.nestRadius + GUARDIAN_DEFENSE_HOLD_RADIUS;
      const defenseScanRadius = this.isGuardian
        ? guardianHoldRadius
        : Math.max(32, world.nestRadius + defendScanBase);
      const threat = this.findNearestThreatInDefenseRange(world.enemyAnts ?? [], world.center.x, world.center.y, defenseScanRadius);
      const canGuardianIntercept =
        !!threat &&
        (!this.isGuardian || Math.hypot(threat.x - world.center.x, threat.y - world.center.y) <= guardianHoldRadius);

      if (canGuardianIntercept && threat) {
        this.moveToThreatWithRoleBehavior(threat.x, threat.y, deltaTime, world.antSpeedMultiplier);
      } else {
        const ringRadius = Math.max(world.nestRadius + 18, world.nestRadius + 28 + this.defendRadiusOffset);
        const angle = this.defendOrbitPhase + world.time * 0.22;
        const targetX = world.center.x + Math.cos(angle) * ringRadius;
        const targetY = world.center.y + Math.sin(angle) * ringRadius;
        this.moveTowards(targetX, targetY, deltaTime, world.antSpeedMultiplier);
      }

      if (this.isGuardian) {
        const distanceToNest = this.distanceTo(world.center.x, world.center.y);

        if (distanceToNest > guardianHoldRadius) {
          this.moveTowards(world.center.x, world.center.y, deltaTime, world.antSpeedMultiplier);
        }
      }
    } else if ((world.enemyNests?.length ?? 0) === 0) {
      const ringRadius = Math.max(world.nestRadius + 18, world.nestRadius + 28 + this.defendRadiusOffset);
      const angle = this.defendOrbitPhase + world.time * 0.22;
      const targetX = world.center.x + Math.cos(angle) * ringRadius;
      const targetY = world.center.y + Math.sin(angle) * ringRadius;
      this.moveTowards(targetX, targetY, deltaTime, world.antSpeedMultiplier);
    } else {
      const nearbyThreat = this.findNearestThreatNearSelf(world.enemyAnts ?? [], ASSAULT_ENGAGE_RADIUS);

      if (nearbyThreat) {
        this.moveToThreatWithRoleBehavior(nearbyThreat.x, nearbyThreat.y, deltaTime, world.antSpeedMultiplier);
      } else {
        const nearestNest = this.findNearestNest(world.enemyNests ?? []);

        if (nearestNest) {
          this.moveToNestWithRoleBehavior(nearestNest.x, nearestNest.y, nearestNest.radius, deltaTime, world.antSpeedMultiplier);
        }
      }
    }

    this.x = clamp(this.x, 0, Math.max(0, world.width - 3));
    this.y = clamp(this.y, 0, Math.max(0, world.height - 3));
  }

  draw(context: CanvasRenderingContext2D) {
    const alpha = this.hpMax <= 0 ? 1 : 0.6 + 0.4 * (this.hp / this.hpMax);

    if (this.role === AntRole.GUARDIAN) {
      context.fillStyle = `rgba(124, 210, 255, ${alpha.toFixed(2)})`;
    } else if (this.role === AntRole.SPITTER) {
      context.fillStyle = `rgba(164, 229, 119, ${alpha.toFixed(2)})`;
    } else {
      context.fillStyle = `rgba(247, 213, 136, ${alpha.toFixed(2)})`;
    }

    context.fillRect(Math.round(this.x), Math.round(this.y), 3, 3);
  }

  private moveTowards(targetX: number, targetY: number, deltaTime: number, speedMultiplier = 1) {
    const angle = Math.atan2(targetY - this.y, targetX - this.x);
    const speed = this.rawSpeed * Math.max(0.1, speedMultiplier);
    this.x += Math.cos(angle) * speed * deltaTime;
    this.y += Math.sin(angle) * speed * deltaTime;
  }

  private moveToThreatWithRoleBehavior(targetX: number, targetY: number, deltaTime: number, speedMultiplier: number) {
    if (this.role !== AntRole.SPITTER) {
      this.moveTowards(targetX, targetY, deltaTime, speedMultiplier);
      return;
    }

    this.maintainDistance(targetX, targetY, SPITTER_PREFERRED_THREAT_DISTANCE, SPITTER_DISTANCE_TOLERANCE, deltaTime, speedMultiplier);
  }

  private moveToNestWithRoleBehavior(
    nestX: number,
    nestY: number,
    nestRadius: number,
    deltaTime: number,
    speedMultiplier: number,
  ) {
    if (this.role !== AntRole.SPITTER) {
      this.moveTowards(nestX, nestY, deltaTime, speedMultiplier);
      return;
    }

    const preferredDistance = nestRadius + Math.max(8, this.attackRange - 2);
    this.maintainDistance(nestX, nestY, preferredDistance, 2, deltaTime, speedMultiplier);
  }

  private maintainDistance(
    targetX: number,
    targetY: number,
    preferredDistance: number,
    tolerance: number,
    deltaTime: number,
    speedMultiplier: number,
  ) {
    const distance = this.distanceTo(targetX, targetY);

    if (distance > preferredDistance + tolerance) {
      this.moveTowards(targetX, targetY, deltaTime, speedMultiplier);
      return;
    }

    if (distance < preferredDistance - tolerance) {
      const angle = Math.atan2(this.y - targetY, this.x - targetX);
      const speed = this.rawSpeed * Math.max(0.1, speedMultiplier);
      this.x += Math.cos(angle) * speed * deltaTime;
      this.y += Math.sin(angle) * speed * deltaTime;
    }
  }

  private findNearestNest(nests: Array<{ id: string; x: number; y: number; radius: number }>) {
    if (nests.length === 0) {
      return null;
    }

    const first = nests[0];

    if (!first) {
      return null;
    }

    let nearest = first;
    let nearestDistance = this.distanceTo(nearest.x, nearest.y);

    for (const nest of nests) {
      const distance = this.distanceTo(nest.x, nest.y);

      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = nest;
      }
    }

    return nearest;
  }

  private findNearestThreatInDefenseRange(
    enemies: Array<{ id: string; x: number; y: number; role?: 'BRUTE' | 'RUNNER' | 'SPITTER' }>,
    nestX: number,
    nestY: number,
    defenseScanRadius: number,
  ) {
    let nearest: { id: string; x: number; y: number; role?: 'BRUTE' | 'RUNNER' | 'SPITTER' } | null = null;
    let nearestDistance = Number.POSITIVE_INFINITY;

    for (const enemy of enemies) {
      const enemyDistanceToNest = Math.hypot(enemy.x - nestX, enemy.y - nestY);

      if (enemyDistanceToNest > defenseScanRadius) {
        continue;
      }

      const distanceToSelf = this.distanceTo(enemy.x, enemy.y);

      if (distanceToSelf < nearestDistance) {
        nearestDistance = distanceToSelf;
        nearest = enemy;
      }
    }

    return nearest;
  }

  private findNearestThreatNearSelf(enemies: Array<{ id: string; x: number; y: number }>, maxRange: number) {
    let nearest: { id: string; x: number; y: number } | null = null;
    let nearestDistance = maxRange;

    for (const enemy of enemies) {
      const distanceToSelf = this.distanceTo(enemy.x, enemy.y);

      if (distanceToSelf <= nearestDistance) {
        nearestDistance = distanceToSelf;
        nearest = enemy;
      }
    }

    return nearest;
  }
}
