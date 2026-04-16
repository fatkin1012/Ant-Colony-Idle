import { EntityManager } from './EntityManager';
import type { GameWorld } from './types';
import { Ant } from '../entities/Ant';
import type { AntState } from '../entities/Ant';
import { EnemyAnt, EnemyAntRole, EnemySquadTactic } from '../entities/EnemyAnt';
import { EnemyNest } from '../entities/EnemyNest';
import { Food } from '../entities/Food';
import { PlayerSoldier } from '../entities/PlayerSoldier';
import { ANT_COMBAT_TUNING, ENEMY_ROLE_TUNING, ENEMY_TACTIC_TUNING } from '../antTuning';
import {
  ANT_SPEED_MULTIPLIER_PER_LEVEL,
  BASE_ANT_FORAGE_RADIUS_FACTOR,
  BASE_MAX_FOOD_ON_FIELD,
  BASE_SPAWN_INTERVAL_SECONDS,
  ENEMY_CAVE_FIRST_SPAWN_AT_SECONDS,
  ENEMY_CAVE_RESPAWN_INTERVAL_SECONDS,
  FOOD_CAPACITY_PER_LEVEL,
  FORAGE_RADIUS_FACTOR_PER_LEVEL,
  MAX_ANT_FORAGE_RADIUS_FACTOR,
  MAX_ANT_SPEED_MULTIPLIER,
  MAX_FOOD_ON_FIELD,
  MAX_SPAWN_REDUCTION,
  MIN_SPAWN_INTERVAL_SECONDS,
  NEST_RECOVERY_PER_MINUTE_PER_LEVEL,
  NEST_DEFENSE_DAMAGE_PER_SECOND,
  NEST_DEFENSE_RANGE,
  PLAYER_NEST_MAX_HEALTH,
  BASE_POPULATION_CAPACITY,
  POPULATION_CAPACITY_PER_LEVEL,
  SOLDIER_ATTACK_RANGE_BONUS_PER_LEVEL,
  SOLDIER_ATTACK_COOLDOWN_REDUCTION_PER_LEVEL,
  MIN_SOLDIER_ATTACK_COOLDOWN_MULTIPLIER,
  SOLDIER_DAMAGE_SCALE_PER_LEVEL,
  SOLDIER_HEALTH_SCALE_PER_LEVEL,
  SOLDIER_SPEED_MULTIPLIER_PER_LEVEL,
  SOLDIER_TAUNT_RADIUS_BONUS_PER_LEVEL,
  MAX_SOLDIER_ATTACK_RANGE_BONUS,
  MAX_SOLDIER_SPEED_MULTIPLIER,
  MAX_SOLDIER_TAUNT_RADIUS_BONUS,
  SPAWN_REDUCTION_PER_LEVEL,
  getPlayerNestMaxHealth,
} from '../upgradeBalances';
import type { BattleDeployment } from '../../state/gameStore';
import type { GameMode } from '../../state/gamePersistence';
import { AntRole, SquadMode } from '../combat/antTypes';
import { ANT_TEMPLATES } from '../combat/antBalance';

const BACKGROUND_COLOR = '#222222';
const NEST_FILL = '#3b3026';
const NEST_RING = '#6f5a45';
const FOOD_VALUE_PER_PICKUP = 1;
const ANT_PICKUP_RADIUS = 1.5;
const FOOD_SPAWN_MARGIN = 10;
const ENEMY_ANT_GLOBAL_CAP = ANT_COMBAT_TUNING.enemyGlobalCap;
const ANT_ATTACK_DAMAGE_PER_SECOND = ANT_COMBAT_TUNING.workerAttackDamagePerSecond;
const ANT_ATTACK_RANGE = ANT_COMBAT_TUNING.workerAttackRange;
const ENEMY_MARCH_WORKER_HUNT_RANGE = ANT_COMBAT_TUNING.enemyMarchWorkerHuntRange;
const WORKER_RETALIATE_DAMAGE = ANT_COMBAT_TUNING.workerRetaliateDamage;
const WORKER_NEST_DEFENSE_BONUS_DPS = ANT_COMBAT_TUNING.workerNestDefenseBonusDps;
const WORKER_NEST_DEFENSE_BONUS_RANGE = ANT_COMBAT_TUNING.workerNestDefenseBonusRange;
const ENEMY_WAVE_BASE_INTERVAL_SECONDS = ANT_COMBAT_TUNING.enemyWaveBaseIntervalSeconds;
const ENEMY_WAVE_INTERVAL_DECAY_PER_LEVEL = ANT_COMBAT_TUNING.enemyWaveIntervalDecayPerLevel;
const ENEMY_WAVE_MIN_INTERVAL_SECONDS = ANT_COMBAT_TUNING.enemyWaveMinIntervalSeconds;
const ENEMY_WAVE_MAX_SPAWN_PER_TICK = ANT_COMBAT_TUNING.enemyWaveMaxSpawnPerTick;
const ENEMY_ANT_KILL_REWARD_FOOD = 10;
const ENEMY_NEST_BASE_DESTROY_REWARD_FOOD = 500;
const ENEMY_NEST_DESTROY_REWARD_PER_LEVEL = 200;
const SPITTER_ATTACK_EFFECT_LIFETIME_SECONDS = 0.2;
const HIT_FLASH_LIFETIME_SECONDS = 0.1;
const DAMAGE_TEXT_LIFETIME_SECONDS = 0.45;
const DEATH_DUST_LIFETIME_SECONDS = 0.38;
const SLASH_EFFECT_LIFETIME_SECONDS = 0.2;
const MAX_HIT_FLASH_EFFECTS = 90;
const MAX_DAMAGE_TEXT_EFFECTS = 45;
const MAX_DEATH_DUST_EFFECTS = 90;
const MAX_SLASH_EFFECTS = 100;

export interface PlayerAntSnapshot {
  id: string;
  x: number;
  y: number;
  state: AntState;
  carriedFoodCount?: number;
}

export interface PlayerSoldierSnapshot {
  id: string;
  role: AntRole;
  mode: SquadMode;
  x: number;
  y: number;
}

interface SpitterAttackEffect {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  elapsed: number;
  lifetime: number;
}

interface HitFlashEffect {
  x: number;
  y: number;
  radius: number;
  elapsed: number;
  lifetime: number;
  color: string;
}

interface DamageTextEffect {
  x: number;
  y: number;
  value: number;
  elapsed: number;
  lifetime: number;
  color: string;
}

interface DeathDustEffect {
  x: number;
  y: number;
  driftX: number;
  driftY: number;
  radius: number;
  elapsed: number;
  lifetime: number;
}

interface SlashEffect {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  elapsed: number;
  lifetime: number;
  color: string;
  width: number;
}

type CombatAudioKind = 'hit' | 'kill' | 'impact' | 'nest';

interface EnemyWaveOrder {
  role: EnemyAntRole;
  tactic: EnemySquadTactic;
  waveIndex: number;
}

export interface EnemyWaveOrderSnapshot {
  role: EnemyAntRole;
  tactic: EnemySquadTactic;
  waveIndex: number;
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
  waveTimer: number;
  waveCounter: number;
  waveQueue: EnemyWaveOrderSnapshot[];
}

export interface GameEngineSnapshot {
  time: number;
  nextFoodId: number;
  nextAntId: number;
  nextEnemyAntId: number;
  nextEnemyNestId: number;
  nextEnemyCaveSpawnAtSeconds: number;
  nextEnemyWaveInSeconds: number;
  playerAnts: PlayerAntSnapshot[];
  playerSoldiers: PlayerSoldierSnapshot[];
  enemyNests: EnemyNestSnapshot[];
}

interface GameEngineOptions {
  gameMode?: GameMode;
  onFoodCollected?: (amount: number) => void;
  getFoodAmount?: () => number;
  onAntSpawned?: (amount: number) => void;
  onAntLost?: (amount: number) => void;
  onNextEnemyWaveTimeChanged?: (seconds: number) => void;
  initialState?: GameEngineSnapshot | null;
  onStateChanged?: (state: GameEngineSnapshot) => void;
  onPopulationUsageChanged?: (amount: number) => void;
  onNestHealthChanged?: (health: number, maxHealth: number) => void;
  onNestDamaged?: (damageAmount: number, nextHealth: number, maxHealth: number) => void;
  getNestHealth?: () => number;
  getPopulationUsage?: () => number;
  consumeBattleDeployments?: () => BattleDeployment[];
  getUpgradeLevels?: () => {
    queenSpawnRate: number;
    carryCapacity: number;
    antSpeed: number;
    nestRecovery: number;
    nestMaxHealth: number;
    foodCapacity: number;
    forageRadius: number;
    populationCapacity: number;
    soldierDamage: number;
    soldierHealth: number;
    soldierSpeed: number;
    soldierTauntRange: number;
    soldierAttackRange: number;
    soldierAttackCooldown?: number;
  };
}

