// PLS-CADD "Google Earth" KML/KMZ export parser for the AR pages (same parser as the inline copy in ar-demo/geo/index.html).
import { rad, enuFrom, utmZoneOf } from './geo.js';

const shortStruct = (n) => n.replace(/^Undefined \(#(\d+) in line\)$/, '#$1');
const decodeXml = (s) => s.replace(/&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

export function parseKml(text, fname) {
  const t0 = performance.now();
  const a = text.indexOf('<name>Structure locations</name>'), b = text.indexOf('</Folder>', a);
  if (a < 0) throw new Error('Bu dosya PLS-CADD "Structure locations" bölümünü içermiyor.');
  const seg = text.slice(a, b), info = {}, structs = [];
  // structure balloons (station, X, Y, height, elevation) are <Style id="structInfoN"> blocks, placed before or inside the folder
  for (let p = 0; (p = text.indexOf('<Style id="structInfo', p)) >= 0;) {
    const idEnd = text.indexOf('"', p + 11), id = text.slice(p + 11, idEnd), c0 = text.indexOf('<![CDATA[', idEnd), c1 = text.indexOf(']]>', c0);
    p = idEnd; if (c0 < 0 || c1 < 0) break;
    const t = text.slice(c0 + 9, c1), g = (re) => { const x = re.exec(t); return x ? parseFloat(x[1]) : null; };
    info[id] = { name: (/<h3>([^<]*)<\/h3>/.exec(t) || [])[1] || '', sta: g(/sta=([-\d.]+)/), ht: g(/ht=([-\d.]+)/), ele: g(/ele=([-\d.]+)/), x: g(/X=([-\d.]+)/), y: g(/Y=([-\d.]+)/) };
  }
  for (const m of seg.matchAll(/<Placemark>([\s\S]*?)<\/Placemark>/g)) {
    const bd = m[1], nm = /<name>([^<]*)<\/name>/.exec(bd), pt = /<Point>[\s\S]*?<coordinates>\s*([^<]*?)\s*<\/coordinates>/.exec(bd);
    if (!nm || !pt) continue;
    const [lng, lat] = pt[1].split(',').map(Number); if (!isFinite(lat) || !isFinite(lng)) continue;
    const su = /<styleUrl>#([^<]+)<\/styleUrl>/.exec(bd), i = (su && info[su[1]]) || {}, hd = /<heading>([-\d.]+)<\/heading>/.exec(bd);
    const desc = ((/<description>([\s\S]*?)<\/description>/.exec(bd) || [])[1] || '').replace(/<[^>]+>/g, ' ');
    const g = (re) => { const x = re.exec(desc); return x ? parseFloat(x[1]) : null; };
    structs.push({ name: shortStruct(decodeXml(nm[1])), lat, lng, heading: hd ? parseFloat(hd[1]) : null,
      sta: i.sta ?? g(/sta=([-\d.]+)/), ht: i.ht ?? g(/ht=([-\d.]+)/), ele: i.ele ?? g(/ele=([-\d.]+)/), x: i.x ?? g(/X=([-\d.]+)/), y: i.y ?? g(/Y=([-\d.]+)/) });
  }
  if (!structs.length) throw new Error('"Structure locations" içinde direk noktası bulunamadı.');
  // folders: every <Folder> owns the text up to the next <Folder> or </Folder>
  const raw = [];
  let pos = b;
  while ((pos = text.indexOf('<Folder>', pos)) >= 0) {
    const close = text.indexOf('</Folder>', pos), next = text.indexOf('<Folder>', pos + 8);
    const end = next >= 0 && next < close ? next : close, body = text.slice(pos, end);
    pos = end > pos ? end : pos + 8;
    const nm = /<name>([^<]*)<\/name>/.exec(body); if (!nm) continue;
    const name = decodeXml(nm[1]), isSection = name.startsWith('Section #'), pts = { L: [], P: [] };
    for (const m of body.matchAll(/<(LineString|Polygon)>[\s\S]*?<coordinates>\s*([^<]*?)\s*<\/coordinates>/g)) {
      const arr = m[2].split(/\s+/).map((t) => t.split(',').map(Number)).filter((v) => v.length >= 3 && v.every(Number.isFinite));
      if (arr.length >= 2) pts[m[1] === 'LineString' ? 'L' : 'P'].push(arr);
    }
    if (!pts.L.length && !pts.P.length) continue;
    const sm = /Structure '([^']*)'/.exec(name), cable = (/, '([^']+)',/.exec(name) || [])[1] || '';
    raw.push({ name, kind: isSection ? 'span' : 'tower', sname: sm ? sm[1] : null, cable, pts });
  }
  // PLS-CADD 13+ writes the whole model as ONE folder of solid faces (polygons) instead of one folder per structure:
  // give every face to the nearest structure (grid lookup keeps this fast on 200-structure lines)
  const isModel = (r) => r.kind === 'tower' && !r.sname && r.pts.P.length > 200;
  if (raw.some(isModel)) {
    const cell = (la, ln) => `${Math.round(la * 1000)},${Math.round(ln * 1000)}`, grid = new Map();
    for (const st of structs) { const k = cell(st.lat, st.lng); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(st); }
    const faceGroups = new Map(), lineGroups = new Map();
    const nearest = (pt) => {
      const [ln, la] = pt, kx = Math.cos(la * rad) * 111320; let best = null, bd = 60;
      for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) for (const st of grid.get(`${Math.round(la * 1000) + di},${Math.round(ln * 1000) + dj}`) || []) {
        const d = Math.hypot((la - st.lat) * 110574, (ln - st.lng) * kx); if (d < bd) { bd = d; best = st; }
      }
      return best;
    };
    const push = (map, st, item) => { if (!map.has(st.name)) map.set(st.name, []); map.get(st.name).push(item); };
    for (const r of raw.filter(isModel)) {
      for (const ring of r.pts.P) { const st = nearest(ring[0]); if (st) push(faceGroups, st, ring); }
      for (const ln of r.pts.L) { const st = nearest(ln[0]); if (st) push(lineGroups, st, ln); }
    }
    if (faceGroups.size) {
      for (let i = raw.length - 1; i >= 0; i--) if (isModel(raw[i])) raw.splice(i, 1);
      for (const [name, rings] of faceGroups) raw.push({ name: `Structure '${name}'`, kind: 'tower', sname: name, cable: '', pts: { L: lineGroups.get(name) || [], P: [] }, faces: rings });
    }
  }
  // datum shift: PLS "ele" (project height) minus the lowest KML altitude of each structure (should be a constant)
  const byName = new Map(structs.map((s) => [s.name, s])), diffs = [];
  for (const r of raw) if (r.sname && byName.has(r.sname) && byName.get(r.sname).ele != null) {
    let mn = Infinity; for (const set of [r.pts.L, r.pts.P, r.faces || []]) for (const l of set) for (const p of l) if (p[2] < mn) mn = p[2];
    if (isFinite(mn)) diffs.push(byName.get(r.sname).ele - mn);
  }
  diffs.sort((x, y) => x - y); const shift = diffs.length ? diffs[diffs.length >> 1] : 0;
  const chunks = [];
  raw.forEach((r, ci) => {
    let mnLat = 90, mxLat = -90, mnLng = 180, mxLng = -180;
    for (const set of [r.pts.L, r.pts.P, r.faces || []]) for (const l of set) for (const p of l) { if (p[1] < mnLat) mnLat = p[1]; if (p[1] > mxLat) mxLat = p[1]; if (p[0] < mnLng) mnLng = p[0]; if (p[0] > mxLng) mxLng = p[0]; }
    const lat = (mnLat + mxLat) / 2, lng = (mnLng + mxLng) / 2;
    const conv = (p) => { const o = enuFrom(lat, lng, p[1], p[0]); return [o.e, p[2] + shift, -o.n]; };
    const segsOf = (set, closed) => {
      const out = [];
      for (const l of set) for (let i = 0; i + 1 < l.length; i++) out.push(...conv(l[i]), ...conv(l[i + 1]));
      return new Float32Array(out);
    };
    // a face ring (closing/duplicate points removed) is fan-triangulated: solid members render as real surfaces
    const same = (a, b) => Math.abs(a[0] - b[0]) < 1e-10 && Math.abs(a[1] - b[1]) < 1e-10 && Math.abs(a[2] - b[2]) < 1e-4;
    const trisOf = (rings) => {
      const out = [];
      for (const ring of rings) {
        const pts = []; for (const q of ring) if (!pts.length || !same(pts[pts.length - 1], q)) pts.push(q);
        if (pts.length > 1 && same(pts[0], pts[pts.length - 1])) pts.pop();
        if (pts.length < 3) continue;
        const c0 = conv(pts[0]); for (let i = 1; i + 1 < pts.length; i++) out.push(...c0, ...conv(pts[i]), ...conv(pts[i + 1]));
      }
      return new Float32Array(out);
    };
    const c = { id: ci, kind: r.kind, name: r.name, sname: r.sname, cable: r.cable, lat, lng, t: new Float32Array(0), w: new Float32Array(0), h: new Float32Array(0), f: r.faces ? trisOf(r.faces) : new Float32Array(0), rad: 1, top: 0 };
    // in face-based exports the long polylines inside the model are the span wires (sag curves), not tower members
    const isWire = (l) => { const p0 = conv(l[0]), p1 = conv(l[l.length - 1]); return Math.hypot(p0[0] - p1[0], p0[2] - p1[2]) > 25; };
    if (r.kind === 'tower' && r.faces) { c.t = segsOf(r.pts.L.filter((l) => !isWire(l))); c.w = segsOf(r.pts.L.filter(isWire)); if (c.w.length) c.cable = 'acsr'; }
    else if (r.kind === 'tower') c.t = segsOf(r.pts.L); else c.w = segsOf(r.pts.L);
    c.h = segsOf(r.pts.P);
    let mxr = 1, top = -Infinity;
    for (const arr of [c.t, c.w, c.h, c.f]) for (let i = 0; i < arr.length; i += 3) { mxr = Math.max(mxr, Math.hypot(arr[i], arr[i + 2])); if (arr[i + 1] > top) top = arr[i + 1]; }
    c.rad = mxr; c.top = top;
    chunks.push(c);
  });
  const doc = /<Document>\s*<name>([\s\S]*?)<\/name>/.exec(text.slice(0, 4000));
  const title = doc ? decodeXml(decodeXml(doc[1])).replace(/<!\[CDATA\[|\]\]>/g, '').replace(/<[^>]+>/g, '').trim() : fname;
  const cm = /Project coordinate system:\s*UTM Zone\s*(\d+)\s*([NS])/i.exec(text.slice(0, 4000));
  const mlng = structs.reduce((a, x) => a + x.lng, 0) / structs.length, mlat = structs.reduce((a, x) => a + x.lat, 0) / structs.length;
  const crs = cm ? { zone: +cm[1], north: cm[2].toUpperCase() === 'N', src: 'dosyadan' } : { zone: utmZoneOf(mlng), north: mlat >= 0, src: 'konumdan' };
  // Dosya adı önce: aynı hattın farklı PLS-CADD çıktılarını (ör. farklı sıcaklık/hava durumu senaryoları)
  // ayırt etmenin tek yolu bu -- KMZ'nin içindeki Document adı genelde hepsinde aynı kalıyor (bkz. proje notları).
  return { name: fname, title, fname, shift, structs, chunks, crs, ms: Math.round(performance.now() - t0) };
}

export async function kmzReadFile(file) {
  if (/\.kml$/i.test(file.name)) return file.text();
  if (typeof JSZip === 'undefined') throw new Error('KMZ açıcı (JSZip) yüklenemedi; bağlantını kontrol et.');
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const f = zip.file(/\.kml$/i)[0]; if (!f) throw new Error('KMZ içinde .kml bulunamadı.');
  return f.async('string');
}
