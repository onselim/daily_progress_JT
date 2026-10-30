// @ts-nocheck
// Kaynak: 2026-10-22/bobin_listesi/export.js (bağımsız bobin listesi aracı) — aynı hesap, ES modül olarak.
// Değişiklik o dosyada yapılıp buraya kopyalanmalı.
  const PALETTE = ['2F6FDF', 'E8743B', '19A979', 'D64B8A', '8A5CD6', 'C9A227', '13A4B4', 'B5523B', '5B8C2A', '7A7FE0', 'E05A5A', '3C9BD6', 'A26CC2', '4FA36D'];
  const STOCK = '98A2B3';
  const setColor = (st) => (st.source === 'stok' ? STOCK : PALETTE[(st.group - 1) % PALETTE.length]);
  const f0 = (v) => Math.round(v).toLocaleString('tr-TR');
  const f1 = (v) => v.toLocaleString('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

  function ranges(nums, prefix) {
    const s = [...new Set(nums)].sort((a, b) => a - b), out = [];
    for (let i = 0; i < s.length; i++) {
      let j = i; while (j + 1 < s.length && s[j + 1] === s[j] + 1) j++;
      out.push(j > i ? `${prefix}${s[i]}–${prefix}${s[j]}` : `${prefix}${s[i]}`); i = j;
    }
    return out.join(', ');
  }
  const phaseText = (phs, EN) => `${EN ? 'Phase' : 'Faz'} ${phs.length === 1 ? phs[0] : ranges(phs, '').replace(/, /g, ',')}`;

  // Her açıklık (ekli açıklıklar ek noktasından bölünerek) bir satır; her satır tek bir iletken etabına ait.
  function rowModel(R, lang) {
    const EN = lang === 'en';
    const P = R.main, B = R.summary.B, tw = R.towers, N = tw.length;
    const tn = (i) => 'T' + tw[i].no;
    // set sahibi: en uzun parçanın etabı
    const owner = new Map();
    for (const st of P.sets) {
      let best = st.pieces[0];
      for (const pc of st.pieces) if (pc.req > best.req + 1e-6) best = pc;
      owner.set(st, best.seg.id);
      st.drumNos = st.source === 'stok' ? [] : [];
    }
    let dn = 0;
    for (const st of P.sets) { st.drumNos = []; for (let k = 0; k < B; k++) st.drumNos.push(++dn); }

    const locNo = (l) => (l.tower != null ? tw[l.tower].no : `${tw[l.span].no}+${Math.round(l.off)}`);
    const segName = new Map(R.segments.map((s) => [s.id, `E${s.id} (${locNo(s.startLoc)}–${locNo(s.endLoc)})`]));
    const nm = (id) => segName.get(id) || 'E' + id;
    const n0 = (v) => Math.round(v).toLocaleString(EN ? 'en-US' : 'tr-TR');
    const segLen = new Map(R.segments.map((s) => [s.id, s.len]));
    // açıklamalarda başka etaba atıf: "E11 (101–102, 263 m)"
    const nmLen = (id) => {
      const n = nm(id);
      return segLen.has(id) ? n.replace(/\)$/, `, ${n0(segLen.get(id))} m)`) : n;
    };
    const segInfo = new Map();
    for (const sg of R.segments) {
      const owned = P.sets.filter((st) => owner.get(st) === sg.id);
      const hosted = [];
      for (const st of P.sets) if (owner.get(st) !== sg.id) for (const pc of st.pieces) if (pc.seg.id === sg.id) hosted.push({ st, pc });
      const lengths = [...new Set(owned.map((st) => st.length))].sort((a, b) => b - a);
      const lines = [];
      const hostLens = [...new Set(hosted.map((h) => h.st.length))];
      const PH = R.summary.phases, CN = R.summary.cond;
      // 1. satır: etap uzunluğu, iletken sayısı (faz × demet), bu etap için sipariş edilen bobin
      // faz başına gereken, ek payı yüzünden etap boyundan farklıysa ayrıca yazılır
      const reqTxt = Math.round(sg.req) !== Math.round(sg.len) ? (EN ? ` (per phase ${n0(sg.req)} m incl. joint)` : ` (ek payıyla faz başına ${n0(sg.req)} m)`) : '';
      lines.push(EN
        ? `Section ${n0(sg.len)} m${reqTxt} · ${CN} conductors (${PH} phases × ${B}) · ${owned.length * B} drums`
        : `Etap ${n0(sg.len)} m${reqTxt} · ${CN} iletken (${PH} faz × ${B}) · ${owned.length * B} bobin`);
      // 2. satır(lar): bobinler, adım adım. Bir set = B adet aynı boy bobin; makineye BİRLİKTE
      // yüklenir ve bir fazın B iletkenini aynı anda çeker. Set birden fazla çekiş yapıyorsa aynı
      // B bobinle sırayla sonraki faz(lar) çekilir; her yeni çekiş için kayıp payı eklenir.
      const jl = R.params.jointLoss;
      const segOf = (id) => R.segments.find((x) => x.id === id);
      const kmBetween = (a, b) => {
        const A = segOf(a), Bs = segOf(b);
        return Math.abs((A.pStart + A.pEnd) / 2 - (Bs.pStart + Bs.pEnd) / 2) / 1000;
      };
      const describeSet = (st, label) => {
        const out = [];
        const stockTxt = st.source === 'stok' ? (EN ? ` [from stock: ${[...new Set(st.drums.map((d) => d.name))].join(', ')}]` : ` [stoktan: ${[...new Set(st.drums.map((d) => d.name))].join(', ')}]`) : '';
        out.push(EN
          ? `${label} — drums ${ranges(st.drumNos, 'B')} (${B} × ${n0(st.length)} m)${stockTxt}, loaded on the puller together:`
          : `${label} — ${ranges(st.drumNos, 'B')} bobinleri (${B} × ${n0(st.length)} m)${stockTxt}, makineye birlikte yüklenir:`);
        let used = 0, prev = null;
        st.pieces.forEach((q, i) => {
          const loss = i > 0 ? jl : 0;
          used += q.req + loss;
          const where = q.seg.id === sg.id ? '' : `${nmLen(q.seg.id)} `;
          const jointTxt = q.seg.endsAtJoint ? (EN ? ' (incl. joint allowance)' : ' (ek payı dahil)') : '';
          const lossTxt = loss ? (EN ? ` + ${loss} m loss` : ` + ${loss} m kayıp`) : '';
          const move = prev != null && prev !== q.seg.id
            ? (EN ? ` — drums moved ~${kmBetween(prev, q.seg.id).toFixed(1)} km` : ` — bobinler ~${kmBetween(prev, q.seg.id).toFixed(1).replace('.', ',')} km taşınır`)
            : '';
          out.push(`${i + 1}) ${where}${EN ? 'Phase' : 'Faz'} ${q.ph}: ${n0(q.req)} m${jointTxt}${lossTxt}${move}`);
          prev = q.seg.id;
        });
        out.push(EN
          ? `Used ${n0(used)} m · left ${n0(st.length - used)} m on each drum`
          : `Bobin başına kullanılan ${n0(used)} m · artan ${n0(st.length - used)} m`);
        return out;
      };
      const simple = owned.length > 0 && owned.every((st) => st.pieces.length === 1);
      if (simple) {
        const per = owned.map((st) => `${EN ? 'Phase' : 'Faz'} ${st.pieces[0].ph}: ${ranges(st.drumNos, 'B')}`).join(', ');
        const used = Math.max(...owned.map((st) => st.total));
        lines.push(EN
          ? `Drums ${ranges(owned.flatMap((st) => st.drumNos), 'B')} (${owned.length * B} × ${lengths.map(n0).join(' / ')} m): each phase pulled with its own ${B} drums loaded together (${per})`
          : `${ranges(owned.flatMap((st) => st.drumNos), 'B')} bobinleri (${owned.length * B} × ${lengths.map(n0).join(' / ')} m): her faz kendi ${B} bobiniyle, ${B} bobin makineye birlikte yüklenerek çekilir (${per})`);
        lines.push(EN
          ? `Used ${n0(used)} m · left ${n0(Math.min(...owned.map((st) => st.length)) - used)} m on each drum`
          : `Bobin başına kullanılan ${n0(used)} m · artan ${n0(Math.min(...owned.map((st) => st.length)) - used)} m`);
        const fromStock = owned.filter((st) => st.source === 'stok');
        if (fromStock.length) {
          const names = [...new Set(fromStock.flatMap((st) => st.drums.map((d) => d.name)))].join(', ');
          lines.push(EN
            ? `From stock: ${ranges(fromStock.flatMap((st) => st.drumNos), 'B')} (${fromStock.length * B} drums, ${names}) — not ordered`
            : `Stoktan: ${ranges(fromStock.flatMap((st) => st.drumNos), 'B')} (${fromStock.length * B} bobin, ${names}) — sipariş edilmez`);
        }
      } else {
        owned.forEach((st, k) => lines.push(...describeSet(st, `Set ${k + 1}`)));
      }
      if (hosted.length) {
        // bu etap için yeni bobin yok: hangi etabın bobinleriyle, hangi sırada çekildiği
        for (const st of [...new Set(hosted.map((h) => h.st))]) {
          const myPh = st.pieces.filter((q) => q.seg.id === sg.id).map((q) => q.ph);
          const phT = phaseText(myPh, EN);
          lines.push(owned.length
            ? (EN
              ? `${phT}: no new drum — the remaining conductor on the ${nmLen(owner.get(st))} drums is used —`
              : `${phT}: yeni bobin yok — ${nmLen(owner.get(st))} bobinlerinde kalan iletken kullanılır —`)
            : (EN
              ? `No new drums for this section: the remaining conductor on the ${nmLen(owner.get(st))} drums is used —`
              : `Bu etap için yeni bobin yok: ${nmLen(owner.get(st))} bobinlerinde kalan iletken kullanılır —`));
          lines.push(...describeSet(st, 'Set'));
        }
      }
      segInfo.set(sg.id, {
        seg: sg, owned, hosted, lengths,
        drums: owned.length * B,
        drumNos: ranges(owned.flatMap((st) => st.drumNos), 'B'),
        color: owned.length ? setColor(owned[0]) : (hosted.length ? setColor(hosted[0].st) : 'D0D5DD'),
        stock: owned.some((st) => st.source === 'stok'),
        usage: lines.join('\n'),
        from: R.segments.length && sg.startLoc.tower != null ? tn(sg.startLoc.tower) : `${tn(sg.startLoc.span)}+${Math.round(sg.startLoc.off)}`,
        to: sg.endLoc.tower != null ? tn(sg.endLoc.tower) : `${tn(sg.endLoc.span)}+${Math.round(sg.endLoc.off)}`,
      });
    }

    const rows = [];
    for (let j = 0; j < N - 1; j++) {
      const cuts = R.joints.filter((jt) => jt.loc.span === j).sort((a, b) => a.loc.off - b.loc.off);
      const pl = R.plan[j];
      let prev = 0;
      const bounds = cuts.map((c) => ({ off: c.loc.off, joint: c })).concat([{ off: pl, joint: null }]);
      bounds.forEach((bd, k) => {
        const a = prev, b = bd.off; prev = b;
        const xm = R.pos[j] + ((a + b) / 2) / pl * R.L[j];
        const seg = R.segments.find((s) => s.start <= xm && xm < s.end) || R.segments[R.segments.length - 1];
        const pull = R.pulls.find((p) => j >= p.a && j < p.b);
        rows.push({
          j, part: k, parts: bounds.length, first: k === 0,
          tower: k === 0 ? tw[j] : null, ti: j,
          tension: k === 0 && R.T[j], big: k === 0 && R.big[j],
          span: `${tw[j].no}–${tw[j + 1].no}`,
          plan: b - a, len: (b - a) / pl * R.L[j],
          cross: R.spans[j].cross || '', forbid: !!R.spans[j].forbid,
          joint: bd.joint ? { id: bd.joint.id, off: bd.joint.loc.off, rem: bd.joint.loc.rem, next: tn(j + 1), prevT: tn(j) } : null,
          seg: seg.id, pull: pull ? pull.id : null,
        });
      });
    }
    rows.push({ j: N - 1, part: 0, parts: 1, first: true, tower: tw[N - 1], ti: N - 1, tension: true, big: false, span: '', plan: null, len: null, cross: '', joint: null, seg: null, pull: null, last: true });
    // birleştirme blokları
    const blocks = (key) => {
      const out = []; let cur = null;
      rows.forEach((r, i) => {
        const v = r[key];
        if (v == null) { cur = null; return; }
        if (cur && cur.v === v) cur.end = i; else { cur = { v, start: i, end: i }; out.push(cur); }
      });
      return out;
    };
    // Bobin bobin kullanım defteri: her bobinin her çekişte ne kadar verdiği, sonrasında ne kaldığı
    // ve kalanın bir sonraki çekişe yetip yetmediği (kontrol). Bir setin B bobini aynı işi yapar.
    const jl = R.params.jointLoss;
    const ledger = [];
    for (const st of P.sets) {
      st.drumNos.forEach((no, k) => {
        const length = st.source === 'stok' ? st.drums[k].length : st.length;
        let left = length;
        const steps = st.pieces.map((q, i) => {
          const loss = i > 0 ? jl : 0;
          const need = q.req + loss;
          const before = left;
          left = before - need;
          return { seg: q.seg.id, ph: q.ph, len: q.req, loss, joint: q.seg.endsAtJoint, before, after: left, ok: left > -0.5 };
        });
        steps.forEach((s, i) => { const nx = steps[i + 1]; s.next = nx ? nx.len + nx.loss : null; s.nextOk = nx ? s.after + 0.5 >= nx.len + nx.loss : null; });
        ledger.push({
          no, set: st.id, owner: owner.get(st), length, left,
          source: st.source, stockName: st.source === 'stok' ? st.drums[k].name : '',
          partners: st.drumNos.filter((x) => x !== no), steps, ok: steps.every((s) => s.ok),
        });
      });
    }
    return { rows, segInfo, segName, segBlocks: blocks('seg'), pullBlocks: blocks('pull'), tn, ledger };
  }

  function summaryNumbers(R) {
    const P = R.main, S = R.summary, B = S.B;
    const jointL = P.sets.reduce((a, s) => a + s.jointLoss, 0) * B;
    const reuseL = P.sets.reduce((a, s) => a + s.reuseLoss, 0) * B;
    const fire = P.supplied - S.sagCond;
    return { jointL, reuseL, roundL: P.supplied - P.required, fire, firePct: fire / S.sagCond * 100 };
  }

  const condsOf = (R) => [...new Set(R.segments.map((s) => s.cond || ''))];
  function maxText(R) {
    const cs = condsOf(R).filter(Boolean);
    if (cs.length < 2) return f0(R.params.maxDrum) + ' m';
    return cs.map((c) => `${c}: ${f0(R.segments.find((s) => s.cond === c).max)} m`).join(', ');
  }

  // ------------------------------------------------------------------ Excel
  async function buildWorkbook(ExcelJS, R, meta) {
    const M = rowModel(R), P = R.main, S = R.summary, p = R.params, B = S.B;
    const num = summaryNumbers(R);
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Bobin listesi';
    const ws = wb.addWorksheet('Bobin Listesi', { views: [{ showGridLines: false }] });
    ws.pageSetup = { orientation: 'landscape', paperSize: 8, fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 } };
    const W = [7, 11, 8, 11, 9, 10, 32, 7, 17, 11, 12, 11, 7, 11, 34, 16];
    ws.columns = W.map((w) => ({ width: w }));
    const fill = (c) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + c } });
    const thin = { style: 'thin', color: { argb: 'FFD0D5DD' } };
    const med = { style: 'medium', color: { argb: 'FF1F3B63' } };
    const box = { top: thin, left: thin, bottom: thin, right: thin };
    const NAVY = '1F3B63';

    // başlık
    ws.mergeCells('A1:P1');
    ws.getCell('A1').value = `İLETKEN BOBİN LİSTESİ — ${meta.title || ''}`;
    ws.getCell('A1').font = { bold: true, size: 15, color: { argb: 'FF' + NAVY } };
    ws.mergeCells('A2:P2');
    ws.getCell('A2').value = `${S.phases / 3 === 2 ? 'Çift devre (6 faz)' : 'Tek devre (3 faz)'} × ${['', 'single', 'twin', 'triple', 'quad'][B] || B} bundle = ${S.cond} iletken · En uzun bobin ${maxText(R)} · 3B eğik mesafe × ${p.sag} · Ek / tekrar kullanım kaybı ${p.jointLoss} m · Yuvarlama ${p.roundStep} m · Gruplama ≤ ${p.groupWindow}+${p.groupTol} m`;
    ws.getCell('A2').font = { size: 10, color: { argb: 'FF667085' } };
    if (meta.source) { ws.mergeCells('A3:P3'); ws.getCell('A3').value = 'Kaynak: ' + meta.source; ws.getCell('A3').font = { size: 9, italic: true, color: { argb: 'FF98A2B3' } }; }

    // özet (sol) ve sipariş (sağ)
    let r = 5;
    const kv = [
      ['Hat uzunluğu (plan / 3B)', `${f0(S.planLen)} m / ${f0(S.len3d)} m`],
      ['Direk / tension', `${S.towers} / ${S.tensionCount}`],
      ['İletken etabı / ara ek', `${R.segments.length} etap / ${R.joints.length} ek noktası (${R.joints.length * S.cond} mafsal)`],
      ['Tel çekimi etabı', `${R.pulls.length}`],
      ['Gereken iletken (3B × ' + p.sag + ')', `${f0(S.sagCond)} m`],
      ['Sipariş', `${P.orderedDrums} bobin · ${f0(P.orderedLen)} m`],
      ['TOPLAM FİRE', `${f0(num.fire)} m  (%${num.firePct.toFixed(2).replace('.', ',')})`],
    ];
    ws.mergeCells(r, 1, r, 6); ws.getCell(r, 1).value = 'ÖZET'; ws.getCell(r, 1).font = { bold: true, color: { argb: 'FFFFFFFF' } }; ws.getCell(r, 1).fill = fill(NAVY);
    kv.forEach(([k, v], i) => {
      const rr = r + 1 + i;
      ws.mergeCells(rr, 1, rr, 3); ws.mergeCells(rr, 4, rr, 6);
      ws.getCell(rr, 1).value = k; ws.getCell(rr, 4).value = v;
      ws.getCell(rr, 4).alignment = { horizontal: 'right' };
      for (let c = 1; c <= 6; c++) ws.getCell(rr, c).border = { bottom: thin };
      if (k.startsWith('TOPLAM')) { ws.getCell(rr, 1).font = { bold: true, color: { argb: 'FFD92D20' } }; ws.getCell(rr, 4).font = { bold: true, color: { argb: 'FFD92D20' } }; }
      if (k === 'Sipariş') { ws.getCell(rr, 4).font = { bold: true }; }
    });
    // sipariş tablosu H..P
    const multi = condsOf(R).filter(Boolean).length > 1;
    const oh = ['Bobin boyu (m)', 'Adet', 'Toplam (m)', multi ? 'İletken · kullanıldığı etaplar' : 'Kullanıldığı etaplar'];
    ws.mergeCells(r, 8, r, 16); ws.getCell(r, 8).value = 'SİPARİŞ LİSTESİ'; ws.getCell(r, 8).font = { bold: true, color: { argb: 'FFFFFFFF' } }; ws.getCell(r, 8).fill = fill(NAVY);
    const hr = r + 1;
    ws.mergeCells(hr, 8, hr, 9); ws.mergeCells(hr, 12, hr, 16);
    [[8, oh[0]], [10, oh[1]], [11, oh[2]], [12, oh[3]]].forEach(([c, t]) => { const x = ws.getCell(hr, c); x.value = t; x.font = { bold: true }; x.fill = fill('EEF0F4'); });
    const ownerSeg = (st) => { let b = st.pieces[0]; for (const pc of st.pieces) if (pc.req > b.req) b = pc; return b.seg.id; };
    P.groups.forEach((g, i) => {
      const rr = hr + 1 + i;
      ws.mergeCells(rr, 8, rr, 9); ws.mergeCells(rr, 12, rr, 16);
      const c = ws.getCell(rr, 8); c.value = g.length; c.numFmt = '#,##0'; c.font = { bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = fill(PALETTE[(g.id - 1) % PALETTE.length]); c.alignment = { horizontal: 'center' };
      ws.getCell(rr, 10).value = g.qty; ws.getCell(rr, 10).font = { bold: true };
      ws.getCell(rr, 11).value = g.qty * g.length; ws.getCell(rr, 11).numFmt = '#,##0';
      ws.getCell(rr, 12).value = (multi ? g.cond + '  ·  ' : '') + [...new Set(g.sets.map(ownerSeg))].sort((a, b) => a - b).map((x) => M.segName.get(x)).join(', ');
      for (let cc = 8; cc <= 16; cc++) ws.getCell(rr, cc).border = { bottom: thin };
    });
    let tr = hr + 1 + P.groups.length;
    ws.mergeCells(tr, 8, tr, 9);
    ws.getCell(tr, 8).value = 'TOPLAM'; ws.getCell(tr, 8).font = { bold: true };
    ws.getCell(tr, 10).value = P.orderedDrums; ws.getCell(tr, 10).font = { bold: true };
    ws.getCell(tr, 11).value = P.orderedLen; ws.getCell(tr, 11).numFmt = '#,##0'; ws.getCell(tr, 11).font = { bold: true };
    for (let cc = 8; cc <= 16; cc++) ws.getCell(tr, cc).border = { top: med };
    if (multi) {
      for (const c of condsOf(R)) {
        const gs = P.groups.filter((g) => g.cond === c);
        tr++; ws.mergeCells(tr, 8, tr, 9);
        ws.getCell(tr, 8).value = '  ' + c; ws.getCell(tr, 8).font = { italic: true, color: { argb: 'FF667085' } };
        ws.getCell(tr, 10).value = gs.reduce((a, g) => a + g.qty, 0);
        ws.getCell(tr, 11).value = gs.reduce((a, g) => a + g.qty * g.length, 0); ws.getCell(tr, 11).numFmt = '#,##0';
        [10, 11].forEach((cc) => (ws.getCell(tr, cc).font = { italic: true, color: { argb: 'FF667085' } }));
      }
    }
    if (P.stockUsed) {
      tr++; ws.mergeCells(tr, 8, tr, 16);
      ws.getCell(tr, 8).value = `+ stoktan ${P.stockUsed} bobin (${f0(P.stockUsedLen)} m) kullanıldı`;
    }

    // ana tablo
    r = Math.max(r + kv.length + 2, tr + 2);
    const H = ['Direk', 'Tip', 'Tension', 'Açıklık', 'Plan (m)', '3B × ' + p.sag + ' (m)', 'Geçiş / ek', 'Etap', 'Etap aralığı', 'Etap boyu (m)', 'Faz başına gereken (m)', 'Bobin boyu (m)', 'Adet', 'Bobin no', 'Bobin kullanımı', 'Tel çekimi'];
    const head = ws.getRow(r);
    H.forEach((t, i) => {
      const c = head.getCell(i + 1); c.value = t;
      c.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 }; c.fill = fill(NAVY);
      c.alignment = { wrapText: true, vertical: 'middle', horizontal: 'center' }; c.border = box;
    });
    head.height = 30;
    ws.views = [{ state: 'frozen', ySplit: r, showGridLines: false }];
    const r0 = r + 1;
    // birleşik bloktaki yazı sığsın diye satır yüksekliklerini artır
    const ensureHeight = (a, b, lines) => {
      const need = lines * 12.5 + 4, n = b - a + 1;
      let have = 0; for (let rr = a; rr <= b; rr++) have += ws.getRow(rr).height || 15;
      if (have >= need) return;
      const add = (need - have) / n;
      for (let rr = a; rr <= b; rr++) ws.getRow(rr).height = (ws.getRow(rr).height || 15) + add;
    };
    M.rows.forEach((row, i) => {
      const x = ws.getRow(r0 + i);
      const t = row.tower;
      if (t) {
        x.getCell(1).value = t.no; x.getCell(2).value = t.type;
        if (row.tension) {
          x.getCell(3).value = row.big ? `T  ${Math.abs(t.angle).toFixed(0)}°` : 'T';
          for (const c of [1, 2, 3]) { x.getCell(c).font = { bold: true }; x.getCell(c).fill = fill(row.big ? 'FDE7E5' : 'E4E7EC'); }
          if (row.big) x.getCell(3).font = { bold: true, color: { argb: 'FFD92D20' } };
        }
      }
      if (!row.last) {
        x.getCell(4).value = row.parts > 1 ? `${row.span} (${row.part + 1}/${row.parts})` : row.span;
        x.getCell(5).value = +row.plan.toFixed(1); x.getCell(5).numFmt = '#,##0.0';
        x.getCell(6).value = +row.len.toFixed(1); x.getCell(6).numFmt = '#,##0.0';
        const g = x.getCell(7);
        if (row.joint) {
          g.value = { richText: [{ text: `✕ EK ${row.joint.id}: ${row.joint.next} direğine ${Math.round(row.joint.rem)} m kala`, font: { bold: true, color: { argb: 'FFD92D20' } } }].concat(row.cross ? [{ text: '\n' + row.cross, font: { size: 8, color: { argb: 'FF667085' } } }] : []) };
          g.alignment = { wrapText: true, vertical: 'top' };
        } else if (row.cross) {
          g.value = row.cross; g.font = { size: 9, color: { argb: row.forbid ? 'FFD92D20' : 'FF667085' } };
          if (row.forbid) g.fill = fill('FDF0EF');
        }
      }
      for (let c = 1; c <= 7; c++) {
        const cell = x.getCell(c);
        cell.border = Object.assign({}, box, row.joint ? { bottom: { style: 'medium', color: { argb: 'FFD92D20' } } } : {});
        if (!cell.alignment) cell.alignment = { vertical: 'top' };
      }
      if (row.joint) x.height = row.cross ? 28 : 16;
    });
    // etap blokları
    for (const bk of M.segBlocks) {
      const inf = M.segInfo.get(bk.v), sg = inf.seg;
      const a = r0 + bk.start, b = r0 + bk.end;
      const put = (col, val, opt) => {
        if (b > a) ws.mergeCells(a, col, b, col);
        const c = ws.getCell(a, col); c.value = val;
        c.alignment = Object.assign({ vertical: 'middle', horizontal: 'center', wrapText: true }, opt && opt.align);
        if (opt && opt.font) c.font = opt.font;
        if (opt && opt.fill) c.fill = fill(opt.fill);
        if (opt && opt.numFmt) c.numFmt = opt.numFmt;
      };
      put(8, 'E' + sg.id, { font: { bold: true, size: 13, color: { argb: 'FFFFFFFF' } }, fill: inf.color });
      put(9, multi ? { richText: [{ text: `${inf.from} → ${inf.to}`, font: { bold: true } }, { text: '\n' + sg.cond, font: { size: 9, bold: true, color: { argb: sg.cond === condsOf(R)[0] ? 'FF667085' : 'FFB54708' } } }] } : `${inf.from} → ${inf.to}`, { font: { bold: true } });
      put(10, +sg.len.toFixed(1), { numFmt: '#,##0.0' });
      put(11, +sg.req.toFixed(1), { numFmt: '#,##0.0', font: { bold: true } });
      put(12, inf.lengths.length ? inf.lengths.join(' / ') : '—', { font: { bold: true, size: 12, color: { argb: inf.lengths.length ? 'FFFFFFFF' : 'FF667085' } }, fill: inf.lengths.length ? inf.color : 'F2F4F7' });
      put(13, inf.drums || '—', { font: { bold: true } });
      put(14, inf.drumNos || '—', {});
      put(15, inf.usage, { align: { horizontal: 'left' }, font: { size: 9 } });
      ensureHeight(a, b, inf.usage.split('\n').reduce((n, l) => n + Math.ceil(l.length / 46), 0) + (multi ? 1 : 0));
      for (let rr = a; rr <= b; rr++) for (let c = 8; c <= 15; c++) {
        const cell = ws.getCell(rr, c);
        cell.border = { left: c === 8 ? med : thin, right: c === 15 ? med : thin, top: rr === a ? med : undefined, bottom: rr === b ? med : undefined };
      }
      for (let c = 1; c <= 7; c++) { ws.getCell(a, c).border = Object.assign({}, ws.getCell(a, c).border, { top: med }); }
    }
    // tel çekimi blokları
    M.pullBlocks.forEach((bk, k) => {
      const pl = R.pulls.find((q) => q.id === bk.v);
      const a = r0 + bk.start, b = r0 + bk.end;
      if (b > a) ws.mergeCells(a, 16, b, 16);
      const c = ws.getCell(a, 16);
      c.value = `Ç${pl.id}\n${M.tn(pl.a)} → ${M.tn(pl.b)}\n${f0(pl.len)} m${pl.joints.length ? `\n${pl.joints.length} ek` : ''}`;
      c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      c.fill = fill(k % 2 ? 'EEF0F4' : 'DCE7FB'); c.font = { size: 9, bold: false };
      ensureHeight(a, b, String(c.value).split('\n').length);
      for (let rr = a; rr <= b; rr++) ws.getCell(rr, 16).border = { left: med, right: thin, top: rr === a ? thin : undefined, bottom: rr === b ? thin : undefined };
    });
    const endR = r0 + M.rows.length + 1;
    const notes = [
      'Okuma: her satır bir açıklık. Ekli açıklıklar ek noktasından ikiye bölünmüştür (ör. "8–9 (1/2)"). Kalın çerçeve = bir iletken etabı (aynı bobinlerle çekilen bölüm).',
      `Bir etapta ${S.phases} faz × ${B} iletken = ${S.cond} iletken vardır. Bir faz, ${B} adet aynı boy bobinden oluşan bir setle birlikte çekilir; "Adet" o etap için sipariş edilen bobin sayısıdır.`,
      `"Faz başına gereken" = etap boyu (3B eğik × ${p.sag}) + ek varsa ${p.jointLoss} m. Bobin birden fazla kullanılıyorsa her yeni kullanım için +${p.jointLoss} m eklenmiştir.`,
      `Ek kuralları: direğe ≥ ${p.minJointDist} m, tension direğinin iki yanındaki ilk ${p.protectSpans} açıklıkta ek yok, yol / demiryolu / boru hattı / enerji hattı geçişlerinde ek yok. Tension direklerinde 30°'den büyük açı (kırmızı) varsa tel çekimi orada bölünür.`,
    ];
    notes.forEach((t, i) => { ws.mergeCells(endR + i, 1, endR + i, 16); const c = ws.getCell(endR + i, 1); c.value = t; c.font = { size: 9, italic: true, color: { argb: 'FF667085' } }; c.alignment = { wrapText: true }; ws.getRow(endR + i).height = 24; });

    // ---------------- Bobin dağıtımı (depo / saha)
    const wd = wb.addWorksheet('Bobin Dağıtımı', { views: [{ state: 'frozen', ySplit: 3, showGridLines: false }] });
    wd.columns = [9, 11, 9, 8, 16, 44, 12].map((w) => ({ width: w }));
    wd.mergeCells('A1:G1'); wd.getCell('A1').value = 'BOBİN DAĞITIMI — her bobin nerede kullanılır'; wd.getCell('A1').font = { bold: true, size: 13, color: { argb: 'FF' + NAVY } };
    const dh = ['Bobin no', 'Boy (m)', 'Kaynak', 'Set', 'Birlikte çekildiği', 'Kullanım sırası (etap · faz · aralık · m)', 'Artan (m)'];
    dh.forEach((t, i) => { const c = wd.getCell(3, i + 1); c.value = t; c.font = { bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = fill(NAVY); c.border = box; c.alignment = { wrapText: true, vertical: 'middle' }; });
    let dr = 4;
    for (const st of P.sets) {
      const uses = st.pieces.map((pc, k) => {
        const inf = M.segInfo.get(pc.seg.id);
        return `${k + 1}) E${pc.seg.id} · Faz ${pc.ph} · ${inf.from} → ${inf.to} · ${f1(pc.req)}`;
      }).join('\n');
      const lens = st.source === 'stok' ? st.drums.map((d) => d.length) : st.drumNos.map(() => st.length);
      st.drumNos.forEach((no, k) => {
        const row = wd.getRow(dr);
        row.getCell(1).value = st.source === 'stok' ? `${st.drums[k].name}` : 'B' + no;
        const lc = row.getCell(2); lc.value = lens[k]; lc.numFmt = '#,##0'; lc.fill = fill(setColor(st)); lc.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        row.getCell(3).value = st.source;
        row.getCell(4).value = 'S' + st.id;
        row.getCell(5).value = B > 1 ? st.drumNos.filter((x) => x !== no).map((x) => 'B' + x).join(', ') + ' ile' : '';
        row.getCell(6).value = uses; row.getCell(6).alignment = { wrapText: true, vertical: 'top' };
        row.getCell(7).value = +(lens[k] - st.total).toFixed(1); row.getCell(7).numFmt = '#,##0.0';
        for (let c = 1; c <= 7; c++) { row.getCell(c).border = box; if (c !== 6) row.getCell(c).alignment = { vertical: 'top' }; }
        if (st.pieces.length > 1) row.height = 14 * st.pieces.length;
        dr++;
      });
    }
    return wb;
  }

  const api = { rowModel, buildWorkbook, summaryNumbers, setColor, PALETTE, ranges };
export default api;
