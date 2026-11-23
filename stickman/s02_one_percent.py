"""S02 (Short): 1% better vs 1% worse every day for a year. 1.01^365 = 37.8x, 0.99^365 = 0.03x."""
import math

import stick as S
from lib import INK, SCALE, caption, end_card, fade, paper, rounded, text

W, H, DUR = 1080, 1920, 60
GX0, GX1 = 110, 1000
GY0, GY1 = 1500, 520  # y for value 0 and value YMAX
YMAX = 40.0
GREEN, RED = (0.2, 0.65, 0.35), (0.85, 0.25, 0.25)
st = S.Stick(150, INK)


KEYS = [(0, 0), (3, 0), (4, 1), (7, 1), (16, 100), (21, 100), (30, 200), (35, 200), (45, 365)]


def day_at(t):
    for (t0, d0), (t1, d1) in zip(KEYS, KEYS[1:]):
        if t0 <= t < t1:
            return d0 + (d1 - d0) * (t - t0) / (t1 - t0)
    return 365.0


def moving(t):
    return any(t0 <= t < t1 and d0 != d1 for (t0, d0), (t1, d1) in zip(KEYS, KEYS[1:]))


def gx(d):
    return GX0 + (GX1 - GX0) * d / 365


def gy(v):
    return GY0 + (GY1 - GY0) * v / YMAX


def frame(c, t):
    paper(c, W, H)
    text(c, "1% better every day", W / 2, 150, 70, GREEN)
    text(c, "vs 1% worse every day", W / 2, 235, 70, RED)
    d = day_at(t)
    up, down = 1.01 ** d, 0.99 ** d
    # axes
    c.set_source_rgb(*INK)
    c.set_line_width(4)
    c.move_to(GX0, GY1 - 40)
    c.line_to(GX0, GY0)
    c.line_to(GX1 + 20, GY0)
    c.stroke()
    for v in (10, 20, 30, 40):
        c.set_source_rgba(*INK, 0.15)
        c.set_line_width(2)
        c.move_to(GX0, gy(v))
        c.line_to(GX1, gy(v))
        c.stroke()
        text(c, f"{v}x", GX0 - 12, gy(v) + 12, 30, (0.45, 0.45, 0.5), bold=False, align="right")
    text(c, "1x", GX0 - 12, gy(1) + 12, 30, (0.45, 0.45, 0.5), bold=False, align="right")
    for dd in (0, 100, 200, 300, 365):
        text(c, f"Day {dd}", gx(dd), GY0 + 48, 28, (0.45, 0.45, 0.5), bold=False)
    # curves
    for base, col in ((1.01, GREEN), (0.99, RED)):
        c.set_source_rgb(*col)
        c.set_line_width(8)
        n = max(2, int(d))
        for k in range(n + 1):
            dk = d * k / n
            (c.move_to if k == 0 else c.line_to)(gx(dk), gy(base ** dk))
        c.stroke()
    # stickmen riding the curves
    x = gx(d)
    slope = (gy(1.01 ** (d + 3)) - gy(up)) / (gx(d + 3) - x)
    pose = S.walk(t * 8) if moving(t) else dict(S.STAND)
    pose["lean"] += min(22, -math.degrees(math.atan(slope)) * 0.35)
    st.draw(c, pose, x, st.ground_y(pose, gy(up)), 1, "smile" if d > 30 else "flat", color=GREEN,
            muscle=min(1.0, d / 365))
    yb = gy(down)
    if d < 40:
        pose_b = S.walk(t * 4) if moving(t) else dict(S.STAND)
        st.draw(c, pose_b, x, st.ground_y(pose_b, yb), 1, "flat", color=RED)
    else:
        st.draw(c, S.LIE, x + 40, yb - 14, 1, "sad", color=RED, belly=min(1.0, d / 365) * 1.4)
    # value labels
    rounded(c, 60, 300, 450, 150, 24)
    c.set_source_rgb(1, 1, 1)
    c.fill()
    rounded(c, 570, 300, 450, 150, 24)
    c.fill()
    text(c, f"{up:.2f}x", 285, 395, 72, GREEN)
    text(c, f"{down:.2f}x", 795, 395, 72, RED)
    text(c, f"Day {int(d)}", W / 2, 1640, 64, INK)
    beats = [(3.5, 7.5, "Day 1: 1.01 vs 0.99. Nobody notices.", None),
             (15.5, 21.5, "Day 100: 2.70x vs 0.37x", None),
             (29.5, 35.5, "Day 200: 7.32x vs 0.13x", None),
             (44.5, 51, "Day 365: 37.8x better... or almost nothing left.", None)]
    for a, b, s, hl in beats:
        al = fade(t, a, b)
        if al:
            caption(c, s, W / 2, 1760, 46, 960, alpha=al, hl=hl)
    if t > 51:
        end_card(c, W, H, [("1.01^365 = 37.8", 96, (1, 0.82, 0.25)), ("0.99^365 = 0.03", 96, (1, 0.45, 0.45)),
                           ("Tiny habits. Huge difference.", 52, (1, 1, 1)),
                           ("What's your 1% today?", 42, (0.8, 0.8, 0.8))], t - 51)


def sound(a):
    a.music(0, 60, bpm=104, chords=((0, 4, 7), (5, 9, 12), (9, 12, 16), (7, 11, 14)), root=196.0, vol=0.55)
    for k, tt in enumerate((4, 16, 30, 45)):
        a.add(tt, "pop", 500, 0.3)
        a.add(tt, "bell", SCALE[7 + 2 * k], 0.2)
    for i, n in enumerate((9, 11, 14, 16)):
        a.add(51 + 0.12 * i, "bell", SCALE[n], 0.3)


if __name__ == "__main__":
    import sys
    import lib
    lib.run(sys.modules[__name__], sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else None)
