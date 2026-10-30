import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from './supabase';
import type { WorkItemConfig } from './useProjectConfig';

const MANUFACTURED_SHARE = 2 / 3;
const DELIVERED_SHARE = 1 / 3;

export interface SupplyItemBreakdown {
  key: string;
  label: string;
  weight: number;
  manufacturedPercent: number;
  deliveredPercent: number;
  percentComplete: number;
}

export interface SupplyOverride {
  mfg: number;
  del: number;
}

/** `overrides` replaces the manually typed manufactured / delivered percentages of an item with percentages computed elsewhere
 * (e.g. from the per-tower material status); those items are reported in `computedKeys`. */
export function useSupplyBreakdown(projectId: string | undefined, overrides?: Record<string, SupplyOverride>) {
  const [config, setConfig] = useState<WorkItemConfig[]>([]);
  const [percentByKey, setPercentByKey] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    if (!projectId) return;
    setLoading(true);

    return Promise.all([
      supabase.from('project_config').select('value').eq('project_id', projectId).eq('key', 'supply_items').maybeSingle(),
      supabase.from('project_work_items').select('work_item_key, percent_complete').eq('project_id', projectId).eq('category', 'supply'),
    ]).then(([configRes, progressRes]) => {
      const next: Record<string, number> = {};
      for (const row of progressRes.data ?? []) {
        next[row.work_item_key] = Number(row.percent_complete);
      }
      setConfig((configRes.data?.value as WorkItemConfig[] | undefined) ?? []);
      setPercentByKey(next);
      setLoading(false);
    });
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return;
    refresh();
  }, [projectId, refresh]);

  const { items, overallPercent, computedKeys } = useMemo(() => {
    const computed: string[] = [];
    const breakdown: SupplyItemBreakdown[] = config.map((item) => {
      const o = overrides?.[item.key];
      if (o) computed.push(item.key);
      const manufacturedPercent = o ? o.mfg : percentByKey[`${item.key}__mfg`] ?? 0;
      const deliveredPercent = o ? o.del : percentByKey[`${item.key}__del`] ?? 0;
      const percentComplete = manufacturedPercent * MANUFACTURED_SHARE + deliveredPercent * DELIVERED_SHARE;
      return { key: item.key, label: item.label, weight: item.weight, manufacturedPercent, deliveredPercent, percentComplete };
    });
    const totalWeight = config.reduce((sum, item) => sum + item.weight, 0);
    const overall =
      totalWeight > 0 ? (breakdown.reduce((sum, item) => sum + (item.percentComplete / 100) * item.weight, 0) / totalWeight) * 100 : 0;
    return { items: breakdown, overallPercent: overall, computedKeys: computed };
  }, [config, percentByKey, overrides]);

  return { items, overallPercent, loading, refresh, computedKeys };
}
