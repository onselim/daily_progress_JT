import { useEffect, useMemo, useState } from 'react';
import { supabase } from './supabase';
import { resolveLinePath, pathDistanceMeters, bearingDeg } from './lineGeometry';
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
  classified: boolean;
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
    // Gantries (terminal structures at each end, coded "G1"/"G2"/... or typed "GANTRY")
    // are part of the physical line but aren't towers — excluded from the tower count and
    // the suspension/tension split, still included in the path for total length.
    const isGantry = (a: AssetListItem) =>
      a.asset_type?.trim().toLowerCase() === 'gantry' || /^g\d*$/i.test(a.asset_code.trim());
    const towers = assets.filter((a) => !isGantry(a));
    const towerCount = towers.length;
    const path = resolveLinePath(assets, coordinateSystem);

    let totalLengthM: number | null = null;
    let longestSpanM: number | null = null;
    let angleCount: number | null = null;

    if (path.length >= 2) {
      totalLengthM = 0;
      longestSpanM = 0;
      for (let i = 0; i < path.length - 1; i++) {
        const d = pathDistanceMeters(path[i], path[i + 1]);
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
    let classified = false;
    if (towerCount > 0) {
      let suspensionCount = 0;
      let tensionCount = 0;
      for (const a of towers) {
        let cat: string | undefined;
        if (hasCategories) {
          cat = a.asset_type ? categories[a.asset_type] : undefined;
        } else if (a.asset_type) {
          // No explicit classification for this project: "BNS..." types are the
          // Normal Suspension towers, everything else (B30/B60/B90/BLC/BLS...) is Tension.
          cat = a.asset_type.trim().toUpperCase().startsWith('BNS') ? 'suspension' : 'tension';
        }
        if (cat === 'suspension') suspensionCount++;
        else if (cat === 'tension') tensionCount++;
        if (cat) classified = true;
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
      classified,
    };
  }, [assets, coordinateSystem, categories]);
}
