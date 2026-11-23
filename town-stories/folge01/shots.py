"""Episode 1 shots. Usage: python shots.py <shot_index|all> [--still] [--samples N]"""
import sys, os, json, math, random
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'tools'))
import bpy
from world import *

FPS = 24
TM = json.load(open(os.path.join(HERE, 'timings.json')))
L = TM['lines']


def T(i):
    return L[i]['start'] if i < len(L) else TM['total']


PIP = dict(top='#FFC928', legs='#3557C9', shoes='#E23B3B')
PJ = dict(top='#8EC9FF', legs='#8EC9FF', shoes='#F4F4F4')

SHOTS = [
    ('town_fly', 0, T(1)),
    ('mailbox_row', T(1), T(2)),
    ('letter_generic', T(2), T(3)),
    ('pip_deadpan', T(3), T(4)),
    ('bakery', T(4), T(6)),
    ('school', T(6), T(8)),
    ('spaghetti', T(8), T(10)),
    ('bedroom', T(10), T(11)),
    ('clock300', T(11), T(11) + 1.1),
    ('mailbox_glow', T(11) + 1.1, T(12)),
    ('run_out', T(12), T(13)),
    ('letter_front', T(13), T(13) + 2.3),
    ('town_vanish', T(13) + 2.3, T(14) + 1.3),
    ('letter_back', T(14) + 1.3, T(16)),
    ('forest', T(16), T(17)),
    ('grandma', T(17), T(18)),
    ('writing', T(18), T(19)),
    ('final', T(19), TM['total']),
]


def linear(o):
    ad = o.animation_data
    if ad and ad.action:
        try:
            curves = ad.action.fcurves
        except Exception:
            curves = [c for l in ad.action.layers for s in l.strips for cb in s.channelbags for c in cb.fcurves]
        for fc in curves:
            for kp in fc.keyframe_points:
                kp.interpolation = 'LINEAR'


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    import world
    world._mats.clear()
    world.CUR['coll'] = None


def paper_letter(name, loc, parent=None, scale=1.0, front='', back='', seal=True):
    p = empty(name, loc, parent)
    p.scale = (scale,) * 3
    box(name + '_paper', (2.4, 0.04, 3.1), (0, 0, 0), mat('#FFF1CF', rough=0.85), p, bevel=0)
    ink = mat('#2A2340', rough=0.6)
    if front:
        text(name + '_ft', front, (0, -0.035, 0.15), 0.32, ink, p, extrude=0.003, width=2.0)
    if back:
        text(name + '_bt', back, (0, 0.035, 0.15), 0.32, ink, p, rot=(math.pi / 2, 0, math.pi), extrude=0.003, width=2.0)
    if seal:
        cyl(name + '_seal', 0.22, 0.05, (0, -0.04, -1.15), mat('#2FCF63', emit=2.5), p, rot=(math.pi / 2, 0, 0))
        cyl(name + '_seal2', 0.22, 0.05, (0, 0.04, -1.15), mat('#2FCF63', emit=2.5), p, rot=(math.pi / 2, 0, 0))
    return p


def small_letter(name, parent, loc=(0, -0.2, -0.75)):
    p = empty(name, loc, parent)
    box(name + '_p', (0.45, 0.03, 0.32), (0, 0, 0), mat('#FFF1CF', rough=0.85), p, bevel=0)
    cyl(name + '_s', 0.06, 0.04, (0, -0.03, 0), mat('#2FCF63', emit=3), p, rot=(math.pi / 2, 0, 0))
    return p


def green_light(loc, energy=300, name='gl'):
    ld = bpy.data.lights.new(name, 'POINT')
    ld.energy = energy
    ld.color = (0.25, 1.0, 0.45)
    ld.shadow_soft_size = 0.3
    o = link(bpy.data.objects.new(name, ld))
    o.location = loc
    return o


def point(loc, energy, color=(1, 0.8, 0.55), name='pl', size=0.5):
    ld = bpy.data.lights.new(name, 'POINT')
    ld.energy = energy
    ld.color = color
    ld.shadow_soft_size = size
    o = link(bpy.data.objects.new(name, ld))
    o.location = loc
    return o


def area(loc, rot, energy, color=(1, 1, 1), size=6, name='al'):
    ld = bpy.data.lights.new(name, 'AREA')
    ld.energy = energy
    ld.color = color
    ld.size = size
    o = link(bpy.data.objects.new(name, ld))
    o.location = loc
    o.rotation_euler = rot
    return o


def night_base(lights=True):
    world_sky(True)
    sun(True)
    sky_deco(True)
    return make_town(night=True, lights=lights)


def day_base():
    world_sky(False)
    sun(False, angle=(0.8, 0.15, 0.5))
    sky_deco(False)
    return make_town(night=False)


def room(wall='#3A3F7A', floor='#8A5A3C', w=12, d=10, h=6, win=False, night=True):
    box('floor', (w, d, 0.2), (0, 0, -0.1), mat(floor, rough=0.7), bevel=0)
    for i in range(-int(w / 2), int(w / 2)):
        box(f'plank{i}', (0.04, d, 0.01), (i + 0.5, 0, 0.005), mat('#6E452D'), bevel=0)
    box('backwall', (w, 0.2, h), (0, d / 2, h / 2), mat(wall, rough=0.9), bevel=0)
    box('lwall', (0.2, d, h), (-w / 2, 0, h / 2), mat(wall, rough=0.9), bevel=0)
    box('rwall', (0.2, d, h), (w / 2, 0, h / 2), mat(wall, rough=0.9), bevel=0)
    box('ceil', (w, d, 0.2), (0, 0, h), mat('#2A2E5A' if night else '#F4EBDD'), bevel=0)


