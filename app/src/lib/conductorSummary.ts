import type { ConductorDrumData } from './useConductorDrums';

const fmt = (v: number) => v.toLocaleString('tr-TR');

/** HTML for the map popup of a conductor etap: just the etap itself (the drum summary lives in the Line materials tab). */
export function conductorPopupHtml(data: ConductorDrumData, etapName: string, tr: boolean): string {
  const etap = data.etaps.find((e) => e.name === etapName);
  if (!etap) return '';
  const drums = etap.drums.length ? etap.drums.map((x) => `${x.count} × ${fmt(x.len)} m`).join(' + ') : tr ? 'artan bobinlerden' : 'from leftovers';
  const note = tr ? etap.noteTr : etap.noteEn;
  return (
    `<div class="cd-pop"><div class="cd-pop-title">${tr ? 'İletken etabı' : 'Conductor section'} ${etap.name}${etap.sec ? ` · ${fmt(etap.sec)} m` : ''}</div>` +
    `<div>${drums} (${data.conductor})</div><div class="cd-pop-ok">${tr ? 'Bobinler sahada' : 'Drums on site'}</div>` +
    (note ? `<div class="cd-pop-note">⚠ ${note}</div>` : '') +
    `</div>`
  );
}

/** HTML of the drum summary: line totals, length table, spare stock and the list of every drum received. */
export function conductorSummaryHtml(data: ConductorDrumData, tr: boolean): string {
  const d500 = data.drums.filter((d) => d.kv === 500);
  const d220 = data.drums.filter((d) => d.kv === 220);
  const sum = (l: typeof data.drums) => l.reduce((s, d) => s + d.len, 0);
  const stock = new Map(data.stock.map((s) => [s.len, s.count]));
  const lens = [...new Set(d500.map((d) => d.len))].sort((a, b) => a - b);
  const trucks = new Set(data.drums.map((d) => d.truck)).size;
  const dates = data.drums.map((d) => d.date.split('.').reverse().join('-')).sort();
  const dmy = (iso: string) => iso.split('-').reverse().join('.');

  const rows = lens
    .map((len) => {
      const got = d500.filter((d) => d.len === len).length;
      const spare = stock.get(len) ?? 0;
      return `<tr${spare ? ' class="spare"' : ''}><td>${fmt(len)}</td><td>${got}</td><td>${got - spare}</td><td>${spare || ''}</td></tr>`;
    })
    .join('');
  const all = data.drums
    .map((x) => `<tr${x.kv === 220 ? ' class="spare"' : ''}><td>${x.no}</td><td>${x.id}</td><td>${fmt(x.len)}</td><td>${x.kv}</td><td>${x.truck}</td><td>${x.date}</td></tr>`)
    .join('');
  const stockTxt = data.stock.map((s) => `<div class="cd-pop-note">📦 ${s.count} × ${fmt(s.len)} m ${tr ? 'stok' : 'spare'} — ${tr ? s.noteTr : s.noteEn}</div>`).join('');

  return (
    `<div class="cd-pop cd-sum">` +
    `<div><b>${data.line}</b>: ${d500.length} ${tr ? 'bobin' : 'drums'} · ${fmt(sum(d500))} m · ${trucks} ${tr ? 'araç' : 'trucks'}, ${dmy(dates[0])} – ${dmy(dates[dates.length - 1])}</div>` +
    (d220.length ? `<div>${tr ? '220 kV hattına' : 'For the 220 kV line'}: ${d220.length} ${tr ? 'bobin' : 'drums'} (${fmt(sum(d220))} m)</div>` : '') +
    `<table><thead><tr><th>${tr ? 'Boy (m)' : 'Length (m)'}</th><th>${tr ? 'Gelen' : 'Received'}</th><th>${tr ? 'Etaplarda' : 'In etaps'}</th><th>${tr ? 'Stok' : 'Spare'}</th></tr></thead><tbody>${rows}</tbody></table>` +
    stockTxt +
    `<details><summary>${tr ? `${data.drums.length} bobinin listesi` : `List of all ${data.drums.length} drums`}</summary>` +
    `<div class="cd-pop-list"><table><thead><tr><th>#</th><th>ID</th><th>m</th><th>kV</th><th>${tr ? 'Araç' : 'Truck'}</th><th>${tr ? 'Tarih' : 'Date'}</th></tr></thead><tbody>${all}</tbody></table></div></details></div>`
  );
}
