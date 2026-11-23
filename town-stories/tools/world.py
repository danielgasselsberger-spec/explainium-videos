"""Blocky toy-town world builder (Blender 4.5, bpy module).
Reusable for all episodes: materials, boxes, characters, town, props, lights.
Front of every character = -Y (camera at negative Y looks at the face).
"""
import bpy, math, random
from mathutils import Vector

FONT = '/usr/share/fonts/opentype/inter/Inter-ExtraBold.otf'
_mats = {}


def hexcol(h):
    h = h.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    # sRGB -> linear
    return tuple(((x + 0.055) / 1.055) ** 2.4 if x > 0.04045 else x / 12.92 for x in c) + (1,)


def mat(color, emit=0.0, rough=0.55, name=None, metal=0.0, alpha=1.0):
    key = (color, emit, rough, metal, alpha)
    if key in _mats:
        return _mats[key]
    m = bpy.data.materials.new(name or f'm_{color}_{emit}')
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    c = hexcol(color) if isinstance(color, str) else color
    b.inputs['Base Color'].default_value = c
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    if emit:
        b.inputs['Emission Color'].default_value = c
        b.inputs['Emission Strength'].default_value = emit
    if alpha < 1:
        b.inputs['Alpha'].default_value = alpha
    _mats[key] = m
    return m


def coll(name):
    c = bpy.data.collections.get(name)
    if not c:
        c = bpy.data.collections.new(name)
        bpy.context.scene.collection.children.link(c)
    return c


CUR = {'coll': None}


def link(o):
    (CUR['coll'] or bpy.context.scene.collection).objects.link(o)
    return o


def box(name, size, loc=(0, 0, 0), m=None, parent=None, bevel=0.035, rot=(0, 0, 0)):
    sx, sy, sz = [s / 2 for s in size]
    v = [(x, y, z) for x in (-sx, sx) for y in (-sy, sy) for z in (-sz, sz)]
    f = [(0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)]
    me = bpy.data.meshes.new(name)
    me.from_pydata(v, [], f)
    me.update()
    o = link(bpy.data.objects.new(name, me))
    if bevel and min(size) > bevel * 2.2:
        md = o.modifiers.new('bv', 'BEVEL')
        md.width = bevel
        md.segments = 2
        md.limit_method = 'NONE'
    if m:
        me.materials.append(m)
    if parent:
        o.parent = parent
    o.location = loc
    o.rotation_euler = rot
    for p in me.polygons:
        p.use_smooth = False
    return o


def cyl(name, r, h, loc=(0, 0, 0), m=None, parent=None, verts=24, rot=(0, 0, 0)):
    me = bpy.data.meshes.new(name)
    v, f = [], []
    for i in range(verts):
        a = 2 * math.pi * i / verts
        v += [(r * math.cos(a), r * math.sin(a), -h / 2), (r * math.cos(a), r * math.sin(a), h / 2)]
    for i in range(verts):
        j = (i + 1) % verts
        f.append((2 * i, 2 * j, 2 * j + 1, 2 * i + 1))
    f.append(tuple(2 * i for i in range(verts))[::-1])
    f.append(tuple(2 * i + 1 for i in range(verts)))
    me.from_pydata(v, [], f)
    me.update()
    o = link(bpy.data.objects.new(name, me))
    if m:
        me.materials.append(m)
    if parent:
        o.parent = parent
    o.location = loc
    o.rotation_euler = rot
    return o


def sphere(name, r, loc, m, parent=None, seg=16):
    me = bpy.data.meshes.new(name)
    import bmesh
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=seg // 2, radius=r)
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = True
    o = link(bpy.data.objects.new(name, me))
    me.materials.append(m)
    if parent:
        o.parent = parent
    o.location = loc
    return o


