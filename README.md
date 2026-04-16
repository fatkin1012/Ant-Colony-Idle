# Ant Colony Idle / 蟻巢模擬

[🌐 中文](README.md) | [🌐 English](README.en.md)

> 一款以螞蟻生態為核心、包含「休閒掛機」與「戰役防守」雙模式的網頁放置遊戲。

## 🐜 遊戲總覽

《Ant Colony Idle》讓你從小型蟻巢開始，逐步發展成大型蟻群。螞蟻會自動探索、搬運、回巢，你的任務是規劃升級與資源分配，讓生產效率與防禦能力同步成長。

### ✨ 核心特色

- 🧠 雙模式玩法：戰役模式 + 休閒掛機模式
- 🍗 完整經濟循環：探索 -> 搬運 -> 投資 -> 擴張
- ⚔️ 戰鬥系統：敵襲波次、巢穴壓力、小隊部署
- 🧪 14 條升級線：經濟、巢穴、生存與兵種全面成長
- 💾 自動存檔：資源、模式、語言與引擎狀態皆可保存
- 🌍 內建中英雙語介面

## 🎮 遊戲模式

| 模式 | 說明 | 適合玩家 |
| --- | --- | --- |
| 戰役模式 | 敵軍波次與巢穴耐久壓力啟用，可進行兵種部署與防守。 | 喜歡戰術與壓力挑戰 |
| 休閒掛機模式 | 關閉戰鬥壓力，專注資源成長與放置體驗。 | 喜歡輕鬆經營與長線發展 |

### 模式規則

- 兩種模式共用同一份進度資料。
- 模式選擇會寫入瀏覽器本機儲存。
- 戰敗（Game Over）僅在戰役模式中有意義。

## 🔁 核心循環

1. 👀 工蟻自動探索並接觸食物
2. 📦 搬運回巢，累積食物資源
3. 🛠️ 購買升級，改善效率與容量
4. 📈 擴張人口與蟻群規模
5. ⚔️（戰役模式）守住巢穴、應對敵軍波次

## 🧩 系統詳解

### 1) 資源與經濟

- 主資源：Food（食物）
- 初始資源：500
- 主要產出：工蟻搬運、戰鬥擊殺與摧毀敵巢獎勵
- 主要消耗：升級購買、小隊部署成本

### 2) 蟻群成長

- `colonySize` 代表目前蟻群使用人口
- 人口上限受 `populationCapacity` 升級影響
- 可透過蟻后生產相關升級加速群體成長

### 3) 巢穴耐久

- 戰役模式中巢穴會持續承受敵方壓力
- 可透過 `nestRecovery` 與 `nestMaxHealth` 提升生存能力
- 巢穴耐久歸零會觸發戰役失敗流程

### 4) 戰鬥與敵襲波次

- 敵方以波次節奏施加壓力
- 引擎即時處理近戰、遠程與移動交戰
- HUD 顯示下一波倒數與巢穴狀態

### 5) 小隊編成

- 行為模式：`DEFEND`（守家）與 `ASSAULT`（出征）
- 兵種角色：
  - 🛡️ Guardian（盾兵）
  - ⚔️ Raider（突擊兵）
  - 🧪 Spitter（酸液兵）
- 部署前檢查：
  - 食物是否足夠
  - 人口是否足夠

### 6) 升級矩陣（14 條）

#### 經濟與成長

- `queenSpawnRate` 蟻后生產
- `carryCapacity` 搬運容量
- `antSpeed` 螞蟻速度
- `foodCapacity` 場上食物容量
- `forageRadius` 覓食範圍
- `populationCapacity` 人口容量

#### 巢穴生存

- `nestRecovery` 巢穴回復
- `nestMaxHealth` 巢穴生命上限

#### 兵種強化

- `soldierDamage` 兵種傷害
- `soldierHealth` 兵種血量
- `soldierSpeed` 兵種速度
- `soldierTauntRange` 嘲諷範圍
- `soldierAttackRange` 攻擊距離
- `soldierAttackCooldown` 攻速（冷卻）

### 7) 存檔與持久化

- 自動存檔觸發時機：週期儲存、頁面隱藏、離開頁面
- 儲存內容：資源、升級、引擎快照、語言、模式
- 儲存位置：瀏覽器 `localStorage`

## 🖥️ 介面導覽

### 上方摘要欄（HUD）

- 👥 蟻群數 / 人口上限
- 🍗 食物總量
- ❤️ 巢穴耐久（戰役模式）
- ⏱️ 下一波倒數（戰役模式）
- `SHOW MENU / HIDE MENU` 按鈕：折疊右側面板

### 右側功能面板

- `Upgrades`：基礎與經濟升級
- `Soldier Upgrades`：戰鬥兵種強化
- `Battle Planner`：小隊編組與部署

### 設定面板

- 語言切換：繁體中文 / English
- 模式切換：戰役 / 休閒
- 重置進度

## 🧱 設計理念

- 可讀性：玩家看得懂每次成長的來源
- 低摩擦：不強迫高頻操作，重視長線循環
- 高彈性：同一存檔可在兩種節奏間自由切換
- 明確回饋：每條升級都應有可感知提升

## 🛠️ 技術棧

- 前端：React + TypeScript + Vite + HTML5 Canvas
- 狀態管理：Zustand
- 後端（本地可選）：Node.js + Express + TypeScript

## 📁 專案結構

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

## 🚀 本地啟動

### 1) 安裝依賴

```bash
npm install
```

> 在 Windows PowerShell 可能會遇到 `npm.ps1` 執行政策限制。若遇到此情況，請改用：

```bash
npm.cmd install
```

### 2) 啟動前後端開發模式

```bash
npm run dev
```

- 前端：`http://localhost:5173`
- 後端：`http://localhost:3001`

### 3) 建置正式版本

```bash
npm run build
```

### 4) 預覽正式版輸出

```bash
npm run preview
```

## 🌐 部署說明

### GitHub Pages

- 可部署為前端版本（frontend-only）。
- Vite `base` 已設定為 repo 子路徑部署。
- 使用 GitHub Actions 流程發布 `dist`。

### 重要限制

- GitHub Pages 不支援 Node.js 後端常駐執行。
- 需要後端 API 的功能須另行部署伺服器。

## 🧪 常用指令

- `npm run dev`：啟動前後端開發模式
- `npm run build`：建置正式版本
- `npm run preview`：預覽正式版輸出
- `npm run typecheck`：執行 TypeScript 型別檢查

## 🧭 遊玩建議

1. 先升 `queenSpawnRate` 與 `carryCapacity` 建立資源曲線
2. 中期補強 `populationCapacity` 與 `foodCapacity`
3. 進入戰役前先投資 `nestRecovery` 與 `nestMaxHealth`
4. 兵種混編建議：盾兵扛線、突擊兵輸出、酸液兵遠程支援

## 🤝 貢獻方式

歡迎提交 Issue 與 PR。

- 回報問題請附重現步驟
- UI 問題建議附截圖或短影片
- Commit 訊息請保持聚焦且可讀

## 📜 授權

詳見 [LICENSE](LICENSE)。