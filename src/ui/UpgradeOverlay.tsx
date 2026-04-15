import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useGameStore } from '../state/gameStore';
import type { GameLanguage } from '../state/gamePersistence';
import { BattlePlannerPanel } from './BattlePlannerPanel';
import {
  ANT_SPEED_MULTIPLIER_PER_LEVEL,
  BASE_ANT_FORAGE_RADIUS_FACTOR,
  BASE_MAX_FOOD_ON_FIELD,
  BASE_SPAWN_INTERVAL_SECONDS,
  FOOD_CAPACITY_PER_LEVEL,
  FORAGE_RADIUS_FACTOR_PER_LEVEL,
  MAX_ANT_FORAGE_RADIUS_FACTOR,
  MAX_ANT_SPEED_MULTIPLIER,
  MAX_FOOD_ON_FIELD,
  NEST_RECOVERY_PER_MINUTE_PER_LEVEL,
  MAX_SPAWN_REDUCTION,
  MAX_UPGRADE_LEVEL,
  BASE_POPULATION_CAPACITY,
  POPULATION_CAPACITY_PER_LEVEL,
  MIN_SPAWN_INTERVAL_SECONDS,
  SPAWN_REDUCTION_PER_LEVEL,
} from '../game/upgradeBalances';

const DRAG_EDGE_MARGIN = 16;
const ATTACK_ALERT_DURATION_MS = 2400;

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

