import { Fragment, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import * as XLSX from 'xlsx';
import { useLanguage } from '../lib/i18n/LanguageContext';
import { Part1EtapPlan } from './ConductorDrumsView';
import {
  buildDrumInput,
  computeDrumPlan,
  condKey,
  condsInRange,
  diffFrozen,
  drumColor,
  guessTensionTypes,
  manualText,
  snapshotOf,
  spanInfoFromSheets,
  type DrumPlanResult,
  type DrumSettings,
  type DrumStockItem,
  type SpanInfo,
  type lineTowers,
} from '../lib/drum/useDrumPlan';

type Towers = ReturnType<typeof lineTowers>;

interface DrumListPanelProps {
  projectId?: string;
  isAdmin: boolean;
  towers: Towers;
  baseCond: string;
  circuits: number;
  reportLang: 'en' | 'tr';
  /** All saved lists (e.g. one per Part) and the one shown. */
  lists: DrumSettings[];
  activeId: string | null;
  onSelectList: (id: string) => void;
  settings: DrumSettings | null;
  result: DrumPlanResult | null;
  onSave: (s: DrumSettings) => Promise<{ error: string | null }>;
  onRemove: (id?: string) => Promise<{ error: string | null }>;
  /** Conductor / crossing per span, read once from the structure list(s). */
  spanInfo: SpanInfo;
  onSaveSpanInfo: (info: SpanInfo) => Promise<{ error: string | null }>;
  showOnMap: boolean;
  onToggleMap: () => void;
  /** Yazdırılabilir özet sayfası (A3) */
  printHref: string;
  selectedSeg: number | null;
  onSelectSeg: (segId: number | null) => void;
}

const fmt = (v: number, d = 0) => v.toLocaleString('tr-TR', { minimumFractionDigits: d, maximumFractionDigits: d });

/** Admin panel: the conductor drum list (iletken bobin listesi), built from the project's
 * own towers on the map — pick the range, bundle / circuits / max drum length and which
 * tower types are tension; the result is listed here and drawn on the map. */
export function DrumListPanel({
  projectId, isAdmin, towers, baseCond, circuits, reportLang, lists, activeId, onSelectList, settings, result, onSave, onRemove,
  spanInfo, onSaveSpanInfo, showOnMap, onToggleMap, printHref, selectedSeg, onSelectSeg,
}: DrumListPanelProps) {
  const { language } = useLanguage();
  const tr = language === 'tr';
  const [draft, setDraft] = useState<DrumSettings | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const [spanMsg, setSpanMsg] = useState('');
  // elle düzenlemeler açılır penceresi: düğmenin konumu (null = kapalı)
  const [ovAnchor, setOvAnchor] = useState<DOMRect | null>(null);
  useEffect(() => {
    if (!ovAnchor) return;
    const close = (e: KeyboardEvent) => e.key === 'Escape' && setOvAnchor(null);
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [ovAnchor]);

  function startEdit(asNew = false) {
    setErr('');
    if (settings && !asNew) {
      setDraft(structuredClone(settings));
      return;
    }
    // yeni liste: bir öncekinin bundle / bobin ayarlarıyla başlar, aralık ve ad boş
    setDraft({
      version: 2,
      savedAt: '',
      name: '',
      fromCode: towers[0]?.code ?? '',
      toCode: towers[towers.length - 1]?.code ?? '',
      baseCond,
      params: settings ? { ...settings.params } : { maxDrum: 3000, bundle: 2, circuits, roundStep: 25 },
      tensionTypes: settings ? { ...settings.tensionTypes } : guessTensionTypes(towers),
      condRules: [],
      forbidSpans: [],
      aloneSpans: [],
      stock: [],
      frozen: null,
    });
  }

  const draftResult = useMemo(
    () => (draft ? computeDrumPlan(buildDrumInput(towers, draft, reportLang, spanInfo)) : null),
    [draft, towers, reportLang, spanInfo],
  );

  // yapı listesinden açıklık iletkeni + geçiş bilgisi (bir kez; birden fazla dosya seçilebilir)
  async function importSpanInfo(files: FileList) {
    setErr('');
    setSpanMsg('');
    try {
      const sheets: unknown[][][] = [];
      for (const f of Array.from(files)) {
        const wb = XLSX.read(await f.arrayBuffer(), { type: 'array' });
        for (const n of wb.SheetNames) sheets.push(XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: null }) as unknown[][]);
      }
      const { info, matched, total, rejected } = spanInfoFromSheets(sheets, towers);
      if (!matched) throw new Error(tr ? 'Dosyadaki açıklıklar haritadaki direklerle eşleşmedi.' : 'No span in the file matched the project towers.');
      setBusy(true);
      const r = await onSaveSpanInfo({ ...spanInfo, ...info });
      setBusy(false);
      if (r.error) throw new Error(r.error);
      const cc = Object.values(info).filter((x) => x.cond && condKey(x.cond) !== condKey(baseCond)).length;
      setSpanMsg(
        tr
          ? `${Object.keys(info).length} açıklık kaydedildi (projede ${total} açıklık); ${cc} açıklık farklı iletkenli.` +
              (rejected.length ? ` Boyu haritadakinden farklı olduğu için alınmayan: ${rejected.slice(0, 6).join(', ')}${rejected.length > 6 ? ` … (+${rejected.length - 6})` : ''}.` : '')
          : `${Object.keys(info).length} spans saved (project has ${total}); ${cc} spans with another conductor.` +
              (rejected.length ? ` Skipped (length differs from the map): ${rejected.slice(0, 6).join(', ')}${rejected.length > 6 ? ` … (+${rejected.length - 6})` : ''}.` : ''),
      );
    } catch (e) {
      setBusy(false);
      setErr(String((e as Error).message || e));
    }
  }

  // haritadan / listeden: tek bir açıklığın iletken tipini elle değiştir (proje verisine yazılır)
  // sipariş boyunu elle değiştir: hesaplanan boy anahtarıyla saklanır; boş bırakılırsa hesaplanana döner
  async function setOrderLength(keys: string[], current: number, minNeed: number) {
    if (!settings) return;
    const v = window.prompt(
      tr
        ? `Sipariş edilecek bobin boyu (m). En az ${minNeed} m olmalı. Hesaplanan boya dönmek için boş bırakın:`
        : `Drum length to order (m). Must be at least ${minNeed} m. Leave empty to go back to the calculated length:`,
      String(current),
    );
    if (v === null) return;
    const n = Math.round(+v.replace(',', '.'));
    const next = { ...(settings.orderOverrides ?? {}) };
    if (!v.trim()) keys.forEach((k) => delete next[k]);
    else if (!(n > 0) || n < minNeed) {
      setErr(tr ? `Geçersiz boy: en az ${minNeed} m olmalı (bu bobinlerden en çok ${minNeed} m kullanılıyor).` : `Invalid length: at least ${minNeed} m is needed.`);
      return;
    } else keys.forEach((k) => (next[k] = n));
    setErr('');
    setBusy(true);
    const r = await onSave({ ...settings, orderOverrides: next, savedAt: new Date().toISOString() });
    setBusy(false);
    if (r.error) setErr(r.error);
  }

  async function setSpanCond(key: string, current: string) {
    const v = window.prompt(
      tr
        ? `${key.replace('-', '–')} açıklığının iletkeni (ör. 500/204). Ana iletken (${baseCond}) için boş bırakın:`
        : `Conductor of span ${key.replace('-', '–')} (e.g. 500/204). Leave empty for the main conductor (${baseCond}):`,
      current,
    );
    if (v === null) return;
    setBusy(true);
    const r = await onSaveSpanInfo({ ...spanInfo, [key]: { ...(spanInfo[key] ?? {}), cond: v.trim() ? condKey(v) : '' } });
    setBusy(false);
    if (r.error) setErr(r.error);
  }

  const spanInfoCount = Object.keys(spanInfo).length;
  const otherCondSpans = Object.entries(spanInfo).filter(([, v]) => v.cond && condKey(v.cond) !== condKey(baseCond));
  const spanInfoBlock = isAdmin && (
    <div className="drum-spaninfo">
      <div className="drum-muted">
        {spanInfoCount
          ? tr
            ? `Açıklık bilgisi kayıtlı: ${spanInfoCount} açıklık · farklı iletken: ${otherCondSpans.length} açıklık (${[...new Set(otherCondSpans.map(([, v]) => condKey(v.cond!)))].join(', ') || '—'})`
            : `Span data stored: ${spanInfoCount} spans · other conductor: ${otherCondSpans.length} spans (${[...new Set(otherCondSpans.map(([, v]) => condKey(v.cond!)))].join(', ') || '—'})`
          : tr
            ? 'Açıklık bazında iletken / geçiş bilgisi henüz yok. Yapı listesinden bir kez alınır; sonra her listede kendiliğinden kullanılır.'
            : 'No per-span conductor / crossing data yet. Read it once from the structure list; every list then uses it automatically.'}
      </div>
      <label className="drum-btn">
        📥 {tr ? 'Yapı listesinden açıklık bilgisi al (iletken, geçiş)' : 'Read span data from structure list (conductor, crossings)'}
        <input type="file" accept=".xls,.xlsx,.xlsm" multiple hidden onChange={(e) => e.target.files?.length && importSpanInfo(e.target.files)} />
      </label>
      {spanMsg && <div className="drum-ok">{spanMsg}</div>}
    </div>
  );

  async function saveDraft() {
    if (!draft) return;
    setBusy(true);
    const r = await onSave({ ...draft, savedAt: new Date().toISOString() });
    setBusy(false);
    if (r.error) setErr(r.error);
    else setDraft(null);
  }

  // haritadan / listeden: açıklığı ayrı tek açıklıklı etap yap ya da geri al — hemen kaydedilir
  async function toggleAlone(key: string) {
    if (!settings) return;
    const cur = settings.aloneSpans ?? [];
    const next = cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key];
    setBusy(true);
    const r = await onSave({ ...settings, aloneSpans: next, savedAt: new Date().toISOString() });
    setBusy(false);
    if (r.error) setErr(r.error);
    else onSelectSeg(null);
  }

  const codeOptions = towers.map((t) => <option key={t.code} value={t.code}>{t.code}</option>);

  // ------------------------------------------------------------ ayar formu
  if (draft) {
    const i0 = towers.findIndex((t) => t.code === draft.fromCode), i1 = towers.findIndex((t) => t.code === draft.toCode);
    const inRange = towers.slice(Math.min(i0, i1), Math.max(i0, i1) + 1);
    const types = [...new Set(inRange.map((t) => t.type))].sort();
    const conds = [...new Set(draft.condRules.map((r) => r.cond.trim()).filter(Boolean))];
    const setP = (k: string, v: number) => setDraft({ ...draft, params: { ...draft.params, [k]: v } });
    const setRule = (i: number, patch: Partial<DrumSettings['condRules'][number]>) =>
      setDraft({ ...draft, condRules: draft.condRules.map((r, k) => (k === i ? { ...r, ...patch } : r)) });
    const R = draftResult?.R;
    return (
      <div className="drum-panel">
        <div className="drum-muted">
          {tr ? 'Direkler haritadaki proje verisinden alınır (koordinat, kot, tip); açıklık ve açılar koordinatlardan hesaplanır.' : 'Towers come from the project map data; spans and angles are computed from the coordinates.'}
        </div>
        <label className="drum-form-wide">
          {tr ? 'Liste adı (ör. Part-2)' : 'List name (e.g. Part-2)'}
          <input value={draft.name ?? ''} placeholder={`${draft.fromCode}–${draft.toCode}`} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
        </label>
        <div className="drum-form">
          <label>
            {tr ? 'İlk direk' : 'From'}
            <select value={draft.fromCode} onChange={(e) => setDraft({ ...draft, fromCode: e.target.value })}>{codeOptions}</select>
          </label>
          <label>
            {tr ? 'Son direk' : 'To'}
            <select value={draft.toCode} onChange={(e) => setDraft({ ...draft, toCode: e.target.value })}>{codeOptions}</select>
          </label>
          <label>
            {tr ? 'Devre' : 'Circuit'}
            <select value={String(draft.params.circuits)} onChange={(e) => setP('circuits', +e.target.value)}>
              <option value="1">{tr ? 'Tek devre' : 'Single'}</option>
              <option value="2">{tr ? 'Çift devre' : 'Double'}</option>
            </select>
          </label>
          <label>
            Bundle
            <select value={String(draft.params.bundle)} onChange={(e) => setP('bundle', +e.target.value)}>
              <option value="1">Single</option>
              <option value="2">Twin</option>
              <option value="3">Triple</option>
              <option value="4">Quad</option>
            </select>
          </label>
          <label>
            {tr ? 'En uzun bobin' : 'Max drum'} · {draft.baseCond} (m)
            <input type="number" value={draft.params.maxDrum} onChange={(e) => setP('maxDrum', +e.target.value)} />
          </label>
          {condsInRange(towers, draft.fromCode, draft.toCode, spanInfo, draft.baseCond).slice(1).map((c) => {
            const v = draft.params.maxDrumByCond?.[c];
            return (
              <label key={c}>
                {tr ? 'En uzun bobin' : 'Max drum'} · {c} (m)
                <input
                  type="number"
                  className={v ? '' : 'drum-missing'}
                  value={v ?? ''}
                  placeholder={tr ? 'girin' : 'enter'}
                  onChange={(e) => setDraft({ ...draft, params: { ...draft.params, maxDrumByCond: { ...(draft.params.maxDrumByCond ?? {}), [c]: +e.target.value } } })}
                />
              </label>
            );
          })}
          <label>
            {tr ? 'Yuvarlama (m)' : 'Rounding (m)'}
            <input type="number" value={draft.params.roundStep} onChange={(e) => setP('roundStep', +e.target.value)} />
          </label>
        </div>
        {spanInfoBlock}

        <div className="drum-cond-count">
          {3 * draft.params.circuits} {tr ? 'faz' : 'phases'} × {draft.params.bundle} = <b>{3 * draft.params.circuits * draft.params.bundle}</b>{' '}
          {tr ? 'iletken (her açıklıkta)' : 'conductors per span'}
        </div>
        <div className="drum-sub">{tr ? 'Tension direk tipleri' : 'Tension tower types'}</div>
        <div className="drum-types">
          {types.map((t) => (
            <label key={t} className={draft.tensionTypes[t] ? 'on' : ''}>
              <input
                type="checkbox"
                checked={!!draft.tensionTypes[t]}
                onChange={(e) => setDraft({ ...draft, tensionTypes: { ...draft.tensionTypes, [t]: e.target.checked } })}
              />
              {t}
            </label>
          ))}
        </div>

        <div className="drum-sub">{tr ? 'Farklı iletkenli açıklıklar — elle düzeltme (yapı listesindekini ezer)' : 'Spans with another conductor — manual override'}</div>
        {draft.condRules.map((r, i) => (
          <div key={i} className="drum-rule">
            <label>
              {tr ? 'Direk' : 'Tower'}
              <span className="drum-rule-pair">
                <select value={r.from} onChange={(e) => setRule(i, { from: e.target.value })}>{codeOptions}</select>
                <span>→</span>
                <select value={r.to} onChange={(e) => setRule(i, { to: e.target.value })}>{codeOptions}</select>
              </span>
            </label>
            <button type="button" className="drum-btn danger" onClick={() => setDraft({ ...draft, condRules: draft.condRules.filter((_, k) => k !== i) })}>✕</button>
            <label>
              {tr ? 'İletken' : 'Conductor'}
              <input
                className={r.cond.trim() ? '' : 'drum-missing'}
                placeholder={tr ? 'iletken adı yazın' : 'type conductor'}
                value={r.cond}
                onChange={(e) => setRule(i, { cond: e.target.value })}
              />
            </label>
            <label>
              {tr ? 'En uzun bobin (m)' : 'Max drum (m)'}
              <input type="number" value={r.maxDrum} onChange={(e) => setRule(i, { maxDrum: +e.target.value })} />
            </label>
          </div>
        ))}
        <button
          type="button"
          className="drum-btn"
          onClick={() => setDraft({ ...draft, condRules: [...draft.condRules, { from: draft.fromCode, to: draft.fromCode, cond: '', maxDrum: 1500 }] })}
        >
          + {tr ? 'Açıklık aralığı ekle (ör. geçiş açıklığı)' : 'Add span range (e.g. crossing span)'}
        </button>

        <label className="drum-form-wide">
          {tr
            ? '3. taraf izinli geçiş açıklıkları (asfalt yol, ENH, demiryolu, boru hattı) — ör. 39-40, 51-52. Bu açıklıklarda ek yapılmaz; tel çekimini kısaltmak için tek açıklıklı etap olabilir.'
            : 'Third-party crossing spans (asphalt road, OHL, railway, pipeline) — e.g. 39-40, 51-52. No joints there; a single-span section is allowed to keep the pull short.'}
          <input
            value={draft.forbidSpans.join(', ')}
            onChange={(e) => setDraft({ ...draft, forbidSpans: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })}
          />
        </label>
        <label className="drum-form-wide">
          {tr
            ? 'Ayrı tek açıklıklı etap olacak açıklıklar — ör. 141-142 (haritada etaba tıklayıp açıklığı seçerek de eklenir)'
            : 'Spans forced as their own single-span section — e.g. 141-142 (also set by clicking a section and a span)'}
          <input
            value={(draft.aloneSpans ?? []).join(', ')}
            onChange={(e) => setDraft({ ...draft, aloneSpans: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })}
          />
        </label>

        <div className="drum-sub">{tr ? 'Eldeki stok bobinler (önce bunlar kullanılır)' : 'Drums in stock (used first)'}</div>
        {(draft.stock ?? []).map((st, i) => {
          const setStock = (patch: Partial<DrumStockItem>) =>
            setDraft({ ...draft, stock: (draft.stock ?? []).map((x, k) => (k === i ? { ...x, ...patch } : x)) });
          return (
            <div key={i} className="drum-rule">
              <label>
                {tr ? 'Ad / kaynak' : 'Name / source'}
                <input value={st.name} onChange={(e) => setStock({ name: e.target.value })} />
              </label>
              <button type="button" className="drum-btn danger" onClick={() => setDraft({ ...draft, stock: (draft.stock ?? []).filter((_, k) => k !== i) })}>✕</button>
              <label>
                {tr ? 'Boy (m)' : 'Length (m)'}
                <input type="number" value={st.length} onChange={(e) => setStock({ length: +e.target.value })} />
              </label>
              <label>
                {tr ? 'Adet' : 'Count'}
                <input type="number" value={st.count} onChange={(e) => setStock({ count: +e.target.value })} />
              </label>
              {conds.length > 0 && (
                <label>
                  {tr ? 'İletken' : 'Conductor'}
                  <select value={st.cond || draft.baseCond} onChange={(e) => setStock({ cond: e.target.value })}>
                    {[draft.baseCond, ...conds.filter((c) => c !== draft.baseCond)].map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </label>
              )}
            </div>
          );
        })}
        <button
          type="button"
          className="drum-btn"
          onClick={() => setDraft({ ...draft, stock: [...(draft.stock ?? []), { name: tr ? 'Stok' : 'Stock', length: draft.params.maxDrum, count: 3, cond: draft.baseCond }] })}
        >
          + {tr ? 'Stok bobin satırı' : 'Stock drum row'}
        </button>

        {R && (R.errors?.length ? (
          <div className="drum-err">{R.errors[0]}</div>
        ) : (
          <div className="drum-summary">
            <span>
              <b>{fmt(R.main.drumCount)}</b> {tr ? 'bobin' : 'drums'} · {fmt(R.main.orderedLen)} m · {R.segments.length} {tr ? 'etap' : 'sections'} · {R.joints.length} {tr ? 'ek' : 'joints'}
            </span>
          </div>
        ))}
        {err && <div className="drum-err">{err}</div>}
        <div className="drum-actions">
          <button type="button" className="drum-btn primary" disabled={busy || !!R?.errors?.length} onClick={saveDraft}>
            {busy ? '…' : tr ? 'Kaydet' : 'Save'}
          </button>
          <button type="button" className="drum-btn" onClick={() => setDraft(null)}>{tr ? 'Vazgeç' : 'Cancel'}</button>
        </div>
      </div>
    );
  }

  if (!settings || !result) {
    return (
      <div className="drum-panel">
        <p className="accordion-empty">
          {tr
            ? 'Henüz bobin listesi yok. Haritadaki direklerden hesaplanır: aralığı ve bundle / bobin boyunu seçmeniz yeterli.'
            : 'No drum list yet. It is computed from the towers on the map — just pick the range, bundle and drum length.'}
        </p>
        {isAdmin && (
          <button type="button" className="drum-btn primary" onClick={() => startEdit(true)} disabled={towers.length < 2}>
            {tr ? 'Bobin listesi oluştur' : 'Create drum list'}
          </button>
        )}
        {spanInfoBlock}
        {err && <div className="drum-err">{err}</div>}
      </div>
    );
  }

  const { R, model } = result;
  if (!model) {
    return (
      <div className="drum-panel">
        <div className="drum-err">{R.errors?.[0]}</div>
        {isAdmin && <button type="button" className="drum-btn" onClick={() => startEdit()}>✏ {tr ? 'Ayarlar' : 'Settings'}</button>}
      </div>
    );
  }
  const P = R.main, S = R.summary;
  const fire = P.supplied - S.sagCond;
  const multi = new Set(R.segments.map((s: { cond: string }) => s.cond)).size > 1;
  const first = R.towers[0].no, last = R.towers[R.towers.length - 1].no;
  const segs = [...model.segInfo.values()];
  const frozen = settings.frozen ?? null;
  const changes = frozen ? diffFrozen(frozen, result, reportLang) : [];

  // sipariş verildi: o anki listeyi revizyon numarası ve tarihle sakla
  async function freeze() {
    if (!settings || !result) return;
    const rev = (settings.frozen?.rev ?? 0) + 1;
    const note = window.prompt(tr ? `Rev ${rev} — not (ör. sipariş no / tarih):` : `Rev ${rev} — note (e.g. order no / date):`, '') ?? null;
    if (note === null) return;
    setBusy(true);
    const r = await onSave({ ...settings, frozen: snapshotOf(result, rev, note), savedAt: new Date().toISOString() });
    setBusy(false);
    if (r.error) setErr(r.error);
  }
  async function unfreeze() {
    if (!settings || !window.confirm(tr ? 'Dondurma kaldırılsın mı? (Kayıtlı sipariş revizyonu silinir.)' : 'Remove the freeze? (The stored order revision is deleted.)')) return;
    setBusy(true);
    const r = await onSave({ ...settings, frozen: null, savedAt: new Date().toISOString() });
    setBusy(false);
    if (r.error) setErr(r.error);
  }

  return (
    <div className="drum-panel">
      {/* listeler (ör. Part-1, Part-2, Part-3): her biri ayrı kaydedilir */}
      <div className="drum-listbar">
        <select value={activeId ?? ''} onChange={(e) => { onSelectSeg(null); onSelectList(e.target.value); }}>
          {lists.map((l) => (
            <option key={l.id} value={l.id}>
              {(l.name || `${l.fromCode}–${l.toCode}`) + (l.frozen ? ` 🔒 Rev ${l.frozen.rev}` : '')}
            </option>
          ))}
        </select>
        {isAdmin && (
          <button type="button" className="drum-btn" onClick={() => startEdit(true)}>+ {tr ? 'Yeni liste' : 'New list'}</button>
        )}
      </div>
      {frozen ? (
        <div className={`drum-frozen${changes.length ? ' changed' : ''}`}>
          <div>
            🔒 <b>{tr ? 'Sipariş verildi' : 'Order issued'} — Rev {frozen.rev}</b> · {new Date(frozen.date).toLocaleDateString('tr-TR')}
            {frozen.note ? ` · ${frozen.note}` : ''}
          </div>
          {changes.length ? (
            <>
              <div><b>{tr ? 'Verilen siparişten farklar (harita / ayar değişti):' : 'Differences from the issued order (map / settings changed):'}</b></div>
              {changes.slice(0, 8).map((c, i) => <div key={i}>• {c}</div>)}
              {changes.length > 8 && <div>… +{changes.length - 8}</div>}
            </>
          ) : (
            <div>{tr ? 'Güncel hesap verilen siparişle aynı.' : 'The current calculation matches the issued order.'}</div>
          )}
          {isAdmin && (
            <div className="drum-actions">
              {changes.length > 0 && (
                <button type="button" className="drum-btn" disabled={busy} onClick={freeze}>{tr ? `Rev ${frozen.rev + 1} olarak dondur` : `Freeze as Rev ${frozen.rev + 1}`}</button>
              )}
              <button type="button" className="drum-btn danger" disabled={busy} onClick={unfreeze}>{tr ? 'Dondurmayı kaldır' : 'Unfreeze'}</button>
            </div>
          )}
        </div>
      ) : (
        isAdmin && (
          <button type="button" className="drum-btn" disabled={busy} onClick={freeze}>
            🔒 {tr ? 'Sipariş verildi — listeyi dondur' : 'Order issued — freeze this list'}
          </button>
        )
      )}
      <div className="drum-summary">
        <div>
          <b>T{first} → T{last}</b> · {['', 'single', 'twin', 'triple', 'quad'][S.B]} · {S.phases === 6 ? (tr ? 'çift devre' : 'double circuit') : tr ? 'tek devre' : 'single circuit'} · {S.cond} {tr ? 'iletken' : 'conductors'}
        </div>
        <div>
          <b>{fmt(P.drumCount)}</b> {tr ? 'bobin' : 'drums'} · {fmt(P.orderedLen)} m · {tr ? 'fire' : 'waste'} {fmt(fire)} m (%{fmt((fire / S.sagCond) * 100, 2)})
        </div>
        <div className="drum-muted">
          {R.segments.length} {tr ? 'etap' : 'sections'} · {R.joints.length} {tr ? 'ara ek' : 'mid-span joints'} · {R.pulls.length} {tr ? 'tel çekimi' : 'pulls'}
        </div>
      </div>
      <button type="button" className="drum-btn" onClick={() => window.open(printHref, '_blank')}>
        🖨 {tr ? 'Bobin listesi özeti (yazdır)' : 'Print drum list summary'}
      </button>
      <button type="button" className={`drum-btn map${showOnMap ? ' active' : ''}`} onClick={onToggleMap}>
        🗺 {showOnMap ? (tr ? 'Haritadan kaldır' : 'Hide on map') : tr ? 'Haritada göster' : 'Show on map'}
      </button>

      {P.stockUsed > 0 && (
        <div className="drum-muted">
          {tr ? 'Stoktan kullanılan' : 'Taken from stock'}: <b>{P.stockUsed}</b> {tr ? 'bobin' : 'drums'} ({fmt(P.stockUsedLen)} m)
          {P.stock.some((d: { used: number | null }) => !d.used) &&
            ` · ${tr ? 'kullanılmayan stok' : 'unused stock'}: ${P.stock.filter((d: { used: number | null }) => !d.used).length}`}
        </div>
      )}
      <div className="drum-sub">{tr ? 'Sipariş' : 'Order'}{isAdmin ? (tr ? ' — boya tıklayıp elle değiştirebilirsiniz' : ' — click a length to change it') : ''}</div>
      {Object.keys(settings.orderOverrides ?? {}).length > 0 && (() => {
        // elle düzenlemeler: tıklayınca ne değiştiği açılır; her birinin ve hepsinin iptal düğmesi
        const ov = settings.orderOverrides ?? {};
        const keys = Object.keys(ov);
        const saveOv = async (next: Record<string, number>) => {
          setBusy(true);
          const r = await onSave({ ...settings, orderOverrides: next, savedAt: new Date().toISOString() });
          setBusy(false);
          if (r.error) setErr(r.error);
        };
        const infoOf = (k: string) => {
          const [cond, calc] = k.split('|');
          for (const g of P.groups as { keys: string[]; parts: { calc: number; qty: number; manual: boolean; segs?: number[] }[] }[]) {
            if (!g.keys.includes(k)) continue;
            const parts = g.parts.filter((x) => x.manual && x.calc === +calc);
            const qty = parts.reduce((a, x) => a + x.qty, 0);
            const segIds = [...new Set(parts.flatMap((x) => x.segs ?? []))].sort((a, b) => a - b);
            return { cond, calc: +calc, qty, segIds, applied: qty > 0 };
          }
          return { cond, calc: +calc, qty: 0, segIds: [] as number[], applied: false };
        };
        return (
          <div className="drum-ov">
            <div className="drum-ov-bar">
              <button
                type="button"
                className={`drum-btn${ovAnchor ? ' active' : ''}`}
                onClick={(e) => { const rect = e.currentTarget.getBoundingClientRect(); setOvAnchor((cur) => (cur ? null : rect)); }}
              >
                ✎ {tr ? `Elle düzenlemeler (${keys.length})` : `Manual changes (${keys.length})`} {ovAnchor ? '▴' : '▾'}
              </button>
              {isAdmin && (
                <button
                  type="button"
                  className="drum-btn danger"
                  disabled={busy}
                  onClick={() => {
                    if (window.confirm(tr ? 'Bütün elle düzenlemeler iptal edilsin mi? Hesaplanan boylara dönülür.' : 'Cancel all manual changes? The calculated lengths are restored.')) saveOv({});
                  }}
                >
                  ↺ {tr ? 'Tümünü iptal et' : 'Cancel all'}
                </button>
              )}
            </div>
            {ovAnchor && createPortal(
              <>
                <div className="drum-pop-backdrop" onClick={() => setOvAnchor(null)} />
                <div
                  className="drum-panel drum-pop"
                  style={{
                    top: Math.min(ovAnchor.bottom + 6, window.innerHeight - 260),
                    left: Math.max(8, Math.min(ovAnchor.right - 380, window.innerWidth - 388)),
                  }}
                >
                  <div className="drum-pop-head">
                    <b>✎ {tr ? 'Elle düzenlenen sipariş boyları' : 'Order lengths changed by hand'}</b>
                    <button type="button" className="drum-btn small" onClick={() => setOvAnchor(null)}>✕</button>
                  </div>
              <div className="drum-ov-list">
                {keys.map((k) => {
                  const inf = infoOf(k);
                  return (
                    <div key={k} className={`drum-ov-row${inf.applied ? '' : ' stale'}`}>
                      <span>
                        <b>{fmt(inf.calc)} → {fmt(ov[k])} m</b> · {inf.cond}
                        {inf.applied
                          ? ` · ${inf.qty} ${tr ? 'adet' : 'drums'} · ${inf.segIds.map((id) => model.segName.get(id)).join(', ')}`
                          : ` · ${tr ? 'şu an uygulanmıyor (hesap değişti ya da boy kısa)' : 'not applied now (calculation changed or length too short)'}`}
                      </span>
                      {isAdmin && (
                        <button
                          type="button"
                          className="drum-btn danger small"
                          disabled={busy}
                          title={tr ? 'Bu düzenlemeyi iptal et' : 'Cancel this change'}
                          onClick={() => { const next = { ...ov }; delete next[k]; saveOv(next); }}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
                  {isAdmin && (
                    <button
                      type="button"
                      className="drum-btn danger"
                      disabled={busy}
                      onClick={() => {
                        if (window.confirm(tr ? 'Bütün elle düzenlemeler iptal edilsin mi? Hesaplanan boylara dönülür.' : 'Cancel all manual changes? The calculated lengths are restored.')) { saveOv({}); setOvAnchor(null); }
                      }}
                    >
                      ↺ {tr ? 'Tümünü iptal et' : 'Cancel all'}
                    </button>
                  )}
                </div>
              </>,
              document.body,
            )}
          </div>
        );
      })()}
      {(P.unusedOverrides?.length > 0 || P.overrideErrors?.length > 0) && (
        <div className="drum-warn">
          {P.overrideErrors?.map((e: { key: string; length: number; need: number }) => (
            <div key={e.key}>⚠ {tr ? `${e.key.split('|')[1]} m için girilen ${e.length} m kısa — en az ${e.need} m gerekir; hesaplanan boy kullanıldı.` : `${e.length} m entered for ${e.key.split('|')[1]} m is too short — at least ${e.need} m is needed; the calculated length is used.`}</div>
          ))}
          {P.unusedOverrides?.length > 0 && (
            <div>⚠ {tr ? 'Hesap değiştiği için uygulanamayan elle düzeltmeler: ' : 'Manual changes that no longer match the calculation: '}{P.unusedOverrides.map((k: string) => `${k.split('|')[1]} m → ${settings.orderOverrides?.[k]} m`).join(', ')}</div>
          )}
        </div>
      )}
      <table className="drum-table">
        <tbody>
          {P.groups.map((g: { id: number; length: number; qty: number; cond: string; manual?: boolean; keys: string[]; parts: { calc: number; qty: number; manual: boolean; segs?: number[] }[]; sets: { source: string; group: number; total: number; pieces: { seg: { id: number }; req: number }[] }[] }) => {
            // her setin "sahibi" en uzun parçanın etabı; etaplar direk numaralarıyla
            const segIds = [...new Set(g.sets.map((st) => [...st.pieces].sort((a, b) => b.req - a.req)[0].seg.id))].sort((a, b) => a - b);
            return (
              <Fragment key={g.id}>
                <tr className="drum-group-row">
                  <td><i className="drum-sw" style={{ background: drumColor(g.sets[0]) }} /></td>
                  <td className="num">
                    {isAdmin ? (
                      <button
                        type="button"
                        className={`drum-len-btn${g.manual ? ' manual' : ''}`}
                        disabled={busy}
                        title={tr ? 'Sipariş boyunu elle değiştir' : 'Change the order length by hand'}
                        onClick={() => setOrderLength(g.keys, g.length, Math.ceil(Math.max(...g.sets.map((s) => s.total))))}
                      >
                        {g.manual ? '✎ ' : ''}<b>{fmt(g.length)}</b> m
                      </button>
                    ) : (
                      <><b>{fmt(g.length)}</b> m</>
                    )}
                    {g.manual && <div className="drum-muted">✎ {manualText(g.parts, tr ? 'tr' : 'en', (x) => fmt(x), (id) => model.segName.get(id))}</div>}
                  </td>
                  <td className="num">× {g.qty}</td>
                  {multi && <td className="drum-muted">{g.cond}</td>}
                </tr>
                <tr className="drum-group-segs">
                  <td />
                  <td colSpan={multi ? 3 : 2} className="drum-muted">{segIds.map((id) => model.segName.get(id)).join(', ')}</td>
                </tr>
              </Fragment>
            );
          })}
          <tr className="drum-total">
            <td />
            <td className="num">{fmt(P.orderedLen)} m</td>
            <td className="num">{P.orderedDrums}</td>
            {multi && <td />}
          </tr>
        </tbody>
      </table>

      <div className="drum-sub">{tr ? 'Etaplar' : 'Sections'}</div>
      <div className="drum-segs">
        {segs.map((inf) => {
          const sg = inf.seg;
          return (
            <button
              key={sg.id}
              type="button"
              className={`drum-seg${selectedSeg === sg.id ? ' active' : ''}`}
              onClick={() => onSelectSeg(selectedSeg === sg.id ? null : sg.id)}
              title={inf.usage}
            >
              <i className="drum-sw big" style={{ background: '#' + inf.color }}>E{sg.id}</i>
              <span className="drum-seg-main">
                <b>{inf.from} → {inf.to}</b>
                <span className="drum-muted">
                  {fmt(sg.req)} m · {sg.cond}
                  {sg.passBig.length ? ' · ⚠ ' + sg.passBig.map((i: number) => 'T' + R.towers[i].no).join(',') : ''}
                </span>
              </span>
              <span className="drum-seg-drum">
                {inf.lengths.length ? `${inf.lengths.join('/')} × ${inf.drums}` : tr ? 'artandan' : 'leftover'}
              </span>
            </button>
          );
        })}
      </div>
      {selectedSeg != null && model.segInfo.get(selectedSeg) && (
        <div className="drum-usage">
          <div>
            <b>
              E{selectedSeg} · {model.segInfo.get(selectedSeg).from} → {model.segInfo.get(selectedSeg).to} · {model.segInfo.get(selectedSeg).seg.cond}
            </b>
          </div>
          <div>
            {fmt(model.segInfo.get(selectedSeg).seg.req)} m / {reportLang === 'en' ? 'phase' : 'faz'}
            {model.segInfo.get(selectedSeg).lengths.length ? ` · ${model.segInfo.get(selectedSeg).lengths.join('/')} m × ${model.segInfo.get(selectedSeg).drums}` : ''}
          </div>
          <div>{model.segInfo.get(selectedSeg).usage}</div>
          {isAdmin && (() => {
            // etabın açıklıkları: tıklanan açıklık ayrı, tek açıklıklı etap olur (yol / ENH geçişi)
            const sg = model.segInfo.get(selectedSeg).seg;
            const a = sg.startLoc.tower ?? sg.startLoc.span;
            const b = sg.endLoc.tower ?? sg.endLoc.span + 1;
            const keys: string[] = [];
            for (let j = a; j < b; j++) keys.push(`${R.towers[j].no}-${R.towers[j + 1].no}`);
            const aloneSet = new Set(settings.aloneSpans ?? []);
            return (
              <div className="drum-spans">
                <div className="drum-sub">
                  {tr ? 'Açıklıklar — tıklayın: ayrı tek açıklıklı etap (yol / ENH geçişi)' : 'Spans — click: make it its own single-span section (road / OHL crossing)'}
                </div>
                <div className="drum-span-chips">
                  {keys.map((k) => (
                    <button
                      key={k}
                      type="button"
                      disabled={busy}
                      className={`drum-span-chip${aloneSet.has(k) ? ' on' : ''}`}
                      onClick={() => toggleAlone(k)}
                      title={aloneSet.has(k) ? (tr ? 'Ayrı etap — kaldırmak için tıklayın' : 'Own section — click to undo') : ''}
                    >
                      {k.replace('-', '–')}
                    </button>
                  ))}
                </div>
                <div className="drum-sub">
                  {tr ? 'İletken tipi — tıklayıp değiştirin (projeye kaydedilir, bütün listeler kullanır)' : 'Conductor — click to change (saved to the project, used by every list)'}
                </div>
                <div className="drum-span-chips">
                  {keys.map((k) => {
                    const c = spanInfo[k]?.cond && condKey(spanInfo[k]!.cond!) !== condKey(baseCond) ? condKey(spanInfo[k]!.cond!) : '';
                    return (
                      <button
                        key={k}
                        type="button"
                        disabled={busy}
                        className={`drum-span-chip cond${c ? ' other' : ''}`}
                        onClick={() => setSpanCond(k, c)}
                        title={spanInfo[k]?.cross ? `${tr ? 'Geçiş' : 'Crossing'}: ${spanInfo[k]!.cross}` : ''}
                      >
                        {k.replace('-', '–')}: {c || baseCond}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </div>
      )}
      {isAdmin && settings && (settings.aloneSpans?.length ?? 0) > 0 && (
        <div className="drum-muted">
          {tr ? 'Ayrı tek açıklıklı etaplar: ' : 'Forced single-span sections: '}
          {settings.aloneSpans!.map((k) => (
            <button key={k} type="button" className="drum-span-chip on small" disabled={busy} onClick={() => toggleAlone(k)} title={tr ? 'Kaldır' : 'Remove'}>
              {k.replace('-', '–')} ✕
            </button>
          ))}
        </div>
      )}
      {isAdmin && (
        <div className="drum-actions">
          <button type="button" className="drum-btn" onClick={() => startEdit()}>✏ {tr ? 'Ayarlar' : 'Settings'}</button>
          <button
            type="button"
            className="drum-btn danger"
            onClick={() => { if (window.confirm(tr ? 'Bu bobin listesi silinsin mi?' : 'Delete this drum list?')) onRemove(); }}
          >
            🗑
          </button>
        </div>
      )}
      {projectId && <Part1EtapPlan projectId={projectId} />}
      {spanInfoBlock}
      {err && <div className="drum-err">{err}</div>}
    </div>
  );
}
