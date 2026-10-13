import { useEffect, useMemo, useState } from 'react';

/** Look of one layer: Leaflet path options plus a radius for point layers. */
export interface LayerStyle {
  color: string;
  weight?: number;
  opacity?: number;
  dashArray?: string;
  fillColor?: string;
  fillOpacity?: number;
  radius?: number;
  /** Point layers: show each point's label permanently from this map zoom level on. */
  labelZoom?: number;
}

export interface StaticLayer {
  id: string;
  name: string;
  url: string;
  style: LayerStyle;
  count: number;
  kb: number;
  /** The layer carries its own colours per feature (the combined KMZ files). */
  ownColors?: boolean;
}

export interface LayerGroup {
  id: string;
  name: string;
  layers: StaticLayer[];
}

export interface LayerPart {
  id: string;
  name: string;
  groups: LayerGroup[];
}

interface Manifest {
  parts: { id: string; name: string; groups: { id: string; name: string; layers: (Omit<StaticLayer, 'url'> & { file: string })[] }[] }[];
}

/** Project map layers built from the shapefiles (scripts/layers/build_layers.py): Part > Group > Layer.
 * Files live in /layers/<project slug>/ next to the app; a project without that folder simply has none. */
export function useProjectLayers(projectSlug: string | undefined) {
  const [parts, setParts] = useState<LayerPart[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectSlug) return;
    let cancelled = false;
    setLoading(true);
    fetch(`/layers/${projectSlug}/manifest.json`)
      .then((res) => (res.ok ? res.json() : null))
      .then((m: Manifest | null) => {
        if (cancelled) return;
        if (!m?.parts) {
          setParts([]);
        } else {
          setParts(
            m.parts.map((p) => ({
              id: p.id,
              name: p.name,
              groups: p.groups.map((g) => ({
                id: g.id,
                name: g.name,
                layers: g.layers.map(({ file, ...rest }) => ({ ...rest, url: `/layers/${projectSlug}/${file}` })),
              })),
            })),
          );
        }
        setLoading(false);
      })
      // The host may answer an unknown file with the app's HTML page: treat anything unreadable as "no layers".
      .catch(() => {
        if (!cancelled) {
          setParts([]);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [projectSlug]);

  const layers = useMemo(() => parts.flatMap((p) => p.groups.flatMap((g) => g.layers)), [parts]);
  return { parts, layers, loading };
}
