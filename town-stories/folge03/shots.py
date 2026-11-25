"""Episode 3 shots. Usage: python shots.py <shot_index|all> [--still] [--samples N]"""
import sys, os, json, math, random, importlib.util
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..')
sys.path.insert(0, os.path.join(ROOT, 'tools'))
sys.path.insert(0, os.path.join(ROOT, 'folge01'))
import bpy
from world import *
from shots import paper_letter, small_letter, green_light, point, linear, reset, letter_set, room, PJ, PIP, pancake

_spec = importlib.util.spec_from_file_location('ep2shots', os.path.join(ROOT, 'folge02', 'shots.py'))
ep2 = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(ep2)
forest, print_trail, bunny_slippers, owl, make_pip, BLUE = ep2.forest, ep2.print_trail, ep2.bunny_slippers, ep2.owl, ep2.make_pip, ep2.BLUE

FPS = 24
TM = json.load(open(os.path.join(HERE, 'timings.json')))
L = TM['lines']


def T(i):
    return L[i]['start'] if i < len(L) else TM['total']


def F(sec):
    return max(1, int(sec * FPS))


SHOTS = [
    ('run_forest', 0, T(1)),
    ('owl_yell', T(1), T(2)),
    ('chase', T(2), T(3)),
    ('house_lights', T(3), T(4)),
    ('wait', T(4), T(5)),
    ('door_open', T(5), T(6)),
    ('kitchen', T(6), T(7)),
    ('someone', T(7), T(8)),
    ('details', T(8), T(9)),
    ('its_me', T(9), T(10)),
    ('finally', T(10), T(11)),
    ('scream', T(11), T(12)),
    ('letter3', T(12), T(13)),
    ('never_back', T(13), T(14)),
    ('steps_stop', T(14), T(15)),
    ('knock', T(15), T(16)),
    ('opt1', T(16), T(17)),
    ('opt2', T(17), T(18)),
    ('opt3', T(18), T(19)),
    ('final', T(19), TM['total']),
]

PM = dict(emit=6)


def make_pip2(loc, rot_z=0.0):
    c = Char('pip2', **PIP, loc=loc, rot_z=rot_z)
    bunny_slippers(c)
    return c


def cat(name, loc, rot_z=0.0):
    p = empty(name, loc)
    p.rotation_euler = (0, 0, rot_z)
    G, D = mat('#8E8E9A', rough=0.8), mat('#6A6A75', rough=0.8)
    box(name + '_body', (0.5, 0.9, 0.45), (0, 0.1, 0.45), G, p, bevel=0.08)
    hd = empty(name + '_hp', (0, -0.42, 0.75), p)
    box(name + '_head', (0.5, 0.45, 0.42), (0, 0, 0), G, hd, bevel=0.08)
    eyes = []
    for sx in (-1, 1):
        box(f'{name}_ear{sx}', (0.12, 0.08, 0.18), (0.16 * sx, 0.05, 0.27), D, hd, bevel=0, rot=(0, 0.2 * sx, 0))
        eyes.append(box(f'{name}_eye{sx}', (0.09, 0.03, 0.11), (0.11 * sx, -0.23, 0.05), mat('#F2E14C', emit=1.5), hd, bevel=0))
        for sy in (-1, 1):
            box(f'{name}_leg{sx}{sy}', (0.12, 0.12, 0.3), (0.16 * sx, 0.1 + 0.3 * sy, 0.15), G, p, bevel=0)
    box(name + '_nose', (0.06, 0.03, 0.04), (0, -0.24, -0.04), mat('#FF9AAE'), hd, bevel=0)
    tail = empty(name + '_tp', (0, 0.55, 0.55), p)
    box(name + '_tail', (0.08, 0.08, 0.6), (0, 0, 0.28), D, tail, bevel=0, rot=(0.4, 0, 0))
    return p, hd, tail, eyes


