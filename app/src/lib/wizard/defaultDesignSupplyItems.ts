import type { WorkItemConfig } from '../useProjectConfig';

export const DEFAULT_DESIGN_ITEMS: WorkItemConfig[] = [
  { key: 'line_route', label: 'Line Route', weight: 50 },
  { key: 'line_profile', label: 'Line Profile', weight: 50 },
];

export const DEFAULT_SUPPLY_ITEMS: WorkItemConfig[] = [
  { key: 'stubs', label: 'Stubs', weight: 7.5 },
  { key: 'earthing', label: 'Earthing', weight: 2.5 },
  { key: 'towers', label: 'Towers', weight: 32 },
  { key: 'conductor', label: 'Conductor (route km)', weight: 30 },
  { key: 'ew', label: 'EW (route km)', weight: 5 },
  { key: 'opgw', label: 'OPGW (route km)', weight: 5 },
  { key: 'insulators', label: 'Insulators (route km)', weight: 6 },
  { key: 'hardware', label: 'Hardware (route km)', weight: 7 },
  { key: 'dampers', label: 'Dampers (route km)', weight: 4 },
  { key: 'other_accessories', label: 'Other Accessories', weight: 1 },
];
