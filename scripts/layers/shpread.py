"""Minimal ESRI shapefile (.shp/.dbf/.prj) reader -> GeoJSON-like features in WGS84. No third-party packages except pyproj."""
import struct, os, datetime
from pyproj import CRS, Transformer

SHAPE_TYPES = {0: 'Null', 1: 'Point', 3: 'PolyLine', 5: 'Polygon', 8: 'MultiPoint', 11: 'PointZ', 13: 'PolyLineZ', 15: 'PolygonZ', 18: 'MultiPointZ', 21: 'PointM', 23: 'PolyLineM', 25: 'PolygonM', 28: 'MultiPointM', 31: 'MultiPatch'}


def read_prj(path):
    p = os.path.splitext(path)[0] + '.prj'
    if not os.path.exists(p):
        return None
    return CRS.from_wkt(open(p, encoding='utf8', errors='ignore').read())


def read_dbf(path):
    p = os.path.splitext(path)[0] + '.dbf'
    if not os.path.exists(p):
        return [], []
    f = open(p, 'rb').read()
    nrec, hlen, rlen = struct.unpack('<xxxxIHH', f[:12])
    fields = []
    pos = 32
    while f[pos] != 0x0D:
        name = f[pos:pos + 11].split(b'\x00')[0].decode('latin-1')
        ftype = chr(f[pos + 11])
        flen = f[pos + 16]
        fdec = f[pos + 17]
        fields.append((name, ftype, flen, fdec))
        pos += 32
    # code page: look for .cpg
    enc = 'utf-8'
    cpg = os.path.splitext(path)[0] + '.cpg'
    if os.path.exists(cpg):
        c = open(cpg).read().strip().lower()
        enc = {'utf-8': 'utf-8', 'utf8': 'utf-8', '1252': 'cp1252', 'cp1252': 'cp1252'}.get(c, 'utf-8')
    rows = []
    for i in range(nrec):
        rec = f[hlen + i * rlen: hlen + (i + 1) * rlen]
        if not rec or rec[0] == 0x2A:  # deleted
            rows.append(None)
            continue
        off = 1
        row = {}
        for name, ftype, flen, fdec in fields:
            raw = rec[off:off + flen]
            off += flen
            s = raw.decode(enc, errors='ignore').strip()
            if s == '':
                v = None
            elif ftype in 'NF':
                try:
                    v = float(s)
                    if fdec == 0 and v == int(v):
                        v = int(v)
                except ValueError:
                    v = None
            elif ftype == 'D':
                v = s
            elif ftype == 'L':
                v = s.upper() in 'YT'
            else:
                v = s
            row[name] = v
        rows.append(row)
    return [x[0] for x in fields], rows


def read_shp(path):
    """Returns (shape_type_name, [geometry dict in file CRS or None]). Z/M values are dropped."""
    f = open(path, 'rb').read()
    stype = struct.unpack('<i', f[32:36])[0]
    bbox = struct.unpack('<4d', f[36:68])
    pos = 100
    geoms = []
    while pos + 8 <= len(f):
        _, clen = struct.unpack('>ii', f[pos:pos + 8])
        content = f[pos + 8: pos + 8 + clen * 2]
        pos += 8 + clen * 2
        t = struct.unpack('<i', content[:4])[0]
        if t == 0:
            geoms.append(None)
            continue
        base = t % 10 if t in (11, 13, 15, 18, 21, 23, 25, 28) else t
        base = {11: 1, 13: 3, 15: 5, 18: 8, 21: 1, 23: 3, 25: 5, 28: 8}.get(t, t)
        if base == 1:
            x, y = struct.unpack('<2d', content[4:20])
            geoms.append({'type': 'Point', 'coordinates': [x, y]})
        elif base == 8:
            n = struct.unpack('<i', content[36:40])[0]
            pts = [list(struct.unpack('<2d', content[40 + 16 * i: 56 + 16 * i])) for i in range(n)]
            geoms.append({'type': 'MultiPoint', 'coordinates': pts})
        elif base in (3, 5):
            nparts, npts = struct.unpack('<2i', content[36:44])
            parts = list(struct.unpack('<%di' % nparts, content[44:44 + 4 * nparts])) + [npts]
            pstart = 44 + 4 * nparts
            pts = [list(struct.unpack('<2d', content[pstart + 16 * i: pstart + 16 * i + 16])) for i in range(npts)]
            rings = [pts[parts[i]:parts[i + 1]] for i in range(nparts)]
            geoms.append({'type': 'PolyLine' if base == 3 else 'Polygon', 'rings': rings})
        else:
            geoms.append(None)
    return SHAPE_TYPES.get(stype, str(stype)), bbox, geoms


def ring_area(r):
    a = 0
    for i in range(len(r) - 1):
        a += r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1]
    return a / 2


def to_geojson(geom, tr, nd=6):
    def conv(pt):
        x, y = tr.transform(pt[0], pt[1])
        return [round(x, nd), round(y, nd)]
    if geom is None:
        return None
    t = geom['type']
    if t == 'Point':
        return {'type': 'Point', 'coordinates': conv(geom['coordinates'])}
    if t == 'MultiPoint':
        return {'type': 'MultiPoint', 'coordinates': [conv(p) for p in geom['coordinates']]}
    if t == 'PolyLine':
        lines = [[conv(p) for p in r] for r in geom['rings'] if len(r) >= 2]
        if len(lines) == 1:
            return {'type': 'LineString', 'coordinates': lines[0]}
        return {'type': 'MultiLineString', 'coordinates': lines}
    if t == 'Polygon':
        # shapefile: clockwise = outer ring, counter-clockwise = hole. Group holes under the preceding outer ring.
        polys = []
        for r in geom['rings']:
            if len(r) < 4:
                continue
            outer = ring_area(r) < 0  # clockwise (negative signed area in a y-up plane)
            cr = [conv(p) for p in r]
            if outer or not polys:
                polys.append([cr])
            else:
                polys[-1].append(cr)
        if len(polys) == 1:
            return {'type': 'Polygon', 'coordinates': polys[0]}
        return {'type': 'MultiPolygon', 'coordinates': polys}
    return None


def load(path, nd=6):
    crs = read_prj(path)
    st, bbox, geoms = read_shp(path)
    names, rows = read_dbf(path)
    tr = Transformer.from_crs(crs, 'EPSG:4326', always_xy=True) if crs else None
    feats = []
    for g, row in zip(geoms, rows):
        if g is None or row is None:
            continue
        gj = to_geojson(g, tr, nd) if tr else None
        if gj is None:
            continue
        feats.append({'type': 'Feature', 'properties': row, 'geometry': gj})
    return {'shape_type': st, 'crs': crs.name if crs else None, 'epsg': (crs.to_epsg() if crs else None), 'fields': names, 'bbox': bbox, 'features': feats}
