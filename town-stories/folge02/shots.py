"""Episode 2 shots. Usage: python shots.py <shot_index|all> [--still] [--samples N]"""
import sys, os, json, math, random
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'tools'))
sys.path.insert(0, os.path.join(HERE, '..', 'folge01'))
import bpy
from world import *
import shots as ep1
from shots import paper_letter, small_letter, green_light, point, linear, reset, letter_set, PJ

FPS = 24
TM = json.load(open(os.path.join(HERE, 'timings.json')))
L = TM['lines']


def T(i):
    return L[i]['start'] if i < len(L) else TM['total']


SHOTS = [
    ('forest_enter', 0, T(1)),
    ('forest_walk', T(1), T(2)),
    ('prints_close', T(2), T(3)),
    ('slippers', T(3), T(5)),
    ('owl', T(5), T(6)),
    ('pip_me', T(6), T(7)),
    ('clearing', T(7), T(8)),
    ('mailbox_forest', T(8), T(9)),
    ('name', T(9), T(10)),
    ('two_letters', T(10), T(11)),
    ('letter1', T(11), T(12)),
    ('letter1b', T(12), T(13)),
    ('knees', T(13), T(14)),
    ('crunch', T(14), T(15)),
    ('glow_feet', T(15), T(16)),
    ('opt1', T(16), T(17)),
    ('opt2', T(17), T(18)),
    ('opt3', T(18), T(19)),
    ('final', T(19), TM['total']),
]

CLEAR = (0.0, 30.0)  # clearing centre
BLUE = '#5CF2FF'


def forest(seed=13, path=True, clearing=True, n=150, moon=True):
    world_sky(True)
    bpy.context.scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.7
    sun(True, energy=0.8)
    if moon:
        sky_deco(True)
    box('ground', (300, 300, 0.2), (0, 0, -0.1), mat('#22402A', rough=0.9), bevel=0)
    if path:
        box('path', (2.4, 30, 0.05), (0, 10, 0.02), mat('#4E3E2C', rough=0.9), bevel=0)
    random.seed(seed)
    k = 0
    while k < n:
        x = random.uniform(-24, 24)
        y = random.uniform(-6, 60)
        if abs(x) < 2.3 and y < 25:
            continue
        if clearing and math.hypot(x - CLEAR[0], y - CLEAR[1]) < 7.5:
            continue
        tree(f'ft{k}', (x, y, 0), s=random.uniform(1.0, 1.9), dark=True)
        k += 1
    # mushrooms + grass tufts for detail
    for i in range(40):
        x, y = random.uniform(-10, 10), random.uniform(-4, 40)
        if abs(x) < 1.4:
            continue
        box(f'gr{i}', (0.3, 0.3, 0.25), (x, y, 0.12), mat('#2F6B3E', rough=0.9), bevel=0)
    for i in range(14):
        x, y = random.uniform(-6, 6), random.uniform(0, 36)
        if abs(x) < 1.4:
            continue
        cyl(f'mst{i}', 0.06, 0.25, (x, y, 0.12), mat('#EDE3D0'))
        cyl(f'mcap{i}', 0.18, 0.1, (x, y, 0.28), mat('#E04545', emit=0.4))


def bunny_print(name, loc, m, rot=0.0, scale=1.0):
    p = empty(name, loc)
    p.rotation_euler = (0, 0, rot)
    p.scale = (scale,) * 3
    box(name + '_sole', (0.32, 0.5, 0.03), (0, 0, 0), m, p, bevel=0)
    for sx in (-1, 1):
        box(f'{name}_ear{sx}', (0.08, 0.28, 0.03), (0.09 * sx, -0.38, 0), m, p, bevel=0, rot=(0, 0, 0.2 * sx))
    return p


def print_trail(prefix, start, end, count, f0, f1, m, appear=True, scale=1.0):
    sx, sy = start
    ex, ey = end
    ang = math.atan2(ey - sy, ex - sx) - math.pi / 2 + math.pi  # ears point in walking direction
    out = []
    for i in range(count):
        t = i / max(1, count - 1)
        x = sx + (ex - sx) * t
        y = sy + (ey - sy) * t
        side = 0.22 * (1 if i % 2 else -1)
        nx, ny = -(ey - sy), (ex - sx)
        ln = math.hypot(nx, ny) or 1
        p = bunny_print(f'{prefix}{i}', (x + side * nx / ln, y + side * ny / ln, 0.06), m, ang, scale)
        if appear:
            fa = int(f0 + (f1 - f0) * t)
            p.scale = (0, 0, 0)
            p.keyframe_insert('scale', frame=max(0, fa - 1))
            p.scale = (scale,) * 3
            p.keyframe_insert('scale', frame=fa + 1)
        out.append(p)
    return out


