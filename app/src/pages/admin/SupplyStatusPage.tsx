import { useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useProjectBySlug } from '../../lib/useProject';
import { useAssets } from '../../lib/useAssets';
import { useAuth } from '../../lib/AuthContext';
import { useLanguage } from '../../lib/i18n/LanguageContext';
import { useAssetSupply, setSupplyStage } from '../../lib/useAssetSupply';
import { STAGE_META, SUPPLY_STAGES, LEG_COMPONENTS, legsSummary, stageLabel, type SupplyComponent, type SupplyStage } from '../../lib/supplyStatus';
import { parseTowerType } from '../../lib/useTowerWeightsConfig';

type Target = 'tower' | 'stub' | 'legs';

/** "1-65, 70 112-120" -> set of tower numbers. Returns null for text it cannot read. */
function parseNumbers(text: string): Set<number> | null {
  const out = new Set<number>();
  for (const tok of text.split(/[\s,;]+/).filter(Boolean)) {
    const m = tok.match(/^(\d+)(?:\s*[-–]\s*(\d+))?$/);
    if (!m) return null;
    const a = Number(m[1]);
    const b = m[2] ? Number(m[2]) : a;
    for (let i = Math.min(a, b); i <= Math.max(a, b); i += 1) out.add(i);
  }
  return out;
}

const stageRank = (s: SupplyStage | undefined) => SUPPLY_STAGES.indexOf(s ?? 'not_ordered');

/** Admin page: set the material stage of many towers at once (tower steel, stub, leg extensions) -- e.g. after a shipment arrives.
 * Towers are shown as coloured tiles; tap to select, then tap the new status. */
