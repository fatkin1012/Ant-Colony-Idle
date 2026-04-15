import { useMemo, useState } from 'react';
import { useGameStore } from '../state/gameStore';
import { BattleDirector } from '../game/combat/battleDirector';
import { ANT_TEMPLATES, computeCompositionCost, computeCompositionPopulationCost, recommendCompositionByBudget } from '../game/combat/antBalance';
import { AntRole, SquadMode, type Squad } from '../game/combat/antTypes';
import type { GameLanguage } from '../state/gamePersistence';
import { getPopulationLimit } from '../state/gameStore';

const MAX_BATTLE_POPULATION = 100;

const ROLE_ORDER = [AntRole.GUARDIAN, AntRole.RAIDER, AntRole.SPITTER] as const;

const ROLE_LABELS: Record<GameLanguage, Record<AntRole, string>> = {
  'zh-TW': {
    [AntRole.WORKER]: '工蟻',
    [AntRole.GUARDIAN]: '盾兵',
    [AntRole.RAIDER]: '突擊兵',
    [AntRole.SPITTER]: '酸液兵',
  },
  en: {
    [AntRole.WORKER]: 'Worker',
    [AntRole.GUARDIAN]: 'Guardian',
    [AntRole.RAIDER]: 'Raider',
    [AntRole.SPITTER]: 'Spitter',
  },
};

const TEXTS: Record<
  GameLanguage,
  {
    title: string;
    subtitle: string;
    defend: string;
    assault: string;
    recommend: string;
    createSquad: string;
    deploy: string;
    reset: string;
    draftCost: string;
    draftPopulation: string;
    freePopulation: string;
    queue: string;
    noQueue: string;
    created: string;
    deploySuccess: string;
    deployFailFood: string;
    deployFailPopulation: string;
    delete: string;
    tip: string;
  }
> = {
  'zh-TW': {
    title: 'Battle Planner',
    subtitle: '兵種編組原型',
    defend: '守家',
    assault: '出征',
    recommend: '預算推薦',
    createSquad: '建立小隊',
    deploy: '部署',
    reset: '清空編組',
    draftCost: '編組花費',
    draftPopulation: '編組人口',
    freePopulation: '可用人口',
    queue: '待命小隊',
    noQueue: '目前沒有待命小隊',
    created: '已建立待命小隊',
    deploySuccess: '部署成功，正在生成兵蟻',
    deployFailFood: '食物不足',
    deployFailPopulation: '人口不足',
    delete: '刪除',
    tip: '部署會同時檢查食物與總人口上限。',
  },
  en: {
    title: 'Battle Planner',
    subtitle: 'Unit Composition Prototype',
    defend: 'Defend',
    assault: 'Assault',
    recommend: 'Recommend by Budget',
    createSquad: 'Create Squad',
    deploy: 'Deploy',
    reset: 'Reset Draft',
    draftCost: 'Draft Cost',
    draftPopulation: 'Draft Population',
    freePopulation: 'Free Population',
    queue: 'Queued Squads',
    noQueue: 'No queued squads yet',
    created: 'Squad queued',
    deploySuccess: 'Deploy queued, units are spawning',
    deployFailFood: 'Not enough food',
    deployFailPopulation: 'Not enough population',
    delete: 'Delete',
    tip: 'Deployment checks both food and total population cap.',
  },
};

interface BattlePlannerPanelProps {
  language: GameLanguage;
  embedded?: boolean;
  hidden?: boolean;
}

