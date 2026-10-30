import { useMemo } from 'react';
import { useLanguage } from '../lib/i18n/LanguageContext';
import { useConductorDrums, type ConductorDrumData } from '../lib/useConductorDrums';

const fmt = (v: number) => v.toLocaleString('tr-TR');

/** Supply panel card: the conductor drums received on site, per length, with the spare stock. */
export function ConductorDrumsCard({ projectId }: { projectId: string }) {
  const data = useConductorDrums(projectId);
  const { language } = useLanguage();
  const tr = language === 'tr';

  const rows = useMemo(() => {
    if (!data) return [];
    const stock = new Map(data.stock.map((s) => [s.len, s.count]));
    const lens = [...new Set(data.drums.filter((d) => d.kv === 500).map((d) => d.len))].sort((a, b) => a - b);
    return lens.map((len) => {
      const got = data.drums.filter((d) => d.kv === 500 && d.len === len).length;
      const spare = stock.get(len) ?? 0;
      return { len, got, used: got - spare, spare };
    });
  }, [data]);

  if (!data) return null;
  const d500 = data.drums.filter((d) => d.kv === 500);
  const d220 = data.drums.filter((d) => d.kv === 220);
  const sum = (l: ConductorDrumData['drums']) => l.reduce((s, d) => s + d.len, 0);
  const trucks = new Set(data.drums.map((d) => d.truck)).size;
  const dates = data.drums.map((d) => d.date.split('.').reverse().join('-')).sort();
  const dmy = (iso: string) => iso.split('-').reverse().join('.');

  return (
    <div className="cd-card">
      <div className="cd-title">{tr ? 'İletken bobinleri' : 'Conductor drums'} · {data.conductor}</div>
      <div className="cd-line">
        <b>{data.line}</b>: {d500.length} {tr ? 'bobin' : 'drums'} · {fmt(sum(d500))} m ·{' '}
        <span className="cd-ok">{tr ? 'hepsi sahaya gönderildi' : 'all sent to site'}</span>
        <div className="cd-muted">
          {trucks} {tr ? 'araç' : 'trucks'}, {dmy(dates[0])} – {dmy(dates[dates.length - 1])}
        </div>
      </div>
      {d220.length > 0 && (
        <div className="cd-line">
          <b>{tr ? '220 kV bağlantı hattı' : '220 kV interconnection'}</b>: {d220.length} {tr ? 'bobin' : 'drums'} · {fmt(sum(d220))} m
        </div>
      )}
      <table className="cd-table">
        <thead>
          <tr>
            <th>{tr ? 'Boy (m)' : 'Length (m)'}</th>
            <th>{tr ? 'Gelen' : 'Received'}</th>
            <th>{tr ? 'Etaplarda' : 'In etaps'}</th>
            <th>{tr ? 'Stok' : 'Spare'}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.len} className={r.spare ? 'cd-spare' : ''}>
              <td>{fmt(r.len)}</td>
              <td>{r.got}</td>
              <td>{r.used}</td>
              <td>{r.spare || ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {data.stock.map((s) => (
        <div key={s.len} className="cd-stock">
          📦 {s.count} × {fmt(s.len)} m {tr ? 'stok' : 'spare'} — {tr ? s.noteTr : s.noteEn}
        </div>
      ))}
      <details className="cd-details">
        <summary>{tr ? `${data.drums.length} bobinin listesi` : `List of all ${data.drums.length} drums`}</summary>
        <table className="cd-table">
          <thead>
            <tr>
              <th>#</th>
              <th>ID</th>
              <th>m</th>
              <th>kV</th>
              <th>{tr ? 'Araç' : 'Truck'}</th>
              <th>{tr ? 'Tarih' : 'Date'}</th>
            </tr>
          </thead>
          <tbody>
            {data.drums.map((x) => (
              <tr key={x.id} className={x.kv === 220 ? 'cd-spare' : ''}>
                <td>{x.no}</td>
                <td>{x.id}</td>
                <td>{fmt(x.len)}</td>
                <td>{x.kv}</td>
                <td>{x.truck}</td>
                <td>{x.date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}

/** Drum list panel block: the Part-1 etap plan (the project's own Etap list) with the drum lengths that arrived. */
export function Part1EtapPlan({ projectId }: { projectId: string }) {
  const data = useConductorDrums(projectId);
  const { language } = useLanguage();
  const tr = language === 'tr';
  if (!data) return null;
  const total = data.etaps.reduce((s, e) => s + e.drums.reduce((a, x) => a + x.count, 0), 0);

  return (
    <details className="cd-details cd-etaps">
      <summary>
        {tr ? 'Part 1 etap planı (Etap listesi)' : 'Part 1 etap plan (Etap list)'} · {data.line} · {total} {tr ? 'bobin' : 'drums'}
      </summary>
      <div className="cd-muted">
        {tr
          ? 'Kendi etap hesabınız; gelen bobin boylarıyla yazıldı (kontrol 30.10.2026: hepsi yetiyor).'
          : 'Your own etap calculation, written with the drum lengths that arrived (checked 30.10.2026: everything is covered).'}
      </div>
      <table className="cd-table">
        <thead>
          <tr>
            <th>{tr ? 'Etap' : 'Etap'}</th>
            <th>{tr ? 'Boy (m)' : 'Length (m)'}</th>
            <th>{tr ? 'Yeni bobinler' : 'New drums'}</th>
          </tr>
        </thead>
        <tbody>
          {data.etaps.map((e) => (
            <tr key={e.name}>
              <td>{e.name}</td>
              <td>{e.sec != null ? fmt(e.sec) : ''}</td>
              <td>
                {e.drums.length ? e.drums.map((x) => `${x.count} × ${fmt(x.len)}`).join(' + ') : tr ? 'artan bobinlerden' : 'from leftovers'}
                {(tr ? e.noteTr : e.noteEn) && <div className="cd-note">⚠ {tr ? e.noteTr : e.noteEn}</div>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {data.stock.map((s) => (
        <div key={s.len} className="cd-stock">
          📦 {s.count} × {fmt(s.len)} m {tr ? 'stok' : 'spare'} — {tr ? s.noteTr : s.noteEn}
        </div>
      ))}
    </details>
  );
}
