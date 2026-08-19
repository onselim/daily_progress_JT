import { supabase } from './supabase';

export async function renameProjectDocument(documentId: string, newName: string) {
  const { error } = await supabase.from('documents').update({ slot_name: newName.trim() }).eq('id', documentId);
  if (error) throw error;
}

export async function renameAssetDocument(documentId: string, newName: string) {
  const { error } = await supabase.from('asset_documents').update({ file_name: newName.trim() }).eq('id', documentId);
  if (error) throw error;
}
