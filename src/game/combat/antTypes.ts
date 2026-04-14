export enum AntRole {
  WORKER = 'WORKER',
  GUARDIAN = 'GUARDIAN',
  RAIDER = 'RAIDER',
  SPITTER = 'SPITTER',
}

export enum SquadMode {
  DEFEND = 'DEFEND',
  ASSAULT = 'ASSAULT',
}

/** 基本戰鬥屬性（用於計算衍生屬性） */
export interface CombatStats {
  hp: number;
  damage: number;
  attackRange: number;
  attackCooldownSeconds: number;
  speed: number; // 遊戲單位／秒
  cost: number; // 食物成本
  popCost: number; // 人口上限消耗
}

/** 兵種樣板，包含基礎值與成長係數 */
export interface AntTemplate {
  role: AntRole;
  base: CombatStats;
  hpScale: number;
  damageScale: number;
  speedScale: number;
  costGrowth: number;
}

/** 小隊組成（按兵種計數） */
export interface Squad {
  id: string;
  composition: Partial<Record<AntRole, number>>;
  mode: SquadMode;
  targetId?: string; // 進攻目標（可填 enemy nest id）
  rally?: { x: number; y: number };
}

export type SpawnPlayerAntFn = (role: AntRole) => void;
