"""S04 (Short): What if you jumped into a hole through the Earth? (gravity tunnel thought experiment)

Uniform-density Earth, no air: simple harmonic motion with half-period ~42.2 min,
peak speed sqrt(g*R) = sqrt(9.81 * 6.371e6) = 7.9 km/s = ~28,400 km/h at the center.
"""
import math

import cairo

import stick as S
from lib import (SCALE, Particles, camera, end_card, fade, narrated_sound, rounded, text, vignette,
                 word_captions)
from tts import Narration

NARR = Narration([
    (0.3, "What if you dug a hole straight through the Earth, and jumped in?"),
    (6.4, "You'd fall faster, and faster..."),
    (11.5, "And the strange part: you'd feel weightless the whole way."),
    (18.5, "Through the mantle. Into the core."),
    (23.0, "At the center, you're flying at about twenty eight thousand kilometers per hour."),
    (30.5, "Then gravity pulls you back, and you slow down."),
    (38.6, "Forty two minutes later, you pop out on the other side of the planet."),
    (46.0, "And then? You fall back. Forever."),
    (51.0, "At least, if there were no air and no heat."),
    (56.0, "Would you jump?"),
])
CHUNKS = NARR.chunks()
FX = Particles(4)

W, H, DUR = 1080, 1920, 60
CX, CY, R = W / 2, 1060, 430
R_KM = 6371.0
HALF_MIN = 42.2
VMAX_KMH = math.sqrt(9.81 * 6.371e6) * 3.6
T_JUMP, T_ARRIVE = 6.0, 44.0
st = S.Stick(120, (1, 1, 1))
YEL = (1, 0.82, 0.25)


def tau_min(t):
    """Simulated minutes since the jump."""
    if t < T_JUMP:
        return 0.0
    return (t - T_JUMP) / (T_ARRIVE - T_JUMP) * HALF_MIN


def phase(t):
    return math.pi * tau_min(t) / HALF_MIN


def bg(c):
    g = cairo.LinearGradient(0, 0, 0, H)
    g.add_color_stop_rgb(0, 0.03, 0.07, 0.16)
    g.add_color_stop_rgb(1, 0.01, 0.03, 0.08)
    c.set_source(g)
    c.paint()


def earth(c):
    layers = [(1.0, (0.25, 0.45, 0.85)), (0.985, (0.45, 0.3, 0.2)), (0.95, (0.8, 0.35, 0.15)),
              (0.55, (0.95, 0.55, 0.15)), (0.19, (1.0, 0.85, 0.35))]
    for f, col in layers:
        c.set_source_rgb(*col)
        c.arc(CX, CY, R * f, 0, 2 * math.pi)
        c.fill()
    c.set_source_rgb(0.02, 0.02, 0.03)
    c.rectangle(CX - 26, CY - R - 4, 52, 2 * R + 8)
    c.fill()
    for f, name in ((0.97, "Crust + mantle"), (0.55, "Outer core"), (0.19, "Inner core")):
        pass
    text(c, "Mantle", CX + 200, CY - 250, 30, (1, 1, 1), alpha=0.8)
    text(c, "Outer core", CX + 150, CY - 100, 30, (0.2, 0.1, 0.05), alpha=0.9)
    text(c, "Inner core", CX - 160, CY + 10, 26, (0.2, 0.1, 0.05), alpha=0.9)


def frame(c, t):
    bg(c)
    ph = phase(t)
    y_now = CY - R * math.cos(ph) if t >= T_JUMP else CY - R
    zin = S.ease((t - T_JUMP) / 2.0) * (1 - S.ease((t - 47) / 2.5))
    z = 1 + 0.35 * zin
    fy = H / 2 + (y_now - H / 2) * zin
    camera(c, W, H, t, zoom=z, fx=CX, fy=min(max(fy, 500), 1600))
    scene(c, t)
    c.restore()
    vignette(c, W, H, 0.4)
    hud(c, t)