# ------------------------------------------------------------------ shots
def s_town_fly(N):
    night_base()
    pip = Char('pip', **PIP, loc=(0.6, 4.7, 0.18))
    pip.idle(1, N)
    pip.face(1, 'neutral')
    mailbox('mb', (1.9, 5.0, 0.18), glow=True, flag_up=True)
    green_light((1.9, 4.2, 1.6), 60)
    cam = camera(lens=24)
    cam_key(cam, 1, (-34, -30, 26), (-4, 6, 0))
    cam_key(cam, int(N * 0.55), (-10, -14, 9), (0, 5, 1.5))
    cam_key(cam, N, (0.8, -3.2, 2.6), (1.2, 5, 1.6))


def s_mailbox_row(N):
    night_base()
    for i, x in enumerate((-9.0, -5.0)):
        mailbox(f'n{i}', (x, 5.0, 0.18), flag_up=False)
    mailbox('mb', (1.9, 5.0, 0.18), glow=True, flag_up=True)
    pip = Char('pip', **PIP, loc=(0.4, 4.6, 0.18))
    pip.face(1, 'happy')
    pip.idle(1, N)
    pip.hold_front(1, both=False, angle=-2.2)
    small_letter('lt', pip.arms[1], (0, -0.2, -0.75))
    pip.talk(int(N * 0.5), N)
    point((0, 1, 3), 120)
    cam = camera(lens=32)
    cam_key(cam, 1, (-10, -1.5, 2.2), (-8, 5, 1.2))
    cam_key(cam, N, (0.6, -3.2, 2.0), (1.1, 5, 1.5))


def letter_set(N, front='', back='', flip=False, shake=False, glow=520):
    world_sky(True)
    bpy.context.scene.world.node_tree.nodes['Background'].inputs['Color'].default_value = hexcol('#0B1028')
    lt = paper_letter('L', (0, 0, 2.5), front=front, back=back)
    random.seed(4)
    sm = mat('#7DFFA6', emit=6)
    for i in range(40):
        s = box(f'spark{i}', (0.05, 0.05, 0.05), (random.uniform(-3, 3), random.uniform(-1, 3), random.uniform(0, 5)), sm, bevel=0)
        s.keyframe_insert('location', frame=1)
        s.location.z += random.uniform(0.5, 1.5)
        s.keyframe_insert('location', frame=N)
    green_light((0, -1.8, 1.0), glow, 'g1')
    point((-2, -4, 4), 220, (1, 0.9, 0.75), 'key')
    cam = camera(lens=40)
    cam_key(cam, 1, (0, -7.8, 2.6), (0, 0, 2.5))
    cam_key(cam, N, (0, -6.0, 2.55), (0, 0, 2.5))
    lt.rotation_euler = (0.05, 0, -0.08)
    lt.keyframe_insert('rotation_euler', frame=1)
    if flip:
        lt.rotation_euler = (0.05, 0, -0.08)
        lt.keyframe_insert('rotation_euler', frame=3)
        lt.rotation_euler = (0.0, 0, math.pi)
        lt.keyframe_insert('rotation_euler', frame=int(FPS * 0.8))
        lt.rotation_euler = (0.04, 0, math.pi + 0.06)
        lt.keyframe_insert('rotation_euler', frame=N)
    else:
        lt.rotation_euler = (-0.03, 0, 0.06)
        lt.keyframe_insert('rotation_euler', frame=N)
    if shake:
        for f in range(int(N * 0.35), N, 2):
            cam.location.x = random.uniform(-0.06, 0.06)
            cam.location.z = 2.6 + random.uniform(-0.06, 0.06)
            cam.location.y = -7.8 + 1.8 * f / N
            cam.keyframe_insert('location', frame=f)


def s_letter_generic(N):
    letter_set(N, front='TOMORROW:\n\n~~~~~~~~~\n~~~~~~\n~~~~~~~~')


def s_pip_deadpan(N):
    night_base()
    mailbox('mb', (1.9, 5.0, 0.18), glow=True, flag_up=True)
    pip = Char('pip', **PIP, loc=(0.6, 4.7, 0.18))
    pip.face(1, 'deadpan')
    pip.face(int(N * 0.45), 'deadpan')
    pip.face(int(N * 0.55), 'worried')
    pip.talk(1, N)
    point((0.6, 1.5, 3.2), 160)
    cam = camera(lens=55)
    cam_key(cam, 1, (0.6, -1.0, 2.5), (0.6, 4.7, 2.1))
    cam_key(cam, N, (0.6, 0.6, 2.4), (0.6, 4.7, 2.15))


def pancake(name, m, mb):
    p = cyl(name, 0.5, 0.12, (0, 0, 0), m, verts=20)
    box(name + '_b', (0.2, 0.2, 0.1), (0, 0, 0.1), mb, p, bevel=0)
    return p


