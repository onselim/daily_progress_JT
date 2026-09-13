import { useEffect, useRef, useState } from 'react';
import { utmToLatLng } from '../lib/utmToLatLng';
import { resolveLinePath, bearingDeg, spanGeometry, offsetLatLng } from '../lib/lineGeometry';
import { STATUS_COLOR, SPAN_COLOR, GOOGLE_SATELLITE_URL_TEMPLATE } from '../lib/mapConstants';
import { loadCesium } from '../lib/loadCesium';
import { toLyingLocalPoint } from '../lib/towerModelGeometry';
import { useLanguage } from '../lib/i18n/LanguageContext';
import type { AssetListItem } from '../lib/useAssets';
import type { GroundWireConfig } from '../lib/useGroundWireConfig';
import type { LineConductorTypes } from '../lib/useLineConductorTypes';
import type { TowerModelSegment } from '../lib/extractTowerModels';

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

// Free Cesium ion "Default Token" (ion.cesium.com -> Access Tokens) -- this is meant to
// ship client-side, the same way a Google Maps API key does; it's not a secret. Needed
// for real elevation (Cesium World Terrain) since the CDN build's own shared demo token
// is rejected (401), independent of anything this app does.
const CESIUM_ION_TOKEN =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJub25jZSI6IkxpMmFZMjVBQjd6M1pfanMiLCJqdGkiOiJiODVjNzgxYS0zZGNlLTRiNGQtYjdiNi03MTA3YmYxMmJmZWIiLCJpZCI6NDg5ODE0LCJpc3MiOiJodHRwczovL2FwaS5jZXNpdW0uY29tIiwiYXVkIjoidW5kZWZpbmVkX2RlZmF1bHQiLCJpYXQiOjE3ODkxNzAxODJ9.y4-AHogcdPlkoOsxLLkGHVZB5Jfg7uTD53UQ-uSZaHY';

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

const KML_EXTENSIONS = /\.(kml|kmz)$/i;

interface MapView3DProps {
  assets: AssetListItem[];
  coordinateSystem: string | null;
  selectedAssetId: string;
  onSelect: (assetId: string) => void;
  restrictedAssetIds: Set<string>;
  activeAssetIds: Set<string>;
  groundWireConfig: GroundWireConfig;
  isAdmin?: boolean;
  onEditConductorType?: (channel: keyof LineConductorTypes) => void;
  geoLayers?: { id: string; name: string; url: string }[];
  onLayerError?: (layerId: string, message: string) => void;
  towerModels?: Record<string, TowerModelSegment[]>;
  percentByAssetAndKey?: Record<string, Record<string, number>>;
}

