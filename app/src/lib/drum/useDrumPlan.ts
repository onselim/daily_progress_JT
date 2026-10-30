import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { resolveLinePath } from '../lineGeometry';
import type { AssetListItem } from '../useAssets';
import drumCoreJs from './drumCore';
import drumModelJs from './drumModel';

// drumCore / drumModel are the standalone tool's plain-JS engine (// @ts-nocheck); their
// results are loosely typed objects, so they are passed around as `any` here.
/* eslint-disable @typescript-eslint/no-explicit-any */
const drumCore: any = drumCoreJs;
const drumModel: any = drumModelJs;
export type DrumPlanResult = { R: any; model: any };

/** One drum list (e.g. one Part of the line). The towers themselves come from the project's map
 * data (assets: code, type, UTM x/y, z) — only the choices are stored and the plan is recomputed
 * from the live tower list on every load. */
export interface DrumSettings {
  version: 2;
  /** Stable id and display name of this list ("Part-2 (65–110)"). */
  id?: string;
  name?: string;
  savedAt: string;
  fromCode: string;
  toCode: string;
  baseCond: string;
  params: { maxDrum: number; bundle: number; circuits: number; roundStep: number; maxDrumByCond?: Record<string, number>; [k: string]: unknown };
  tensionTypes: Record<string, boolean>;
  /** Manual override: spans strung with a different conductor, with their own max drum length. */
  condRules: { from: string; to: string; cond: string; maxDrum: number }[];
  /** Third-party crossing spans (no joint; a single-span section is allowed there), as "39-40". */
  forbidSpans: string[];
  /** Spans the admin wants as their own single-span drum section (e.g. road / OHL crossing), as "141-142". */
  aloneSpans?: string[];
  /** Drums already in stock: used first, the rest is ordered. */
  stock?: DrumStockItem[];
  /** Order lengths changed by hand: "conductor|calculated length" → length to order. */
  orderOverrides?: Record<string, number>;
  /** Order issued: the plan as it was frozen, to compare later recalculations against. */
  frozen?: DrumFrozen | null;
}

export interface DrumStockItem {
  name: string;
  length: number;
  count: number;
  /** Conductor of these drums; empty = the line's main conductor. */
  cond: string;
}

export interface DrumFrozen {
  rev: number;
  date: string;
  note: string;
  /** Order list and sections exactly as issued. */
  groups: { cond: string; length: number; qty: number }[];
  sections: { name: string; cond: string; req: number; lengths: number[]; drums: number; drumNos: string }[];
}

/** Per-span data read once from the structure list(s): conductor and crossings, keyed "132-133". */
export type SpanInfo = Record<string, { cond?: string; cross?: string }>;

export interface LineTower {
  code: string;
  type: string;
  angle: number | null;
}

const KEY_LISTS = 'drum_plans';
const KEY_OLD = 'drum_plan';
const KEY_SPANS = 'span_info';

const newId = () => Math.random().toString(36).slice(2, 10);

