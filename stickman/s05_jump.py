"""S05 (Short): Every jump is twice as high. Jump 20 = 2^19 m = 524 km, higher than the ISS."""
import math

import cairo

import stick as S
from lib import (SCALE, Particles, camera, end_card, fmt, narrated_sound, pulse, rounded, text, word_captions)
from tts import Narration

NARR = Narration([
    (0.3, "Every time he jumps, he jumps twice as high."),
    (4.0, "One meter. Two. Four. Eight."),
    (12.8, "Over the house. Over the trees."),
    (20.5, "Jump eight: higher than the Statue of Liberty."),
    (25.9, "Jump ten: above the Eiffel Tower."),
    (29.6, "Jump eleven: over the tallest building on Earth."),
    (34.0, "And now it gets crazy."),
    (38.3, "Jump fifteen: sixteen kilometers. Above Mount Everest, and the planes."),
    (45.6, "Jump eighteen: he's in space."),
    (50.6, "Jump twenty: five hundred twenty four kilometers. Higher than the space station."),
    (56.0, "Twenty jumps. Each one only doubled."),
])
CHUNKS = NARR.chunks()
FX = Particles(8)

W, H, DUR = 1080, 1920, 60
GY = 1640  # ground line on screen
TOP = 330
T0, JD, NJ = 3.0, 2.5, 20
LANDINGS = [T0 + (n - 1) * JD + JD * 0.88 for n in range(1, NJ + 1)]
st = S.Stick(130, (0.08, 0.08, 0.1))
YEL = (1, 0.82, 0.25)

LANDMARKS = [  # name, height m, x position (m from stickman, negative = left), kind
    ("House", 8, 14, "house"),
    ("Tree", 25, -22, "tree"),
    ("Statue of Liberty", 93, 80, "tower"),
    ("Eiffel Tower", 330, -300, "eiffel"),
    ("Burj Khalifa", 828, 700, "burj"),
    ("Mount Everest", 8849, 12000, "mountain"),
    ("Passenger jet", 11000, -6000, "plane"),
    ("Edge of space", 100000, 0, "line"),
    ("ISS", 400000, 120000, "iss"),
]
PASS = {5: "Higher than a house!", 6: "Over the trees!", 8: "Over the Statue of Liberty!",
        10: "Higher than the Eiffel Tower!", 11: "Over the Burj Khalifa!",
        15: "Above Mount Everest AND the planes!", 18: "He's in SPACE.", 20: "Higher than the ISS!!"}


def height(n):
    return 2.0 ** (n - 1)


def state(t):
    """Returns jump index n (1..NJ), altitude in m, phase name, view height V in m."""
    if t < T0:
        return 0, 0.0, "stand", 4.0
    n = min(NJ, int((t - T0) / JD) + 1)
    u = (t - T0 - (n - 1) * JD) / JD
    if n == NJ and t - T0 > NJ * JD:
        u = 1.0
    hn = height(n)
    vprev = max(4.0, 1.7 * height(n - 1)) if n > 1 else 4.0
    vnow = max(4.0, 1.7 * hn)
    k = min(1.0, u / 0.25)
    V = math.exp(math.log(vprev) + (math.log(vnow) - math.log(vprev)) * S.ease(k))
    if u < 0.12:
        return n, 0.0, "crouch", V
    if u < 0.88:
        a = (u - 0.12) / 0.76
        return n, hn * 4 * a * (1 - a), "air", V
    return n, 0.0, "land", V


def sky(c, V):
    s = min(1.0, max(0.0, (math.log10(V) - 3.3) / 1.7))  # 2 km -> 100 km
    top = (0.45 * (1 - s), 0.7 * (1 - s), 0.98 * (1 - s) + 0.02)
    bot = (0.75 * (1 - s) + 0.05, 0.88 * (1 - s) + 0.05, 1.0 * (1 - s) + 0.1)
    g = cairo.LinearGradient(0, 0, 0, GY)
    g.add_color_stop_rgb(0, *top)
    g.add_color_stop_rgb(1, *bot)
    c.set_source(g)
    c.paint()
    if s > 0.3:
        for k in range(120):
            x = (k * 397) % W
            y = (k * 733) % GY
            c.set_source_rgba(1, 1, 1, (s - 0.3) * (0.4 + 0.6 * ((k * 13) % 7) / 7))
            c.arc(x, y, 1.5 + (k % 3), 0, 2 * math.pi)
            c.fill()