/** A realistic 3D alternative to the flat 2D `MapView` -- real terrain elevation
 * (Cesium World Terrain) draped with the same Google Satellite imagery the 2D map uses,
 * so mountains actually look like mountains. Towers (colored by status, clickable,
 * labeled with their asset code), separate conductor/earthwire/OPGW spans (same
 * colors/offsets as 2D, admin-clickable to edit that channel's type -- see
 * ConductorTypeDialog), and existing-infrastructure GeoJSON layers (Layers panel, e.g.
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
  groundWireConfig,
  isAdmin = false,
  onEditConductorType,
  geoLayers = [],
  onLayerError,
  towerModels = {},
  percentByAssetAndKey = {},
}: MapView3DProps) {
  const { t } = useLanguage();
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);
  const geoDataSourceRef = useRef<any>(null);
  const loadedGeoLayersRef = useRef<Map<string, any[]>>(new Map());
  const loadedKmlLayersRef = useRef<Map<string, any>>(new Map());
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const isAdminRef = useRef(isAdmin);
  isAdminRef.current = isAdmin;
  const onEditConductorTypeRef = useRef(onEditConductorType);
  onEditConductorTypeRef.current = onEditConductorType;
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
          if (!Cesium.defined(picked) || !picked.id) return;
          if (picked.id.channelKey) {
            if (isAdminRef.current) onEditConductorTypeRef.current?.(picked.id.channelKey);
            return;
          }
          if (typeof picked.id.id === 'string') {
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
      loadedKmlLayersRef.current.clear();
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

    // Conductor (x2, either side of the line), earthwire, and OPGW as separate
    // parallel offset lines -- the same sign/baseDeg offset math as the 2D map's
    // `channels` array, minus its miter-join refinement at bends (a 2D-only nicety;
    // simple per-span offsets are the accepted 3D v1 simplification). Each entity gets
    // a `channelKey` so an admin click can look up which project_config field to edit.
    const points = resolveLinePath(assets, coordinateSystem);
    const channels: { sign: number; baseDeg: number; color: string; channelKey: keyof LineConductorTypes; enabled: boolean }[] = [
      { sign: 1, baseDeg: 0.00009, color: SPAN_COLOR.conductor, channelKey: 'conductor', enabled: true },
      { sign: -1, baseDeg: 0.00009, color: SPAN_COLOR.conductor, channelKey: 'conductor', enabled: true },
      {
        sign: 1,
        baseDeg: 0.000045,
        color: SPAN_COLOR.earthwire,
        channelKey: 'earthwire',
        enabled: groundWireConfig.earthwire > 0,
      },
      {
        sign: groundWireConfig.earthwire > 0 ? -1 : 0,
        baseDeg: 0.000045,
        color: SPAN_COLOR.opgw,
        channelKey: 'opgw',
        enabled: groundWireConfig.opgw > 0,
      },
    ];

    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i];
      const b = points[i + 1];
      const geo = spanGeometry(a.lat, a.lng, b.lat, b.lng);
      if (!geo) continue;
      const cosLat = Math.cos(((a.lat + b.lat) / 2) * (Math.PI / 180));

      for (const ch of channels) {
        if (!ch.enabled) continue;
        const sn = (ch.sign * ch.baseDeg) / cosLat;
        const sl = ch.sign * ch.baseDeg;
        const [startLat, startLng] = offsetLatLng(a.lat, a.lng, geo, sn, sl);
        const [endLat, endLng] = offsetLatLng(b.lat, b.lng, geo, sn, sl);
        const entity = viewer.entities.add({
          polyline: {
            positions: Cesium.Cartesian3.fromDegreesArray([startLng, startLat, endLng, endLat]),
            width: 2,
            material: Cesium.Color.fromCssColorString(ch.color),
            clampToGround: true,
          },
        });
        entity.channelKey = ch.channelKey;
      }
    }

    // Per-tower 3D model (from an admin-extracted PLS-CADD KMZ), oriented by that
    // asset's construction status: lying flat once Ground Assembly (`er_ge`) is done but
    // Erection of Towers (`er_te`) isn't yet, standing upright once erection is done.
    // Not shown at all before ground assembly starts -- purely a visual cue layered on
    // top of the always-present point/label, same click behavior as before either way.
    const bearingByAssetId = new Map<string, number>();
    for (let i = 0; i < points.length; i++) {
      const prev = points[i - 1];
      const cur = points[i];
      const next = points[i + 1];
      if (prev) bearingByAssetId.set(cur.id, bearingDeg(prev.lat, prev.lng, cur.lat, cur.lng));
      else if (next) bearingByAssetId.set(cur.id, bearingDeg(cur.lat, cur.lng, next.lat, next.lng));
      else bearingByAssetId.set(cur.id, 0);
    }

    for (const asset of assets) {
      const segments = towerModels[asset.id];
      if (!segments || segments.length === 0) continue;
      const groundAssemblyPct = percentByAssetAndKey[asset.id]?.['er_ge'] ?? 0;
      const erectionPct = percentByAssetAndKey[asset.id]?.['er_te'] ?? 0;
      if (groundAssemblyPct < 100) continue;
      const lying = erectionPct < 100;

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

      const groundHeight = viewer.scene.globe.getHeight(Cesium.Cartographic.fromDegrees(lng, lat)) ?? 0;
      const basePosition = Cesium.Cartesian3.fromDegrees(lng, lat, groundHeight);
      const enuMatrix = Cesium.Transforms.eastNorthUpToFixedFrame(basePosition);
      const bearing = bearingByAssetId.get(asset.id) ?? 0;

      for (const seg of segments) {
        const [ae, an, au] = lying ? toLyingLocalPoint(seg.a[0], seg.a[1], seg.a[2], bearing) : seg.a;
        const [be, bn, bu] = lying ? toLyingLocalPoint(seg.b[0], seg.b[1], seg.b[2], bearing) : seg.b;
        const worldA = Cesium.Matrix4.multiplyByPoint(enuMatrix, new Cesium.Cartesian3(ae, an, au), new Cesium.Cartesian3());
        const worldB = Cesium.Matrix4.multiplyByPoint(enuMatrix, new Cesium.Cartesian3(be, bn, bu), new Cesium.Cartesian3());
        viewer.entities.add({
          polyline: {
            positions: [worldA, worldB],
            width: 1.5,
            material: Cesium.Color.fromCssColorString(lying ? '#94a3b8' : '#e5e7eb'),
          },
        });
      }
    }

    if (viewer.entities.values.length > 0) {
      viewer.flyTo(viewer.entities, { duration: 0 });
    }
  }, [
    assets,
    coordinateSystem,
    selectedAssetId,
    restrictedAssetIds,
    activeAssetIds,
    groundWireConfig,
    status,
    towerModels,
    percentByAssetAndKey,
  ]);

  // PLS-CADD KML/KMZ layers (its own tower wireframes/spans/tour paths, absolute
  // elevation) render via Cesium's own KmlDataSource -- a whole separate data source per
  // layer, not entities merged into `geoDataSource`, so absolute-altitude 3D geometry
  // isn't forced through the GeoJSON branch's `clampToGround` styling below.
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || (status !== 'ready' && status !== 'ready-flat')) return;
    let cancelled = false;

    const kmlLayers = geoLayers.filter((l) => KML_EXTENSIONS.test(l.url));
    const activeKmlIds = new Set(kmlLayers.map((l) => l.id));
    for (const [id, ds] of loadedKmlLayersRef.current) {
      if (!activeKmlIds.has(id)) {
        viewer.dataSources.remove(ds, true);
        loadedKmlLayersRef.current.delete(id);
      }
    }

    for (const kmlLayer of kmlLayers) {
      if (loadedKmlLayersRef.current.has(kmlLayer.id)) continue;
      const Cesium = window.Cesium;
      Cesium.KmlDataSource.load(kmlLayer.url, { clampToGround: false })
        .then((ds: any) => {
          if (cancelled || loadedKmlLayersRef.current.has(kmlLayer.id)) return;
          viewer.dataSources.add(ds);
          loadedKmlLayersRef.current.set(kmlLayer.id, ds);
        })
        .catch((err: unknown) => {
          onLayerErrorRef.current?.(kmlLayer.id, err instanceof Error ? err.message : 'Failed to load KML/KMZ layer');
        });
    }

    return () => {
      cancelled = true;
    };
  }, [geoLayers, status]);

  useEffect(() => {
    const dataSource = geoDataSourceRef.current;
    if (!dataSource || (status !== 'ready' && status !== 'ready-flat')) return;
    const Cesium = window.Cesium;
    let cancelled = false;

    const geoJsonLayers = geoLayers.filter((l) => !KML_EXTENSIONS.test(l.url));
    const activeIds = new Set(geoJsonLayers.map((l) => l.id));
    for (const [id, entities] of loadedGeoLayersRef.current) {
      if (!activeIds.has(id)) {
        for (const entity of entities) dataSource.entities.remove(entity);
        loadedGeoLayersRef.current.delete(id);
      }
    }

    for (const geoLayer of geoJsonLayers) {
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
