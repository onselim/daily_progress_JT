import { supabase } from './supabase';

const BUCKET = 'project-media';

export async function uploadAssetDocument(params: {
  projectId: string;
  assetCode: string;
  assetId: string;
  file: File;
  uploadedBy: string;
  workItemKey: string;
}) {
  const { projectId, assetCode, assetId, file, uploadedBy, workItemKey } = params;
  const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
  const path = `${projectId}/${assetCode}/_documents/${workItemKey}/${Date.now()}-${safeName}`;

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file);
  if (uploadError) throw uploadError;

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);

  const { error: insertError } = await supabase.from('asset_documents').insert({
    asset_id: assetId,
    work_item_key: workItemKey,
    file_name: file.name,
    file_url: urlData.publicUrl,
    uploaded_by: uploadedBy,
  });
  if (insertError) throw insertError;
}
