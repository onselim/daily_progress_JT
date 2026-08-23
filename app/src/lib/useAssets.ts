import { useEffect, useState } from 'react';
import { supabase } from './supabase';

export interface AssetListItem {
  id: string;
  asset_code: string;
  asset_type: string | null;
  status: string;
  station: string | null;
  x: number | null;
  y: number | null;
  z: number | null;
  lat: number | null;
  lng: number | null;
  leg1_ext_m: number | null;
  leg2_ext_m: number | null;
  leg3_ext_m: number | null;
  leg4_ext_m: number | null;
  soil_type: number;
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
      .select(
        'id, asset_code, asset_type, status, station, x, y, z, lat, lng, leg1_ext_m, leg2_ext_m, leg3_ext_m, leg4_ext_m, soil_type',
      )
      .eq('project_id', projectId)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (!error && data) {
          const sorted = [...data].sort((a, b) =>
            a.asset_code.localeCompare(b.asset_code, undefined, { numeric: true }),
          );
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
