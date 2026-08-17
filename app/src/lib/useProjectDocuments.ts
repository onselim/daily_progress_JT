import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';

export interface ProjectDocument {
  id: string;
  slot_name: string;
  file_url: string;
  uploaded_at: string;
  folder_id: string | null;
}

export interface DocumentFolder {
  id: string;
  name: string;
  created_at: string;
  parent_folder_id: string | null;
  sort_order: number;
  divider_after: boolean;
}

export function useProjectDocuments(projectId: string | undefined, section: string) {
  const [documents, setDocuments] = useState<ProjectDocument[]>([]);
  const [folders, setFolders] = useState<DocumentFolder[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);

    const [documentsResult, foldersResult] = await Promise.all([
      supabase
        .from('documents')
        .select('id, slot_name, file_url, uploaded_at, folder_id')
        .eq('project_id', projectId)
        .eq('section', section)
        .order('uploaded_at', { ascending: false }),
      supabase
        .from('document_folders')
        .select('id, name, created_at, parent_folder_id, sort_order, divider_after')
        .eq('project_id', projectId)
        .eq('section', section)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true }),
    ]);

    if (!documentsResult.error && documentsResult.data) setDocuments(documentsResult.data);
    if (!foldersResult.error && foldersResult.data) setFolders(foldersResult.data);
    setLoading(false);
  }, [projectId, section]);

  useEffect(() => {
    if (!projectId) return;
    refresh();
  }, [projectId, refresh]);

  return { documents, folders, loading, refresh };
}
