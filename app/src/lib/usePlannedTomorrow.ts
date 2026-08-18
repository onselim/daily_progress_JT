import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';

export interface PlannedActivity {
  id: string;
  assetId: string;
  assetCode: string;
  workItemKey: string;
}

function tomorrowIso() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function usePlannedTomorrow(projectId: string | undefined) {
  const [entries, setEntries] = useState<PlannedActivity[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);

    const { data, error } = await supabase
      .from('planned_activities')
      .select('id, work_item_key, asset:assets!inner(id, asset_code, project_id)')
      .eq('asset.project_id', projectId)
      .eq('planned_date', tomorrowIso());

    if (!error && data) {
      const next: PlannedActivity[] = data.map((row) => ({
        id: row.id,
        assetId: (row.asset as unknown as { id: string }).id,
        assetCode: (row.asset as unknown as { asset_code: string }).asset_code,
        workItemKey: row.work_item_key,
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

export async function addPlannedActivity(assetId: string, workItemKey: string, createdBy: string) {
  const { error } = await supabase.from('planned_activities').insert({
    asset_id: assetId,
    work_item_key: workItemKey,
    planned_date: tomorrowIso(),
    created_by: createdBy,
  });
  if (error) throw error;
}

export async function removePlannedActivity(id: string) {
  const { error } = await supabase.from('planned_activities').delete().eq('id', id);
  if (error) throw error;
}