def kitchen(lights=True, door_glow=False):
    world_sky(True)
    room(wall='#E8C98F', floor='#B9855A', w=12, d=10, h=5.5, night=False)
    for i in range(-6, 6):
        for j in range(-5, 5):
            if (i + j) % 2 == 0:
                box(f'tile{i}_{j}', (1, 1, 0.01), (i + 0.5, j + 0.5, 0.01), mat('#F4EBDD', rough=0.6), bevel=0)
    # counter + fridge + window
    box('counter', (5, 1.0, 1.2), (2.5, 4.4, 0.6), mat('#7FB3D9'))
    box('countertop', (5.2, 1.1, 0.12), (2.5, 4.4, 1.26), mat('#F4F4F4'))
    box('fridge', (1.4, 1.0, 3.0), (-4.6, 4.4, 1.5), mat('#F0F0F0', rough=0.3))
    box('fridgeh', (0.1, 0.1, 0.8), (-4.0, 3.85, 2.0), mat('#888888', metal=1), bevel=0)
    box('winframe', (2.4, 0.2, 1.8), (2.5, 4.92, 3.1), mat('#FFFFFF'))
    box('winsky', (2.1, 0.1, 1.5), (2.5, 4.85, 3.1), mat('#1A2A66', emit=1.2))
    sphere('winmoon', 0.25, (3.2, 4.78, 3.5), mat('#FFF6D8', emit=8), seg=12)
    text('clock', '4:00', (-1.5, 4.85, 4.0), 0.4, mat('#2A2340'), extrude=0.0)
    cyl('clockface', 0.55, 0.05, (-1.5, 4.88, 4.0), mat('#FFFFFF'), rot=(math.pi / 2, 0, 0))
    # front door on left wall
    box('doorframe', (0.15, 1.5, 2.6), (-5.92, -1.5, 1.3), mat('#FFFFFF'))
    door = box('kdoor', (0.12, 1.25, 2.4), (-5.85, -1.5, 1.2), mat('#7A4A2A'))
    box('kdoorknob', (0.08, 0.1, 0.1), (-5.75, -2.0, 1.2), mat('#FFD54A', metal=1), bevel=0)
    under = None
    if door_glow:
        under = box('underdoor', (0.05, 1.2, 0.04), (-5.8, -1.5, 0.03), mat(BLUE, emit=18), bevel=0)
        point((-5.4, -1.5, 0.15), 60, (0.36, 0.95, 1.0), 'underl')
    # table + chairs
    box('table', (2.6, 1.6, 0.12), (0, 1.0, 1.3), mat('#C98E5A'))
    for sx in (-1, 1):
        for sy in (-1, 1):
            box(f'tl{sx}{sy}', (0.12, 0.12, 1.25), (1.1 * sx, 1.0 + 0.6 * sy, 0.62), mat('#8A5A3C'), bevel=0)
    for k, (x, y) in enumerate(((0, 2.2), (0, -0.2))):
        box(f'chair{k}', (0.9, 0.9, 0.1), (x, y, 0.8), mat('#E25D5D'))
        if k == 0:
            box(f'chairb{k}', (0.9, 0.1, 1.0), (x, y + 0.45, 1.3), mat('#E25D5D'))
    # pancakes + cereal
    pm, bm = mat('#E9B565', rough=0.6), mat('#FFF07A', rough=0.3)
    for i in range(6):
        p = pancake(f'pk{i}', pm, bm)
        p.location = (0.6, 1.0, 1.42 + i * 0.13)
        p.scale = (0.7, 0.7, 1)
    cyl('bowl', 0.28, 0.16, (-0.3, 1.5, 1.44), mat('#4A90E2'))
    cyl('milk', 0.25, 0.02, (-0.3, 1.5, 1.52), mat('#FFFFFF'))
    box('cerealbox', (0.5, 0.25, 0.75), (-0.9, 1.4, 1.75), mat('#FFC928'))
    text('cerealtxt', 'CRUNCH\nO\'S', (-0.9, 1.26, 1.8), 0.11, mat('#E23B3B'), extrude=0)
    # lamp
    box('lampcord', (0.04, 0.04, 1.6), (0, 1.0, 4.7), mat('#222222'), bevel=0)
    cyl('lampshade', 0.5, 0.35, (0, 1.0, 3.8), mat('#FFD27A', emit=4 if lights else 0))
    if lights:
        point((0, 1.0, 3.5), 420, (1, 0.82, 0.55), 'lamp')
        point((0, -4, 3.5), 260, (1, 0.9, 0.8), 'fill')
    else:
        point((0, -4, 3.5), 60, (0.6, 0.7, 1.0), 'fill')
    return door, under


def house_street(lit=True):
    world_sky(True)
    sun(True)
    sky_deco(True)
    make_town(night=True, lights=True)
    # all windows of Pip's house extra bright
    for o in bpy.data.objects:
        if o.name.startswith('pip_house_win'):
            o.active_material = mat('#FFE08A', emit=9, name='pipwin')
    point((0, 6.0, 2.0), 260, (1, 0.8, 0.5), 'housel')