def s_bakery(N):
    world_sky(False)
    sun(False, angle=(0.8, 0.15, 0.5))
    sky_deco(False)
    box('ground', (300, 200, 0.2), (0, 0, -0.1), mat('#4E9A4A', rough=0.9), bevel=0)
    box('street', (300, 6, 0.06), (0, 0, 0.02), mat('#6E6E7A', rough=0.85), bevel=0)
    box('walk', (300, 1.6, 0.18), (0, 3.8, 0.09), mat('#B9B2A6', rough=0.8), bevel=0)
    b = house('bakery', (0, 8.5, 0), w=8, d=5, h=4.4, col='#F7A8B8', roof='#8A4A2E', night=False)
    text('sign', 'BAKERY', (0, 5.9, 3.7), 0.9, mat('#FFFFFF', emit=0.5), extrude=0.08)
    box('signbg', (5, 0.1, 1.2), (0, 5.95, 3.7), mat('#8A4A2E'))
    for i in range(6):
        box(f'awn{i}', (8.4 / 6, 1.2, 0.12), (-4.2 + 8.4 / 12 + i * 8.4 / 6, 5.4, 2.9), mat('#E23B3B' if i % 2 else '#FFFFFF'), bevel=0, rot=(-0.35, 0, 0))
    house('n1', (-9.5, 8.5, 0), col='#A8D8F7', night=False)
    house('n2', (9.5, 8.5, 0), col='#B8F2A8', night=False)
    lantern('l1', (-5, 4.9, 0), night=False)
    crumb = Char('crumb', skin='#F0B98F', hair='#EDEDED', top='#FFFFFF', legs='#4A4A4A', shoes='#2B2B2B',
                 loc=(-2.4, 4.4, 0.18), hat='chef', apron=True, moustache=True, scale=1.12)
    boom = int((T(5) - T(4)) * FPS) - 6
    crumb.face(1, 'happy')
    crumb.idle(1, boom)
    crumb.face(boom, 'happy')
    crumb.face(boom + 4, 'shock')
    crumb.face(boom + 26, 'sad')
    crumb.cry(boom + 26, N)
    for a in crumb.arms:
        a.rotation_euler = (0, 0, 0)
        a.keyframe_insert('rotation_euler', frame=boom)
    crumb.arms[0].rotation_euler = (0, 0, -2.7)
    crumb.arms[1].rotation_euler = (0, 0, 2.7)
    for a in crumb.arms:
        a.keyframe_insert('rotation_euler', frame=boom + 5)
    # pancakes
    random.seed(11)
    pm, bm = mat('#E9B565', rough=0.6), mat('#FFF07A', rough=0.3)
    srcs = [(0, 5.8, 1.2), (-2.7, 6.0, 1.9), (2.7, 6.0, 1.9), (2.0, 9.0, 5.5)]
    for i in range(70):
        p = pancake(f'pc{i}', pm, bm)
        sx, sy, sz = random.choice(srcs)
        f0 = boom + random.randint(0, 30)
        p.location = (sx, sy, sz)
        p.scale = (0, 0, 0)
        p.keyframe_insert('location', frame=f0 - 1)
        p.keyframe_insert('scale', frame=f0 - 1)
        p.scale = (1, 1, 1)
        p.keyframe_insert('scale', frame=f0)
        vx, vy, vz = random.uniform(-5, 5), random.uniform(-6, -1), random.uniform(5, 10)
        rx, ry = random.uniform(-8, 8), random.uniform(-8, 8)
        ground = 0.2 + random.uniform(0, 0.6)
        for k in range(0, 60, 3):
            t = k / FPS
            z = sz + vz * t - 9.8 * t * t
            if z < ground:
                z = ground
                p.location = (p.location.x, p.location.y, z)
                p.rotation_euler = (0, 0, p.rotation_euler.z)
                p.keyframe_insert('location', frame=f0 + k)
                p.keyframe_insert('rotation_euler', frame=f0 + k)
                break
            p.location = (sx + vx * t, sy + vy * t, z)
            p.rotation_euler = (rx * t, ry * t, 0)
            p.keyframe_insert('location', frame=f0 + k)
            p.keyframe_insert('rotation_euler', frame=f0 + k)
        linear(p)
    cam = camera(lens=26)
    cam_key(cam, 1, (0, -11, 3.2), (0, 6, 3.0))
    cam_key(cam, boom, (0, -8.5, 2.8), (0, 6, 2.8))
    cam_key(cam, boom + 3, (0.25, -8.4, 2.95), (0, 6, 2.8))
    cam_key(cam, boom + 6, (-0.2, -8.3, 2.7), (0, 6, 2.8))
    cam_key(cam, boom + 30, (-1.0, -4.6, 2.4), (-2.4, 4.4, 2.2))
    cam_key(cam, N, (-2.0, -0.8, 2.4), (-2.4, 4.4, 2.3))


def goose(name, loc, rot_z=math.pi):
    p = empty(name, loc)
    p.rotation_euler = (0, 0, rot_z)
    W, O = mat('#FAFAFA', rough=0.6), mat('#FF9A1F', rough=0.4)
    box(name + '_body', (1.2, 1.7, 1.0), (0, 0.2, 1.3), W, p, bevel=0.15)
    box(name + '_tail', (0.6, 0.5, 0.4), (0, 1.1, 1.6), W, p, bevel=0.1, rot=(0.5, 0, 0))
    neck = empty(name + '_neckp', (0, -0.45, 1.6), p)
    box(name + '_neck', (0.38, 0.38, 1.1), (0, 0, 0.55), W, neck, bevel=0.08)
    head = empty(name + '_headp', (0, 0, 1.15), neck)
    box(name + '_head', (0.6, 0.7, 0.55), (0, -0.1, 0.1), W, head, bevel=0.1)
    beak_top = box(name + '_beak', (0.34, 0.5, 0.12), (0, -0.62, 0.06), O, head, bevel=0.03)
    beak_bot = empty(name + '_jaw', (0, -0.4, -0.02), head)
    box(name + '_beak2', (0.3, 0.42, 0.08), (0, -0.2, 0), O, beak_bot, bevel=0.02)
    for sx in (-1, 1):
        e = box(f'{name}_eye{sx}', (0.1, 0.04, 0.12), (0.16 * sx, -0.46, 0.2), mat('#141414', rough=0.3), head, bevel=0)
        box(f'{name}_gl{sx}', (0.22, 0.03, 0.2), (0.16 * sx, -0.5, 0.2), mat('#BFE6FF', rough=0.05, alpha=0.4), head, bevel=0)
        box(f'{name}_rim{sx}', (0.24, 0.02, 0.03), (0.16 * sx, -0.52, 0.31), mat('#222222'), head, bevel=0)
        box(f'{name}_leg{sx}', (0.12, 0.12, 0.8), (0.3 * sx, 0.2, 0.4), O, p, bevel=0)
        box(f'{name}_foot{sx}', (0.35, 0.45, 0.08), (0.3 * sx, 0.05, 0.04), O, p, bevel=0)
    box(name + '_scarf', (0.48, 0.48, 0.2), (0, 0, 0.1), mat('#3FA35B'), neck, bevel=0.05)
    wings = []
    for sx in (-1, 1):
        wp = empty(f'{name}_wingp{sx}', (0.62 * sx, 0.0, 1.6), p)
        box(f'{name}_wing{sx}', (0.12, 1.2, 0.7), (0, 0.2, -0.25), mat('#EDEDED'), wp, bevel=0.05)
        wings.append(wp)
    return p, neck, head, beak_bot, wings


