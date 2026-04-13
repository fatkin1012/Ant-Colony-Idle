import { GameCanvas } from './game/GameCanvas';
import { UpgradeOverlay } from './ui/UpgradeOverlay';

export default function App() {
  return (
    <div className="app-shell">
      <header className="hud">
        <div>
          <p className="eyebrow">Ant Colony Idle</p>
          <h1>蟻巢模擬</h1>
        </div>
        <p className="status">Step 4: Upgrade overlay and shared game state are live.</p>
      </header>
      <main className="game-stage">
        <GameCanvas />
        <UpgradeOverlay />
      </main>
    </div>
  );
}