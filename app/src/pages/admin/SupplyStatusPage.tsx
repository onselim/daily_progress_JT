import { useMemo, useState } from 'react';
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

/** Admin page: set the material stage of many towers at once (tower steel, stub, leg extensions) -- e.g. after a shipment arrives. */
export default function SupplyStatusPage() {
  const { slug } = useParams<{ slug: string }>();
  const { language } = useLanguage();
  const tr = language === 'tr';
  const { user } = useAuth();
  const { project, loading, error } = useProjectBySlug(slug);
  const { assets } = useAssets(project?.id);
  const { statuses, refresh } = useAssetSupply(project?.id);

  const [target, setTarget] = useState<Target>('tower');
  const [numbers, setNumbers] = useState('');
  const [family, setFamily] = useState('');
  const [firstN, setFirstN] = useState('');
  const [stage, setStage] = useState<SupplyStage>('delivered');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const towers = useMemo(
    () =>
      assets
        .filter((a) => /^\d+$/.test(a.asset_code) && parseTowerType(a.asset_type))
        .map((a) => ({ ...a, no: Number(a.asset_code), family: parseTowerType(a.asset_type)!.type }))
        .sort((a, b) => a.no - b.no),
    [assets],
  );
  const families = useMemo(() => [...new Set(towers.map((t) => t.family))].sort(), [towers]);

  const components: SupplyComponent[] = target === 'legs' ? [...LEG_COMPONENTS] : [target];
  const current = (id: string): SupplyStage | undefined => {
    const stages = components.map((c) => statuses[id]?.[c]);
    // the least advanced of the selected components decides whether a tower still needs the new stage
    return stages.reduce<SupplyStage | undefined>((low, s) => (stageRank(s) < stageRank(low) ? s : low), stages[0] ?? undefined);
  };

  const parsed = numbers.trim() ? parseNumbers(numbers) : null;
  const numbersBad = numbers.trim() !== '' && parsed === null;
  const selected = useMemo(() => {
    let list = towers;
    if (parsed) list = list.filter((t) => parsed.has(t.no));
    else if (!numbers.trim() && !family) return [];
    if (family) list = list.filter((t) => t.family === family);
    const n = Number(firstN);
    if (n > 0) list = list.filter((t) => stageRank(current(t.id)) < stageRank(stage)).slice(0, n);
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [towers, parsed, numbers, family, firstN, stage, statuses, target]);

  const counts = useMemo(() => {
    const rows: { label: string; counts: Record<SupplyStage, number> }[] = [];
    const base = (label: string, pick: (id: string) => SupplyStage | undefined) => {
      const c = Object.fromEntries(SUPPLY_STAGES.map((s) => [s, 0])) as Record<SupplyStage, number>;
      for (const t of towers) c[pick(t.id) ?? 'not_ordered'] += 1;
      rows.push({ label, counts: c });
    };
    base(tr ? 'Direk gövdesi' : 'Tower body', (id) => statuses[id]?.tower);
    base('Stub', (id) => statuses[id]?.stub);
    LEG_COMPONENTS.forEach((c, i) => base(`${tr ? 'Ayak' : 'Leg'} ${'ABCD'[i]}`, (id) => statuses[id]?.[c]));
    return rows;
  }, [towers, statuses, tr]);

  async function apply() {
    if (!selected.length) return;
    setBusy(true);
    setMessage(null);
    try {
      for (const c of components) await setSupplyStage(selected.map((t) => t.id), c, stage, user?.id);
      refresh();
      setMessage(tr ? `${selected.length} direk güncellendi.` : `${selected.length} towers updated.`);
    } catch (e) {
      setMessage((tr ? 'Hata: ' : 'Error: ') + (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="page-loading">Loading…</div>;
  if (error || !project) return <div className="page-loading">Project not found</div>;

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
          <h2>{tr ? 'Toplu durum güncelle' : 'Bulk status update'}</h2>
          <p className="wizard-hint">
            {tr
              ? 'Hangi direklerin ne durumda olduğunu seçin. Direk numaralarını yazabilir ("1-65, 70, 112-120") ya da bir aile seçip ilk N direğe uygulayabilirsiniz.'
              : 'Choose which towers changed state. Type tower numbers ("1-65, 70, 112-120") or pick a family and apply to the first N.'}
          </p>

          <label>
            {tr ? 'Neyin durumu' : 'What'}
            <select value={target} onChange={(e) => setTarget(e.target.value as Target)}>
              <option value="tower">{tr ? 'Direk gövdesi' : 'Tower body'}</option>
              <option value="stub">Stub</option>
              <option value="legs">{tr ? 'Ayaklar (A, B, C, D hepsi)' : 'Leg extensions (all four)'}</option>
            </select>
          </label>

          <label>
            {tr ? 'Direk numaraları' : 'Tower numbers'}
            <input value={numbers} onChange={(e) => setNumbers(e.target.value)} placeholder="1-65, 70, 112-120" />
          </label>
          {numbersBad && <div className="ss-bad">{tr ? 'Numaralar okunamadı. Örnek: 1-65, 70' : 'Cannot read numbers. Example: 1-65, 70'}</div>}

          <div className="wizard-form-row">
            <label>
              {tr ? 'Aile (isteğe bağlı)' : 'Family (optional)'}
              <select value={family} onChange={(e) => setFamily(e.target.value)}>
                <option value="">{tr ? 'Hepsi' : 'All'}</option>
                {families.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {tr ? 'Yalnızca ilk N direk' : 'Only the first N'}
              <input value={firstN} onChange={(e) => setFirstN(e.target.value.replace(/\D/g, ''))} placeholder={tr ? 'boş = hepsi' : 'blank = all'} />
            </label>
          </div>

          <label>
            {tr ? 'Yeni durum' : 'New status'}
            <select value={stage} onChange={(e) => setStage(e.target.value as SupplyStage)}>
              {SUPPLY_STAGES.map((s) => (
                <option key={s} value={s}>
                  {stageLabel(s, language)}
                </option>
              ))}
            </select>
          </label>

          <div className="ss-preview">
            {selected.length === 0
              ? tr
                ? 'Henüz direk seçilmedi.'
                : 'No towers selected yet.'
              : `${selected.length} ${tr ? 'direk' : 'towers'}: ${selected
                  .slice(0, 60)
                  .map((t) => t.no)
                  .join(', ')}${selected.length > 60 ? ' …' : ''}`}
          </div>

          <button type="button" className="ss-apply" disabled={busy || selected.length === 0} onClick={apply}>
            {busy ? '…' : tr ? `${selected.length} direğe uygula` : `Apply to ${selected.length} towers`}
          </button>
          {message && <div className="ss-msg">{message}</div>}
        </div>

        <div className="wizard-form ss-summary">
          <h2>{tr ? 'Şu anki durum' : 'Current status'}</h2>
          <table>
            <thead>
              <tr>
                <th />
                {SUPPLY_STAGES.map((s) => (
                  <th key={s} style={{ color: STAGE_META[s].color }}>
                    {stageLabel(s, language)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {counts.map((r) => (
                <tr key={r.label}>
                  <td>{r.label}</td>
                  {SUPPLY_STAGES.map((s) => (
                    <td key={s}>{r.counts[s]}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="wizard-form ss-summary">
          <h2>{tr ? 'Direk listesi' : 'Tower list'}</h2>
          <div className="ss-list">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>{tr ? 'Tip' : 'Type'}</th>
                  <th>{tr ? 'Gövde' : 'Body'}</th>
                  <th>Stub</th>
                  <th>{tr ? 'Ayaklar' : 'Legs'}</th>
                </tr>
              </thead>
              <tbody>
                {towers.map((t) => {
                  const st = statuses[t.id];
                  const legs = legsSummary(st);
                  return (
                    <tr key={t.id} className={selected.some((s) => s.id === t.id) ? 'ss-sel' : ''}>
                      <td>{t.no}</td>
                      <td>{t.asset_type}</td>
                      <td style={{ color: STAGE_META[st?.tower ?? 'not_ordered'].color }}>{stageLabel(st?.tower ?? 'not_ordered', language)}</td>
                      <td style={{ color: STAGE_META[st?.stub ?? 'not_ordered'].color }}>{stageLabel(st?.stub ?? 'not_ordered', language)}</td>
                      <td>{legs.made}/4</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
