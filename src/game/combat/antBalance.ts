import { AntRole, CombatStats } from './antTypes';
import { ANT_TEMPLATES } from '../antTuning';

export { ANT_TEMPLATES };

export function computeStats(role: AntRole, level = 1): CombatStats {
  const t = ANT_TEMPLATES[role];
  const growth = Math.max(1, Math.floor(level));

  return {
    hp: Math.max(1, Math.round(t.base.hp * Math.pow(t.hpScale, growth - 1))),
    damage: Math.max(0, Math.round(t.base.damage * Math.pow(t.damageScale, growth - 1))),
    attackRange: t.base.attackRange,
    attackCooldownSeconds: t.base.attackCooldownSeconds,
    speed: Math.max(1, Math.round(t.base.speed * Math.pow(t.speedScale, growth - 1))),
    cost: Math.max(1, Math.round(t.base.cost * Math.pow(t.costGrowth, growth - 1))),
    popCost: t.base.popCost,
  };
}

export function computeCompositionCost(
  composition: Partial<Record<AntRole, number>>,
  levelMap?: Partial<Record<AntRole, number>>,
): number {
  let total = 0;

  for (const key of Object.keys(composition) as AntRole[]) {
    const count = composition[key] ?? 0;
    if (count <= 0) continue;
    const lvl = levelMap?.[key] ?? 1;
    const stats = computeStats(key, lvl);
    total += stats.cost * count;
  }

  return total;
}

export function computeCompositionPopulationCost(composition: Partial<Record<AntRole, number>>): number {
  let pop = 0;

  for (const key of Object.keys(composition) as AntRole[]) {
    const count = composition[key] ?? 0;
    if (count <= 0) continue;
    pop += (ANT_TEMPLATES[key].base.popCost || 1) * count;
  }

  return pop;
}

/** 簡易推薦組合（以 budget 食物為基礎） */
export function recommendCompositionByBudget(budget: number) {
  // heuristic: 50% 對等火力（RAIDER）、30% 後排（SPITTER）、20% 盾（GUARDIAN）
  const r = Math.max(0, Math.floor((budget * 0.5) / ANT_TEMPLATES[AntRole.RAIDER].base.cost));
  const s = Math.max(0, Math.floor((budget * 0.3) / ANT_TEMPLATES[AntRole.SPITTER].base.cost));
  const g = Math.max(0, Math.floor((budget * 0.2) / ANT_TEMPLATES[AntRole.GUARDIAN].base.cost));

  return {
    [AntRole.RAIDER]: r,
    [AntRole.SPITTER]: s,
    [AntRole.GUARDIAN]: g,
  } as Partial<Record<AntRole, number>>;
}
