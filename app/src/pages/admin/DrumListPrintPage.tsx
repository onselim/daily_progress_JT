import { useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useProjectBySlug } from '../../lib/useProject';
import { useAssets } from '../../lib/useAssets';
import { buildDrumInput, computeDrumPlan, diffFrozen, lineTowers, manualText, useDrumSettings } from '../../lib/drum/useDrumPlan';

/* eslint-disable @typescript-eslint/no-explicit-any */

const T = {
  en: {
    title: 'Conductor drum list — summary', print: 'Print / save PDF', loading: 'Loading…', none: 'No drum list saved for this project yet.',
    line: 'Line', sections: 'Drum sections', joints: 'Mid-span joints', pulls: 'Pulls', drums: 'Drums', ordered: 'Ordered', required: 'Required conductor', waste: 'Waste',
    scheme: 'Line scheme — drum sections and drum transfers', order: 'Order list', sectionsT: 'Drum sections', transfers: 'Drum transfers between sections',
    len: 'Length (m)', qty: 'Qty', total: 'Total (m)', cond: 'Conductor', usedIn: 'Used in sections',
    sec: 'Section', towers: 'Towers', spans: 'Spans', perPhase: 'Per phase (m)', drumLen: 'Drum (m)', drumNos: 'Drum nos', how: 'How the drums are used',
    set: 'Drums', from: 'From section', to: 'To section', dist: 'Distance', noTransfers: 'No drum is moved between sections.',
    legendBig: 'tension tower with angle > 30° (pull break)', legendJoint: 'mid-span joint', legendArrow: 'drums moved to another section',
    params: (p: any, S: any, conds: string) => `${S.phases === 6 ? 'Double' : 'Single'} circuit · ${['', 'single', 'twin', 'triple', 'quad'][S.B]} bundle = ${S.cond} conductors · max drum ${conds} · span × ${p.sag} (3D) · ${p.jointLoss} m per joint / extra pull · rounding ${p.roundStep} m`,
  },
  tr: {
    title: 'İletken bobin listesi — özet', print: 'Yazdır / PDF', loading: 'Yükleniyor…', none: 'Bu proje için kayıtlı bobin listesi yok.',
    line: 'Hat', sections: 'Bobin etabı', joints: 'Ara ek', pulls: 'Tel çekimi', drums: 'Bobin', ordered: 'Sipariş', required: 'Gereken iletken', waste: 'Fire',
    scheme: 'Hat şeması — bobin etapları ve bobin taşımaları', order: 'Sipariş listesi', sectionsT: 'Bobin etapları', transfers: 'Etaplar arası bobin taşımaları',
    len: 'Boy (m)', qty: 'Adet', total: 'Toplam (m)', cond: 'İletken', usedIn: 'Kullanıldığı etaplar',
    sec: 'Etap', towers: 'Direkler', spans: 'Açıklık', perPhase: 'Faz başına (m)', drumLen: 'Bobin (m)', drumNos: 'Bobin no', how: 'Bobinlerin kullanımı',
    set: 'Bobinler', from: 'Etaptan', to: 'Etaba', dist: 'Mesafe', noTransfers: 'Etaplar arasında bobin taşınmıyor.',
    legendBig: '30°\'den büyük açılı tension direği (tel çekimi bölünür)', legendJoint: 'ara ek', legendArrow: 'bobinlerin başka etaba taşınması',
    params: (p: any, S: any, conds: string) => `${S.phases === 6 ? 'Çift' : 'Tek'} devre · ${['', 'single', 'twin', 'triple', 'quad'][S.B]} demet = ${S.cond} iletken · en uzun bobin ${conds} · açıklık × ${p.sag} (3B) · ek / ek çekiş başına ${p.jointLoss} m · yuvarlama ${p.roundStep} m`,
  },
};

/** A3 landscape, printable summary of the saved drum list: key figures, a line scheme with
 * each drum section and arrows where drums are carried to another section, the order list,
 * the section table and the transfer table. Text follows the project's report language. */