def prism(name, w, d, h, loc, m, parent=None):
    """Gable roof: ridge along X."""
    v = [(-w / 2, -d / 2, 0), (w / 2, -d / 2, 0), (w / 2, d / 2, 0), (-w / 2, d / 2, 0), (-w / 2, 0, h), (w / 2, 0, h)]
    f = [(0, 1, 2, 3), (0, 4, 5, 1), (3, 2, 5, 4), (0, 3, 4), (1, 5, 2)]
    me = bpy.data.meshes.new(name)
    me.from_pydata(v, [], f)
    me.update()
    o = link(bpy.data.objects.new(name, me))
    me.materials.append(m)
    if parent:
        o.parent = parent
    o.location = loc
    return o


def empty(name, loc=(0, 0, 0), parent=None):
    o = link(bpy.data.objects.new(name, None))
    o.empty_display_size = 0.2
    if parent:
        o.parent = parent
    o.location = loc
    return o


def text(name, body, loc, size, m, parent=None, rot=(math.pi / 2, 0, 0), align='CENTER', extrude=0.02, width=0):
    cu = bpy.data.curves.new(name, 'FONT')
    cu.body = body
    cu.font = bpy.data.fonts.load(FONT, check_existing=True)
    cu.size = size
    cu.align_x = align
    cu.align_y = 'CENTER'
    cu.extrude = extrude
    if width:
        cu.text_boxes[0].width = width
        cu.text_boxes[0].x = -width / 2
    o = link(bpy.data.objects.new(name, cu))
    cu.materials.append(m)
    if parent:
        o.parent = parent
    o.location = loc
    o.rotation_euler = rot
    return o


