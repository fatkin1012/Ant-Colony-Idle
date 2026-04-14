import { EntityManager } from './EntityManager';
import type { GameWorld } from './types';
import { Ant } from '../entities/Ant';
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
  FOOD_CAPACITY_PER_LEVEL,
  FORAGE_RADIUS_FACTOR_PER_LEVEL,
  IDLE_COOLDOWN_REDUCTION_PER_LEVEL,
  MAX_ANT_FORAGE_RADIUS_FACTOR,
  MAX_ANT_SPEED_MULTIPLIER,
  MAX_FOOD_ON_FIELD,
  MAX_SPAWN_REDUCTION,
  MIN_IDLE_COOLDOWN_MULTIPLIER,
  MIN_SPAWN_INTERVAL_SECONDS,
  ENEMY_NEST_INITIAL_COUNT,
  NEST_DEFENSE_DAMAGE_PER_SECOND,
  NEST_DEFENSE_RANGE,
  PLAYER_NEST_MAX_HEALTH,
  BASE_POPULATION_CAPACITY,
  POPULATION_CAPACITY_PER_LEVEL,
  SPAWN_REDUCTION_PER_LEVEL,
} from '../upgradeBalances';
import type { BattleDeployment } from '../../state/gameStore';
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

interface EnemyWaveOrder {
  role: EnemyAntRole;
  tactic: EnemySquadTactic;
}

interface GameEngineOptions {
  onFoodCollected?: (amount: number) => void;
  getFoodAmount?: () => number;
  onAntSpawned?: (amount: number) => void;
  onAntLost?: (amount: number) => void;
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
    foodCapacity: number;
    forageRadius: number;
    populationCapacity: number;
  };
}

