"""S03 (Short): Stickman survives 100 days alone on an island. Dark, moody survival-series look."""
import math
import random

import cairo

import stick as S
from lib import (SCALE, Particles, camera, caption, end_card, fade, narrated_sound, pulse, rounded, text, vignette,
                 word_captions)
from tts import Narration

NARR = Narration([
    (0.4, "Day one. He wakes up on an island. Completely alone."),
    (6.2, "Day three. He finds fresh water."),
    (11.2, "Day seven. He builds his first shelter."),
    (17.2, "Day twelve. Fire. Finally warm."),
    (22.7, "Day thirty. A storm destroys everything."),
    (28.2, "Day thirty one. He rebuilds. Stronger."),
    (33.2, "Day sixty. He builds a raft to escape..."),
    (37.3, "...and it sinks."),
    (40.2, "Day eighty five. He writes S. O. S. on the beach."),
    (47.2, "Day one hundred. A ship!"),
    (55.3, "Rescued. Would you last a hundred days?"),
])
CHUNKS = NARR.chunks()
FX = Particles(11)
BL = S.Blend()
STRIKES = [23.0, 24.4, 26.0]

W, H, DUR = 1080, 1920, 60
WHITE = (0.93, 0.93, 0.95)
SEA_Y = 1180
GROUND = 1330
st = S.Stick(230, WHITE)
rnd = random.Random(4)
STARS = [(rnd.uniform(0, W), rnd.uniform(0, 900), rnd.uniform(1, 3)) for _ in range(140)]

BEATS = [  # start, end, day, caption
    (0.0, 6.0, 1, "Day 1: washed up on an island."),
    (6.0, 11.0, 3, "Day 3: found fresh water."),
    (11.0, 17.0, 7, "Day 7: built a shelter."),
    (17.0, 22.5, 12, "Day 12: made fire. Finally warm."),
    (22.5, 28.0, 30, "Day 30: a storm destroyed everything."),
    (28.0, 33.0, 31, "Day 31: rebuilt it. Stronger."),
    (33.0, 40.0, 60, "Day 60: built a raft..."),
    (40.0, 47.0, 85, "Day 85: wrote SOS on the beach."),
    (47.0, 55.0, 100, "Day 100: a SHIP!"),
]


def beat(t):
    for i, (a, b, d, s) in enumerate(BEATS):
        if a <= t < b:
            return i, t - a, d, s
    return len(BEATS) - 1, t - BEATS[-1][0], 100, BEATS[-1][3]


def sky(c, storm):
    g = cairo.LinearGradient(0, 0, 0, SEA_Y)
    if storm:
        g.add_color_stop_rgb(0, 0.05, 0.06, 0.08)
        g.add_color_stop_rgb(1, 0.15, 0.17, 0.2)
    else:
        g.add_color_stop_rgb(0, 0.02, 0.03, 0.08)
        g.add_color_stop_rgb(0.7, 0.08, 0.1, 0.2)
        g.add_color_stop_rgb(1, 0.25, 0.18, 0.22)
    c.set_source(g)
    c.rectangle(0, 0, W, SEA_Y)
    c.fill()
    if not storm:
        for x, y, r in STARS:
            c.set_source_rgba(1, 1, 1, 0.6)
            c.arc(x, y, r, 0, 2 * math.pi)
            c.fill()
        g = cairo.RadialGradient(820, 420, 10, 820, 420, 200)
        g.add_color_stop_rgba(0, 1, 0.97, 0.85, 0.35)
        g.add_color_stop_rgba(1, 1, 0.97, 0.85, 0)
        c.set_source(g)
        c.arc(820, 420, 200, 0, 2 * math.pi)
        c.fill()
        c.set_source_rgb(0.97, 0.95, 0.85)
        c.arc(820, 420, 60, 0, 2 * math.pi)
        c.fill()


def sea(c, t, rough):
    c.set_source_rgb(0.04, 0.08, 0.14)
    c.rectangle(0, SEA_Y, W, H - SEA_Y)
    c.fill()
    amp = 14 if rough else 5
    for k in range(6):
        y = SEA_Y + 30 + k * 90
        c.set_source_rgba(0.4, 0.55, 0.7, 0.25)
        c.set_line_width(3)
        for x in range(0, W + 20, 20):
            yy = y + amp * math.sin(x / 70 + t * (2.5 if rough else 1.2) + k)
            (c.move_to if x == 0 else c.line_to)(x, yy)
        c.stroke()