def scene(c, t):
    earth(c)
    ph = phase(t)
    if t < T_JUMP:
        # stand at the edge, then hop in
        u = max(0.0, (t - 4.5) / 1.5)
        y_feet = CY - R - 2 - math.sin(u * math.pi) * 60
        x = CX - 120 + min(1, t / 4) * 120 if t < 4.5 else CX
        pose = S.walk(t * 7) if t < 4 else (S.CROUCH if t < 4.6 else S.ARMS_UP)
        st.draw(c, pose, x, st.ground_y(pose, y_feet), 1, "smile")
    else:
        y = CY - R * math.cos(ph)
        expr = "shock" if math.cos(ph) > 0.3 else ("happy" if math.cos(ph) > -0.3 else "flat")
        sp = abs(math.sin(ph))
        c.set_source_rgba(1, 1, 1, 0.35 * sp)
        c.set_line_width(3)
        for k in range(8):
            ly = y - 200 + ((k * 61 + t * 2500 * (1 if math.sin(ph) > 0 else -1)) % 400)
            lx = CX - 18 + (k * 13) % 36
            c.move_to(lx, ly)
            c.line_to(lx, ly - 60 * sp)
        c.stroke()
        if abs(math.cos(ph)) < 0.55 and int(t * 30) % 2 == 0:
            FX.emit(CX + FX.r.uniform(-20, 20), y + FX.r.uniform(-30, 30), 2, [(1, 0.8, 0.3), (1, 0.5, 0.15)],
                    speed=(60, 200), up=0, life=(0.3, 0.7), size=(3, 6), gravity=0)
        st.draw(c, S.ARMS_UP, CX, y - 10, 1, expr, t=t)
    FX.step_draw(c, t)


def hud(c, t):
    ph = phase(t)
    text(c, "What if you jumped", W / 2, 150, 70)
    text(c, "THROUGH the Earth?", W / 2, 235, 70, YEL)
    # HUD
    tm = tau_min(t)
    v = VMAX_KMH * abs(math.sin(ph)) if t >= T_JUMP else 0.0
    depth = R_KM * (1 - math.cos(ph)) if t >= T_JUMP else 0.0
    rounded(c, 50, 1540, 300, 130, 22)
    c.set_source_rgba(0.02, 0.04, 0.1, 0.8)
    c.fill()
    rounded(c, 390, 1540, 300, 130, 22)
    c.fill()
    rounded(c, 730, 1540, 300, 130, 22)
    c.fill()
    text(c, "TIME", 200, 1585, 26, (0.6, 0.65, 0.75))
    text(c, f"{int(tm)}:{int(tm * 60) % 60:02d} min", 200, 1645, 44)
    text(c, "SPEED", 540, 1585, 26, (0.6, 0.65, 0.75))
    text(c, f"{v:,.0f} km/h", 540, 1645, 44, YEL)
    text(c, "DEPTH", 880, 1585, 26, (0.6, 0.65, 0.75))
    text(c, f"{min(depth, 2 * R_KM):,.0f} km", 880, 1645, 44)
    text(c, "Thought experiment: no air, no heat, uniform Earth", W / 2, 1880, 26, (0.55, 0.6, 0.7),
         bold=False)
    if t > 56:
        end_card(c, W, H, [("42 MINUTES", 110, YEL), ("to the other side of the planet", 50, (1, 1, 1)),
                           ("Would you jump?", 44, (0.8, 0.8, 0.8))], t - 56)
    word_captions(c, CHUNKS, t, W / 2, 1780 if t < 56 else 1450, 70)


def sound(a):
    narrated_sound(a, NARR, _music)


def _music(a):
    a.music(0, 60, bpm=88, chords=((0, 3, 7), (5, 8, 12), (3, 7, 10), (7, 10, 14)), root=174.6, vol=0.45)
    a.add(4.6, "whoosh", 500, 0.4)
    # rising / falling whoosh with speed
    k = 0
    tt = T_JUMP
    while tt < 56:
        sp = abs(math.sin(phase(tt)))
        a.add(tt, "whoosh", 200 + 800 * sp, 0.05 + 0.25 * sp)
        tt += 0.35
        k += 1
    for i, n in enumerate((7, 9, 11)):
        a.add(25 + 0.12 * i, "bell", SCALE[n], 0.25)
    for i, n in enumerate((9, 11, 14, 16)):
        a.add(T_ARRIVE + 0.12 * i, "bell", SCALE[n], 0.3)


if __name__ == "__main__":
    import sys
    import lib
    lib.run(sys.modules[__name__], sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else None)
