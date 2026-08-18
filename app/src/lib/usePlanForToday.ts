import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';

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
 * "Ongoing" = towers currently marked Active (assets.status = 'in_progress') — the same
 * signal the sidebar/map "Active" badge and stat pill already use elsewhere in the app.
 * (asset_work_items.status practically never reaches 'in_progress' in real field data —
 * items go straight from not_started to completed — so deriving "ongoing" from per-item
 * status would always read empty; the asset-level flag is the one that's actually kept
 * up to date.)
 */
export function usePlanForToday(projectId: string | undefined) {
  const [entries, setEntries] = useState<PlanForTodayEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);

    const today = todayIso();
    const [completedResult, ongoingResult] = await Promise.all([
      supabase
        .from('asset_work_items')
        .select('work_item_key, asset:assets!inner(id, asset_code, project_id)')
        .eq('asset.project_id', projectId)
        .eq('status', 'completed')
        .gte('completed_at', `${today}T00:00:00`)
        .lt('completed_at', `${today}T23:59:59`),
      supabase.from('assets').select('id, asset_code').eq('project_id', projectId).eq('status', 'in_progress'),
    ]);

    const next: PlanForTodayEntry[] = [];
    if (!completedResult.error && completedResult.data) {
      for (const row of completedResult.data) {
        next.push({
          assetId: (row.asset as unknown as { id: string }).id,
          assetCode: (row.asset as unknown as { asset_code: string }).asset_code,
          workItemKey: row.work_item_key,
          kind: 'completed',
        });
      }
    }
    if (!ongoingResult.error && ongoingResult.data) {
      for (const row of ongoingResult.data) {
        next.push({ assetId: row.id, assetCode: row.asset_code, workItemKey: null, kind: 'ongoing' });
      }
    }
    next.sort((a, b) => a.assetCode.localeCompare(b.assetCode, undefined, { numeric: true }));
    setEntries(next);
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return;
    refresh();
  }, [projectId, refresh]);

  return { entries, loading, refresh };
}
