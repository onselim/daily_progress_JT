"""Builds the map layers of a project from its shapefile / KMZ folders.

    python -I scripts/layers/build_layers.py [source_dir] [slug]

Reads  <source_dir>/Part-N SHP Files/<Group>/*.shp (+ the combined KMZ of each Part),
writes app/public/layers/<slug>/manifest.json and one lean GeoJSON (WGS84, 6 decimals) per layer.
The map panel shows them as Part > Group > Layer with on/off switches (see ProjectLayersTree).
Needs only Python 3 and pyproj (for the .prj coordinate systems).
"""
import glob
import hashlib
import json
import os
import re
import sys
import zipfile
import xml.etree.ElementTree as ET

sys.path.insert(0, os.path.dirname(__file__))
import shpread  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '..', '..'))
DEFAULT_SRC = os.path.join(REPO, 'Jvari_Shape_Files', 'Part 1-2-3')
SLUG = sys.argv[2] if len(sys.argv) > 2 else 'jvari-tskaltubo'
SRC = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_SRC
OUT = os.path.join(REPO, 'app', 'public', 'layers', SLUG)

# Folder names exactly as in the source; this is also the order in the panel.
GROUP_ORDER = ['Access Roads Arrangement Plan', 'Buffer', 'Center Line', 'Combined KMZ Files', 'Leg Extensions', 'Tower Area', 'Tower Centers', 'Tree Cutting', 'Working Area']

# Layer look per file role (Leaflet path options + point radius). Combined KMZ keeps the colours stored in the KMZ itself.
STYLES = {
    'Access Roads': dict(color='#f97316', weight=1.5, fillColor='#f97316', fillOpacity=0.35),
    'Existing Roads': dict(color='#38bdf8', weight=1.5, fillColor='#38bdf8', fillOpacity=0.35),
    'Modification Roads': dict(color='#ef4444', weight=1.5, fillColor='#ef4444', fillOpacity=0.35),
    'Centerline Roads': dict(color='#fde047', weight=3),
    'Buffer': dict(color='#ffffff', weight=1.5, dashArray='6 4', opacity=0.9),
    'Center Line': dict(color='#facc15', weight=3),
    'Combined KMZ': dict(color='#94a3b8', weight=2, fillColor='#94a3b8', fillOpacity=0.2),
    'Leg Extensions': dict(color='#ffffff', weight=1, fillColor='#a3e635', fillOpacity=0.95, radius=4),
    'Tower Area': dict(color='#22d3ee', weight=1.5, fillColor='#22d3ee', fillOpacity=0.25),
    'Tower Centers': dict(color='#ffffff', weight=1.5, fillColor='#f43f5e', fillOpacity=1, radius=5),
    'Tree Cutting': dict(color='#22c55e', weight=2.5, fillColor='#22c55e', fillOpacity=0.3),
    'Working Area': dict(color='#d946ef', weight=1.5, fillColor='#d946ef', fillOpacity=0.2),
}

KEEP_PROPS = ('Name', 'ALAN_ADI', 'ALAN', 'UZUNLUK')


def layer_name(group, filename):
    """'Part-1_Existing_Roads.shp' -> 'Existing Roads'; single-file groups simply use the group's name."""
    base = re.sub(r'^Part-\d+_', '', os.path.splitext(filename)[0])
    base = re.sub(r'_Rv\d+$', '', base)
    mapping = {'Access_Roads': 'Access Roads', 'Existing_Roads': 'Existing Roads', 'Modification_Roads': 'Modification Roads', 'Centerline_Roads': 'Centerline Roads',
               'Buffer': 'Buffer', 'CenterLine': 'Center Line', 'Tower_Area': 'Tower Area', 'TowerCenter': 'Tower Centers', 'TreeCutting_Area': 'Tree Cutting',
               'Working_Area': 'Working Area', 'LegExtentions': 'Leg Extensions', 'Combined': 'Combined KMZ'}
    return mapping.get(base, base.replace('_', ' '))


def clean_feature(f):
    """Keeps only what is useful in a tooltip; builds `label` / `info`."""
    p = f['properties'] or {}
    label = p.get('Name') or p.get('ALAN_ADI')
    info = []
    if isinstance(p.get('descriptio'), str):
        t = re.sub(r'<[^>]+>', ' ', p['descriptio'])
        t = re.sub(r'\s+', ' ', t).strip()
        if t:
            info.append(t[:160])
    if p.get('UZUNLUK'):
        info.append('Length: %.0f m' % p['UZUNLUK'])
    if p.get('ALAN'):
        info.append('Area: %.0f m2' % p['ALAN'])
    props = {}
    if label not in (None, '', 'X'):
        props['label'] = str(label)
    if info:
        props['info'] = ' | '.join(info)
    return {'type': 'Feature', 'properties': props, 'geometry': f['geometry']}


