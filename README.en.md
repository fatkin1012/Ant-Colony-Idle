# Ant Colony Idle / Ant Colony Simulator

[🌐 中文](README.md) | [🌐 English](README.en.md)

> A browser-based idle ant colony game with two playable modes: relaxed growth and battle defense.

## 🐜 Overview

Ant Colony Idle starts from a small nest and grows into a large ant society. Ants automatically scout, gather food, and return resources. Your job is to plan upgrades and keep scaling both economy and survivability.

### ✨ Highlights

- 🧠 Dual mode gameplay: Battle Mode + Idle Mode
- 🍗 Full economy loop: scout -> carry -> invest -> expand
- ⚔️ Combat layer: enemy waves, nest pressure, squad deployment
- 🧪 14 upgrade lines across economy, nest, and soldiers
- 💾 Auto-save with local persistence (mode/language included)
- 🌍 Built-in bilingual interface

## 🎮 Game Modes

| Mode | Description | Best for |
| --- | --- | --- |
| Battle Mode | Enemy waves and nest pressure are active. Squad deployment and defense become core. | Tactical and challenge-focused play |
| Idle Mode | Battle pressure is disabled. Focus on progression and economy growth. | Relaxed long-term growth |

### Mode Rules

- Both modes share the same progression data.
- Selected mode is saved in browser local storage.
- Game Over flow is meaningful only in Battle Mode.

## 🔁 Core Gameplay Loop

1. 👀 Worker ants automatically explore and locate food
2. 📦 Ants return food to the nest
3. 🛠️ Spend food on upgrades
4. 📈 Increase population cap and colony scale
5. ⚔️ (Battle Mode) survive waves and protect nest health

## 🧩 Systems

### 1) Economy

- Main resource: Food
- Starting amount: 500
- Income: worker delivery + battle rewards
- Spending: upgrades + squad deployment

### 2) Colony Growth

- `colonySize` tracks current used population
- Population cap scales with `populationCapacity`
- Queen-related upgrades accelerate growth

### 3) Nest Health

- Active pressure in Battle Mode
- Reinforced by `nestRecovery` and `nestMaxHealth`
- Nest collapse triggers battle failure state

### 4) Combat & Waves

- Enemy pressure comes in waves
- Real-time combat simulation in the engine
- HUD shows wave countdown and nest status

### 5) Squad Planner

- Modes: `DEFEND` and `ASSAULT`
- Roles:
  - 🛡️ Guardian
  - ⚔️ Raider
  - 🧪 Spitter
- Deployment checks:
  - Enough food
  - Enough free population

### 6) Upgrade Matrix (14 lines)

#### Economy & Growth

- `queenSpawnRate`
- `carryCapacity`
- `antSpeed`
- `foodCapacity`
- `forageRadius`
- `populationCapacity`

#### Nest Survivability

- `nestRecovery`
- `nestMaxHealth`

#### Soldier Power

- `soldierDamage`
- `soldierHealth`
- `soldierSpeed`
- `soldierTauntRange`
- `soldierAttackRange`
- `soldierAttackCooldown`

### 7) Persistence

- Auto-save triggers: interval, page hidden, page exit
- Saved data: resources, upgrades, engine snapshot, mode, language
- Storage: browser `localStorage`

## 🖥️ UI Guide

### Top HUD

- 👥 Colony / population cap
- 🍗 Food
- ❤️ Nest health (Battle Mode)
- ⏱️ Next enemy wave timer (Battle Mode)
- `SHOW MENU / HIDE MENU` toggle button

### Right Overlay

- `Upgrades`
- `Soldier Upgrades`
- `Battle Planner`

### Settings

- Language switch: Traditional Chinese / English
- Mode switch: Battle / Idle
- Progress reset

## 🧱 Design Goals

- Readable simulation and clear progression feedback
- Low-friction idle rhythm for long sessions
- Flexible pacing through two mode styles
- Every upgrade should have visible impact

## 🛠️ Tech Stack

- Frontend: React + TypeScript + Vite + HTML5 Canvas
- State: Zustand
- Optional local backend: Node.js + Express + TypeScript

## 📁 Project Structure

```text
src/
  game/
    combat/
    engine/
    entities/
  state/
  ui/
  App.tsx
  main.tsx

server/
  src/
```

## 🚀 Local Development

### 1) Install dependencies

```bash
npm install
```

> On Windows PowerShell, execution policy may block `npm.ps1`. If that happens:

```bash
npm.cmd install
```

### 2) Start dev mode

```bash
npm run dev
```

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3001`

### 3) Build production

```bash
npm run build
```

### 4) Preview production build

```bash
npm run preview
```

## 🌐 Deployment Notes

### GitHub Pages

- Works as a frontend-only deployment.
- Vite base is configured for repo-path hosting.
- GitHub Actions publishes the `dist` output.

### Limitation

- GitHub Pages does not host a persistent Node.js backend.
- Server-dependent features must be deployed separately.

## 🧪 Useful Scripts

- `npm run dev`
- `npm run build`
- `npm run preview`
- `npm run typecheck`

## 🧭 Suggested Strategy

1. Prioritize `queenSpawnRate` + `carryCapacity`
2. Mid game: strengthen `populationCapacity` + `foodCapacity`
3. Before heavy battle: invest in `nestRecovery` + `nestMaxHealth`
4. Combine roles: Guardian frontline, Raider DPS, Spitter ranged support

## 🤝 Contributing

Issues and pull requests are welcome.

- Include repro steps for bugs
- Add screenshots/clips for UI issues
- Keep commits focused and descriptive

## 📜 License

See [LICENSE](LICENSE).
