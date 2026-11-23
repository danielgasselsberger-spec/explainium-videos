"""S08 (Short): 1 strong stickman vs 100 in tug of war. 10 more join every 5 s. Plot twist: he lets go."""
import math

import stick as S
from lib import (INK, PALETTE, PAPER, SCALE, Particles, camera, end_card, narrated_sound, pulse, rounded, text,
                 word_captions)
from tts import Narration

NARR = Narration([
    (0.3, "One really strong guy, versus one hundred people."),
    (3.4, "Round one: ten people. Too easy."),
    (8.2, "Every five seconds, ten more join."),
    (17.8, "Forty people, and he's still not moving!"),
    (26.0, "Sixty. Seventy."),
    (32.8, "He's starting to slip..."),
    (42.8, "One against one hundred. This is it."),
    (48.2, "He takes a deep breath..."),
    (51.9, "...and just lets go."),
    (55.6, "Work smart, not hard."),
])
CHUNKS = NARR.chunks()
FX = Particles(9)
JOINS = [3 + 5 * k for k in range(10)]

W, H, DUR = 1080, 1920, 60
FLOOR = 1520
hero = S.Stick(330, INK)
T_LET = 52.0
RED = (0.88, 0.25, 0.25)


def team_size(t):
    if t < 3:
        return 0
    return min(100, 10 * (1 + int((t - 3) / 5)))


def slots():
    """(x, y_floor, size, row, col) for 100 team members, back rows higher and smaller."""
    out = []
    for row in range(10):
        sc = 1.0 - row * 0.055
        yfl = FLOOR - row * 62
        for col in range(10):
            x = 560 + col * 52 * sc + row * 8
            out.append((x, yfl, 150 * sc, row, col))
    order = sorted(range(100), key=lambda i: (out[i][4] + out[i][3]))
    return [out[i] for i in order]


SLOTS = slots()


def frame(c, t):
    strain = min(1.0, team_size(t) / 100)
    shake = (4 * strain if t < T_LET else 0) + pulse(t, T_LET + 0.6, 0.8, 20) + sum(pulse(t, j, 0.3, 6) for j in JOINS)
    z = 1 + 0.06 * S.ease((t - 44) / 6) if t < T_LET else 1.06 - 0.06 * S.ease((t - T_LET) / 1.0)
    camera(c, W, H, t, zoom=z, fy=FLOOR - 400, shake=shake)
    scene(c, t)
    c.restore()
    hud(c, t)


