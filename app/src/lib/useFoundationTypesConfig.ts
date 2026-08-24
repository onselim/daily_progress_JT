import { useEffect, useState } from 'react';
import { supabase } from './supabase';

export interface FoundationTypeConfig {
  type: string;
  soilType: string;
  soilTypeCode: number;
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

/** Resolves an asset_type (e.g. "BNS+6", "B30-3", "B90C") to the canonical tower-type
 * prefix used as the foundation_types key, aliasing e.g. B90C -> B90 first. */
function resolveCanonicalType(assetType: string, foundationTypes: FoundationTypeConfig[]): string | null {
  const aliasMatch = Object.keys(TYPE_ALIASES).find((alias) => assetType.startsWith(alias));
  if (aliasMatch) return TYPE_ALIASES[aliasMatch];
  const direct = foundationTypes.find((f) => assetType.startsWith(f.type));
  return direct?.type ?? null;
}

/** Every foundation-type entry (one per soil type) uploaded for this asset's tower
 * type -- the set a "Soil Type" picker should offer. */
export function getFoundationOptionsForAsset(
  assetType: string | null | undefined,
  foundationTypes: FoundationTypeConfig[],
): FoundationTypeConfig[] {
  if (!assetType) return [];
  const canonicalType = resolveCanonicalType(assetType, foundationTypes);
  if (!canonicalType) return [];
  return foundationTypes.filter((f) => f.type === canonicalType);
}

/** The foundation-type entry matching both the asset's tower type and its selected
 * soil type. Falls back to the first uploaded entry for that type if the asset's
 * soil type has no matching drawing (e.g. only one soil type uploaded so far). */
export function getFoundationTypeForAsset(
  assetType: string | null | undefined,
  foundationTypes: FoundationTypeConfig[],
  soilTypeCode?: number | null,
): FoundationTypeConfig | null {
  const options = getFoundationOptionsForAsset(assetType, foundationTypes);
  if (options.length === 0) return null;
  if (soilTypeCode != null) {
    const match = options.find((f) => f.soilTypeCode === soilTypeCode);
    if (match) return match;
  }
  return options[0];
}
