"""Part-1 (G1-65) conductor drum check, 30.10.2026.
Plan   = Etap Listesi Part1_29112023.xlsx (user's etap plan: which drum lengths were ordered per etap)
Supply = Hascelik packing list (116 drums: 114 for 500 kV, 2 for the 220 kV interconnection)
Sent   = truck packing lists (Ilk9 trucks, 10, 11-16, 17)"""
import openpyxl, pypdf, re, collections, json
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

ETAP = r'D:\IS\Gurcistan\Tenders\GSE - IBRD-Jvari-Tskaltubo\GSE-Lot1-Project\Design\Miscalleneous\Etap_Listesi\Etap Listesi Part1_29112023.xlsx'
SH = r'D:\IS\Gurcistan\Tenders\GSE - IBRD-Jvari-Tskaltubo\GSE-Lot1-Project\Shipments\082024_Hascelik_Lot1'
PL = SH + r'\24082024_Draft\Bozlar Yapı Gürcistan Çeki Listesi-Sevkiyat.xlsx'
TRUCKS = [SH + r'\Esas Evraklar\İlk9Arac\2. Paket Listeleri\Bozlar Yapı Gürcistan TruckList 9 Trucks-22-23.08.pdf',
          SH + r'\Esas Evraklar\Arac-10\2. Paket Listeleri\Bozlar Yapı Gürcistan Çeki Listesi-10.Arac.pdf',
          SH + r'\Esas Evraklar\Arac-10-16\2. Paket Listeleri\Bozlar Yapı Gürcistan Çeki Listesi-Trucks 11-16.pdf',
          SH + r'\Esas Evraklar\Arac 17\2. Paket Listeleri\Bozlar Yapı Gürcistan Çeki Listesi-Arac17.pdf']

# ---- supply: packing list
ws = openpyxl.load_workbook(PL, data_only=True)['Sayfa1 (2)']
drums = []
for r in range(3, ws.max_row + 1):
    if not isinstance(ws.cell(r, 2).value, int): continue
    drums.append(dict(no=ws.cell(r, 2).value, forr=ws.cell(r, 1).value, id=str(ws.cell(r, 3).value), len=ws.cell(r, 6).value, net=ws.cell(r, 8).value))
byid = {d['id']: d for d in drums}
print('drums', len(drums), 'unique ids', len(byid))

# ---- trucks
n = 0
for f in TRUCKS:
    rd = pypdf.PdfReader(f)
    for p in rd.pages:
        t = p.extract_text()
        if 'PACKING LIST FOR ALUMINUM CONDUCTOR' not in t: continue
        if '(For 220 kV' not in t: n += 1   # the 220 kV drums travelled on truck 17 (same plate), listed on a separate page
        ids = re.findall(r'\b(1111\d{6})\b', t)
        date = re.search(r'(\d\d\.\d\d\.\d{4})', t)
        plate = re.search(r'\d\d\.\d\d\.\d{4}\s*\n(.+)', t)
        for i in ids:
            if i in byid:
                byid[i].update(truck=n, date=date.group(1) if date else '', plate=plate.group(1).strip() if plate else '')
print('trucks', n, 'drums with truck', sum('truck' in d for d in drums))
for d in drums:
    if 'truck' not in d: print('NOT SHIPPED', d)

# ---- plan from the Etap list
we = openpyxl.load_workbook(ETAP, data_only=True).active
etaps = []
cur = None
for r in range(2, we.max_row + 1):
    a = we.cell(r, 1).value
    if a is not None: cur = str(a)
    k = we.cell(r, 11).value; l = we.cell(r, 12).value; m = we.cell(r, 13).value
    if isinstance(k, (int, float)) or l:
        etaps.append(dict(start=cur, sec=k if isinstance(k, (int, float)) else None, L=(l or '').strip(), M=(m or '').strip()))
for i, e in enumerate(etaps):
    e['end'] = etaps[i + 1]['start'] if i + 1 < len(etaps) else '65'
# NEW drums per etap, transcribed from column L (the leftovers "kalan" are not new drums)
NEW = {
    'G1': {1650: 1}, '1': {1650: 1, 1950: 1}, '2': {1800: 3}, '4': {2000: 3}, '6': {1900: 3}, '7': {},
    '8': {1550: 4}, '10': {2100: 9}, '16': {1850: 9}, '21': {2100: 9}, '26': {1450: 6, 2000: 3},
    '30': {2050: 4, 1950: 1}, '33': {1800: 4}, '35': {2050: 9}, '40': {2150: 4}, '43': {1650: 9}, '48': {},
    '49': {1850: 3}, '51': {2100: 4, 2050: 1}, '54': {1800: 9}, '59': {1950: 4}, '62': {1700: 9}}
print('etaps', [e['start'] for e in etaps])
assert [e['start'] for e in etaps] == list(NEW), 'etap starts differ'
plan = collections.Counter()
for e in etaps:
    e['new'] = NEW[e['start']]
    for k, v in e['new'].items(): plan[k] += v
sup500 = collections.Counter(d['len'] for d in drums if d['forr'] == '500 kV')
sup220 = collections.Counter(d['len'] for d in drums if d['forr'] == '220 kV')
sent500 = collections.Counter(d['len'] for d in drums if d['forr'] == '500 kV' and 'truck' in d)
lengths = sorted(set(plan) | set(sup500) | set(sup220))
print('plan', sum(plan.values()), 'sup500', sum(sup500.values()), 'sent500', sum(sent500.values()), 'sup220', sum(sup220.values()))
for L in lengths: print(L, plan[L], sup500[L], sent500[L], sup220[L])