def s_school(N):
    room(wall='#F2E6C9', floor='#B07A4F', w=14, d=12, h=6, night=False)
    world_sky(False)
    area((0, -2, 5.8), (0, 0, 0), 900, (1, 0.97, 0.9), 10)
    point((-3, -4, 3), 300, (1, 0.95, 0.85), 'fill')
    box('board', (7, 0.1, 2.6), (0, 5.85, 3.0), mat('#1F4A3A', rough=0.9))
    box('boardfr', (7.3, 0.08, 2.9), (0, 5.9, 3.0), mat('#8A5A3C'))
    text('hw', 'HOMEWORK:\n50 PAGES', (0, 5.78, 3.0), 0.55, mat('#F4F4F4', rough=1), extrude=0.0)
    for i, (x, y) in enumerate([(-3, -1), (0, -1.4), (3, -1)]):
        box(f'desk{i}', (1.6, 1.0, 0.1), (x, y + 1.1, 1.0), mat('#C98E5A'))
        for dx in (-0.7, 0.7):
            box(f'dl{i}{dx}', (0.08, 0.08, 1.0), (x + dx, y + 1.1, 0.5), mat('#555555'), bevel=0)
    pip = Char('pip', **PIP, loc=(0, -1.4, 0), rot_z=math.pi)
    Char('k1', top='#E25D9B', legs='#3B3B3B', hair='#1E1E1E', loc=(-3, -1, 0), rot_z=math.pi)
    Char('k2', top='#5DD6E2', legs='#3B3B3B', hair='#C9832E', loc=(3, -1, 0), rot_z=math.pi)
    honk = Char('honk', top='#3FA35B', legs='#5A4A6A', hair='#6B4426', shoes='#3B2B2B', loc=(0, 3.6, 0), glasses=True,
                bun=True, scale=1.15, dress=True)
    g, neck, head, jaw, wings = goose('goose', (0, 3.6, 0), rot_z=0)
    tf = int((T(6) - T(6) + L[6]['dur'] * 0.85) * FPS)  # at the word "goose"
    honk.talk(1, tf - 4)
    honk.face(1, 'neutral')
    honk.root.keyframe_insert('scale', frame=tf - 1)
    honk.root.scale = (0, 0, 0)
    honk.root.keyframe_insert('scale', frame=tf)
    g.scale = (0, 0, 0)
    g.keyframe_insert('scale', frame=tf - 1)
    g.scale = (1, 1, 1)
    g.keyframe_insert('scale', frame=tf)
    # poof
    random.seed(2)
    pm = mat('#FFFFFF', emit=1.5)
    for i in range(18):
        c = box(f'poof{i}', (0.5, 0.5, 0.5), (random.uniform(-1.2, 1.2), 3.6 + random.uniform(-0.6, 0.6), random.uniform(0.5, 3)), pm, bevel=0.1)
        c.scale = (0, 0, 0)
        c.keyframe_insert('scale', frame=tf - 2)
        c.scale = (2.2, 2.2, 2.2)
        c.keyframe_insert('scale', frame=tf + 2)
        c.scale = (0, 0, 0)
        c.keyframe_insert('scale', frame=tf + 14)
    # honk on line 7
    hf = int((T(7) - T(6)) * FPS)
    for f in range(hf, N, 5):
        jaw.rotation_euler = (0.5 if (f // 5) % 2 == 0 else 0, 0, 0)
        jaw.keyframe_insert('rotation_euler', frame=f)
        for i, w in enumerate(wings):
            w.rotation_euler = (0, (0.9 if (f // 5) % 2 == 0 else 0.1) * (1 if i else -1), 0)
            w.keyframe_insert('rotation_euler', frame=f)
    neck.rotation_euler = (0, 0, 0)
    neck.keyframe_insert('rotation_euler', frame=hf)
    neck.rotation_euler = (-0.35, 0, 0)
    neck.keyframe_insert('rotation_euler', frame=hf + 6)
    cam = camera(lens=26)
    cam_key(cam, 1, (3.2, -7.0, 5.0), (0, 3.6, 2.4))
    cam_key(cam, tf, (2.6, -5.0, 4.4), (0, 3.6, 2.4))
    cam_key(cam, N, (1.6, 0.4, 3.4), (0, 3.6, 2.6))


def noodle(name, m):
    import mathutils
    cu = bpy.data.curves.new(name, 'CURVE')
    cu.dimensions = '3D'
    cu.bevel_depth = 0.045
    sp = cu.splines.new('BEZIER')
    n = 6
    sp.bezier_points.add(n - 1)
    for i, bp in enumerate(sp.bezier_points):
        bp.co = (random.uniform(-0.25, 0.25), random.uniform(-0.25, 0.25), i * 0.25)
        bp.handle_left_type = bp.handle_right_type = 'AUTO'
    o = link(bpy.data.objects.new(name, cu))
    cu.materials.append(m)
    return o


def dog(name, loc, rot_z=0):
    p = empty(name, loc)
    p.rotation_euler = (0, 0, rot_z)
    B, D = mat('#C98A4B', rough=0.7), mat('#7A4E2A', rough=0.7)
    box(name + '_body', (0.8, 1.3, 0.7), (0, 0.2, 0.75), B, p, bevel=0.1)
    hd = empty(name + '_hp', (0, -0.55, 1.15), p)
    box(name + '_head', (0.7, 0.65, 0.6), (0, -0.1, 0.15), B, hd, bevel=0.1)
    box(name + '_snout', (0.36, 0.35, 0.28), (0, -0.55, 0.02), mat('#E8C49A'), hd, bevel=0.05)
    box(name + '_nose', (0.14, 0.06, 0.1), (0, -0.74, 0.12), mat('#141414'), hd, bevel=0)
    tongue = box(name + '_tongue', (0.14, 0.14, 0.04), (0.05, -0.68, -0.14), mat('#FF6B8A'), hd, bevel=0)
    for sx in (-1, 1):
        box(f'{name}_eye{sx}', (0.1, 0.04, 0.12), (0.17 * sx, -0.43, 0.28), mat('#141414'), hd, bevel=0)
        box(f'{name}_ear{sx}', (0.16, 0.3, 0.42), (0.38 * sx, 0, 0.15), D, hd, bevel=0.04)
        for sy in (-1, 1):
            box(f'{name}_leg{sx}{sy}', (0.2, 0.2, 0.45), (0.25 * sx, 0.2 + 0.45 * sy, 0.22), B, p, bevel=0.03)
    tail = empty(name + '_tp', (0, 0.85, 1.0), p)
    box(name + '_tail', (0.12, 0.12, 0.5), (0, 0.05, 0.2), D, tail, bevel=0, rot=(-0.5, 0, 0))
    return p, hd, tail


def s_spaghetti(N):
    day_base()
    pip = Char('pip', **PIP, loc=(1.6, 4.2, 0.18))
    pip.face(1, 'worried')
    pip.face(int((T(9) - T(8)) * FPS), 'deadpan')
    pip.arms[1].rotation_euler = (0, 0, 2.6)
    pip.arms[1].keyframe_insert('rotation_euler', frame=1)
    um = mat('#E23B3B', rough=0.4)
    ub = empty('umb', (0, 0, -0.65), pip.arms[1])
    box('umb_stick', (0.06, 0.06, 1.6), (0, 0, -0.6), mat('#333333'), ub, bevel=0)
    cyl('umb_top', 1.0, 0.18, (0, 0, -1.45), um, ub, verts=8)
    d, hd, tail = dog('dog', (-1.3, 4.3, 0.18))
    jf = int((T(9) - T(8)) * FPS)
    for f in range(1, N, 6):
        tail.rotation_euler = (0, 0.6 if (f // 6) % 2 else -0.6, 0)
        tail.keyframe_insert('rotation_euler', frame=f)
    for f in range(jf, N, 8):
        d.location.z = 0.18 + (1.2 if (f // 8) % 2 == 0 else 0)
        d.keyframe_insert('location', frame=f)
    random.seed(21)
    nm = mat('#F2C94C', rough=0.4)
    mm = mat('#8C3B22', rough=0.5)
    for i in range(110):
        o = noodle(f'nd{i}', nm) if i % 9 else sphere(f'mb{i}', 0.2, (0, 0, 0), mm, seg=10)
        x, y = random.uniform(-7, 7), random.uniform(1.5, 9)
        f0 = random.randint(-30, N - 10)
        o.rotation_euler = (random.uniform(0, 3), random.uniform(0, 3), 0)
        o.location = (x, y, 14)
        o.keyframe_insert('location', frame=f0)
        o.location = (x, y, 0.2)
        o.keyframe_insert('location', frame=f0 + 26)
        linear(o)
    cam = camera(lens=28)
    cam_key(cam, 1, (0.5, -7, 2.0), (0, 5, 2.6))
    cam_key(cam, N, (-0.5, -3.2, 1.6), (0, 5, 1.8))


def bedroom(N, clock='2:59', pj=True, pip_at=(0.0, 2.6, 0.75), seated=True):
    world_sky(True)
    room(wall='#2C3266', floor='#7A4E35', w=12, d=10, h=6)
    # window with night outside
    box('winframe', (3.4, 0.25, 2.6), (2.5, 4.92, 3.4), mat('#E9E2D0'))
    box('winsky', (3.0, 0.1, 2.2), (2.5, 4.8, 3.4), mat('#1A2A66', emit=1.2))
    sphere('winmoon', 0.35, (3.4, 4.72, 3.9), mat('#FFF6D8', emit=8), seg=16)
    for i in range(12):
        random.seed(i)
        box(f'ws{i}', (0.05, 0.05, 0.05), (2.5 + random.uniform(-1.3, 1.3), 4.72, 3.4 + random.uniform(-0.9, 0.9)), mat('#FFFFFF', emit=10), bevel=0)
    box('bed', (3.0, 4.5, 0.6), (-0.2, 2.4, 0.3), mat('#5A3A22'))
    box('mattress', (2.9, 4.4, 0.3), (-0.2, 2.4, 0.75), mat('#F4F4F4'))
    box('blanket', (2.95, 2.6, 0.12), (-0.2, 1.4, 0.92), mat('#E25D9B'))
    box('pillow', (1.6, 0.8, 0.3), (-0.2, 4.1, 1.05), mat('#FFFFFF'))
    box('nightstand', (1.1, 1.0, 1.1), (-2.5, 1.0, 0.55), mat('#8A5A3C'))
    box('clockbody', (1.0, 0.5, 0.55), (-2.5, 1.0, 1.4), mat('#222230'))
    text('clocktxt', clock, (-2.5, 0.73, 1.4), 0.42, mat('#FF3B3B', emit=12), extrude=0.0)
    point((-2.5, 0.2, 1.5), 15, (1, 0.2, 0.2), 'clockglow', 0.2)
    area((2.5, 3.5, 3.4), (math.radians(80), 0, math.radians(200)), 150, (0.6, 0.7, 1.0), 2.5)
    point((0, -3, 4.5), 320, (0.7, 0.75, 1.0), 'fill')
    point((-1.2, 0.5, 2.6), 90, (1, 0.5, 0.5), 'clockfill')
    pip = Char('pip', **(PJ if pj else PIP), loc=pip_at)
    if seated:
        for l in pip.legs:
            l.rotation_euler = (-math.pi / 2, 0, 0)
            l.keyframe_insert('rotation_euler', frame=1)
        pip.root.location.z = pip_at[2] - 0.15
    return pip


def s_bedroom(N):
    pip = bedroom(N, '2:59')
    pip.face(1, 'deadpan')
    pip.face(int(N * 0.6), 'deadpan')
    pip.face(int(N * 0.7), 'scared')
    pip.talk(1, int(N * 0.6))
    pip.idle(1, N, 0.5)
    cam = camera(lens=30)
    cam_key(cam, 1, (0.5, -6.5, 2.8), (-0.6, 2.0, 1.6))
    cam_key(cam, N, (-1.4, -2.6, 2.0), (-2.0, 1.4, 1.5))


def s_clock300(N):
    bedroom(N, '3:00')
    cam = camera(lens=60)
    for f in range(1, N + 1, 2):
        j = 0.015 if f < N * 0.8 else 0
        cam_key(cam, f, (-2.5 + random.uniform(-j, j), -1.4 + f * 0.01, 1.45 + random.uniform(-j, j)), (-2.5, 1.0, 1.4))
    green_light((-2.5, -0.5, 1.6), 0, 'gflash')
    gl = bpy.data.objects['gflash']
    gl.data.keyframe_insert('energy', frame=int(N * 0.5))
    gl.data.energy = 180
    gl.data.keyframe_insert('energy', frame=int(N * 0.7))


def s_mailbox_glow(N):
    night_base()
    mb, door, letter = mailbox('mb', (1.9, 5.0, 0.18), glow=True, flag_up=True)
    gl = green_light((1.9, 4.3, 1.5), 50, 'g')
    for f in range(1, N + 1, 6):
        gl.data.energy = 60 + 50 * (1 + math.sin(f / 3)) + f * 1.2
        gl.data.keyframe_insert('energy', frame=f)
    inner = bpy.data.objects['mb_inner']
    im = inner.active_material = mat('#3DFF7A', emit=4, name='inner_glow')
    door.rotation_euler = (0, 0, 0)
    door.keyframe_insert('rotation_euler', frame=int(N * 0.5))
    door.location = (0, -0.39, 1.3)
    door.keyframe_insert('location', frame=int(N * 0.5))
    door.rotation_euler = (-1.5, 0, 0)
    door.location = (0, -0.55, 1.12)
    door.keyframe_insert('rotation_euler', frame=int(N * 0.75))
    door.keyframe_insert('location', frame=int(N * 0.75))
    letter.keyframe_insert('location', frame=int(N * 0.6))
    letter.location = (0, -0.5, 1.45)
    letter.keyframe_insert('location', frame=N)
    cam = camera(lens=45)
    cam_key(cam, 1, (0.2, -2.0, 0.6), (1.9, 5, 1.4))
    cam_key(cam, N, (1.3, 1.6, 1.15), (1.9, 5, 1.35))


def s_run_out(N):
    night_base()
    mb, door, letter = mailbox('mb', (1.9, 5.0, 0.18), glow=True, flag_up=True)
    bpy.data.objects['mb_inner'].active_material = mat('#3DFF7A', emit=4, name='inner_glow')
    door.rotation_euler = (-1.5, 0, 0)
    door.location = (0, -0.55, 1.12)
    green_light((1.9, 4.2, 1.5), 90)
    point((-3, 0, 3), 260, (0.75, 0.8, 1.0), 'front')
    pip = Char('pip', **PJ, loc=(0, 6.4, 0.18), rot_z=math.pi * 0.25)
    arrive = int(N * 0.55)
    pip.walk(1, arrive, (-1.5, 6.6, 0.18), (1.0, 4.4, 0.18), speed=2.2, swing=0.9)
    pip.root.rotation_euler = (0, 0, math.radians(-50))
    pip.root.keyframe_insert('rotation_euler', frame=1)
    pip.root.rotation_euler = (0, 0, math.radians(-20))
    pip.root.keyframe_insert('rotation_euler', frame=arrive)
    pip.face(1, 'scared')
    pip.face(arrive + 6, 'shock')
    pip.hold_front(arrive + 8, True, -1.4)
    letter.keyframe_insert('location', frame=arrive + 4)
    letter.location = (0, -0.6, 1.5)
    letter.keyframe_insert('location', frame=arrive + 12)
    # front door open light
    point((0, 6.2, 1.5), 200, (1, 0.8, 0.5), 'doorlight')
    cam = camera(lens=30)
    cam_key(cam, 1, (-6.5, -1.5, 2.2), (-0.8, 6, 1.4))
    cam_key(cam, N, (-1.8, -0.4, 2.0), (1.4, 4.7, 1.6))


def s_letter_front(N):
    letter_set(N, front='TOMORROW,\nTHE WHOLE TOWN\nWILL\nDISAPPEAR.\n\nEXCEPT YOU.', shake=True, glow=900)


def s_town_vanish(N):
    houses = night_base(lights=True)
    pip = Char('pip', **PJ, loc=(1.0, 4.4, 0.18), rot_z=math.radians(160))
    pip.face(1, 'scared')
    pip.shake(1, N)
    small_letter('lt', pip.arms[1], (0, -0.2, -0.75))
    random.seed(7)
    for i, h in enumerate(sorted(houses, key=lambda h: abs(h.location.x))[::-1]):
        if h.name == 'pip_house':
            continue
        f0 = int(random.uniform(0.0, 0.8) * N)
        h.keyframe_insert('location', frame=f0)
        h.keyframe_insert('scale', frame=f0)
        h.location.z = -7
        h.scale = (0.6, 0.6, 0.2)
        h.keyframe_insert('location', frame=f0 + 14)
        h.keyframe_insert('scale', frame=f0 + 14)
    green_light((1, 3.6, 1.6), 200)
    cam = camera(lens=26)
    cam_key(cam, 1, (2.5, 0.9, 2.2), (-3, 12, 2.6))
    cam_key(cam, N, (3.0, 0.4, 4.2), (-3, 12, 1.8))


def s_letter_back(N):
    letter_set(N, front='TOMORROW,\nTHE WHOLE TOWN\nWILL\nDISAPPEAR.\n\nEXCEPT YOU.',
               back='YOU CAN\nSTOP IT.\n\nBUT YOU\nHAVE TO\nCHOOSE.', flip=True, glow=600)


def s_forest(N):
    world_sky(True)
    sun(True, energy=0.9)
    sky_deco(True)
    box('ground', (300, 300, 0.2), (0, 0, -0.1), mat('#24432C', rough=0.9), bevel=0)
    box('path', (2.4, 80, 0.05), (0, 30, 0.02), mat('#5A4632', rough=0.9), bevel=0)
    random.seed(13)
    for i in range(110):
        x = random.choice([-1, 1]) * random.uniform(2.2, 22)
        y = random.uniform(-4, 60)
        tree(f'ft{i}', (x, y, 0), s=random.uniform(1.0, 1.8), dark=True)
    fm = mat('#5CF2FF', emit=10)
    for i in range(26):
        f0 = int(i / 26 * N * 0.8)
        y = -1 + i * 1.3
        x = 0.25 * (1 if i % 2 else -1)
        fp = box(f'fp{i}', (0.3, 0.5, 0.03), (x, y, 0.06), fm, bevel=0)
        fp.scale = (0, 0, 0)
        fp.keyframe_insert('scale', frame=max(1, f0 - 1))
        fp.scale = (1, 1, 1)
        fp.keyframe_insert('scale', frame=f0 + 2)
    point((0, 4, 0.5), 120, (0.36, 0.95, 1.0), 'fpl1')
    point((0, 14, 0.5), 160, (0.36, 0.95, 1.0), 'fpl2')
    point((0, 26, 0.5), 200, (0.36, 0.95, 1.0), 'fpl3')
    cam = camera(lens=24)
    cam_key(cam, 1, (0.6, -6, 1.6), (0, 14, 1.0))
    cam_key(cam, N, (0.2, 6, 1.3), (0, 26, 1.2))


def s_grandma(N):
    world_sky(True)
    room(wall='#6E3F7A', floor='#8A5A3C', w=12, d=10, h=6)
    for i in range(-5, 6):
        box(f'stripe{i}', (0.25, 0.05, 6), (i * 1.1, 4.88, 3), mat('#7E4F8A'), bevel=0)
    box('chairseat', (2.0, 1.8, 0.6), (0, 2.6, 0.7), mat('#C24A4A'))
    box('chairback', (2.0, 0.5, 2.0), (0, 3.4, 1.6), mat('#C24A4A'))
    for sx in (-1, 1):
        box(f'chairarm{sx}', (0.4, 1.8, 0.9), (1.1 * sx, 2.6, 1.1), mat('#A93C3C'))
    gr = Char('ruby', skin='#EAB592', hair='#C9C9C9', top='#8C4FC9', legs='#8C4FC9', shoes='#5A3A22',
              loc=(0, 2.35, 0.55), glasses=True, bun=True, dress=True)
    for l in gr.legs:
        l.rotation_euler = (-math.pi / 2, 0, 0)
        l.keyframe_insert('rotation_euler', frame=1)
    for e in gr.eyes:
        e.scale = (1.1, 1, 0.15)
        e.keyframe_insert('scale', frame=1)
    gr.head.rotation_euler = (0.25, 0.15, 0)
    gr.head.keyframe_insert('rotation_euler', frame=1)
    for f in range(1, N + 1, 24):
        gr.body.location.z = 0.82
        gr.body.keyframe_insert('location', frame=f)
        gr.body.location.z = 0.86
        gr.body.keyframe_insert('location', frame=f + 12)
    zm = mat('#FFFFFF', emit=2)
    for i in range(4):
        z = text(f'z{i}', 'Z', (0.6, 2.0, 3.2), 0.35 + 0.1 * i, zm, extrude=0.05)
        f0 = 1 + i * 12
        z.scale = (0, 0, 0)
        z.keyframe_insert('scale', frame=f0)
        z.scale = (1, 1, 1)
        z.keyframe_insert('scale', frame=f0 + 6)
        z.keyframe_insert('location', frame=f0)
        z.location = (1.3 + 0.3 * i, 2.0, 4.6)
        z.keyframe_insert('location', frame=f0 + 40)
    box('lamp_base', (0.4, 0.4, 2.4), (2.6, 3.2, 1.2), mat('#3A2A1A'))
    cyl('lamp_shade', 0.5, 0.6, (2.6, 3.2, 2.6), mat('#FFD27A', emit=3))
    point((2.6, 2.8, 2.4), 600, (1, 0.75, 0.45), 'lamp')
    point((-1, -3, 4), 450, (0.85, 0.8, 1.0), 'fill')
    pip = Char('pip', **PJ, loc=(-2.6, 0.4, 0), rot_z=math.radians(-60))
    pip.walk(1, int(N * 0.7), (-3.8, -0.2, 0), (-2.2, 0.8, 0), speed=0.6, swing=0.35)
    pip.face(1, 'worried')
    cam = camera(lens=30)
    cam_key(cam, 1, (-1, -6.5, 2.6), (0, 2.4, 1.8))
    cam_key(cam, N, (0.2, -4.6, 2.3), (0, 2.4, 1.9))


def s_writing(N):
    world_sky(True)
    room(wall='#2C3266', floor='#7A4E35', w=12, d=10, h=6)
    box('desk', (3.2, 1.6, 0.15), (0, 1.2, 1.5), mat('#C98E5A'))
    for sx in (-1, 1):
        box(f'dleg{sx}', (0.15, 1.4, 1.5), (1.45 * sx, 1.2, 0.75), mat('#8A5A3C'))
    box('paper', (1.0, 1.3, 0.02), (0, 1.0, 1.59), mat('#FFF1CF'))
    text('dear', 'Dear Letter,\nPLEASE don\'t...', (0, 1.0, 1.61), 0.12, mat('#2A2340'), rot=(0, 0, 0), extrude=0)
    box('lampb', (0.3, 0.3, 0.9), (1.2, 1.5, 2.0), mat('#333333'))
    cyl('lamps', 0.3, 0.3, (1.2, 1.3, 2.5), mat('#FFD27A', emit=4))
    point((1.0, 1.0, 2.6), 160, (1, 0.8, 0.5), 'lamp')
    point((0, -3, 3.5), 40, (0.6, 0.7, 1.0), 'fill')
    pip = Char('pip', **PJ, loc=(0, 2.6, 0.45))
    for l in pip.legs:
        l.rotation_euler = (-math.pi / 2, 0, 0)
        l.keyframe_insert('rotation_euler', frame=1)
    pip.face(1, 'worried')
    pip.arms[0].rotation_euler = (-1.1, 0, 0)
    pip.arms[0].keyframe_insert('rotation_euler', frame=1)
    pc = empty('pencilp', (0, -0.1, -0.75), pip.arms[1])
    box('pencil', (0.06, 0.06, 0.6), (0, 0, -0.2), mat('#FFC928'), pc, bevel=0)
    for f in range(1, N + 1, 3):
        pip.arms[1].rotation_euler = (-1.15 + random.uniform(-0.06, 0.06), 0, random.uniform(-0.12, 0.12))
        pip.arms[1].keyframe_insert('rotation_euler', frame=f)
    pip.head.rotation_euler = (0.3, 0, 0)
    pip.head.keyframe_insert('rotation_euler', frame=1)
    cam = camera(lens=32)
    cam_key(cam, 1, (0.8, -3.2, 3.6), (0, 1.6, 1.9))
    cam_key(cam, N, (0.3, -1.8, 3.1), (0, 1.6, 2.0))


def s_final(N):
    night_base()
    mailbox('mb', (2.0, 5.0, 0.18), glow=True, flag_up=True)
    bpy.data.objects['mb_inner'].active_material = mat('#3DFF7A', emit=4, name='inner_glow')
    green_light((2.0, 4.2, 1.6), 80)
    pip = Char('pip', **PJ, loc=(0.6, 4.5, 0.18))
    pip.face(1, 'worried')
    pip.talk(1, int(N * 0.6))
    small_letter('lt', pip.arms[1], (0, -0.2, -0.75))
    pip.hold_front(1, both=False, angle=-0.9)
    pip.wave(int(N * 0.62), int(N * 0.8), arm=0)
    pip.face(int(N * 0.62), 'scared')
    pip.idle(1, N)
    point((0.6, 1.5, 3.2), 140)
    cam = camera(lens=30)
    cam_key(cam, 1, (-1.5, -4.0, 2.4), (0.8, 4.6, 1.9))
    cam_key(cam, N, (0.4, -0.6, 2.2), (0.7, 4.6, 2.05))


FUN = {n: globals()['s_' + n] for n, _, _ in SHOTS}


def render(idx, still=False, samples=6, res=(720, 1280)):
    name, t0, t1 = SHOTS[idx]
    N = max(2, round((t1 - t0) * FPS))
    reset()
    random.seed(idx)
    setup_render(res, samples, FPS)
    FUN[name](N)
    for l in bpy.data.lights:
        if l.type == 'POINT':
            l.use_shadow = False
    e = bpy.context.scene.eevee
    e.shadow_resolution_scale = 0.5
    e.shadow_ray_count = 1
    e.shadow_step_count = 2
    s = bpy.context.scene
    s.frame_start, s.frame_end = 1, N
    out = os.path.join(HERE, 'frames', f'{idx:02d}_{name}')
    os.makedirs(out, exist_ok=True)
    if still:
        s.frame_set(int(N * 0.7))
        s.render.filepath = os.path.join(HERE, 'stills', f'{idx:02d}_{name}.jpg')
        bpy.ops.render.render(write_still=True)
    else:
        s.render.filepath = out + '/'
        bpy.ops.render.render(animation=True)
    print('DONE', idx, name, N, flush=True)


if __name__ == '__main__':
    arg = sys.argv[1]
    still = '--still' in sys.argv
    sm = int(sys.argv[sys.argv.index('--samples') + 1]) if '--samples' in sys.argv else 6
    ids = range(len(SHOTS)) if arg == 'all' else [int(a) for a in arg.split(',')]
    for i in ids:
        render(i, still, sm)