def island(c):
    g = cairo.LinearGradient(0, GROUND - 40, 0, H)
    g.add_color_stop_rgb(0, 0.24, 0.2, 0.16)
    g.add_color_stop_rgb(1, 0.1, 0.08, 0.07)
    c.set_source(g)
    c.move_to(-50, H)
    c.line_to(-50, GROUND - 10)
    c.curve_to(250, GROUND - 60, 700, GROUND - 50, 840, GROUND)
    c.curve_to(900, GROUND + 60, 980, GROUND + 260, 1130, H)
    c.close_path()
    c.fill()
    c.set_source_rgb(0.06, 0.06, 0.07)  # palm
    c.set_line_width(16)
    c.move_to(160, GROUND - 5)
    c.curve_to(150, GROUND - 200, 190, GROUND - 330, 230, GROUND - 430)
    c.stroke()
    for a in (-2.6, -2.0, -1.2, -0.5, 0.2):
        c.set_line_width(10)
        c.move_to(230, GROUND - 430)
        c.curve_to(230 + 90 * math.cos(a), GROUND - 470 + 60 * math.sin(a),
                   230 + 170 * math.cos(a), GROUND - 430 + 90 * math.sin(a) + 40,
                   230 + 200 * math.cos(a), GROUND - 430 + 130 * math.sin(a) + 90)
        c.stroke()


def hut(c, x, scale, alpha=1.0, broken=0.0):
    c.set_source_rgba(0.45, 0.33, 0.2, alpha)
    w, h = 260 * scale, 220 * scale
    c.move_to(x - w / 2, GROUND)
    c.line_to(x, GROUND - h + broken * 150)
    c.line_to(x + w / 2 - broken * 80, GROUND)
    c.close_path()
    c.fill()
    c.set_source_rgba(0.08, 0.06, 0.05, alpha)
    c.move_to(x - w * 0.15, GROUND)
    c.line_to(x, GROUND - h * 0.45)
    c.line_to(x + w * 0.15, GROUND)
    c.close_path()
    c.fill()


def fire(c, x, t, size=1.0):
    g = cairo.RadialGradient(x, GROUND - 40, 5, x, GROUND - 40, 260 * size)
    g.add_color_stop_rgba(0, 1, 0.6, 0.2, 0.35)
    g.add_color_stop_rgba(1, 1, 0.5, 0.1, 0)
    c.set_source(g)
    c.arc(x, GROUND - 40, 260 * size, 0, 2 * math.pi)
    c.fill()
    for k, (col, s) in enumerate((((1, 0.45, 0.1), 1.0), ((1, 0.8, 0.2), 0.6))):
        c.set_source_rgb(*col)
        fl = 1 + 0.15 * math.sin(t * 17 + k)
        c.move_to(x - 30 * s * size, GROUND)
        c.curve_to(x - 40 * s * size, GROUND - 60 * s * size * fl, x, GROUND - 90 * s * size * fl,
                   x + 5 * s * size, GROUND - 120 * s * size * fl)
        c.curve_to(x + 30 * s * size, GROUND - 70 * s * size, x + 40 * s * size, GROUND - 30 * s * size,
                   x + 30 * s * size, GROUND)
        c.close_path()
        c.fill()
    c.set_source_rgb(0.3, 0.2, 0.12)
    c.set_line_width(10)
    c.move_to(x - 45 * size, GROUND)
    c.line_to(x + 45 * size, GROUND - 14)
    c.move_to(x - 45 * size, GROUND - 14)
    c.line_to(x + 45 * size, GROUND)
    c.stroke()


def frame(c, t):
    i, lt, day, cap = beat(t)
    shake = sum(pulse(t, s_, 0.5, 18) for s_ in STRIKES) + (3 if i == 4 else 0)
    z = 1.0
    if i == 8:
        z = 1 + 0.08 * S.ease(lt / 3)
    camera(c, W, H, t, zoom=z, fx=W / 2 + 35 * (z - 1) / 0.08, fy=H / 2 + 60 * (z - 1) / 0.08, shake=shake)
    scene(c, t)
    c.restore()
    vignette(c, W, H, 0.5)
    hud(c, t)


