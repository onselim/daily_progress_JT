import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';

export interface AssetDocument {
  id: string;
  work_item_key: string;
  file_name: string;
  file_url: string;
  uploaded_at: string;
}

export function useAssetDocuments(assetId: string | undefined) {
  const [documents, setDocuments] = useState<AssetDocument[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    if (!assetId) return;
    setLoading(true);
    return supabase
      .from('asset_documents')
      .select('id, work_item_key, file_name, file_url, uploaded_at')
      .eq('asset_id', assetId)
      .order('uploaded_at', { ascending: false })
      .then(({ data, error }) => {
        if (!error && data) setDocuments(data);
        setLoading(false);
      });
  }, [assetId]);

  useEffect(() => {
    if (!assetId) {
      setDocuments([]);
      return;
    }
    refresh();
  }, [assetId, refresh]);

  return { documents, loading, refresh };
}
