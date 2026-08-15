import { useCallback, useEffect, useState } from 'react';
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

export function useSupplyBreakdown(projectId: string | undefined) {
  const [items, setItems] = useState<SupplyItemBreakdown[]>([]);
  const [overallPercent, setOverallPercent] = useState(0);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    if (!projectId) return;
    setLoading(true);

    return Promise.all([
      supabase.from('project_config').select('value').eq('project_id', projectId).eq('key', 'supply_items').maybeSingle(),
      supabase.from('project_work_items').select('work_item_key, percent_complete').eq('project_id', projectId).eq('category', 'supply'),
    ]).then(([configRes, progressRes]) => {
      const config = (configRes.data?.value as WorkItemConfig[] | undefined) ?? [];
      const percentByKey: Record<string, number> = {};
      for (const row of progressRes.data ?? []) {
        percentByKey[row.work_item_key] = Number(row.percent_complete);
      }

      const breakdown: SupplyItemBreakdown[] = config.map((item) => {
        const manufacturedPercent = percentByKey[`${item.key}__mfg`] ?? 0;
        const deliveredPercent = percentByKey[`${item.key}__del`] ?? 0;
        const percentComplete = manufacturedPercent * MANUFACTURED_SHARE + deliveredPercent * DELIVERED_SHARE;
        return { key: item.key, label: item.label, weight: item.weight, manufacturedPercent, deliveredPercent, percentComplete };
      });

      const totalWeight = config.reduce((sum, item) => sum + item.weight, 0);
      const overall =
        totalWeight > 0
          ? (breakdown.reduce((sum, item) => sum + (item.percentComplete / 100) * item.weight, 0) / totalWeight) * 100
          : 0;

      setItems(breakdown);
      setOverallPercent(overall);
      setLoading(false);
    });
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    refresh()?.then(() => {
      if (cancelled) return;
    });
    return () => {
      cancelled = true;
    };
  }, [projectId, refresh]);

  return { items, overallPercent, loading, refresh };
}
