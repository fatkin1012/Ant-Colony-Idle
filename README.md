# Ant Colony Idle / 蟻巢模擬

> A web-based idle game about building and managing an ant colony.
>
> 一款以建造和管理蟻巢為主題的網頁放置遊戲。

## English

### Overview

Ant Colony Idle is a browser-based idle game where ants wander around a dirt arena, search for food, and bring it back to the nest. You can grow the colony over time by collecting food and investing in upgrades.

### How to Play

1. Open the game in your browser.
2. Watch the ants move around the arena automatically.
3. Ants in `SEARCHING` state wander until they touch a food block.
4. When an ant finds food, it switches to `FOUND` and returns directly to the nest.
5. Once the ant reaches the nest, it becomes `IDLE` and stays close to the colony center.
6. Each food pickup increases your food total.
7. Spend food on upgrades in the overlay panel to improve the colony.

### Upgrades

- `Queen Spawn Rate`: reduces the time between new ant spawns.
- `Carry Capacity`: increases how much food is gained from each trip.

### Game Loop

- Search for food.
- Carry food back to the nest.
- Spend food on upgrades.
- Expand the colony over time.

### Controls

- Mouse and keyboard input are not required for core play.
- Use the upgrade panel buttons to buy upgrades.

### Run Locally

```bash
npm install
npm run dev
```

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3001`

### Tech Stack

- Frontend: Vite, React, TypeScript, HTML5 Canvas
- Backend: Node.js, Express, TypeScript
- State Management: Zustand

---

## 中文

### 概述

《Ant Colony Idle / 蟻巢模擬》是一款網頁放置遊戲。螞蟻會在泥土色的場景中自動探索、尋找食物，並把食物帶回蟻巢。你可以透過收集資源和升級來逐步壯大蟻群。

### 怎麽玩

1. 在瀏覽器中打開遊戲。
2. 觀察螞蟻在場景中自動移動。
3. 處於 `SEARCHING` 狀態的螞蟻會隨機游走，尋找食物方塊。
4. 當螞蟻碰到食物後，會切換成 `FOUND` 狀態，並直接返回蟻巢。
5. 回到蟻巢後，螞蟻會變成 `IDLE` 狀態，並在巢附近活動。
6. 每次拾取食物都會增加你的食物總量。
7. 在右側升級面板中花費食物購買升級，讓蟻群成長更快。

### 升級系統

- `Queen Spawn Rate`：降低新螞蟻生成的間隔。
- `Carry Capacity`：提高每次搬運能獲得的食物量。

### 核心循環

- 找食物。
- 把食物帶回巢。
- 用食物升級。
- 讓蟻群逐漸變大。

### 操作方式

- 核心玩法不需要鍵盤或滑鼠操作。
- 主要互動是右側的升級按鈕。

### 本地運行

```bash
npm install
npm run dev
```

- 前端：`http://localhost:5173`
- 後端：`http://localhost:3001`

### 技術棧

- 前端：Vite、React、TypeScript、HTML5 Canvas
- 後端：Node.js、Express、TypeScript
- 狀態管理：Zustand