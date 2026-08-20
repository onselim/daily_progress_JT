import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';
import type { WorkItemConfig } from './useProjectConfig';

interface WorkItemRow {
  asset_id: string;
  work_item_key: string;
  percent_complete: number;
}

const PAGE_SIZE = 1000;

// PostgREST caps a single request at 1000 rows by default. A project with ~200 towers x
// ~16 work items each has well over 1000 asset_work_items rows, so a plain .select()
// here was silently truncated to whichever rows happened to sort first -- most towers'
// data was never fetched at all (they just fell back to the "no data" 0% default,
// while a lucky ~30% at the front of the table showed real numbers). Paging through
// with .range() until a short page confirms the end is the fix.
async function fetchAllWorkItemRows(projectId: string): Promise<WorkItemRow[]> {
  const rows: WorkItemRow[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from('asset_work_items')
      .select('asset_id, work_item_key, percent_complete, asset:assets!inner(project_id)')
      .eq('asset.project_id', projectId)
      .range(from, from + PAGE_SIZE - 1);
    if (error || !data) break;
    rows.push(...(data as unknown as WorkItemRow[]));
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return rows;
}

// Per-tower "Overall %" is weighted by each item's configured weight (same principle as
// the project-level Construction% formula in useConstructionBreakdown), not a flat
// average across every stored row. A flat average let stale asset_work_items rows for
// work_item_keys no longer in the current work_items config (e.g. renamed/removed items
// from an earlier config revision) silently inflate a tower's shown progress even when
// none of its *current* work items had actually started.
export function useProjectWorkItemsProgress(projectId: string | undefined, workItems: WorkItemConfig[]) {
  const [progressByAsset, setProgressByAsset] = useState<Record<string, number>>({});
  const [percentByAssetAndKey, setPercentByAssetAndKey] = useState<Record<string, Record<string, number>>>({});
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!projectId || workItems.length === 0) return;
    setLoading(true);

    const weightByKey: Record<string, number> = {};
    let totalWeight = 0;
    for (const item of workItems) {
      weightByKey[item.key] = item.weight;
      totalWeight += item.weight;
    }

    const rows = await fetchAllWorkItemRows(projectId);

    const weightedSums: Record<string, number> = {};
    const byAssetAndKey: Record<string, Record<string, number>> = {};
    for (const row of rows) {
      const weight = weightByKey[row.work_item_key];
      if (weight != null) {
        weightedSums[row.asset_id] = (weightedSums[row.asset_id] ?? 0) + Number(row.percent_complete) * weight;
      }

      const keyMap = byAssetAndKey[row.asset_id] ?? {};
      keyMap[row.work_item_key] = Number(row.percent_complete);
      byAssetAndKey[row.asset_id] = keyMap;
    }
    const next: Record<string, number> = {};
    for (const [assetId, weightedTotal] of Object.entries(weightedSums)) {
      next[assetId] = totalWeight > 0 ? Math.round(weightedTotal / totalWeight) : 0;
    }
    setProgressByAsset(next);
    setPercentByAssetAndKey(byAssetAndKey);
    setLoading(false);
  }, [projectId, workItems]);

  useEffect(() => {
    if (!projectId) return;
    refresh();
  }, [projectId, refresh]);

  return { progressByAsset, percentByAssetAndKey, loading, refresh };
}
