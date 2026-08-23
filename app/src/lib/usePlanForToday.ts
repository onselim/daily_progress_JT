import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';
import type { WorkItemConfig } from './useProjectConfig';

export interface PlanForTodayEntry {
  assetId: string;
  assetCode: string;
  workItemKey: string | null;
  kind: 'completed' | 'ongoing';
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * "Completed today" = work items whose completed_at date is today.
 * "Ongoing" = activities planned for today (yesterday's "Plan for Tomorrow" entry, whose
 * planned_date is now today) that haven't been marked completed today yet -- consistent
 * with `useActiveAssetIds`'s definition of "Active" (today's completions + tomorrow's
 * plan), rather than the old `assets.status` flag, which was set once (often at import)
 * and never revisited.
 */
export function usePlanForToday(projectId: string | undefined, workItems: WorkItemConfig[]) {
  const [entries, setEntries] = useState<PlanForTodayEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);

    const today = todayIso();
    const [completedResult, plannedTodayResult] = await Promise.all([
      supabase
        .from('asset_work_items')
        .select('work_item_key, asset:assets!inner(id, asset_code, project_id)')
        .eq('asset.project_id', projectId)
        .eq('status', 'completed')
        .gte('completed_at', `${today}T00:00:00`)
        .lt('completed_at', `${today}T23:59:59`),
      supabase
        .from('planned_activities')
        .select('work_item_key, asset:assets!inner(id, asset_code, project_id)')
        .eq('asset.project_id', projectId)
        .eq('planned_date', today),
    ]);

    const next: PlanForTodayEntry[] = [];
    const completedKeys = new Set<string>();
    if (!completedResult.error && completedResult.data) {
      for (const row of completedResult.data) {
        const asset = row.asset as unknown as { id: string; asset_code: string };
        completedKeys.add(`${asset.id}:${row.work_item_key}`);
        next.push({
          assetId: asset.id,
          assetCode: asset.asset_code,
          workItemKey: row.work_item_key,
          kind: 'completed',
        });
      }
    }

    if (!plannedTodayResult.error && plannedTodayResult.data) {
      for (const row of plannedTodayResult.data) {
        const asset = row.asset as unknown as { id: string; asset_code: string };
        if (completedKeys.has(`${asset.id}:${row.work_item_key}`)) continue;
        next.push({ assetId: asset.id, assetCode: asset.asset_code, workItemKey: row.work_item_key, kind: 'ongoing' });
      }
    }

    next.sort((a, b) => a.assetCode.localeCompare(b.assetCode, undefined, { numeric: true }));
    setEntries(next);
    setLoading(false);
  }, [projectId, workItems]);

  useEffect(() => {
    if (!projectId) return;
    refresh();
  }, [projectId, refresh]);

  return { entries, loading, refresh };
}
