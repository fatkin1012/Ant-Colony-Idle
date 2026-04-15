import { useEffect, useRef, useState } from 'react';
import { GameCanvas } from './game/GameCanvas';
import { UpgradeOverlay } from './ui/UpgradeOverlay';
import {
  clearPersistedGameState,
  loadGameLanguage,
  loadPersistedGameState,
  saveGameLanguage,
  savePersistedGameState,
  savePersistedGameStateOnPageHide,
  type GameLanguage,
} from './state/gamePersistence';
import { getPersistedGameSnapshot, INITIAL_FOOD_AMOUNT, useGameStore } from './state/gameStore';

const AUTO_SAVE_INTERVAL_MS = 4000;

const EMPTY_UPGRADE_LEVELS = {
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
} as const;

const TRANSLATIONS: Record<
  GameLanguage,
  {
    title: string;
    settings: string;
    modalTitle: string;
    language: string;
    languageZh: string;
    languageEn: string;
    resetLabel: string;
    resetHint: string;
    resetAction: string;
    close: string;
    resetConfirm: string;
    gameOverTitle: string;
    gameOverHint: string;
    gameOverRestart: string;
    summaryColony: string;
    summaryFood: string;
    summaryNestHealth: string;
    summaryNextWave: string;
    upgradesTab: string;
    soldiersTab: string;
    battleTab: string;
    showMenu: string;
    hideMenu: string;
  }
> = {
  'zh-TW': {
    title: '蟻巢模擬',
    settings: '設定',
    modalTitle: '遊戲設定',
    language: '語言',
    languageZh: '繁體中文',
    languageEn: 'English',
    resetLabel: '重置進度',
    resetHint: '清空目前本地存檔並從初始狀態重新開始。',
    resetAction: '重置進度',
    close: '關閉',
    resetConfirm: '確定要重置進度嗎？這個動作無法還原。',
    gameOverTitle: '蟻巢已被摧毀',
    gameOverHint: '你的蟻巢耐久歸零，這一局已結束。',
    gameOverRestart: '重開一局',
    summaryColony: '蟻群',
    summaryFood: '食物',
    summaryNestHealth: '巢穴耐久',
    summaryNextWave: '下一波敵人',
    upgradesTab: '升級',
    soldiersTab: '兵種強化',
    battleTab: '排兵佈陣',
    showMenu: '顯示選單',
    hideMenu: '隱藏選單',
  },
  en: {
    title: 'Ant Colony Simulator',
    settings: 'Settings',
    modalTitle: 'Game Settings',
    language: 'Language',
    languageZh: 'Traditional Chinese',
    languageEn: 'English',
    resetLabel: 'Reset Progress',
    resetHint: 'Clear local save and restart from the initial state.',
    resetAction: 'Reset Progress',
    close: 'Close',
    resetConfirm: 'Reset progress now? This cannot be undone.',
    gameOverTitle: 'Your Nest Has Fallen',
    gameOverHint: 'Nest health reached zero. This run is over.',
    gameOverRestart: 'Start New Run',
    summaryColony: 'Colony',
    summaryFood: 'Food',
    summaryNestHealth: 'Nest Health',
    summaryNextWave: 'Next Enemy Wave',
    upgradesTab: 'Upgrades',
    soldiersTab: 'Soldier Upgrades',
    battleTab: 'Battle Planner',
    showMenu: 'Show Menu',
    hideMenu: 'Hide Menu',
  },
};

