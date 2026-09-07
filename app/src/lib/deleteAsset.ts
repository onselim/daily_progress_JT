import { supabase } from './supabase';

export async function deleteAsset(assetId: string) {
  const { error } = await supabase.from('assets').delete().eq('id', assetId);
  if (error) throw error;
}
