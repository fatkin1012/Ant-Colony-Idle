import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useGameStore } from '../state/gameStore';
import type { GameLanguage } from '../state/gamePersistence';
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
  MAX_UPGRADE_LEVEL,
  MIN_IDLE_COOLDOWN_MULTIPLIER,
  MIN_SPAWN_INTERVAL_SECONDS,
  SPAWN_REDUCTION_PER_LEVEL,
} from '../game/upgradeBalances';

const DRAG_EDGE_MARGIN = 16;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function isInteractiveElement(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return target.closest('button, a, input, textarea, select, [role="button"]') !== null;
}

function formatSeconds(seconds: number) {
  return Number(seconds.toFixed(1)).toString();
}

function formatEffect(
  language: GameLanguage,
  upgradeKey: 'queenSpawnRate' | 'carryCapacity' | 'antSpeed' | 'nestRecovery' | 'foodCapacity' | 'forageRadius',
  level: number,
) {
  const isZh = language === 'zh-TW';

  if (upgradeKey === 'queenSpawnRate') {
    return isZh
      ? `螞蟻生成間隔 -${Math.min(level * 2.5, 75).toFixed(1)}%`
      : `Spawn interval -${Math.min(level * 2.5, 75).toFixed(1)}%`;
  }

  if (upgradeKey === 'carryCapacity') {
    return isZh ? `每趟可多搬 +${level} 食物` : `Carry +${level} food per trip`;
  }

  if (upgradeKey === 'antSpeed') {
    return isZh
      ? `移動速度 +${Math.min(level * (ANT_SPEED_MULTIPLIER_PER_LEVEL * 100), (MAX_ANT_SPEED_MULTIPLIER - 1) * 100).toFixed(1)}%`
      : `Move speed +${Math.min(level * (ANT_SPEED_MULTIPLIER_PER_LEVEL * 100), (MAX_ANT_SPEED_MULTIPLIER - 1) * 100).toFixed(1)}%`;
  }

  if (upgradeKey === 'foodCapacity') {
    return isZh ? `場上食物上限 +${level * FOOD_CAPACITY_PER_LEVEL}` : `Field food cap +${level * FOOD_CAPACITY_PER_LEVEL}`;
  }

  if (upgradeKey === 'forageRadius') {
    return isZh ? `食物感知半徑 +${Math.min(level * 2, 60)}%` : `Food sensing radius +${Math.min(level * 2, 60)}%`;
  }

  return isZh
    ? `休息冷卻 -${Math.min(level * (IDLE_COOLDOWN_REDUCTION_PER_LEVEL * 100), (1 - MIN_IDLE_COOLDOWN_MULTIPLIER) * 100).toFixed(1)}%`
    : `Idle cooldown -${Math.min(level * (IDLE_COOLDOWN_REDUCTION_PER_LEVEL * 100), (1 - MIN_IDLE_COOLDOWN_MULTIPLIER) * 100).toFixed(1)}%`;
}

function formatCurrentValue(
  language: GameLanguage,
  upgradeKey: 'queenSpawnRate' | 'carryCapacity' | 'antSpeed' | 'nestRecovery' | 'foodCapacity' | 'forageRadius',
  level: number,
) {
  const isZh = language === 'zh-TW';

  if (upgradeKey === 'queenSpawnRate') {
    const reduction = Math.min(MAX_SPAWN_REDUCTION, level * SPAWN_REDUCTION_PER_LEVEL);
    const spawnIntervalSeconds = Math.max(MIN_SPAWN_INTERVAL_SECONDS, BASE_SPAWN_INTERVAL_SECONDS * (1 - reduction));
    return isZh
      ? `目前：每 ${formatSeconds(spawnIntervalSeconds)} 秒生成 1 隻`
      : `Current: ${formatSeconds(spawnIntervalSeconds)}s per spawn`;
  }

  if (upgradeKey === 'carryCapacity') {
    const carryCapacity = 1 + Math.max(0, Math.floor(level));
    return isZh ? `目前：每趟 ${carryCapacity} 食物` : `Current: ${carryCapacity} food per trip`;
  }

  if (upgradeKey === 'antSpeed') {
    const speedMultiplier = Math.min(MAX_ANT_SPEED_MULTIPLIER, 1 + level * ANT_SPEED_MULTIPLIER_PER_LEVEL);
    return isZh ? `目前：移動 x${speedMultiplier.toFixed(2)}` : `Current: x${speedMultiplier.toFixed(2)} movement`;
  }

  if (upgradeKey === 'foodCapacity') {
    const maxFoodOnField = Math.min(MAX_FOOD_ON_FIELD, BASE_MAX_FOOD_ON_FIELD + level * FOOD_CAPACITY_PER_LEVEL);
    return isZh ? `目前：場上 ${maxFoodOnField} 食物` : `Current: ${maxFoodOnField} food on field`;
  }

  if (upgradeKey === 'forageRadius') {
    const forageRadiusFactor = Math.min(
      MAX_ANT_FORAGE_RADIUS_FACTOR,
      BASE_ANT_FORAGE_RADIUS_FACTOR + level * FORAGE_RADIUS_FACTOR_PER_LEVEL,
    );
    return isZh
      ? `目前：地圖 ${Math.round(forageRadiusFactor * 100)}% 感知半徑`
      : `Current: ${Math.round(forageRadiusFactor * 100)}% map sensing radius`;
  }

  const cooldownMultiplier = Math.max(MIN_IDLE_COOLDOWN_MULTIPLIER, 1 - level * IDLE_COOLDOWN_REDUCTION_PER_LEVEL);
  const minIdleSeconds = 60 * cooldownMultiplier;
  const maxIdleSeconds = 180 * cooldownMultiplier;
  return isZh
    ? `目前：休息 ${formatSeconds(minIdleSeconds)}-${formatSeconds(maxIdleSeconds)} 秒`
    : `Current: ${formatSeconds(minIdleSeconds)}-${formatSeconds(maxIdleSeconds)}s idle`;
}

