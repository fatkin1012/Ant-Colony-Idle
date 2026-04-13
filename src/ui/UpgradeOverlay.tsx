import { useGameStore } from '../state/gameStore';

function formatEffect(upgradeKey: 'queenSpawnRate' | 'carryCapacity', level: number) {
  if (upgradeKey === 'queenSpawnRate') {
    return `Spawn interval -${Math.min(level * 10, 75)}%`;
  }

  return `Carry +${level} food per trip`;
}

export function UpgradeOverlay() {
  const colonySize = useGameStore((state) => state.colonySize);
  const foodAmount = useGameStore((state) => state.foodAmount);
  const upgradeLevels = useGameStore((state) => state.upgradeLevels);
  const purchaseUpgrade = useGameStore((state) => state.purchaseUpgrade);
  const queenSpawnRateCost = useGameStore((state) => state.upgradeCost('queenSpawnRate'));
  const carryCapacityCost = useGameStore((state) => state.upgradeCost('carryCapacity'));

  const canAffordQueenSpawnRate = foodAmount >= queenSpawnRateCost;
  const canAffordCarryCapacity = foodAmount >= carryCapacityCost;

  return (
    <aside className="upgrade-overlay" aria-label="Upgrade controls">
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

      <section className="panel upgrade-card">
        <div className="upgrade-card__header">
          <div>
            <p className="panel-label">Queen Spawn Rate</p>
            <h2>Faster Ant Production</h2>
          </div>
          <span className="upgrade-level">Lv. {upgradeLevels.queenSpawnRate}</span>
        </div>
        <p className="upgrade-description">{formatEffect('queenSpawnRate', upgradeLevels.queenSpawnRate)}</p>
        <button
          type="button"
          className="upgrade-button"
          onClick={() => purchaseUpgrade('queenSpawnRate')}
          disabled={!canAffordQueenSpawnRate}
        >
          Buy for {queenSpawnRateCost} food
        </button>
      </section>

      <section className="panel upgrade-card">
        <div className="upgrade-card__header">
          <div>
            <p className="panel-label">Carry Capacity</p>
            <h2>More Food Per Trip</h2>
          </div>
          <span className="upgrade-level">Lv. {upgradeLevels.carryCapacity}</span>
        </div>
        <p className="upgrade-description">{formatEffect('carryCapacity', upgradeLevels.carryCapacity)}</p>
        <button
          type="button"
          className="upgrade-button"
          onClick={() => purchaseUpgrade('carryCapacity')}
          disabled={!canAffordCarryCapacity}
        >
          Buy for {carryCapacityCost} food
        </button>
      </section>
    </aside>
  );
}