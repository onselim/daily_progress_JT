import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';
import type { WorkItemConfig } from './useProjectConfig';

export interface DesignItemBreakdown {
  key: string;
  label: string;
  weight: number;
  percentComplete: number;
}

export function useDesignBreakdown(projectId: string | undefined) {
  const [items, setItems] = useState<DesignItemBreakdown[]>([]);
  const [overallPercent, setOverallPercent] = useState(0);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    if (!projectId) return;
    setLoading(true);

    return Promise.all([
      supabase.from('project_config').select('value').eq('project_id', projectId).eq('key', 'design_items').maybeSingle(),
      supabase.from('project_work_items').select('work_item_key, percent_complete').eq('project_id', projectId).eq('category', 'design'),
    ]).then(([configRes, progressRes]) => {
      const config = (configRes.data?.value as WorkItemConfig[] | undefined) ?? [];
      const percentByKey: Record<string, number> = {};
      for (const row of progressRes.data ?? []) {
        percentByKey[row.work_item_key] = Number(row.percent_complete);
      }

      const breakdown: DesignItemBreakdown[] = config.map((item) => ({
        key: item.key,
        label: item.label,
        weight: item.weight,
        percentComplete: percentByKey[item.key] ?? 0,
      }));

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