# ------------------------------------------------------------------ shots
def s_run_forest(N):
    forest(clearing=False)
    pip = make_pip((0, 14, 0))
    pip.face(1, 'scared')
    pip.walk(1, N, (0, 14, 0), (0, 2, 0), speed=2.4, swing=1.0)
    cam = camera(lens=28)
    cam_key(cam, 1, (0.6, 9.5, 1.6), (0, 15, 1.5))
    cam_key(cam, N, (0.6, -2.5, 1.6), (0, 3, 1.5))
    point((0, 8, 3), 90, (0.6, 0.7, 1.0), 'face')


def s_owl_yell(N):
    forest(clearing=False, n=90)
    box('branch', (4, 0.35, 0.35), (-1.8, 3, 3.0), mat('#4A2E1A'), bevel=0.05)
    o, hd, beak = owl('owl', (-1.5, 3, 3.17), rot_z=math.radians(25))
    for f in range(1, N, 4):
        beak.scale = (1, 1, 1.7 if (f // 4) % 2 == 0 else 1)
        beak.keyframe_insert('scale', frame=f)
    hd.rotation_euler = (0, 0, 0)
    hd.keyframe_insert('rotation_euler', frame=1)
    hd.rotation_euler = (0, 0, math.radians(-80))
    hd.keyframe_insert('rotation_euler', frame=N)
    pip = make_pip((3, 6, 0), rot_z=math.radians(-90))
    pip.face(1, 'scared')
    pip.walk(1, N, (-3, 6, 0), (5, 6, 0), speed=2.4, swing=1.0)
    pip.root.rotation_euler = (0, 0, math.radians(90))
    pip.root.keyframe_insert('rotation_euler', frame=1)
    point((-1.5, 1.2, 4.2), 120, (0.7, 0.8, 1.0), 'moonfill')
    cam = camera(lens=32)
    cam_key(cam, 1, (-1.2, -2.6, 3.2), (-1.3, 3, 3.5))
    cam_key(cam, N, (-0.6, -2.4, 3.0), (-0.6, 3, 3.0))


def s_chase(N):
    forest(clearing=False)
    bm = mat(BLUE, **PM)
    print_trail('ch', (0, 20), (0, 9), 10, 1, N, bm, appear=True, scale=1.15)
    pip = make_pip((0, 8, 0), rot_z=math.pi)
    pip.walk(1, N, (0, 6, 0), (0, -2, 0), speed=2.4, swing=1.0)
    pip.root.rotation_euler = (0, 0, 0)
    pip.root.keyframe_insert('rotation_euler', frame=1)
    point((0, 14, 0.6), 120, (0.36, 0.95, 1.0), 'chl')
    cam = camera(lens=26)
    cam_key(cam, 1, (1.0, 11.0, 1.5), (0, 5, 0.9))
    cam_key(cam, N, (1.0, 3.5, 1.5), (0, -2, 0.9))
    point((0, 4, 3), 160, (0.6, 0.7, 1.0), 'fill')


def s_house_lights(N):
    house_street()
    pip = make_pip((-1.0, -2.5, 0.0), rot_z=math.pi)
    pip.walk(1, int(N * 0.6), (-4.0, -3.5, 0.0), (-0.8, -1.4, 0.0), speed=2.0, swing=0.9)
    pip.root.rotation_euler = (0, 0, math.radians(150))
    pip.root.keyframe_insert('rotation_euler', frame=1)
    cam = camera(lens=26)
    cam_key(cam, 1, (-2.5, -3.0, 1.8), (0, 8.5, 2.6))
    cam_key(cam, N, (-1.6, -1.8, 1.8), (0, 8.5, 2.8))


def s_wait(N):
    house_street()
    pip = make_pip((0.0, 3.0, 0.18))
    pip.face(1, 'worried')
    pip.face(int(N * 0.45), 'shock')
    pip.talk(1, int(N * 0.8))
    point((0, 0.5, 2.4), 120, (0.7, 0.8, 1.0), 'face')
    cam = camera(lens=45)
    cam_key(cam, 1, (0.0, -0.6, 2.2), (0, 3.0, 2.05))
    cam_key(cam, N, (0.0, 0.6, 2.15), (0, 3.0, 2.1))


def s_door_open(N):
    house_street()
    door = bpy.data.objects['pip_house_door']
    o = int(N * 0.25)
    door.keyframe_insert('rotation_euler', frame=o)
    door.keyframe_insert('location', frame=o)
    door.rotation_euler = (0, 0, math.radians(-75))
    door.location = (0.38, -2.4, 0.8)
    door.keyframe_insert('rotation_euler', frame=N)
    door.keyframe_insert('location', frame=N)
    box('doorhole', (0.85, 0.05, 1.55), (0, 6.5, 0.8), mat('#FFD9A0', emit=6), bevel=0)
    pip = make_pip((1.2, 5.6, 0.18), rot_z=math.radians(200))
    pip.hold_front(1, both=False, angle=-1.4)
    cam = camera(lens=30)
    cam_key(cam, 1, (-1.4, 2.0, 1.7), (0.3, 6.5, 1.3))
    cam_key(cam, N, (-1.0, 3.2, 1.6), (0.3, 6.5, 1.2))


def s_kitchen(N):
    kitchen()
    random.seed(3)
    sm = mat('#FFFFFF', emit=0.5, alpha=1.0)
    for i in range(8):
        s = box(f'steam{i}', (0.12, 0.12, 0.12), (0.6 + random.uniform(-0.2, 0.2), 1.0, 2.2), sm, bevel=0)
        f0 = 1 + i * max(1, N // 8)
        s.scale = (1, 1, 1)
        s.keyframe_insert('location', frame=f0)
        s.keyframe_insert('scale', frame=f0)
        s.location.z += 1.4
        s.scale = (0, 0, 0)
        s.keyframe_insert('location', frame=f0 + 30)
        s.keyframe_insert('scale', frame=f0 + 30)
    cam = camera(lens=26)
    cam_key(cam, 1, (-4.5, -4.2, 3.0), (0, 1.5, 1.6))
    cam_key(cam, N, (-3.0, -2.8, 2.6), (0.3, 1.0, 1.6))


def seat(c, z=0.85):
    for l in c.legs:
        l.rotation_euler = (-math.pi / 2, 0, 0)
        l.keyframe_insert('rotation_euler', frame=1)
    c.root.location.z = 0.0


def spoon_eat(c, f0, f1):
    sp = empty('spoonp', (0, -0.15, -0.72), c.arms[1])
    box('spoon', (0.06, 0.06, 0.45), (0, 0, -0.1), mat('#CCCCCC', metal=1, rough=0.2), sp, bevel=0)
    for f in range(f0, f1 + 1, 10):
        c.arms[1].rotation_euler = (-1.0 if (f // 10) % 2 == 0 else -1.9, 0, 0)
        c.arms[1].keyframe_insert('rotation_euler', frame=f)


def s_someone(N):
    kitchen()
    p2 = make_pip2((0, -0.15, 0.0), rot_z=math.pi)
    seat(p2)
    spoon_eat(p2, 1, N)
    cam = camera(lens=28)
    cam_key(cam, 1, (-4.8, -4.4, 2.4), (-0.3, 0.2, 1.7))
    cam_key(cam, N, (-3.9, -3.6, 2.3), (-0.2, 0.2, 1.8))


def s_details(N):
    kitchen()
    p2 = make_pip2((0, -0.15, 0.0), rot_z=math.pi)
    seat(p2)
    spoon_eat(p2, 1, N)
    a, b = int(N * 0.33), int(N * 0.66)
    cam = camera(lens=45)
    cam_key(cam, 1, (0.8, -1.7, 1.8), (0, -0.15, 1.5))         # hoodie
    cam_key(cam, a, (0.6, -1.4, 1.9), (0, -0.15, 1.6))
    cam_key(cam, a + 4, (0.6, -1.4, 2.7), (0, -0.15, 2.5))     # hair
    cam_key(cam, b, (0.5, -1.2, 2.7), (0, -0.15, 2.5))
    cam_key(cam, b + 4, (1.5, 0.0, 0.95), (0.0, 0.75, 0.8))   # slippers
    cam_key(cam, N, (1.2, 0.2, 0.9), (0.0, 0.75, 0.8))


def s_its_me(N):
    kitchen()
    p2 = make_pip2((0, -0.15, 0.0), rot_z=math.pi)
    seat(p2)
    p2.face(1, 'deadpan')
    p2.root.keyframe_insert('rotation_euler', frame=int(N * 0.15))
    p2.root.rotation_euler = (0, 0, math.radians(355))
    p2.root.keyframe_insert('rotation_euler', frame=int(N * 0.4))
    point((0, -2.5, 2.8), 140, (1, 0.9, 0.8), 'face')
    cam = camera(lens=40)
    cam_key(cam, 1, (-0.3, -3.2, 2.2), (0, -0.15, 2.0))
    cam_key(cam, N, (-0.15, -2.2, 2.15), (0, -0.15, 2.05))


def s_finally(N):
    kitchen()
    p2 = make_pip2((0, 2.15, 0.0))
    seat(p2)
    p2.face(1, 'deadpan')
    p2.talk(int(N * 0.15), int(N * 0.85))
    spoon_eat(p2, 1, int(N * 0.15))
    point((0, -0.5, 2.8), 140, (1, 0.9, 0.8), 'face')
    cam = camera(lens=45)
    cam_key(cam, 1, (0.2, -1.0, 2.2), (0, 2.15, 2.0))
    cam_key(cam, N, (0.1, 0.2, 2.15), (0, 2.15, 2.05))


def s_scream(N):
    kitchen()
    p2 = make_pip2((0.6, 2.15, 0.0))
    seat(p2)
    pip = make_pip((-1.2, -0.4, 0), rot_z=math.radians(10))
    for c in (pip, p2):
        c.face(1, 'shock')
        c.arms[0].rotation_euler = (0, 0, -2.6)
        c.arms[1].rotation_euler = (0, 0, 2.6)
        for a in c.arms:
            a.keyframe_insert('rotation_euler', frame=1)
    pip.jump(1, int(N * 0.4), h=0.4, period=8)
    k, hd, tail, eyes = cat('cat', (2.6, 4.2, 1.32), rot_z=math.radians(200))
    cf = int(N * 0.55)
    k.scale = (0, 0, 0)
    k.keyframe_insert('scale', frame=cf - 4)
    k.scale = (1, 1, 1)
    k.keyframe_insert('scale', frame=cf - 3)
    k.keyframe_insert('location', frame=cf)
    k.location.z = 2.6
    k.keyframe_insert('location', frame=cf + 5)
    k.location.z = 1.32
    k.keyframe_insert('location', frame=cf + 12)
    tail.rotation_euler = (0.4, 0, 0)
    tail.keyframe_insert('rotation_euler', frame=cf)
    tail.rotation_euler = (0, 0, 0)
    tail.keyframe_insert('rotation_euler', frame=cf + 3)
    for e in eyes:
        e.scale = (1, 1, 1)
        e.keyframe_insert('scale', frame=cf)
        e.scale = (1.5, 1, 1.7)
        e.keyframe_insert('scale', frame=cf + 3)
    cam = camera(lens=24)
    for f in range(1, N + 1, 2):
        j = 0.06 if f < N * 0.85 else 0.0
        cam_key(cam, f, (2.4 + random.uniform(-j, j), -3.6 + f * 0.008, 2.4 + random.uniform(-j, j)), (0.0, 1.4, 1.8))


def s_letter3(N):
    kitchen()
    p2 = make_pip2((0, 2.15, 0.0))
    seat(p2)
    p2.face(1, 'deadpan')
    p2.hold_front(int(N * 0.1), both=False, angle=-2.0)
    lt = empty('l3', (0.75, 1.3, 1.85))
    box('l3p', (0.7, 0.04, 0.5), (0, 0, 0), mat('#FFF1CF'), lt, bevel=0)
    text('l3n', '3', (0, -0.03, 0), 0.38, mat('#1E7A3C'), lt, extrude=0.01)
    lt.keyframe_insert('location', frame=1)
    lt.location.z = 2.0
    lt.keyframe_insert('location', frame=int(N * 0.3))
    green_light((0.15, 0.3, 2.4), 60, 'l3g')
    point((0, -0.5, 2.8), 140, (1, 0.9, 0.8), 'face')
    cam = camera(lens=40)
    cam_key(cam, 1, (0.3, -1.8, 2.7), (0, 2.0, 2.3))
    cam_key(cam, N, (0.2, -0.8, 2.7), (0, 2.0, 2.35))


def s_never_back(N):
    letter_set(N, front='IF YOU\nREAD THIS,\n\nYOU CAN\nNEVER\nGO BACK.', shake=True, glow=520)


def s_steps_stop(N):
    house_street()
    bm = mat(BLUE, **PM)
    print_trail('st', (0.3, -2.5), (0.0, 5.6), 9, 1, int(N * 0.75), bm, appear=True, scale=1.15)
    point((0, 4.5, 0.5), 120, (0.36, 0.95, 1.0), 'stl')
    cam = camera(lens=30)
    cam_key(cam, 1, (2.6, 1.0, 1.0), (0, 6.2, 0.6))
    cam_key(cam, N, (1.6, 3.4, 0.8), (0, 6.2, 0.8))


def s_knock(N):
    door, under = kitchen(door_glow=True)
    p2 = make_pip2((-1.4, 0.8, 0), rot_z=math.radians(-60))
    pip = make_pip((-1.0, -1.6, 0), rot_z=math.radians(-70))
    for c in (pip, p2):
        c.face(1, 'scared')
        c.shake(1, N, 0.06)
    knocks = [int(N * k) for k in (0.1, 0.38, 0.66)]
    for kf in knocks:
        door.keyframe_insert('location', frame=kf - 1)
        door.location.x = -5.75
        door.keyframe_insert('location', frame=kf)
        door.location.x = -5.85
        door.keyframe_insert('location', frame=kf + 3)
    cam = camera(lens=26)
    cam = camera(lens=22)
    cam_key(cam, 1, (2.6, -4.6, 2.6), (-3.0, -0.8, 1.4))
    cam_key(cam, N, (2.0, -4.0, 2.4), (-3.0, -0.9, 1.4))


def s_opt1(N):
    ep2.s_opt3(N)
    bpy.data.objects['L2n'].data.body = '3'


def s_opt2(N):
    door, under = kitchen(lights=False, door_glow=True)
    cam = camera(lens=35)
    cam_key(cam, 1, (-2.0, -1.5, 1.3), (-5.9, -1.5, 1.0))
    cam_key(cam, N, (-3.0, -1.5, 1.1), (-5.9, -1.5, 0.9))


def s_opt3(N):
    kitchen()
    for k, (x, rz) in enumerate(((-0.4, 0.3), (0.45, -0.3))):
        c = (make_pip if k == 0 else make_pip2)((x, 1.0, -0.75), rot_z=rz)
        c.face(1, 'scared')
        for l in c.legs:
            l.rotation_euler = (-math.pi / 2, 0, 0)
            l.keyframe_insert('rotation_euler', frame=1)
        c.body.rotation_euler = (0.35, 0, 0)
        c.body.keyframe_insert('rotation_euler', frame=1)
    for nm in ('chair1',):
        bpy.data.objects.remove(bpy.data.objects[nm])
    point((0, -1.5, 0.8), 150, (1, 0.85, 0.7), 'under')
    cam = camera(lens=30)
    cam_key(cam, 1, (0.0, -2.8, 0.55), (0, 1.0, 0.65))
    cam_key(cam, N, (0.0, -2.1, 0.5), (0, 1.0, 0.65))


def s_final(N):
    door, under = kitchen(door_glow=True)
    pip = make_pip((0.2, -0.8, 0))
    pip.face(1, 'scared')
    pip.talk(1, int(N * 0.6))
    pip.idle(1, N)
    pip.wave(int(N * 0.6), int(N * 0.8), arm=0)
    p2 = make_pip2((1.4, 1.0, 0), rot_z=math.radians(20))
    p2.face(1, 'deadpan')
    p2.hold_front(1, both=False, angle=-2.4)
    lt = empty('l3', (0, -0.2, -0.85), p2.arms[1])
    box('l3p', (0.55, 0.04, 0.4), (0, 0, 0), mat('#FFF1CF'), lt, bevel=0)
    text('l3n', '3', (0, -0.03, 0), 0.3, mat('#1E7A3C'), lt, extrude=0.01)
    for kf in [int(N * k) for k in (0.25, 0.45, 0.65, 0.8)]:
        door.keyframe_insert('location', frame=kf - 1)
        door.location.x = -5.75
        door.keyframe_insert('location', frame=kf)
        door.location.x = -5.85
        door.keyframe_insert('location', frame=kf + 3)
    point((0.2, -3.0, 2.6), 160, (1, 0.9, 0.8), 'face')
    cam = camera(lens=28)
    cam_key(cam, 1, (-0.8, -5.2, 2.3), (0.4, 0.5, 1.9))
    cam_key(cam, N, (0.1, -3.4, 2.2), (0.4, 0.0, 2.0))


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
