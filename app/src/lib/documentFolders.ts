import { supabase } from './supabase';

const BUCKET = 'project-media';

export async function createDocumentFolder(projectId: string, name: string, createdBy: string) {
  const { error } = await supabase
    .from('document_folders')
    .insert({ project_id: projectId, name: name.trim(), created_by: createdBy });
  if (error) throw error;
}

/** Deletes a folder and everything in it: the Storage objects for every document inside,
 * then the folder row (whose `documents` rows cascade-delete via the FK). */
export async function deleteDocumentFolder(folderId: string) {
  const { data: docs, error: fetchError } = await supabase
    .from('documents')
    .select('file_url')
    .eq('folder_id', folderId);
  if (fetchError) throw fetchError;

  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const paths = (docs ?? [])
    .map((d) => {
      const idx = d.file_url.indexOf(marker);
      return idx !== -1 ? d.file_url.slice(idx + marker.length) : null;
    })
    .filter((p): p is string => p !== null);

  if (paths.length > 0) {
    await supabase.storage.from(BUCKET).remove(paths);
  }

  const { error } = await supabase.from('document_folders').delete().eq('id', folderId);
  if (error) throw error;
}
