import { useState } from 'react';
import { useGameStore } from '../state/gameStore';

const BASE_SPAWN_INTERVAL_SECONDS = 30;
const MIN_SPAWN_INTERVAL_SECONDS = 7.5;
const SPAWN_REDUCTION_PER_LEVEL = 0.1;
const MAX_SPAWN_REDUCTION = 0.75;
const BASE_MAX_FOOD_ON_FIELD = 14;
const FOOD_CAPACITY_PER_LEVEL = 2;
const MAX_FOOD_ON_FIELD = 40;
const BASE_ANT_FORAGE_RADIUS_FACTOR = 0.03;
const FORAGE_RADIUS_FACTOR_PER_LEVEL = 0.02;
const MAX_ANT_FORAGE_RADIUS_FACTOR = 0.375;

function formatSeconds(seconds: number) {
  return Number(seconds.toFixed(1)).toString();
}

function formatEffect(
  upgradeKey: 'queenSpawnRate' | 'carryCapacity' | 'antSpeed' | 'nestRecovery' | 'foodCapacity' | 'forageRadius',
  level: number,
) {
  if (upgradeKey === 'queenSpawnRate') {
    return `Spawn interval -${Math.min(level * 10, 75)}%`;
  }

  if (upgradeKey === 'carryCapacity') {
    return `Carry +${level} food per trip`;
  }

  if (upgradeKey === 'antSpeed') {
    return `Move speed +${Math.min(level * 12, 60)}%`;
  }

  if (upgradeKey === 'foodCapacity') {
    return `Field food cap +${level * FOOD_CAPACITY_PER_LEVEL}`;
  }

  if (upgradeKey === 'forageRadius') {
    return `Food sensing radius +${Math.min(level * 2, 25)}%`;
  }

  return `Idle cooldown -${Math.min(level * 10, 65)}%`;
}

function formatCurrentValue(
  upgradeKey: 'queenSpawnRate' | 'carryCapacity' | 'antSpeed' | 'nestRecovery' | 'foodCapacity' | 'forageRadius',
  level: number,
) {
  if (upgradeKey === 'queenSpawnRate') {
    const reduction = Math.min(MAX_SPAWN_REDUCTION, level * SPAWN_REDUCTION_PER_LEVEL);
    const spawnIntervalSeconds = Math.max(MIN_SPAWN_INTERVAL_SECONDS, BASE_SPAWN_INTERVAL_SECONDS * (1 - reduction));
    return `Current: ${formatSeconds(spawnIntervalSeconds)}s per spawn`;
  }

  if (upgradeKey === 'carryCapacity') {
    const carryCapacity = 1 + Math.max(0, Math.floor(level));
    return `Current: ${carryCapacity} food per trip`;
  }

  if (upgradeKey === 'antSpeed') {
    const speedMultiplier = Math.min(2, 1 + level * 0.12);
    return `Current: x${speedMultiplier.toFixed(2)} movement`;
  }

  if (upgradeKey === 'foodCapacity') {
    const maxFoodOnField = Math.min(MAX_FOOD_ON_FIELD, BASE_MAX_FOOD_ON_FIELD + level * FOOD_CAPACITY_PER_LEVEL);
    return `Current: ${maxFoodOnField} food on field`;
  }

  if (upgradeKey === 'forageRadius') {
    const forageRadiusFactor = Math.min(
      MAX_ANT_FORAGE_RADIUS_FACTOR,
      BASE_ANT_FORAGE_RADIUS_FACTOR + level * FORAGE_RADIUS_FACTOR_PER_LEVEL,
    );
    return `Current: ${Math.round(forageRadiusFactor * 100)}% map sensing radius`;
  }

  const cooldownMultiplier = Math.max(0.35, 1 - level * 0.1);
  const minIdleSeconds = 60 * cooldownMultiplier;
  const maxIdleSeconds = 180 * cooldownMultiplier;
  return `Current: ${formatSeconds(minIdleSeconds)}-${formatSeconds(maxIdleSeconds)}s idle`;
}

const UPGRADE_CARDS = [
  {
    key: 'queenSpawnRate' as const,
    label: 'Queen Spawn Rate',
    title: 'Faster Ant Production',
  },
  {
    key: 'carryCapacity' as const,
    label: 'Carry Capacity',
    title: 'More Food Per Trip',
  },
  {
    key: 'antSpeed' as const,
    label: 'Ant Speed',
    title: 'Quicker Search Runs',
  },
  {
    key: 'foodCapacity' as const,
    label: 'Food Capacity',
    title: 'More Food On The Ground',
  },
  {
    key: 'forageRadius' as const,
    label: 'Forage Radius',
    title: 'Stronger Food Detection',
  },
  {
    key: 'nestRecovery' as const,
    label: 'Nest Recovery',
    title: 'Shorter Rest After Delivery',
  },
] as const;

export function UpgradeOverlay() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const colonySize = useGameStore((state) => state.colonySize);
  const foodAmount = useGameStore((state) => state.foodAmount);
  const upgradeLevels = useGameStore((state) => state.upgradeLevels);
  const purchaseUpgrade = useGameStore((state) => state.purchaseUpgrade);

  return (
    <aside className={`upgrade-overlay${isCollapsed ? ' upgrade-overlay--collapsed' : ''}`} aria-label="Upgrade controls">
      <div className="upgrade-shell">
        <button
          type="button"
          className="upgrade-collapse-button"
          aria-expanded={!isCollapsed}
          aria-label={isCollapsed ? 'Expand upgrade menu' : 'Collapse upgrade menu'}
          onClick={() => setIsCollapsed((value) => !value)}
        >
          <span className="upgrade-collapse-button__icon" aria-hidden="true">
            {isCollapsed ? '‹' : '›'}
          </span>
          <span className="upgrade-collapse-button__label">{isCollapsed ? 'Show Upgrades' : 'Hide Upgrades'}</span>
        </button>

        {!isCollapsed ? (
          <div className="upgrade-scroll-area">
            <section className="panel summary-panel">
              <div>
                <p className="panel-label">Colony</p>
                <strong className="panel-value">{colonySize} ants</strong>
              </div>
              <div>
                <p className="panel-label">Food</p>
                <strong className="panel-value">{foodAmount}</strong>
              </div>
            </section>

            {UPGRADE_CARDS.map((upgradeCard) => {
              const level = upgradeLevels[upgradeCard.key];
              const cost = useGameStore.getState().upgradeCost(upgradeCard.key);
              const canAfford = foodAmount >= cost;

              return (
                <section className="panel upgrade-card" key={upgradeCard.key}>
                  <div className="upgrade-card__header">
                    <div>
                      <p className="panel-label">{upgradeCard.label}</p>
                      <h2>{upgradeCard.title}</h2>
                    </div>
                    <span className="upgrade-level">Lv. {level}</span>
                  </div>
                  <p className="upgrade-description">{formatEffect(upgradeCard.key, level)}</p>
                  <p className="upgrade-current-value">{formatCurrentValue(upgradeCard.key, level)}</p>
                  <button
                    type="button"
                    className="upgrade-button"
                    onClick={() => purchaseUpgrade(upgradeCard.key)}
                    disabled={!canAfford}
                  >
                    Buy for {cost} food
                  </button>
                </section>
              );
            })}
          </div>
        ) : null}
      </div>
    </aside>
  );
}