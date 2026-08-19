import { useEffect, useState } from 'react';
import { supabase } from './supabase';

export interface TowerWeightConfig {
  type: string;
  stubWeightKg: number | null;
  bodyExtensions: Record<string, number | null>;
  legAdjustments: Record<string, number | null>;
}

// Longest/most-specific code first so "B90C" isn't swallowed by the "B90" prefix check.
const KNOWN_TYPES = ['B90C', 'BNS', 'B30', 'B60', 'B90', 'BLC', 'BLS'];

export function useTowerWeightsConfig(projectId: string | undefined) {
  const [towerWeights, setTowerWeights] = useState<TowerWeightConfig[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    setLoading(true);

    supabase
      .from('project_config')
      .select('value')
      .eq('project_id', projectId)
      .eq('key', 'tower_weights')
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (!error && data) setTowerWeights(data.value as TowerWeightConfig[]);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  return { towerWeights, loading };
}

/** Splits an asset_type like "BNS+9" into its tower code and body-extension (m), stripping
 * trailing notes like " (Part-3)". A bare code with no +/- suffix (e.g. "B90C") means 0m. */
export function parseTowerType(assetType: string | null | undefined): { type: string; bodyExtM: number } | null {
  if (!assetType) return null;
  for (const type of KNOWN_TYPES) {
    if (assetType.startsWith(type)) {
      const rest = assetType.slice(type.length);
      const match = rest.match(/^([+-]\d+(?:\.\d+)?)/);
      return { type, bodyExtM: match ? Number(match[1]) : 0 };
    }
  }
  return null;
}

/** Total erection (steel body) weight in kg = the matched body-extension weight plus the
 * ±0m leg-adjustment weight (leg extensions aren't tracked per-tower yet, so 0 stands in
 * for all of them). Returns null if either component is missing from the source data. */
export function getTowerWeightForAsset(
  assetType: string | null | undefined,
  towerWeights: TowerWeightConfig[],
): number | null {
  const parsed = parseTowerType(assetType);
  if (!parsed) return null;
  const cfg = towerWeights.find((w) => w.type === parsed.type);
  if (!cfg) return null;
  const basic = cfg.bodyExtensions[String(parsed.bodyExtM)];
  const leg = cfg.legAdjustments['0'];
  if (basic == null || leg == null) return null;
  return basic + leg;
}
