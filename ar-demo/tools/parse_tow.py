"""Parse PLS-TOWER .tow files into compact JSON for the AR demo.

A .tow has primary joints + secondary joints (explicit x,y,z, symmetry code 0-3),
angle members (joint labels + symmetry code) and insulator attach points.
Symmetry: 13 (members only) = 4-fold rotation about z; 1 = mirror y (copy 'X'), 2 = mirror x (copy 'Y'), 3 = all four (P, X, Y, XY).
Labels: primary -> '<n>P', secondary -> '<n>S', mirrored copies replace the suffix by X / Y / XY.
Coordinates: metres, z = 0 at the tower top and negative downwards.
Insulator lengths come from basic.inl next to the .tow files.
Output (mm integers): segments [ax,ay,az,bx,by,bz,leg?], insulators, dims, zmin, project.

Usage: python parse_tow.py <out.json>     (edit PROJECTS below to add tower families)
"""
import json, re, sys, os, math

PROJECTS = [
    {'project': 'Erbil 132 kV', 'prefix': '',
     'src': r'D:\IS\zozik\Zozik\Erbil\East_Erbil-South_Erbil\October-2010\PLS',
     'files': ['dcb-2t+0', 'dcb-2t+3', 'dcc-2t+0', 'dcd-2t+0', 'dcs-2t', 'dca-2t+0', 'dca-2t+3', 'dca-2t+6']},
    {'project': 'Bestana 33 kV', 'prefix': 'bk_', 'labelFromFile': True,
     'src': r'D:\IS\ET25\ET-25 PLAN\DESIGN\LINE ROUTE\Bestana Line Route\Profile\13112012_Aree_revision\Bestana-Kushtapa_Profile Survey_Rev. 1\pls',
     'files': ['2s+0', '2s+3', '2s+6', '2t1+0', '2t1+3', '2t1+6', '2t2+0', '2t2+6', '2tt+0', '2tt+3', '2tt+6']},
]

VARIANTS = {0: [('', 1, 1)], 1: [('', 1, 1), ('X', 1, -1)], 2: [('', 1, 1), ('Y', -1, 1)],
            3: [('', 1, 1), ('X', 1, -1), ('Y', -1, 1), ('XY', -1, -1)]}


def load_insulator_lengths(path):
    """basic.inl: strain rows are  'label' 'stock' tension length ...; suspension rows likewise (length is the 4th column)."""
    out = {}
    for ln in open(path, encoding='latin-1'):
        m = re.match(r"^'([^']*)'\s+'[^']*'\s+([\d.]+)\s+([\d.]+)", ln)
        if m: out[m.group(1)] = float(m.group(3))
    return out


def parse(path, lens):
    L = [l.rstrip('\r\n') for l in open(path, encoding='latin-1')]
    title, desc = L[2].strip(), L[3].strip()

    def find(pat, start=0):
        for i in range(start, len(L)):
            if re.match(pat, L[i]): return i
        raise ValueError(pat)

    pts = {}                     # label -> (x,y,z)

    def read_joints(i0, suffix):
        n = int(L[i0].split(';')[0]); i = i0 + 1
        for _ in range(n):
            lab = L[i].strip().strip("'"); x, y, z = map(float, L[i + 2].split()[:3]); sym = int(L[i + 3].split()[1])
            if sym not in VARIANTS: raise ValueError(f'unknown joint symmetry code {sym} at {lab} in {path}')
            for v, sx, sy in VARIANTS[sym]:
                pts[lab + (suffix if v == '' else v)] = (x * sx, y * sy, z)
            i += 5
        return i

    ij = find(r'^\d+ ; Joints Geometry'); read_joints(ij, 'P')
    isj = find(r'^\d+ ; Secondary Joints'); read_joints(isj, 'S')
    im = find(r'^\d+ ; Angle Member Connectivity'); nm = int(L[im].split(';')[0]); i = im + 1
    segs, seen, missing, odd = [], set(), 0, set()
    for _ in range(nm):
        a, b = L[i + 1].strip(), L[i + 2].strip(); sym = int(L[i + 5].split()[0]); i += 8
        if a not in pts or b not in pts: missing += 1; continue
        (ax, ay, az), (bx, by, bz) = pts[a], pts[b]
        if sym == 13:   # 4-fold rotational symmetry about z (top-mast rings / diagonals)
            tf = [lambda x, y: (x, y), lambda x, y: (-y, x), lambda x, y: (-x, -y), lambda x, y: (y, -x)]
        elif sym in VARIANTS:
            tf = [(lambda sx, sy: (lambda x, y: (x * sx, y * sy)))(sx, sy) for _, sx, sy in VARIANTS[sym]]
        else:
            odd.add(sym); tf = [lambda x, y: (x, y)]
        for f in tf:
            p, q = (*f(ax, ay), az), (*f(bx, by), bz)
            key = tuple(sorted([tuple(round(c * 1000) for c in p), tuple(round(c * 1000) for c in q)]))
            if key in seen or p == q: continue
            seen.add(key)
            ln = math.dist(p, q); leg = 1 if abs(q[2] - p[2]) / ln > 0.8 else 0
            segs.append([round(c * 1000) for c in (*p, *q)] + [leg])
    ins = []

    def read_ins(header, kind):
        try: k = find(r'^\d+ ; ' + header)
        except ValueError: return
        n = int(L[k].split(';')[0]); j = k + 1
        for _ in range(n):
            q = re.findall(r"'([^']*)'", L[j]); att = q[1]; prop = q[3] if len(q) > 3 else ''
            az = float(L[j + 1].split()[0]) if kind == 'strain' else 0.0; j += 2
            if prop not in lens: print('  ! no length for insulator property', repr(prop), 'in', os.path.basename(path))
            if att in pts: ins.append({'k': kind, 'p': [round(c * 1000) for c in pts[att]], 'az': round(az, 4), 'len': round(lens.get(prop, 2.0) * 1000)})

    read_ins('Suspension Insulator Connectivity', 'susp'); read_ins('Strain Insulator Connectivity', 'strain')
    xs = [p[0] for p in pts.values()]; ys = [p[1] for p in pts.values()]; zs = [p[2] for p in pts.values()]
    dims = {'w': round(2 * max(abs(v) for v in xs), 2), 'd': round(2 * max(abs(v) for v in ys), 2), 'h': round(max(zs) - min(zs), 2)}
    return {'title': title, 'desc': desc, 'segs': segs, 'ins': ins, 'dims': dims, 'zmin': round(min(zs) * 1000), 'missing': missing, 'members': nm, 'oddSym': sorted(odd)}


if __name__ == '__main__':
    OUT = sys.argv[1]
    out = {}
    for pr in PROJECTS:
        lens = load_insulator_lengths(os.path.join(pr['src'], 'basic.inl'))
        for f in pr['files']:
            t = parse(os.path.join(pr['src'], f + '.tow'), lens); key = pr['prefix'] + f.replace('+', 'p').replace('-', '_')
            t['project'] = pr['project']; t['label'] = f.upper() if pr.get('labelFromFile') else t['title'].split(',')[0].strip(); out[key] = t
            print(f"{pr['project'][:8]:8s} {f:10s} {t['title'][:34]:34s} dims={t['dims']} members={t['members']} segs={len(t['segs'])} ins={len(t['ins'])} unresolved={t['missing']} oddSym={t['oddSym']}")
    json.dump(out, open(OUT, 'w'), separators=(',', ':'))
    print('wrote', OUT, os.path.getsize(OUT), 'bytes,', len(out), 'towers')