def valid_point(c):
    return -180 <= c[0] <= 180 and 1 <= c[1] <= 89  # drops (0,0)-style junk coordinates


def geom_ok(g):
    if g['type'] == 'Point':
        return valid_point(g['coordinates'])
    return True


def write_geojson(path, feats):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf8') as fh:
        json.dump({'type': 'FeatureCollection', 'features': feats}, fh, ensure_ascii=False, separators=(',', ':'))
    return os.path.getsize(path)


# ------------------------------------------------------------------ KML / KMZ (the combined files)
NS = {'k': 'http://www.opengis.net/kml/2.2'}


def kml_color(c):
    """KML aabbggrr -> ('#rrggbb', opacity)."""
    c = (c or '').strip()
    if len(c) != 8:
        return None, None
    a, b, g, r = c[0:2], c[2:4], c[4:6], c[6:8]
    return '#' + r + g + b, round(int(a, 16) / 255, 2)


def parse_coords(text, nd=6):
    pts = []
    for tok in (text or '').split():
        parts = tok.split(',')
        if len(parts) >= 2:
            try:
                pts.append([round(float(parts[0]), nd), round(float(parts[1]), nd)])
            except ValueError:
                pass
    return pts


def kml_geometries(pm):
    out = []
    for el in pm.iter():
        tag = el.tag.split('}')[-1]
        if tag == 'Point':
            c = parse_coords(el.findtext('k:coordinates', default='', namespaces=NS))
            if c and valid_point(c[0]):
                out.append({'type': 'Point', 'coordinates': c[0]})
        elif tag == 'LineString':
            c = parse_coords(el.findtext('k:coordinates', default='', namespaces=NS))
            if len(c) >= 2:
                out.append({'type': 'LineString', 'coordinates': c})
        elif tag == 'Polygon':
            rings = []
            outer = el.find('k:outerBoundaryIs/k:LinearRing/k:coordinates', NS)
            if outer is not None:
                rings.append(parse_coords(outer.text))
            for inner in el.findall('k:innerBoundaryIs/k:LinearRing/k:coordinates', NS):
                rings.append(parse_coords(inner.text))
            rings = [r for r in rings if len(r) >= 4]
            if rings:
                out.append({'type': 'Polygon', 'coordinates': rings})
    return out


def kmz_to_features(path):
    z = zipfile.ZipFile(path)
    kml = [n for n in z.namelist() if n.lower().endswith('.kml')][0]
    root = ET.fromstring(z.read(kml))
    styles = {}
    for st in root.iter('{%s}Style' % NS['k']):
        sid = st.get('id')
        if not sid:
            continue
        ls = st.find('k:LineStyle', NS)
        ps = st.find('k:PolyStyle', NS)
        d = {}
        if ls is not None:
            col, op = kml_color(ls.findtext('k:color', default='', namespaces=NS))
            if col:
                d['_stroke'] = col
            w = ls.findtext('k:width', default='', namespaces=NS)
            if w:
                try:
                    d['_w'] = min(float(w), 4)
                except ValueError:
                    pass
        if ps is not None:
            col, op = kml_color(ps.findtext('k:color', default='', namespaces=NS))
            if col:
                d['_fill'] = col
                d['_fo'] = op
            if ps.findtext('k:fill', default='1', namespaces=NS) == '0':
                d['_fo'] = 0
        styles['#' + sid] = d
    for sm in root.iter('{%s}StyleMap' % NS['k']):
        sid = sm.get('id')
        for pair in sm.findall('k:Pair', NS):
            if pair.findtext('k:key', default='', namespaces=NS) == 'normal':
                ref = pair.findtext('k:styleUrl', default='', namespaces=NS)
                styles['#' + sid] = styles.get(ref, {})
    feats = []

    def walk(el, folder):
        for child in el:
            tag = child.tag.split('}')[-1]
            if tag in ('Folder', 'Document'):
                name = child.findtext('k:name', default='', namespaces=NS)
                walk(child, name if tag == 'Folder' else folder)
            elif tag == 'Placemark':
                geoms = kml_geometries(child)
                if not geoms:
                    continue
                name = child.findtext('k:name', default='', namespaces=NS)
                desc = child.findtext('k:description', default='', namespaces=NS)
                st = styles.get(child.findtext('k:styleUrl', default='', namespaces=NS), {})
                props = {k: v for k, v in st.items() if v is not None}
                if name:
                    props['label'] = name
                text = re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', desc)).strip()
                info = ' | '.join([x for x in (folder, text[:120]) if x])
                if info:
                    props['info'] = info
                for g in geoms:
                    feats.append({'type': 'Feature', 'properties': props, 'geometry': g})

    walk(root, '')
    return feats


