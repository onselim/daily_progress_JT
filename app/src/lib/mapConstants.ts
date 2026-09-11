// Shared between the 2D (Leaflet) and 3D (Cesium) map views so both stay visually
// consistent -- same status colors, same default imagery source.

export const STATUS_COLOR: Record<string, string> = {
  not_started: '#3d4259',
  in_progress: '#00d4aa',
  completed: '#3b82f6',
  on_hold: '#ef4444',
};

export const GOOGLE_SATELLITE_URL_TEMPLATE = 'https://mt{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}';
