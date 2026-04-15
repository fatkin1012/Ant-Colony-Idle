import {
  ENEMY_CAVE_REGEN_INTERVAL_SECONDS,
  ENEMY_NEST_BASE_HEALTH,
  ENEMY_NEST_BASE_LEVEL_XP,
  ENEMY_NEST_BASE_MAX_ACTIVE_ENEMIES,
  ENEMY_NEST_BASE_SPAWN_INTERVAL_SECONDS,
  ENEMY_NEST_HEALTH_PER_LEVEL,
  ENEMY_NEST_LEVEL_XP_EXPONENT,
  ENEMY_NEST_MAX_ACTIVE_ENEMIES_PER_4_LEVELS,
  ENEMY_NEST_MIN_SPAWN_INTERVAL_SECONDS,
  ENEMY_NEST_SPAWN_INTERVAL_DECAY,
  ENEMY_NEST_XP_PER_SECOND,
  cave_regen_rate,
} from '../upgradeBalances';
import { ENEMY_ANT_TUNING } from '../antTuning';

export interface EnemyNestConfig {
  id: string;
  x: number;
  y: number;
  level?: number;
  hp?: number;
  xp?: number;
  activeSpawns?: number;
  spawnTimer?: number;
  regenTimer?: number;
}

export interface EnemyNestSnapshot {
  id: string;
  x: number;
  y: number;
  level: number;
  hp: number;
  xp: number;
  activeSpawns: number;
  spawnTimer: number;
  regenTimer: number;
}

export interface EnemySpawnStats {
  health: number;
  damage: number;
  speed: number;
  attackCooldownSeconds: number;
}

export class EnemyNest {
  public alive = true;
  public readonly id: string;

  private readonly x: number;
  private readonly y: number;
  private level: number;
  private xp = 0;
  private activeSpawns = 0;
  private hp: number;
  private maxHp: number;
  private spawnTimer: number;
  private regenTimer = ENEMY_CAVE_REGEN_INTERVAL_SECONDS;

  constructor(config: EnemyNestConfig) {
    this.id = config.id;
    this.x = config.x;
    this.y = config.y;
    this.level = Math.max(1, Math.floor(config.level ?? 1));
    this.maxHp = ENEMY_NEST_BASE_HEALTH + (this.level - 1) * ENEMY_NEST_HEALTH_PER_LEVEL;
    this.hp = Math.max(1, Math.min(this.maxHp, Math.floor(config.hp ?? this.maxHp)));
    this.xp = Math.max(0, Math.floor(config.xp ?? 0));
    this.activeSpawns = Math.max(0, Math.floor(config.activeSpawns ?? 0));
    this.spawnTimer = Math.max(0, config.spawnTimer ?? this.getSpawnCooldownSeconds());
    this.regenTimer = Math.max(0, config.regenTimer ?? ENEMY_CAVE_REGEN_INTERVAL_SECONDS);
  }

  get position() {
    return {
      x: this.x,
      y: this.y,
    };
  }

  get currentLevel() {
    return this.level;
  }

  get radius() {
    return 8 + this.level * 0.3;
  }