export function useDrumSettings(projectId: string | undefined) {
  const [lists, setLists] = useState<DrumSettings[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [spanInfo, setSpanInfo] = useState<SpanInfo>({});
  const [circuits, setCircuits] = useState(1);
  // açıklamalar (bobin kullanımı, ek yerleri, uyarılar) raporun dilinde
  const [reportLang, setReportLang] = useState<'en' | 'tr'>('en');

  const refresh = useCallback(() => {
    if (!projectId) return;
    supabase
      .from('project_config')
      .select('key, value')
      .eq('project_id', projectId)
      .in('key', [KEY_LISTS, KEY_OLD, KEY_SPANS, 'circuit_type', 'report_languages'])
      .then(({ data }) => {
        const v = data?.find((r) => r.key === KEY_LISTS)?.value as { lists?: DrumSettings[] } | undefined;
        let ls = (v?.lists ?? []).filter((x) => x && x.version === 2);
        // eski tek-liste kaydı ("drum_plan") ilk liste olarak açılır
        if (!ls.length) {
          const old = data?.find((r) => r.key === KEY_OLD)?.value as DrumSettings | undefined;
          if (old && old.version === 2) ls = [{ ...old, id: old.id || 'list-1', name: old.name || `${old.fromCode}–${old.toCode}` }];
        }
        setLists(ls);
        setActiveId((cur) => (cur && ls.some((x) => x.id === cur) ? cur : ls[0]?.id ?? null));
        setSpanInfo((data?.find((r) => r.key === KEY_SPANS)?.value as SpanInfo) ?? {});
        const ct = data?.find((r) => r.key === 'circuit_type')?.value;
        setCircuits(ct === 'double' ? 2 : 1);
        const rl = data?.find((r) => r.key === 'report_languages')?.value;
        setReportLang(Array.isArray(rl) && rl[0] === 'tr' ? 'tr' : 'en');
      });
  }, [projectId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function writeLists(next: DrumSettings[]) {
    if (!projectId) return { error: 'No project' };
    const { error } = await supabase
      .from('project_config')
      .upsert({ project_id: projectId, key: KEY_LISTS, value: { lists: next } }, { onConflict: 'project_id,key' });
    if (!error) setLists(next);
    return { error: error?.message ?? null };
  }

  /** Saves (adds or replaces) one list and makes it the active one. */
  async function save(next: DrumSettings) {
    const item = { ...next, id: next.id || newId(), name: next.name || `${next.fromCode}–${next.toCode}` };
    const exists = lists.some((x) => x.id === item.id);
    const r = await writeLists(exists ? lists.map((x) => (x.id === item.id ? item : x)) : [...lists, item]);
    if (!r.error) setActiveId(item.id!);
    return r;
  }

  async function remove(id?: string) {
    const target = id ?? activeId;
    const next = lists.filter((x) => x.id !== target);
    const r = await writeLists(next);
    if (!r.error) setActiveId(next[0]?.id ?? null);
    return r;
  }

  async function saveSpanInfo(next: SpanInfo) {
    if (!projectId) return { error: 'No project' };
    const { error } = await supabase
      .from('project_config')
      .upsert({ project_id: projectId, key: KEY_SPANS, value: next }, { onConflict: 'project_id,key' });
    if (!error) setSpanInfo(next);
    return { error: error?.message ?? null };
  }

  const settings = lists.find((x) => x.id === activeId) ?? null;
  return { lists, settings, activeId, setActiveId, spanInfo, saveSpanInfo, circuits, reportLang, save, remove };
}

const bearing = (a: { x: number; y: number }, b: { x: number; y: number }) => (Math.atan2(b.x - a.x, b.y - a.y) * 180) / Math.PI;

/** The line's towers in stringing order (the same order the map draws the line in), with
 * the line deflection angle at each tower computed from the coordinates. */
export function lineTowers(assets: AssetListItem[], coordinateSystem: string | null) {
  const byId = new Map(assets.map((a) => [a.id, a]));
  const path = resolveLinePath(assets, coordinateSystem).filter((p) => p.x != null && p.y != null);
  const towers: (LineTower & { x: number; y: number; z: number | null })[] = path.map((p) => ({
    code: p.asset_code,
    type: (byId.get(p.id)?.asset_type || '?').replace(/\s+/g, ' ').trim(),
    angle: null,
    x: p.x as number,
    y: p.y as number,
    z: p.z,
  }));
  for (let i = 1; i < towers.length - 1; i++) {
    let d = bearing(towers[i], towers[i + 1]) - bearing(towers[i - 1], towers[i]);
    while (d > 180) d -= 360;
    while (d < -180) d += 360;
    towers[i].angle = Math.round(d * 100) / 100;
  }
  return towers;
}

/** "AC400/51", "ACSR 400/51", "400/51" → "400/51" (to compare conductor names). */
export const condKey = (c: string) => {
  const m = String(c || '').match(/(\d{2,4})\s*\/\s*(\d{2,4})/);
  return m ? `${m[1]}/${m[2]}` : String(c || '').trim();
};

/** Conductors present in a tower range, from the stored span data (main conductor first). */
export function condsInRange(towersAll: ReturnType<typeof lineTowers>, from: string, to: string, spanInfo: SpanInfo, baseCond: string) {
  let i0 = towersAll.findIndex((t) => t.code === from), i1 = towersAll.findIndex((t) => t.code === to);
  if (i0 < 0 || i1 < 0) return [baseCond];
  if (i0 > i1) [i0, i1] = [i1, i0];
  const out = new Set<string>([baseCond]);
  for (let j = i0; j < i1; j++) {
    const c = spanInfo[`${towersAll[j].code}-${towersAll[j + 1].code}`]?.cond;
    if (c && condKey(c) !== condKey(baseCond)) out.add(condKey(c));
  }
  return [...out];
}

export function buildDrumInput(towersAll: ReturnType<typeof lineTowers>, s: DrumSettings, lang: 'en' | 'tr' = 'en', spanInfo: SpanInfo = {}) {
  let i0 = towersAll.findIndex((t) => t.code === s.fromCode);
  let i1 = towersAll.findIndex((t) => t.code === s.toCode);
  if (i0 < 0 || i1 < 0) return { error: `T${i0 < 0 ? s.fromCode : s.toCode} haritadaki direklerde bulunamadı.` };
  if (i0 > i1) [i0, i1] = [i1, i0];
  const seg = towersAll.slice(i0, i1 + 1);
  const idx = new Map(seg.map((t, i) => [t.code, i]));
  const keyOf = (j: number) => `${seg[j].code}-${seg[j + 1].code}`;
  // 1) varsayılan: yapı listesinden okunmuş açıklık iletkeni; ana iletkenle aynıysa ana iletken adı
  const cond: string[] = seg.slice(0, -1).map((_, j) => {
    const c = spanInfo[keyOf(j)]?.cond;
    return c && condKey(c) !== condKey(s.baseCond) ? condKey(c) : s.baseCond;
  });
  const maxDrumByCond: Record<string, number> = { ...(s.params.maxDrumByCond ?? {}), [s.baseCond]: s.params.maxDrum };
  // 2) elle girilen kural varsayılanı ezer
  for (const r of s.condRules) {
    const a = idx.get(r.from), b = idx.get(r.to);
    if (a == null || b == null || a === b) continue;
    // iletken adı boş bırakılsa da kural uygulanır (ayrı bobinler, kendi en uzun boyu)
    const name = r.cond.trim() ? condKey(r.cond) : `${lang === 'en' ? 'Conductor' : 'İletken'} ${r.from}–${r.to}`;
    for (let j = Math.min(a, b); j < Math.max(a, b); j++) cond[j] = name;
    if (r.maxDrum > 0) maxDrumByCond[name] = r.maxDrum;
  }
  const norm = (x: string) => x.replace(/\s+/g, '').replace(/[–—]/g, '-');
  const forbid = new Set(s.forbidSpans.map(norm));
  const alone = new Set((s.aloneSpans ?? []).map(norm));
  const towers = seg.map((t, i) => ({ no: t.code, type: t.type, z: t.z, angle: i === 0 || i === seg.length - 1 ? null : t.angle }));
  const spans = seg.slice(0, -1).map((t, j) => {
    const cross = spanInfo[keyOf(j)]?.cross ?? '';
    return {
      plan: Math.hypot(seg[j + 1].x - t.x, seg[j + 1].y - t.y),
      cross,
      cond: cond[j],
      // 3. taraf geçişi: elle girilen ya da yapı listesindeki geçiş (asfalt yol, ENH, demiryolu, boru…)
      forbid: forbid.has(keyOf(j)) || drumCore.crossingForbidden(cross, drumCore.DEFAULT_FORBID),
      alone: alone.has(keyOf(j)),
    };
  });
  const tension = seg.map((t) => !!s.tensionTypes[t.type]);
  // Hemen her direği tension olan hatlarda (dağlık hat) tel çekimi her tension direğinde bölünmez;
  // büyük açılarda ve bobin etabı sonlarında bölünür.
  const pullEveryTension = tension.filter(Boolean).length / tension.length < 0.7;
  const stock = (s.stock ?? [])
    .filter((x) => x.length > 0 && x.count > 0)
    .map((x) => ({ name: x.name || 'Stock', length: x.length, count: x.count, cond: x.cond && condKey(x.cond) !== condKey(s.baseCond) ? condKey(x.cond) : s.baseCond }));
  return { towers, spans, tension, stock, params: { ...drumCore.DEFAULT_PARAMS, pullEveryTension, ...s.params, maxDrumByCond, orderOverrides: s.orderOverrides ?? {}, lang }, lang };
}

export function computeDrumPlan(input: ReturnType<typeof buildDrumInput>): DrumPlanResult {
  if ('error' in input) return { R: { errors: [input.error] }, model: null };
  const R = drumCore.computePlan(input);
  if (R.errors?.length) return { R, model: null };
  return { R, model: drumModel.rowModel(R, input.lang) };
}

/** Reads conductor and crossing per span from one or more structure lists (any of the formats the
 * engine understands) and keeps only spans that match the project's own towers: same tower
 * numbers AND about the same plan span length (within 20 m or 5 %), so a file with an older
 * numbering or a relocated tower cannot leak in. */
export function spanInfoFromSheets(sheets: unknown[][][], towersAll: ReturnType<typeof lineTowers>) {
  const dbSpan = new Map<string, number>();
  for (let j = 0; j < towersAll.length - 1; j++) {
    const a = towersAll[j], b = towersAll[j + 1];
    dbSpan.set(`${a.code}-${b.code}`, Math.hypot(b.x - a.x, b.y - a.y));
  }
  const out: SpanInfo = {};
  let read = 0, matched = 0;
  const rejected: string[] = [];
  for (const aoa of sheets) {
    const d = drumCore.extractRows(aoa, drumCore.autoDetect(aoa));
    for (let i = 0; i < d.towers.length - 1; i++) {
      read++;
      const key = `${d.towers[i].no}-${d.towers[i + 1].no}`;
      const len = dbSpan.get(key);
      const sp = d.spans[i];
      if (len == null || !(sp.plan > 0)) continue;
      if (Math.abs(sp.plan - len) > Math.max(20, 0.05 * len)) { rejected.push(`${key} (${Math.round(sp.plan)} / ${Math.round(len)} m)`); continue; }
      matched++;
      const prev = out[key] ?? {};
      out[key] = { cond: sp.cond || prev.cond || '', cross: sp.cross || prev.cross || '' };
    }
  }
  return { info: out, read, matched, total: dbSpan.size, rejected };
}

/** First guess for which tower types are tension: a type family whose towers usually carry a
 * line angle (median deflection >= 0.5 deg) is tension; suspension types sit on straights
 * (median ~0) even if a few of them show an angle. Gantries and the two ends count as tension. */
export function guessTensionTypes(towers: LineTower[]) {
  const fam = (t: string) => t.replace(/\s+/g, '').replace(/[+-]\d+(\.\d+)?(\(.*\))?$/, '').replace(/\(.*\)$/, '');
  const angles = new Map<string, number[]>();
  const forced = new Set<string>();
  towers.forEach((t, i) => {
    const f = fam(t.type);
    if (i === 0 || i === towers.length - 1 || /gantry/i.test(t.type)) forced.add(f);
    if (t.angle != null) angles.set(f, [...(angles.get(f) ?? []), Math.abs(t.angle)]);
  });
  const median = (v: number[]) => [...v].sort((a, b) => a - b)[Math.floor(v.length / 2)];
  const out: Record<string, boolean> = {};
  for (const t of towers) {
    const f = fam(t.type), v = angles.get(f);
    out[t.type] = forced.has(f) || (!!v && v.length > 0 && median(v) >= 0.5);
  }
  return out;
}

/** Snapshot of a computed plan for "order issued" (freeze), and the differences against it. */
export function snapshotOf(res: DrumPlanResult, rev: number, note: string): DrumFrozen {
  const { R, model } = res;
  return {
    rev,
    note,
    date: new Date().toISOString(),
    groups: R.main.groups.map((g: any) => ({ cond: g.cond, length: g.length, qty: g.qty })),
    sections: [...model.segInfo.values()].map((inf: any) => ({
      name: model.segName.get(inf.seg.id),
      cond: inf.seg.cond,
      req: Math.round(inf.seg.req),
      lengths: inf.lengths,
      drums: inf.drums,
      drumNos: inf.drumNos,
    })),
  };
}

export function diffFrozen(frozen: DrumFrozen, res: DrumPlanResult, lang: 'en' | 'tr') {
  const EN = lang === 'en';
  const now = snapshotOf(res, frozen.rev, '');
  const out: string[] = [];
  const key = (g: { cond: string; length: number }) => `${g.cond}|${g.length}`;
  const a = new Map(frozen.groups.map((g) => [key(g), g.qty]));
  const b = new Map(now.groups.map((g) => [key(g), g.qty]));
  for (const k of new Set([...a.keys(), ...b.keys()])) {
    const qa = a.get(k) ?? 0, qb = b.get(k) ?? 0;
    if (qa !== qb) {
      const [c, l] = k.split('|');
      out.push(EN ? `Order: ${l} m (${c}) — issued ${qa}, now ${qb}` : `Sipariş: ${l} m (${c}) — verilen ${qa}, şimdi ${qb}`);
    }
  }
  const sa = new Map(frozen.sections.map((s) => [s.name, s]));
  const sb = new Map(now.sections.map((s) => [s.name, s]));
  for (const [n, s] of sa) {
    const t = sb.get(n);
    if (!t) out.push(EN ? `Section ${n} no longer exists` : `${n} etabı artık yok`);
    else if (Math.abs(t.req - s.req) > 1 || t.lengths.join('/') !== s.lengths.join('/') || t.drums !== s.drums)
      out.push(EN
        ? `${n}: per phase ${s.req} → ${t.req} m, drums ${s.lengths.join('/') || '—'} × ${s.drums} → ${t.lengths.join('/') || '—'} × ${t.drums}`
        : `${n}: faz başına ${s.req} → ${t.req} m, bobin ${s.lengths.join('/') || '—'} × ${s.drums} → ${t.lengths.join('/') || '—'} × ${t.drums}`);
  }
  for (const n of sb.keys()) if (!sa.has(n)) out.push(EN ? `New section ${n}` : `Yeni etap ${n}`);
  return out;
}

/** "18 adet elle değiştirildi (hesap 2.000 — E4 (122–125), E12 (146–149)) · 24 adet hesaplanan (2.050)". */
export function manualText(
  parts: { calc: number; qty: number; manual: boolean; segs?: number[] }[],
  lang: 'en' | 'tr',
  nf: (v: number) => string,
  segName?: (id: number) => string,
) {
  const agg = new Map<string, { calc: number; qty: number; manual: boolean; segs: number[] }>();
  for (const p of parts) {
    const k = `${p.manual}|${p.calc}`;
    const cur = agg.get(k);
    if (cur) { cur.qty += p.qty; cur.segs.push(...(p.segs ?? [])); } else agg.set(k, { ...p, segs: [...(p.segs ?? [])] });
  }
  return [...agg.values()]
    .sort((a, b) => Number(b.manual) - Number(a.manual) || a.calc - b.calc)
    .map((p) => {
      const where = p.manual && segName && p.segs.length ? ` — ${[...new Set(p.segs)].sort((a, b) => a - b).map(segName).join(', ')}` : '';
      return lang === 'en'
        ? (p.manual ? `${p.qty} changed by hand (calc. ${nf(p.calc)}${where})` : `${p.qty} as calculated (${nf(p.calc)})`)
        : (p.manual ? `${p.qty} adet elle değiştirildi (hesap ${nf(p.calc)}${where})` : `${p.qty} adet hesaplanan (${nf(p.calc)})`);
    })
    .join(' · ');
}

export const drumColor = (st: { source: string; group: number }) => '#' + drumModel.setColor(st);
export { drumCore, drumModel };
