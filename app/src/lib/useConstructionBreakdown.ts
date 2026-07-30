import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import type { WorkItemConfig } from './useProjectConfig';

export interface WorkItemBreakdown {
  key: string;
  label: string;
  weight: number;
  percentComplete: number;
}

export function useConstructionBreakdown(projectId: string | undefined, workItems: WorkItemConfig[]) {
  const [items, setItems] = useState<WorkItemBreakdown[]>([]);
  const [overallPercent, setOverallPercent] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId || workItems.length === 0) return;
    let cancelled = false;
    setLoading(true);

    supabase
      .from('assets')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', projectId)
      .then(({ count: totalAssets }) => {
        if (cancelled) return;

        supabase
          .from('asset_work_items')
          .select('work_item_key, percent_complete, asset:assets!inner(project_id)')
          .eq('asset.project_id', projectId)
          .eq('percent_complete', 100)
          .then(({ data, error }) => {
            if (cancelled) return;
            const total = totalAssets ?? 0;

            const completedByKey: Record<string, number> = {};
            if (!error && data) {
              for (const row of data) {
                completedByKey[row.work_item_key] = (completedByKey[row.work_item_key] ?? 0) + 1;
              }
            }

            const breakdown: WorkItemBreakdown[] = workItems.map((item) => ({
              key: item.key,
              label: item.label,
              weight: item.weight,
              percentComplete: total > 0 ? ((completedByKey[item.key] ?? 0) / total) * 100 : 0,
            }));

            const totalWeight = workItems.reduce((sum, item) => sum + item.weight, 0);
            const overall =
              totalWeight > 0
                ? breakdown.reduce((sum, item) => sum + (item.percentComplete / 100) * item.weight, 0) /
                  totalWeight *
                  100
                : 0;

            setItems(breakdown);
            setOverallPercent(overall);
            setLoading(false);
          });
      });

    return () => {
      cancelled = true;
    };
  }, [projectId, workItems]);

  return { items, overallPercent, loading };
}