def bunny_slippers(c):
    W, P = mat('#F7F7F7', rough=0.8), mat('#FFB3C7', rough=0.8)
    for i, leg in enumerate(c.legs):
        sh = bpy.data.objects[f'{c.name}_shoe{-1 if i == 0 else 1}']
        for ex in (-1, 1):
            e = box(f'{c.name}_bear{i}{ex}', (0.09, 0.07, 0.32), (0.1 * ex, -0.22, 0.2), W, sh, bevel=0.02, rot=(-0.35, 0.15 * ex, 0))
            box(f'{c.name}_bin{i}{ex}', (0.05, 0.02, 0.22), (0, -0.04, 0.0), P, e, bevel=0)
        for ex in (-1, 1):
            box(f'{c.name}_beye{i}{ex}', (0.05, 0.02, 0.05), (0.08 * ex, -0.26, 0.04), mat('#141414'), sh, bevel=0)
        box(f'{c.name}_bnose{i}', (0.06, 0.02, 0.04), (0, -0.26, -0.03), P, sh, bevel=0)


def make_pip(loc, rot_z=0.0):
    c = Char('pip', **PJ, loc=loc, rot_z=rot_z)
    bunny_slippers(c)
    return c


def owl(name, loc, rot_z=0.0):
    p = empty(name, loc)
    p.rotation_euler = (0, 0, rot_z)
    B, Bl = mat('#7A5638', rough=0.8), mat('#C9A27A', rough=0.8)
    box(name + '_body', (0.9, 0.8, 1.1), (0, 0, 0.55), B, p, bevel=0.12)
    box(name + '_belly', (0.6, 0.05, 0.7), (0, -0.4, 0.45), Bl, p, bevel=0.05)
    hd = empty(name + '_hp', (0, 0, 1.1), p)
    box(name + '_head', (1.0, 0.85, 0.75), (0, 0, 0.35), B, hd, bevel=0.12)
    for sx in (-1, 1):
        box(f'{name}_tuft{sx}', (0.18, 0.18, 0.3), (0.38 * sx, 0, 0.82), B, hd, bevel=0.03, rot=(0, 0.3 * sx, 0))
        box(f'{name}_eyew{sx}', (0.34, 0.05, 0.34), (0.22 * sx, -0.43, 0.4), mat('#FFF3B0', emit=1.5), hd, bevel=0.04)
        box(f'{name}_pupil{sx}', (0.16, 0.04, 0.18), (0.22 * sx, -0.46, 0.4), mat('#141414'), hd, bevel=0)
        box(f'{name}_wing{sx}', (0.12, 0.6, 0.8), (0.5 * sx, 0.05, 0.6), mat('#5E412A'), p, bevel=0.05)
        box(f'{name}_foot{sx}', (0.18, 0.25, 0.08), (0.2 * sx, -0.25, 0.0), mat('#E0A030'), p, bevel=0)
    beak = empty(name + '_beakp', (0, -0.45, 0.2), hd)
    box(name + '_beak', (0.16, 0.18, 0.2), (0, -0.05, 0), mat('#E0A030'), beak, bevel=0.02)
    return p, hd, beak


def forest_mailbox(loc=(CLEAR[0], CLEAR[1], 0.0), open_door=False):
    mb, door, letter = mailbox('mb', loc, glow=True, flag_up=True)
    bpy.data.objects['mb_inner'].active_material = mat('#3DFF7A', emit=4, name='inner_glow')
    text('mbname', 'PIP', (loc[0] + 0.27, loc[1], loc[2] + 1.32), 0.22, mat('#FFFFFF', emit=1.5), rot=(math.pi / 2, 0, math.pi / 2), extrude=0.01)
    if open_door:
        door.rotation_euler = (-1.5, 0, 0)
        door.location = (0, -0.55, 1.12)
    gl = green_light((loc[0], loc[1] - 0.9, loc[2] + 1.5), 120, 'mbglow')
    # ring of moonlit fog stones around clearing
    for i in range(12):
        a = i / 12 * 2 * math.pi
        box(f'stone{i}', (0.5, 0.5, 0.3), (loc[0] + 6 * math.cos(a), loc[1] + 6 * math.sin(a), 0.15), mat('#6E6E7A', rough=0.9), bevel=0.1)
    return mb, door, letter, gl


