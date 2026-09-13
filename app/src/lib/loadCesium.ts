// CesiumJS is loaded from its own CDN, not bundled via npm -- shared between the 3D map
// view and the (admin-only, one-off) tower-model extraction utility so neither pays for
// its own copy of the loader, and so "already loaded" is a single module-scoped flag.
declare global {
  interface Window {
    Cesium?: any;
    CESIUM_BASE_URL?: string;
  }
}

const CESIUM_VERSION = '1.120';
export const CESIUM_BASE_URL = `https://cesium.com/downloads/cesiumjs/releases/${CESIUM_VERSION}/Build/Cesium/`;

let cesiumLoadPromise: Promise<void> | null = null;

/** Loads Cesium.js + its widget CSS from the CDN exactly once per page session
 * (cached at module scope), regardless of how many times it's requested. */
export function loadCesium(): Promise<void> {
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
