import { useLanguage } from '../lib/i18n/LanguageContext';
import { useConductorDrums } from '../lib/useConductorDrums';

const fmt = (v: number) => v.toLocaleString('tr-TR');

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
