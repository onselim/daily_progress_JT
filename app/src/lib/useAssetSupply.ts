import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';
import type { SupplyByAsset, SupplyComponent, SupplyStage } from './supplyStatus';

const PAGE_SIZE = 1000;

async function fetchAll(projectId: string): Promise<{ asset_id: string; component: SupplyComponent; stage: SupplyStage }[]> {
  const rows: { asset_id: string; component: SupplyComponent; stage: SupplyStage }[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from('asset_supply_status')
      .select('asset_id, component, stage, asset:assets!inner(project_id)')
      .eq('asset.project_id', projectId)
      .range(from, from + PAGE_SIZE - 1);
    if (error || !data) break;
    rows.push(...(data as unknown as typeof rows));
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return rows;
}

/** Per-tower material status of a project (tower steel + stubs). Empty until the migration is applied and somebody enters a status. */
export function useAssetSupply(projectId: string | undefined) {
  const [statuses, setStatuses] = useState<SupplyByAsset>({});
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);
  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    setLoading(true);
    fetchAll(projectId).then((rows) => {
      if (cancelled) return;
      const next: SupplyByAsset = {};
      for (const r of rows) (next[r.asset_id] ??= {})[r.component] = r.stage;
      setStatuses(next);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [projectId, nonce]);

  return { statuses, loading, refresh };
}

/** Sets the same stage on many towers at once. */
export async function setSupplyStage(assetIds: string[], component: SupplyComponent, stage: SupplyStage, userId: string | undefined): Promise<void> {
  if (assetIds.length === 0) return;
  const rows = assetIds.map((asset_id) => ({ asset_id, component, stage, updated_by: userId ?? null }));
  for (let i = 0; i < rows.length; i += 200) {
    const { error } = await supabase.from('asset_supply_status').upsert(rows.slice(i, i + 200), { onConflict: 'asset_id,component' });
    if (error) throw new Error(error.message);
  }
}