export function BattlePlannerPanel({ language, embedded = false, hidden = false }: BattlePlannerPanelProps) {
  const foodAmount = useGameStore((state) => state.foodAmount);
  const colonySize = useGameStore((state) => state.colonySize);
  const spendFood = useGameStore((state) => state.spendFood);
  const enqueueBattleDeployment = useGameStore((state) => state.enqueueBattleDeployment);
  const upgradeLevels = useGameStore((state) => state.upgradeLevels);

  const [mode, setMode] = useState<SquadMode>(SquadMode.DEFEND);
  const [message, setMessage] = useState('');
  const [draft, setDraft] = useState<Partial<Record<AntRole, number>>>({
    [AntRole.GUARDIAN]: 0,
    [AntRole.RAIDER]: 0,
    [AntRole.SPITTER]: 0,
  });
  const [queuedSquads, setQueuedSquads] = useState<Squad[]>([]);

  const texts = TEXTS[language];
  const labels = ROLE_LABELS[language];
  const populationLimit = Math.max(MAX_BATTLE_POPULATION, getPopulationLimit(upgradeLevels));
  const freePopulation = Math.max(0, populationLimit - colonySize);

  const director = useMemo(
    () =>
      new BattleDirector({
        spawnPlayerAnt: () => {
          // UI prototype stage: no direct entity spawn yet.
        },
        getFood: () => useGameStore.getState().foodAmount,
        spendFood: (amount) => useGameStore.getState().spendFood(amount),
        getFreePopulation: () => {
          const state = useGameStore.getState();
          const cap = Math.max(MAX_BATTLE_POPULATION, getPopulationLimit(state.upgradeLevels));
          return Math.max(0, cap - state.colonySize);
        },
      }),
    [],
  );

  const draftCost = computeCompositionCost(draft);
  const draftPopulation = computeCompositionPopulationCost(draft);

  const updateDraftCount = (role: AntRole, nextCount: number) => {
    setDraft((prev) => ({
      ...prev,
      [role]: Math.max(0, nextCount),
    }));
  };

  const handleRecommend = () => {
    setDraft(recommendCompositionByBudget(foodAmount));
  };

  const handleCreateSquad = () => {
    const squad = director.createSquad(draft, mode);
    setQueuedSquads((prev) => [...prev, squad]);
    setMessage(texts.created);
  };

  const handleDeploySquad = (squad: Squad) => {
    const cost = director.computeSquadCost(squad);
    const pop = director.computeSquadPopulation(squad);

    if (foodAmount < cost) {
      setMessage(texts.deployFailFood);
      return;
    }

    if (freePopulation < pop) {
      setMessage(texts.deployFailPopulation);
      return;
    }

    if (!spendFood(cost)) {
      setMessage(texts.deployFailFood);
      return;
    }

    enqueueBattleDeployment({
      composition: squad.composition,
      mode: squad.mode,
    });

    setQueuedSquads((prev) => prev.filter((item) => item.id !== squad.id));
    setMessage(texts.deploySuccess);
  };

  const handleDeleteSquad = (squadId: string) => {
    director.disbandSquad(squadId);
    setQueuedSquads((prev) => prev.filter((item) => item.id !== squadId));
    setMessage('');
  };

  const handleReset = () => {
    setDraft({
      [AntRole.GUARDIAN]: 0,
      [AntRole.RAIDER]: 0,
      [AntRole.SPITTER]: 0,
    });
  };

  return (
    <aside
      className={`battle-planner ${embedded ? 'battle-planner--embedded' : 'panel'}`}
      aria-label={texts.title}
      hidden={hidden}
    >
      <header className="battle-planner__header">
        <div>
          <p className="panel-label">{texts.subtitle}</p>
          <h2>{texts.title}</h2>
        </div>
        <div className="battle-planner__mode" role="tablist" aria-label="Squad mode">
          <button
            type="button"
            className={`battle-planner__mode-button${mode === SquadMode.DEFEND ? ' is-active' : ''}`}
            onClick={() => setMode(SquadMode.DEFEND)}
          >
            {texts.defend}
          </button>
          <button
            type="button"
            className={`battle-planner__mode-button${mode === SquadMode.ASSAULT ? ' is-active' : ''}`}
            onClick={() => setMode(SquadMode.ASSAULT)}
          >
            {texts.assault}
          </button>
        </div>
      </header>

      <div className="battle-planner__roles">
        {ROLE_ORDER.map((role) => {
          const count = draft[role] ?? 0;
          const template = ANT_TEMPLATES[role];

          return (
            <section key={role} className="battle-role-card">
              <div className="battle-role-card__meta">
                <strong>{labels[role]}</strong>
                <span>
                  {template.base.cost} food / {template.base.popCost} pop
                </span>
              </div>
              <div className="battle-stepper" role="group" aria-label={`${labels[role]} stepper`}>
                <button type="button" onClick={() => updateDraftCount(role, count - 1)} aria-label={`Decrease ${labels[role]}`}>
                  -
                </button>
                <span>{count}</span>
                <button type="button" onClick={() => updateDraftCount(role, count + 1)} aria-label={`Increase ${labels[role]}`}>
                  +
                </button>
              </div>
            </section>
          );
        })}
      </div>

      <div className="battle-planner__stats">
        <p>
          {texts.draftCost}: <strong>{draftCost}</strong>
        </p>
        <p>
          {texts.draftPopulation}: <strong>{draftPopulation}</strong>
        </p>
        <p>
          {texts.freePopulation}: <strong>{freePopulation}</strong>
        </p>
      </div>

      <div className="battle-planner__actions">
        <button type="button" className="battle-action" onClick={handleRecommend}>
          {texts.recommend}
        </button>
        <button type="button" className="battle-action" onClick={handleCreateSquad}>
          {texts.createSquad}
        </button>
        <button type="button" className="battle-action battle-action--ghost" onClick={handleReset}>
          {texts.reset}
        </button>
      </div>

      <section className="battle-planner__queue" aria-label={texts.queue}>
        <p className="panel-label">{texts.queue}</p>
        {queuedSquads.length === 0 ? <p className="battle-planner__empty">{texts.noQueue}</p> : null}

        {queuedSquads.map((squad) => {
          const cost = director.computeSquadCost(squad);
          const pop = director.computeSquadPopulation(squad);

          return (
            <article className="battle-queue-item" key={squad.id}>
              <div>
                <strong>{squad.mode === SquadMode.DEFEND ? texts.defend : texts.assault}</strong>
                <p>
                  {Object.entries(squad.composition)
                    .filter(([, value]) => (value ?? 0) > 0)
                    .map(([key, value]) => `${labels[key as AntRole]} x${value}`)
                    .join(' | ')}
                </p>
                <small>
                  {cost} food / {pop} pop
                </small>
              </div>
              <button type="button" className="battle-action" onClick={() => handleDeploySquad(squad)}>
                {texts.deploy}
              </button>
              <button type="button" className="battle-action battle-action--danger battle-action--icon" onClick={() => handleDeleteSquad(squad.id)} aria-label={texts.delete}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M3 6H5H21M8 6V4C8 3.44772 8.44772 3 9 3H15C15.5523 3 16 3.44772 16 4V6M16 6V20C16 20.5523 15.5523 21 15 21H9C8.44772 21 8 20.5523 8 20V6H16ZM10 10V18M14 10V18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </article>
          );
        })}
      </section>

      <p className="battle-planner__tip">{texts.tip}</p>
      {message ? <p className="battle-planner__message">{message}</p> : null}
    </aside>
  );
}
