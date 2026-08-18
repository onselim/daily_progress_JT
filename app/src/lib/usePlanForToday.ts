import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';

export interface PlanForTodayEntry {
  assetId: string;
  assetCode: string;
  workItemKey: string;
  kind: 'completed' | 'ongoing';
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

/** "Completed today" = work items whose completed_at date is today. "Ongoing" = any
 * work item currently in_progress, regardless of when it started — there's no separate
 * "started_at" field, so this is every tower with active work right now. */
export function usePlanForToday(projectId: string | undefined) {
  const [entries, setEntries] = useState<PlanForTodayEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);

    const today = todayIso();
    const { data, error } = await supabase
      .from('asset_work_items')
      .select('work_item_key, status, completed_at, asset:assets!inner(id, asset_code, project_id)')
      .eq('asset.project_id', projectId)
      .or(`status.eq.in_progress,and(status.eq.completed,completed_at.gte.${today}T00:00:00,completed_at.lt.${today}T23:59:59)`);

    if (!error && data) {
      const next: PlanForTodayEntry[] = data.map((row) => ({
        assetId: (row.asset as unknown as { id: string }).id,
        assetCode: (row.asset as unknown as { asset_code: string }).asset_code,
        workItemKey: row.work_item_key,
        kind: row.status === 'completed' ? 'completed' : 'ongoing',
      }));
      next.sort((a, b) => a.assetCode.localeCompare(b.assetCode, undefined, { numeric: true }));
      setEntries(next);
    }
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return;
    refresh();
  }, [projectId, refresh]);

  return { entries, loading, refresh };
}