function formatWaveCountdown(seconds: number) {
  const safeSeconds = Math.max(0, seconds);
  const totalWholeSeconds = Math.floor(safeSeconds);
  const minutes = Math.floor(totalWholeSeconds / 60);
  const remainingSeconds = totalWholeSeconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

type SummaryIconKind = 'colony' | 'food' | 'health' | 'wave';

function SummaryIcon({ kind, label }: { kind: SummaryIconKind; label: string }) {
  if (kind === 'colony') {
    return (
      <span className="summary-stat__icon" role="img" aria-label={label} title={label}>
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M16 21V19C16 17.3431 14.6569 16 13 16H6C4.34315 16 3 17.3431 3 19V21" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M9.5 13C11.433 13 13 11.433 13 9.5C13 7.567 11.433 6 9.5 6C7.567 6 6 7.567 6 9.5C6 11.433 7.567 13 9.5 13Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M21 21V19C21 17.8954 20.1046 17 19 17H17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M18 13.3C18.8807 12.9899 19.5 12.1503 19.5 11.1667C19.5 9.91999 18.5467 8.88333 17.3333 8.75" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </span>
    );
  }

  if (kind === 'food') {
    return (
      <span className="summary-stat__icon" role="img" aria-label={label} title={label}>
        <span className="summary-stat__emoji" aria-hidden="true">
          🍗
        </span>
      </span>
    );
  }

  if (kind === 'health') {
    return (
      <span className="summary-stat__icon summary-stat__icon--health" role="img" aria-label={label} title={label}>
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 20.8L10.7 19.6C6.2 15.6 3.2 12.9 3.2 9.5C3.2 6.8 5.3 4.8 8 4.8C9.5 4.8 11 5.5 12 6.7C13 5.5 14.5 4.8 16 4.8C18.7 4.8 20.8 6.8 20.8 9.5C20.8 12.9 17.8 15.6 13.3 19.6L12 20.8Z" fill="currentColor"/>
        </svg>
      </span>
    );
  }

  return (
    <span className="summary-stat__icon" role="img" aria-label={label} title={label}>
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 8V13L15 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M12 21C16.9706 21 21 16.9706 21 12C21 7.02944 16.9706 3 12 3C7.02944 3 3 7.02944 3 12C3 16.9706 7.02944 21 12 21Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </span>
  );
}

function formatEffect(
  language: GameLanguage,
  upgradeKey:
    | 'queenSpawnRate'
    | 'carryCapacity'
    | 'antSpeed'
    | 'nestRecovery'
    | 'foodCapacity'
    | 'forageRadius'
    | 'populationCapacity',
  level: number,
) {
  const isZh = language === 'zh-TW';
  const nextLevel = Math.max(0, level + 1);

  if (upgradeKey === 'queenSpawnRate') {
    const nextReduction = Math.min(nextLevel * SPAWN_REDUCTION_PER_LEVEL * 100, MAX_SPAWN_REDUCTION * 100);
    const currentReduction = Math.min(level * SPAWN_REDUCTION_PER_LEVEL * 100, MAX_SPAWN_REDUCTION * 100);
    const delta = Math.max(0, nextReduction - currentReduction);
    return isZh
      ? `下一級：螞蟻生成間隔 -${delta.toFixed(1)}%`
      : `Next level: spawn interval -${delta.toFixed(1)}%`;
  }

  if (upgradeKey === 'carryCapacity') {
    return isZh ? '下一級：每趟可多搬 +1 食物' : 'Next level: carry +1 food per trip';
  }

  if (upgradeKey === 'antSpeed') {
    return isZh
      ? `下一級：移動速度 +${(ANT_SPEED_MULTIPLIER_PER_LEVEL * 100).toFixed(1)}%`
      : `Next level: move speed +${(ANT_SPEED_MULTIPLIER_PER_LEVEL * 100).toFixed(1)}%`;
  }

  if (upgradeKey === 'nestRecovery') {
    return isZh
      ? `下一級：巢穴每分鐘回血 +${NEST_RECOVERY_PER_MINUTE_PER_LEVEL}`
      : `Next level: nest recovery +${NEST_RECOVERY_PER_MINUTE_PER_LEVEL} HP/min`;
  }

  if (upgradeKey === 'foodCapacity') {
    return isZh
      ? `下一級：場上食物上限 +${FOOD_CAPACITY_PER_LEVEL}`
      : `Next level: field food cap +${FOOD_CAPACITY_PER_LEVEL}`;
  }

  if (upgradeKey === 'forageRadius') {
    return isZh ? '下一級：食物感知半徑 +2%' : 'Next level: food sensing radius +2%';
  }

  if (upgradeKey === 'populationCapacity') {
    return isZh
      ? `下一級：人口上限 +${POPULATION_CAPACITY_PER_LEVEL}`
      : `Next level: population cap +${POPULATION_CAPACITY_PER_LEVEL}`;
  }

  throw new Error(`Unsupported upgrade key: ${upgradeKey}`);
}

function formatCurrentValue(
  language: GameLanguage,
  upgradeKey:
    | 'queenSpawnRate'
    | 'carryCapacity'
    | 'antSpeed'
    | 'nestRecovery'
    | 'foodCapacity'
    | 'forageRadius'
    | 'populationCapacity',
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

  if (upgradeKey === 'nestRecovery') {
    const hpPerMinute = Math.max(0, level) * NEST_RECOVERY_PER_MINUTE_PER_LEVEL;
    return isZh ? `目前：每分鐘回血 ${hpPerMinute}` : `Current: ${hpPerMinute} HP/min`;
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

  if (upgradeKey === 'populationCapacity') {
    const cap = BASE_POPULATION_CAPACITY + Math.max(0, Math.floor(level)) * POPULATION_CAPACITY_PER_LEVEL;
    return isZh ? `目前：人口上限 ${cap}` : `Current: population cap ${cap}`;
  }

  throw new Error(`Unsupported upgrade key: ${upgradeKey}`);
}

const UPGRADE_CARD_TEXT: Record<
  GameLanguage,
  Record<
    'queenSpawnRate' | 'carryCapacity' | 'antSpeed' | 'nestRecovery' | 'foodCapacity' | 'forageRadius' | 'populationCapacity',
    { label: string; title: string }
  >
> = {
  'zh-TW': {
    queenSpawnRate: { label: '蟻后生產', title: '更快孵化螞蟻' },
    carryCapacity: { label: '搬運容量', title: '每趟搬更多食物' },
    antSpeed: { label: '螞蟻速度', title: '探索與搬運更快' },
    nestRecovery: { label: '巢穴回復', title: '每分鐘回復巢穴耐久' },
    foodCapacity: { label: '食物容量', title: '地面可存在更多食物' },
    forageRadius: { label: '覓食範圍', title: '更遠距離偵測食物' },
    populationCapacity: { label: '人口容量', title: '提高工蟻與兵蟻總人口上限' },
  },
  en: {
    queenSpawnRate: { label: 'Queen Spawn Rate', title: 'Faster Ant Production' },
    carryCapacity: { label: 'Carry Capacity', title: 'More Food Per Trip' },
    antSpeed: { label: 'Ant Speed', title: 'Quicker Search Runs' },
    nestRecovery: { label: 'Nest Recovery', title: 'Restore Nest Health Over Time' },
    foodCapacity: { label: 'Food Capacity', title: 'More Food On The Ground' },
    forageRadius: { label: 'Forage Radius', title: 'Stronger Food Detection' },
    populationCapacity: { label: 'Population Capacity', title: 'Increase Total Worker + Soldier Cap' },
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
    key: 'nestRecovery' as const,
    label: 'Nest Recovery',
    title: 'Restore Nest Health Over Time',
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
    key: 'populationCapacity' as const,
    label: 'Population Capacity',
    title: 'Increase Total Unit Cap',
  },
] as const;

interface UpgradeOverlayProps {
  language: GameLanguage;
  summaryColonyLabel: string;
  summaryFoodLabel: string;
  summaryNestHealthLabel: string;
  summaryNextWaveLabel: string;
  upgradesTabLabel: string;
  battleTabLabel: string;
  showMenuLabel: string;
  hideMenuLabel: string;
}

export function UpgradeOverlay({
  language,
  summaryColonyLabel,
  summaryFoodLabel,
  summaryNestHealthLabel,
  summaryNextWaveLabel,
  upgradesTabLabel,
  battleTabLabel,
  showMenuLabel,
  hideMenuLabel,
}: UpgradeOverlayProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<'upgrades' | 'battle'>('upgrades');
  const [now, setNow] = useState(() => Date.now());
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
  const nestHealth = useGameStore((state) => state.nestHealth);
  const nextEnemyWaveInSeconds = useGameStore((state) => state.nextEnemyWaveInSeconds);
  const lastNestHitAt = useGameStore((state) => state.lastNestHitAt);
  const upgradeLevels = useGameStore((state) => state.upgradeLevels);
  const purchaseUpgrade = useGameStore((state) => state.purchaseUpgrade);
  const isZh = language === 'zh-TW';
  const populationLimit = BASE_POPULATION_CAPACITY + Math.max(0, upgradeLevels.populationCapacity) * POPULATION_CAPACITY_PER_LEVEL;
  const attackAlertLabel = isZh ? '敵襲警報' : 'Under Attack';
  const isUnderAttack = lastNestHitAt > 0 && now - lastNestHitAt < ATTACK_ALERT_DURATION_MS;

  useEffect(() => {
    if (!isUnderAttack) {
      return;
    }

    const timerId = window.setInterval(() => {
      setNow(Date.now());
    }, 120);

    return () => {
      window.clearInterval(timerId);
    };
  }, [isUnderAttack]);

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
          {isUnderAttack ? (
            <span className="summary-panel__alert" role="status" aria-live="polite">
              {attackAlertLabel}
            </span>
          ) : null}
          <div className="summary-stat" role="group" aria-label={summaryColonyLabel}>
            <SummaryIcon kind="colony" label={summaryColonyLabel} />
            <strong className="panel-value">{colonySize} / {populationLimit}</strong>
          </div>
          <div className="summary-stat" role="group" aria-label={summaryFoodLabel}>
            <SummaryIcon kind="food" label={summaryFoodLabel} />
            <strong className="panel-value">{foodAmount}</strong>
          </div>
          <div className="summary-stat" role="group" aria-label={summaryNestHealthLabel}>
            <SummaryIcon kind="health" label={summaryNestHealthLabel} />
            <strong className="panel-value">{Math.max(0, Math.floor(nestHealth))}%</strong>
          </div>
          <div className="summary-stat" role="group" aria-label={summaryNextWaveLabel}>
            <SummaryIcon kind="wave" label={summaryNextWaveLabel} />
            <strong className="panel-value panel-value--timer">{formatWaveCountdown(nextEnemyWaveInSeconds)}</strong>
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
            <div className="overlay-tabs" role="tablist" aria-label={isZh ? '選單分頁' : 'Menu tabs'}>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'upgrades'}
                className={`overlay-tabs__button${activeTab === 'upgrades' ? ' is-active' : ''}`}
                onClick={() => setActiveTab('upgrades')}
              >
                {upgradesTabLabel}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'battle'}
                className={`overlay-tabs__button${activeTab === 'battle' ? ' is-active' : ''}`}
                onClick={() => setActiveTab('battle')}
              >
                {battleTabLabel}
              </button>
            </div>

            <div hidden={activeTab !== 'upgrades'} role="tabpanel">
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
                      {isMaxLevel
                        ? isZh
                          ? '已達最高等級'
                          : 'Max Level Reached'
                        : isZh
                          ? `花費 ${cost} 食物升級`
                          : `Buy for ${cost} food`}
                    </button>
                  </section>
                );
              })}
            </div>

            <div hidden={activeTab !== 'battle'} role="tabpanel">
              <BattlePlannerPanel language={language} embedded />
            </div>
          </div>
        ) : null}
      </div>
    </aside>
  );
}