import { useMemo } from 'react';
import { useAssets } from './useAssets';
import { useAssetSupply } from './useAssetSupply';
import { useTowerWeightsConfig } from './useTowerWeightsConfig';
import { supplyFromAssets, type ComponentTotals } from './supplyStatus';
import type { SupplyOverride } from './useSupplyBreakdown';

/** Supply-item keys of the default template that are driven by the per-tower material status. */
export const TOWER_SUPPLY_KEYS = { tower: 'towers', stub: 'stubs' } as const;

/** Per-tower material status turned into supply percentages. An item is only overridden once at least one tower has a status
 * other than "not ordered" -- until then the manually typed percentages keep working as before. */
export function useSupplyFromTowers(projectId: string | undefined) {
  const { assets, loading: assetsLoading } = useAssets(projectId);
  const { towerWeights, loading: weightsLoading } = useTowerWeightsConfig(projectId);
  const { statuses, loading: statusLoading, refresh } = useAssetSupply(projectId);

  const { overrides, towers, stubs } = useMemo(() => {
    const towers = supplyFromAssets(assets, towerWeights, statuses, 'tower');
    const stubs = supplyFromAssets(assets, towerWeights, statuses, 'stub');
    const overrides: Record<string, SupplyOverride> = {};
    if (towers.tracked > 0) overrides[TOWER_SUPPLY_KEYS.tower] = { mfg: towers.mfgPercent, del: towers.delPercent };
    if (stubs.tracked > 0) overrides[TOWER_SUPPLY_KEYS.stub] = { mfg: stubs.mfgPercent, del: stubs.delPercent };
    return { overrides, towers, stubs };
  }, [assets, towerWeights, statuses]);

  return {
    assets,
    statuses,
    overrides,
    towers: towers as ComponentTotals,
    stubs: stubs as ComponentTotals,
    loading: assetsLoading || weightsLoading || statusLoading,
    refresh,
  };
}
