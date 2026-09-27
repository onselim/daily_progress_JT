import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { utmToLatLng } from './utmToLatLng';

export interface ProjectLocation {
  lat: number;
  lng: number;
}

/** A representative point for each project (the average of a handful of its assets), for
 * pinning it on the admin project map. Projects has no location field of its own -- assets
 * do -- so this samples a few rows per project rather than a heavier "fetch everything and
 * compute a true centroid" query, which the map doesn't need for placing one small pin. */
export function useProjectLocations(
  projects: { id: string; coordinate_system: string | null }[],
) {
  const [locations, setLocations] = useState<Record<string, ProjectLocation>>({});
  const [loading, setLoading] = useState(true);

  const key = projects.map((p) => p.id).join(',');

  useEffect(() => {
    if (!projects.length) {
      setLocations({});
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);

    Promise.all(
      projects.map(async (p) => {
        const { data, error } = await supabase
          .from('assets')
          .select('lat, lng, x, y')
          .eq('project_id', p.id)
          .order('asset_code')
          .limit(5);
        if (error || !data || !data.length) return [p.id, null] as const;

        const withLatLng = data.filter((a) => a.lat != null && a.lng != null);
        if (withLatLng.length) {
          const lat = withLatLng.reduce((s, a) => s + (a.lat as number), 0) / withLatLng.length;
          const lng = withLatLng.reduce((s, a) => s + (a.lng as number), 0) / withLatLng.length;
          return [p.id, { lat, lng }] as const;
        }

        const withXy = data.filter((a) => a.x != null && a.y != null);
        if (withXy.length && p.coordinate_system) {
          try {
            const pts = withXy.map((a) => utmToLatLng(a.x as number, a.y as number, p.coordinate_system as string));
            const lat = pts.reduce((s, [la]) => s + la, 0) / pts.length;
            const lng = pts.reduce((s, [, ln]) => s + ln, 0) / pts.length;
            return [p.id, { lat, lng }] as const;
          } catch {
            return [p.id, null] as const;
          }
        }
        return [p.id, null] as const;
      }),
    ).then((entries) => {
      if (cancelled) return;
      const next: Record<string, ProjectLocation> = {};
      for (const [id, loc] of entries) if (loc) next[id] = loc;
      setLocations(next);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { locations, loading };
}
