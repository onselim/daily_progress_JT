import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';

export interface AssetPhoto {
  id: string;
  file_url: string;
  category: string | null;
  uploaded_at: string;
}

export function useAssetPhotos(assetId: string | undefined) {
  const [photos, setPhotos] = useState<AssetPhoto[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    if (!assetId) return;
    setLoading(true);
    return supabase
      .from('photos')
      .select('id, file_url, category, uploaded_at')
      .eq('asset_id', assetId)
      .order('uploaded_at', { ascending: false })
      .then(({ data, error }) => {
        if (!error && data) setPhotos(data);
        setLoading(false);
      });
  }, [assetId]);

  useEffect(() => {
    if (!assetId) {
      setPhotos([]);
      return;
    }
    refresh();
  }, [assetId, refresh]);

  return { photos, loading, refresh };
}
