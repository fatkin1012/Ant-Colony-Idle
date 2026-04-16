# Ant Colony Idle / 蟻巢模擬

> A browser-based ant colony idle game with two modes: peaceful growth and battle defense.
>
> 一款以螞蟻生態為核心、包含「休閑掛機」與「戰役防守」雙模式的網頁放置遊戲。

## 🐜 Game Overview / 遊戲總覽

Ant Colony Idle lets you grow a colony from a small nest into a large ant society. Ants automatically forage, return food, and expand your economy over time.

《Ant Colony Idle》讓你從小型蟻巢開始，逐步發展成大型蟻群。螞蟻會自動探索、搬運、回巢，你的任務是規劃升級與資源分配。

### ✨ Core Highlights

- 🧠 **Dual game modes**: `Battle Mode` + `Idle Mode`
- 🍗 **Food economy loop**: forage -> return -> invest -> scale
- ⚔️ **Combat layer**: enemy waves, nest defense, squad composition
- 🧪 **14 upgrade lines** covering economy, colony, and soldier systems
- 💾 **Auto-save and local persistence** (language and mode included)
- 🌍 **Bilingual UI**: Traditional Chinese + English

## 🎮 Modes / 模式說明

| Mode | Description | Typical Use |
| --- | --- | --- |
| `Battle Mode` | Enemy waves and nest pressure are active. You can deploy squads and use battle upgrades. | 喜歡戰術、守家與出征玩法 |
| `Idle Mode` | Pure growth mode. Battle-only systems are hidden or disabled for a calmer progression loop. | 想專注放置與經營成長 |

### Mode behavior notes

- Shared progression is preserved across both modes.
- Mode selection is saved in browser local storage.
- Game Over is only meaningful in battle flow.

## 🔁 Gameplay Loop / 核心循環

1. 👀 工蟻自動探索地圖並接觸食物
2. 📦 搬運回巢，食物資源累積
3. 🛠️ 投資升級，提升效率與容量
4. 📈 擴張人口上限與蟻群規模
5. ⚔️（戰役模式）應對敵軍、維持巢穴耐久

## 🧩 Systems Breakdown / 系統詳解

### 1) Resource & Economy / 資源與經濟

- 基礎貨幣：`Food`
- 初始資源：500 food
- 主要產出來源：工蟻搬運、戰鬥獎勵（擊殺/摧毀敵巢）
- 主要消耗來源：升級、部署兵種小隊

### 2) Colony Growth / 蟻群成長

- `colonySize` 反映目前使用人口
- 人口受到 `populationCapacity` 升級影響
- 蟻后生產速率可透過升級提高

### 3) Nest Health / 巢穴耐久

- 戰役模式下巢穴會承受敵方壓力
- 可透過 `nestRecovery` 回復能力與 `nestMaxHealth` 上限強化
- 巢穴歸零時觸發戰役失敗流程

### 4) Combat & Enemy Waves / 戰鬥與敵襲波次

- 敵方會以波次壓力推進
- 戰鬥演算由引擎即時更新（含近戰/遠程交戰）
- 波次倒數與巢穴狀態顯示於上方 HUD

### 5) Squad Planner / 小隊編成

- 支援 `DEFEND`（守家）與 `ASSAULT`（出征）兩種行為模式
- 兵種角色：
	- 🛡️ `Guardian`（盾兵）
	- ⚔️ `Raider`（突擊兵）
	- 🧪 `Spitter`（酸液兵）
- 部署前會檢查：
	- 食物是否足夠
	- 人口是否足夠

### 6) Upgrade Matrix / 升級矩陣（14 條）

#### Economy & Colony

- `queenSpawnRate` 蟻后生產
- `carryCapacity` 搬運容量
- `antSpeed` 螞蟻速度
- `foodCapacity` 場上食物容量
- `forageRadius` 覓食範圍
- `populationCapacity` 人口容量

#### Nest Survivability

