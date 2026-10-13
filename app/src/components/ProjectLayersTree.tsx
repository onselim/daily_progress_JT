import { useEffect, useMemo, useRef, useState } from 'react';
import type { LayerPart, StaticLayer } from '../lib/useProjectLayers';
import { useLanguage } from '../lib/i18n/LanguageContext';

interface Props {
  parts: LayerPart[];
  enabledLayerIds: Set<string>;
  onSetLayers: (ids: string[], on: boolean) => void;
  layerErrors: Record<string, string>;
}

/** One layer type (e.g. "Tower Area") with its file of every Part that has one. */
interface PivotLayer {
  name: string;
  byPart: Record<string, StaticLayer>;
}

/** One group of the source folders (e.g. "Access Roads Arrangement Plan"), across all Parts. */
interface PivotGroup {
  id: string;
  name: string;
  layers: PivotLayer[];
}

/** Regroups Part > Group > Layer into Group > Layer > (one file per Part): the whole line is switched on by layer type. */
function pivot(parts: LayerPart[]): PivotGroup[] {
  const groups = new Map<string, PivotGroup>();
  for (const part of parts) {
    for (const g of part.groups) {
      let pg = groups.get(g.id);
      if (!pg) {
        pg = { id: g.id, name: g.name, layers: [] };
        groups.set(g.id, pg);
      }
      for (const l of g.layers) {
        let pl = pg.layers.find((x) => x.name === l.name);
        if (!pl) {
          pl = { name: l.name, byPart: {} };
          pg.layers.push(pl);
        }
        pl.byPart[part.id] = l;
      }
    }
  }
  // Order of the source folders; any other group goes after them.
  const order = ['access-roads-arrangement-plan', 'buffer', 'center-line', 'combined-kmz-files', 'leg-extensions', 'tower-area', 'tower-centers', 'tree-cutting', 'working-area'];
  const rank = (id: string) => (order.includes(id) ? order.indexOf(id) : order.length);
  return Array.from(groups.values()).sort((a, b) => rank(a.id) - rank(b.id));
}

const idsOf = (layers: PivotLayer[]) => layers.flatMap((l) => Object.values(l.byPart).map((x) => x.id));

/** Checkbox that can show "some of them are on". */
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

export function ProjectLayersTree({ parts, enabledLayerIds, onSetLayers, layerErrors }: Props) {
  const { language } = useLanguage();
  const groups = useMemo(() => pivot(parts), [parts]);
  const [open, setOpen] = useState<Set<string>>(new Set());
  if (groups.length === 0) return null;

  const heading = language === 'tr' ? 'Proje katmanları (shapefile)' : 'Project layers (shapefiles)';
  const clearLabel = language === 'tr' ? 'Hepsini kapat' : 'Hide all';
  const allIds = groups.flatMap((g) => idsOf(g.layers));
  const anyOn = allIds.some((id) => enabledLayerIds.has(id));

  /** Part chips: switch the same layer on for one Part only. A chip is absent when that Part has no such layer. */
  function Chips({ layer }: { layer: PivotLayer }) {
    return (
      <span className="pl-chips">
        {parts.map((p) => {
          const l = layer.byPart[p.id];
          const on = !!l && enabledLayerIds.has(l.id);
          return (
            <button
              key={p.id}
              type="button"
              disabled={!l}
              className={`pl-chip${on ? ' on' : ''}`}
              title={l ? `${p.name} — ${l.count}` : `${p.name}: —`}
              onClick={() => l && onSetLayers([l.id], !on)}
            >
              {p.name.replace('Part-', '')}
              {l && layerErrors[l.id] && on ? '⚠' : ''}
            </button>
          );
        })}
      </span>
    );
  }

  function layerRow(layer: PivotLayer, label: string, child: boolean) {
    const ids = Object.values(layer.byPart).map((l) => l.id);
    return (
      <div key={`${label}`} className={`pl-row${child ? ' pl-child' : ''}`}>
        <TriCheck ids={ids} enabled={enabledLayerIds} onChange={(on) => onSetLayers(ids, on)} label={label} />
        <Chips layer={layer} />
      </div>
    );
  }

  return (
    <div className="pl-tree">
      <div className="pl-heading">
        <span>{heading}</span>
        {anyOn && (
          <button type="button" className="pl-clear" onClick={() => onSetLayers(allIds, false)}>
            {clearLabel}
          </button>
        )}
      </div>
      <div className="pl-partkey">{parts.map((p) => `${p.name.replace('Part-', '')} = ${p.name}`).join(' · ')}</div>
      {groups.map((g) => {
        // A group with a single layer type is one row; several layer types get a header with the types beneath it.
        if (g.layers.length === 1) return layerRow(g.layers[0], g.name, false);
        const ids = idsOf(g.layers);
        const isOpen = open.has(g.id);
        return (
          <div key={g.id}>
            <div className="pl-row">
              <button
                type="button"
                className="pl-chevron"
                onClick={() => setOpen((prev) => { const n = new Set(prev); if (n.has(g.id)) n.delete(g.id); else n.add(g.id); return n; })}
                aria-label={g.name}
              >
                {isOpen ? '▾' : '▸'}
              </button>
              <TriCheck ids={ids} enabled={enabledLayerIds} onChange={(on) => onSetLayers(ids, on)} label={g.name} />
            </div>
            {isOpen && g.layers.map((l) => layerRow(l, l.name, true))}
          </div>
        );
      })}
    </div>
  );
}
