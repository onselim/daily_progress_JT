import { useEffect, useRef, useState } from 'react';
import { utmToLatLng } from '../lib/utmToLatLng';
import { resolveLinePath } from '../lib/lineGeometry';
import { STATUS_COLOR, GOOGLE_SATELLITE_URL_TEMPLATE } from '../lib/mapConstants';
import { useLanguage } from '../lib/i18n/LanguageContext';
import type { AssetListItem } from '../lib/useAssets';

// CesiumJS is loaded from its own CDN, not bundled via npm -- it's a large library and
// most visitors (especially the no-login public viewer) never touch the 3D toggle, so
// this avoids paying its weight on every page load. There's no official type package
// involved either (that would require installing the `cesium` npm package just for
// types), so the loaded global is treated as `any` throughout this file.
declare global {
  interface Window {
    Cesium?: any;
    CESIUM_BASE_URL?: string;
  }
}

const CESIUM_VERSION = '1.120';
const CESIUM_BASE_URL = `https://cesium.com/downloads/cesiumjs/releases/${CESIUM_VERSION}/Build/Cesium/`;

// Free Cesium ion "Default Token" (ion.cesium.com -> Access Tokens) -- this is meant to
// ship client-side, the same way a Google Maps API key does; it's not a secret. Needed
// for real elevation (Cesium World Terrain) since the CDN build's own shared demo token
// is rejected (401), independent of anything this app does.
const CESIUM_ION_TOKEN =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJub25jZSI6IkxpMmFZMjVBQjd6M1pfanMiLCJqdGkiOiJiODVjNzgxYS0zZGNlLTRiNGQtYjdiNi03MTA3YmYxMmJmZWIiLCJpZCI6NDg5ODE0LCJpc3MiOiJodHRwczovL2FwaS5jZXNpdW0uY29tIiwiYXVkIjoidW5kZWZpbmVkX2RlZmF1bHQiLCJpYXQiOjE3ODkxNzAxODJ9.y4-AHogcdPlkoOsxLLkGHVZB5Jfg7uTD53UQ-uSZaHY';

let cesiumLoadPromise: Promise<void> | null = null;

/** Loads Cesium.js + its widget CSS from the CDN exactly once per page session
 * (cached at module scope), regardless of how many times the 3D view is toggled on. */
function loadCesium(): Promise<void> {
  if (window.Cesium) return Promise.resolve();
  if (cesiumLoadPromise) return cesiumLoadPromise;

  cesiumLoadPromise = new Promise((resolve, reject) => {
    window.CESIUM_BASE_URL = CESIUM_BASE_URL;

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `${CESIUM_BASE_URL}Widgets/widgets.css`;
    document.head.appendChild(link);

    const script = document.createElement('script');
    script.src = `${CESIUM_BASE_URL}Cesium.js`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Cesium from CDN'));
    document.head.appendChild(script);
  });

  return cesiumLoadPromise;
}

/** Same category -> color mapping as `geoLayerStyle` in MapView.tsx (2D), so an
 * existing-infrastructure layer looks like "the same line, tilted" between views. */
function geoLayerColors(category?: string): { stroke: string; fill: string | null } {
  if (category === 'pipeline') return { stroke: '#a16207', fill: null };
  if (category === 'substation') return { stroke: '#ef4444', fill: '#ef4444' };
  if (category === 'power_plant') return { stroke: '#a855f7', fill: '#a855f7' };
  if (category === 'railway') return { stroke: '#1f2937', fill: null };
  if (category === 'excavation_pit') return { stroke: '#78350f', fill: '#facc15' };
  return { stroke: '#f59e0b', fill: null };
}

interface MapView3DProps {
  assets: AssetListItem[];
  coordinateSystem: string | null;
  selectedAssetId: string;
  onSelect: (assetId: string) => void;
  restrictedAssetIds: Set<string>;
  activeAssetIds: Set<string>;
  geoLayers?: { id: string; name: string; url: string }[];
  onLayerError?: (layerId: string, message: string) => void;
}

/** A realistic 3D alternative to the flat 2D `MapView` -- real terrain elevation
 * (Cesium World Terrain) draped with the same Google Satellite imagery the 2D map uses,
 * so mountains actually look like mountains. Towers (colored by status, clickable),
 * conductor spans, and existing-infrastructure GeoJSON layers (Layers panel, e.g.
 * excavation pits) all render here too, using the same category colors as the 2D map.
 * Deliberately still a subset of the 2D map's features -- the heat map, deflection
 * badges, photo clusters, and basemap switching stay 2D-only for now (no per-feature
 * hover tooltips on the GeoJSON layers either, unlike 2D's `bindTooltip`). See the
 * project plan for the full scope rationale. */
