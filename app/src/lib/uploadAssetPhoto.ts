import exifr from 'exifr';
import { supabase } from './supabase';

const BUCKET = 'project-media';

/** Most phone photos carry GPS EXIF; this reads it so the photo can show up on the
 * geotagged-photos map layer. Returns null on any failure (no GPS tag, unsupported
 * format, corrupt EXIF) -- never blocks the upload itself. */
async function readGps(file: File): Promise<{ lat: number; lng: number } | null> {
  try {
    const gps = await exifr.gps(file);
    if (!gps || typeof gps.latitude !== 'number' || typeof gps.longitude !== 'number') return null;
    return { lat: gps.latitude, lng: gps.longitude };
  } catch {
    return null;
  }
}

export async function uploadAssetPhoto(params: {
  projectId: string;
  assetCode: string;
  assetId: string;
  file: File;
  uploadedBy: string;
  category?: string;
}) {
  const { projectId, assetCode, assetId, file, uploadedBy, category = 'site' } = params;
  const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
  const path = `${projectId}/${assetCode}/${category}/${Date.now()}-${safeName}`;

  const gps = await readGps(file);

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file);
  if (uploadError) throw uploadError;

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);

  const { error: insertError } = await supabase.from('photos').insert({
    project_id: projectId,
    asset_id: assetId,
    category,
    file_url: urlData.publicUrl,
    gps_lat: gps?.lat ?? null,
    gps_lng: gps?.lng ?? null,
    uploaded_by: uploadedBy,
  });
  if (insertError) throw insertError;
}
