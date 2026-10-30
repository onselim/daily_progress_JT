// @ts-nocheck
// Kaynak: 2026-10-22/bobin_listesi/core.js (bağımsız bobin listesi aracı) — aynı hesap, ES modül olarak.
// Değişiklik o dosyada yapılıp buraya kopyalanmalı.
  const EPS = 1e-6;

  // ---------------------------------------------------------------- yardımcılar
  const trLower = (s) => String(s == null ? '' : s)
    .replace(/İ/g, 'i').replace(/I/g, 'ı').toLowerCase()
    .replace(/ı/g, 'i').replace(/ş/g, 's').replace(/ğ/g, 'g').replace(/ü/g, 'u')
    .replace(/ö/g, 'o').replace(/ç/g, 'c').replace(/\s+/g, ' ').trim();

  function num(v) {
    if (v == null || v === '') return null;
    if (typeof v === 'number') return isFinite(v) ? v : null;
    const s = String(v).trim().replace(',', '.');
    const dms = s.match(/^(-?\d+(?:\.\d+)?)\s*°\s*(\d+(?:\.\d+)?)?\s*'?\s*(\d+(?:\.\d+)?)?/);
    if (dms) {
      const d = parseFloat(dms[1]), m = parseFloat(dms[2] || 0), sec = parseFloat(dms[3] || 0);
      return Math.sign(d || 1) * (Math.abs(d) + m / 60 + sec / 3600);
    }
    const m = s.match(/-?\d+(?:\.\d+)?/);
    return m ? parseFloat(m[0]) : null;
  }
  const isBlank = (v) => v == null || String(v).trim() === '';

  // ---------------------------------------------------------------- sütun tanıma
  const FIELDS = {
    no:      { pri: [/construction no/, /tower no|direk no|tower number|direk numara/, /^no\.?$|(^| )no\.?( |$)/, /^towers?$|^direk$/], ex: /angle point|sl\.? ?no|line section|joint|sira/ },
    type:    { pri: [/tower ?type|direk tipi|direk tip/, /(^| )type( |$)|(^| )tip( |$)/], ex: /foundation|insulator|grounding|section|temel|izolator/ },
    z:       { pri: [/natural ground|ground elev|zemin kotu/, /z coord|elevation|(^| )kot( |$)|^z$/], ex: /resist/ },
    cond:    { pri: [/conductor type|iletken tipi|iletken cinsi/], ex: /zzzz/ },
    angle:   { pri: [/line angle|deviation|sapma/, /(^| )angle|(^| )aci( |$)/], ex: /point/ },
    span:    { pri: [/span2|updated|actual span|gercek aciklik/, /(^| )span|aciklik|ara mesafe/], ex: /wind|weight|rul+ing|ratio|back|ahead|section|damper/ },
    station: { pri: [/station|chainage|cumul|kumulatif|progressive|kilometre/] , ex: /zzzz/ },
    cross:   { pri: [/crossing|gecis/, /remark|aciklama|not( |$)/], ex: /zzzz/ },
  };

  function autoDetect(aoa) {
    const maxR = Math.min(aoa.length, 45);
    let best = -1, bestScore = 0;
    for (let r = 0; r < maxR; r++) {
      const row = aoa[r] || [];
      let sc = 0;
      for (const c of row) {
        if (typeof c !== 'string') continue;
        const t = trLower(c);
        for (const f of Object.values(FIELDS)) if (f.pri.some((re) => re.test(t))) { sc++; break; }
      }
      if (sc > bestScore) { bestScore = sc; best = r; }
    }
    if (best < 0) return { headerRow: 0, dataStart: 1, cols: {}, labels: [] };
    let h0 = Math.max(0, best - 2), h1 = best;
    const nxt = aoa[best + 1] || [];
    if (nxt.length && !nxt.some((c) => typeof c === 'number')) h1 = best + 1;
    let width = 0;
    for (let r = h0; r <= Math.min(aoa.length - 1, h1 + 3); r++) width = Math.max(width, (aoa[r] || []).length);
    const labels = [];
    for (let c = 0; c < width; c++) {
      const parts = [];
      for (let r = h0; r <= h1; r++) { const v = (aoa[r] || [])[c]; if (typeof v === 'string' && v.trim()) parts.push(v.trim()); }
      labels.push(parts.join(' / '));
    }
    const cols = {};
    const used = new Set();
    for (const [key, f] of Object.entries(FIELDS)) {
      let chosen = null;
      for (const re of f.pri) {
        for (let c = 0; c < width; c++) {
          if (used.has(c)) continue;
          const t = trLower(labels[c]);
          if (!t || f.ex.test(t)) continue;
          if (re.test(t)) { chosen = c; break; }
        }
        if (chosen != null) break;
      }
      if (chosen != null) { cols[key] = chosen; used.add(chosen); }
    }
    // İletken tipi ayrı sütunda değil de sütun grubu olarak verilmişse ("CONDUCTOR ACSR 400/51" |
    // "CONDUCTOR ACSR 500/204", altında spacer / stockbridge sütunları): açıklık satırında hangi
    // grubun dolu olduğu o açıklığın iletkenidir.
    const condGroups = [];
    const topHdr = /^(conductor|opgw|earth ?wire|grounding|warning|crossing|towers|foundation)/;
    for (let c = 0; c < width; c++) {
      const t = trLower(labels[c]);
      const m = t.match(/^conductor[^0-9]*?(\d{2,4}\s*\/\s*\d{2,4})/);
      if (!m) continue;
      const cols2 = [c];
      for (let k = c + 1; k < width && !topHdr.test(trLower(labels[k])); k++) cols2.push(k);
      condGroups.push({ cond: m[1].replace(/\s+/g, ''), cols: cols2 });
    }
    return { headerRow: h1, dataStart: h1 + 1, cols, labels, condGroups };
  }

  // Satırları direklere çevirir. Açıklık / geçiş bilgisi direk satırında ya da
  // altındaki (direk no boş veya aynı) ara satırda olabilir → o direğin İLERİ açıklığı sayılır.
  function extractRows(aoa, map) {
    const c = map.cols || {};
    const get = (row, k) => (c[k] == null ? null : row[c[k]]);
    const towers = [];
    let cur = null;
    for (let r = map.dataStart || 0; r < aoa.length; r++) {
      const row = aoa[r] || [];
      const noV = get(row, 'no');
      const noS = isBlank(noV) ? '' : String(typeof noV === 'number' ? +noV.toFixed(3) : noV).trim();
      const has = ['type', 'z', 'span', 'station', 'angle'].some((k) => !isBlank(get(row, k)));
      if (noS && (!cur || noS !== cur.no)) {
        if (!/\d/.test(noS) || noS.length > 14 || !has) { continue; }
        cur = { no: noS, type: '', z: null, angle: null, station: null, spanVals: [], cross: [], cond: [], condVotes: {}, row: r };
        towers.push(cur);
      } else if (!cur) continue;
      const ty = get(row, 'type'); if (!cur.type && !isBlank(ty)) cur.type = String(ty).replace(/\s+/g, ' ').trim();
      const z = num(get(row, 'z')); if (cur.z == null && z != null) cur.z = z;
      const a = num(get(row, 'angle')); if (cur.angle == null && a != null) cur.angle = a;
      const st = num(get(row, 'station')); if (cur.station == null && st != null) cur.station = st;
      const sp = num(get(row, 'span')); if (sp != null && sp > 0) cur.spanVals.push(sp);
      const cr = get(row, 'cross'); if (!isBlank(cr) && typeof cr === 'string') cur.cross.push(cr.trim());
      const cd = get(row, 'cond'); if (!isBlank(cd)) cur.cond.push(String(cd).trim());
      // grup sütunları: ilk sütun (izolatör zinciri) direğe aittir, açıklığı göstermez
      for (const g of map.condGroups || []) {
        if (g.cols.slice(1).some((cc) => !isBlank(row[cc]))) cur.condVotes[g.cond] = (cur.condVotes[g.cond] || 0) + 1;
      }
    }
    const spans = [];
    for (let i = 0; i < towers.length - 1; i++) {
      let pl = towers[i].spanVals[0];
      if ((pl == null || !(pl > 0)) && towers[i].station != null && towers[i + 1].station != null) pl = towers[i + 1].station - towers[i].station;
      const votes = Object.entries(towers[i].condVotes).sort((a, b) => b[1] - a[1]);
      spans.push({ plan: pl > 0 ? pl : 0, cross: towers[i].cross.join(', '), cond: towers[i].cond[0] || (votes[0] ? votes[0][0] : '') });
    }
    return {
      towers: towers.map((t) => ({ no: t.no, type: t.type || '?', z: t.z, angle: t.angle, row: t.row })),
      spans,
    };
  }

  function typeFamily(t) { return String(t).replace(/\s+/g, '').replace(/[+-]\d+(\.\d+)?$/, ''); }

  function guessTensionTypes(towers) {
    const fam = new Set();
    towers.forEach((t, i) => {
      if (i === 0 || i === towers.length - 1 || (t.angle != null && Math.abs(t.angle) > 0.3)) fam.add(typeFamily(t.type));
    });
    const out = {};
    for (const t of towers) out[t.type] = fam.has(typeFamily(t.type));
    return out;
  }

  const DEFAULT_FORBID = 'ASPHALT, ASFALT, MAIN ROAD, HIGHWAY, ROAD, YOL, RAIL, DEMIRYOL, PIPE, BORU, KV, T/L, OHTL, OHL, OHDL, TRANSMISSION, ENERJI, VALLEY, VADI';
  function crossingForbidden(text, keywords) {
    const t = String(text || '').toUpperCase();
    if (!t.trim()) return false;
    return String(keywords || '').split(',').map((k) => k.trim().toUpperCase()).filter(Boolean).some((k) => t.includes(k));
  }

  const DEFAULT_PARAMS = {
    maxDrum: 3000, bundle: 2, circuits: 1, angleLimit: 30, sag: 1.015, jointLoss: 10,
    minJointDist: 25, protectSpans: 2, jointsOnlyLong: true, roundStep: 25, groupWindow: 20,
    groupTol: 3, shortPiece: 500, maxEtapsPerDrum: 3, sameLengthPerEtap: true, shortEtapPenalty1: 1.0, shortEtapPenalty2: 0.5, maxPull: 0, pullEveryTension: true, distLimitKm: 0, maxChain: 8, altScope: 'hard',
  };

  // ---------------------------------------------------------------- ana hesap
  function computePlan(input) {
    const p = Object.assign({}, DEFAULT_PARAMS, input.params || {});
    const towers = input.towers, spans = input.spans;
    const N = towers.length;
    const errors = [], warnings = [];
    const EN = p.lang === 'en';
    if (N < 2) return { errors: ['En az 2 direk gerekli.'] };
    const B = Math.max(1, Math.round(p.bundle)), C = Math.max(1, Math.round(p.circuits));
    const phases = 3 * C, cond = phases * B, jl = p.jointLoss;
    const maxFor = (c) => (p.maxDrumByCond && c && p.maxDrumByCond[c] > 0 ? +p.maxDrumByCond[c] : p.maxDrum);
    const condOf = spans.map((sp) => sp.cond || '');
    const spanMax = condOf.map(maxFor);

    // 1) açıklık uzunlukları: plan → 3B eğik → × sehim
    const L3 = [], L = [], plan = [], pos = [0], ppos = [0];
    for (let j = 0; j < N - 1; j++) {
      const pl = spans[j].plan || 0;
      let dz = (towers[j + 1].z != null && towers[j].z != null) ? towers[j + 1].z - towers[j].z : 0;
      if (!pl) warnings.push(EN ? `T${towers[j].no}–T${towers[j + 1].no}: span is 0 / unreadable.` : `T${towers[j].no}–T${towers[j + 1].no} açıklığı 0 / okunamadı.`);
      plan[j] = pl; L3[j] = Math.hypot(pl, dz); L[j] = L3[j] * p.sag;
      pos[j + 1] = pos[j] + L[j]; ppos[j + 1] = ppos[j] + pl;
    }
    const total = pos[N - 1];

    // 2) tension direkleri ve tension bölümleri
    const T = towers.map((t, i) => !!(input.tension && input.tension[i]));
    T[0] = T[N - 1] = true;
    // iletken tipi değişen direk: bobin oradan geçemez (tension olmalı)
    const condChange = towers.map((t, i) => i > 0 && i < N - 1 && condOf[i - 1] !== condOf[i]);
    condChange.forEach((v, i) => { if (v && !T[i]) { T[i] = true; warnings.push(EN ? `T${towers[i].no}: conductor changes (${condOf[i - 1]} → ${condOf[i]}) but the tower is not marked tension — treated as tension.` : `T${towers[i].no}: iletken tipi değişiyor (${condOf[i - 1]} → ${condOf[i]}) ama tension işaretli değil — tension kabul edildi.`); } });
    // Kullanıcının "ayrı tek açıklıklı etap" dediği açıklık (ör. yol/ENH geçişi): iki ucunda bobin
    // etabı kesin biter, açıklıkta ek yapılmaz. Uçtaki direk tension değilse tension kabul edilir.
    const alone = spans.map((sp) => !!sp.alone);
    const forcedBreak = towers.map((t, i) => (i > 0 && alone[i - 1]) || (i < N - 1 && alone[i]));
    forcedBreak.forEach((v, i) => {
      if (v && !T[i]) {
        T[i] = true;
        warnings.push(EN ? `T${towers[i].no}: end of a single-span section but not marked tension — treated as tension.` : `T${towers[i].no}: tek açıklıklı etabın ucu ama tension işaretli değil — tension kabul edildi.`);
      }
    });
    const TI = []; T.forEach((v, i) => v && TI.push(i));
    const big = towers.map((t, i) => T[i] && i > 0 && i < N - 1 && t.angle != null && Math.abs(t.angle) > p.angleLimit);
    const secLen = []; const secOfSpan = [];
    for (let s = 0; s < TI.length - 1; s++) {
      secLen[s] = pos[TI[s + 1]] - pos[TI[s]];
      for (let j = TI[s]; j < TI[s + 1]; j++) secOfSpan[j] = s;
    }

    // 3) ek yapılabilir bölgeler
    const spanInfo = [];
    const intervals = [];
    for (let j = 0; j < N - 1; j++) {
      const s = secOfSpan[j];
      const k = j - TI[s], m = TI[s + 1] - 1 - j;
      let why = '';
      if (spans[j].forbid || alone[j]) why = 'geçiş (ek yasak)';
      else if (k < p.protectSpans) why = `tension sonrası ${k + 1}. açıklık`;
      else if (m < p.protectSpans) why = `tension öncesi son ${m + 1}. açıklık`;
      else if (p.jointsOnlyLong && secLen[s] <= spanMax[j] + EPS) why = 'bölüm bobine sığıyor';
      else if (plan[j] <= 2 * p.minJointDist) why = 'açıklık çok kısa';
      const info = { j, sec: s, why, legal: !why };
      if (!why) {
        const d = p.minJointDist / plan[j] * L[j];
        info.a = pos[j] + d; info.b = pos[j + 1] - d;
        intervals.push(info);
      }
      spanInfo.push(info);
    }

    function farthestLegal(lo, hi) {
      let best = null;
      for (const iv of intervals) {
        if (iv.a > hi + EPS) break;
        if (iv.b <= lo + EPS) continue;
        const x = Math.min(iv.b, hi);
        if (x > lo + EPS && x >= iv.a - EPS) best = x;
      }
      return best;
    }
    function greedyCuts(start, end, MAX) {
      const cuts = []; let cur = start;
      while (end - cur > MAX + EPS) {
        const x = farthestLegal(cur, Math.min(cur + MAX - jl, end));
        if (x == null) return null;
        cuts.push(x); cur = x;
        if (cuts.length > 500) return null;
      }
      return cuts;
    }
    function balancedCuts(start, end, n, MAX) {
      const R = (end - start + (n - 1) * jl) / n;
      const cuts = []; let cur = start;
      for (let k = 1; k < n; k++) {
        const desired = cur + R - jl;
        const hi = Math.min(cur + MAX - jl, end);
        const cands = [];
        for (const iv of intervals) {
          if (iv.a > hi + EPS) break;
          if (iv.b <= cur + EPS) continue;
          const lo2 = Math.max(iv.a, cur + 1), hi2 = Math.min(iv.b, hi);
          if (hi2 < lo2) continue;
          cands.push(Math.min(Math.max(desired, lo2), hi2), lo2, hi2);
        }
        cands.sort((a, b) => Math.abs(a - desired) - Math.abs(b - desired));
        let pick = null;
        for (const x of cands) {
          const rest = greedyCuts(x, end, MAX);
          if (rest && rest.length <= n - k - 1) { pick = x; break; }
        }
        if (pick == null) return greedyCuts(start, end, MAX);
        cuts.push(pick); cur = pick;
      }
      return cuts;
    }
    const segCost = (req, MAX) => (req > MAX * 0.5 ? 1 : 0.04 + (req + jl) / MAX);

    // 4) DP: tension direklerinden zincirler (gerekirse ekli)
    const nT = TI.length;
    const best = new Array(nT).fill(Infinity), from = new Array(nT).fill(null);
    best[0] = 0;
    for (let ia = 0; ia < nT - 1; ia++) {
      if (!isFinite(best[ia])) continue;
      let pen = 0;
      const MAX = spanMax[TI[ia]];
      for (let ib = ia + 1; ib < nT && ib - ia <= p.maxChain; ib++) {
        if (ib - 1 > ia && big[TI[ib - 1]]) pen += 0.003;
        if (ib - 1 > ia && (condChange[TI[ib - 1]] || forcedBreak[TI[ib - 1]])) break;
        const a = pos[TI[ia]], b = pos[TI[ib]];
        const D = b - a;
        let cuts;
        if (D <= MAX + EPS) cuts = [];
        else {
          const g = greedyCuts(a, b, MAX);
          if (!g) break;
          cuts = balancedCuts(a, b, g.length + 1, MAX);
        }
        const pts = [a, ...cuts, b];
        let cost = pen + 0.01 * cuts.length;
        for (let k = 0; k < pts.length - 1; k++) cost += segCost(pts[k + 1] - pts[k] + (k < pts.length - 2 ? jl : 0), MAX);
        // 1-2 açıklıklı kısa etaplardan kaçın (her biri ayrı tel çekimi kurulumu demek). İstisna:
        // 3. taraf izinli geçiş (asfalt yol, ENH, demiryolu…) — orada tel çekimini kısaltmak için
        // tek açıklıklı etap kabul; gantry açıklığı; iletken tipinin değiştiği bölüm.
        if (!cuts.length) {
          const nsp = TI[ib] - TI[ia];
          if (nsp <= 2) {
            let exempt = false;
            for (let j = TI[ia]; j < TI[ib]; j++) if (spans[j].forbid || alone[j]) exempt = true;
            if (/gantry/i.test(towers[TI[ia]].type) || /gantry/i.test(towers[TI[ib]].type)) exempt = true;
            // farklı iletkenli (ör. 500/204 geçiş açıklığı) bölümün kendisi: iki ucunda da iletken değişiyor
            const edge = (i) => i === 0 || i === N - 1 || condChange[i];
            if (edge(TI[ia]) && edge(TI[ib]) && (condChange[TI[ia]] || condChange[TI[ib]])) exempt = true;
            if (!exempt) cost += nsp === 1 ? p.shortEtapPenalty1 : p.shortEtapPenalty2;
          }
        }
        if (best[ia] + cost < best[ib] - 1e-9) { best[ib] = best[ia] + cost; from[ib] = { ia, cuts }; }
      }
    }
    if (!isFinite(best[nT - 1])) {
      let k = 0; while (k < nT - 1 && isFinite(best[k + 1])) k++;
      errors.push(EN ? `No drum plan possible after T${towers[TI[k]].no}: the section exceeds the maximum drum length and there is no permitted joint location (crossings / first-last 2 spans / 25 m rule). Check the maximum drum length or the no-joint spans.` : `T${towers[TI[k]].no} sonrasında bobin planı kurulamadı: bölüm en uzun bobini aşıyor ve kurallara uygun ek yeri yok (geçişler / ilk-son 2 açıklık / 25 m kuralı). En uzun bobin boyunu ya da ek yasaklarını kontrol edin.`);
      return { errors, warnings, towers, spans, L, L3, pos, ppos, plan, T, TI, big, spanInfo, params: p };
    }
    const chains = [];
    for (let ib = nT - 1; ib > 0;) { const f = from[ib]; chains.unshift({ ia: f.ia, ib, cuts: f.cuts }); ib = f.ia; }

    // 5) iletken etapları (segment)
    const locOf = (x) => {
      for (let i = 0; i < N; i++) if (Math.abs(pos[i] - x) < 1e-3) return { tower: i };
      let j = 0; while (j < N - 2 && pos[j + 1] <= x) j++;
      const off = (x - pos[j]) / L[j] * plan[j];
      return { span: j, off, rem: plan[j] - off };
    };
    const toPlan = (x) => { const l = locOf(x); return l.tower != null ? ppos[l.tower] : ppos[l.span] + l.off; };
    const segments = [], joints = [];
    for (const ch of chains) {
      const pts = [pos[TI[ch.ia]], ...ch.cuts, pos[TI[ch.ib]]];
      for (let k = 0; k < pts.length - 1; k++) {
        const s = { id: segments.length + 1, start: pts[k], end: pts[k + 1], chain: chains.indexOf(ch), cond: condOf[TI[ch.ia]], max: spanMax[TI[ch.ia]] };
        s.startLoc = locOf(s.start); s.endLoc = locOf(s.end);
        s.len = s.end - s.start;
        s.endsAtJoint = s.endLoc.tower == null;
        s.startsAtJoint = s.startLoc.tower == null;
        s.req = s.len + (s.endsAtJoint ? jl : 0);
        s.pStart = toPlan(s.start); s.pEnd = toPlan(s.end);
        const i0 = s.startLoc.tower != null ? s.startLoc.tower : s.startLoc.span + 1;
        const i1 = s.endLoc.tower != null ? s.endLoc.tower : s.endLoc.span;
        s.passTension = []; s.passBig = [];
        for (let i = i0 + (s.startLoc.tower != null ? 1 : 0); i <= i1 - (s.endLoc.tower != null ? 1 : 0); i++) {
          if (T[i]) s.passTension.push(i);
          if (big[i]) s.passBig.push(i);
        }
        s.towerRange = [s.startLoc.tower != null ? s.startLoc.tower : s.startLoc.span, s.endLoc.tower != null ? s.endLoc.tower : s.endLoc.span + 1];
        s.hard = false;
        for (let i = s.towerRange[0]; i <= s.towerRange[1]; i++) if (towers[i].hard) s.hard = true;
        segments.push(s);
        if (s.endsAtJoint) joints.push({ id: joints.length + 1, x: s.end, px: s.pEnd, loc: s.endLoc, segBefore: s.id, segAfter: s.id + 1 });
      }
    }

    // 6) faz parçalarını bobin setlerine yerleştir (set = bundle sayısı kadar aynı bobin)
    function pack(altSegIds, grouped) {
      const sets = [];
      const setTotal = (st) => st.pieces.reduce((a, pc) => a + pc.req, 0) + jl * (st.pieces.length - 1);
      const center = (st) => st.pieces.reduce((a, pc) => a + (pc.seg.pStart + pc.seg.pEnd) / 2, 0) / st.pieces.length;
      const small = [];
      for (const s of segments) {
        const pcs = []; for (let ph = 1; ph <= phases; ph++) pcs.push({ seg: s, ph, req: s.req });
        if (altSegIds.has(s.id)) {
          const k = Math.max(1, Math.floor((s.max + jl) / (s.req + jl)));
          for (let i = 0; i < pcs.length; i += k) sets.push({ pieces: pcs.slice(i, i + k), alt: k > 1 });
        } else if (s.req > (s.max - jl) / 2) {
          for (const pc of pcs) sets.push({ pieces: [pc] });
        } else if (grouped && s.req > p.shortPiece) {
          // etap kendi bobinleriyle: her set k fazı sırayla çeker, fazlar setlere eşit dağıtılır
          const k = Math.max(1, Math.min(phases, Math.floor((s.max + jl) / (s.req + jl))));
          const nS = Math.ceil(phases / k), per = Math.ceil(phases / nS);
          for (let i = 0; i < phases; i += per) sets.push({ pieces: pcs.slice(i, i + per) });
        } else small.push(...pcs);
      }
      // Yarım bobinden kısa parçalar başka etapların setlerinin boş kısmına eklenir (ör. gantry,
      // 144-148 artanı → 198-201). Aynı etabın fazlarını aynı sete koymak (bobini aynı etapta
      // tekrar kullanmak) varsayılan planda sadece çok kısa parçalarda (≤ kısa parça eşiği) yapılır.
      small.sort((a, b) => b.req - a.req || a.seg.id - b.seg.id || a.ph - b.ph);
      for (const pc of small) {
        const c0 = (pc.seg.pStart + pc.seg.pEnd) / 2;
        let bestSet = null, bestKey = Infinity;
        for (const st of sets) {
          const sc = st.pieces[0].seg;
          if (sc.cond !== pc.seg.cond) continue;
          const free = sc.max - setTotal(st) - jl;
          if (free + EPS < pc.req) continue;
          if (st.pieces.some((q) => q.seg.id === pc.seg.id && q.ph === pc.ph)) continue;
          if (new Set([...st.pieces.map((q) => q.seg.id), pc.seg.id]).size > p.maxEtapsPerDrum) continue;
          const d = Math.abs(center(st) - c0);
          if (p.distLimitKm > 0 && st.pieces.some((q) => Math.abs((q.seg.pStart + q.seg.pEnd) / 2 - c0) > p.distLimitKm * 1000)) continue;
          let key = d * 1e-3 + (free - pc.req) * 1e-4;
          // "etapta tek bobin boyu" kuralında, parçayı eklemek bu setin sipariş boyunu etabın diğer
          // setlerinin üstüne çıkarırsa o etabın bütün bobinleri uzar: bu fazla metrajı maliyete kat.
          if (p.sameLengthPerEtap) {
            const rnd = (v) => (p.roundStep > 0 ? Math.ceil(v / p.roundStep - 1e-9) * p.roundStep : Math.ceil(v));
            const ownerSeg = st.pieces[0].seg.id;
            const sib = sets.filter((x) => x.pieces[0].seg.id === ownerSeg);
            const curMax = Math.max(...sib.map((x) => rnd(setTotal(x))));
            const newLen = rnd(setTotal(st) + pc.req + jl);
            const raise = Math.max(0, newLen - curMax) * sib.length;
            key += raise * 1e-2;
          }
          if (key < bestKey) { bestKey = key; bestSet = st; }
        }
        if (bestSet) bestSet.pieces.push(pc); else sets.push({ pieces: [pc] });
      }
      // Sadece tek etabın fazlarını taşıyan setlerde fazları eşit dağıt (4+2 yerine 3+3)
      const bySeg = new Map();
      for (const st of sets) {
        const ids = new Set(st.pieces.map((q) => q.seg.id));
        if (ids.size === 1 && st.pieces.length > 1) { const k = [...ids][0]; if (!bySeg.has(k)) bySeg.set(k, []); bySeg.get(k).push(st); }
      }
      for (const group of bySeg.values()) {
        if (group.length < 2) continue;
        const pcs = group.flatMap((st) => st.pieces).sort((a, b) => a.ph - b.ph);
        const per = Math.ceil(pcs.length / group.length);
        group.forEach((st, i) => (st.pieces = pcs.slice(i * per, (i + 1) * per)));
      }
      // setleri hat boyunca sırala: S1 hattın başında
      for (let i = sets.length - 1; i >= 0; i--) if (!sets[i].pieces.length) sets.splice(i, 1);
      sets.forEach((st) => st.pieces.sort((a, b) => a.seg.start - b.seg.start || a.ph - b.ph));
      sets.sort((a, b) => a.pieces[0].seg.start - b.pieces[0].seg.start || a.pieces[0].ph - b.pieces[0].ph);
      sets.forEach((st, i) => {
        st.id = i + 1;
        st.total = setTotal(st);
        st.reuseLoss = jl * (st.pieces.length - 1);
        st.jointLoss = st.pieces.reduce((a, pc) => a + (pc.seg.endsAtJoint ? jl : 0), 0);
        st.cond = st.pieces[0].seg.cond; st.max = st.pieces[0].seg.max;
        st.need = Math.min(st.max, p.roundStep > 0 ? Math.ceil(st.total / p.roundStep - 1e-9) * p.roundStep : Math.ceil(st.total));
        if (st.need < st.total) st.need = Math.ceil(st.total);
      });
      // Aynı etabın bobinleri tek boyda: bir etaba ait (en uzun parçası o etapta olan) setlerin
      // hepsi o etaptaki en uzun boya çekilir — sahada bir etap için tek bobin boyu.
      if (p.sameLengthPerEtap) {
        const ownerOf = (st) => st.pieces.reduce((b, q) => (q.req > b.req ? q : b), st.pieces[0]).seg.id;
        const maxBySeg = new Map();
        for (const st of sets) { const k = ownerOf(st); maxBySeg.set(k, Math.max(maxBySeg.get(k) || 0, st.need)); }
        for (const st of sets) st.need = maxBySeg.get(ownerOf(st));
      }
      // stok
      const stock = [];
      (input.stock || []).forEach((sk) => { for (let i = 0; i < (sk.count || 0); i++) stock.push({ name: sk.name || 'Stok', length: +sk.length, cond: sk.cond || '', used: null }); });
      stock.sort((a, b) => a.length - b.length);
      [...sets].sort((a, b) => b.total - a.total).forEach((st) => {
        const cand = stock.filter((d) => !d.used && d.length + EPS >= st.total && (!d.cond || d.cond === st.cond));
        if (cand.length >= B) {
          st.source = 'stok'; st.drums = cand.slice(0, B);
          st.drums.forEach((d) => (d.used = st.id));
          st.length = Math.max(...st.drums.map((d) => d.length));
        } else st.source = 'sipariş';
      });
      // sipariş boylarını grupla (fark ≤ pencere + tolerans → grubun en uzunu)
      const ordered = sets.filter((s) => s.source === 'sipariş').sort((a, b) => (a.cond < b.cond ? -1 : a.cond > b.cond ? 1 : 0) || a.need - b.need);
      const groups = [];
      for (const st of ordered) {
        let g = groups[groups.length - 1];
        if (!g || g.cond !== st.cond || st.need - g.min > p.groupWindow + p.groupTol + EPS) { g = { min: st.need, cond: st.cond, sets: [] }; groups.push(g); }
        g.sets.push(st);
      }
      groups.forEach((g, gi) => {
        g.id = gi + 1;
        g.length = Math.max(...g.sets.map((s) => s.need));
        g.qty = g.sets.length * B;
        g.sets.forEach((s) => { s.length = g.length; s.group = g.id; });
      });
      // Kullanıcının elle değiştirdiği sipariş boyları: anahtar "iletken|hesaplanan boy" → yeni boy.
      // Yeni boy, gruptaki her setin gerçek ihtiyacından kısa olamaz; aynı boya düşen gruplar birleşir.
      const ov = p.orderOverrides || {};
      const unusedOverrides = new Set(Object.keys(ov));
      const overrideErrors = [];
      for (const g of groups) {
        const key = `${g.cond}|${g.length}`;
        g.keys = [key];
        // etaplar: her setin en uzun parçasının etabı
        const segsOf = [...new Set(g.sets.map((st) => st.pieces.reduce((b, q) => (q.req > b.req ? q : b), st.pieces[0]).seg.id))].sort((x, y) => x - y);
        g.parts = [{ calc: g.length, qty: g.qty, manual: false, segs: segsOf }];
        const nl = +ov[key];
        if (!(nl > 0)) continue;
        unusedOverrides.delete(key);
        const needMax = Math.max(...g.sets.map((s) => s.total));
        if (nl + EPS < needMax) { overrideErrors.push({ key, length: nl, need: Math.ceil(needMax) }); continue; }
        g.calcLength = g.length;
        g.length = nl;
        g.manual = true;
        g.parts[0].manual = true;
        g.sets.forEach((s) => { s.length = nl; s.manual = true; });
      }
      for (let i = groups.length - 1; i > 0; i--) {
        const j = groups.findIndex((x, k) => k < i && x.cond === groups[i].cond && x.length === groups[i].length);
        if (j >= 0) { groups[j].sets.push(...groups[i].sets); groups[j].qty += groups[i].qty; groups[j].keys.push(...groups[i].keys); groups[j].parts.push(...groups[i].parts); groups[j].manual = groups[j].manual || groups[i].manual; groups.splice(i, 1); }
      }
      groups.sort((a, b) => (a.cond < b.cond ? -1 : a.cond > b.cond ? 1 : 0) || a.length - b.length);
      groups.forEach((g, gi) => { g.id = gi + 1; g.sets.forEach((s) => (s.group = g.id)); });
      const req = sets.reduce((a, s) => a + s.total, 0) * B;
      const supplied = sets.reduce((a, s) => a + (s.source === 'stok' ? s.drums.reduce((x, d) => x + d.length, 0) : s.length * B), 0);
      return {
        sets, groups, stock, unusedOverrides: [...unusedOverrides], overrideErrors,
        drumCount: sets.length * B,
        orderedDrums: groups.reduce((a, g) => a + g.qty, 0),
        orderedLen: groups.reduce((a, g) => a + g.qty * g.length, 0),
        stockUsedLen: stock.filter((d) => d.used).reduce((a, d) => a + d.length, 0),
        stockUsed: stock.filter((d) => d.used).length,
        required: req, supplied,
      };
    }
    // Bobin, sığıyorsa aynı etapta birden fazla faz için (ya da başka etabın artanında) kullanılır.
    // İki yerleşim denenir: (a) kısa etap kendi bobinleriyle, (b) parçalar başka etapların artanına.
    // Daha az bobin olan seçilir; eşitse (a) — sahada daha sade.
    const pa = pack(new Set(), true), pb = pack(new Set(), false);
    const main = pb.sets.length < pa.sets.length || (pb.sets.length === pa.sets.length && pb.supplied < pa.supplied - 1) ? pb : pa;
    const alt = null;

    // 7) tel çekimi etapları
    const brk = new Set([0, N - 1]);
    big.forEach((v, i) => v && brk.add(i));
    if (p.pullEveryTension) TI.forEach((i) => brk.add(i));
    segments.forEach((s) => { if (s.startLoc.tower != null) brk.add(s.startLoc.tower); if (s.endLoc.tower != null) brk.add(s.endLoc.tower); });
    const bl = [...brk].sort((a, b) => a - b);
    const pulls = [];
    for (let k = 0; k < bl.length - 1; k++) {
      let a = bl[k]; const b = bl[k + 1];
      while (a < b) {
        let e = b;
        if (p.maxPull > 0 && pos[b] - pos[a] > p.maxPull + EPS) {
          e = null;
          for (const t of TI) if (t > a && t < b && pos[t] - pos[a] <= p.maxPull + EPS) e = t;
          if (e == null) { e = b; warnings.push(EN ? `T${towers[a].no}–T${towers[b].no}: pull exceeds the machine capacity and there is no tension tower in between.` : `T${towers[a].no}–T${towers[b].no} tel çekimi makine kapasitesini aşıyor, arada uygun tension direği yok.`); }
        }
        const pl = { id: pulls.length + 1, a, b: e, len: pos[e] - pos[a], plen: ppos[e] - ppos[a] };
        pl.joints = joints.filter((jt) => jt.x > pos[a] + EPS && jt.x < pos[e] - EPS);
        pl.segs = segments.filter((s) => s.end > pos[a] + EPS && s.start < pos[e] - EPS).map((s) => s.id);
        pl.bigEnd = big[a] || big[e];
        pulls.push(pl);
        a = e;
      }
    }

    // 8) özet
    const net3d = L3.reduce((a, b) => a + b, 0);
    const summary = {
      planLen: ppos[N - 1], len3d: net3d, lenSag: total,
      cond, phases, B, towers: N, tensionCount: TI.length,
      netCond: net3d * cond, sagCond: total * cond,
      joints: joints.length,
    };
    return { errors, warnings, params: p, towers, spans, L, L3, plan, pos, ppos, T, TI, big, spanInfo, intervals, segments, joints, pulls, main, alt, summary };
  }

  const api = { autoDetect, extractRows, guessTensionTypes, typeFamily, crossingForbidden, computePlan, num, trLower, DEFAULT_PARAMS, DEFAULT_FORBID, FIELDS };
export default api;
