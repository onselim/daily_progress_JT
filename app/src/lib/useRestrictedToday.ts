import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function useRestrictedToday(projectId: string | undefined) {
  const [restrictedAssetIds, setRestrictedAssetIds] = useState<Set<string>>(new Set());

  const refresh = useCallback(() => {
    if (!projectId) return;
    return supabase
      .from('asset_daily_log')
      .select('asset_id, asset:assets!inner(project_id)')
      .eq('asset.project_id', projectId)
      .eq('log_date', todayIso())
      .eq('site_access_status', 'restricted')
      .then(({ data, error }) => {
        if (!error && data) setRestrictedAssetIds(new Set(data.map((r) => r.asset_id)));
      });
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return;
    refresh();
  }, [projectId, refresh]);

  return { restrictedAssetIds, refresh };
}
