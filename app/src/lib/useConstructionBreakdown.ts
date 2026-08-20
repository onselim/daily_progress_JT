import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import type { WorkItemConfig } from './useProjectConfig';

export interface WorkItemBreakdown {
  key: string;
  label: string;
  weight: number;
  percentComplete: number;
}

const PAGE_SIZE = 1000;

// PostgREST caps a single request at 1000 rows -- a project with ~200 towers x ~16
// work items can have well over 1000 completed rows once real progress accumulates, so
// a plain .select() here would silently undercount completedByKey (and this feeds the
// prominent topbar Construction% figure). Page through with .range() until a short
// page confirms the end, same fix as useProjectWorkItemsProgress.
async function fetchAllCompletedKeys(projectId: string): Promise<string[]> {
  const keys: string[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from('asset_work_items')
      .select('work_item_key, asset:assets!inner(project_id)')
      .eq('asset.project_id', projectId)
      .eq('percent_complete', 100)
      .range(from, from + PAGE_SIZE - 1);
    if (error || !data) break;
    keys.push(...data.map((row) => row.work_item_key));
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return keys;
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
      .then(async ({ count: totalAssets }) => {
        if (cancelled) return;

        const completedKeys = await fetchAllCompletedKeys(projectId);
        if (cancelled) return;
        const total = totalAssets ?? 0;

        const completedByKey: Record<string, number> = {};
        for (const key of completedKeys) {
          completedByKey[key] = (completedByKey[key] ?? 0) + 1;
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
            ? (breakdown.reduce((sum, item) => sum + (item.percentComplete / 100) * item.weight, 0) / totalWeight) *
              100
            : 0;

        setItems(breakdown);
        setOverallPercent(overall);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [projectId, workItems]);

  return { items, overallPercent, loading };
}