export class GameEngine {
  private readonly canvas: HTMLCanvasElement;
  private readonly context: CanvasRenderingContext2D;
  private readonly entityManager = new EntityManager();
  private readonly resizeObserver: ResizeObserver;
  private readonly gameMode: GameMode;
  private readonly handleVisibilityChange = () => {
    this.scheduleNextTick();
  };
  private tickTimeoutId: number | null = null;
  private lastTimestamp = 0;
  private accumulatedSeconds = 0;
  private width = 0;
  private height = 0;
  private time = 0;
  private foods: Food[] = [];
  private enemyNests: EnemyNest[] = [];
  private nextFoodId = 0;
  private nextAntId = 20;
  private nextEnemyAntId = 0;
  private nextEnemyNestId = 0;
  private spawnAccumulatorSeconds = 0;
  private nextEnemyCaveSpawnAtSeconds = ENEMY_CAVE_FIRST_SPAWN_AT_SECONDS;
  private readonly spitterAttackEffects: SpitterAttackEffect[] = [];
  private readonly hitFlashEffects: HitFlashEffect[] = [];
  private readonly damageTextEffects: DamageTextEffect[] = [];
  private readonly deathDustEffects: DeathDustEffect[] = [];
  private readonly slashEffects: SlashEffect[] = [];
  private cameraShakeSeconds = 0;
  private cameraShakeStrength = 0;
  private cameraShakeDirectionX = 0;
  private cameraShakeDirectionY = 0;
  private hitStopSeconds = 0;
  private readonly lastCombatAudioAt = new Map<CombatAudioKind, number>();
  private audioContext: AudioContext | null = null;
  private nestHealth = PLAYER_NEST_MAX_HEALTH;
  private readonly enemyWaveTimersSeconds = new Map<string, number>();
  private readonly enemyWaveCounters = new Map<string, number>();
  private readonly enemyWaveQueues = new Map<string, EnemyWaveOrder[]>();
  private readonly onFoodCollected?: (amount: number) => void;
  private readonly getFoodAmount?: () => number;
  private readonly onAntSpawned?: (amount: number) => void;
  private readonly onAntLost?: (amount: number) => void;
  private readonly onNextEnemyWaveTimeChanged?: (seconds: number) => void;
  private readonly onStateChanged?: (state: GameEngineSnapshot) => void;
  private readonly onPopulationUsageChanged?: (amount: number) => void;
  private readonly onNestHealthChanged?: (health: number, maxHealth: number) => void;
  private readonly onNestDamaged?: (damageAmount: number, nextHealth: number, maxHealth: number) => void;
  private readonly getNestHealth?: () => number;
  private readonly getPopulationUsage?: () => number;
  private readonly consumeBattleDeployments?: () => BattleDeployment[];
  private readonly getUpgradeLevels?: () => {
    queenSpawnRate: number;
    carryCapacity: number;
    antSpeed: number;
    nestRecovery: number;
    nestMaxHealth: number;
    foodCapacity: number;
    forageRadius: number;
    populationCapacity: number;
    soldierDamage: number;
    soldierHealth: number;
    soldierSpeed: number;
    soldierTauntRange: number;
    soldierAttackRange: number;
    soldierAttackCooldown?: number;
  };
  private lastReportedEnemyWaveTenths = Number.NaN;

  constructor(canvas: HTMLCanvasElement, options: GameEngineOptions = {}) {
    const context = canvas.getContext('2d');

    if (!context) {
      throw new Error('Canvas 2D context is unavailable.');
    }

    this.canvas = canvas;
    this.context = context;
    this.gameMode = options.gameMode ?? 'battle';
    this.onFoodCollected = options.onFoodCollected;
    this.getFoodAmount = options.getFoodAmount;
    this.onAntSpawned = options.onAntSpawned;
    this.onAntLost = options.onAntLost;
    this.onNextEnemyWaveTimeChanged = options.onNextEnemyWaveTimeChanged;
    this.onStateChanged = options.onStateChanged;
    this.onPopulationUsageChanged = options.onPopulationUsageChanged;
    this.onNestHealthChanged = options.onNestHealthChanged;
    this.onNestDamaged = options.onNestDamaged;
    this.getNestHealth = options.getNestHealth;
    this.getPopulationUsage = options.getPopulationUsage;
    this.consumeBattleDeployments = options.consumeBattleDeployments;
    this.getUpgradeLevels = options.getUpgradeLevels;
    this.nestHealth = Math.max(
      0,
      Math.min(this.getCurrentNestMaxHealth(), Math.floor(this.getNestHealth?.() ?? PLAYER_NEST_MAX_HEALTH)),
    );
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    this.resize();
    this.seedFood();
    const world = this.createWorld();

    if (options.initialState) {
      this.restoreFromSnapshot(options.initialState, world);
    } else {
      this.seedAnts();
      if (this.gameMode === 'battle') {
        this.seedEnemyNests(world);
      }
    }

    this.emitStateChanged();
    this.syncPopulationUsage();
    this.onNestHealthChanged?.(this.nestHealth, this.getCurrentNestMaxHealth());
  }

  private getCurrentNestMaxHealth() {
    const nestMaxHealthLevel = Math.max(0, this.getUpgradeLevels?.().nestMaxHealth ?? 0);
    return getPlayerNestMaxHealth(nestMaxHealthLevel);
  }

  start() {
    if (this.tickTimeoutId !== null) {
      return;
    }

    this.lastTimestamp = performance.now();
    this.scheduleNextTick();
  }

  stop() {
    if (this.tickTimeoutId !== null) {
      window.clearTimeout(this.tickTimeoutId);
      this.tickTimeoutId = null;
    }
  }

  destroy() {
    this.stop();
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    this.resizeObserver.disconnect();
    this.entityManager.clear();
    this.enemyNests = [];
    this.spitterAttackEffects.length = 0;
    this.hitFlashEffects.length = 0;
    this.damageTextEffects.length = 0;
    this.deathDustEffects.length = 0;
    this.slashEffects.length = 0;
  }

  private readonly tick = () => {
    const timestamp = performance.now();
    const deltaTime = Math.max(0, (timestamp - this.lastTimestamp) / 1000);
    this.lastTimestamp = timestamp;

    if (this.hitStopSeconds > 0) {
      this.hitStopSeconds = Math.max(0, this.hitStopSeconds - deltaTime);

      if (!document.hidden) {
        this.render(this.createWorld());
      }

      this.scheduleNextTick();
      return;
    }

    this.accumulatedSeconds += deltaTime;

    const maxSimulationSecondsPerTick = 2;
    const simulationStepSeconds = 0.05;
    let processedSeconds = 0;

    while (this.accumulatedSeconds >= simulationStepSeconds && processedSeconds < maxSimulationSecondsPerTick) {
      const world = this.createWorld();
      this.stepSimulation(simulationStepSeconds, world);
      this.accumulatedSeconds -= simulationStepSeconds;
      processedSeconds += simulationStepSeconds;
    }

    if (this.accumulatedSeconds > 0 && processedSeconds < maxSimulationSecondsPerTick) {
      const world = this.createWorld();
      const finalStep = Math.min(this.accumulatedSeconds, maxSimulationSecondsPerTick - processedSeconds);
      this.stepSimulation(finalStep, world);
      this.accumulatedSeconds -= finalStep;
    }

    if (!document.hidden) {
      this.render(this.createWorld());
    }

    this.scheduleNextTick();
  };

  private scheduleNextTick() {
    if (this.tickTimeoutId !== null) {
      window.clearTimeout(this.tickTimeoutId);
    }

    const delay = document.hidden ? 250 : 16;
    this.tickTimeoutId = window.setTimeout(this.tick, delay);
  }

  private stepSimulation(deltaTime: number, world: GameWorld) {
    this.time += deltaTime;

    if (this.gameMode === 'battle') {
      this.consumeQueuedBattleDeployments(world);
    }
    this.updateRealtimeSpawning(deltaTime, world);
    if (this.gameMode === 'battle') {
      this.updateTimedEnemyCaveSpawning(world);
      this.updateEnemyNestSpawning(deltaTime, world);
    }
    this.entityManager.update(deltaTime, world);
    this.resolveFoodDeliveries();
    this.resolveFoodPickups(world);
    if (this.gameMode === 'battle') {
      this.resolveEnemyCombat(deltaTime, world);
    }
    this.applyNestRecovery(deltaTime);
    this.updateAttackEffects(deltaTime);
    this.pruneFood();
    if (this.gameMode === 'battle') {
      this.pruneEnemyNests();
    }
    this.ensureFoodPopulation(world);
    this.reportNextEnemyWaveTime();
    this.emitStateChanged();
    this.syncPopulationUsage();
  }

  private emitStateChanged() {
    this.onStateChanged?.(this.createSnapshot());
  }

  private createSnapshot(): GameEngineSnapshot {
    const playerAnts: PlayerAntSnapshot[] = [];
    const playerSoldiers: PlayerSoldierSnapshot[] = [];

    for (const entity of this.entityManager.values()) {
      if (entity instanceof Ant && entity.alive) {
        playerAnts.push({
          id: entity.id,
          x: entity.position.x,
          y: entity.position.y,
          state: entity.state as AntState,
          carriedFoodCount: entity.carriedFood,
        });
      } else if (entity instanceof PlayerSoldier && entity.alive) {
        playerSoldiers.push({
          id: entity.id,
          role: entity.role,
          mode: entity.mode,
          x: entity.position.x,
          y: entity.position.y,
        });
      }
    }

    const enemyNests = this.enemyNests
      .filter((enemyNest) => enemyNest.alive)
      .map((enemyNest) => ({
        ...enemyNest.getSnapshot(),
        waveTimer: this.enemyWaveTimersSeconds.get(enemyNest.id) ?? this.getNextWaveCooldownSeconds(enemyNest.currentLevel),
        waveCounter: this.enemyWaveCounters.get(enemyNest.id) ?? 0,
        waveQueue: (this.enemyWaveQueues.get(enemyNest.id) ?? []).map((order) => ({
          role: order.role,
          tactic: order.tactic,
          waveIndex: order.waveIndex,
        })),
      }));

    return {
      time: this.time,
      nextFoodId: this.nextFoodId,
      nextAntId: this.nextAntId,
      nextEnemyAntId: this.nextEnemyAntId,
      nextEnemyNestId: this.nextEnemyNestId,
      nextEnemyCaveSpawnAtSeconds: this.nextEnemyCaveSpawnAtSeconds,
      nextEnemyWaveInSeconds: this.getNextEnemyWaveTimeSeconds(),
      playerAnts,
      playerSoldiers,
      enemyNests,
    };
  }

  private getNextEnemyWaveTimeSeconds() {
    if (this.gameMode !== 'battle') {
      return 0;
    }

    let nextSeconds = Math.max(0, this.nextEnemyCaveSpawnAtSeconds - this.time);
    let hasWaveTimer = false;

    for (const enemyNest of this.enemyNests) {
      if (!enemyNest.alive) {
        continue;
      }

      const timer = this.enemyWaveTimersSeconds.get(enemyNest.id);

      if (timer === undefined) {
        continue;
      }

      const safeTimer = Math.max(0, timer);
      if (!hasWaveTimer || safeTimer < nextSeconds) {
        nextSeconds = safeTimer;
      }

      hasWaveTimer = true;
    }

    return Math.round(nextSeconds * 10) / 10;
  }