def scene(c, t):
    i, lt, day, cap = beat(t)
    storm = i == 4
    sky(c, storm)
    for s_ in STRIKES:
        if 0 <= t - s_ < 0.18:
            c.set_source_rgba(1, 1, 1, 0.75 * (1 - (t - s_) / 0.18))
            c.paint()
            c.set_source_rgba(1, 1, 0.9, 0.9)
            c.set_line_width(6)
            c.move_to(700, 0)
            c.line_to(640, 300)
            c.line_to(720, 330)
            c.line_to(610, 700)
            c.stroke()
    sea(c, t, storm or i == 6)
    island(c)
    # shelter state
    if i in (2, 3):
        hut(c, 640, min(1, lt / 3) if i == 2 else 1)
    if i == 4:
        hut(c, 640, 1, alpha=max(0, 1 - lt / 2), broken=min(1, lt / 1.5))
    if i >= 5:
        hut(c, 650, 1.3 * (min(1, lt / 3) if i == 5 else 1))
    if i == 3 or i >= 7:
        fire(c, 450, t, 0.8 if i == 3 else 1.2)
    x = 450
    pose, expr = dict(S.STAND), "flat"
    if i == 0:
        if lt < 2.5:
            pose, expr = S.LIE, "sleep"
        else:
            pose = S.lerp_pose(S.CROUCH, S.STAND, S.ease((lt - 2.5) / 1.5))
        x = 380
    elif i == 1:
        x = 300 + min(1, lt / 2) * 120
        pose = S.walk(t * 6) if lt < 2 else S.CROUCH
        expr = "smile" if lt > 2.5 else "flat"
        c.set_source_rgb(0.25, 0.45, 0.7)
        c.save()
        c.translate(560, GROUND - 8)
        c.scale(1, 0.25)
        c.arc(0, 0, 90, 0, 2 * math.pi)
        c.restore()
        c.fill()
    elif i == 2:
        x = 560
        pose = S.lerp_pose(S.STAND, dict(S.STAND, ua_r=150, fa_r=120), (math.sin(t * 9) + 1) / 2)
    elif i == 3:
        pose, expr, x = S.SIT, "smile", 330
    elif i == 4:
        pose, expr, x = dict(S.SHRUG), "sad", 400
        c.set_source_rgba(0.7, 0.75, 0.85, 0.5)
        c.set_line_width(2)
        for k in range(90):
            xx = (k * 53 + t * 900) % (W + 200) - 100
            yy = (k * 137 + t * 1500) % H
            c.move_to(xx, yy)
            c.line_to(xx - 18, yy + 50)
        c.stroke()
    elif i == 5:
        x = 560
        pose = S.lerp_pose(S.STAND, dict(S.STAND, ua_r=150, fa_r=120), (math.sin(t * 11) + 1) / 2)
        expr = "flat"
    elif i == 6:
        # raft goes out, then sinks
        rx = 900 + lt * 22
        sink = max(0.0, (lt - 4.2) / 1.5)
        ry = SEA_Y + 140 + sink * 160
        c.set_source_rgb(0.45, 0.33, 0.2)
        c.rectangle(rx - 110, ry - 10, 220, 26)
        c.fill()
        pose = S.SIT if sink == 0 else S.ARMS_UP
        expr = "smile" if sink == 0 else "shock"
        st.draw(c, pose, rx, st.ground_y(pose, ry - 10) + sink * 60, 1, expr, t=t)
        if abs(lt - 4.25) < 0.5 / 30:
            FX.emit(rx, ry, 50, (0.6, 0.75, 0.9), speed=(150, 420), up=380, life=(0.6, 1.1), size=(4, 8),
                    gravity=900, spread=2.2, angle=-math.pi / 2)
        if sink > 0:
            pass
        pose = None
    elif i == 7:
        c.set_source_rgb(0.85, 0.8, 0.65)
        c.select_font_face("Inter", cairo.FONT_SLANT_NORMAL, cairo.FONT_WEIGHT_BOLD)
        c.set_font_size(150)
        show = "SOS"[:min(3, int(lt / 1.2) + 1)]
        c.save()
        c.translate(470, GROUND + 230)
        c.scale(1, 0.45)
        c.move_to(-170, 0)
        c.show_text(show)
        c.restore()
        c.new_path()
        pose, x, expr = dict(S.STAND, ua_r=60, fa_r=70), 260, "flat"
    elif i == 8:
        sx = 1250 - lt * 45
        c.save()
        c.translate(sx, SEA_Y + 20)
        c.scale(2.0, 2.0)
        c.set_source_rgb(0.02, 0.02, 0.03)
        c.move_to(-130, -10)
        c.line_to(130, -10)
        c.line_to(100, 25)
        c.line_to(-100, 25)
        c.close_path()
        c.fill()
        c.rectangle(-40, -70, 70, 60)
        c.fill()
        c.rectangle(-5, -110, 16, 40)
        c.fill()
        c.set_source_rgb(1, 0.9, 0.5)
        for k in range(3):
            c.arc(-25 + k * 22, -45, 5, 0, 2 * math.pi)
            c.fill()
        c.restore()
        pose = S.ARMS_UP if (lt * 3) % 2 < 1 else S.lerp_pose(S.ARMS_UP, S.STAND, 0.5)
        expr, x = "happy", 300
    if pose is not None:
        if pose is S.LIE:
            st.draw(c, pose, x, GROUND - 15, 1, expr, t=t)
        else:
            pose = BL(pose, t)
            st.draw(c, pose, x, st.ground_y(pose, GROUND), 1, expr, t=t, shadow=GROUND)
    # particles: fire sparks, rain splashes, sand when he gets up
    if (i == 3 or i >= 7) and int(t * 30) % 2 == 0:
        FX.emit(450 + FX.r.uniform(-20, 20), GROUND - 60, 1, [(1, 0.7, 0.2), (1, 0.45, 0.1)], speed=(20, 60),
                up=160, life=(0.6, 1.3), size=(2, 4), gravity=-40)
    if i == 4:
        for _ in range(3):
            FX.emit(FX.r.uniform(0, W), FX.r.uniform(GROUND - 20, H - 200), 2, (0.7, 0.75, 0.85), speed=(30, 90),
                    up=100, life=(0.15, 0.3), size=(2, 3), gravity=900)
    if i == 8 and int(t * 30) % 4 == 0:
        FX.emit(x, GROUND - 300, 3, [(1, 0.85, 0.3), (1, 1, 1)], speed=(100, 300), up=200, life=(0.6, 1.0),
                size=(5, 9), gravity=400, kind="confetti")
    FX.step_draw(c, t)