const UPGRADE_CARD_TEXT: Record<
  GameLanguage,
  Record<
    'queenSpawnRate' | 'carryCapacity' | 'antSpeed' | 'nestRecovery' | 'foodCapacity' | 'forageRadius',
    { label: string; title: string }
  >
> = {
  'zh-TW': {
    queenSpawnRate: { label: '蟻后生產', title: '更快孵化螞蟻' },
    carryCapacity: { label: '搬運容量', title: '每趟搬更多食物' },
    antSpeed: { label: '螞蟻速度', title: '探索與搬運更快' },
    foodCapacity: { label: '食物容量', title: '地面可存在更多食物' },
    forageRadius: { label: '覓食範圍', title: '更遠距離偵測食物' },
    nestRecovery: { label: '巢穴恢復', title: '回巢後更快再出發' },
  },
  en: {
    queenSpawnRate: { label: 'Queen Spawn Rate', title: 'Faster Ant Production' },
    carryCapacity: { label: 'Carry Capacity', title: 'More Food Per Trip' },
    antSpeed: { label: 'Ant Speed', title: 'Quicker Search Runs' },
    foodCapacity: { label: 'Food Capacity', title: 'More Food On The Ground' },
    forageRadius: { label: 'Forage Radius', title: 'Stronger Food Detection' },
    nestRecovery: { label: 'Nest Recovery', title: 'Shorter Rest After Delivery' },
  },
};

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

interface UpgradeOverlayProps {
  language: GameLanguage;
  summaryColonyLabel: string;
  summaryFoodLabel: string;
  showMenuLabel: string;
  hideMenuLabel: string;
}