export class GameEngine {
  private readonly canvas: HTMLCanvasElement;
  private readonly context: CanvasRenderingContext2D;
  private readonly entityManager = new EntityManager();
  private readonly resizeObserver: ResizeObserver;
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
  private nextAntId = 12;
  private nextEnemyAntId = 0;
  private spawnAccumulatorSeconds = 0;
  private nestHealth = PLAYER_NEST_MAX_HEALTH;
  private readonly enemyWaveTimersSeconds = new Map<string, number>();
  private readonly enemyWaveCounters = new Map<string, number>();
  private readonly enemyWaveQueues = new Map<string, EnemyWaveOrder[]>();
  private readonly onFoodCollected?: (amount: number) => void;
  private readonly getFoodAmount?: () => number;
  private readonly onAntSpawned?: (amount: number) => void;
  private readonly onAntLost?: (amount: number) => void;
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
    foodCapacity: number;
    forageRadius: number;
    populationCapacity: number;
  };

  constructor(canvas: HTMLCanvasElement, options: GameEngineOptions = {}) {
    const context = canvas.getContext('2d');

    if (!context) {
      throw new Error('Canvas 2D context is unavailable.');
    }

    this.canvas = canvas;
    this.context = context;
    this.onFoodCollected = options.onFoodCollected;
    this.getFoodAmount = options.getFoodAmount;
    this.onAntSpawned = options.onAntSpawned;
    this.onAntLost = options.onAntLost;
    this.onPopulationUsageChanged = options.onPopulationUsageChanged;
    this.onNestHealthChanged = options.onNestHealthChanged;
    this.onNestDamaged = options.onNestDamaged;
    this.getNestHealth = options.getNestHealth;
    this.getPopulationUsage = options.getPopulationUsage;
    this.consumeBattleDeployments = options.consumeBattleDeployments;
    this.getUpgradeLevels = options.getUpgradeLevels;
    this.nestHealth = Math.max(0, Math.min(PLAYER_NEST_MAX_HEALTH, Math.floor(this.getNestHealth?.() ?? PLAYER_NEST_MAX_HEALTH)));
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    this.resize();
    this.seedAnts();
    this.seedFood();
    this.seedEnemyNests(this.createWorld());
    this.syncPopulationUsage();
    this.onNestHealthChanged?.(this.nestHealth, PLAYER_NEST_MAX_HEALTH);
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
  }

  private readonly tick = () => {
    const timestamp = performance.now();
    const deltaTime = Math.max(0, (timestamp - this.lastTimestamp) / 1000);
    this.lastTimestamp = timestamp;
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

    this.consumeQueuedBattleDeployments(world);
    this.updateRealtimeSpawning(deltaTime, world);
    this.updateEnemyNestSpawning(deltaTime, world);
    this.entityManager.update(deltaTime, world);
    this.resolveFoodPickups(world);
    this.resolveEnemyCombat(deltaTime, world);
    this.pruneFood();
    this.pruneEnemyNests();
    this.ensureFoodPopulation(world);
    this.syncPopulationUsage();
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
      idleCooldownMultiplier: Math.max(
        MIN_IDLE_COOLDOWN_MULTIPLIER,
        1 - Math.max(0, upgradeLevels.nestRecovery) * IDLE_COOLDOWN_REDUCTION_PER_LEVEL,
      ),
      carryCapacityBonus: Math.max(0, upgradeLevels.carryCapacity),
      maxFoodOnField,
      maxForageRadius,
      foodPositions: this.foods.filter((food) => food.alive).map((food) => food.position),
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
          tauntRadius: guardian.tauntRadius,
        })),
      enemyNests: this.enemyNests
        .filter((enemyNest) => enemyNest.alive)
        .map((enemyNest) => ({
          id: enemyNest.id,
          x: enemyNest.position.x,
          y: enemyNest.position.y,
          radius: enemyNest.radius,
        })),
    };
  }

  private render(world: GameWorld) {
    this.context.clearRect(0, 0, world.width, world.height);
    this.context.fillStyle = BACKGROUND_COLOR;
    this.context.fillRect(0, 0, world.width, world.height);

    this.drawFood(world);
    this.drawEnemyNests();
    this.drawNest(world);
    this.entityManager.draw(this.context, world);
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

    this.context.beginPath();
    this.context.fillStyle = NEST_FILL;
    this.context.arc(center.x, center.y, nestRadius, 0, Math.PI * 2);
    this.context.fill();

    this.context.lineWidth = 4;
    this.context.strokeStyle = NEST_RING;
    this.context.stroke();
  }

  private seedAnts() {
    const seedCount = 12;
    const centerX = this.width / 2;
    const centerY = this.height / 2;
    const world = this.createWorld();

    for (let index = 0; index < seedCount; index += 1) {
      const angle = (Math.PI * 2 * index) / seedCount + Math.random() * 0.35;
      const distance = index === 0 ? 0 : world.nestRadius + 28 + Math.random() * 26;
      const offsetX = Math.cos(angle) * distance;
      const offsetY = Math.sin(angle) * distance;

      this.entityManager.add(
        new Ant({
          id: `ant-${index}`,
          x: centerX + offsetX,
          y: centerY + offsetY,
          state: index === 0 ? 'IDLE' : 'SEARCHING',
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
      foodCapacity: 0,
      forageRadius: 0,
      populationCapacity: 0,
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

  private seedEnemyNests(world: GameWorld) {
    this.enemyNests = [];
    this.enemyWaveTimersSeconds.clear();
    this.enemyWaveCounters.clear();
    this.enemyWaveQueues.clear();

    for (let index = 0; index < ENEMY_NEST_INITIAL_COUNT; index += 1) {
      const position = this.createEnemyNestPosition(index, ENEMY_NEST_INITIAL_COUNT, world);
      const id = `enemy-nest-${index}`;

      this.enemyNests.push(new EnemyNest({ id, x: position.x, y: position.y }));
      this.enemyWaveTimersSeconds.set(id, this.getNextWaveCooldownSeconds(1));
      this.enemyWaveCounters.set(id, 0);
      this.enemyWaveQueues.set(id, []);
    }
  }

  private createEnemyNestPosition(index: number, total: number, world: GameWorld) {
    const angle = ((Math.PI * 2) / total) * index + Math.random() * 0.65;
    const ringRadius = Math.max(world.nestRadius + 120, Math.min(world.width, world.height) * 0.42);
    const x = world.center.x + Math.cos(angle) * ringRadius;
    const y = world.center.y + Math.sin(angle) * ringRadius;

    const clampedX = Math.min(world.width - 14, Math.max(14, x));
    const clampedY = Math.min(world.height - 14, Math.max(14, y));

    return { x: clampedX, y: clampedY };
  }

  private updateEnemyNestSpawning(deltaTime: number, world: GameWorld) {
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

        this.spawnEnemyAnt(world, enemyNest, this.pickAmbientEnemyRole(enemyNest.currentLevel), EnemySquadTactic.SIEGE);
      }
    }
  }

  private spawnEnemyAnt(world: GameWorld, enemyNest: EnemyNest, role: EnemyAntRole, tactic: EnemySquadTactic) {
    const spawnStats = enemyNest.getSpawnStats();
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
          this.onFoodCollected?.(FOOD_VALUE_PER_PICKUP);
          break;
        }

        const distanceToFood = Math.hypot(antCenterX - foodPosition.x, antCenterY - foodPosition.y);

        if (distanceToFood <= pickupRadius) {
          food.alive = false;
          ant.collectFood();
          if (ant.shouldReturnToNest(world.carryCapacityBonus)) {
            ant.markFound();
          }
          this.onFoodCollected?.(FOOD_VALUE_PER_PICKUP);
          break;
        }
      }
    }
  }

  private resolveEnemyCombat(deltaTime: number, world: GameWorld) {
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
        const unitKilled = primaryTarget.applyDamage(enemyAnt.damage);

        if (unitKilled) {
          if (primaryTarget instanceof PlayerSoldier) {
            this.onAntLost?.(primaryTarget.popCost);
          } else {
            this.onAntLost?.(1);
          }
        }

        if (primaryTarget instanceof Ant && primaryTarget.alive) {
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
            const unitKilled = nestInterceptor.applyDamage(enemyAnt.damage);

            if (unitKilled) {
              this.onAntLost?.(nestInterceptor.popCost);
            }

            enemyAnt.triggerAttackCooldown();
          }
        } else {
          this.applyNestDamage(enemyAnt.damage);
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

        const wasKilled = enemyAnt.applyDamage(soldier.damage);
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

        enemyNest.applyDamage(deltaTime * (ANT_ATTACK_DAMAGE_PER_SECOND * 0.75));
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

        enemyNest.applyDamage(soldier.damage);
        soldier.triggerAttackCooldown();
      }
    }
  }

  private applyNestDamage(amount: number) {
    if (amount <= 0 || this.nestHealth <= 0) {
      return;
    }

    const previousHealth = this.nestHealth;
    this.nestHealth = Math.max(0, this.nestHealth - amount);

    if (this.nestHealth < previousHealth) {
      this.onNestDamaged?.(previousHealth - this.nestHealth, this.nestHealth, PLAYER_NEST_MAX_HEALTH);
    }

    this.onNestHealthChanged?.(this.nestHealth, PLAYER_NEST_MAX_HEALTH);
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
    queue.push(...this.createWaveOrders(enemyNest.currentLevel, nextWave));
    this.enemyWaveQueues.set(nestId, queue);
  }

  private spawnWaveUnits(world: GameWorld, enemyNest: EnemyNest) {
    const queue = this.enemyWaveQueues.get(enemyNest.id) ?? [];

    if (queue.length === 0) {
      return;
    }

    let spawned = 0;

    while (queue.length > 0 && spawned < ENEMY_WAVE_MAX_SPAWN_PER_TICK) {
      if (this.getAliveEnemyAntCount() >= ENEMY_ANT_GLOBAL_CAP) {
        break;
      }

      const order = queue.shift();

      if (!order) {
        break;
      }

      this.spawnEnemyAnt(world, enemyNest, order.role, order.tactic);
      spawned += 1;
    }

    this.enemyWaveQueues.set(enemyNest.id, queue);
  }

  private createWaveOrders(level: number, waveIndex: number): EnemyWaveOrder[] {
    const waveSize = Math.max(3, 3 + Math.floor(level / 3) + Math.min(4, Math.floor(waveIndex / 2)));
    const tacticCycle: EnemySquadTactic[] = [EnemySquadTactic.RAID, EnemySquadTactic.HARASS, EnemySquadTactic.SIEGE];
    const tactic = tacticCycle[(waveIndex - 1) % tacticCycle.length] ?? EnemySquadTactic.RAID;
    const bruteCount = Math.max(1, Math.floor(waveSize * 0.25));
    const spitterCount = level >= 3 ? Math.max(1, Math.floor(waveSize * 0.2)) : 0;
    const runnerCount = Math.max(1, waveSize - bruteCount - spitterCount);

    const orders: EnemyWaveOrder[] = [];

    for (let i = 0; i < bruteCount; i += 1) {
      orders.push({ role: EnemyAntRole.BRUTE, tactic });
    }

    for (let i = 0; i < spitterCount; i += 1) {
      orders.push({ role: EnemyAntRole.SPITTER, tactic });
    }

    for (let i = 0; i < runnerCount; i += 1) {
      orders.push({ role: EnemyAntRole.RUNNER, tactic });
    }

    for (let index = orders.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      const current = orders[index];
      orders[index] = orders[swapIndex] as EnemyWaveOrder;
      orders[swapIndex] = current as EnemyWaveOrder;
    }

    return orders;
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