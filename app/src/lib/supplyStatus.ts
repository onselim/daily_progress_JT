import { getTowerWeightForAsset, parseTowerType, type TowerWeightConfig } from './useTowerWeightsConfig';

/** Where a tower's steel (or its stub set) is in the supply chain. 'erected' is not stored: it follows the Construction item er_te. */
export type SupplyStage = 'not_ordered' | 'ordered' | 'manufacturing' | 'manufactured' | 'shipped' | 'delivered';
export type SupplyComponent = 'tower' | 'stub' | 'leg1' | 'leg2' | 'leg3' | 'leg4';
/** Leg extensions A..D of a tower; they are made and shipped separately from the tower body. They do not count in the supply %. */
export const LEG_COMPONENTS = ['leg1', 'leg2', 'leg3', 'leg4'] as const;
/** 'erected' (tower body up) and 'installed' (stub set in the foundation) are not stored: they follow the Construction items er_te / fn_ss. */
export type SupplyDisplayStage = SupplyStage | 'erected' | 'installed';

export const SUPPLY_STAGES: SupplyStage[] = ['not_ordered', 'ordered', 'manufacturing', 'manufactured', 'shipped', 'delivered'];

interface StageMeta {
  color: string;
  en: string;
  tr: string;
  /** share of the "manufactured" half of the supply % earned at this stage (0..1) */
  mfg: number;
  /** share of the "delivered" third earned at this stage (0..1) */
  del: number;
}

export const STAGE_META: Record<SupplyDisplayStage, StageMeta> = {
  not_ordered: { color: '#6b7280', en: 'Not ordered', tr: 'Sipariş yok', mfg: 0, del: 0 },
  ordered: { color: '#60a5fa', en: 'Ordered', tr: 'Sipariş verildi', mfg: 0, del: 0 },
  manufacturing: { color: '#a78bfa', en: 'In production', tr: 'Üretimde', mfg: 0.5, del: 0 },
  manufactured: { color: '#f59e0b', en: 'Manufactured', tr: 'Üretildi', mfg: 1, del: 0 },
  shipped: { color: '#fb923c', en: 'Shipped', tr: 'Sevk edildi (yolda)', mfg: 1, del: 0 },
  delivered: { color: '#22c55e', en: 'At site', tr: 'Sahada', mfg: 1, del: 1 },
  erected: { color: '#14b8a6', en: 'Erected', tr: 'Montajlandı', mfg: 1, del: 1 },
  installed: { color: '#14b8a6', en: 'Installed', tr: 'Temele yerleştirildi', mfg: 1, del: 1 },
};

export function stageLabel(stage: SupplyDisplayStage, lang: string): string {
  return lang === 'tr' ? STAGE_META[stage].tr : STAGE_META[stage].en;
}

export type SupplyByAsset = Record<string, Partial<Record<SupplyComponent, SupplyStage>>>;

export interface SupplyAssetInput {
  id: string;
  asset_type: string | null;
}

export interface ComponentTotals {
  mfgPercent: number;
  delPercent: number;
  /** towers (or stub sets) per stage */
  counts: Record<SupplyStage, number>;
  total: number;
  /** towers with a stage other than "not ordered" -- 0 means nobody entered anything yet */
  tracked: number;
}

const MFG_SHARE = 2 / 3;
const DEL_SHARE = 1 / 3;

/** Weight (kg) of one tower's steel or stub set; falls back to the average of the known ones so an unrecognised type still counts. */
export function componentWeightKg(asset: SupplyAssetInput, component: SupplyComponent, weights: TowerWeightConfig[], fallback: number): number {
  if (component === 'tower') return getTowerWeightForAsset(asset.asset_type, weights) ?? fallback;
  const parsed = parseTowerType(asset.asset_type);
  const cfg = parsed ? weights.find((w) => w.type === parsed.type) : null;
  return cfg?.stubWeightKg ?? fallback;
}

export function supplyFromAssets(
  assets: SupplyAssetInput[],
  weights: TowerWeightConfig[],
  statuses: SupplyByAsset,
  component: SupplyComponent,
): ComponentTotals {
  const known: number[] = [];
  for (const a of assets) {
    const w = component === 'tower' ? getTowerWeightForAsset(a.asset_type, weights) : (() => {
      const p = parseTowerType(a.asset_type);
      return p ? weights.find((x) => x.type === p.type)?.stubWeightKg ?? null : null;
    })();
    if (w != null) known.push(w);
  }
  const avg = known.length ? known.reduce((s, x) => s + x, 0) / known.length : 1;
  const counts = Object.fromEntries(SUPPLY_STAGES.map((s) => [s, 0])) as Record<SupplyStage, number>;
  let totalW = 0;
  let mfgW = 0;
  let delW = 0;
  let total = 0;
  for (const a of assets) {
    if (parseTowerType(a.asset_type) == null) continue; // gantries and other structures that are not supplied as a tower
    total += 1;
    const w = componentWeightKg(a, component, weights, avg);
    const stage = statuses[a.id]?.[component] ?? 'not_ordered';
    counts[stage] += 1;
    totalW += w;
    mfgW += w * STAGE_META[stage].mfg;
    delW += w * STAGE_META[stage].del;
  }
  const tracked = total - counts.not_ordered;
  return {
    mfgPercent: totalW > 0 ? (mfgW / totalW) * 100 : 0,
    delPercent: totalW > 0 ? (delW / totalW) * 100 : 0,
    counts,
    total,
    tracked,
  };
}

/** Supply % of one item from its manufactured / delivered percentages (same split the report uses everywhere). */
export function itemSupplyPercent(mfgPercent: number, delPercent: number): number {
  return mfgPercent * MFG_SHARE + delPercent * DEL_SHARE;
}

export interface TypeRow {
  /** e.g. "B30+3" */
  type: string;
  assetIds: string[];
  counts: Record<SupplyStage, number>;
}

/** Groups towers by their full type (body + extension) and counts the stage of one component. */
export function groupByType(assets: SupplyAssetInput[], statuses: SupplyByAsset, component: SupplyComponent): TypeRow[] {
  const map = new Map<string, TypeRow>();
  for (const a of assets) {
    const type = (a.asset_type ?? '?').replace(/\s*\(.*\)$/, '');
    let row = map.get(type);
    if (!row) {
      row = { type, assetIds: [], counts: Object.fromEntries(SUPPLY_STAGES.map((s) => [s, 0])) as Record<SupplyStage, number> };
      map.set(type, row);
    }
    row.assetIds.push(a.id);
    row.counts[statuses[a.id]?.[component] ?? 'not_ordered'] += 1;
  }
  return [...map.values()].sort((a, b) => a.type.localeCompare(b.type, undefined, { numeric: true }));
}

const MADE: SupplyStage[] = ['manufactured', 'shipped', 'delivered'];

/** How many of a tower's four leg extensions are made, and which ones are still missing (1..4). */
export function legsSummary(status: SupplyByAsset[string] | undefined): { made: number; missing: number[]; stages: (SupplyStage | undefined)[] } {
  const stages = LEG_COMPONENTS.map((c) => status?.[c]);
  const missing: number[] = [];
  stages.forEach((st, i) => {
    if (!st || !MADE.includes(st)) missing.push(i + 1);
  });
  return { made: 4 - missing.length, missing, stages };
}