  private restoreFromSnapshot(snapshot: GameEngineSnapshot, world: GameWorld) {
    this.time = Math.max(0, snapshot.time);
    this.nextFoodId = Math.max(0, snapshot.nextFoodId);
    this.nextAntId = Math.max(0, snapshot.nextAntId);
    this.nextEnemyAntId = Math.max(0, snapshot.nextEnemyAntId);
    this.nextEnemyNestId = Math.max(0, snapshot.nextEnemyNestId);
    this.nextEnemyCaveSpawnAtSeconds = Math.max(0, snapshot.nextEnemyCaveSpawnAtSeconds);

    this.entityManager.clear();
    this.enemyNests = [];
    this.enemyWaveTimersSeconds.clear();
    this.enemyWaveCounters.clear();
    this.enemyWaveQueues.clear();
    this.spitterAttackEffects.length = 0;
    this.hitFlashEffects.length = 0;
    this.damageTextEffects.length = 0;
    this.deathDustEffects.length = 0;
    this.slashEffects.length = 0;

    for (const ant of snapshot.playerAnts) {
      this.entityManager.add(
        new Ant({
          id: ant.id,
          x: ant.x,
          y: ant.y,
          state: ant.state,
          carriedFoodCount: Math.max(0, Math.floor(ant.carriedFoodCount ?? 0)),
        }),
      );
    }

    if (this.gameMode !== 'battle') {
      this.reportNextEnemyWaveTime();
      this.onStateChanged?.(this.createSnapshot());
      this.onPopulationUsageChanged?.(this.getPopulationCount());
      return;
    }

    for (const soldier of snapshot.playerSoldiers) {
      this.entityManager.add(
        new PlayerSoldier({
          id: soldier.id,
          role: soldier.role,
          mode: soldier.mode,
          x: soldier.x,
          y: soldier.y,
        }),
      );
    }

    for (const nestState of snapshot.enemyNests) {
      const enemyNest = new EnemyNest({
        id: nestState.id,
        x: nestState.x,
        y: nestState.y,
        level: nestState.level,
        hp: nestState.hp,
        xp: nestState.xp,
        activeSpawns: nestState.activeSpawns,
        spawnTimer: nestState.spawnTimer,
        regenTimer: nestState.regenTimer,
      });

      this.enemyNests.push(enemyNest);
      this.enemyWaveTimersSeconds.set(enemyNest.id, nestState.waveTimer);
      this.enemyWaveCounters.set(enemyNest.id, nestState.waveCounter);
      this.enemyWaveQueues.set(
        enemyNest.id,
        (nestState.waveQueue ?? []).map((order) => ({
          role: order.role,
          tactic: order.tactic,
          waveIndex: order.waveIndex,
        })),
      );
    }

    this.reportNextEnemyWaveTime();
    this.onStateChanged?.(this.createSnapshot());
    this.onPopulationUsageChanged?.(this.getPopulationCount());
  }

  private reportNextEnemyWaveTime() {
    const nextSeconds = this.getNextEnemyWaveTimeSeconds();

    const roundedToTenths = Math.round(nextSeconds * 10) / 10;
    if (roundedToTenths === this.lastReportedEnemyWaveTenths) {
      return;
    }

    this.lastReportedEnemyWaveTenths = roundedToTenths;
    this.onNextEnemyWaveTimeChanged?.(roundedToTenths);
  }

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
    const upgradeLevels = this.getUpgradeLevels?.() ?? {
      queenSpawnRate: 0,
      carryCapacity: 0,
      antSpeed: 0,
      nestRecovery: 0,
      foodCapacity: 0,
      forageRadius: 0,
      populationCapacity: 0,
      soldierDamage: 0,
      soldierHealth: 0,
      soldierSpeed: 0,
      soldierTauntRange: 0,
      soldierAttackRange: 0,
      soldierAttackCooldown: 0,
    };

    const maxFoodOnField = Math.min(
      MAX_FOOD_ON_FIELD,
      BASE_MAX_FOOD_ON_FIELD + Math.max(0, upgradeLevels.foodCapacity) * FOOD_CAPACITY_PER_LEVEL,
    );

    const forageRadiusFactor = Math.min(
      MAX_ANT_FORAGE_RADIUS_FACTOR,
      BASE_ANT_FORAGE_RADIUS_FACTOR + Math.max(0, upgradeLevels.forageRadius) * FORAGE_RADIUS_FACTOR_PER_LEVEL,
    );

    const maxForageRadius = Math.max(56, Math.min(this.width, this.height) * forageRadiusFactor);
    const soldierDamageMultiplier = Math.pow(
      SOLDIER_DAMAGE_SCALE_PER_LEVEL,
      Math.max(0, Math.floor(upgradeLevels.soldierDamage)),
    );
    const soldierHealthMultiplier = Math.pow(
      SOLDIER_HEALTH_SCALE_PER_LEVEL,
      Math.max(0, Math.floor(upgradeLevels.soldierHealth)),
    );
    const soldierSpeedMultiplier = Math.min(
      MAX_SOLDIER_SPEED_MULTIPLIER,
      1 + Math.max(0, upgradeLevels.soldierSpeed) * SOLDIER_SPEED_MULTIPLIER_PER_LEVEL,
    );
    const soldierTauntRadiusBonus = Math.min(
      MAX_SOLDIER_TAUNT_RADIUS_BONUS,
      Math.max(0, upgradeLevels.soldierTauntRange) * SOLDIER_TAUNT_RADIUS_BONUS_PER_LEVEL,
    );
    const soldierAttackRangeBonus = Math.min(
      MAX_SOLDIER_ATTACK_RANGE_BONUS,
      Math.max(0, upgradeLevels.soldierAttackRange) * SOLDIER_ATTACK_RANGE_BONUS_PER_LEVEL,
    );
    const soldierAttackCooldownMultiplier = Math.max(
      MIN_SOLDIER_ATTACK_COOLDOWN_MULTIPLIER,
      1 - Math.max(0, upgradeLevels.soldierAttackCooldown ?? 0) * SOLDIER_ATTACK_COOLDOWN_REDUCTION_PER_LEVEL,
    );

