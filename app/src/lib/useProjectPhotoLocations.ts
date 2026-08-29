import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';

export interface PhotoLocation {
  id: string;
  file_url: string;
  category: string | null;
  lat: number;
  lng: number;
  asset_code: string | null;
}

/** Live query (not a static uploaded-file layer) so newly uploaded geotagged photos
 * show up on the map without a manual "regenerate" step. */
export function useProjectPhotoLocations(projectId: string | undefined) {
  const [photoLocations, setPhotoLocations] = useState<PhotoLocation[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    if (!projectId) return;
    setLoading(true);
    return supabase
      .from('photos')
      .select('id, file_url, category, gps_lat, gps_lng, asset:assets(asset_code)')
      .eq('project_id', projectId)
      .not('gps_lat', 'is', null)
      .not('gps_lng', 'is', null)
      .then(({ data, error }) => {
        if (!error && data) {
          setPhotoLocations(
            data.map((row) => {
              const asset = Array.isArray(row.asset) ? row.asset[0] : row.asset;
              return {
                id: row.id,
                file_url: row.file_url,
                category: row.category,
                lat: row.gps_lat as number,
                lng: row.gps_lng as number,
                asset_code: asset?.asset_code ?? null,
              };
            }),
          );
        }
        setLoading(false);
      });
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return;
    refresh();
  }, [projectId, refresh]);

  return { photoLocations, loading, refresh };
}
