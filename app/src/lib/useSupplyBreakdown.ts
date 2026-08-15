import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';
import type { WorkItemConfig } from './useProjectConfig';

export type SupplyStatus = 'not_started' | 'manufactured' | 'delivered';

/** Manufactured = 2/3 of an item's weight, Delivered = the remaining 1/3 (3/3 total). */
export const SUPPLY_STATUS_PERCENT: Record<SupplyStatus, number> = {
  not_started: 0,
  manufactured: (2 / 3) * 100,
  delivered: 100,
};

export interface SupplyItemBreakdown {
  key: string;
  label: string;
  weight: number;
  status: SupplyStatus;
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
      supabase.from('project_work_items').select('work_item_key, status').eq('project_id', projectId).eq('category', 'supply'),
    ]).then(([configRes, progressRes]) => {
      const config = (configRes.data?.value as WorkItemConfig[] | undefined) ?? [];
      const statusByKey: Record<string, SupplyStatus> = {};
      for (const row of progressRes.data ?? []) {
        statusByKey[row.work_item_key] = row.status as SupplyStatus;
      }

      const breakdown: SupplyItemBreakdown[] = config.map((item) => {
        const status = statusByKey[item.key] ?? 'not_started';
        return { key: item.key, label: item.label, weight: item.weight, status, percentComplete: SUPPLY_STATUS_PERCENT[status] };
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