export function MapView3D({
  assets,
  coordinateSystem,
  selectedAssetId,
  onSelect,
  restrictedAssetIds,
  activeAssetIds,
  geoLayers = [],
  onLayerError,
}: MapView3DProps) {
  const { t } = useLanguage();
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);
  const geoDataSourceRef = useRef<any>(null);
  const loadedGeoLayersRef = useRef<Map<string, any[]>>(new Map());
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const onLayerErrorRef = useRef(onLayerError);
  onLayerErrorRef.current = onLayerError;
  const [status, setStatus] = useState<'loading' | 'ready' | 'ready-flat' | 'error'>('loading');

  useEffect(() => {
    let cancelled = false;

    loadCesium()
      .then(async () => {
        if (cancelled || !containerRef.current) return;
        const Cesium = window.Cesium;
        Cesium.Ion.defaultAccessToken = CESIUM_ION_TOKEN;

        // Real elevation (Cesium World Terrain) needs a valid Cesium ion access token --
        // the CDN build's baked-in demo token is shared across every site that hasn't
        // set its own and can get rate-limited/rejected (401) independent of anything
        // this app does. Fall back to a flat (but still pannable/tiltable) 3D globe
        // rather than failing the whole view over a missing token.
        let terrainProvider;
        let flatTerrain = false;
        try {
          terrainProvider = await Cesium.createWorldTerrainAsync();
        } catch {
          terrainProvider = new Cesium.EllipsoidTerrainProvider();
          flatTerrain = true;
        }
        if (cancelled || !containerRef.current) return;

        const viewer = new Cesium.Viewer(containerRef.current, {
          terrainProvider,
          imageryProvider: false,
          baseLayerPicker: false,
          timeline: false,
          animation: false,
          geocoder: false,
          homeButton: false,
          sceneModePicker: false,
          navigationHelpButton: false,
          infoBox: false,
          selectionIndicator: false,
          fullscreenButton: false,
        });
        viewer.imageryLayers.addImageryProvider(
          new Cesium.UrlTemplateImageryProvider({
            url: GOOGLE_SATELLITE_URL_TEMPLATE,
            subdomains: ['0', '1', '2', '3'],
            maximumLevel: 20,
          }),
        );

        const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
        handler.setInputAction((click: { position: unknown }) => {
          const picked = viewer.scene.pick(click.position);
          if (Cesium.defined(picked) && picked.id && typeof picked.id.id === 'string') {
            onSelectRef.current(picked.id.id);
          }
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

        // Existing-infrastructure GeoJSON layers (Layers panel, e.g. excavation pits)
        // live in their own data source rather than `viewer.entities` -- that collection
        // gets wiped and rebuilt wholesale on every asset/status change (see the effect
        // below), which would otherwise also erase these on every unrelated re-render.
        const geoDataSource = new Cesium.CustomDataSource('geoLayers');
        viewer.dataSources.add(geoDataSource);
        geoDataSourceRef.current = geoDataSource;

        viewerRef.current = viewer;
        setStatus(flatTerrain ? 'ready-flat' : 'ready');
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });

    return () => {
      cancelled = true;
      viewerRef.current?.destroy();
      viewerRef.current = null;
      geoDataSourceRef.current = null;
      loadedGeoLayersRef.current.clear();
    };
  }, []);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || (status !== 'ready' && status !== 'ready-flat')) return;
    const Cesium = window.Cesium;

    viewer.entities.removeAll();

    for (const asset of assets) {
      let lat = asset.lat;
      let lng = asset.lng;
      if ((lat == null || lng == null) && asset.x != null && asset.y != null && coordinateSystem) {
        try {
          [lat, lng] = utmToLatLng(asset.x, asset.y, coordinateSystem);
        } catch {
          continue;
        }
      }
      if (lat == null || lng == null) continue;

      const isSelected = asset.id === selectedAssetId;
      const isRestricted = restrictedAssetIds.has(asset.id);
      const isActive = activeAssetIds.has(asset.id);
      const color = isRestricted ? '#ef4444' : (STATUS_COLOR[asset.status] ?? STATUS_COLOR.not_started);

      viewer.entities.add({
        id: asset.id,
        position: Cesium.Cartesian3.fromDegrees(lng, lat),
        point: {
          pixelSize: isSelected ? 16 : isActive ? 13 : 10,
          color: Cesium.Color.fromCssColorString(color),
          outlineColor: isSelected ? Cesium.Color.fromCssColorString('#fbbf24') : Cesium.Color.WHITE,
          outlineWidth: isSelected ? 3 : 1.5,
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        label: {
          text: asset.asset_code,
          font: '11px sans-serif',
          fillColor: Cesium.Color.WHITE,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 3,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, -12),
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      });
    }

    const points = resolveLinePath(assets, coordinateSystem);
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i];
      const b = points[i + 1];
      viewer.entities.add({
        polyline: {
          positions: Cesium.Cartesian3.fromDegreesArray([a.lng, a.lat, b.lng, b.lat]),
          width: 2,
          material: Cesium.Color.fromCssColorString('#ef4444'),
          clampToGround: true,
        },
      });
    }

    if (viewer.entities.values.length > 0) {
      viewer.flyTo(viewer.entities, { duration: 0 });
    }
  }, [assets, coordinateSystem, selectedAssetId, restrictedAssetIds, activeAssetIds, status]);

  useEffect(() => {
    const dataSource = geoDataSourceRef.current;
    if (!dataSource || (status !== 'ready' && status !== 'ready-flat')) return;
    const Cesium = window.Cesium;
    let cancelled = false;

    const activeIds = new Set(geoLayers.map((l) => l.id));
    for (const [id, entities] of loadedGeoLayersRef.current) {
      if (!activeIds.has(id)) {
        for (const entity of entities) dataSource.entities.remove(entity);
        loadedGeoLayersRef.current.delete(id);
      }
    }

    for (const geoLayer of geoLayers) {
      if (loadedGeoLayersRef.current.has(geoLayer.id)) continue;
      fetch(geoLayer.url)
        .then((res) => res.json())
        .then((data) => {
          if (cancelled || loadedGeoLayersRef.current.has(geoLayer.id)) return;
          const validTypes = ['FeatureCollection', 'Feature', 'GeometryCollection'];
          if (!validTypes.includes(data?.type)) {
            onLayerErrorRef.current?.(geoLayer.id, `Not a GeoJSON file (found "${data?.type ?? typeof data}" instead)`);
            return;
          }

          const features = data.type === 'FeatureCollection' ? data.features : data.type === 'Feature' ? [data] : [];
          const addedEntities: any[] = [];

          const addPolygon = (ring: [number, number][], stroke: string, fill: string | null) => {
            addedEntities.push(
              dataSource.entities.add({
                polygon: {
                  hierarchy: new Cesium.PolygonHierarchy(Cesium.Cartesian3.fromDegreesArray(ring.flat())),
                  material: Cesium.Color.fromCssColorString(fill ?? stroke).withAlpha(0.5),
                  outline: true,
                  outlineColor: Cesium.Color.fromCssColorString(stroke),
                },
              }),
            );
          };
          const addLine = (coords: [number, number][], stroke: string) => {
            addedEntities.push(
              dataSource.entities.add({
                polyline: {
                  positions: Cesium.Cartesian3.fromDegreesArray(coords.flat()),
                  width: 3,
                  material: Cesium.Color.fromCssColorString(stroke),
                  clampToGround: true,
                },
              }),
            );
          };

          for (const feature of features) {
            const geom = feature?.geometry;
            if (!geom) continue;
            const { stroke, fill } = geoLayerColors(feature?.properties?.category);

            if (geom.type === 'Polygon') addPolygon(geom.coordinates[0], stroke, fill);
            else if (geom.type === 'MultiPolygon') for (const poly of geom.coordinates) addPolygon(poly[0], stroke, fill);
            else if (geom.type === 'LineString') addLine(geom.coordinates, stroke);
            else if (geom.type === 'MultiLineString') for (const line of geom.coordinates) addLine(line, stroke);
          }

          loadedGeoLayersRef.current.set(geoLayer.id, addedEntities);
        })
        .catch((err) => {
          onLayerErrorRef.current?.(geoLayer.id, err instanceof Error ? err.message : 'Failed to load layer');
        });
    }

    return () => {
      cancelled = true;
    };
  }, [geoLayers, status]);

  return (
    <div className="map-view-3d-wrap">
      <div ref={containerRef} className="map-view" />
      {status === 'loading' && <div className="map-3d-status">{t('map.loading3D')}</div>}
      {status === 'error' && <div className="map-3d-status map-3d-status-error">{t('map.load3DFailed')}</div>}
      {status === 'ready-flat' && <div className="map-3d-hint">{t('map.terrainNeedsToken')}</div>}
    </div>
  );
}
