import { useEffect, useMemo, useState } from 'react';
import { supabase } from './supabase';
import { resolveLinePath, haversineMeters, bearingDeg } from './lineGeometry';
import type { AssetListItem } from './useAssets';

export interface LineSummary {
  towerCount: number;
  totalLengthM: number | null;
  longestSpanM: number | null;
  angleCount: number | null;
  minElevation: number | null;
  maxElevation: number | null;
  suspensionPercent: number | null;
  tensionPercent: number | null;
  hasCategories: boolean;
}

export function useLineSummary(
  projectId: string | undefined,
  assets: AssetListItem[],
  coordinateSystem: string | null,
): LineSummary {
  const [categories, setCategories] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;

    supabase
      .from('project_config')
      .select('value')
      .eq('project_id', projectId)
      .eq('key', 'asset_type_categories')
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        setCategories((data?.value as Record<string, string> | undefined) ?? {});
      });

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  return useMemo(() => {
    const towerCount = assets.length;
    const path = resolveLinePath(assets, coordinateSystem);

    let totalLengthM: number | null = null;
    let longestSpanM: number | null = null;
    let angleCount: number | null = null;

    if (path.length >= 2) {
      totalLengthM = 0;
      longestSpanM = 0;
      for (let i = 0; i < path.length - 1; i++) {
        const d = haversineMeters(path[i].lat, path[i].lng, path[i + 1].lat, path[i + 1].lng);
        totalLengthM += d;
        if (d > longestSpanM) longestSpanM = d;
      }

      // Start and end structures are angle/terminal points by convention, plus every
      // interior tower where the line actually changes direction.
      angleCount = 2;
      for (let i = 1; i < path.length - 1; i++) {
        const bearingIn = bearingDeg(path[i - 1].lat, path[i - 1].lng, path[i].lat, path[i].lng);
        const bearingOut = bearingDeg(path[i].lat, path[i].lng, path[i + 1].lat, path[i + 1].lng);
        let deflection = Math.abs(bearingOut - bearingIn);
        if (deflection > 180) deflection = 360 - deflection;
        if (deflection > 0.5) angleCount++;
      }
    }

    const elevations = assets.map((a) => a.z).filter((z): z is number => z != null);
    const minElevation = elevations.length > 0 ? Math.min(...elevations) : null;
    const maxElevation = elevations.length > 0 ? Math.max(...elevations) : null;

    const hasCategories = Object.keys(categories).length > 0;
    let suspensionPercent: number | null = null;
    let tensionPercent: number | null = null;
    if (hasCategories && towerCount > 0) {
      let suspensionCount = 0;
      let tensionCount = 0;
      for (const a of assets) {
        const cat = a.asset_type ? categories[a.asset_type] : undefined;
        if (cat === 'suspension') suspensionCount++;
        else if (cat === 'tension') tensionCount++;
      }
      suspensionPercent = (suspensionCount / towerCount) * 100;
      tensionPercent = (tensionCount / towerCount) * 100;
    }

    return {
      towerCount,
      totalLengthM,
      longestSpanM,
      angleCount,
      minElevation,
      maxElevation,
      suspensionPercent,
      tensionPercent,
      hasCategories,
    };
  }, [assets, coordinateSystem, categories]);
}
