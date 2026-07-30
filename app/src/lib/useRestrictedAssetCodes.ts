import { useEffect, useState } from 'react';
import { supabase } from './supabase';

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function useRestrictedAssetCodes(projectId: string | undefined) {
  const [codes, setCodes] = useState<string[]>([]);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;

    supabase
      .from('asset_daily_log')
      .select('asset:assets!inner(asset_code, project_id)')
      .eq('asset.project_id', projectId)
      .eq('log_date', todayIso())
      .eq('site_access_status', 'restricted')
      .then(({ data, error }) => {
        if (cancelled) return;
        if (!error && data) {
          setCodes(
            data.map((row) => {
              const asset = Array.isArray(row.asset) ? row.asset[0] : row.asset;
              return asset.asset_code;
            }),
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  return codes;
}
