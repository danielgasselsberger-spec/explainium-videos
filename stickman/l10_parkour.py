"""L10 (landscape): Can he beat all 10 levels? Neon parkour with fails, an attempt counter and a slow-mo finale."""
import math
import sys

import cairo

import stick as S
from lib import FPS, SCALE, Video, caption, end_card, fade, rounded, text

W, H, DUR = 1920, 1080, 60
GY = 820
CYAN = (0.2, 0.95, 1.0)
PINK = (1.0, 0.3, 0.7)
YEL = (1, 0.82, 0.25)
st = S.Stick(190, (1, 1, 1))

# platforms per level: list of (x0, x1); the gaps between them must be jumped
LEVELS = [
    [(0, 700), (860, 1920)],
    [(0, 600), (780, 1200), (1380, 1920)],
    [(0, 520), (720, 1000), (1200, 1920)],
    [(0, 480), (700, 900), (1120, 1350), (1560, 1920)],
    [(0, 500), (760, 980), (1240, 1920)],
    [(0, 420), (660, 820), (1060, 1220), (1460, 1920)],
    [(0, 460), (760, 900), (1200, 1920)],
    [(0, 380), (660, 780), (1060, 1180), (1460, 1920)],
    [(0, 360), (680, 780), (1100, 1200), (1520, 1920)],
    [(0, 520), (1400, 1920)],
]
# failed attempts: level index -> list of gap indices where an attempt fails (in order)
FAILS = {1: [1], 3: [0, 2], 5: [1], 6: [1], 7: [2], 8: [2, 2], 9: [0, 0]}
FAIL_LINES = ["Nope.", "Too short!", "Again...", "So close!", "AAAA!", "Not like this.", "Try again.",
              "Why?!", "Okay, one more.", "Seriously?!", "Almost!"]
RUN = 1100.0
JUMP_T = 0.52
SLOWMO = 3.0


def build():
    """Returns list of keyframe segments: (t0, t1, level, kind, x0, y0, x1, y1, attempt, extra)."""
    segs = []
    t = 0.6
    attempt = 1
    for li, plats in enumerate(LEVELS):
        fails = list(FAILS.get(li, []))
        while True:
            fail_at = fails[0] if fails else None
            x = 60.0
            failed = False
            for gi in range(len(plats)):
                edge = plats[gi][1] - 40 if gi < len(plats) - 1 else 1920 + 80
                d = (edge - x) / RUN
                segs.append((t, t + d, li, "run", x, GY, edge, GY, attempt, None))
                t += d
                x = edge
                if gi == len(plats) - 1:
                    break
                nxt0 = plats[gi + 1][0]
                final = li == len(LEVELS) - 1 and fail_at is None
                jt = JUMP_T * (1.25 if final else 1.0) * (SLOWMO if final else 1.0)
                if fail_at == gi:
                    mid = (x + nxt0) / 2 + 40
                    segs.append((t, t + JUMP_T * 0.7, li, "jumpfail", x, GY, mid, GY + 60, attempt, None))
                    t += JUMP_T * 0.7
                    segs.append((t, t + 0.75, li, "fall", mid, GY + 60, mid + 30, H + 250, attempt, None))
                    t += 0.75
                    failed = True
                    fails.pop(0)
                    break
                tgt = nxt0 + 50
                segs.append((t, t + jt, li, "jump", x, GY, tgt, GY, attempt, "final" if final else None))
                t += jt
                x = tgt
            attempt += 1
            if not failed:
                segs.append((t, t + 0.7, li, "clear", 1920 + 80, GY, 1920 + 80, GY, attempt - 1, None))
                t += 0.7
                break
            segs.append((t, t + 0.35, li, "respawn", 60, GY, 60, GY, attempt, None))
            t += 0.35
    return segs, t


SEGS, T_END = build()
FAIL_TIMES = [s[0] for s in SEGS if s[3] == "fall"]


def seg_at(t):
    for s in SEGS:
        if s[0] <= t < s[1]:
            return s
    return SEGS[-1]


def bg(c, t):
    g = cairo.LinearGradient(0, 0, 0, H)
    g.add_color_stop_rgb(0, 0.04, 0.02, 0.12)
    g.add_color_stop_rgb(1, 0.1, 0.02, 0.18)
    c.set_source(g)
    c.paint()
    c.set_source_rgba(1, 0.3, 0.8, 0.12)
    c.set_line_width(2)
    for k in range(25):
        x = (k * 90 - t * 40) % (W + 90)
        c.move_to(x, GY + 20)
        c.line_to(W / 2 + (x - W / 2) * 3, H)
    c.stroke()


def neon_rect(c, x0, y0, x1, y1, col):
    for w, a in ((16, 0.15), (8, 0.3), (3, 1.0)):
        c.set_source_rgba(*col, a)
        c.set_line_width(w)
        c.rectangle(x0, y0, x1 - x0, y1 - y0)
        c.stroke()
    c.set_source_rgba(*col, 0.12)
    c.rectangle(x0, y0, x1 - x0, y1 - y0)
    c.fill()


