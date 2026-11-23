"""V03 (Short): Every ball that escapes spawns 2 new balls. How long until 1,000?"""
import math
import random
import sys

import numpy as np
from numba import njit

from lib import FPS, SCALE, Video, end_card, fmt, hsv, text
from physics import collide_balls

W, H, DUR = 1080, 1920, 60
CX, CY, R = W / 2, H / 2 + 40, 430
BR = 9.0
G = 900.0
SUB = 6
CAP = 600
MAXN = CAP + 60


@njit(cache=True)
def ring(x, y, vx, vy, r, n, cx, cy, R, gc, half, out, vmin):
    """Bounce off ring except through gap. out[i]=1 when ball i has left the ring."""
    for i in range(n):
        dx, dy = x[i] - cx, y[i] - cy
        d = np.sqrt(dx * dx + dy * dy) + 1e-9
        if d + r[i] > R:
            a = np.arctan2(dy, dx)
            diff = (a - gc + np.pi) % (2 * np.pi) - np.pi
            if abs(diff) < half - np.arcsin(min(1.0, r[i] / R)):
                if d - r[i] > R:
                    out[i] = 1
            elif d < R + r[i]:
                nx, ny = dx / d, dy / d
                vn = vx[i] * nx + vy[i] * ny
                if vn > 0:
                    vx[i] -= 2.0 * vn * nx
                    vy[i] -= 2.0 * vn * ny
                    sp = np.sqrt(vx[i] ** 2 + vy[i] ** 2) + 1e-9
                    if sp < vmin:
                        vx[i] *= vmin / sp
                        vy[i] *= vmin / sp
                x[i] = cx + nx * (R - r[i])
                y[i] = cy + ny * (R - r[i])


def simulate(seed, gap_deg, spin, record=False, g=G, vmin=0.0):
    rnd = random.Random(seed)
    x = np.zeros(MAXN); y = np.zeros(MAXN); vx = np.zeros(MAXN); vy = np.zeros(MAXN)
    r = np.full(MAXN, BR); hue = np.zeros(MAXN)
    n = 1
    x[0], y[0], vx[0], vy[0] = CX, CY - 100, rnd.uniform(-400, 400), 0
    half = math.radians(gap_deg) / 2
    t, dt = 0.0, 1 / FPS / SUB
    gw = gh = int(2 * R / (2 * BR)) + 2
    total = 1
    frames, events, done = [], [], None
    falling = []
    for f in range(DUR * FPS):
        for _ in range(SUB):
            t += dt
            vy[:n] += g * dt
            x[:n] += vx[:n] * dt
            y[:n] += vy[:n] * dt
            for _ in range(2):
                collide_balls(x, y, vx, vy, r, n, 2 * BR, gw, gh, CX - R - BR, CY - R - BR, 0.6)
            out = np.zeros(n, np.int64)
            gc = spin * t
            if not done:
                ring(x, y, vx, vy, r, n, CX, CY, R, gc, half, out, vmin)
            else:
                ring(x, y, vx, vy, r, n, CX, CY, R, gc, 0.0, out, vmin)
            idx = np.nonzero(out)[0]
            for i in idx[::-1]:
                falling.append([x[i], y[i], vx[i], vy[i], hue[i], t])
                last = n - 1
                for arr in (x, y, vx, vy, hue):
                    arr[i] = arr[last]
                n -= 1
                events.append((t, "escape", total))
                for k in range(2):
                    if done:
                        break
                    a = rnd.uniform(0, 2 * math.pi)
                    x[n] = CX + rnd.uniform(-30, 30)
                    y[n] = CY - 120 + rnd.uniform(-30, 30)
                    vx[n] = math.cos(a) * 500
                    vy[n] = math.sin(a) * 500
                    hue[n] = (total * 0.618) % 1
                    n += 1
                    total += 1
                if n >= CAP and not done:
                    done = t
        if record:
            falling = [p for p in falling if p[1] < H + 30]
            for p in falling:
                p[3] += 900 / FPS
                p[0] += p[2] / FPS
                p[1] += p[3] / FPS
            frames.append((x[:n].copy(), y[:n].copy(), hue[:n].copy(), [tuple(p) for p in falling], t, spin * t, n))
        elif done and t > done + 1:
            break
    return done, frames, events


def search():
    res = []
    for gap in (60, 75, 90):
        for spin in (1.3, 1.8):
            for seed in range(6):
                d = simulate(seed, gap, spin)[0]
                print(gap, spin, seed, d, flush=True)
                if d and 48 <= d <= 55:
                    res.append((gap, spin, seed, d))
    print(res)


G_LOW, VMIN = 350.0, 650.0


def render(out, seed, gap, spin, preview=None):
    done, frames, events = simulate(seed, gap, spin, record=True, g=G_LOW, vmin=VMIN)
    print("done", done)
    v = Video(out, W, H, DUR, preview, 150)
    last_t = -1
    for et, kind, k in events:
        if et - last_t > 0.05:
            v.audio.add(et, "pluck", SCALE[4 + (k * 2) % 12], 0.18)
            last_t = et
    if done:
        v.audio.add(done, "boom", 60, 0.7)
        for i, nn in enumerate((9, 11, 14, 16)):
            v.audio.add(done + 0.1 * i, "bell", SCALE[nn], 0.3)
    half = math.radians(gap) / 2
    for f, (xs, ys, hs, falling, t, gc, n) in enumerate(frames):
        c = v.ctx()
        for (px, py, _, _, h, te) in falling:
            a = 0.6 * (1 - (t - te) / 0.9)
            if a <= 0:
                continue
            c.set_source_rgba(*hsv(h), a)
            c.arc(px, py, BR, 0, 2 * math.pi)
            c.fill()
        for i in range(len(xs)):
            c.set_source_rgb(*hsv(hs[i]))
            c.arc(xs[i], ys[i], BR, 0, 2 * math.pi)
            c.fill()
        c.set_source_rgb(1, 1, 1)
        c.set_line_width(6)
        h_ = 0 if (done and t > done) else half
        c.arc(CX, CY, R + 3, gc + h_, gc - h_ + 2 * math.pi)
        c.stroke()
        text(c, "Every escape =", W / 2, 230, 74)
        text(c, "2 NEW balls", W / 2, 320, 74, (1, 0.82, 0.25))
        text(c, f"Balls inside: {fmt(n)}", W / 2, CY + R + 140, 64)
        text(c, f"Goal: {fmt(CAP)}   ·   {t:4.1f} s", W / 2, CY + R + 205, 40, (0.6, 0.6, 0.6), bold=False)
        if done and t > done:
            end_card(c, W, H, [(f"{CAP} BALLS!", 120, (1, 0.82, 0.25)),
                               (f"from 1 ball in {done:.1f} s", 58, (1, 1, 1)),
                               ("That's exponential growth.", 40, (0.75, 0.75, 0.75))], t - done)
        v.emit(f)
    v.finish()


if __name__ == "__main__":
    if sys.argv[1] == "search":
        search()
    else:
        a = sys.argv
        render(a[2], int(a[3]), float(a[4]), float(a[5]), a[6] if len(a) > 6 else None)