# ------------------------------------------------------------------ main
def main():
    parts = []
    report = []
    for part_dir in sorted(glob.glob(os.path.join(SRC, 'Part-* SHP Files'))):
        pname = re.match(r'(Part-\d+)', os.path.basename(part_dir)).group(1)
        pid = pname.lower()
        groups = {}
        seen_hashes = set()
        for gdir in sorted(glob.glob(os.path.join(part_dir, '*'))):
            if not os.path.isdir(gdir):
                continue
            gname = os.path.basename(gdir)
            layers = []
            for shp in sorted(glob.glob(os.path.join(gdir, '*.shp'))):
                digest = hashlib.md5(open(shp, 'rb').read() + open(os.path.splitext(shp)[0] + '.dbf', 'rb').read()).hexdigest()
                if digest in seen_hashes:
                    report.append('skipped duplicate: %s' % os.path.relpath(shp, SRC))
                    continue
                seen_hashes.add(digest)
                lname = layer_name(gname, os.path.basename(shp))
                d = shpread.load(shp)
                feats = [clean_feature(f) for f in d['features'] if geom_ok(f['geometry'])]
                dropped = len(d['features']) - len(feats)
                if dropped:
                    report.append('dropped %d bad feature(s) in %s' % (dropped, os.path.relpath(shp, SRC)))
                if not feats:
                    continue
                lid = '%s/%s/%s' % (pid, re.sub(r'[^a-z0-9]+', '-', gname.lower()).strip('-'), re.sub(r'[^a-z0-9]+', '-', lname.lower()).strip('-'))
                size = write_geojson(os.path.join(OUT, lid + '.geojson'), feats)
                layers.append({'id': 'static:%s/%s' % (SLUG, lid), 'name': lname, 'file': lid + '.geojson', 'style': STYLES.get(lname, STYLES['Combined KMZ']), 'count': len(feats), 'kb': round(size / 1024)})
            if gname == 'Combined KMZ Files':
                for kmz in sorted(glob.glob(os.path.join(gdir, '*.kmz'))):
                    feats = kmz_to_features(kmz)
                    lid = '%s/combined-kmz-files/combined-kmz' % pid
                    size = write_geojson(os.path.join(OUT, lid + '.geojson'), feats)
                    layers.append({'id': 'static:%s/%s' % (SLUG, lid), 'name': 'Combined KMZ', 'file': lid + '.geojson', 'style': STYLES['Combined KMZ'], 'count': len(feats), 'kb': round(size / 1024), 'ownColors': True})
            if layers:
                groups[gname] = layers
        ordered = [{'id': re.sub(r'[^a-z0-9]+', '-', g.lower()).strip('-'), 'name': g, 'layers': groups[g]} for g in GROUP_ORDER if g in groups]
        ordered += [{'id': re.sub(r'[^a-z0-9]+', '-', g.lower()).strip('-'), 'name': g, 'layers': ls} for g, ls in groups.items() if g not in GROUP_ORDER]
        parts.append({'id': pid, 'name': pname, 'groups': ordered})
    os.makedirs(OUT, exist_ok=True)
    json.dump({'version': 1, 'slug': SLUG, 'parts': parts}, open(os.path.join(OUT, 'manifest.json'), 'w', encoding='utf8'), ensure_ascii=False, indent=1)
    total = sum(l['kb'] for p in parts for g in p['groups'] for l in g['layers'])
    for p in parts:
        for g in p['groups']:
            print(p['name'], '|', g['name'], '|', ', '.join('%s (%d, %d KB)' % (l['name'], l['count'], l['kb']) for l in g['layers']))
    print('total', total, 'KB')
    for r in report:
        print(r)


if __name__ == '__main__':
    main()
