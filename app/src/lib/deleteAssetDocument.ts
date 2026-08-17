import { supabase } from './supabase';

const BUCKET = 'project-media';

export async function deleteAssetDocument(documentId: string, fileUrl: string) {
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const idx = fileUrl.indexOf(marker);
  if (idx !== -1) {
    const path = fileUrl.slice(idx + marker.length);
    await supabase.storage.from(BUCKET).remove([path]);
  }

  const { error } = await supabase.from('asset_documents').delete().eq('id', documentId);
  if (error) throw error;
}