  update(deltaTime: number) {
    if (!this.alive) {
      return 0;
    }

    this.grow(deltaTime);
    this.regenerate(deltaTime);

    this.spawnTimer -= deltaTime;

    let spawnCount = 0;
    const maxActive = this.getMaxActiveSpawns();
    const cooldown = this.getSpawnCooldownSeconds();

    while (this.spawnTimer <= 0 && this.activeSpawns < maxActive) {
      spawnCount += 1;
      this.activeSpawns += 1;
      this.spawnTimer += cooldown;
    }

    return spawnCount;
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

  notifySpawnDestroyed() {
    this.activeSpawns = Math.max(0, this.activeSpawns - 1);
  }

  getSnapshot(): EnemyNestSnapshot {
    return {
      id: this.id,
      x: this.x,
      y: this.y,
      level: this.level,
      hp: this.hp,
      xp: this.xp,
      activeSpawns: this.activeSpawns,
      spawnTimer: this.spawnTimer,
      regenTimer: this.regenTimer,
    };
  }

  getSpawnStats(waveIndex = 1): EnemySpawnStats {
    const growthFactor = this.level - 1;
    const safeWaveIndex = Math.max(1, Math.floor(waveIndex));
    const waveHealthMultiplier = safeWaveIndex * 1.08;
    const waveDamageMultiplier = safeWaveIndex * 1.05;

    return {
      health: Math.max(
        1,
        Math.round(
          ENEMY_ANT_TUNING.baseHealth *
            Math.pow(ENEMY_ANT_TUNING.healthScalePerLevel, growthFactor) *
            waveHealthMultiplier,
        ),
      ),
      damage: Math.max(
        1,
        Math.round(
          ENEMY_ANT_TUNING.baseDamage *
            Math.pow(ENEMY_ANT_TUNING.damageScalePerLevel, growthFactor) *
            waveDamageMultiplier,
        ),
      ),
      speed: Math.round(ENEMY_ANT_TUNING.baseSpeed * Math.pow(ENEMY_ANT_TUNING.speedScalePerLevel, growthFactor)),
      attackCooldownSeconds: Math.max(0.35, ENEMY_ANT_TUNING.baseAttackCooldownSeconds * Math.pow(0.985, growthFactor)),
    };
  }

  draw(context: CanvasRenderingContext2D) {
    if (!this.alive) {
      return;
    }

    const nestRadius = this.radius;
    const hpRatio = this.maxHp <= 0 ? 0 : this.hp / this.maxHp;

    context.beginPath();
    context.fillStyle = '#5b1919';
    context.arc(this.x, this.y, nestRadius, 0, Math.PI * 2);
    context.fill();

    context.lineWidth = 2;
    context.strokeStyle = '#bb4545';
    context.stroke();

    context.beginPath();
    context.strokeStyle = '#f2bd57';
    context.lineWidth = 1.5;
    context.arc(this.x, this.y, nestRadius + 4, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * hpRatio);
    context.stroke();
  }

  private getSpawnCooldownSeconds() {
    return Math.max(
      ENEMY_NEST_MIN_SPAWN_INTERVAL_SECONDS,
      ENEMY_NEST_BASE_SPAWN_INTERVAL_SECONDS * Math.pow(ENEMY_NEST_SPAWN_INTERVAL_DECAY, this.level - 1),
    );
  }

  private getMaxActiveSpawns() {
    const bonus = Math.floor((this.level - 1) / 4) * ENEMY_NEST_MAX_ACTIVE_ENEMIES_PER_4_LEVELS;
    return ENEMY_NEST_BASE_MAX_ACTIVE_ENEMIES + Math.max(0, bonus);
  }

  private grow(deltaTime: number) {
    this.xp += ENEMY_NEST_XP_PER_SECOND * deltaTime;

    let requiredXp = this.getLevelUpXpRequirement();

    while (this.xp >= requiredXp) {
      this.xp -= requiredXp;
      this.level += 1;
      this.maxHp = ENEMY_NEST_BASE_HEALTH + (this.level - 1) * ENEMY_NEST_HEALTH_PER_LEVEL;
      this.hp = Math.min(this.maxHp, this.hp + ENEMY_NEST_HEALTH_PER_LEVEL * 0.4);
      requiredXp = this.getLevelUpXpRequirement();
    }
  }

  private regenerate(deltaTime: number) {
    this.regenTimer -= deltaTime;

    while (this.regenTimer <= 0) {
      this.regenTimer += ENEMY_CAVE_REGEN_INTERVAL_SECONDS;

      if (this.hp < this.maxHp) {
        this.hp = Math.min(this.maxHp, this.hp + cave_regen_rate);
      }
    }
  }

  private getLevelUpXpRequirement() {
    return ENEMY_NEST_BASE_LEVEL_XP * Math.pow(this.level, ENEMY_NEST_LEVEL_XP_EXPONENT);
  }
}