# ---- Excel
wb = openpyxl.Workbook()
H = PatternFill('solid', fgColor='1F2937'); HF = Font(bold=True, color='FFFFFF')
thin = Side(style='thin', color='999999'); B = Border(left=thin, right=thin, top=thin, bottom=thin)
g = PatternFill('solid', fgColor='C6EFCE'); y = PatternFill('solid', fgColor='FFEB9C')

def head(ws, row, vals):
    for c, v in enumerate(vals, 1):
        x = ws.cell(row, c, v); x.fill = H; x.font = HF; x.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True); x.border = B

def widths(ws, w):
    for i, x in enumerate(w, 1): ws.column_dimensions[get_column_letter(i)].width = x

s = wb.active; s.title = 'Ozet'
s['A1'] = 'Part-1 (G1-65) iletken bobin kontrolü: plan (Etap listesi) / tedarik (packing list) / sahaya gönderilen (araç listeleri)'
s['A1'].font = Font(bold=True, size=13)
head(s, 3, ['Bobin boyu (m)', 'Plan: sipariş edilecek (Etap listesi)', 'Tedarik: 500 kV packing list', 'Sahaya gönderilen (500 kV)', 'Fark (tedarik − plan)', '220 kV hattına giden', 'Açıklama'])
note = {1700: 'Plan 1700 idi, yerine 1750 üretilmiş (9 adet, 50 m uzun)', 1750: 'Planda yok; 1700 yerine geldi',
        1800: 'Plan 16, tedarik 7: 9 adedin yerine 1850 geldi', 1850: 'Plan 12, tedarik 21: 54-59 etabındaki 9 adet 1800 yerine 1850',
        2050: 'Plan 14, tedarik 15: 1 fazla', 2090: 'Planda yok: 1 adet 2090 m (2100 yerine)', 2100: 'Plan 22, tedarik 21 (+1 adet 2090)',
        2150: 'Packing listede 6 yazıyor: 4 adedi 500 kV, 2 adedi 220 kV Interconnection hattına gitti. 500 kV için 4 = plan ile aynı'}
r = 4
for L in lengths:
    d = sup500[L] - plan[L]
    vals = [L, plan[L], sup500[L], sent500[L], d, sup220[L], note.get(L, 'Plan ile aynı' if d == 0 else '')]
    for c, v in enumerate(vals, 1): s.cell(r, c, v).border = B
    s.cell(r, 5).fill = g if d == 0 else y
    r += 1
tot = ['TOPLAM adet', sum(plan.values()), sum(sup500.values()), sum(sent500.values()), sum(sup500.values()) - sum(plan.values()), sum(sup220.values()), '']
for c, v in enumerate(tot, 1):
    x = s.cell(r, c, v); x.font = Font(bold=True); x.border = B
r += 1
tm = ['TOPLAM metre', sum(k * v for k, v in plan.items()), sum(k * v for k, v in sup500.items()),
      sum(d['len'] for d in drums if d['forr'] == '500 kV' and 'truck' in d), '', sum(k * v for k, v in sup220.items()), '']
for c, v in enumerate(tm, 1):
    x = s.cell(r, c, v); x.font = Font(bold=True); x.border = B; x.number_format = '#,##0'
widths(s, [16, 22, 22, 22, 18, 18, 80]); s.row_dimensions[3].height = 45

e = wb.create_sheet('Etap plani')
head(e, 1, ['Etap (direk)', 'Etap boyu x1.015 (m)', 'Yeni sipariş bobinleri (plan)', 'Etap notu (Etap listesi, sütun L)', 'Kullanım (sütun M)'])
for i, x in enumerate(etaps, 2):
    e.cell(i, 1, f"{x['start']} - {x['end']}"); e.cell(i, 2, round(x['sec']) if x['sec'] else '')
    e.cell(i, 3, ', '.join(f'{v} × {k} m' for k, v in x['new'].items()) or '(artan bobinlerden)')
    e.cell(i, 4, re.sub(r'\s+', ' ', x['L'])); e.cell(i, 5, re.sub(r'\s+', ' ', x['M']))
    for c in range(1, 6):
        e.cell(i, c).alignment = Alignment(wrap_text=True, vertical='top'); e.cell(i, c).border = B
widths(e, [14, 14, 30, 60, 90])

b = wb.create_sheet('Bobin bobin')
head(b, 1, ['No', 'Bobin ID', 'Boy (m)', 'Net kg', 'Hat', 'Araç no', 'Yükleme tarihi', 'Plaka'])
for i, d in enumerate(drums, 2):
    vals = [d['no'], d['id'], d['len'], d['net'], d['forr'], d.get('truck', 'GİTMEDİ'), d.get('date', ''), d.get('plate', '')]
    for c, v in enumerate(vals, 1):
        x = b.cell(i, c, v); x.border = B
        if d['forr'] == '220 kV': x.fill = y
widths(b, [6, 14, 10, 9, 9, 9, 14, 22]); b.freeze_panes = 'A2'
wb.save('Part1_Bobin_Kontrol_2026-10-30.xlsx')
json.dump(dict(etaps=etaps, drums=drums), open('kontrol.json', 'w'), default=str, ensure_ascii=False)