def scene(c, t):
    c.set_source_rgb(*PAPER)
    c.paint()
    c.set_source_rgb(0.55, 0.75, 0.45)
    c.rectangle(0, FLOOR - 650, W, H - FLOOR + 650)
    c.fill()
    c.set_source_rgb(0.98, 0.98, 0.98)
    c.rectangle(500, FLOOR - 650, 10, H)
    c.fill()
    n = team_size(t)
    let = t >= T_LET
    strain = min(1.0, n / 100)
    wob = math.sin(t * 9) * 4 * strain
    # rope
    hero_x = 220 - (0 if not let else 0)
    hp = dict(S.PULL)
    hp["lean"] = -28 - 14 * strain
    if let:
        hp = S.lerp_pose(hp, dict(S.STAND, ua_r=30, fa_r=150), S.ease((t - T_LET) / 0.6))
    hy = hero.ground_y(hp, FLOOR)
    hj = hero.joints(hp, hero_x + wob, hy, 1)
    rope_y = hj["hand_r"][1]
    if not let:
        c.set_source_rgb(0.6, 0.45, 0.25)
        c.set_line_width(12)
        c.move_to(*hj["hand_r"])
        c.line_to(1100, rope_y + 10)
        c.stroke()
        mx = 500 + 30 * strain + wob * 3
        c.set_source_rgb(*RED)
        c.rectangle(mx - 8, rope_y - 10, 16, 60)
        c.fill()
    else:
        u = min(1.0, (t - T_LET) / 0.5)
        c.set_source_rgb(0.6, 0.45, 0.25)
        c.set_line_width(12)
        c.move_to(560 + 600 * u, rope_y + 10)
        c.line_to(1100 + 600 * u, rope_y + 10)
        c.stroke()
    # team (back rows first)
    for i in sorted(range(n), key=lambda i: -SLOTS[i][3]):
        x, yfl, size, row, col = SLOTS[i]
        st = S.Stick(size, PALETTE[(i * 3) % len(PALETTE)])
        p = dict(S.PULL)
        p["lean"] = -25 - 8 * math.sin(t * 7 + i)
        if let:
            tf = T_LET + 0.15 + col * 0.04 + row * 0.03
            u = S.ease((t - tf) / 0.45)
            p = S.lerp_pose(p, S.LIE, u)
            dx = 60 * u
        else:
            dx = 0
        y = st.ground_y(p, yfl) if not let or (t - T_LET) < 0.15 + col * 0.04 + row * 0.03 else \
            S.lerp_pose(p, p, 0)["lean"] * 0 + yfl - st.w - (st.ground_y(p, yfl) - yfl) * 0 - size * 0.08
        if let:
            y = st.ground_y(p, yfl)
        st.draw(c, p, x + dx, y, -1, "scream" if not let else "shock")
    hero.draw(c, hp, hero_x + wob, hy, 1,
              ("smile" if strain < 0.35 else "flat" if strain < 0.75 else "scream") if not let else "happy",
              muscle=1.0, t=t, shadow=FLOOR)
    if not let and strain > 0.2 and int(t * 30) % 3 == 0:
        FX.emit(hj["foot_l"][0] + 20, FLOOR, 2, (0.45, 0.4, 0.3), speed=(60, 160), up=80, life=(0.3, 0.6),
                size=(4, 8), gravity=400, angle=0.0, spread=1.2)
    if abs(t - (T_LET + 0.6)) < 0.5 / 30:
        FX.emit(820, FLOOR - 40, 70, (0.5, 0.45, 0.35), speed=(150, 500), up=200, life=(0.5, 1.2), size=(6, 14),
                gravity=500, angle=-math.pi / 2, spread=2.8)
    if 0.6 < strain and not let:
        for k in range(3):
            yy = hj["head"][1] - 20 + ((t * 160 + k * 40) % 120)
            c.set_source_rgb(0.4, 0.65, 0.95)
            c.arc(hj["head"][0] - 50 - k * 14, yy, 9, 0, 2 * math.pi)
            c.fill()
    FX.step_draw(c, t)


def hud(c, t):
    n = team_size(t)
    # HUD
    rounded(c, W / 2 - 300, 330, 600, 150, 30)
    c.set_source_rgba(0, 0, 0, 0.75)
    c.fill()
    text(c, f"1  vs  {n}", W / 2, 435, 100, (1, 0.82, 0.25))
    text(c, "1 strong guy vs 100", W / 2, 165, 72, INK)
    text(c, "+10 every 5 seconds", W / 2, 250, 52, RED)
    if t > 56:
        end_card(c, W, H, [("Work smart,", 90, (1, 1, 1)), ("not hard.", 110, (1, 0.82, 0.25)),
                           ("Who would YOU bet on?", 44, (0.8, 0.8, 0.8))], t - 56)
    word_captions(c, CHUNKS, t, W / 2, 1800 if t < 56 else 1450, 74)


def sound(a):
    narrated_sound(a, NARR, _music)


def _music(a):
    a.music(0, T_LET, bpm=110, chords=((0, 3, 7), (5, 8, 12), (7, 10, 14), (3, 7, 10)), root=196.0, vol=0.6)
    for k in range(10):
        tt = 3 + 5 * k
        a.add(tt, "pop", 400 + k * 40, 0.3)
        a.add(tt, "pluck", SCALE[3 + k], 0.2)
    a.add(T_LET, "whoosh", 800, 0.5)
    for k in range(25):
        a.add(T_LET + 0.15 + k * 0.05, "thud", 80 + k * 3, 0.25)
    for i, n in enumerate((9, 11, 14, 16)):
        a.add(T_LET + 1.2 + 0.12 * i, "bell", SCALE[n], 0.3)
    a.music(T_LET + 1.0, 60, bpm=90, chords=((0, 4, 7), (5, 9, 12)), root=261.6, vol=0.4)


if __name__ == "__main__":
    import sys
    import lib
    lib.run(sys.modules[__name__], sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else None)
