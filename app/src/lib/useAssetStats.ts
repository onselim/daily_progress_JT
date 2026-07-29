import { useEffect, useState } from 'react';
import { supabase } from './supabase';

export interface AssetStats {
  total: number;
  notStarted: number;
  inProgress: number;
  completed: number;
  onHold: number;
}

const EMPTY_STATS: AssetStats = { total: 0, notStarted: 0, inProgress: 0, completed: 0, onHold: 0 };

export function useAssetStats(projectId: string | undefined) {
  const [stats, setStats] = useState<AssetStats>(EMPTY_STATS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    setLoading(true);

    supabase
      .from('assets')
      .select('status')
      .eq('project_id', projectId)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (!error && data) {
          const next = { ...EMPTY_STATS, total: data.length };
          for (const row of data) {
            if (row.status === 'not_started') next.notStarted++;
            else if (row.status === 'in_progress') next.inProgress++;
            else if (row.status === 'completed') next.completed++;
            else if (row.status === 'on_hold') next.onHold++;
          }
          setStats(next);
        }
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  return { stats, loading };
}
