import { useEffect, useRef, useState } from 'react';
import type { LayerGroup, LayerPart, StaticLayer } from '../lib/useProjectLayers';
import { useLanguage } from '../lib/i18n/LanguageContext';

interface Props {
  parts: LayerPart[];
  enabledLayerIds: Set<string>;
  onSetLayers: (ids: string[], on: boolean) => void;
  layerErrors: Record<string, string>;
}

/** Checkbox that can show "some of the children are on". */
function TriCheck({ ids, enabled, onChange, label, strong }: { ids: string[]; enabled: Set<string>; onChange: (on: boolean) => void; label: string; strong?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  const on = ids.filter((id) => enabled.has(id)).length;
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = on > 0 && on < ids.length;
  }, [on, ids.length]);
  return (
    <label className={`pl-check${strong ? ' pl-strong' : ''}`}>
      <input ref={ref} type="checkbox" checked={ids.length > 0 && on === ids.length} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

function layerIds(layers: StaticLayer[]) {
  return layers.map((l) => l.id);
}

/** Layers other than the combined KMZ (which repeats everything the other layers draw). */
function individualIds(part: LayerPart) {
  return layerIds(part.groups.flatMap((g) => (g.id === 'combined-kmz-files' ? [] : g.layers)));
}

export function ProjectLayersTree({ parts, enabledLayerIds, onSetLayers, layerErrors }: Props) {
  const { language } = useLanguage();
  const [openParts, setOpenParts] = useState<Set<string>>(new Set(parts.length > 0 ? [parts[0].id] : []));
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  const toggle = (set: Set<string>, id: string) => {
    const n = new Set(set);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    return n;
  };
  if (parts.length === 0) return null;

  const heading = language === 'tr' ? 'Proje katmanları (shapefile)' : 'Project layers (shapefiles)';
  const allHint = language === 'tr' ? 'Birleşik KMZ hariç hepsi' : 'everything except the combined KMZ';

  function renderGroup(part: LayerPart, g: LayerGroup) {
    const key = `${part.id}/${g.id}`;
    const ids = layerIds(g.layers);
    // A group with a single layer is just one row; several layers get a header plus one row each.
    if (g.layers.length === 1) {
      const l = g.layers[0];
      return (
        <div key={key} className="pl-row">
          <TriCheck ids={ids} enabled={enabledLayerIds} onChange={(on) => onSetLayers(ids, on)} label={g.name} />
          <span className="pl-meta">
            {l.count}
            {l.ownColors ? ` · ${l.kb} KB` : ''}
          </span>
          {layerErrors[l.id] && enabledLayerIds.has(l.id) && <span className="layer-toggle-error" title={layerErrors[l.id]}>⚠</span>}
        </div>
      );
    }
    const open = openGroups.has(key);
    return (
      <div key={key}>
        <div className="pl-row">
          <button type="button" className="pl-chevron" onClick={() => setOpenGroups(toggle(openGroups, key))} aria-label={g.name}>
            {open ? '▾' : '▸'}
          </button>
          <TriCheck ids={ids} enabled={enabledLayerIds} onChange={(on) => onSetLayers(ids, on)} label={g.name} />
        </div>
        {open &&
          g.layers.map((l) => (
            <div key={l.id} className="pl-row pl-child">
              <TriCheck ids={[l.id]} enabled={enabledLayerIds} onChange={(on) => onSetLayers([l.id], on)} label={l.name} />
              <span className="pl-meta">{l.count}</span>
              {layerErrors[l.id] && enabledLayerIds.has(l.id) && <span className="layer-toggle-error" title={layerErrors[l.id]}>⚠</span>}
            </div>
          ))}
      </div>
    );
  }

  return (
    <div className="pl-tree">
      <div className="pl-heading">{heading}</div>
      {parts.map((part) => {
        const open = openParts.has(part.id);
        const ids = individualIds(part);
        return (
          <div key={part.id} className="pl-part">
            <div className="pl-row">
              <button type="button" className="pl-chevron" onClick={() => setOpenParts(toggle(openParts, part.id))} aria-label={part.name}>
                {open ? '▾' : '▸'}
              </button>
              <span title={allHint}>
                <TriCheck ids={ids} enabled={enabledLayerIds} onChange={(on) => onSetLayers(ids, on)} label={part.name} strong />
              </span>
            </div>
            {open && <div className="pl-groups">{part.groups.map((g) => renderGroup(part, g))}</div>}
          </div>
        );
      })}
    </div>
  );
}