# ------------------------------------------------------------------ shots
def s_forest_enter(N):
    forest()
    bm = mat(BLUE, emit=10)
    print_trail('fp', (0, -1), (0, 24), 22, 1, int(N * 0.5), bm, appear=True)
    point((0, 4, 0.5), 120, (0.36, 0.95, 1.0), 'fpl1')
    point((0, 14, 0.5), 160, (0.36, 0.95, 1.0), 'fpl2')
    pip = make_pip((0.4, -3.5, 0), rot_z=math.pi)
    pip.walk(int(N * 0.35), N, (0.4, -3.5, 0), (0.2, 0.5, 0), speed=1.2, swing=0.6)
    cam = camera(lens=26)
    cam_key(cam, 1, (1.2, -9, 1.8), (0, 10, 1.2))
    cam_key(cam, N, (0.8, -6.5, 1.7), (0, 12, 1.1))


def s_forest_walk(N):
    forest()
    bm = mat(BLUE, emit=10)
    print_trail('fp', (0, 0), (0, 22), 20, 0, 0, bm, appear=False)
    point((0, 6, 0.6), 160, (0.36, 0.95, 1.0), 'fpl1')
    pip = make_pip((0, 2, 0), rot_z=math.pi)
    pip.walk(1, N, (0.1, 2, 0), (0.1, 7.5, 0), speed=1.0, swing=0.55)
    pip.face(1, 'worried')
    pip.face(int(N * 0.7), 'deadpan')
    pip.head.rotation_euler = (0, 0, 0)
    pip.head.keyframe_insert('rotation_euler', frame=int(N * 0.65))
    pip.head.rotation_euler = (0, 0, math.radians(-70))
    pip.head.keyframe_insert('rotation_euler', frame=int(N * 0.75))
    point((-3, 4, 2.5), 90, (0.6, 0.7, 1.0), 'rim')
    cam = camera(lens=32)
    cam_key(cam, 1, (-4.5, 2.5, 1.9), (0, 3, 1.5))
    cam_key(cam, N, (-4.5, 7.5, 1.9), (0, 8, 1.5))


def s_prints_close(N):
    forest(n=90)
    bm = mat(BLUE, emit=10)
    print_trail('fp', (0, 0), (0, 14), 14, 0, 0, bm, appear=False)
    point((0, 2, 0.4), 60, (0.36, 0.95, 1.0), 'fpl1')
    cam = camera(lens=35)
    cam_key(cam, 1, (0.9, -1.8, 0.45), (0, 3, 0.0))
    cam_key(cam, N, (0.4, -0.6, 0.35), (0, 3, 0.0))


def s_slippers(N):
    forest(n=90)
    bm = mat(BLUE, emit=10)
    print_trail('fp', (0, 0), (0, 12), 12, 0, 0, bm, appear=False)
    pip = make_pip((0.75, 1.2, 0))
    pip.face(1, 'worried')
    pip.face(int((T(4) - T(3)) * FPS), 'deadpan')
    point((0.5, 0.2, 1.0), 60, (0.36, 0.95, 1.0), 'fpl1')
    point((0.75, -1.5, 2.2), 70, (0.7, 0.75, 1.0), 'face')
    cut = int((T(4) - T(3)) * FPS)
    cam = camera(lens=35)
    cam_key(cam, 1, (0.4, -1.2, 0.4), (0.5, 1.4, 0.1))
    cam_key(cam, cut - 6, (0.5, -1.0, 0.45), (0.6, 1.3, 0.15))
    cam_key(cam, cut + 6, (0.75, -1.6, 2.2), (0.75, 1.2, 2.05))
    cam_key(cam, N, (0.75, -1.0, 2.2), (0.75, 1.2, 2.1))


