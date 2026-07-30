import { useEffect, useState } from 'react';
import { supabase } from './supabase';

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export interface DailyLogEntry {
  assetCode: string;
  assetType: string | null;
  completedToday: string;
  plannedTomorrow: string;
}

export function useDailyLogEntries(projectId: string | undefined) {
  const [entries, setEntries] = useState<DailyLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    setLoading(true);

    supabase
      .from('asset_daily_log')
      .select('completed_today, planned_tomorrow, asset:assets!inner(asset_code, asset_type, project_id)')
      .eq('asset.project_id', projectId)
      .eq('log_date', todayIso())
      .then(({ data, error }) => {
        if (cancelled) return;
        if (!error && data) {
          setEntries(
            data.map((row) => {
              const asset = Array.isArray(row.asset) ? row.asset[0] : row.asset;
              return {
                assetCode: asset.asset_code,
                assetType: asset.asset_type,
                completedToday: row.completed_today ?? '',
                plannedTomorrow: row.planned_tomorrow ?? '',
              };
            }),
          );
        }
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  return { entries, loading };
}