export default function App() {
  const [language, setLanguage] = useState<GameLanguage>(() => loadGameLanguage());
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isPersistenceReady, setIsPersistenceReady] = useState(false);
  const [gameSessionKey, setGameSessionKey] = useState(0);
  const nestHealth = useGameStore((state) => state.nestHealth);

  const text = TRANSLATIONS[language];
  const isGameOver = nestHealth <= 0;

  useEffect(() => {
    let disposed = false;
    let unsubscribeStore: (() => void) | null = null;
    let saveTimerId: number | null = null;
    let saveInFlight = false;
    let pendingSave = false;

    const clearSaveTimer = () => {
      if (saveTimerId !== null) {
        window.clearTimeout(saveTimerId);
        saveTimerId = null;
      }
    };

    const flushSave = async () => {
      if (saveInFlight || disposed) {
        return;
      }

      saveInFlight = true;

      try {
        const snapshot = getPersistedGameSnapshot(useGameStore.getState());
        await savePersistedGameState(snapshot);
      } catch {
        pendingSave = true;
      } finally {
        saveInFlight = false;

        if (pendingSave && !disposed) {
          pendingSave = false;
          queueSave();
        }
      }
    };

    const queueSave = () => {
      clearSaveTimer();
      saveTimerId = window.setTimeout(() => {
        saveTimerId = null;
        void flushSave();
      }, AUTO_SAVE_INTERVAL_MS);
    };

    const flushOnHide = () => {
      clearSaveTimer();

      const snapshot = getPersistedGameSnapshot(useGameStore.getState());
      savePersistedGameStateOnPageHide(snapshot);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flushOnHide();
      }
    };

    const initializePersistence = async () => {
      try {
        const loadedState = await loadPersistedGameState();

        if (!disposed) {
          useGameStore.getState().hydrateFromPersistence(loadedState);
        }
      } catch {
        // Ignore load errors and continue with default state.
      }

      if (disposed) {
        return;
      }

      unsubscribeStore = useGameStore.subscribe(() => {
        queueSave();
      });

      window.addEventListener('pagehide', flushOnHide);
      window.addEventListener('beforeunload', flushOnHide);
      document.addEventListener('visibilitychange', handleVisibilityChange);

      if (!disposed) {
        setIsPersistenceReady(true);
      }
    };

    void initializePersistence();

    return () => {
      disposed = true;
      setIsPersistenceReady(false);
      clearSaveTimer();
      unsubscribeStore?.();
      window.removeEventListener('pagehide', flushOnHide);
      window.removeEventListener('beforeunload', flushOnHide);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const handleLanguageChange = (nextLanguage: GameLanguage) => {
    setLanguage(nextLanguage);
    saveGameLanguage(nextLanguage);
  };

  const resetToNewRun = () => {
    clearPersistedGameState();
    useGameStore.getState().hydrateFromPersistence({
      colonySize: 12,
      foodAmount: INITIAL_FOOD_AMOUNT,
      nestHealth: 100,
      nextEnemyWaveInSeconds: 0,
      upgradeLevels: EMPTY_UPGRADE_LEVELS,
      engineState: null,
    });
    setGameSessionKey((value) => value + 1);
    setIsSettingsOpen(false);
  };

  const handleResetProgress = () => {
    if (!window.confirm(text.resetConfirm)) {
      return;
    }

    resetToNewRun();
  };

  return (
    <div className="app-shell">
      <header className="hud">
        <div>
          <p className="eyebrow">Ant Colony Idle</p>
          <h1>{text.title}</h1>
        </div>
        <div className="hud-actions">
          <button
            type="button"
            className="settings-button"
            aria-label={text.settings}
            onClick={() => setIsSettingsOpen(true)}
          >
            <svg className="settings-button__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path
                d="M19.14 12.94a7.48 7.48 0 0 0 .05-.94 7.48 7.48 0 0 0-.05-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.2 7.2 0 0 0-1.63-.94L14.4 2.8a.5.5 0 0 0-.49-.4h-3.84a.5.5 0 0 0-.49.4L9.2 5.32c-.57.22-1.12.53-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.66 8.84a.5.5 0 0 0 .12.64l2.03 1.58c-.03.31-.05.63-.05.94 0 .31.02.63.05.94l-2.03 1.58a.5.5 0 0 0-.12.64l1.92 3.32a.5.5 0 0 0 .6.22l2.39-.96c.51.41 1.06.72 1.63.94l.38 2.52a.5.5 0 0 0 .49.4h3.84a.5.5 0 0 0 .49-.4l.38-2.52c.57-.22 1.12-.53 1.63-.94l2.39.96a.5.5 0 0 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58ZM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7Z"
                fill="currentColor"
              />
            </svg>
          </button>
        </div>
      </header>
      <main className="game-stage">
        {isPersistenceReady ? <GameCanvas key={gameSessionKey} /> : null}
        <UpgradeOverlay
          language={language}
          summaryColonyLabel={text.summaryColony}
          summaryFoodLabel={text.summaryFood}
          summaryNestHealthLabel={text.summaryNestHealth}
          summaryNextWaveLabel={text.summaryNextWave}
          upgradesTabLabel={text.upgradesTab}
          soldiersTabLabel={text.soldiersTab}
          battleTabLabel={text.battleTab}
          showMenuLabel={text.showMenu}
          hideMenuLabel={text.hideMenu}
        />
      </main>

      {isSettingsOpen ? (
        <div className="settings-modal-backdrop" role="presentation" onClick={() => setIsSettingsOpen(false)}>
          <section
            className="settings-modal"
            role="dialog"
            aria-modal="true"
            aria-label={text.modalTitle}
            onClick={(event) => event.stopPropagation()}
          >
            <h2>{text.modalTitle}</h2>

            <label className="settings-field" htmlFor="language-select">
              <span>{text.language}</span>
              <select
                id="language-select"
                value={language}
                onChange={(event) => handleLanguageChange(event.target.value as GameLanguage)}
              >
                <option value="zh-TW">{text.languageZh}</option>
                <option value="en">{text.languageEn}</option>
              </select>
            </label>

            <div className="settings-reset">
              <p className="settings-reset__title">{text.resetLabel}</p>
              <p className="settings-reset__hint">{text.resetHint}</p>
              <button type="button" className="settings-reset__button" onClick={handleResetProgress}>
                {text.resetAction}
              </button>
            </div>

            <div className="settings-modal__footer">
              <button type="button" className="settings-close" onClick={() => setIsSettingsOpen(false)}>
                {text.close}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {isGameOver ? (
        <div className="game-over-backdrop" role="presentation">
          <section className="settings-modal game-over-modal" role="dialog" aria-modal="true" aria-label={text.gameOverTitle}>
            <h2>{text.gameOverTitle}</h2>
            <p className="settings-reset__hint">{text.gameOverHint}</p>
            <div className="settings-modal__footer">
              <button type="button" className="settings-reset__button" onClick={resetToNewRun}>
                {text.gameOverRestart}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}