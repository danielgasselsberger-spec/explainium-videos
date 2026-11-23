"""V09 (landscape): 200 double pendulums, each started 0.000001° apart. Watch chaos take over."""
import math
import sys

import numpy as np

from lib import FPS, SCALE, Video, end_card, hsv, text

W, H, DUR = 1920, 1080, 60
N = 200
G_ = 9.81
L = 1.0
SUB = 24
PX, PY = W / 2, 420
SCALE_PX = 250
TH0 = math.radians(130)
END_T = 55.5


def deriv(s):
    t1, t2, w1, w2 = s
    d = t1 - t2
    den = 3 - np.cos(2 * d)
    a1 = (-3 * G_ * np.sin(t1) - G_ * np.sin(t1 - 2 * t2) - 2 * np.sin(d) * (w2 ** 2 + w1 ** 2 * np.cos(d))) / (L * den)
    a2 = (2 * np.sin(d) * (2 * w1 ** 2 + 2 * G_ * np.cos(t1) + w2 ** 2 * np.cos(d))) / (L * den)
    return np.array([w1, w2, a1, a2])


def simulate(delta_deg):
    off = np.radians(np.arange(N) * delta_deg)
    s = np.array([np.full(N, TH0), TH0 + off, np.zeros(N), np.zeros(N)])
    dt = 1 / FPS / SUB
    out = []
    for f in range(DUR * FPS):
        for _ in range(SUB):
            k1 = deriv(s)
            k2 = deriv(s + dt / 2 * k1)
            k3 = deriv(s + dt / 2 * k2)
            k4 = deriv(s + dt * k3)
            s = s + dt / 6 * (k1 + 2 * k2 + 2 * k3 + k4)
        out.append(s[:2].copy())
    return out


def spread(th):
    x2 = np.sin(th[0]) + np.sin(th[1])
    y2 = np.cos(th[0]) + np.cos(th[1])
    return float(np.hypot(x2 - x2.mean(), y2 - y2.mean()).max())


def render(out, delta_deg, preview=None):
    states = simulate(delta_deg)
    sp = [spread(s) for s in states]
    t_split = next((i / FPS for i, v in enumerate(sp) if v > 0.3), None)
    print("split at", t_split)
    v = Video(out, W, H, DUR, preview, 150)
    v.audio.pad(0, DUR, [110.0, 164.8, 220.0], 0.03)
    # a chime each time the spread grows another 4x
    thr = 0.002
    for i, s in enumerate(sp):
        if s > thr and thr < 3:
            v.audio.add(i / FPS, "bell", SCALE[3 + int(math.log(thr / 0.002, 4)) * 2], 0.25)
            thr *= 4
    # a soft tick each time pendulum #0's lower bob passes under the pivot
    prev = None
    for i, s in enumerate(states):
        x = math.sin(s[0][0]) + math.sin(s[1][0])
        if prev is not None and (prev < 0) != (x < 0):
            v.audio.add(i / FPS, "pluck", SCALE[5], 0.08)
        prev = x
    for f, th in enumerate(states):
        t = f / FPS
        c = v.ctx()
        x1 = PX + SCALE_PX * np.sin(th[0])
        y1 = PY + SCALE_PX * np.cos(th[0])
        x2 = x1 + SCALE_PX * np.sin(th[1])
        y2 = y1 + SCALE_PX * np.cos(th[1])
        c.set_line_width(2.2)
        for i in range(N):
            col = hsv(i / N * 0.85, 0.8, 1)
            c.set_source_rgba(*col, 0.55)
            c.move_to(PX, PY)
            c.line_to(x1[i], y1[i])
            c.line_to(x2[i], y2[i])
            c.stroke()
        for i in range(N):
            c.set_source_rgb(*hsv(i / N * 0.85, 0.8, 1))
            c.arc(x2[i], y2[i], 6, 0, 2 * math.pi)
            c.fill()
        c.set_source_rgb(1, 1, 1)
        c.arc(PX, PY, 8, 0, 2 * math.pi)
        c.fill()
        text(c, "200 double pendulums", 70, 110, 58, align="left")
        text(c, f"each started {delta_deg:.10f}° apart", 70, 175, 40, (1, 0.82, 0.25), align="left")
        text(c, f"{t:4.1f} s", W - 70, 110, 58, align="right")
        if t_split and t > t_split:
            a = min(1, (t - t_split) / 0.5) * max(0.0, min(1, (t_split + 4 - t) / 0.8))
            text(c, "CHAOS.", W - 70, 175, 48, (1, 0.35, 0.35), align="right", alpha=a)
        text(c, "Same physics. Almost the same start. Totally different ending.",
             W / 2, H - 50, 34, (0.6, 0.6, 0.6), bold=False)
        if t > END_T:
            end_card(c, W, H, [("THE BUTTERFLY EFFECT", 100, (1, 0.82, 0.25)),
                               ("A difference you can't measure", 50, (1, 1, 1)),
                               ("becomes a difference you can't miss.", 50, (1, 1, 1))], t - END_T)
        v.emit(f)
    v.finish()


if __name__ == "__main__":
    if sys.argv[1] == "probe":
        for dd in (1e-6, 1e-5, 1e-4):
            st = simulate(dd)
            sp = [spread(s) for s in st]
            print(dd, next((i / FPS for i, x in enumerate(sp) if x > 0.3), None), flush=True)
    else:
        render(sys.argv[2], float(sys.argv[3]), sys.argv[4] if len(sys.argv) > 4 else None)