export default function SupplyStatusPage() {
  const { slug } = useParams<{ slug: string }>();
  const { language } = useLanguage();
  const tr = language === 'tr';
  const { user } = useAuth();
  const { project, loading, error } = useProjectBySlug(slug);
  const { assets } = useAssets(project?.id);
  const { statuses, refresh } = useAssetSupply(project?.id);

  const [target, setTarget] = useState<Target>('tower');
  const [family, setFamily] = useState('');
  const [typed, setTyped] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const lastIndex = useRef<number | null>(null);

  const towers = useMemo(
    () =>
      assets
        .filter((a) => /^\d+$/.test(a.asset_code) && parseTowerType(a.asset_type))
        .map((a) => ({ ...a, no: Number(a.asset_code), family: parseTowerType(a.asset_type)!.type }))
        .sort((a, b) => a.no - b.no),
    [assets],
  );
  const families = useMemo(() => [...new Set(towers.map((t) => t.family))].sort(), [towers]);
  const visible = useMemo(() => (family ? towers.filter((t) => t.family === family) : towers), [towers, family]);

  const components: SupplyComponent[] = target === 'legs' ? [...LEG_COMPONENTS] : [target];
  /** Stage of a tower for the chosen tab; for the four legs the least advanced one decides. */
  const stageOf = (id: string): SupplyStage => {
    const stages = components.map((c) => statuses[id]?.[c] ?? 'not_ordered');
    return stages.reduce((low, s) => (stageRank(s) < stageRank(low) ? s : low), stages[0]);
  };

  const counts = useMemo(() => {
    const c = Object.fromEntries(SUPPLY_STAGES.map((s) => [s, 0])) as Record<SupplyStage, number>;
    for (const t of visible) c[stageOf(t.id)] += 1;
    return c;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, statuses, target]);

  function toggle(index: number, shift: boolean) {
    const next = new Set(selected);
    if (shift && lastIndex.current != null) {
      const [a, b] = [Math.min(lastIndex.current, index), Math.max(lastIndex.current, index)];
      for (let i = a; i <= b; i += 1) next.add(visible[i].id);
    } else if (next.has(visible[index].id)) next.delete(visible[index].id);
    else next.add(visible[index].id);
    lastIndex.current = index;
    setSelected(next);
    setMessage(null);
  }

  function addTyped() {
    const nums = parseNumbers(typed);
    if (!nums) {
      setMessage(tr ? 'Numaralar okunamadı. Örnek: 1-20, 25' : 'Cannot read the numbers. Example: 1-20, 25');
      return;
    }
    const next = new Set(selected);
    for (const t of visible) if (nums.has(t.no)) next.add(t.id);
    setSelected(next);
    setTyped('');
    setMessage(null);
  }

  function selectStage(stage: SupplyStage) {
    setSelected(new Set(visible.filter((t) => stageOf(t.id) === stage).map((t) => t.id)));
    setMessage(null);
  }

  async function apply(stage: SupplyStage) {
    const ids = visible.filter((t) => selected.has(t.id)).map((t) => t.id);
    if (!ids.length) return;
    const what = target === 'tower' ? (tr ? 'direk gövdesi' : 'tower body') : target === 'stub' ? 'stub' : tr ? 'ayaklar' : 'legs';
    const ok = window.confirm(
      tr ? `${ids.length} direğin ${what} durumu "${stageLabel(stage, language)}" yapılsın mı?` : `Set ${what} of ${ids.length} towers to "${stageLabel(stage, language)}"?`,
    );
    if (!ok) return;
    setBusy(true);
    setMessage(null);
    try {
      for (const c of components) await setSupplyStage(ids, c, stage, user?.id);
      refresh();
      setSelected(new Set());
      setMessage(tr ? `✓ ${ids.length} direk "${stageLabel(stage, language)}" yapıldı.` : `✓ ${ids.length} towers set to "${stageLabel(stage, language)}".`);
    } catch (e) {
      setMessage((tr ? 'Hata: ' : 'Error: ') + (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="page-loading">Loading…</div>;
  if (error || !project) return <div className="page-loading">Project not found</div>;

  const tabs: { key: Target; label: string }[] = [
    { key: 'tower', label: tr ? 'Direk gövdesi' : 'Tower body' },
    { key: 'stub', label: 'Stub' },
    { key: 'legs', label: tr ? 'Ayaklar (A-D)' : 'Legs (A-D)' },
  ];

  return (
    <div className="project-shell">
      <header className="project-topbar">
        <div className="project-topbar-left">
          <Link to={`/admin/${project.slug}`}>← {project.name}</Link>
          <h1>{tr ? 'Malzeme durumu (sevkiyat girişi)' : 'Material status (shipment entry)'}</h1>
        </div>
      </header>

      <div className="wizard-page ss-page">
        <div className="wizard-form">
          <ol className="ss-steps">
            <li>{tr ? 'Neyin durumunu değiştireceğinizi seçin (gövde / stub / ayaklar).' : 'Pick what to update (body / stub / legs).'}</li>
            <li>
              {tr
                ? 'Direk kutularına tıklayarak seçin. Shift ile tıklarsanız iki direk arasının hepsi seçilir.'
                : 'Tap the tower tiles to select them. Shift+click selects everything in between.'}
            </li>
            <li>{tr ? 'Sayfanın altından yeni durumu seçin.' : 'Tap the new status at the bottom of the page.'}</li>
          </ol>

          <div className="ss-tabs">
            {tabs.map((t) => (
              <button key={t.key} type="button" className={target === t.key ? 'active' : ''} onClick={() => setTarget(t.key)}>
                {t.label}
              </button>
            ))}
          </div>

          <div className="ss-legend">
            <span className="ss-legend-hint">{tr ? 'Duruma göre seç:' : 'Select by status:'}</span>
            {SUPPLY_STAGES.map((s) => (
              <button key={s} type="button" className="ss-chip" style={{ borderColor: STAGE_META[s].color }} onClick={() => selectStage(s)} disabled={counts[s] === 0}>
                <i style={{ background: STAGE_META[s].color }} />
                {stageLabel(s, language)} <b>{counts[s]}</b>
              </button>
            ))}
          </div>

          <div className="ss-tools">
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addTyped()}
              placeholder={tr ? 'Numara yaz: 1-20, 25' : 'Type numbers: 1-20, 25'}
            />
            <button type="button" onClick={addTyped} disabled={!typed.trim()}>
              {tr ? 'Ekle' : 'Add'}
            </button>
            <select value={family} onChange={(e) => setFamily(e.target.value)} title={tr ? 'Aile' : 'Family'}>
              <option value="">{tr ? 'Tüm aileler' : 'All families'}</option>
              {families.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
            <button type="button" onClick={() => setSelected(new Set(visible.map((t) => t.id)))}>
              {tr ? 'Hepsini seç' : 'Select all'}
            </button>
            <button type="button" onClick={() => setSelected(new Set())} disabled={selected.size === 0}>
              {tr ? 'Temizle' : 'Clear'}
            </button>
          </div>

          <div className="ss-grid">
            {visible.map((t, i) => {
              const st = stageOf(t.id);
              const legs = legsSummary(statuses[t.id]);
              const title = `${t.no} ${t.asset_type ?? ''} — ${stageLabel(st, language)}${target === 'legs' ? ` (${legs.made}/4)` : ''}`;
              return (
                <button
                  key={t.id}
                  type="button"
                  title={title}
                  className={`ss-tile${selected.has(t.id) ? ' sel' : ''}`}
                  style={{ background: STAGE_META[st].color }}
                  onClick={(e) => toggle(i, e.shiftKey)}
                >
                  <b>{t.no}</b>
                  <small>{t.asset_type?.replace(/\s*\(.*\)$/, '')}</small>
                </button>
              );
            })}
          </div>
        </div>

        <div className="ss-bar">
          <div className="ss-bar-info">
            {message ? (
              <span className={message.startsWith('✓') ? 'ss-msg' : 'ss-bad'}>{message}</span>
            ) : selected.size === 0 ? (
              tr ? 'Önce yukarıdan direk seçin.' : 'Select towers above first.'
            ) : (
              <b>
                {selected.size} {tr ? 'direk seçili → yeni durum:' : 'towers selected → new status:'}
              </b>
            )}
          </div>
          <div className="ss-bar-stages">
            {SUPPLY_STAGES.map((s) => (
              <button key={s} type="button" className="ss-stage-btn" disabled={busy || selected.size === 0} style={{ background: STAGE_META[s].color }} onClick={() => apply(s)}>
                {stageLabel(s, language)}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
