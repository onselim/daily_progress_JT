import { supabase } from './supabase';

const BUCKET = 'project-media';

export async function uploadProjectDocument(params: {
  projectId: string;
  file: File;
  uploadedBy: string;
  slotName?: string;
  folderId?: string | null;
}) {
  const { projectId, file, uploadedBy, slotName, folderId } = params;
  const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
  const path = `${projectId}/_documents/${folderId ?? 'root'}/${Date.now()}-${safeName}`;

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file);
  if (uploadError) throw uploadError;

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);

  const { error: insertError } = await supabase.from('documents').insert({
    project_id: projectId,
    slot_name: slotName ?? file.name,
    file_url: urlData.publicUrl,
    uploaded_by: uploadedBy,
    folder_id: folderId ?? null,
  });
  if (insertError) throw insertError;
}
