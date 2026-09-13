import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';
import type { TowerModelSegment } from './extractTowerModels';

export function useTowerModels(projectId: string | undefined) {
  const [models, setModels] = useState<Record<string, TowerModelSegment[]>>({});
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    if (!projectId) return;
    setLoading(true);
    return supabase
      .from('asset_tower_models')
      .select('asset_id, segments')
      .eq('project_id', projectId)
      .then(({ data, error }) => {
        if (!error && data) {
          const next: Record<string, TowerModelSegment[]> = {};
          for (const row of data) {
            next[row.asset_id] = row.segments as TowerModelSegment[];
          }
          setModels(next);
        }
        setLoading(false);
      });
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return;
    refresh();
  }, [projectId, refresh]);

  /** Replaces every stored model for this project's assets with a freshly-extracted
   * batch in one go -- re-running extraction (e.g. after a corrected KMZ re-upload) is
   * meant to fully supersede the previous result, not merge with it. */
  async function saveAll(byAssetId: Record<string, TowerModelSegment[]>, sourceLayerId: string | undefined) {
    if (!projectId) return { error: 'No project' };
    const rows = Object.entries(byAssetId).map(([assetId, segments]) => ({
      asset_id: assetId,
      project_id: projectId,
      segments,
      source_layer_id: sourceLayerId ?? null,
      extracted_at: new Date().toISOString(),
    }));
    if (rows.length === 0) return { error: 'No towers matched' };

    const { error } = await supabase.from('asset_tower_models').upsert(rows, { onConflict: 'asset_id' });
    if (!error) await refresh();
    return { error: error?.message ?? null };
  }

  return { models, loading, refresh, saveAll };
}
