import { supabase } from './supabase';

const BUCKET = 'project-media';

export async function deleteAssetPhoto(photoId: string, fileUrl: string) {
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const idx = fileUrl.indexOf(marker);
  if (idx !== -1) {
    const path = fileUrl.slice(idx + marker.length);
    await supabase.storage.from(BUCKET).remove([path]);
  }

  const { error } = await supabase.from('photos').delete().eq('id', photoId);
  if (error) throw error;
}
