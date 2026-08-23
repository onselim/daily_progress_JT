import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function tomorrowIso() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** A tower is "Active" only if work happened there today (a work item's completed_at
 * falls today) or work is planned there tomorrow (a planned_activities row for
 * tomorrow) -- not a manually-set flag, which drifts stale within days and can't tell
 * "still being worked" apart from "was worked on once, weeks ago". */
export function useActiveAssetIds(projectId: string | undefined) {
  const [activeAssetIds, setActiveAssetIds] = useState<Set<string>>(new Set());

  const refresh = useCallback(() => {
    if (!projectId) return;
    const today = todayIso();
    return Promise.all([
      supabase
        .from('asset_work_items')
        .select('asset_id, asset:assets!inner(project_id)')
        .eq('asset.project_id', projectId)
        .gte('completed_at', `${today}T00:00:00`)
        .lt('completed_at', `${today}T23:59:59`),
      supabase
        .from('planned_activities')
        .select('asset_id, asset:assets!inner(project_id)')
        .eq('asset.project_id', projectId)
        .eq('planned_date', tomorrowIso()),
    ]).then(([completedToday, plannedTomorrow]) => {
      const next = new Set<string>();
      for (const r of completedToday.data ?? []) next.add(r.asset_id);
      for (const r of plannedTomorrow.data ?? []) next.add(r.asset_id);
      setActiveAssetIds(next);
    });
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return;
    refresh();
  }, [projectId, refresh]);

  return { activeAssetIds, refresh };
}
