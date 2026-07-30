import { useEffect, useState } from 'react';
import { supabase } from './supabase';

export interface AssetListItem {
  id: string;
  asset_code: string;
  asset_type: string | null;
  status: string;
  station: string | null;
  sequence: number | null;
  x: number | null;
  y: number | null;
  lat: number | null;
  lng: number | null;
}

export function useAssets(projectId: string | undefined) {
  const [assets, setAssets] = useState<AssetListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    setLoading(true);

    supabase
      .from('assets')
      .select('id, asset_code, asset_type, status, station, sequence, x, y, lat, lng')
      .eq('project_id', projectId)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (!error && data) {
          const sorted = [...data].sort((a, b) => {
            if (a.sequence != null && b.sequence != null) return a.sequence - b.sequence;
            return a.asset_code.localeCompare(b.asset_code, undefined, { numeric: true });
          });
          setAssets(sorted);
        }
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  return { assets, loading };
}