export default function DrumListPrintPage() {
  const { slug } = useParams<{ slug: string }>();
  const { project } = useProjectBySlug(slug);
  const { assets, loading } = useAssets(project?.id);
  const drum = useDrumSettings(project?.id);
  const [sp] = useSearchParams();
  const listId = sp.get('list');
  const settings = (listId && drum.lists.find((l) => l.id === listId)) || drum.settings;
  // dil: bağlantıdaki ?lang (panelde seçili dil), yoksa raporun dili
  const qLang = sp.get('lang');
  const lang: 'en' | 'tr' = qLang === 'tr' ? 'tr' : qLang ? 'en' : drum.reportLang;
  const L = T[lang];
  const nf = (v: number, d = 0) => v.toLocaleString(lang === 'en' ? 'en-US' : 'tr-TR', { minimumFractionDigits: d, maximumFractionDigits: d });

  const res = useMemo(() => {
    if (!settings || !project || assets.length < 2) return null;
    return computeDrumPlan(buildDrumInput(lineTowers(assets, project.coordinate_system), settings, lang, drum.spanInfo));
  }, [settings, project, assets, lang, drum.spanInfo]);

  if (!project || loading) return <div className="dlp-msg">{L.loading}</div>;
  if (!settings) return <div className="dlp-msg">{L.none}</div>;
  if (!res?.model) return <div className="dlp-msg">{res?.R?.errors?.[0] ?? L.loading}</div>;

  const { R, model } = res;
  const P = R.main, S = R.summary, p = R.params;
  const segs: any[] = R.segments;
  const segInfo: Map<number, any> = model.segInfo;
  const name = (id: number) => model.segName.get(id) as string;
  const fire = P.supplied - S.sagCond;
  const conds = [...new Set(segs.map((s) => s.cond))];
  const condTxt = conds.length > 1 ? conds.map((c) => `${c}: ${nf(segs.find((s) => s.cond === c).max)} m`).join(', ') : `${nf(p.maxDrum)} m`;
  const owner = (st: any) => st.pieces.reduce((b: any, q: any) => (q.req > b.req ? q : b), st.pieces[0]).seg.id;
  const center = (id: number) => { const s = segs.find((x) => x.id === id); return (s.pStart + s.pEnd) / 2; };

  // bobin taşımaları: bir setin parçaları farklı etaplardaysa, sıradaki her etap değişimi bir ok
  const transfers: { from: number; to: number; drums: string; km: number }[] = [];
  for (const st of P.sets) {
    let prev: number | null = null;
    for (const q of st.pieces) {
      if (prev != null && q.seg.id !== prev) {
        transfers.push({ from: prev, to: q.seg.id, drums: rangeB(st.drumNos), km: Math.abs(center(q.seg.id) - center(prev)) / 1000 });
      }
      prev = q.seg.id;
    }
  }

  // ---- şema (SVG)
  const W = 1600, padL = 40, padR = 40;
  const total = R.ppos[R.ppos.length - 1];
  const X = (pm: number) => padL + (pm / total) * (W - padL - padR);
  const yLine = 210, yBar = 236, barH = 26;
  const arcBase = yLine - 18;
  const showAllTowers = R.towers.length <= 90;
  const H = 330;
  const svg = (
    <svg viewBox={`0 0 ${W} ${H}`} className="dlp-svg" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <marker id="dlp-arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill="#b91c1c" />
        </marker>
      </defs>
      {/* taşıma okları: hattın üstünde yay */}
      {transfers.map((t, i) => {
        const x1 = X(center(t.from)), x2 = X(center(t.to));
        const h = 40 + (i % 4) * 32 + Math.min(60, Math.abs(x2 - x1) * 0.08);
        const mx = (x1 + x2) / 2, top = arcBase - h;
        return (
          <g key={i}>
            <path d={`M${x1},${arcBase} C${x1},${top} ${x2},${top} ${x2},${arcBase}`} fill="none" stroke="#b91c1c" strokeWidth={2} strokeDasharray="6 4" markerEnd="url(#dlp-arr)" />
            <rect x={mx - 110} y={top + h * 0.25 - 13} width={220} height={18} rx={4} fill="#fff" stroke="#b91c1c" />
            <text x={mx} y={top + h * 0.25} textAnchor="middle" fontSize={11} fill="#b91c1c" fontWeight={700}>
              {t.drums}: E{t.from} → E{t.to} · {nf(t.km, 1)} km
            </text>
          </g>
        );
      })}
      {/* hat ve direkler */}
      <line x1={X(0)} y1={yLine} x2={X(total)} y2={yLine} stroke="#344054" strokeWidth={1.5} />
      {R.towers.map((tw: any, i: number) => {
        const x = X(R.ppos[i]);
        const ten = R.T[i], big = R.big[i];
        return (
          <g key={i}>
            <line x1={x} y1={yLine - (ten ? 9 : 5)} x2={x} y2={yLine + (ten ? 9 : 5)} stroke={big ? '#dc2626' : '#344054'} strokeWidth={ten ? 2 : 1} />
            {big && <circle cx={x} cy={yLine - 13} r={3.5} fill="#dc2626" />}
            {(showAllTowers || ten) && (
              <text x={x} y={yLine + 82} fontSize={9.5} textAnchor="end" transform={`rotate(-90 ${x} ${yLine + 82})`} fill={big ? '#dc2626' : '#475467'}>
                {tw.no}
              </text>
            )}
          </g>
        );
      })}
      {/* etap çubukları */}
      {segs.map((sg) => {
        const inf = segInfo.get(sg.id);
        const x0 = X(sg.pStart), x1 = X(sg.pEnd), w = Math.max(1, x1 - x0 - 1.5);
        return (
          <g key={sg.id}>
            <rect x={x0 + 0.75} y={yBar} width={w} height={barH} rx={3} fill={'#' + inf.color} stroke="#0b0f17" strokeWidth={0.6} />
            {w > 24 && (
              <text x={x0 + w / 2} y={yBar + 17} textAnchor="middle" fontSize={11} fontWeight={800} fill="#fff">
                E{sg.id}
              </text>
            )}
            {sg.endsAtJoint && (
              <text x={x1} y={yLine - 4} textAnchor="middle" fontSize={13} fontWeight={800} fill="#dc2626">✕</text>
            )}
          </g>
        );
      })}
    </svg>
  );

  return (
    <div className="dlp">
      <style>{CSS}</style>
      <div className="dlp-toolbar">
        <button type="button" onClick={() => window.print()}>🖨 {L.print}</button>
      </div>
      <header className="dlp-head">
        <div>
          <h1>{L.title}</h1>
          <div className="dlp-sub">
            {project.name} · T{R.towers[0].no} → T{R.towers[R.towers.length - 1].no} · {new Date().toLocaleDateString(lang === 'en' ? 'en-GB' : 'tr-TR')}
          </div>
          <div className="dlp-sub small">{L.params(p, S, condTxt)}</div>
          {settings.name && <div className="dlp-sub"><b>{settings.name}</b></div>}
          {settings.frozen && (() => {
            const ch = diffFrozen(settings.frozen, res, lang);
            return (
              <div className={`dlp-frozen${ch.length ? ' changed' : ''}`}>
                🔒 <b>{lang === 'en' ? 'Order issued' : 'Sipariş verildi'} — Rev {settings.frozen.rev}</b> · {new Date(settings.frozen.date).toLocaleDateString(lang === 'en' ? 'en-GB' : 'tr-TR')}
                {settings.frozen.note ? ` · ${settings.frozen.note}` : ''}
                {ch.length > 0 && (
                  <div>
                    <b>{lang === 'en' ? 'The current calculation differs from the issued order:' : 'Güncel hesap verilen siparişten farklı:'}</b>
                    {ch.map((c, i) => <div key={i}>• {c}</div>)}
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      </header>

      <section className="dlp-kpis">
        {[
          [L.line, `${nf(S.planLen / 1000, 2)} km`, `${S.towers} / ${S.tensionCount} T`],
          [L.sections, String(segs.length), ''],
          [L.joints, String(R.joints.length), ''],
          [L.pulls, String(R.pulls.length), ''],
          [L.drums, nf(P.drumCount), `${P.sets.length} × ${S.B}`],
          [L.ordered, `${nf(P.orderedLen)} m`, ''],
          [L.required, `${nf(S.sagCond)} m`, ''],
          [L.waste, `${nf(fire)} m`, `${nf((fire / S.sagCond) * 100, 2)} %`],
        ].map(([k, v, s]) => (
          <div key={k} className="dlp-kpi">
            <div className="k">{k}</div>
            <div className="v">{v}</div>
            {s && <div className="s">{s}</div>}
          </div>
        ))}
      </section>

      <section className="dlp-card">
        <h2>{L.scheme}</h2>
        {svg}
        <div className="dlp-legend">
          <span><i className="dot red" /> {L.legendBig}</span>
          <span><b className="red">✕</b> {L.legendJoint}</span>
          <span><i className="arrow" /> {L.legendArrow}</span>
        </div>
      </section>

      <div className="dlp-grid">
        <section className="dlp-card">
          <h2>{L.order}</h2>
          <table>
            <thead><tr><th /><th className="num">{L.len}</th><th className="num">{L.qty}</th><th className="num">{L.total}</th>{conds.length > 1 && <th>{L.cond}</th>}<th>{L.usedIn}</th></tr></thead>
            <tbody>
              {P.groups.map((g: any) => (
                <tr key={g.id}>
                  <td><i className="sw" style={{ background: '#' + segInfo.get(owner(g.sets[0]))?.color }} /></td>
                  <td className="num"><b>{nf(g.length)}</b>{g.manual && <div className="dlp-muted">✎ {manualText(g.parts, lang, nf, name)}</div>}</td>
                  <td className="num"><b>{g.qty}</b></td>
                  <td className="num">{nf(g.length * g.qty)}</td>
                  {conds.length > 1 && <td>{g.cond}</td>}
                  <td>{[...new Set(g.sets.map(owner))].sort((a: any, b: any) => a - b).map((id: any) => name(id)).join(', ')}</td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr><td /><td /><td className="num">{P.orderedDrums}</td><td className="num">{nf(P.orderedLen)}</td>{conds.length > 1 && <td />}<td /></tr></tfoot>
          </table>

          <h2 style={{ marginTop: 14 }}>{L.transfers}</h2>
          {transfers.length ? (
            <table>
              <thead><tr><th>{L.set}</th><th>{L.from}</th><th>{L.to}</th><th className="num">{L.dist}</th></tr></thead>
              <tbody>
                {transfers.map((t, i) => (
                  <tr key={i}><td><b>{t.drums}</b></td><td>{name(t.from)}</td><td>{name(t.to)}</td><td className="num">{nf(t.km, 1)} km</td></tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="dlp-muted">{L.noTransfers}</p>
          )}

          {P.stockUsed > 0 && (
            <>
              <h2 style={{ marginTop: 14 }}>{lang === 'en' ? 'Drums taken from stock' : 'Stoktan kullanılan bobinler'}</h2>
              <table>
                <thead><tr><th>{L.set}</th><th>{lang === 'en' ? 'Stock' : 'Stok'}</th><th className="num">{L.len}</th><th>{L.usedIn}</th></tr></thead>
                <tbody>
                  {P.sets.filter((st: any) => st.source === 'stok').map((st: any) => (
                    <tr key={st.id}>
                      <td><b>{rangeB(st.drumNos)}</b></td>
                      <td>{[...new Set(st.drums.map((d: any) => d.name))].join(', ')}</td>
                      <td className="num">{nf(Math.min(...st.drums.map((d: any) => d.length)))}</td>
                      <td>{[...new Set(st.pieces.map((q: any) => q.seg.id))].map((id: any) => name(id)).join(', ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="dlp-muted">
                {lang === 'en' ? 'Not included in the order list.' : 'Sipariş listesine dahil değildir.'}
                {P.stock.some((d: any) => !d.used) && ` ${lang === 'en' ? 'Unused stock' : 'Kullanılmayan stok'}: ${P.stock.filter((d: any) => !d.used).length}`}
              </p>
            </>
          )}
        </section>

        <section className="dlp-card">
          <h2>{L.sectionsT}</h2>
          <table className="dlp-sections">
            <thead><tr><th>{L.sec}</th><th className="num">{L.spans}</th><th className="num">{L.len}</th><th className="num">{L.drumLen}</th><th className="num">{L.qty}</th><th>{L.drumNos}</th><th>{L.how}</th></tr></thead>
            <tbody>
              {segs.map((sg) => {
                const inf = segInfo.get(sg.id);
                const a = sg.startLoc.tower ?? sg.startLoc.span, b = sg.endLoc.tower ?? sg.endLoc.span + 1;
                return (
                  <tr key={sg.id}>
                    <td><i className="sw" style={{ background: '#' + inf.color }} /><b>{name(sg.id)}</b>{conds.length > 1 && <div className="dlp-muted">{sg.cond}</div>}</td>
                    <td className="num">{b - a}</td>
                    <td className="num">{nf(sg.len)}</td>
                    <td className="num"><b>{inf.lengths.length ? inf.lengths.map((x: number) => nf(x)).join(' / ') : '—'}</b></td>
                    <td className="num"><b>{inf.drums || '—'}</b></td>
                    <td>{inf.drumNos || '—'}</td>
                    <td className="how">{String(inf.usage).split('\n').slice(1).join('\n')}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      </div>

      <DrumLedger R={R} model={model} lang={lang} nf={nf} />
    </div>
  );
}

/** Etap etap, bobin bobin kullanım detayı: her set (birlikte yüklenen B bobin) için her çekişte
 * kullanılan metraj, çekişten sonra kalan ve kalanın bir sonraki çekişe yettiği kontrolü. */
function DrumLedger({ R, model, lang, nf }: { R: any; model: any; lang: 'en' | 'tr'; nf: (v: number, d?: number) => string }) {
  const EN = lang === 'en';
  const name = (id: number) => model.segName.get(id) as string;
  const B = R.summary.B;
  const ph = (n: number) => (EN ? `Phase ${n}` : `Faz ${n}`);
  // aynı setin bobinleri aynı işi yapar → set başına bir satır, bobinler tek tek yazılır
  const bySet = new Map<number, any[]>();
  for (const d of model.ledger) bySet.set(d.set, [...(bySet.get(d.set) ?? []), d]);
  const sets = [...bySet.values()];
  return (
    <section className="dlp-card dlp-ledger">
      <h2>{EN ? 'Drum usage detail — drum by drum' : 'Bobin kullanım detayı — bobin bobin'}</h2>
      <p className="dlp-muted">
        {EN
          ? `Each set is ${B} identical drums loaded on the puller together; they pull one phase (${B} sub-conductors) at a time. When a set makes several pulls, the same ${B} drums pull the next phase. Every extra pull adds ${R.params.jointLoss} m loss. "Left" is what remains on each drum after that pull; ✓ means the remainder is enough for the next pull.`
          : `Her set, makineye birlikte yüklenen ${B} adet aynı boy bobindir; bir seferde bir fazı (${B} iletken) çeker. Set birden fazla çekiş yapıyorsa aynı ${B} bobinle sonraki faz çekilir. Her ek çekişte ${R.params.jointLoss} m kayıp eklenir. "Kalan", o çekişten sonra her bobinde kalan metrajdır; ✓ kalanın bir sonraki çekişe yettiğini gösterir.`}
      </p>
      {R.segments.map((sg: any) => {
        const inf = model.segInfo.get(sg.id);
        const own = sets.filter((ds) => ds[0].owner === sg.id);
        const hostedIn = sets.filter((ds) => ds[0].owner !== sg.id && ds[0].steps.some((s: any) => s.seg === sg.id));
        const perPhase = sg.req;
        return (
          <div key={sg.id} className="dlp-led-seg">
            <div className="dlp-led-head">
              <i className="sw" style={{ background: '#' + inf.color }} />
              <b>{name(sg.id)}</b>
              <span>
                {' · '}{EN ? 'section' : 'etap'} {nf(sg.len)} m
                {Math.round(perPhase) !== Math.round(sg.len) ? ` · ${EN ? 'per phase incl. joint' : 'ek payıyla faz başına'} ${nf(perPhase)} m` : ''}
                {' · '}{R.summary.cond} {EN ? 'conductors' : 'iletken'} ({R.summary.phases} × {B})
                {' · '}{inf.drums ? `${inf.drums} ${EN ? 'new drums' : 'yeni bobin'} × ${inf.lengths.map((x: number) => nf(x)).join(' / ')} m` : EN ? 'no new drums' : 'yeni bobin yok'}
                {hostedIn.length > 0 && ` + ${EN ? 'remainder of' : 'artan:'} ${[...new Set(hostedIn.map((ds) => name(ds[0].owner)))].join(', ')}`}
                {sg.cond ? ` · ${sg.cond}` : ''}
              </span>
            </div>
            {/* faz faz: her faz hangi bobinlerle çekiliyor — yeni bobin mi, başka etabın artanı mı */}
            <div className="dlp-led-phases">
              {Array.from({ length: R.summary.phases }, (_, k) => k + 1).map((phase) => {
                const ds = sets.find((x) => x[0].steps.some((s: any) => s.seg === sg.id && s.ph === phase));
                if (!ds) return null;
                const d = ds[0];
                const i = d.steps.findIndex((s: any) => s.seg === sg.id && s.ph === phase);
                const s = d.steps[i];
                const drums = ds.map((x: any) => 'B' + x.no).join(', ');
                if (d.owner === sg.id) {
                  return (
                    <div key={phase}>
                      <b>{ph(phase)}</b>: {EN ? 'drums' : 'bobinler'} <b>{drums}</b> ({nf(d.length)} m{d.source === 'stok' ? (EN ? ', from stock' : ', stoktan') : EN ? ', new' : ', yeni'})
                      {i > 0 ? (EN ? ` — pull ${i + 1} of these drums, ${nf(s.before)} m on each before this pull` : ` — bu bobinlerin ${i + 1}. çekişi, öncesinde her bobinde ${nf(s.before)} m var`) : ''}
                      {' → '}{EN ? 'uses' : 'kullanılan'} {nf(s.len)}{s.loss ? ` + ${nf(s.loss)}` : ''} m → {EN ? 'left' : 'kalan'} {nf(s.after)} m <span className="ok">✓</span>
                      {d.steps[i + 1] && d.steps[i + 1].seg !== sg.id && (
                        <span className="carry">
                          {EN
                            ? ` → the remaining ${nf(s.after)} m on each drum goes to ${name(d.steps[i + 1].seg)} ${ph(d.steps[i + 1].ph)}`
                            : ` → her bobinde kalan ${nf(s.after)} m, ${name(d.steps[i + 1].seg)} ${ph(d.steps[i + 1].ph)} için kullanılır`}
                        </span>
                      )}
                    </div>
                  );
                }
                const prev = d.steps[i - 1];
                return (
                  <div key={phase} className="borrowed">
                    <b>{ph(phase)}</b>: {EN ? 'no new drum — the remaining conductor on' : 'yeni bobin yok — '}
                    {EN ? <> drums <b>{drums}</b> of <b>{name(d.owner)}</b> ({nf(d.length)} m drums) is used.</> : <><b>{name(d.owner)}</b> etabının <b>{drums}</b> bobinlerinde ({nf(d.length)} m) kalan iletken kullanılır.</>}
                    {' '}
                    {EN
                      ? `After ${prev ? `${prev.seg === sg.id ? '' : name(prev.seg) + ' '}${ph(prev.ph)}` : 'the previous pull'}, ${nf(s.before)} m is left on each drum; this pull needs ${nf(s.len)} + ${nf(s.loss)} m loss = ${nf(s.len + s.loss)} m`
                      : `${prev ? `${prev.seg === sg.id ? '' : name(prev.seg) + ' '}${ph(prev.ph)}` : 'Önceki çekiş'} sonrasında her bobinde ${nf(s.before)} m kalmıştır; bu çekiş için ${nf(s.len)} + ${nf(s.loss)} m kayıp = ${nf(s.len + s.loss)} m gerekir`}
                    {' → '}{EN ? 'left' : 'kalan'} {nf(s.after)} m <span className={s.ok ? 'ok' : 'bad'}>{s.ok ? '✓' : '✗'}</span>
                  </div>
                );
              })}
            </div>
            {own.length > 0 && (
              <table>
                <thead>
                  <tr>
                    <th>{EN ? 'Drums (loaded together)' : 'Bobinler (birlikte yüklenir)'}</th>
                    <th className="num">{EN ? 'Drum length' : 'Bobin boyu'}</th>
                    <th>{EN ? 'Pull — used from each drum → left on each drum' : 'Çekiş — her bobinden kullanılan → her bobinde kalan'}</th>
                    <th className="num">{EN ? 'Final left' : 'Son kalan'}</th>
                    <th>{EN ? 'Check' : 'Kontrol'}</th>
                  </tr>
                </thead>
                <tbody>
                  {own.map((ds) => {
                    const d = ds[0];
                    return (
                      <tr key={d.set}>
                        <td>
                          <b>{ds.map((x: any) => 'B' + x.no).join(', ')}</b>
                          {d.source === 'stok' && <div className="dlp-muted">{EN ? 'from stock' : 'stoktan'}: {[...new Set(ds.map((x: any) => x.stockName))].join(', ')}</div>}
                        </td>
                        <td className="num">{nf(d.length)} m</td>
                        <td>
                          {d.steps.map((s: any, i: number) => (
                            <div key={i} className="dlp-led-step">
                              {i + 1}) {s.seg === sg.id ? '' : name(s.seg) + ' · '}{ph(s.ph)}: <b>{nf(s.len)} m</b>
                              {s.joint ? (EN ? ' (incl. joint)' : ' (ek payı dahil)') : ''}
                              {s.loss ? ` + ${nf(s.loss)} m ${EN ? 'loss' : 'kayıp'}` : ''}
                              {' → '}{EN ? 'left' : 'kalan'} <b>{nf(s.after)} m</b>
                              {s.next != null && (
                                <span className={s.nextOk ? 'ok' : 'bad'}>
                                  {' '}{s.nextOk ? '✓' : '✗'} {EN ? 'next pull needs' : 'sonraki çekiş'} {nf(s.next)} m
                                </span>
                              )}
                            </div>
                          ))}
                        </td>
                        <td className="num"><b>{nf(d.left)} m</b></td>
                        <td className={d.ok ? 'ok' : 'bad'}><b>{d.ok ? '✓ OK' : '✗'}</b></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        );
      })}
    </section>
  );
}

function rangeB(nums: number[]) {
  const s = [...nums].sort((a, b) => a - b);
  return s.length > 1 && s[s.length - 1] - s[0] === s.length - 1 ? `B${s[0]}–B${s[s.length - 1]}` : s.map((n) => 'B' + n).join(', ');
}

const CSS = `
.dlp { background:#fff; color:#101828; font: 12px/1.4 system-ui, 'Segoe UI', Roboto, sans-serif; padding: 18px 22px 30px; min-height:100vh; }
.dlp-msg { padding: 40px; font: 14px system-ui; }
.dlp-toolbar { position: fixed; top: 10px; right: 14px; z-index: 5; }
.dlp-toolbar button { background:#1d4ed8; color:#fff; border:none; border-radius:6px; padding:8px 14px; font-weight:600; cursor:pointer; }
.dlp-head h1 { font-size: 22px; margin: 0 0 2px; color:#1f3b63; }
.dlp-sub { color:#475467; font-size: 13px; }
.dlp-sub.small { font-size: 11.5px; color:#667085; margin-top:2px; }
.dlp-kpis { display:grid; grid-template-columns: repeat(8, 1fr); gap:8px; margin: 12px 0; }
.dlp-kpi { background:#f2f4f7; border-radius:8px; padding:7px 10px; }
.dlp-kpi .k { font-size:10.5px; color:#667085; text-transform:uppercase; letter-spacing:.03em; }
.dlp-kpi .v { font-size:17px; font-weight:800; font-variant-numeric: tabular-nums; }
.dlp-kpi .s { font-size:10.5px; color:#667085; }
.dlp-card { border:1px solid #d0d5dd; border-radius:8px; padding:10px 12px; margin-bottom:12px; break-inside: avoid; }
.dlp-card h2 { font-size:13px; margin:0 0 6px; color:#1f3b63; text-transform:uppercase; letter-spacing:.04em; }
.dlp-svg { width:100%; height:auto; display:block; }
.dlp-legend { display:flex; gap:18px; font-size:11px; color:#475467; }
.dlp-legend .dot { display:inline-block; width:9px; height:9px; border-radius:50%; vertical-align:-1px; }
.dlp-legend .dot.red { background:#dc2626; } .dlp-legend .red { color:#dc2626; }
.dlp-legend .arrow { display:inline-block; width:22px; border-top:2px dashed #b91c1c; vertical-align:3px; }
.dlp-grid { display:grid; grid-template-columns: 1fr 2.2fr; gap:12px; align-items:start; }
.dlp table { width:100%; border-collapse:collapse; }
.dlp th, .dlp td { border-bottom:1px solid #eaecf0; padding:3px 6px; text-align:left; vertical-align:top; }
.dlp th { background:#f2f4f7; font-size:10.5px; text-transform:uppercase; color:#475467; }
.dlp td.num, .dlp th.num { text-align:right; font-variant-numeric: tabular-nums; white-space:nowrap; }
.dlp tfoot td { font-weight:800; border-top:2px solid #1f3b63; border-bottom:none; }
.dlp .sw { display:inline-block; width:11px; height:11px; border-radius:3px; margin-right:6px; vertical-align:-1px; }
.dlp-sections td.how { white-space:pre-line; font-size:10.5px; color:#344054; }
.dlp-muted { color:#667085; font-size:10.5px; }
.dlp-frozen { margin-top:6px; border:1px solid #12b76a; background:#ecfdf3; border-radius:6px; padding:5px 8px; font-size:11.5px; }
.dlp-frozen.changed { border-color:#f79009; background:#fffaeb; }
.dlp-ledger table { margin: 4px 0 2px; }
.dlp-led-seg { padding: 6px 0 8px; border-top: 1px solid #eaecf0; break-inside: avoid; }
.dlp-led-head { font-size: 12px; margin-bottom: 2px; }
.dlp-led-head span { color:#475467; }
.dlp-led-step { font-size: 11px; line-height: 1.5; }
.dlp-led-phases { font-size: 11px; line-height: 1.55; margin: 3px 0 4px 18px; }
.dlp-led-phases .carry { color:#b54708; font-weight:600; }
.dlp-led-phases .borrowed { background:#fffaeb; border-left:3px solid #f79009; padding:2px 6px; margin:2px 0; }
.dlp .ok { color:#067647; } .dlp .bad { color:#b42318; }
@page { size: A3 landscape; margin: 10mm; }
@media print { .dlp-toolbar { display:none; } .dlp { padding:0; } }
`;
