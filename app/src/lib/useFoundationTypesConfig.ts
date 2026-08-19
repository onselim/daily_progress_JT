import { useEffect, useState } from 'react';
import { supabase } from './supabase';

export interface FoundationTypeConfig {
  type: string;
  soilType: string;
  bWidthM: number;
  concreteM3: number;
  excavationM3: number;
  reinforcementKg: number;
  leanConcreteM3: number;
}

// Tower types with no dedicated foundation drawing reuse another type's values
// (e.g. B90C has no separate drawing and uses the B90 entry — user instruction).
const TYPE_ALIASES: Record<string, string> = {
  B90C: 'B90',
};

export function useFoundationTypesConfig(projectId: string | undefined) {
  const [foundationTypes, setFoundationTypes] = useState<FoundationTypeConfig[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    setLoading(true);

    supabase
      .from('project_config')
      .select('value')
      .eq('project_id', projectId)
      .eq('key', 'foundation_types')
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (!error && data) setFoundationTypes(data.value as FoundationTypeConfig[]);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  return { foundationTypes, loading };
}

/** Matches an asset's asset_type (e.g. "BNS+6", "B30-3", "B90C") to its foundation
 * type config by prefix, resolving aliases like B90C -> B90 first. */
export function getFoundationTypeForAsset(
  assetType: string | null | undefined,
  foundationTypes: FoundationTypeConfig[],
): FoundationTypeConfig | null {
  if (!assetType) return null;
  const aliasMatch = Object.keys(TYPE_ALIASES).find((alias) => assetType.startsWith(alias));
  const canonicalType = aliasMatch ? TYPE_ALIASES[aliasMatch] : null;
  if (canonicalType) {
    const aliased = foundationTypes.find((f) => f.type === canonicalType);
    if (aliased) return aliased;
  }
  return foundationTypes.find((f) => assetType.startsWith(f.type)) ?? null;
}