- `nestRecovery` 巢穴回復
- `nestMaxHealth` 巢穴生命上限

#### Soldier Power

- `soldierDamage` 兵種傷害
- `soldierHealth` 兵種血量
- `soldierSpeed` 兵種速度
- `soldierTauntRange` 嘲諷範圍
- `soldierAttackRange` 攻擊距離
- `soldierAttackCooldown` 攻速（冷卻）

### 7) Persistence / 存檔與持久化

- 自動存檔（週期 + 隱藏頁面 + 離開頁面時）
- 存檔內容包括：資源、升級、引擎快照、模式、語言
- 儲存位置：瀏覽器 `localStorage`

## 🖥️ UI Guide / 介面導覽

### Top HUD（摘要欄）

- 👥 蟻群數 / 人口上限
- 🍗 食物總量
- ❤️ 巢穴耐久（戰役模式）
- ⏱️ 下一波倒數（戰役模式）
- `SHOW MENU / HIDE MENU` 按鈕可折疊右側面板

### Right Overlay（右側功能面板）

- `Upgrades`：經濟與基礎成長升級
- `Soldier Upgrades`：戰鬥兵種強化
- `Battle Planner`：編組與部署

### Settings（設定）

- 語言切換：繁體中文 / English
- 模式切換：Battle / Idle
- 重置進度

## 🧱 Design Principles / 設計理念

- **Readable Simulation**：讓玩家看得懂每次成長的來源
- **Low-friction Idle**：不強迫高頻操作，重視中長期成長曲線
- **Mode Flexibility**：同一存檔可在「輕鬆經營」與「戰術防守」間切換
- **Progress Clarity**：每條升級都要有可感知效果

## 🛠️ Tech Stack / 技術棧

- Frontend: `React` + `TypeScript` + `Vite` + `HTML5 Canvas`
- State: `Zustand`
- Backend (optional/local): `Node.js` + `Express` + `TypeScript`

## 📁 Project Structure / 專案結構

```text
src/
	game/
		combat/          # 兵種、戰鬥平衡、編隊邏輯
		engine/          # 遊戲主引擎與世界更新
		entities/        # 工蟻、敵蟻、食物、巢穴等實體
	state/             # 全域狀態與持久化
	ui/                # 升級面板、戰鬥規劃面板
	App.tsx            # 應用外殼與設定
	main.tsx           # 入口

server/
	src/               # 本地後端與離線進度計算
```

## 🚀 Run Locally / 本地啟動

### 1) Install

```bash
npm install
```

> PowerShell on Windows may block `npm.ps1` by execution policy.
> If so, use `npm.cmd` instead:

```bash
npm.cmd install
```

### 2) Start dev client + server

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

## 🌐 Deployment Notes / 部署說明

### GitHub Pages

- This project can run on GitHub Pages as a **frontend-only** game.
- Vite `base` is configured for repo path deployment.
- Deployment uses GitHub Actions workflow to publish `dist`.

### Important limitation

- GitHub Pages does **not** run Node.js backend.
- Features requiring server endpoints must be hosted separately.

## 🧪 Useful Scripts

- `npm run dev` - start frontend + backend in watch mode
- `npm run build` - type-check server config and build frontend
- `npm run preview` - preview production frontend output
- `npm run typecheck` - run TypeScript checks

## 🧭 Suggested Player Strategy

1. 先投資 `queenSpawnRate` + `carryCapacity` 建立資源曲線
2. 中期補足 `populationCapacity` 與 `foodCapacity`
3. 進戰役前先強化巢穴（`nestRecovery`, `nestMaxHealth`）
4. 戰鬥兵種按需求混編：盾兵扛線、突擊兵輸出、酸液兵打遠程

## 🤝 Contribution

Issues and PRs are welcome.

- Report bugs with reproduction steps
- Include screenshots or short clips for UI issues
- Keep commits focused and descriptive

## 📜 License

See [LICENSE](LICENSE).