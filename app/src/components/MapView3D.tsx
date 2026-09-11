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

interface MapView3DProps {
  assets: AssetListItem[];
  coordinateSystem: string | null;
  selectedAssetId: string;
  onSelect: (assetId: string) => void;
  restrictedAssetIds: Set<string>;
  activeAssetIds: Set<string>;
}

/** A realistic 3D alternative to the flat 2D `MapView` -- real terrain elevation
 * (Cesium World Terrain) draped with the same Google Satellite imagery the 2D map uses,
 * so mountains actually look like mountains. Deliberately a subset of the 2D map's
 * features (towers colored by status + click-to-select, single-line conductor spans) --
 * the heat map, deflection badges, existing-infrastructure layers, photo clusters, and
 * basemap switching stay 2D-only. See the project plan for the full scope rationale. */
export function MapView3D({
  assets,
  coordinateSystem,
  selectedAssetId,
  onSelect,
  restrictedAssetIds,
  activeAssetIds,
}: MapView3DProps) {
  const { t } = useLanguage();
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const [status, setStatus] = useState<'loading' | 'ready' | 'ready-flat' | 'error'>('loading');

  useEffect(() => {
    let cancelled = false;

    loadCesium()
      .then(async () => {
        if (cancelled || !containerRef.current) return;
        const Cesium = window.Cesium;

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

  return (
    <div className="map-view-3d-wrap">
      <div ref={containerRef} className="map-view" />
      {status === 'loading' && <div className="map-3d-status">{t('map.loading3D')}</div>}
      {status === 'error' && <div className="map-3d-status map-3d-status-error">{t('map.load3DFailed')}</div>}
      {status === 'ready-flat' && <div className="map-3d-hint">{t('map.terrainNeedsToken')}</div>}
    </div>
  );
}