def hud(c, t):
    i, lt, day, cap = beat(t)
    rounded(c, W / 2 - 190, 140, 380, 120, 30)
    c.set_source_rgba(0, 0, 0, 0.55)
    c.fill()
    text(c, f"DAY {day}", W / 2, 228, 80, (1, 0.82, 0.25))
    text(c, "Surviving 100 days alone", W / 2, 330, 46, (0.85, 0.85, 0.9))
    if t > 55:
        end_card(c, W, H, [("RESCUED", 120, (1, 0.82, 0.25)), ("after 100 days", 60, (1, 1, 1)),
                           ("Would YOU last 100 days?", 44, (0.8, 0.8, 0.8))], t - 55)
    word_captions(c, CHUNKS, t, W / 2, 1720 if t < 55 else 1500, 72)


def sound(a):
    narrated_sound(a, NARR, _music)


def _music(a):
    a.music(0, 60, bpm=72, chords=((0, 3, 7), (8, 12, 15), (5, 8, 12), (7, 11, 14)), root=146.8, vol=0.5,
            drums=False)
    a.pad(0, 60, [73.4, 110.0], 0.03)
    for s, e, d, cap in BEATS:
        a.add(s + 0.2, "whoosh", 300, 0.25)
    for k in range(12):
        a.add(11.3 + k * 0.45, "thud", 140, 0.18)
        a.add(28.3 + k * 0.4, "thud", 150, 0.18)
    a.add(23.0, "boom", 50, 0.6)
    a.add(24.4, "boom", 45, 0.5)
    a.add(26.0, "boom", 55, 0.5)
    a.add(37.3, "thud", 60, 0.5)
    a.add(37.5, "whoosh", 200, 0.4)
    for i, n in enumerate((7, 9, 11, 14)):
        a.add(47.2 + 0.15 * i, "bell", SCALE[n], 0.3)
    for i, n in enumerate((9, 11, 14, 16)):
        a.add(55 + 0.12 * i, "bell", SCALE[n], 0.3)


if __name__ == "__main__":
    import sys
    import lib
    lib.run(sys.modules[__name__], sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else None)