export function UpgradeOverlay({
  language,
  summaryColonyLabel,
  summaryFoodLabel,
  showMenuLabel,
  hideMenuLabel,
}: UpgradeOverlayProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const panelRef = useRef<HTMLElement | null>(null);
  const panelPositionRef = useRef({ x: 0, y: 0 });
  const dragFrameRef = useRef<number | null>(null);
  const pendingPanelPositionRef = useRef<{ x: number; y: number } | null>(null);
  const dragStateRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startPositionX: number;
    startPositionY: number;
    panelWidth: number;
    panelHeight: number;
  } | null>(null);
  const colonySize = useGameStore((state) => state.colonySize);
  const foodAmount = useGameStore((state) => state.foodAmount);
  const upgradeLevels = useGameStore((state) => state.upgradeLevels);
  const purchaseUpgrade = useGameStore((state) => state.purchaseUpgrade);
  const isZh = language === 'zh-TW';

  const clampPanelPosition = (position: { x: number; y: number }, panelWidth: number, panelHeight: number) => {
    const minX = DRAG_EDGE_MARGIN;
    const maxX = Math.max(minX, window.innerWidth - DRAG_EDGE_MARGIN - panelWidth);
    const minY = DRAG_EDGE_MARGIN;
    const maxY = Math.max(minY, window.innerHeight - DRAG_EDGE_MARGIN - panelHeight);

    return {
      x: clamp(position.x, minX, maxX),
      y: clamp(position.y, minY, maxY),
    };
  };

  const applyPanelTransform = (position: { x: number; y: number }) => {
    const panel = panelRef.current;

    if (!panel) {
      return;
    }

    panel.style.transform = `translate3d(${position.x}px, ${position.y}px, 0)`;
  };

  useEffect(() => {
    const panel = panelRef.current;

    if (panel) {
      const rect = panel.getBoundingClientRect();
      panelPositionRef.current = clampPanelPosition({ x: rect.left, y: rect.top }, panel.offsetWidth, panel.offsetHeight);
      applyPanelTransform(panelPositionRef.current);
    }

    const handlePointerMove = (event: PointerEvent) => {
      const dragState = dragStateRef.current;

      if (!dragState || dragState.pointerId !== event.pointerId) {
        return;
      }

      const deltaX = event.clientX - dragState.startX;
      const deltaY = event.clientY - dragState.startY;
      const nextX = dragState.startPositionX + deltaX;
      const nextY = dragState.startPositionY + deltaY;

      pendingPanelPositionRef.current = clampPanelPosition({ x: nextX, y: nextY }, dragState.panelWidth, dragState.panelHeight);

      if (dragFrameRef.current !== null) {
        return;
      }

      dragFrameRef.current = window.requestAnimationFrame(() => {
        dragFrameRef.current = null;

        if (pendingPanelPositionRef.current) {
          panelPositionRef.current = pendingPanelPositionRef.current;
          applyPanelTransform(panelPositionRef.current);
        }
      });
    };

    const handlePointerUp = (event: PointerEvent) => {
      const dragState = dragStateRef.current;

      if (!dragState || dragState.pointerId !== event.pointerId) {
        return;
      }

      dragStateRef.current = null;
      if (dragFrameRef.current !== null) {
        window.cancelAnimationFrame(dragFrameRef.current);
        dragFrameRef.current = null;
      }

      if (pendingPanelPositionRef.current) {
        panelPositionRef.current = pendingPanelPositionRef.current;
        applyPanelTransform(panelPositionRef.current);
      }

      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };

    const handleResize = () => {
      const currentPanel = panelRef.current;

      if (!currentPanel) {
        return;
      }

      panelPositionRef.current = clampPanelPosition(
        panelPositionRef.current,
        currentPanel.offsetWidth,
        currentPanel.offsetHeight,
      );
      applyPanelTransform(panelPositionRef.current);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const startDrag = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0 || isInteractiveElement(event.target)) {
      return;
    }

    const panel = panelRef.current;

    if (!panel) {
      return;
    }

    dragStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startPositionX: panelPositionRef.current.x,
      startPositionY: panelPositionRef.current.y,
      panelWidth: panel.offsetWidth,
      panelHeight: panel.offsetHeight,
    };

    pendingPanelPositionRef.current = panelPositionRef.current;

    if (panel.setPointerCapture) {
      panel.setPointerCapture(event.pointerId);
    }

    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'grabbing';
    event.preventDefault();
  };

  return (
    <aside
      ref={panelRef}
      className="upgrade-overlay"
      aria-label="Upgrade controls"
    >
      <div className="upgrade-shell">
        <section className="panel summary-panel" onPointerDown={startDrag} role="presentation">
          <div>
            <p className="panel-label">{summaryColonyLabel}</p>
            <strong className="panel-value">{colonySize} ants</strong>
          </div>
          <div>
            <p className="panel-label">{summaryFoodLabel}</p>
            <strong className="panel-value">{foodAmount}</strong>
          </div>
          <button
            type="button"
            className="summary-panel__toggle"
            aria-expanded={!isCollapsed}
            aria-label={isCollapsed ? showMenuLabel : hideMenuLabel}
            onClick={() => setIsCollapsed((value) => !value)}
          >
            {isCollapsed ? showMenuLabel : hideMenuLabel}
          </button>
        </section>

        {!isCollapsed ? (
          <div className="upgrade-scroll-area">
            {UPGRADE_CARDS.map((upgradeCard) => {
              const level = upgradeLevels[upgradeCard.key];
              const cost = useGameStore.getState().upgradeCost(upgradeCard.key);
              const isMaxLevel = level >= MAX_UPGRADE_LEVEL;
              const canAfford = foodAmount >= cost;
              const cardText = UPGRADE_CARD_TEXT[language][upgradeCard.key];

              return (
                <section className="panel upgrade-card" key={upgradeCard.key}>
                  <div className="upgrade-card__header">
                    <div>
                      <p className="panel-label">{cardText.label}</p>
                      <h2>{cardText.title}</h2>
                    </div>
                    <span className="upgrade-level">{isZh ? `等級 ${level}` : `Lv. ${level}`}</span>
                  </div>
                  <p className="upgrade-description">{formatEffect(language, upgradeCard.key, level)}</p>
                  <p className="upgrade-current-value">{formatCurrentValue(language, upgradeCard.key, level)}</p>
                  <button
                    type="button"
                    className="upgrade-button"
                    onClick={() => purchaseUpgrade(upgradeCard.key)}
                    disabled={!canAfford || isMaxLevel}
                  >
                    {isMaxLevel ? (isZh ? '已達最高等級' : 'Max Level Reached') : isZh ? `花費 ${cost} 食物升級` : `Buy for ${cost} food`}
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