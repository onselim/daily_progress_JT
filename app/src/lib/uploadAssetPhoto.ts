import { supabase } from './supabase';

const BUCKET = 'project-media';

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

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file);
  if (uploadError) throw uploadError;

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);

  const { error: insertError } = await supabase.from('photos').insert({
    project_id: projectId,
    asset_id: assetId,
    category,
    file_url: urlData.publicUrl,
    uploaded_by: uploadedBy,
  });
  if (insertError) throw insertError;
}
