import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';

export interface ProjectDocument {
  id: string;
  slot_name: string;
  file_url: string;
  uploaded_at: string;
}

export function useProjectDocuments(projectId: string | undefined) {
  const [documents, setDocuments] = useState<ProjectDocument[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    if (!projectId) return;
    setLoading(true);
    return supabase
      .from('documents')
      .select('id, slot_name, file_url, uploaded_at')
      .eq('project_id', projectId)
      .order('uploaded_at', { ascending: false })
      .then(({ data, error }) => {
        if (!error && data) setDocuments(data);
        setLoading(false);
      });
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return;
    refresh();
  }, [projectId, refresh]);

  return { documents, loading, refresh };
}