def landmark(c, name, hm, xm, kind, ppm, sx):
    X = sx + xm * ppm
    Hp = hm * ppm
    if kind == "line":
        y = GY - Hp
        if 0 < y < GY:
            c.set_source_rgba(1, 1, 1, 0.6)
            c.set_line_width(3)
            c.set_dash([18, 14])
            c.move_to(0, y)
            c.line_to(W, y)
            c.stroke()
            c.set_dash([])
            text(c, "Edge of space · 100 km", 40, y - 14, 34, (1, 1, 1), align="left")
        return
    if kind in ("plane", "iss"):
        y = GY - Hp
        sz = max(16.0, min(120.0, (60 if kind == "plane" else 100) * ppm))
        if -50 < y < GY and -200 < X < W + 200:
            c.set_source_rgb(0.9, 0.9, 0.95)
            if kind == "plane":
                c.rectangle(X - sz, y - sz * 0.12, sz * 2, sz * 0.24)
                c.fill()
                c.move_to(X - sz * 0.2, y)
                c.line_to(X + sz * 0.3, y - sz * 0.7)
                c.line_to(X + sz * 0.45, y)
                c.close_path()
                c.fill()
            else:
                c.rectangle(X - sz * 1.2, y - sz * 0.1, sz * 2.4, sz * 0.2)
                c.fill()
                c.set_source_rgb(0.3, 0.45, 0.85)
                for dx in (-1.1, -0.65, 0.65, 1.1):
                    c.rectangle(X + dx * sz - sz * 0.18, y - sz * 0.5, sz * 0.36, sz)
                    c.fill()
            label = "Passenger jet · 11 km" if kind == "plane" else "ISS · 400 km"
            text(c, label, X, y - sz * 0.8 - 10, 34, (1, 1, 1))
        return
    if Hp < 3 or X < -W * 3 or X > W * 4:
        return
    c.set_source_rgb(0.22, 0.25, 0.3)
    if kind == "house":
        w = 10 * ppm
        c.rectangle(X - w / 2, GY - Hp * 0.6, w, Hp * 0.6)
        c.fill()
        c.move_to(X - w * 0.6, GY - Hp * 0.6)
        c.line_to(X, GY - Hp)
        c.line_to(X + w * 0.6, GY - Hp * 0.6)
        c.fill()
    elif kind == "tree":
        c.rectangle(X - 0.6 * ppm, GY - Hp * 0.4, 1.2 * ppm, Hp * 0.4)
        c.fill()
        c.set_source_rgb(0.2, 0.45, 0.25)
        c.arc(X, GY - Hp * 0.65, Hp * 0.33, 0, 2 * math.pi)
        c.fill()
    elif kind == "tower":
        c.rectangle(X - 6 * ppm, GY - Hp * 0.5, 12 * ppm, Hp * 0.5)
        c.fill()
        c.set_source_rgb(0.35, 0.6, 0.55)
        c.rectangle(X - 3 * ppm, GY - Hp, 6 * ppm, Hp * 0.5)
        c.fill()
        c.move_to(X + 2 * ppm, GY - Hp * 0.9)
        c.line_to(X + 3 * ppm, GY - Hp * 1.02)
        c.set_line_width(max(2, 1.5 * ppm))
        c.stroke()
    elif kind == "eiffel":
        c.move_to(X - 60 * ppm, GY)
        c.curve_to(X - 20 * ppm, GY - Hp * 0.4, X - 3 * ppm, GY - Hp * 0.8, X, GY - Hp)
        c.curve_to(X + 3 * ppm, GY - Hp * 0.8, X + 20 * ppm, GY - Hp * 0.4, X + 60 * ppm, GY)
        c.close_path()
        c.fill()
    elif kind == "burj":
        for k, f in enumerate((1.0, 0.8, 0.6, 0.4)):
            w = (40 - k * 9) * ppm
            c.rectangle(X - w / 2, GY - Hp * f, w, Hp * f)
            c.fill()
    elif kind == "mountain":
        c.set_source_rgb(0.35, 0.37, 0.42)
        c.move_to(X - Hp * 2.2, GY)
        c.line_to(X, GY - Hp)
        c.line_to(X + Hp * 2.0, GY)
        c.close_path()
        c.fill()
        c.set_source_rgb(1, 1, 1)
        c.move_to(X - Hp * 0.5, GY - Hp * 0.77)
        c.line_to(X, GY - Hp)
        c.line_to(X + Hp * 0.45, GY - Hp * 0.78)
        c.close_path()
        c.fill()
    if Hp > 40:
        label = f"{name} · {fmt(hm)} m"
        c.set_font_size(32)
        half = c.text_extents(label).x_advance / 2 + 20
        lx = min(W - half, max(half, X))
        text(c, label, lx, GY - Hp - 18, 32, (0.1, 0.1, 0.15) if Hp < 900 else (1, 1, 1))


