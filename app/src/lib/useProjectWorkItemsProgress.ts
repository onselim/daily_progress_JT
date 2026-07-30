import { useEffect, useState } from 'react';
import { supabase } from './supabase';

export function useProjectWorkItemsProgress(projectId: string | undefined) {
  const [progressByAsset, setProgressByAsset] = useState<Record<string, number>>({});
  const [percentByAssetAndKey, setPercentByAssetAndKey] = useState<Record<string, Record<string, number>>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    setLoading(true);

    supabase
      .from('asset_work_items')
      .select('asset_id, work_item_key, percent_complete, asset:assets!inner(project_id)')
      .eq('asset.project_id', projectId)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (!error && data) {
          const sums: Record<string, { total: number; count: number }> = {};
          const byAssetAndKey: Record<string, Record<string, number>> = {};
          for (const row of data) {
            const entry = sums[row.asset_id] ?? { total: 0, count: 0 };
            entry.total += Number(row.percent_complete);
            entry.count += 1;
            sums[row.asset_id] = entry;

            const keyMap = byAssetAndKey[row.asset_id] ?? {};
            keyMap[row.work_item_key] = Number(row.percent_complete);
            byAssetAndKey[row.asset_id] = keyMap;
          }
          const next: Record<string, number> = {};
          for (const [assetId, { total, count }] of Object.entries(sums)) {
            next[assetId] = count > 0 ? Math.round(total / count) : 0;
          }
          setProgressByAsset(next);
          setPercentByAssetAndKey(byAssetAndKey);
        }
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  return { progressByAsset, percentByAssetAndKey, loading };
}