# ---------------------------------------------------------------- characters
class Char:
    """Blocky toy figure. root at feet. Parts are pivots that can be keyframed."""

    def __init__(self, name, skin='#F2C29B', hair='#5A3A22', top='#FFC928', legs='#3557C9', shoes='#E23B3B',
                 loc=(0, 0, 0), rot_z=0, scale=1.0, hat=None, apron=False, glasses=False, bun=False, moustache=False,
                 dress=False):
        self.name = name
        r = self.root = empty(name, loc)
        r.rotation_euler = (0, 0, rot_z)
        r.scale = (scale,) * 3
        S, H, T, L, SH = mat(skin, rough=0.6), mat(hair, rough=0.7), mat(top), mat(legs), mat(shoes, rough=0.4)
        black = mat('#141414', rough=0.3)
        white = mat('#FFFFFF', rough=0.3)
        self.body = empty(name + '_body', (0, 0, 0.82), r)
        box(name + '_torso', (0.82, 0.46, 0.84), (0, 0, 0.42), T, self.body)
        if apron:
            box(name + '_apron', (0.62, 0.04, 0.78), (0, -0.245, 0.38), white, self.body)
        if dress:
            box(name + '_skirt', (0.98, 0.6, 0.55), (0, 0, -0.08), T, self.body)
        # head
        self.head = empty(name + '_head', (0, 0, 0.86), self.body)
        box(name + '_skull', (0.72, 0.68, 0.70), (0, 0, 0.37), S, self.head, bevel=0.06)
        box(name + '_hair', (0.78, 0.74, 0.2), (0, 0.02, 0.72), H, self.head, bevel=0.05)
        box(name + '_hairback', (0.78, 0.18, 0.45), (0, 0.3, 0.52), H, self.head, bevel=0.04)
        if bun:
            sphere(name + '_bun', 0.2, (0, 0.18, 0.9), H, self.head)
        if hat == 'chef':
            cyl(name + '_hat', 0.3, 0.55, (0, 0, 1.0), white, self.head)
            sphere(name + '_hattop', 0.36, (0, 0, 1.3), white, self.head)
        # eyes
        self.eyes = []
        for sx in (-1, 1):
            e = box(f'{name}_eye{sx}', (0.13, 0.04, 0.17), (0.15 * sx, -0.345, 0.42), black, self.head, bevel=0.02)
            box(f'{name}_shine{sx}', (0.045, 0.02, 0.05), (0.03, -0.02, 0.04), white, e, bevel=0)
            self.eyes.append(e)
        self.brows = [box(f'{name}_brow{sx}', (0.17, 0.04, 0.04), (0.15 * sx, -0.345, 0.58), H, self.head, bevel=0)
                      for sx in (-1, 1)]
        self.mouth = box(name + '_mouth', (0.2, 0.04, 0.05), (0, -0.345, 0.2), mat('#7A2E2E'), self.head, bevel=0)
        if glasses:
            gm = mat('#222222', rough=0.2)
            for sx in (-1, 1):
                box(f'{name}_glass{sx}', (0.24, 0.03, 0.22), (0.15 * sx, -0.37, 0.42), mat('#BFE6FF', rough=0.05, alpha=0.4), self.head, bevel=0)
                box(f'{name}_rim{sx}', (0.26, 0.02, 0.03), (0.15 * sx, -0.38, 0.54), gm, self.head, bevel=0)
        if moustache:
            box(name + '_mst', (0.36, 0.06, 0.08), (0, -0.36, 0.27), mat('#3B2A1A'), self.head, bevel=0.02)
        for sx in (-1, 1):
            box(f'{name}_cheek{sx}', (0.1, 0.02, 0.05), (0.25 * sx, -0.345, 0.27), mat('#F49A9A'), self.head, bevel=0)
        # arms
        self.arms = []
        for sx in (-1, 1):
            p = empty(f'{name}_shoulder{sx}', (0.56 * sx, 0, 0.74), self.body)
            box(f'{name}_arm{sx}', (0.3, 0.32, 0.62), (0, 0, -0.27), T, p)
            box(f'{name}_hand{sx}', (0.28, 0.3, 0.2), (0, 0, -0.66), S, p)
            self.arms.append(p)
        # legs
        self.legs = []
        for sx in (-1, 1):
            p = empty(f'{name}_hip{sx}', (0.2 * sx, 0, 0.84), r)
            box(f'{name}_leg{sx}', (0.36, 0.38, 0.66), (0, 0, -0.38), L, p)
            box(f'{name}_shoe{sx}', (0.38, 0.5, 0.18), (0, -0.05, -0.75), SH, p)
            self.legs.append(p)
        self.tears = []

    # --- keyframe helpers (frames are absolute in the shot)
    def k(self, o, attr, f, val):
        setattr(o, attr, val) if not isinstance(val, (tuple, list)) else None
        if isinstance(val, (tuple, list)):
            getattr(o, attr)[:] = val
        o.keyframe_insert(attr, frame=f)

    def idle(self, f0, f1, amp=1.0):
        for f in range(f0, f1 + 1, 12):
            ph = (f - f0) / 24 * 2 * math.pi
            self.body.location.z = 0.82 + 0.02 * amp * math.sin(ph)
            self.body.keyframe_insert('location', frame=f)
            for i, a in enumerate(self.arms):
                a.rotation_euler = (0.06 * math.sin(ph + i), 0, (0.08 if i else -0.08))
                a.keyframe_insert('rotation_euler', frame=f)

    def walk(self, f0, f1, start, end, speed=1.0, swing=0.7):
        r = self.root
        r.location = start
        r.keyframe_insert('location', frame=f0)
        r.location = end
        r.keyframe_insert('location', frame=f1)
        step = max(3, int(8 / speed))
        for f in range(f0, f1 + 1, step):
            s = 1 if ((f - f0) // step) % 2 == 0 else -1
            for i, l in enumerate(self.legs):
                l.rotation_euler = (swing * s * (1 if i else -1), 0, 0)
                l.keyframe_insert('rotation_euler', frame=f)
            for i, a in enumerate(self.arms):
                a.rotation_euler = (-swing * s * (1 if i else -1), 0, 0)
                a.keyframe_insert('rotation_euler', frame=f)
            self.body.location.z = 0.82 + (0.06 if s > 0 else 0.0)
            self.body.keyframe_insert('location', frame=f)
        for l in self.legs + self.arms:
            l.rotation_euler = (0, 0, 0)
            l.keyframe_insert('rotation_euler', frame=f1 + 4)

    def hold_front(self, f, both=True, angle=-1.3):
        """Arms forward (holding something)."""
        for a in (self.arms if both else self.arms[1:]):
            a.rotation_euler = (angle, 0, 0)
            a.keyframe_insert('rotation_euler', frame=f)

    def shake(self, f0, f1, amp=0.08):
        for f in range(f0, f1 + 1, 2):
            s = amp * (1 if (f // 2) % 2 else -1)
            for a in self.arms:
                a.rotation_euler = (-1.3 + s, 0, s)
                a.keyframe_insert('rotation_euler', frame=f)

    def wave(self, f0, f1, arm=1):
        a = self.arms[arm]
        for f in range(f0, f1 + 1, 6):
            s = 1 if ((f - f0) // 6) % 2 else -1
            a.rotation_euler = (0, 0, (2.6 + 0.35 * s) * (1 if arm else -1))
            a.keyframe_insert('rotation_euler', frame=f)

    def talk(self, f0, f1, every=4):
        for f in range(f0, f1 + 1, every):
            self.mouth.scale = (1, 1, 1 + 2.4 * random.random())
            self.mouth.keyframe_insert('scale', frame=f)
        self.mouth.scale = (1, 1, 1)
        self.mouth.keyframe_insert('scale', frame=f1 + 2)

    def face(self, f, kind):
        """kind: neutral, happy, scared, worried, sad, shock"""
        eye = {'neutral': (1, 1, 1), 'happy': (1.1, 1, 0.35), 'scared': (1.35, 1, 1.45), 'worried': (1, 1, 1.1),
               'sad': (1, 1, 0.8), 'shock': (1.5, 1, 1.6), 'deadpan': (1.1, 1, 0.45)}[kind]
        mouth = {'neutral': (1, 1, 1), 'happy': (1.6, 1, 1.4), 'scared': (0.7, 1, 3.5), 'worried': (0.8, 1, 0.8),
                 'sad': (1.1, 1, 0.7), 'shock': (0.9, 1, 4.5), 'deadpan': (1.3, 1, 0.6)}[kind]
        brow = {'neutral': 0, 'happy': 0, 'scared': 0.35, 'worried': 0.4, 'sad': 0.45, 'shock': 0, 'deadpan': 0}[kind]
        brow_z = 0.64 if kind in ('shock', 'scared') else (0.52 if kind == 'deadpan' else 0.58)
        for e in self.eyes:
            e.scale = eye
            e.keyframe_insert('scale', frame=f)
        self.mouth.scale = mouth
        self.mouth.keyframe_insert('scale', frame=f)
        for i, b in enumerate(self.brows):
            b.rotation_euler = (0, brow * (1 if i else -1), 0)
            b.location.z = brow_z
            b.keyframe_insert('rotation_euler', frame=f)
            b.keyframe_insert('location', frame=f)

    def cry(self, f0, f1):
        m = mat('#7FD3FF', emit=0.6, rough=0.1)
        for i in range(10):
            sx = -1 if i % 2 else 1
            t = box(f'{self.name}_tear{len(self.tears)}', (0.07, 0.07, 0.11), (0.15 * sx, -0.36, 0.3), m, self.head, bevel=0)
            self.tears.append(t)
            fs = f0 + i * (f1 - f0) // 10
            t.scale = (0, 0, 0)
            t.keyframe_insert('scale', frame=fs - 1)
            t.scale = (1, 1, 1)
            t.keyframe_insert('scale', frame=fs)
            t.keyframe_insert('location', frame=fs)
            t.location = (0.15 * sx + 0.25 * sx, -0.45, -0.6)
            t.keyframe_insert('location', frame=fs + 10)
            t.scale = (0, 0, 0)
            t.keyframe_insert('scale', frame=fs + 11)

    def jump(self, f0, f1, h=0.8, period=12):
        z0 = self.root.location.z
        for f in range(f0, f1 + 1, period // 2):
            up = ((f - f0) // (period // 2)) % 2
            self.root.location.z = z0 + (h if up else 0)
            self.root.keyframe_insert('location', frame=f)


# ---------------------------------------------------------------- props
def mailbox(name, loc, glow=False, flag_up=False, rot_z=0):
    p = empty(name, loc)
    p.rotation_euler = (0, 0, rot_z)
    box(name + '_post', (0.16, 0.16, 1.1), (0, 0, 0.55), mat('#6B4A2E'), p)
    red = mat('#D93636', rough=0.35)
    box(name + '_box', (0.5, 0.75, 0.42), (0, 0, 1.3), red, p, bevel=0.05)
    cyl(name + '_lid', 0.25, 0.75, (0, 0, 1.51), red, p, rot=(math.pi / 2, 0, 0))
    fl = empty(name + '_flagpivot', (0.27, 0.2, 1.3), p)
    box(name + '_flagstick', (0.04, 0.04, 0.4), (0, 0, 0.2) if flag_up else (0, -0.2, 0), mat('#333333'), fl, bevel=0,
        rot=(0, 0, 0) if flag_up else (math.pi / 2, 0, 0))
    box(name + '_flag', (0.04, 0.2, 0.14), (0, -0.08, 0.36) if flag_up else (0, -0.38, 0.06), mat('#FFC928'), fl, bevel=0)
    door = box(name + '_door', (0.46, 0.04, 0.38), (0, -0.39, 1.3), mat('#B82A2A'), p, bevel=0.02)
    letter = None
    if glow:
        g = mat('#3DFF7A', emit=0)
        inner = box(name + '_inner', (0.4, 0.04, 0.3), (0, -0.37, 1.3), g, p, bevel=0)
        letter = box(name + '_letter', (0.36, 0.03, 0.24), (0, -0.3, 1.3), mat('#FFF4D6', rough=0.8), p, bevel=0)
    return p, door, letter


def lantern(name, loc, night=True, light=True):
    p = empty(name, loc)
    box(name + '_pole', (0.14, 0.14, 3.2), (0, 0, 1.6), mat('#2B2B33', rough=0.3), p)
    box(name + '_head', (0.4, 0.4, 0.5), (0, 0, 3.35), mat('#FFD27A', emit=8 if night else 0.3), p, bevel=0.04)
    box(name + '_cap', (0.5, 0.5, 0.1), (0, 0, 3.65), mat('#2B2B33', rough=0.3), p)
    if night and light:
        ld = bpy.data.lights.new(name + '_L', 'POINT')
        ld.energy = 140
        ld.color = (1.0, 0.78, 0.45)
        ld.shadow_soft_size = 0.4
        lo = link(bpy.data.objects.new(name + '_L', ld))
        lo.parent = p
        lo.location = (0, 0, 3.1)
    return p


def tree(name, loc, s=1.0, dark=False):
    p = empty(name, loc)
    p.scale = (s,) * 3
    box(name + '_trunk', (0.4, 0.4, 1.4), (0, 0, 0.7), mat('#6B4426'), p)
    g = '#2E7D46' if not dark else '#1D4E33'
    g2 = '#3FA35B' if not dark else '#24603E'
    box(name + '_l1', (1.8, 1.8, 1.1), (0, 0, 1.8), mat(g, rough=0.8), p, bevel=0.08)
    box(name + '_l2', (1.3, 1.3, 0.9), (0, 0, 2.7), mat(g2, rough=0.8), p, bevel=0.08)
    box(name + '_l3', (0.7, 0.7, 0.6), (0, 0, 3.35), mat(g, rough=0.8), p, bevel=0.06)
    return p


PASTEL = ['#F7A8B8', '#A8D8F7', '#B8F2A8', '#F7E1A8', '#D3B8F7', '#F7C3A8', '#A8F7E9']
ROOF = ['#C24A4A', '#4A6FC2', '#5E3B8C', '#B8563A', '#3E8C6A']


def house(name, loc, w=4.5, d=4.0, h=3.2, col=None, roof=None, night=True, facing=-1, lit=True):
    """facing -1: front at -Y side.  +1: front at +Y."""
    p = empty(name, loc)
    if facing > 0:
        p.rotation_euler = (0, 0, math.pi)
    col = col or random.choice(PASTEL)
    roof = roof or random.choice(ROOF)
    box(name + '_walls', (w, d, h), (0, 0, h / 2), mat(col, rough=0.75), p, bevel=0.06)
    prism(name + '_roof', w + 0.5, d + 0.6, 1.6, (0, 0, h), mat(roof, rough=0.6), p)
    box(name + '_chim', (0.5, 0.5, 1.2), (w / 4, 0.6, h + 1.1), mat('#8A5A44'), p)
    box(name + '_door', (0.9, 0.12, 1.6), (0, -d / 2 - 0.03, 0.8), mat('#7A4A2A'), p, bevel=0.03)
    box(name + '_knob', (0.1, 0.08, 0.1), (0.3, -d / 2 - 0.1, 0.8), mat('#FFD54A', metal=1, rough=0.2), p, bevel=0)
    wl = mat('#FFD77A', emit=3.5) if (night and lit) else mat('#9FD3F0', rough=0.1)
    for sx in (-1, 1):
        box(f'{name}_win{sx}', (0.9, 0.1, 0.8), (sx * w / 3.2, -d / 2 - 0.02, 1.9 if h > 3 else 1.6), wl, p, bevel=0)
        box(f'{name}_wfr{sx}', (1.05, 0.08, 0.95), (sx * w / 3.2, -d / 2 + 0.0, 1.9 if h > 3 else 1.6), mat('#FFFFFF'), p, bevel=0.02)
        box(f'{name}_win2{sx}', (0.8, 0.1, 0.7), (sx * w / 3.2, -d / 2 - 0.02, h + 0.55), wl, p, bevel=0) if False else None
    return p


def make_town(night=True, n=6, spacing=7.0, seed=3, lights=True, pip_x=0.0):
    random.seed(seed)
    c = CUR['coll'] = coll('TOWN')
    box('ground', (400, 200, 0.2), (0, 0, -0.1), mat('#4E9A4A' if not night else '#2F5E35', rough=0.9), bevel=0)
    box('street', (400, 6, 0.06), (0, 0, 0.02), mat('#6E6E7A', rough=0.85), bevel=0)
    for i in range(-60, 60):
        box(f'stripe{i}', (1.2, 0.18, 0.02), (i * 3.0, 0, 0.06), mat('#E8E2C8'), bevel=0)
    for sy in (-1, 1):
        box(f'walk{sy}', (400, 1.6, 0.18), (0, sy * 3.8, 0.09), mat('#B9B2A6', rough=0.8), bevel=0)
    houses = []
    for i in range(-n, n + 1):
        for sy in (-1, 1):
            if i == 0 and sy == 1:
                h = house('pip_house', (pip_x, 8.5, 0), col='#A8D8F7', roof='#C24A4A', night=night, facing=-1)
            else:
                h = house(f'h{i}_{sy}', (i * spacing + random.uniform(-0.6, 0.6), sy * 8.5, 0),
                          w=random.uniform(4.0, 5.2), h=random.uniform(2.8, 4.2), night=night, facing=-sy,
                          lit=random.random() > 0.35)
            houses.append(h)
            if random.random() < 0.6:
                tree(f't{i}_{sy}', (i * spacing + 3.4, sy * 7.2, 0), s=random.uniform(0.7, 1.0), dark=night)
    for i in range(-n, n + 1):
        lantern(f'lamp{i}', (i * spacing + 3.5, -4.9 if i % 2 else 4.9, 0), night=night, light=lights and abs(i) <= 3)
    return houses


def setup_render(res=(720, 1280), samples=6, fps=24):
    s = bpy.context.scene
    s.render.engine = 'BLENDER_EEVEE_NEXT'
    s.eevee.taa_render_samples = samples
    s.render.resolution_x, s.render.resolution_y = res
    s.render.fps = fps
    s.render.image_settings.file_format = 'JPEG'
    s.render.image_settings.quality = 92
    s.view_settings.view_transform = 'AgX'
    s.view_settings.look = 'AgX - Medium High Contrast'
    try:
        s.eevee.use_shadows = True
    except Exception:
        pass
    # bloom via compositor
    s.use_nodes = True
    nt = s.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    rl = nt.nodes.new('CompositorNodeRLayers')
    gl = nt.nodes.new('CompositorNodeGlare')
    gl.glare_type = 'FOG_GLOW'
    try:
        gl.quality = 'MEDIUM'
        gl.threshold = 1.2
        gl.size = 7
    except Exception:
        pass
    out = nt.nodes.new('CompositorNodeComposite')
    nt.links.new(rl.outputs['Image'], gl.inputs['Image'])
    nt.links.new(gl.outputs['Image'], out.inputs['Image'])


def world_sky(night=True):
    w = bpy.context.scene.world or bpy.data.worlds.new('W')
    bpy.context.scene.world = w
    w.use_nodes = True
    nt = w.node_tree
    bg = nt.nodes['Background']
    if night:
        bg.inputs['Color'].default_value = hexcol('#141B3D')
        bg.inputs['Strength'].default_value = 1.0
    else:
        bg.inputs['Color'].default_value = hexcol('#9FD4FF')
        bg.inputs['Strength'].default_value = 1.0


def sun(night=True, angle=(0.9, 0.2, -0.6), energy=None):
    ld = bpy.data.lights.new('sun', 'SUN')
    ld.energy = energy if energy is not None else (1.1 if night else 4.0)
    ld.color = (0.55, 0.65, 1.0) if night else (1.0, 0.95, 0.85)
    ld.angle = 0.1
    o = link(bpy.data.objects.new('sun', ld))
    o.rotation_euler = angle
    return o


def sky_deco(night=True, center=(0, 0, 0)):
    cx, cy, cz = center
    if night:
        sphere('moon', 6, (cx + 25, cy + 120, cz + 55), mat('#FFF6D8', emit=6), seg=24)
        random.seed(9)
        sm = mat('#FFFFFF', emit=12)
        for i in range(160):
            a = random.uniform(-1.3, 1.3)
            e = random.uniform(0.25, 1.0)
            r = 150
            box(f'star{i}', (0.35, 0.35, 0.35), (cx + r * math.sin(a), cy + r * math.cos(a) * math.cos(e), cz + r * math.sin(e)), sm, bevel=0)
    else:
        random.seed(5)
        cm = mat('#FFFFFF', rough=1)
        for i in range(9):
            x, z = random.uniform(-70, 70), random.uniform(25, 45)
            for j in range(3):
                box(f'cloud{i}_{j}', (6 - j * 1.5, 3, 2.2 - j * 0.4), (cx + x + j * 2.5, cy + 90, cz + z + j * 0.6), cm, bevel=0.3)


def camera(name='cam', lens=30):
    cd = bpy.data.cameras.new(name)
    cd.lens = lens
    cd.clip_end = 600
    o = link(bpy.data.objects.new(name, cd))
    bpy.context.scene.camera = o
    return o


def cam_key(cam, f, loc, target, lens=None):
    cam.location = loc
    d = Vector(target) - Vector(loc)
    cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    cam.keyframe_insert('location', frame=f)
    cam.keyframe_insert('rotation_euler', frame=f)
    if lens:
        cam.data.lens = lens
        cam.data.keyframe_insert('lens', frame=f)
