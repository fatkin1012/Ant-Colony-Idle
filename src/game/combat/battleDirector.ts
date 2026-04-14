import { AntRole, Squad, SquadMode, SpawnPlayerAntFn } from './antTypes';
import { computeCompositionCost, computeCompositionPopulationCost, recommendCompositionByBudget } from './antBalance';

export interface BattleDirectorOptions {
  spawnPlayerAnt: SpawnPlayerAntFn; // 呼叫外部 API 真正生成單位
  getFood: () => number;
  spendFood: (amount: number) => boolean;
  getFreePopulation: () => number; // 可用人口
}

export class BattleDirector {
  private readonly options: BattleDirectorOptions;
  private readonly squads = new Map<string, Squad>();

  constructor(options: BattleDirectorOptions) {
    this.options = options;
  }

  createSquad(composition: Partial<Record<AntRole, number>>, mode: SquadMode = SquadMode.DEFEND, rally?: { x: number; y: number }) {
    const id = `squad-${Date.now().toString(36)}-${Math.floor(Math.random() * 10000)}`;

    const squad: Squad = {
      id,
      composition,
      mode,
      rally,
    };

    this.squads.set(id, squad);
    return squad;
  }

  disbandSquad(id: string) {
    this.squads.delete(id);
  }

  listSquads() {
    return Array.from(this.squads.values());
  }

  computeSquadCost(squad: Squad) {
    return computeCompositionCost(squad.composition);
  }

  computeSquadPopulation(squad: Squad) {
    return computeCompositionPopulationCost(squad.composition);
  }

  canAffordAndHasPop(squad: Squad) {
    const cost = this.computeSquadCost(squad);
    const pop = this.computeSquadPopulation(squad);

    if (this.options.getFood() < cost) return false;
    if (this.options.getFreePopulation() < pop) return false;

    return true;
  }

  /**
   * 實際生出隊伍：會嘗試一次性扣資源，然後呼叫 spawn callback
   * 回傳是否成功（資源/人口充足）。
   */
  spawnSquad(id: string) {
    const squad = this.squads.get(id);
    if (!squad) return false;

    const cost = this.computeSquadCost(squad);
    const pop = this.computeSquadPopulation(squad);

    if (this.options.getFood() < cost) return false;
    if (this.options.getFreePopulation() < pop) return false;

    if (!this.options.spendFood(cost)) return false;

    // 呼叫 spawn callback 逐隻生成
    for (const [roleKey, count] of Object.entries(squad.composition) as [AntRole, number][]) {
      for (let i = 0; i < (count || 0); i += 1) {
        this.options.spawnPlayerAnt(roleKey);
      }
    }

    return true;
  }

  /** 簡易建議組合（以可用資源為基礎） */
  recommendByBudget(budget: number) {
    return recommendCompositionByBudget(budget);
  }
}