def frame(c, t):
    shake = sum(pulse(t, tl, 0.35, 4 + k * 0.8) for k, tl in enumerate(LANDINGS))
    camera(c, W, H, t, shake=shake)
    scene(c, t)
    c.restore()
    hud(c, t)


def scene(c, t):
    n, alt, ph, V = state(t)
    ppm = (GY - TOP) / V
    sky(c, V)
    sx = W / 2
    for name, hm, xm, kind in LANDMARKS:
        landmark(c, name, hm, xm, kind, ppm, sx)
    c.set_source_rgb(0.25, 0.55, 0.3)
    c.rectangle(0, GY, W, H - GY)
    c.fill()
    # stickman (never smaller than 70 px so you can always find him)
    true_px = 1.8 * ppm
    size = max(70.0, min(130.0, true_px / 1.14))
    stk = S.Stick(size, (0.08, 0.08, 0.1) if V < 3000 else (1, 1, 1))
    y_feet = GY - alt * ppm
    if ph == "crouch" or ph == "land":
        pose = S.CROUCH
    elif ph == "air":
        pose = S.ARMS_UP
    else:
        pose = S.STAND
    expr = "smile" if n < 10 else ("shock" if n < 17 else "scream")
    if ph == "air" and y_feet < TOP + 40:
        y_feet = TOP + 40
    if ph == "air":
        up = (t - T0 - (n - 1) * JD) / JD < 0.5
        c.set_source_rgba(1, 1, 1, 0.55) if V > 3000 else c.set_source_rgba(0.1, 0.1, 0.15, 0.4)
        c.set_line_width(4)
        for k in range(5):
            lx = sx - 60 + k * 30
            ly = y_feet + (40 if up else -size * 1.3) + (k % 2) * 25
            c.move_to(lx, ly)
            c.line_to(lx, ly + (90 if up else -90))
        c.stroke()
    for tl in LANDINGS:
        if abs(t - tl) < 0.5 / 30:
            FX.emit(sx, GY, 26, [(0.55, 0.45, 0.35), (0.4, 0.6, 0.35)], speed=(100, 380), up=120, life=(0.4, 0.8),
                    size=(5, 10), gravity=600, spread=2.6, angle=-math.pi / 2)
    stk.draw(c, pose, sx, stk.ground_y(pose, y_feet), 1, expr, t=t, shadow=GY if alt * ppm < 400 else None)
    if size > true_px / 1.14 * 1.5 and ph == "air" and n > 8:
        c.set_source_rgba(1, 1, 1, 0.8)
        c.set_line_width(3)
        c.new_path()
        c.arc(sx, y_feet - size * 0.55, size * 0.9, 0, 2 * math.pi)
        c.stroke()
    FX.step_draw(c, t)


def hud(c, t):
    n, alt, ph, V = state(t)
    # HUD
    rounded(c, 60, 120, W - 120, 200, 30)
    c.set_source_rgba(0, 0, 0, 0.45)
    c.fill()
    text(c, "Every jump is 2x higher", W / 2, 195, 58, (1, 1, 1))
    hn = height(n) if n else 0
    text(c, f"Jump {n}:  {fmt(int(hn)) + ' m' if hn < 1000 else f'{hn / 1000:,.1f} km'}" if n else "Jump 0", W / 2, 285,
         64, YEL)
    if t > 54:
        end_card(c, W, H, [("524 km", 130, YEL), ("in just 20 jumps", 60, (1, 1, 1)),
                           ("Each one only doubled.", 44, (0.8, 0.8, 0.8))], t - 54)
    word_captions(c, CHUNKS, t, W / 2, 1810 if t < 54 else 1450, 70)


def sound(a):
    narrated_sound(a, NARR, _music)


def _music(a):
    a.music(0, 60, bpm=120, chords=((0, 4, 7), (5, 9, 12), (7, 11, 14), (0, 4, 7)), root=220.0, vol=0.5)
    for n in range(1, NJ + 1):
        ts = T0 + (n - 1) * JD
        a.add(ts + 0.3, "whoosh", 200 + n * 60, 0.2 + n * 0.012)
        a.add(ts + JD * 0.88, "thud", 60 + n * 2, 0.25 + n * 0.015)
        if n in PASS:
            a.add(ts + 0.8, "bell", SCALE[min(19, 4 + n // 2 + 2)], 0.3)
    for i, nn in enumerate((9, 11, 14, 16)):
        a.add(54 + 0.12 * i, "bell", SCALE[nn], 0.3)


if __name__ == "__main__":
    import sys
    import lib
    lib.run(sys.modules[__name__], sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else None)
