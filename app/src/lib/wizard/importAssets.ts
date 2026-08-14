import { supabase } from '../supabase';

export interface AssetImportRow {
  asset_code: string;
  asset_type?: string | null;
  x?: number | null;
  y?: number | null;
  z?: number | null;
  station?: string | null;
  lat?: number | null;
  lng?: number | null;
}

const CHUNK_SIZE = 500;

export async function importAssets(projectId: string, rows: AssetImportRow[]) {
  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE).map((row) => ({ project_id: projectId, ...row }));
    const { error } = await supabase.from('assets').insert(chunk);
    if (error) throw error;
  }
}