def s_owl(N):
    forest(n=60, path=False)
    box('branch', (4, 0.35, 0.35), (0, 3, 3.0), mat('#4A2E1A'), bevel=0.05)
    o, hd, beak = owl('owl', (0.3, 3, 3.17))
    for f, r in ((1, 0), (int(N * 0.25), 0.45), (int(N * 0.45), 0.45), (int(N * 0.55), -0.2), (N, -0.2)):
        hd.rotation_euler = (0, r, 0)
        hd.keyframe_insert('rotation_euler', frame=f)
    hoot = int(N * 0.55)
    for f in range(hoot, min(N, hoot + 24), 4):
        beak.scale = (1, 1, 1.6 if (f // 4) % 2 == 0 else 1)
        beak.keyframe_insert('scale', frame=f)
    point((0.3, 1.2, 4.2), 120, (0.7, 0.8, 1.0), 'moonfill')
    cam = camera(lens=45)
    cam_key(cam, 1, (0.3, -2.0, 3.6), (0.3, 3, 4.2))
    cam_key(cam, N, (0.3, -0.2, 4.0), (0.3, 3, 4.3))


def s_pip_me(N):
    forest(n=80)
    pip = make_pip((0, 2, 0))
    pip.face(1, 'deadpan')
    pip.talk(int(N * 0.1), int(N * 0.6))
    for i, a in enumerate(pip.arms):
        a.rotation_euler = (0, 0, 0)
        a.keyframe_insert('rotation_euler', frame=int(N * 0.2))
        a.rotation_euler = (0, 0, 0.9 * (1 if i else -1))
        a.keyframe_insert('rotation_euler', frame=int(N * 0.35))
    pip.head.rotation_euler = (-0.35, 0, 0)
    pip.head.keyframe_insert('rotation_euler', frame=1)
    point((0, -0.5, 4), 110, (0.7, 0.8, 1.0), 'face')
    point((0, 1.4, 0.5), 50, (0.36, 0.95, 1.0), 'fp')
    cam = camera(lens=30)
    cam_key(cam, 1, (0, -1.2, 4.6), (0, 2, 2.0))
    cam_key(cam, N, (0, -0.4, 4.2), (0, 2, 2.0))


def s_clearing(N):
    forest()
    bm = mat(BLUE, emit=10)
    print_trail('fp', (0, 16), (0, 27), 10, 0, 0, bm, appear=False)
    forest_mailbox()
    pip = make_pip((0, 20, 0), rot_z=math.pi)
    pip.walk(1, int(N * 0.7), (0, 18, 0), (0, 22.5, 0), speed=0.8, swing=0.5)
    point((0, 30, 8), 400, (0.6, 0.7, 1.0), 'moonbeam')
    cam = camera(lens=24)
    cam_key(cam, 1, (2.0, 13.5, 1.2), (0, 30, 1.6))
    cam_key(cam, N, (3.0, 14.5, 6.5), (0, 30, 0.5))


def s_mailbox_forest(N):
    forest(n=110)
    forest_mailbox()
    gl = bpy.data.objects['mbglow']
    for f in range(1, N + 1, 6):
        gl.data.energy = 90 + 60 * (1 + math.sin(f / 3))
        gl.data.keyframe_insert('energy', frame=f)
    cam = camera(lens=40)
    cam_key(cam, 1, (-0.8, 25.5, 0.9), (0, 30, 1.4))
    cam_key(cam, N, (-0.3, 27.8, 1.3), (0, 30, 1.4))


def s_name(N):
    forest(n=80)
    forest_mailbox()
    cam = camera(lens=55)
    cam_key(cam, 1, (2.2, 28.6, 1.5), (0.27, 30, 1.32))
    cam_key(cam, N, (1.5, 29.2, 1.4), (0.27, 30, 1.32))


def s_two_letters(N):
    forest(n=80)
    mb, door, letter, gl = forest_mailbox()
    o = int(N * 0.15)
    door.keyframe_insert('rotation_euler', frame=o)
    door.keyframe_insert('location', frame=o)
    door.rotation_euler = (-1.5, 0, 0)
    door.location = (0, -0.55, 1.12)
    door.keyframe_insert('rotation_euler', frame=o + 8)
    door.keyframe_insert('location', frame=o + 8)
    lm = mat('#FFF1CF', rough=0.85)
    for k, dx in enumerate((-0.18, 0.18)):
        lt = empty(f'lt{k}', (dx, 29.7, 1.3))
        box(f'lt{k}_p', (0.36, 0.03, 0.26), (0, 0, 0), lm, lt, bevel=0)
        text(f'lt{k}_n', str(k + 1), (0, -0.02, 0), 0.16, mat('#2FCF63', emit=3), lt, extrude=0)
        lt.keyframe_insert('location', frame=o + 6)
        lt.location = (dx * 3, 29.3, 1.9 + 0.1 * k)
        lt.rotation_euler = (0, 0.25 * (1 if k else -1), 0)
        lt.keyframe_insert('location', frame=N)
        lt.keyframe_insert('rotation_euler', frame=N)
    pip = make_pip((0.9, 28.3, 0), rot_z=math.radians(-30))
    pip.face(1, 'shock')
    cam = camera(lens=35)
    cam_key(cam, 1, (-1.2, 26.4, 1.7), (0.1, 30, 1.6))
    cam_key(cam, N, (-0.8, 27.2, 1.8), (0.1, 30, 1.75))


def s_letter1(N):
    letter_set(N, front="HI PIP.\n\nIT'S ME.\nYOU.\n\nFROM\nTOMORROW.", glow=420)


def s_letter1b(N):
    letter_set(N, front="HI PIP.\n\nIT'S ME.\nYOU.\n\nFROM\nTOMORROW.",
               back="DON'T TRUST\nTHE LETTERS\nFROM THE\nTOWN.\n\nTHEY ARE\nLYING.", flip=True, shake=True, glow=700)


def s_knees(N):
    forest(n=110)
    forest_mailbox(open_door=True)
    pip = make_pip((0.6, 28.4, 0))
    pip.face(1, 'scared')
    pip.shake(1, N, 0.1)
    for f in range(1, N + 1, 2):
        for i, l in enumerate(pip.legs):
            l.rotation_euler = (0, (0.06 if (f // 2) % 2 else -0.06) * (1 if i else -1), 0)
            l.keyframe_insert('rotation_euler', frame=f)
    turn = int(N * 0.7)
    pip.head.keyframe_insert('rotation_euler', frame=turn)
    pip.head.rotation_euler = (0, 0, math.radians(55))
    pip.head.keyframe_insert('rotation_euler', frame=turn + 5)
    pip.face(turn + 2, 'shock')
    point((0.6, 26.5, 2.2), 90, (0.7, 0.8, 1.0), 'face')
    cam = camera(lens=40)
    cam_key(cam, 1, (0.6, 25.0, 0.8), (0.6, 28.4, 1.3))
    cam_key(cam, N, (0.6, 26.0, 1.4), (0.6, 28.4, 1.8))


def s_crunch(N):
    forest(n=140)
    forest_mailbox(open_door=True)
    pip = make_pip((0.4, 28.6, 0), rot_z=math.pi)
    pip.shake(1, N, 0.05)
    bm = mat(BLUE, emit=12)
    print_trail('ap', (-0.4, 40), (0.3, 33.0), 7, int(N * 0.05), int(N * 0.95), bm, appear=True, scale=1.15)
    point((0, 36, 0.6), 80, (0.36, 0.95, 1.0), 'apl')
    cam = camera(lens=35)
    for f in range(1, N + 1, 8):
        cam_key(cam, f, (0.9 + random.uniform(-0.03, 0.03), 26.9 + f * 0.004, 1.9), (-0.1, 36, 0.8))


def s_glow_feet(N):
    forest(n=140)
    bm = mat(BLUE, emit=12)
    print_trail('ap', (0.0, 40), (0.0, 34.5), 6, 0, 0, bm, appear=False, scale=1.15)
    # mysterious second pair of glowing bunny slippers stepping into frame (only feet visible)
    feet = empty('feet', (0, 35.5, 0))
    for sx in (-1, 1):
        sh = box(f'gf{sx}', (0.38, 0.5, 0.18), (0.2 * sx, 0, 0.09), mat(BLUE, emit=6), feet, bevel=0.03)
        for ex in (-1, 1):
            box(f'gfe{sx}{ex}', (0.09, 0.07, 0.32), (0.1 * ex, -0.22, 0.2), mat(BLUE, emit=8), sh, bevel=0.02, rot=(-0.35, 0, 0))
        box(f'gleg{sx}', (0.36, 0.38, 1.4), (0.2 * sx, 0.05, 0.85), mat('#0A0F1E', rough=1), feet, bevel=0.03)
    feet.location = (0, 37.5, 0)
    feet.keyframe_insert('location', frame=1)
    for k, f in enumerate(range(1, N, max(6, N // 4))):
        feet.location = (0, 37.5 - k * 0.6, 0.15 if k % 2 else 0)
        feet.keyframe_insert('location', frame=f)
    point((0, 34, 0.5), 100, (0.36, 0.95, 1.0), 'apl')
    cam = camera(lens=32)
    cam_key(cam, 1, (0.3, 31.0, 0.35), (0, 37, 0.5))
    cam_key(cam, N, (0.3, 31.6, 0.3), (0, 37, 0.5))


def s_opt1(N):
    forest(n=120)
    forest_mailbox(open_door=True)
    pip = make_pip((0.4, 28.6, 0))
    pip.face(1, 'scared')
    pip.head.rotation_euler = (0, 0, 0)
    pip.head.keyframe_insert('rotation_euler', frame=1)
    pip.head.rotation_euler = (0, 0, math.radians(80))
    pip.head.keyframe_insert('rotation_euler', frame=N)
    point((0.4, 26.5, 2.4), 90, (0.7, 0.8, 1.0), 'face')
    cam = camera(lens=45)
    cam_key(cam, 1, (0.4, 25.8, 2.1), (0.4, 28.6, 2.05))
    cam_key(cam, N, (0.4, 26.6, 2.1), (0.4, 28.6, 2.1))


def s_opt2(N):
    world_sky(True)
    sun(True, energy=0.9)
    sky_deco(True)
    make_town(night=True, lights=True)
    random.seed(5)
    for i in range(40):
        x = random.uniform(-14, 14)
        y = random.uniform(-36, -18)
        if abs(x) < 2.5:
            continue
        tree(f'ot{i}', (x, y, 0), s=random.uniform(1.2, 1.9), dark=True)
    box('opath', (2.4, 20, 0.05), (0, -14, 0.03), mat('#4E3E2C', rough=0.9), bevel=0)
    cam = camera(lens=30)
    cam_key(cam, 1, (0.5, -30, 1.7), (0, 8, 2.5))
    cam_key(cam, N, (0.2, -22, 1.7), (0, 8, 2.5))


def s_opt3(N):
    world_sky(True)
    bpy.context.scene.world.node_tree.nodes['Background'].inputs['Color'].default_value = hexcol('#0B1028')
    lt = empty('L2', (0, 0, 2.5))
    box('L2p', (2.6, 0.06, 1.8), (0, 0, 0), mat('#FFF1CF', rough=0.85), lt, bevel=0.02)
    text('L2n', '2', (0, -0.05, 0.1), 1.0, mat('#2FCF63', emit=5), lt, extrude=0.02)
    for sx in (-1, 1):
        box(f'flap{sx}', (1.5, 0.02, 0.06), (0.6 * sx, -0.04, 0.45), mat('#E8D7B0'), lt, bevel=0, rot=(0, 0.6 * sx, 0))
    green_light((0, -1.5, 2.0), 380, 'g')
    random.seed(4)
    sm = mat('#7DFFA6', emit=6)
    for i in range(30):
        s = box(f'sp{i}', (0.05, 0.05, 0.05), (random.uniform(-3, 3), random.uniform(-1, 3), random.uniform(0, 5)), sm, bevel=0)
        s.keyframe_insert('location', frame=1)
        s.location.z += 1.2
        s.keyframe_insert('location', frame=N)
    lt.rotation_euler = (0.1, 0, -0.15)
    lt.keyframe_insert('rotation_euler', frame=1)
    lt.rotation_euler = (-0.05, 0, 0.1)
    lt.keyframe_insert('rotation_euler', frame=N)
    cam = camera(lens=40)
    cam_key(cam, 1, (0, -7.0, 2.6), (0, 0, 2.5))
    cam_key(cam, N, (0, -5.6, 2.55), (0, 0, 2.5))


def s_final(N):
    forest(n=140)
    forest_mailbox(open_door=True)
    pip = make_pip((0.9, 27.6, 0))
    pip.face(1, 'scared')
    pip.talk(1, int(N * 0.6))
    small_letter('lt', pip.arms[1], (0, -0.2, -0.75))
    pip.hold_front(1, both=False, angle=-0.9)
    pip.wave(int(N * 0.6), int(N * 0.8), arm=0)
    pip.idle(1, N)
    bm = mat(BLUE, emit=12)
    print_trail('ap', (-0.5, 40), (0.4, 31.0), 9, int(N * 0.05), int(N * 0.9), bm, appear=True, scale=1.15)
    point((0.9, 25.5, 2.4), 110, (0.7, 0.8, 1.0), 'face')
    point((0, 34, 0.6), 80, (0.36, 0.95, 1.0), 'apl')
    cam = camera(lens=30)
    cam_key(cam, 1, (-0.6, 21.5, 2.2), (0.6, 29, 1.8))
    cam_key(cam, N, (0.5, 24.6, 2.1), (0.8, 29, 1.95))


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
        os.makedirs(os.path.join(HERE, 'stills'), exist_ok=True)
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
