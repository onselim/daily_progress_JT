import { useMemo } from 'react';
import { useProjectDocuments } from './useProjectDocuments';

export interface MapLayer {
  id: string;
  name: string;
  url: string;
}

const GEO_EXTENSIONS = /\.(geojson|json)$/i;

/** Files uploaded to the "Layers" document section that look like GeoJSON -- these get
 * an on/off toggle in the panel and render as an overlay on the map, unlike ordinary
 * layer documents which just stay downloadable links. */
export function useMapLayers(projectId: string | undefined) {
  const { documents, loading, refresh } = useProjectDocuments(projectId, 'layers');

  const layers = useMemo(
    (): MapLayer[] =>
      documents
        .filter((d) => GEO_EXTENSIONS.test(d.slot_name) || GEO_EXTENSIONS.test(d.file_url))
        .map((d) => ({ id: d.id, name: d.slot_name, url: d.file_url })),
    [documents],
  );

  return { layers, loading, refresh };
}