    return {
      width: this.width,
      height: this.height,
      center: {
        x: this.width / 2,
        y: this.height / 2,
      },
      nestRadius: Math.max(19, Math.min(this.width, this.height) * 0.04),
      time: this.time,
      antSpeedMultiplier: Math.min(
        MAX_ANT_SPEED_MULTIPLIER,
        1 + Math.max(0, upgradeLevels.antSpeed) * ANT_SPEED_MULTIPLIER_PER_LEVEL,
      ),
      soldierDamageMultiplier,
      soldierHealthMultiplier,
      soldierSpeedMultiplier,
      soldierTauntRadiusBonus,
      soldierAttackRangeBonus,
      soldierAttackCooldownMultiplier,
      idleCooldownMultiplier: 1,
      carryCapacityBonus: Math.max(0, upgradeLevels.carryCapacity),
      maxFoodOnField,
      maxForageRadius,
      foodPositions: this.foods.filter((food) => food.alive).map((food) => food.position),
      playerUnits: Array.from(this.entityManager.values())
        .filter((entity): entity is Ant | PlayerSoldier => (entity instanceof Ant || entity instanceof PlayerSoldier) && entity.alive)
        .map((unit) => ({
          id: unit.id,
          x: unit.position.x,
          y: unit.position.y,
          kind: unit instanceof PlayerSoldier ? 'SOLDIER' : 'WORKER',
        })),
      enemyAnts: Array.from(this.entityManager.values())
        .filter((entity): entity is EnemyAnt => entity instanceof EnemyAnt && entity.alive)
        .map((enemyAnt) => ({
          id: enemyAnt.id,
          x: enemyAnt.position.x,
          y: enemyAnt.position.y,
          role: enemyAnt.role,
        })),
      tauntingGuardians: Array.from(this.entityManager.values())
        .filter((entity): entity is PlayerSoldier => entity instanceof PlayerSoldier && entity.alive && entity.isGuardian)
        .map((guardian) => ({
          id: guardian.id,
          x: guardian.position.x,
          y: guardian.position.y,
          tauntRadius: guardian.getTauntRadius(soldierTauntRadiusBonus),
        })),
      enemyNests:
        this.gameMode === 'battle'
          ? this.enemyNests
              .filter((enemyNest) => enemyNest.alive)
              .map((enemyNest) => ({
                id: enemyNest.id,
                x: enemyNest.position.x,
                y: enemyNest.position.y,
                radius: enemyNest.radius,
              }))
          : [],
    };
  }

  private render(world: GameWorld) {
    this.context.clearRect(0, 0, world.width, world.height);

    this.drawBackground(world);

    const shakeFactor = this.cameraShakeSeconds <= 0 ? 0 : this.cameraShakeSeconds / Math.max(0.001, 0.12);
    const shakeMagnitude = this.cameraShakeStrength * Math.max(0, Math.min(1, shakeFactor));
    const jitterX = shakeMagnitude <= 0 ? 0 : (Math.random() * 2 - 1) * shakeMagnitude * 0.65;
    const jitterY = shakeMagnitude <= 0 ? 0 : (Math.random() * 2 - 1) * shakeMagnitude * 0.65;
    const shakeOffsetX = this.cameraShakeDirectionX * shakeMagnitude * 0.75 + jitterX;
    const shakeOffsetY = this.cameraShakeDirectionY * shakeMagnitude * 0.75 + jitterY;

    this.context.save();
    this.context.translate(shakeOffsetX, shakeOffsetY);

    this.drawFood(world);
    if (this.gameMode === 'battle') {
      this.drawEnemyNests();
    }
    this.drawNest(world);
    this.entityManager.draw(this.context, world);
    this.drawAttackEffects();
    this.context.restore();
  }

  private drawBackground(world: GameWorld) {
    const { width, height, center } = world;
    const backgroundGradient = this.context.createRadialGradient(center.x, center.y, Math.min(width, height) * 0.05, center.x, center.y, Math.max(width, height) * 0.72);
    backgroundGradient.addColorStop(0, '#31281f');
    backgroundGradient.addColorStop(0.42, '#231d17');
    backgroundGradient.addColorStop(1, '#0d0c0b');

    this.context.fillStyle = backgroundGradient;
    this.context.fillRect(0, 0, width, height);

    this.context.save();
    this.context.globalAlpha = 0.12;
    this.context.fillStyle = '#5f4c3d';

    for (let y = 0; y < height; y += 26) {
      for (let x = (y / 26) % 2 === 0 ? 0 : 13; x < width; x += 26) {
        const noise = ((x * 17 + y * 23) % 100) / 100;
        if (noise < 0.72) {
          this.context.fillRect(x, y, 1, 1);
        }
      }
    }

    this.context.globalAlpha = 0.08;
    this.context.strokeStyle = '#8f7356';
    this.context.lineWidth = 1;
    this.context.beginPath();
    this.context.arc(center.x, center.y, world.nestRadius + 34, 0, Math.PI * 2);
    this.context.stroke();
    this.context.restore();
  }

  private drawEnemyNests() {
    for (const enemyNest of this.enemyNests) {
      enemyNest.draw(this.context);
    }
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
    const maxNestHealth = this.getCurrentNestMaxHealth();
    const hpRatio = maxNestHealth <= 0 ? 0 : Math.max(0, Math.min(1, this.nestHealth / maxNestHealth));

    this.context.save();
    this.context.globalAlpha = 0.28;
    this.context.fillStyle = '#000000';
    this.context.beginPath();
    this.context.ellipse(center.x, center.y + nestRadius * 0.36, nestRadius * 1.08, nestRadius * 0.42, 0, 0, Math.PI * 2);
    this.context.fill();
    this.context.restore();

    this.context.beginPath();
    this.context.fillStyle = NEST_FILL;
    this.context.arc(center.x, center.y, nestRadius, 0, Math.PI * 2);
    this.context.fill();

    this.context.lineWidth = 4;
    this.context.strokeStyle = NEST_RING;
    this.context.stroke();

    this.context.beginPath();
    this.context.strokeStyle = '#f2bd57';
    this.context.lineWidth = 2;
    this.context.arc(center.x, center.y, nestRadius + 6, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * hpRatio);
    this.context.stroke();
  }

  private seedAnts() {
    const seedCount = 20;
    const centerX = this.width / 2;
    const centerY = this.height / 2;
    const world = this.createWorld();

    for (let index = 0; index < seedCount; index += 1) {
      const angle = (Math.PI * 2 * index) / seedCount + Math.random() * 0.35;
      const distance = world.nestRadius + 28 + Math.random() * 26;
      const offsetX = Math.cos(angle) * distance;
      const offsetY = Math.sin(angle) * distance;

      this.entityManager.add(
        new Ant({
          id: `ant-${index}`,
          x: centerX + offsetX,
          y: centerY + offsetY,
          state: 'SEARCHING',
        }),
      );
    }

    this.nextAntId = seedCount;
  }

  private updateRealtimeSpawning(deltaTime: number, world: GameWorld) {
    this.spawnAccumulatorSeconds += deltaTime;

    let spawnIntervalSeconds = this.getCurrentSpawnIntervalSeconds();

    while (this.spawnAccumulatorSeconds >= spawnIntervalSeconds) {
      this.spawnAccumulatorSeconds -= spawnIntervalSeconds;
      this.spawnSingleAnt(world);
      spawnIntervalSeconds = this.getCurrentSpawnIntervalSeconds();
    }
  }

  private getCurrentSpawnIntervalSeconds() {
    const queenSpawnRateLevel = Math.max(0, this.getUpgradeLevels ? this.getUpgradeLevels().queenSpawnRate : 0);
    const reduction = Math.min(MAX_SPAWN_REDUCTION, queenSpawnRateLevel * SPAWN_REDUCTION_PER_LEVEL);
    return Math.max(MIN_SPAWN_INTERVAL_SECONDS, BASE_SPAWN_INTERVAL_SECONDS * (1 - reduction));
  }

  private spawnSingleAnt(world: GameWorld) {
    const upgradeLevels = this.getUpgradeLevels?.() ?? {
      queenSpawnRate: 0,
      carryCapacity: 0,
      antSpeed: 0,
      nestRecovery: 0,
      nestMaxHealth: 0,
      foodCapacity: 0,
      forageRadius: 0,
      populationCapacity: 0,
      soldierDamage: 0,
      soldierHealth: 0,
      soldierSpeed: 0,
      soldierTauntRange: 0,
      soldierAttackRange: 0,
      soldierAttackCooldown: 0,
    };

    const populationLimit = BASE_POPULATION_CAPACITY + Math.max(0, upgradeLevels.populationCapacity) * POPULATION_CAPACITY_PER_LEVEL;
    const currentPopulation = this.getPopulationUsage ? this.getPopulationUsage() : this.getPopulationCount();

    if (currentPopulation >= populationLimit) {
      return;
    }

    const angle = Math.random() * Math.PI * 2;
    const distance = world.nestRadius + 16 + Math.random() * 10;
    const x = world.center.x + Math.cos(angle) * distance;
    const y = world.center.y + Math.sin(angle) * distance;

    this.entityManager.add(
      new Ant({
        id: `ant-${this.nextAntId}`,
        x,
        y,
        state: 'SEARCHING',
      }),
    );

    this.nextAntId += 1;
    this.onAntSpawned?.(1);
  }

  private seedFood() {
    this.foods = [];

    const world = this.createWorld();

    for (let index = 0; index < world.maxFoodOnField; index += 1) {
      this.foods.push(this.createFood(world, index));
    }
  }

  private seedEnemyNests(_world: GameWorld) {
    if (this.gameMode !== 'battle') {
      return;
    }

    this.enemyNests = [];
    this.enemyWaveTimersSeconds.clear();
    this.enemyWaveCounters.clear();
    this.enemyWaveQueues.clear();
    this.nextEnemyNestId = 0;
    this.nextEnemyCaveSpawnAtSeconds = ENEMY_CAVE_FIRST_SPAWN_AT_SECONDS;
  }

  private updateTimedEnemyCaveSpawning(world: GameWorld) {
    if (this.gameMode !== 'battle') {
      return;
    }

    while (this.time >= this.nextEnemyCaveSpawnAtSeconds) {
      const position = this.createRandomEnemyNestPosition(world);

      if (!position) {
        break;
      }

      this.spawnEnemyNestAt(world, position.x, position.y);
      this.nextEnemyCaveSpawnAtSeconds += ENEMY_CAVE_RESPAWN_INTERVAL_SECONDS;
    }
  }

  private spawnEnemyNestAt(world: GameWorld, x: number, y: number) {
    const id = `enemy-nest-${this.nextEnemyNestId}`;
    this.nextEnemyNestId += 1;
    const nestSequence = this.getEnemyNestSequence(id);

    const enemyNest = new EnemyNest({ id, x, y });
    this.enemyNests.push(enemyNest);

    const initialWaveIndex = 1;
    const initialWaveQueue = this.createWaveOrders(nestSequence, initialWaveIndex);
    this.enemyWaveCounters.set(id, initialWaveIndex);
    this.enemyWaveTimersSeconds.set(id, this.getNextWaveCooldownSeconds(enemyNest.currentLevel));
    this.enemyWaveQueues.set(id, initialWaveQueue);

    // Spawn one full opening wave immediately when the cave appears.
    this.spawnWaveUnits(world, enemyNest, Number.POSITIVE_INFINITY);
  }

  private createRandomEnemyNestPosition(world: GameWorld) {
    const margin = 10;

    for (let attempt = 0; attempt < 120; attempt += 1) {
      const x = margin + Math.random() * Math.max(1, world.width - margin * 2);
      const y = margin + Math.random() * Math.max(1, world.height - margin * 2);
      const minDistanceFactor = 0.2 + Math.random() * 0.2;

      if (this.canPlaceEnemyNest(x, y, world, minDistanceFactor)) {
        return { x, y };
      }
    }

    return null;
  }

  private canPlaceEnemyNest(x: number, y: number, world: GameWorld, minNestDistanceFactor: number) {
    const minDistanceToPlayerNest = Math.min(world.width, world.height) * minNestDistanceFactor;
    const distanceToPlayerNest = Math.hypot(x - world.center.x, y - world.center.y);

    if (distanceToPlayerNest < minDistanceToPlayerNest) {
      return false;
    }

    for (const existingNest of this.enemyNests) {
      if (!existingNest.alive) {
        continue;
      }

      const existing = existingNest.position;
      const distance = Math.hypot(existing.x - x, existing.y - y);

      if (distance < 22) {
        return false;
      }
    }

    return true;
  }

  private updateEnemyNestSpawning(deltaTime: number, world: GameWorld) {
    if (this.gameMode !== 'battle') {
      return;
    }

    for (const enemyNest of this.enemyNests) {
      if (!enemyNest.alive) {
        continue;
      }

      this.updateEnemyWaveQueue(enemyNest, deltaTime);
      this.spawnWaveUnits(world, enemyNest);

      const spawnCount = enemyNest.update(deltaTime);

      if (spawnCount <= 0 || !enemyNest.alive) {
        continue;
      }

      for (let index = 0; index < spawnCount; index += 1) {
        if (this.getAliveEnemyAntCount() >= ENEMY_ANT_GLOBAL_CAP) {
          enemyNest.notifySpawnDestroyed();
          continue;
        }

        this.spawnEnemyAnt(world, enemyNest, this.pickAmbientEnemyRole(enemyNest.currentLevel), EnemySquadTactic.SIEGE, 1);
      }
    }
  }

  private spawnEnemyAnt(
    world: GameWorld,
    enemyNest: EnemyNest,
    role: EnemyAntRole,
    tactic: EnemySquadTactic,
    waveIndex: number,
  ) {
    const spawnStats = enemyNest.getSpawnStats(waveIndex);
    const tunedStats = this.applyEnemyRoleModifiers(spawnStats, role, tactic);
    const nestPosition = enemyNest.position;
    const angle = Math.random() * Math.PI * 2;
    const distance = enemyNest.radius + 6 + Math.random() * 5;
    const x = Math.min(world.width - 2, Math.max(1, nestPosition.x + Math.cos(angle) * distance));
    const y = Math.min(world.height - 2, Math.max(1, nestPosition.y + Math.sin(angle) * distance));

    this.entityManager.add(
      new EnemyAnt({
        id: `enemy-ant-${this.nextEnemyAntId}`,
        nestId: enemyNest.id,
        role,
        tactic,
        x,
        y,
        health: tunedStats.health,
        damage: tunedStats.damage,
        speed: tunedStats.speed,
        attackCooldownSeconds: tunedStats.attackCooldownSeconds,
      }),
    );

    this.nextEnemyAntId += 1;
  }

  private ensureFoodPopulation(world: GameWorld) {
    while (this.foods.filter((food) => food.alive).length < world.maxFoodOnField) {
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
    for (let attempt = 0; attempt < 80; attempt += 1) {
      const x = minX + Math.random() * (maxX - minX);
      const y = minY + Math.random() * (maxY - minY);

      const centerX = x + size / 2;
      const centerY = y + size / 2;
      const dx = centerX - world.center.x;
      const dy = centerY - world.center.y;
      const distanceFromNest = Math.hypot(dx, dy);

      if (distanceFromNest < world.nestRadius + 24) {
        continue;
      }

      return new Food({
        id: `food-${foodIndex}`,
        x,
        y,
        size,
      });
    }

    const fallbackAngle = Math.random() * Math.PI * 2;
    const fallbackDistance = world.nestRadius + 26 + Math.random() * Math.min(world.width, world.height) * 0.45;
    const fallbackX = world.center.x + Math.cos(fallbackAngle) * fallbackDistance - size / 2;
    const fallbackY = world.center.y + Math.sin(fallbackAngle) * fallbackDistance - size / 2;

    return new Food({
      id: `food-${foodIndex}`,
      x: Math.min(maxX, Math.max(minX, fallbackX)),
      y: Math.min(maxY, Math.max(minY, fallbackY)),
      size,
    });
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
        const antCenterX = antPosition.x + ANT_PICKUP_RADIUS;
        const antCenterY = antPosition.y + ANT_PICKUP_RADIUS;
        const pickupRadius = Math.max(6, food.size * 2.5);
        const isInsideFood =
          food.containsPoint(antPosition.x, antPosition.y) ||
          food.containsPoint(antCenterX, antCenterY);

        if (isInsideFood) {
          food.alive = false;
          ant.collectFood();
          if (ant.shouldReturnToNest(world.carryCapacityBonus)) {
            ant.markFound();
          }
          break;
        }

        const distanceToFood = Math.hypot(antCenterX - foodPosition.x, antCenterY - foodPosition.y);

        if (distanceToFood <= pickupRadius) {
          food.alive = false;
          ant.collectFood();
          if (ant.shouldReturnToNest(world.carryCapacityBonus)) {
            ant.markFound();
          }
          break;
        }
      }
    }
  }

  private resolveFoodDeliveries() {
    for (const entity of this.entityManager.values()) {
      if (!(entity instanceof Ant) || !entity.alive) {
        continue;
      }

      const delivered = entity.consumeDeliveredFood();
      if (delivered <= 0) {
        continue;
      }

      this.onFoodCollected?.(delivered * FOOD_VALUE_PER_PICKUP);
    }
  }

  private resolveEnemyCombat(deltaTime: number, world: GameWorld) {
    if (this.gameMode !== 'battle') {
      return;
    }

    const ants = Array.from(this.entityManager.values()).filter((entity): entity is Ant => entity instanceof Ant);
    const soldiers = Array.from(this.entityManager.values()).filter(
      (entity): entity is PlayerSoldier => entity instanceof PlayerSoldier,
    );
    const enemyAnts = Array.from(this.entityManager.values()).filter(
      (entity): entity is EnemyAnt => entity instanceof EnemyAnt,
    );

    for (const enemyAnt of enemyAnts) {
      if (!enemyAnt.alive) {
        continue;
      }

      const distanceToNestCenter = enemyAnt.distanceTo(world.center.x, world.center.y);
      const isMarchingPhase = distanceToNestCenter > world.nestRadius + NEST_DEFENSE_RANGE + 8;
      const huntedWorker = isMarchingPhase
        ? this.findNearestAntInRange(ants, enemyAnt.position.x, enemyAnt.position.y, ENEMY_MARCH_WORKER_HUNT_RANGE)
        : null;

      const nearestUnit = this.findNearestDamageableUnit(
        ants,
        soldiers,
        enemyAnt.position.x,
        enemyAnt.position.y,
        enemyAnt.attackRange,
      );

      const tauntTarget = this.findTauntingGuardian(
        soldiers,
        enemyAnt.position.x,
        enemyAnt.position.y,
        enemyAnt.attackRange,
      );

      const primaryTarget = tauntTarget ?? huntedWorker ?? nearestUnit;

      if (primaryTarget && enemyAnt.canAttack()) {
        this.spawnSlashEffect(
          enemyAnt.position.x,
          enemyAnt.position.y,
          primaryTarget.position.x,
          primaryTarget.position.y,
          '255, 122, 100',
          1.6,
        );
        this.spawnHitFlash(primaryTarget.position.x, primaryTarget.position.y, enemyAnt.damage, '255, 170, 120');
        this.spawnDamageText(primaryTarget.position.x, primaryTarget.position.y - 2, enemyAnt.damage, '#ffb089');
        const unitKilled = primaryTarget.applyDamage(enemyAnt.damage);

        if (unitKilled) {
          this.spawnDeathDust(primaryTarget.position.x, primaryTarget.position.y, 1.1);
          if (primaryTarget instanceof PlayerSoldier) {
            this.onAntLost?.(primaryTarget.popCost);
          } else {
            this.onAntLost?.(1);
          }
        }

        if (primaryTarget instanceof Ant && primaryTarget.alive) {
          this.spawnSlashEffect(
            primaryTarget.position.x,
            primaryTarget.position.y,
            enemyAnt.position.x,
            enemyAnt.position.y,
            '196, 243, 162',
            1.3,
          );
          this.spawnHitFlash(enemyAnt.position.x, enemyAnt.position.y, WORKER_RETALIATE_DAMAGE, '214, 255, 183');
          const retaliateKilled = enemyAnt.applyDamage(WORKER_RETALIATE_DAMAGE);

          if (retaliateKilled) {
            this.handleEnemyAntDeath(enemyAnt);
            continue;
          }
        }

        enemyAnt.triggerAttackCooldown();
      } else if (enemyAnt.canAttack() && enemyAnt.distanceTo(world.center.x, world.center.y) <= world.nestRadius + enemyAnt.attackRange) {
        const nestInterceptor = this.findNestInterceptorGuardian(soldiers, world, enemyAnt.position.x, enemyAnt.position.y);

        if (nestInterceptor) {
          const distanceToGuardian = enemyAnt.distanceTo(nestInterceptor.position.x, nestInterceptor.position.y);

          if (distanceToGuardian <= enemyAnt.attackRange + 2) {
            this.spawnSlashEffect(
              enemyAnt.position.x,
              enemyAnt.position.y,
              nestInterceptor.position.x,
              nestInterceptor.position.y,
              '255, 122, 100',
              1.6,
            );
            this.spawnHitFlash(nestInterceptor.position.x, nestInterceptor.position.y, enemyAnt.damage, '255, 170, 120');
            this.spawnDamageText(nestInterceptor.position.x, nestInterceptor.position.y - 2, enemyAnt.damage, '#ffb089');
            const unitKilled = nestInterceptor.applyDamage(enemyAnt.damage);

            if (unitKilled) {
              this.spawnDeathDust(nestInterceptor.position.x, nestInterceptor.position.y, 1.2);
              this.onAntLost?.(nestInterceptor.popCost);
            }

            enemyAnt.triggerAttackCooldown();
          }
        } else {
          this.spawnSlashEffect(enemyAnt.position.x, enemyAnt.position.y, world.center.x, world.center.y, '255, 122, 100', 1.8);
          this.applyNestDamage(enemyAnt.damage, world.center.x, world.center.y);
          enemyAnt.triggerAttackCooldown();
        }
      }

      if (enemyAnt.distanceTo(world.center.x, world.center.y) <= world.nestRadius + NEST_DEFENSE_RANGE) {
        const wasKilled = enemyAnt.applyDamage(deltaTime * NEST_DEFENSE_DAMAGE_PER_SECOND);

        if (wasKilled) {
          this.handleEnemyAntDeath(enemyAnt);
          continue;
        }
      }

      for (const ant of ants) {
        if (!ant.alive) {
          continue;
        }

        const antPosition = ant.position;
        const distance = Math.hypot(antPosition.x - enemyAnt.position.x, antPosition.y - enemyAnt.position.y);
        const antDistanceToNest = Math.hypot(antPosition.x - world.center.x, antPosition.y - world.center.y);
        const isDefendingNest =
          enemyAnt.distanceTo(world.center.x, world.center.y) <= world.nestRadius + NEST_DEFENSE_RANGE + 10 &&
          antDistanceToNest <= world.nestRadius + NEST_DEFENSE_RANGE + 14;
        const antAttackRange = ANT_ATTACK_RANGE + (isDefendingNest ? WORKER_NEST_DEFENSE_BONUS_RANGE : 0);
        const antDps = ANT_ATTACK_DAMAGE_PER_SECOND + (isDefendingNest ? WORKER_NEST_DEFENSE_BONUS_DPS : 0);

        if (distance > antAttackRange) {
          continue;
        }

        if (Math.random() < deltaTime * 8) {
          this.spawnSlashEffect(antPosition.x, antPosition.y, enemyAnt.position.x, enemyAnt.position.y, '196, 243, 162', 1.2);
        }
        this.spawnHitFlash(enemyAnt.position.x, enemyAnt.position.y, antDps * deltaTime, '211, 244, 166');
        const wasKilled = enemyAnt.applyDamage(deltaTime * antDps);

        if (wasKilled) {
          this.handleEnemyAntDeath(enemyAnt);
          break;
        }
      }

      for (const soldier of soldiers) {
        if (!soldier.alive) {
          continue;
        }

        const distance = soldier.distanceTo(enemyAnt.position.x, enemyAnt.position.y);

        if (distance > soldier.attackRange || !soldier.canAttack()) {
          continue;
        }

        const slashColor = soldier.role === AntRole.SPITTER ? '180, 255, 146' : '213, 255, 176';
        const slashWidth = soldier.role === AntRole.SPITTER ? 1.5 : 2.1;
        this.spawnSlashEffect(soldier.position.x, soldier.position.y, enemyAnt.position.x, enemyAnt.position.y, slashColor, slashWidth);
        this.spawnHitFlash(enemyAnt.position.x, enemyAnt.position.y, soldier.damage, '217, 255, 184');
        this.spawnDamageText(enemyAnt.position.x, enemyAnt.position.y - 2, soldier.damage, '#fff2b0');
        const wasKilled = enemyAnt.applyDamage(soldier.damage);

        if (soldier.role === AntRole.SPITTER) {
          this.spawnSpitterAttackEffect(soldier.position.x, soldier.position.y, enemyAnt.position.x, enemyAnt.position.y);
        }

        soldier.triggerAttackCooldown();

        if (wasKilled) {
          this.handleEnemyAntDeath(enemyAnt);
          break;
        }
      }
    }

    for (const enemyNest of this.enemyNests) {
      if (!enemyNest.alive) {
        continue;
      }

      for (const ant of ants) {
        if (!ant.alive) {
          continue;
        }

        const antPosition = ant.position;
        const nestPosition = enemyNest.position;
        const distance = Math.hypot(antPosition.x - nestPosition.x, antPosition.y - nestPosition.y);

        if (distance > enemyNest.radius + ANT_ATTACK_RANGE) {
          continue;
        }

        if (Math.random() < deltaTime * 6) {
          this.spawnSlashEffect(antPosition.x, antPosition.y, nestPosition.x, nestPosition.y, '236, 214, 158', 1.1);
        }
        this.spawnHitFlash(nestPosition.x, nestPosition.y, ANT_ATTACK_DAMAGE_PER_SECOND * deltaTime, '255, 214, 151');
        const destroyed = enemyNest.applyDamage(deltaTime * (ANT_ATTACK_DAMAGE_PER_SECOND * 0.75));

        if (destroyed) {
          this.handleEnemyNestDestroyed(enemyNest);
          break;
        }
      }

      for (const soldier of soldiers) {
        if (!soldier.alive || !soldier.canAttack()) {
          continue;
        }

        const nestPosition = enemyNest.position;
        const distance = soldier.distanceTo(nestPosition.x, nestPosition.y);

        if (distance > enemyNest.radius + soldier.attackRange) {
          continue;
        }

        const slashWidth = soldier.role === AntRole.SPITTER ? 1.3 : 2;
        this.spawnSlashEffect(soldier.position.x, soldier.position.y, nestPosition.x, nestPosition.y, '236, 214, 158', slashWidth);
        this.spawnHitFlash(nestPosition.x, nestPosition.y, soldier.damage, '255, 214, 151');
        this.spawnDamageText(nestPosition.x, nestPosition.y - 3, soldier.damage, '#ffe5a3');
        const destroyed = enemyNest.applyDamage(soldier.damage);

        if (soldier.role === AntRole.SPITTER) {
          this.spawnSpitterAttackEffect(soldier.position.x, soldier.position.y, nestPosition.x, nestPosition.y);
        }

        soldier.triggerAttackCooldown();

        if (destroyed) {
          this.handleEnemyNestDestroyed(enemyNest);
          break;
        }
      }
    }
  }

  private handleEnemyNestDestroyed(enemyNest: EnemyNest) {
    const level = Math.max(1, enemyNest.currentLevel);
    const reward = ENEMY_NEST_BASE_DESTROY_REWARD_FOOD + (level - 1) * ENEMY_NEST_DESTROY_REWARD_PER_LEVEL;
    this.spawnDeathDust(enemyNest.position.x, enemyNest.position.y, 2.2);
    this.onFoodCollected?.(reward);
  }

  private applyNestDamage(amount: number, hitX?: number, hitY?: number) {
    if (amount <= 0 || this.nestHealth <= 0) {
      return;
    }

    const previousHealth = this.nestHealth;
    this.nestHealth = Math.max(0, this.nestHealth - amount);
    const maxNestHealth = this.getCurrentNestMaxHealth();

    if (this.nestHealth < previousHealth) {
      this.onNestDamaged?.(previousHealth - this.nestHealth, this.nestHealth, maxNestHealth);
      const flashX = Number.isFinite(hitX) ? (hitX as number) : this.width / 2;
      const flashY = Number.isFinite(hitY) ? (hitY as number) : this.height / 2;
      this.spawnHitFlash(flashX, flashY, amount, '255, 134, 96');
      this.spawnDamageText(flashX, flashY - 6, amount, '#ff9d7f');
      this.triggerCameraShake(1.9, 0.14, flashX, flashY);
      this.triggerHitStop(Math.min(0.08, 0.02 + amount * 0.003));
      this.playCombatAudio('nest', Math.min(1, amount / 16));
    }

    this.onNestHealthChanged?.(this.nestHealth, maxNestHealth);
  }

  private applyNestRecovery(deltaTime: number) {
    const maxNestHealth = this.getCurrentNestMaxHealth();

    if (deltaTime <= 0 || this.nestHealth <= 0 || this.nestHealth >= maxNestHealth) {
      return;
    }

    const nestRecoveryLevel = Math.max(0, this.getUpgradeLevels?.().nestRecovery ?? 0);

    if (nestRecoveryLevel <= 0) {
      return;
    }

    const healPerSecond = (nestRecoveryLevel * NEST_RECOVERY_PER_MINUTE_PER_LEVEL) / 60;
    if (healPerSecond <= 0) {
      return;
    }

    const previousHealth = this.nestHealth;
    this.nestHealth = Math.min(maxNestHealth, this.nestHealth + healPerSecond * deltaTime);

    if (Math.floor(previousHealth) !== Math.floor(this.nestHealth) || this.nestHealth === maxNestHealth) {
      this.onNestHealthChanged?.(this.nestHealth, maxNestHealth);
    }
  }

  private spawnSpitterAttackEffect(fromX: number, fromY: number, toX: number, toY: number) {
    this.spitterAttackEffects.push({
      fromX,
      fromY,
      toX,
      toY,
      elapsed: 0,
      lifetime: SPITTER_ATTACK_EFFECT_LIFETIME_SECONDS,
    });
  }

  private spawnSlashEffect(fromX: number, fromY: number, toX: number, toY: number, color: string, width = 1.4) {
    if (!Number.isFinite(fromX) || !Number.isFinite(fromY) || !Number.isFinite(toX) || !Number.isFinite(toY)) {
      return;
    }

    const dx = toX - fromX;
    const dy = toY - fromY;
    const distance = Math.hypot(dx, dy);

    if (distance < 0.001) {
      return;
    }

    const ux = dx / distance;
    const uy = dy / distance;
    const lineLength = Math.min(28, Math.max(10, distance * 0.9));
    const centerX = toX - ux * Math.min(4, distance * 0.2);
    const centerY = toY - uy * Math.min(4, distance * 0.2);
    const jitter = (Math.random() * 2 - 1) * 0.45;

    const startX = centerX - ux * lineLength * 0.5 + uy * jitter;
    const startY = centerY - uy * lineLength * 0.5 - ux * jitter;
    const endX = centerX + ux * lineLength * 0.5 - uy * jitter;
    const endY = centerY + uy * lineLength * 0.5 + ux * jitter;

    if (this.slashEffects.length >= MAX_SLASH_EFFECTS) {
      this.slashEffects.shift();
    }

    this.slashEffects.push({
      fromX: startX,
      fromY: startY,
      toX: endX,
      toY: endY,
      elapsed: 0,
      lifetime: SLASH_EFFECT_LIFETIME_SECONDS,
      color,
      width,
    });
  }

  private spawnHitFlash(x: number, y: number, amount: number, color = '255, 238, 168') {
    if (!Number.isFinite(x) || !Number.isFinite(y) || amount <= 0) {
      return;
    }

    if (this.hitFlashEffects.length >= MAX_HIT_FLASH_EFFECTS) {
      this.hitFlashEffects.shift();
    }

    this.hitFlashEffects.push({
      x,
      y,
      radius: Math.min(8, 2.4 + Math.sqrt(Math.max(0, amount)) * 1.2),
      elapsed: 0,
      lifetime: HIT_FLASH_LIFETIME_SECONDS,
      color,
    });
  }

  private spawnDamageText(x: number, y: number, amount: number, color = '#ffe9a3') {
    if (!Number.isFinite(x) || !Number.isFinite(y) || amount <= 0) {
      return;
    }

    const rounded = Math.max(1, Math.round(amount));
    if (rounded <= 0) {
      return;
    }

    if (this.damageTextEffects.length >= MAX_DAMAGE_TEXT_EFFECTS) {
      this.damageTextEffects.shift();
    }

    this.damageTextEffects.push({
      x,
      y,
      value: rounded,
      elapsed: 0,
      lifetime: DAMAGE_TEXT_LIFETIME_SECONDS,
      color,
    });
  }

  private spawnDeathDust(x: number, y: number, intensity = 1) {
    if (!Number.isFinite(x) || !Number.isFinite(y) || intensity <= 0) {
      return;
    }

    const puffs = Math.max(2, Math.min(4, Math.round(2 + intensity)));

    for (let index = 0; index < puffs; index += 1) {
      if (this.deathDustEffects.length >= MAX_DEATH_DUST_EFFECTS) {
        this.deathDustEffects.shift();
      }

      const angle = Math.random() * Math.PI * 2;
      const speed = 4 + Math.random() * 12;

      this.deathDustEffects.push({
        x: x + (Math.random() * 2 - 1) * 1.8,
        y: y + (Math.random() * 2 - 1) * 1.8,
        driftX: Math.cos(angle) * speed,
        driftY: Math.sin(angle) * speed,
        radius: 1.8 + Math.random() * 2.2,
        elapsed: 0,
        lifetime: DEATH_DUST_LIFETIME_SECONDS + Math.random() * 0.12,
      });
    }
  }

  private triggerCameraShake(strength: number, durationSeconds: number, sourceX?: number, sourceY?: number) {
    if (strength <= 0 || durationSeconds <= 0) {
      return;
    }

    this.cameraShakeStrength = Math.max(this.cameraShakeStrength, strength);
    this.cameraShakeSeconds = Math.max(this.cameraShakeSeconds, durationSeconds);

    const dx = Number.isFinite(sourceX) ? (sourceX as number) - this.width / 2 : 0;
    const dy = Number.isFinite(sourceY) ? (sourceY as number) - this.height / 2 : 0;
    const distance = Math.hypot(dx, dy);

    if (distance > 0.001) {
      this.cameraShakeDirectionX = dx / distance;
      this.cameraShakeDirectionY = dy / distance;
    } else {
      this.cameraShakeDirectionX = 0;
      this.cameraShakeDirectionY = 0;
    }
  }

  private triggerHitStop(durationSeconds: number) {
    if (durationSeconds <= 0) {
      return;
    }

    this.hitStopSeconds = Math.max(this.hitStopSeconds, durationSeconds);
  }

  private playCombatAudio(kind: CombatAudioKind, intensity = 1) {
    if (typeof window === 'undefined') {
      return;
    }

    const now = performance.now();
    const lastPlayedAt = this.lastCombatAudioAt.get(kind) ?? 0;
    const throttleMs = kind === 'nest' ? 90 : kind === 'kill' ? 70 : 45;

    if (now - lastPlayedAt < throttleMs) {
      return;
    }

    this.lastCombatAudioAt.set(kind, now);

    const AudioCtor = window.AudioContext ?? (window as Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

    if (!AudioCtor) {
      return;
    }

    if (!this.audioContext) {
      this.audioContext = new AudioCtor();
    }

    const context = this.audioContext;

    if (context.state === 'suspended') {
      void context.resume();
    }

    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const duration = kind === 'kill' ? 0.14 : kind === 'nest' ? 0.16 : 0.09;
    const frequency = kind === 'nest' ? 78 : kind === 'kill' ? 160 : 220;
    const detune = kind === 'nest' ? -18 : kind === 'kill' ? 8 : 0;

    oscillator.type = kind === 'nest' ? 'sine' : kind === 'kill' ? 'triangle' : 'square';
    oscillator.frequency.value = frequency + intensity * (kind === 'nest' ? 18 : 36);
    oscillator.detune.value = detune;

    gain.gain.value = 0.0001;
    gain.gain.exponentialRampToValueAtTime(0.12 + intensity * 0.08, context.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);

    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + duration + 0.02);

    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
    };
  }

  private updateAttackEffects(deltaTime: number) {
    for (let index = this.spitterAttackEffects.length - 1; index >= 0; index -= 1) {
      const effect = this.spitterAttackEffects[index];

      if (!effect) {
        continue;
      }

      effect.elapsed += deltaTime;

      if (effect.elapsed >= effect.lifetime) {
        this.spitterAttackEffects.splice(index, 1);
      }
    }

    for (let index = this.hitFlashEffects.length - 1; index >= 0; index -= 1) {
      const effect = this.hitFlashEffects[index];

      if (!effect) {
        continue;
      }

      effect.elapsed += deltaTime;
      if (effect.elapsed >= effect.lifetime) {
        this.hitFlashEffects.splice(index, 1);
      }
    }

    for (let index = this.damageTextEffects.length - 1; index >= 0; index -= 1) {
      const effect = this.damageTextEffects[index];

      if (!effect) {
        continue;
      }

      effect.elapsed += deltaTime;
      if (effect.elapsed >= effect.lifetime) {
        this.damageTextEffects.splice(index, 1);
      }
    }

    for (let index = this.deathDustEffects.length - 1; index >= 0; index -= 1) {
      const effect = this.deathDustEffects[index];

      if (!effect) {
        continue;
      }

      effect.elapsed += deltaTime;
      effect.x += effect.driftX * deltaTime;
      effect.y += effect.driftY * deltaTime;
      effect.driftX *= 0.92;
      effect.driftY *= 0.92;

      if (effect.elapsed >= effect.lifetime) {
        this.deathDustEffects.splice(index, 1);
      }
    }

    for (let index = this.slashEffects.length - 1; index >= 0; index -= 1) {
      const effect = this.slashEffects[index];

      if (!effect) {
        continue;
      }

      effect.elapsed += deltaTime;
      if (effect.elapsed >= effect.lifetime) {
        this.slashEffects.splice(index, 1);
      }
    }

    if (this.cameraShakeSeconds > 0) {
      this.cameraShakeSeconds = Math.max(0, this.cameraShakeSeconds - deltaTime);
      this.cameraShakeStrength *= 0.9;
      if (this.cameraShakeSeconds <= 0) {
        this.cameraShakeStrength = 0;
        this.cameraShakeDirectionX = 0;
        this.cameraShakeDirectionY = 0;
      }
    }
  }

  private drawAttackEffects() {
    for (const effect of this.spitterAttackEffects) {
      const progress = Math.min(1, effect.elapsed / Math.max(0.001, effect.lifetime));
      const alpha = 1 - progress;

      this.context.beginPath();
      this.context.strokeStyle = `rgba(150, 255, 122, ${Math.max(0.12, alpha * 0.9).toFixed(2)})`;
      this.context.lineWidth = 1.5;
      this.context.moveTo(effect.fromX, effect.fromY);
      this.context.lineTo(effect.toX, effect.toY);
      this.context.stroke();

      this.context.beginPath();
      this.context.fillStyle = `rgba(204, 255, 159, ${Math.max(0.12, alpha).toFixed(2)})`;
      this.context.arc(effect.toX, effect.toY, 1.6 + progress * 1.8, 0, Math.PI * 2);
      this.context.fill();
    }

    for (const effect of this.slashEffects) {
      const progress = Math.min(1, effect.elapsed / Math.max(0.001, effect.lifetime));
      const alpha = 1 - progress;
      const dx = effect.toX - effect.fromX;
      const dy = effect.toY - effect.fromY;
      const angle = Math.atan2(dy, dx);
      const length = Math.hypot(dx, dy);
      const centerX = (effect.fromX + effect.toX) * 0.5;
      const centerY = (effect.fromY + effect.toY) * 0.5;
      const radiusX = length * (0.65 + progress * 0.18);
      const radiusY = Math.max(1.2, effect.width * (1.3 - progress * 0.25));

      this.context.save();
      this.context.translate(centerX, centerY);
      this.context.rotate(angle);

      this.context.beginPath();
      this.context.fillStyle = `rgba(${effect.color}, ${(alpha * 0.42).toFixed(2)})`;
      this.context.ellipse(0, 0, radiusX, radiusY, 0, 0, Math.PI * 2);
      this.context.fill();

      this.context.beginPath();
      this.context.fillStyle = `rgba(${effect.color}, ${(alpha * 0.28).toFixed(2)})`;
      this.context.ellipse(0, 0, radiusX * 0.68, Math.max(0.8, radiusY * 0.52), 0, 0, Math.PI * 2);
      this.context.fill();

      this.context.beginPath();
      this.context.strokeStyle = `rgba(${effect.color}, ${(alpha * 0.32).toFixed(2)})`;
      this.context.lineWidth = Math.max(0.7, radiusY * 0.7);
      this.context.ellipse(0, 0, radiusX * 0.94, Math.max(0.9, radiusY * 0.9), 0, 0, Math.PI * 2);
      this.context.stroke();

      this.context.restore();
    }

    for (const effect of this.hitFlashEffects) {
      const progress = Math.min(1, effect.elapsed / Math.max(0.001, effect.lifetime));
      const alpha = (1 - progress) * 0.9;
      const radius = effect.radius * (0.7 + progress * 0.9);

      this.context.beginPath();
      this.context.fillStyle = `rgba(${effect.color}, ${alpha.toFixed(2)})`;
      this.context.arc(effect.x, effect.y, radius, 0, Math.PI * 2);
      this.context.fill();
    }

    for (const effect of this.deathDustEffects) {
      const progress = Math.min(1, effect.elapsed / Math.max(0.001, effect.lifetime));
      const alpha = (1 - progress) * 0.48;
      const radius = effect.radius * (0.8 + progress * 1.3);

      this.context.beginPath();
      this.context.fillStyle = `rgba(154, 136, 118, ${alpha.toFixed(2)})`;
      this.context.arc(effect.x, effect.y, radius, 0, Math.PI * 2);
      this.context.fill();
    }

    this.context.textAlign = 'center';
    this.context.textBaseline = 'middle';
    this.context.font = '700 11px "Trebuchet MS", sans-serif';

    for (const effect of this.damageTextEffects) {
      const progress = Math.min(1, effect.elapsed / Math.max(0.001, effect.lifetime));
      const alpha = 1 - progress;
      const y = effect.y - 10 * progress;

      this.context.strokeStyle = `rgba(24, 20, 15, ${(alpha * 0.85).toFixed(2)})`;
      this.context.lineWidth = 2;
      this.context.strokeText(`${effect.value}`, effect.x, y);
      this.context.fillStyle = effect.color;
      this.context.globalAlpha = Math.max(0, alpha);
      this.context.fillText(`${effect.value}`, effect.x, y);
      this.context.globalAlpha = 1;
    }
  }

  private findNearestDamageableUnit(
    ants: Ant[],
    soldiers: PlayerSoldier[],
    x: number,
    y: number,
    maxRange: number,
  ) {
    type DamageableUnit = Ant | PlayerSoldier;
    let nearestUnit: DamageableUnit | null = null;
    let nearestDistance = maxRange;

    const tauntTarget = this.findTauntingGuardian(soldiers, x, y, maxRange);

    if (tauntTarget) {
      return tauntTarget;
    }

    const units: DamageableUnit[] = [...ants, ...soldiers];

    for (const unit of units) {
      if (!unit.alive) {
        continue;
      }

      const distance = Math.hypot(unit.position.x - x, unit.position.y - y);

      if (distance <= nearestDistance) {
        nearestDistance = distance;
        nearestUnit = unit;
      }
    }

    return nearestUnit;
  }

  private findTauntingGuardian(soldiers: PlayerSoldier[], x: number, y: number, maxRange: number) {
    let nearestGuardian: PlayerSoldier | null = null;
    let nearestDistance = Number.POSITIVE_INFINITY;

    for (const soldier of soldiers) {
      if (!soldier.alive || !soldier.isGuardian) {
        continue;
      }

      const distance = Math.hypot(soldier.position.x - x, soldier.position.y - y);

      if (distance > soldier.tauntRadius + maxRange + 6) {
        continue;
      }

      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestGuardian = soldier;
      }
    }

    return nearestGuardian;
  }

  private findNearestAntInRange(ants: Ant[], x: number, y: number, range: number) {
    let nearest: Ant | null = null;
    let nearestDistance = range;

    for (const ant of ants) {
      if (!ant.alive) {
        continue;
      }

      const distance = Math.hypot(ant.position.x - x, ant.position.y - y);

      if (distance <= nearestDistance) {
        nearestDistance = distance;
        nearest = ant;
      }
    }

    return nearest;
  }

  private findNestInterceptorGuardian(soldiers: PlayerSoldier[], world: GameWorld, enemyX: number, enemyY: number) {
    let interceptor: PlayerSoldier | null = null;
    let nearestDistance = Number.POSITIVE_INFINITY;

    for (const soldier of soldiers) {
      if (!soldier.alive || !soldier.isGuardian) {
        continue;
      }

      const distanceToNest = Math.hypot(soldier.position.x - world.center.x, soldier.position.y - world.center.y);

      if (distanceToNest > world.nestRadius + 64) {
        continue;
      }

      const distanceToEnemy = Math.hypot(soldier.position.x - enemyX, soldier.position.y - enemyY);

      if (distanceToEnemy > soldier.tauntRadius + 30) {
        continue;
      }

      if (distanceToEnemy < nearestDistance) {
        nearestDistance = distanceToEnemy;
        interceptor = soldier;
      }
    }

    return interceptor;
  }

  private handleEnemyAntDeath(enemyAnt: EnemyAnt) {
    const sourceNest = this.enemyNests.find((nest) => nest.id === enemyAnt.nestId);

    if (sourceNest) {
      sourceNest.notifySpawnDestroyed();
    }

    this.spawnDeathDust(enemyAnt.position.x, enemyAnt.position.y, 1.4);
    this.triggerHitStop(0.025);
    this.playCombatAudio('kill', 0.75);
    this.onFoodCollected?.(ENEMY_ANT_KILL_REWARD_FOOD);
  }

  private getAliveEnemyAntCount() {
    let count = 0;

    for (const entity of this.entityManager.values()) {
      if (entity instanceof EnemyAnt && entity.alive) {
        count += 1;
      }
    }

    return count;
  }

  private getPopulationCount() {
    let count = 0;

    for (const entity of this.entityManager.values()) {
      if (entity instanceof Ant && entity.alive) {
        count += 1;
      } else if (entity instanceof PlayerSoldier && entity.alive) {
        count += entity.popCost;
      }
    }

    return count;
  }

  private syncPopulationUsage() {
    this.onPopulationUsageChanged?.(this.getPopulationCount());
  }

  private pruneFood() {
    this.foods = this.foods.filter((food) => food.alive);
  }

  private pruneEnemyNests() {
    this.enemyNests = this.enemyNests.filter((enemyNest) => enemyNest.alive);

    const aliveIds = new Set(this.enemyNests.map((enemyNest) => enemyNest.id));

    for (const nestId of this.enemyWaveTimersSeconds.keys()) {
      if (!aliveIds.has(nestId)) {
        this.enemyWaveTimersSeconds.delete(nestId);
        this.enemyWaveCounters.delete(nestId);
        this.enemyWaveQueues.delete(nestId);
      }
    }
  }

  private updateEnemyWaveQueue(enemyNest: EnemyNest, deltaTime: number) {
    const nestId = enemyNest.id;
    const timer = (this.enemyWaveTimersSeconds.get(nestId) ?? this.getNextWaveCooldownSeconds(enemyNest.currentLevel)) - deltaTime;

    if (timer > 0) {
      this.enemyWaveTimersSeconds.set(nestId, timer);
      return;
    }

    const currentWave = this.enemyWaveCounters.get(nestId) ?? 0;
    const nextWave = currentWave + 1;
    this.enemyWaveCounters.set(nestId, nextWave);
    this.enemyWaveTimersSeconds.set(nestId, this.getNextWaveCooldownSeconds(enemyNest.currentLevel));

    const queue = this.enemyWaveQueues.get(nestId) ?? [];
    queue.push(...this.createWaveOrders(this.getEnemyNestSequence(nestId), nextWave));
    this.enemyWaveQueues.set(nestId, queue);
  }

  private spawnWaveUnits(world: GameWorld, enemyNest: EnemyNest, maxSpawnPerTick: number = ENEMY_WAVE_MAX_SPAWN_PER_TICK) {
    const queue = this.enemyWaveQueues.get(enemyNest.id) ?? [];

    if (queue.length === 0) {
      return;
    }

    let spawned = 0;

    while (queue.length > 0 && spawned < maxSpawnPerTick) {
      if (this.getAliveEnemyAntCount() >= ENEMY_ANT_GLOBAL_CAP) {
        break;
      }

      const order = queue.shift();

      if (!order) {
        break;
      }

      this.spawnEnemyAnt(world, enemyNest, order.role, order.tactic, order.waveIndex);
      spawned += 1;
    }

    this.enemyWaveQueues.set(enemyNest.id, queue);
  }

  private createWaveOrders(nestSequence: number, waveIndex: number): EnemyWaveOrder[] {
    const waveSize = 5 + Math.max(0, Math.floor(nestSequence) - 1) * 3;
    const tacticCycle: EnemySquadTactic[] = [EnemySquadTactic.RAID, EnemySquadTactic.HARASS, EnemySquadTactic.SIEGE];
    const tactic = tacticCycle[(waveIndex - 1) % tacticCycle.length] ?? EnemySquadTactic.RAID;
    const roles: EnemyAntRole[] = [EnemyAntRole.BRUTE, EnemyAntRole.RUNNER, EnemyAntRole.SPITTER];

    const orders: EnemyWaveOrder[] = [];

    for (let index = 0; index < waveSize; index += 1) {
      const role = roles[Math.floor(Math.random() * roles.length)] ?? EnemyAntRole.RUNNER;
      orders.push({ role, tactic, waveIndex });
    }

    for (let index = orders.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      const current = orders[index];
      orders[index] = orders[swapIndex] as EnemyWaveOrder;
      orders[swapIndex] = current as EnemyWaveOrder;
    }

    return orders;
  }

  private getEnemyNestSequence(nestId: string) {
    const match = nestId.match(/(\d+)$/);

    if (!match) {
      return 1;
    }

    const zeroBasedIndex = Number(match[1]);

    if (!Number.isFinite(zeroBasedIndex)) {
      return 1;
    }

    return Math.max(1, Math.floor(zeroBasedIndex) + 1);
  }

  private getNextWaveCooldownSeconds(level: number) {
    const scaled = ENEMY_WAVE_BASE_INTERVAL_SECONDS * Math.pow(ENEMY_WAVE_INTERVAL_DECAY_PER_LEVEL, Math.max(0, level - 1));
    return Math.max(ENEMY_WAVE_MIN_INTERVAL_SECONDS, scaled) + Math.random() * 2.5;
  }

  private pickAmbientEnemyRole(level: number) {
    if (level >= 5) {
      const roll = Math.random();
      if (roll < 0.2) return EnemyAntRole.BRUTE;
      if (roll < 0.4) return EnemyAntRole.SPITTER;
      return EnemyAntRole.RUNNER;
    }

    if (level >= 3 && Math.random() < 0.25) {
      return EnemyAntRole.SPITTER;
    }

    return Math.random() < 0.3 ? EnemyAntRole.BRUTE : EnemyAntRole.RUNNER;
  }

  private applyEnemyRoleModifiers(
    stats: { health: number; damage: number; speed: number; attackCooldownSeconds: number },
    role: EnemyAntRole,
    tactic: EnemySquadTactic,
  ) {
    const roleTuning = ENEMY_ROLE_TUNING[role] ?? ENEMY_ROLE_TUNING.RUNNER;
    const tacticTuning = ENEMY_TACTIC_TUNING[tactic] ?? ENEMY_TACTIC_TUNING.HARASS;

    const healthMultiplier = roleTuning.healthMultiplier;
    const damageMultiplier = roleTuning.damageMultiplier * tacticTuning.damageMultiplier;
    const speedMultiplier = roleTuning.speedMultiplier * tacticTuning.speedMultiplier;
    const cooldownMultiplier = roleTuning.cooldownMultiplier;

    return {
      health: Math.max(1, Math.round(stats.health * healthMultiplier)),
      damage: Math.max(1, Math.round(stats.damage * damageMultiplier)),
      speed: Math.max(8, Math.round(stats.speed * speedMultiplier)),
      attackCooldownSeconds: Math.max(0.25, stats.attackCooldownSeconds * cooldownMultiplier),
    };
  }

  private consumeQueuedBattleDeployments(world: GameWorld) {
    const deployments = this.consumeBattleDeployments?.() ?? [];

    if (deployments.length === 0) {
      return;
    }

    for (const deployment of deployments) {
      for (const [roleKey, rawCount] of Object.entries(deployment.composition) as [AntRole, number][]) {
        const count = Math.max(0, Math.floor(rawCount || 0));

        for (let index = 0; index < count; index += 1) {
          this.spawnBattleUnit(world, roleKey, deployment.mode);
        }
      }
    }
  }

  private spawnBattleUnit(world: GameWorld, role: AntRole, mode: SquadMode) {
    const upgradeLevels = this.getUpgradeLevels?.() ?? {
      queenSpawnRate: 0,
      carryCapacity: 0,
      antSpeed: 0,
      nestRecovery: 0,
      foodCapacity: 0,
      forageRadius: 0,
      populationCapacity: 0,
      soldierDamage: 0,
      soldierHealth: 0,
      soldierSpeed: 0,
      soldierTauntRange: 0,
      soldierAttackRange: 0,
    };
    const populationLimit = BASE_POPULATION_CAPACITY + Math.max(0, upgradeLevels.populationCapacity) * POPULATION_CAPACITY_PER_LEVEL;
    const currentPopulation = this.getPopulationUsage ? this.getPopulationUsage() : this.getPopulationCount();

    if (currentPopulation >= populationLimit) {
      return;
    }

    const angle = Math.random() * Math.PI * 2;
    const distance = world.nestRadius + 12 + Math.random() * 12;
    const x = world.center.x + Math.cos(angle) * distance;
    const y = world.center.y + Math.sin(angle) * distance;

    this.entityManager.add(
      new PlayerSoldier({
        id: `soldier-${role.toLowerCase()}-${this.nextAntId}`,
        role,
        mode,
        x,
        y,
      }),
    );

    this.nextAntId += 1;
    this.onAntSpawned?.(Math.max(1, ANT_TEMPLATES[role].base.popCost));
  }
}