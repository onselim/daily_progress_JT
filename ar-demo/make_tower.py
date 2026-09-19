"""Generate a simple lattice transmission tower as a GLB (glTF binary).

Built in real metres, then scaled by SCALE so it fits on a table in AR.
Run: python make_tower.py   ->  site/tower.glb
"""
import json, math, struct, os

SCALE = 0.02  # 50 m tower -> ~1 m on the table

def sub(a, b): return [a[i] - b[i] for i in range(3)]
def add(a, b): return [a[i] + b[i] for i in range(3)]
def mul(a, s): return [x * s for x in a]
def dot(a, b): return sum(a[i] * b[i] for i in range(3))
def cross(a, b): return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]]
def norm(a):
    l = math.sqrt(dot(a, a)) or 1.0
    return [x / l for x in a]

class Mesh:
    def __init__(self):
        self.pos, self.nrm, self.idx = [], [], []

    def beam(self, p0, p1, t):
        d = norm(sub(p1, p0))
        ref = [0, 1, 0] if abs(d[1]) < 0.9 else [1, 0, 0]
        u = norm(cross(d, ref)); v = norm(cross(d, u))
        c = {}
        for e, p in enumerate((p0, p1)):
            for su in (-1, 1):
                for sv in (-1, 1):
                    c[(e, su, sv)] = add(p, add(mul(u, su * t), mul(v, sv * t)))
        centre = mul(add(p0, p1), 0.5)
        faces = [
            [(0,-1,-1),(0,1,-1),(0,1,1),(0,-1,1)],
            [(1,-1,-1),(1,1,-1),(1,1,1),(1,-1,1)],
            [(0,-1,-1),(1,-1,-1),(1,1,-1),(0,1,-1)],
            [(0,-1,1),(1,-1,1),(1,1,1),(0,1,1)],
            [(0,-1,-1),(1,-1,-1),(1,-1,1),(0,-1,1)],
            [(0,1,-1),(1,1,-1),(1,1,1),(0,1,1)],
        ]
        for f in faces:
            q = [c[k] for k in f]
            n = norm(cross(sub(q[1], q[0]), sub(q[3], q[0])))
            fc = mul(add(add(q[0], q[1]), add(q[2], q[3])), 0.25)
            if dot(n, sub(fc, centre)) < 0:
                n = mul(n, -1); q = q[::-1]
            base = len(self.pos)
            for p in q:
                self.pos.append(mul(p, SCALE)); self.nrm.append(n)
            self.idx += [base, base+1, base+2, base, base+2, base+3]

steel, ceramic, wire = Mesh(), Mesh(), Mesh()

# Body: 4 legs, tapering from 4 m half-width at ground to 1 m at 40 m
levels = [0, 8, 16, 24, 32, 40]
hw = lambda h: 4.0 - 3.0 * h / 40.0
corners = lambda h: [(-hw(h), h, -hw(h)), (hw(h), h, -hw(h)), (hw(h), h, hw(h)), (-hw(h), h, hw(h))]
for a, b in zip(levels, levels[1:]):
    ca, cb = corners(a), corners(b)
    for i in range(4):
        steel.beam(ca[i], cb[i], 0.22)                      # legs
        j = (i + 1) % 4
        steel.beam(ca[i], cb[j], 0.09)                      # face diagonals (X bracing)
        steel.beam(ca[j], cb[i], 0.09)
for h in levels:
    c = corners(h)
    for i in range(4):
        steel.beam(c[i], c[(i + 1) % 4], 0.12)              # horizontal rings

# Peak (earth wire) and cross-arms
steel.beam((0, 40, 0), (0, 47, 0), 0.18)
for s in (-1, 1):
    steel.beam((0, 44, 0), (s * 5.0, 44, 0), 0.14)          # earth-wire arm
    steel.beam((0, 46.5, 0), (s * 5.0, 44, 0), 0.07)
    wire.beam((s * 5.0, 44, -6), (s * 5.0, 44, 6), 0.05)    # earth wire / OPGW
for h, length in ((28, 8.0), (34, 9.5), (40, 7.0)):         # double-circuit style arms
    for s in (-1, 1):
        tip = s * length
        steel.beam((s * hw(h), h, 0), (tip, h, 0), 0.16)
        steel.beam((s * hw(h), h - 3.5, 0), (tip, h, 0), 0.07)
        ceramic.beam((tip, h, 0), (tip, h - 4.0, 0), 0.12)  # insulator string
        wire.beam((tip, h - 4.0, -6), (tip, h - 4.0, 6), 0.06)  # conductor

def mat(name, rgb, metal, rough):
    return {"name": name, "pbrMetallicRoughness": {"baseColorFactor": rgb + [1.0],
            "metallicFactor": metal, "roughnessFactor": rough}}

meshes = [(steel, 0), (ceramic, 1), (wire, 2)]
blob = bytearray(); views, accs, prims = [], [], []
for m, mi in meshes:
    pb = b"".join(struct.pack("<3f", *p) for p in m.pos)
    nb = b"".join(struct.pack("<3f", *n) for n in m.nrm)
    ib = b"".join(struct.pack("<I", i) for i in m.idx)
    base = len(accs)
    for data, target in ((pb, 34962), (nb, 34962), (ib, 34963)):
        views.append({"buffer": 0, "byteOffset": len(blob), "byteLength": len(data), "target": target})
        blob += data
    v = len(views) - 3
    xs = [[p[k] for p in m.pos] for k in range(3)]
    accs += [
        {"bufferView": v, "componentType": 5126, "count": len(m.pos), "type": "VEC3",
         "min": [min(a) for a in xs], "max": [max(a) for a in xs]},
        {"bufferView": v + 1, "componentType": 5126, "count": len(m.nrm), "type": "VEC3"},
        {"bufferView": v + 2, "componentType": 5125, "count": len(m.idx), "type": "SCALAR"},
    ]
    prims.append({"attributes": {"POSITION": base, "NORMAL": base + 1}, "indices": base + 2, "material": mi})

gltf = {
    "asset": {"version": "2.0", "generator": "make_tower.py"},
    "scene": 0, "scenes": [{"nodes": [0]}], "nodes": [{"mesh": 0, "name": "OHTL tower"}],
    "meshes": [{"primitives": prims}],
    "materials": [mat("steel", [0.62, 0.65, 0.68], 0.85, 0.45),
                  mat("insulator", [0.55, 0.36, 0.22], 0.0, 0.6),
                  mat("conductor", [0.08, 0.08, 0.09], 0.3, 0.5)],
    "accessors": accs, "bufferViews": views, "buffers": [{"byteLength": len(blob)}],
}
js = json.dumps(gltf, separators=(",", ":")).encode()
js += b" " * (-len(js) % 4); blob += b"\0" * (-len(blob) % 4)
out = struct.pack("<III", 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(blob))
out += struct.pack("<II", len(js), 0x4E4F534A) + js + struct.pack("<II", len(blob), 0x004E4942) + bytes(blob)
path = os.path.join(os.path.dirname(__file__), "site", "tower.glb")
open(path, "wb").write(out)
print(path, len(out), "bytes;", sum(len(m.idx) // 3 for m, _ in meshes), "triangles")
