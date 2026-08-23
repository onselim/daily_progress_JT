import { supabase } from './supabase';

const BUCKET = 'project-media';

export async function createDocumentFolder(
  projectId: string,
  name: string,
  createdBy: string,
  section: string,
  parentFolderId?: string | null,
) {
  const { error } = await supabase.from('document_folders').insert({
    project_id: projectId,
    name: name.trim(),
    created_by: createdBy,
    section,
    parent_folder_id: parentFolderId ?? null,
  });
  if (error) throw error;
}

export async function renameDocumentFolder(folderId: string, newName: string) {
  const { error } = await supabase.from('document_folders').update({ name: newName.trim() }).eq('id', folderId);
  if (error) throw error;
}

/** Moves a document to a different folder, or to the section root if `folderId` is null. */
export async function moveProjectDocument(documentId: string, folderId: string | null) {
  const { error } = await supabase.from('documents').update({ folder_id: folderId }).eq('id', documentId);
  if (error) throw error;
}

/** Deletes a folder, every sub-folder beneath it (any depth), and every document in all
 * of them: the Storage objects first, then the folder row (whose sub-folders and
 * `documents` rows cascade-delete via FKs). */
export async function deleteDocumentFolder(folderId: string) {
  const folderIds = [folderId];
  let frontier = [folderId];
  while (frontier.length > 0) {
    const { data: children, error } = await supabase
      .from('document_folders')
      .select('id')
      .in('parent_folder_id', frontier);
    if (error) throw error;
    const childIds = (children ?? []).map((c) => c.id);
    if (childIds.length === 0) break;
    folderIds.push(...childIds);
    frontier = childIds;
  }

  const { data: docs, error: fetchError } = await supabase
    .from('documents')
    .select('file_url')
    .in('folder_id', folderIds);
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