def frame(c, t):
    s = seg_at(t)
    t0, t1, li, kind, x0, y0, x1, y1, attempt, extra = s
    u = (t - t0) / max(1e-6, t1 - t0) if t < T_END else 1.0
    bg(c, t)
    for (a, b) in LEVELS[li]:
        neon_rect(c, a, GY, b, GY + 200, CYAN)
    # spikes in the gaps
    plats = LEVELS[li]
    c.set_source_rgba(*PINK, 0.9)
    for (a0, a1), (b0, b1) in zip(plats, plats[1:]):
        k = a1 + 10
        while k < b0 - 20:
            c.move_to(k, H)
            c.line_to(k + 20, H - 50)
            c.line_to(k + 40, H)
            k += 40
    c.fill()
    # stickman
    if kind == "run":
        x, y = x0 + (x1 - x0) * u, GY
        pose, expr = S.walk(t * 16, run=True), "flat"
    elif kind in ("jump", "jumpfail"):
        x = x0 + (x1 - x0) * u
        peak = 210 if extra == "final" else 150
        y = y0 + (y1 - y0) * u - peak * 4 * u * (1 - u)
        pose = S.lerp_pose(S.CROUCH, S.ARMS_UP if extra == "final" else S.walk(1.2, run=True), math.sin(u * math.pi))
        expr = "shock" if kind == "jumpfail" else ("happy" if extra == "final" and u > 0.5 else "flat")
    elif kind == "fall":
        x, y = x0 + (x1 - x0) * u, y0 + (y1 - y0) * u * u
        pose, expr = S.ARMS_UP, "scream"
    elif kind == "respawn":
        x, y = 60, GY
        pose, expr = S.STAND, "sad"
    else:
        x, y = 1920 + 80, GY
        pose, expr = S.STAND, "happy"
    if kind == "respawn":
        a = 0.3 + 0.7 * abs(math.sin(u * math.pi * 3))
        st.draw(c, pose, x, st.ground_y(pose, y), 1, expr, alpha=a)
    else:
        st.draw(c, pose, x, st.ground_y(pose, y), 1, expr)
    # HUD
    rounded(c, 30, 30, 360, 110, 22)
    c.set_source_rgba(0, 0, 0, 0.6)
    c.fill()
    text(c, f"LEVEL {li + 1}/10", 210, 105, 54, CYAN)
    rounded(c, W - 420, 30, 390, 110, 22)
    c.set_source_rgba(0, 0, 0, 0.6)
    c.fill()
    text(c, f"ATTEMPTS: {attempt}", W - 225, 105, 54, PINK)
    text(c, "Can he beat all 10 levels?", W / 2, 105, 64, (1, 1, 1))
    for k, ft in enumerate(FAIL_TIMES):
        al = fade(t, ft, ft + 1.2, 0.15)
        if al:
            text(c, FAIL_LINES[k % len(FAIL_LINES)], W / 2, 420, 110, PINK, alpha=al)
    if kind == "clear":
        text(c, f"LEVEL {li + 1} CLEAR", W / 2, 420, 110, CYAN, alpha=fade(t, t0, t1, 0.15))
    if extra == "final" and kind == "jump":
        text(c, "SLOW MOTION", W / 2, 300, 50, YEL, alpha=0.8)
    if t > T_END + 0.2:
        end_card(c, W, H, [("ALL 10 LEVELS!", 110, YEL), (f"in {attempt} attempts", 60, (1, 1, 1)),
                           ("How many would YOU need?", 44, (0.8, 0.8, 0.8))], t - T_END - 0.2)


def sound(a):
    a.music(0, 60, bpm=128, chords=((0, 3, 7), (8, 12, 15), (5, 8, 12), (7, 11, 14)), root=220.0, vol=0.55)
    for sgm in SEGS:
        t0, t1, li, kind = sgm[:4]
        if kind in ("jump", "jumpfail"):
            a.add(t0, "whoosh", 900, 0.25)
            if kind == "jump":
                a.add(t1, "tick", 700, 0.25)
        elif kind == "fall":
            a.add(t0, "pluck", SCALE[8], 0.2)
            a.add(t0 + 0.15, "pluck", SCALE[6], 0.2)
            a.add(t0 + 0.3, "pluck", SCALE[3], 0.2)
            a.add(t1 - 0.2, "thud", 70, 0.4)
        elif kind == "clear":
            for i, n in enumerate((9, 11, 14)):
                a.add(t0 + 0.08 * i, "bell", SCALE[n], 0.22)
    for i, n in enumerate((9, 11, 14, 16, 18)):
        a.add(T_END + 0.12 * i, "bell", SCALE[n], 0.3)


if __name__ == "__main__":
    if sys.argv[1] == "info":
        print("end", round(T_END, 2), "attempts", SEGS[-1][8], "fails", len(FAIL_TIMES))
    else:
        import lib
        lib.run(sys.modules[__name__], sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else None)
