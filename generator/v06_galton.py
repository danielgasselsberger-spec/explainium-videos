"""V06 (Short): 2,500 random balls fall through pegs and draw a perfect bell curve (Galton board)."""
import math
import sys

import numpy as np

from lib import FPS, SCALE, Video, end_card, fmt, hsv, text

W, H, DUR = 1080, 1920, 60
CX = W / 2
ROWS = 14
DX = 64.0
DY = DX * 0.866
PY0 = 470.0
PR = 5.0
BR = 4.2
BIN_TOP = PY0 + ROWS * DY + 20
BIN_BOT = 1810.0
NBINS = ROWS + 1
TOTAL = 2500
G = 1600.0
SUB = 6
RELEASE_END = 46.0
SHOW_CURVE = 52.0


def release_count(t):
    """Cumulative balls released by time t: slow start, then fast."""
    u = min(1.0, t / RELEASE_END)
    return int(TOTAL * (0.15 * u + 0.85 * u ** 2.2))


def simulate(seed=3):
    rng = np.random.default_rng(seed)
    x = np.zeros(0); y = np.zeros(0); vx = np.zeros(0); vy = np.zeros(0); hue = np.zeros(0)
    bins = np.zeros(NBINS, np.int64)
    bin_hue = [[] for _ in range(NBINS)]
    released = 0
    t, dt = 0.0, 1 / FPS / SUB
    frames, events = [], []
    for f in range(DUR * FPS):
        for _ in range(SUB):
            t += dt
            want = release_count(t)
            if want > released:
                k = want - released
                x = np.concatenate([x, CX + rng.uniform(-3, 3, k)])
                y = np.concatenate([y, PY0 - 60 - rng.uniform(0, 40, k)])
                vx = np.concatenate([vx, rng.uniform(-20, 20, k)])
                vy = np.concatenate([vy, rng.uniform(0, 60, k)])
                hue = np.concatenate([hue, (np.arange(released, want) / TOTAL * 0.8)])
                released = want
            vy += G * dt
            x += vx * dt
            y += vy * dt
            row = np.rint((y - PY0) / DY)
            ok = (row >= 0) & (row < ROWS)
            j = np.clip(np.rint((x - CX) / DX + row / 2), 0, np.maximum(row, 0))
            px = CX + (j - row / 2) * DX
            py = PY0 + row * DY
            ddx, ddy = x - px, y - py
            d = np.sqrt(ddx ** 2 + ddy ** 2) + 1e-9
            hit = ok & (d < PR + BR)
            if hit.any():
                nx, ny = ddx[hit] / d[hit], ddy[hit] / d[hit]
                vn = vx[hit] * nx + vy[hit] * ny
                neg = vn < 0
                m = hit.sum()
                # fair coin at every peg: hop half a peg spacing left or right
                side = rng.choice([-1.0, 1.0], m)
                new_vx = side * rng.uniform(112, 132, m)
                new_vy = -rng.uniform(20, 70, m)
                vx[hit] = np.where(neg, new_vx, vx[hit])
                vy[hit] = np.where(neg, new_vy, vy[hit])
                x[hit] = px[hit] + nx * (PR + BR)
                y[hit] = py[hit] + ny * (PR + BR)
            vx *= 0.999
            lim = (ROWS / 2 + 0.5) * DX
            x = np.clip(x, CX - lim + BR, CX + lim - BR)
            landed = y > BIN_TOP + 10
            if landed.any():
                b = np.clip(np.floor((x[landed] - (CX - NBINS / 2 * DX)) / DX), 0, NBINS - 1).astype(int)
                for bb, hh in zip(b, hue[landed]):
                    bins[bb] += 1
                    bin_hue[bb].append(hh)
                    events.append((t, bb))
                keep = ~landed
                x, y, vx, vy, hue = x[keep], y[keep], vx[keep], vy[keep], hue[keep]
        frames.append((x.copy(), y.copy(), hue.copy(), bins.copy(), t, released))
    return frames, events, bin_hue


def render(out, preview=None):
    frames, events, bin_hue = simulate()
    final = frames[-1][3]
    print("bins", final.tolist(), "sum", final.sum())
    ks = np.arange(NBINS)
    fmean = float((ks * final).sum() / final.sum())
    fvar = float((((ks - fmean) ** 2) * final).sum() / final.sum())
    v = Video(out, W, H, DUR, preview, 150)
    last = -1
    for et, b in events:
        if et - last > 0.045:
            v.audio.add(et, "tick", SCALE[3 + abs(b - 7)] * 2, 0.18)
            last = et
    v.audio.pad(0, DUR, [130.8, 196.0, 261.6], 0.02)
    for i, nn in enumerate((7, 9, 11, 14, 16)):
        v.audio.add(SHOW_CURVE + 0.12 * i, "bell", SCALE[nn], 0.3)
    per_row = int(DX // (2 * BR))
    left = CX - NBINS / 2 * DX
    for f, (xs, ys, hs, bins, t, released) in enumerate(frames):
        c = v.ctx()
        # pegs
        c.set_source_rgb(0.55, 0.6, 0.7)
        for i in range(ROWS):
            for j in range(i + 1):
                c.arc(CX + (j - i / 2) * DX, PY0 + i * DY, PR, 0, 2 * math.pi)
                c.fill()
        # bin walls
        c.set_source_rgba(1, 1, 1, 0.35)
        c.set_line_width(2)
        for k in range(NBINS + 1):
            c.move_to(left + k * DX, BIN_TOP)
            c.line_to(left + k * DX, BIN_BOT)
        c.move_to(left, BIN_BOT)
        c.line_to(left + NBINS * DX, BIN_BOT)
        c.stroke()
        # settled balls
        for k in range(NBINS):
            n = bins[k]
            hues = bin_hue[k]
            for m in range(n):
                rr, cc = divmod(m, per_row)
                bx = left + k * DX + BR + 1 + cc * (DX - 2) / per_row
                by = BIN_BOT - BR - 1 - rr * 2 * BR * 0.98
                c.set_source_rgb(*hsv(hues[m], 0.7, 1))
                c.arc(bx, by, BR, 0, 2 * math.pi)
                c.fill()
        for i in range(len(xs)):
            c.set_source_rgb(*hsv(hs[i], 0.7, 1))
            c.arc(xs[i], ys[i], BR, 0, 2 * math.pi)
            c.fill()
        if t >= SHOW_CURVE:
            a = min(1, (t - SHOW_CURVE) / 1.0)
            mean, var = fmean, fvar
            c.set_source_rgba(1, 0.82, 0.25, a)
            c.set_line_width(7)
            for s in range(201):
                xx = s / 200 * NBINS - 0.5
                dens = math.exp(-((xx - mean) ** 2) / (2 * var)) / math.sqrt(2 * math.pi * var)
                hpx = dens * TOTAL * (2 * BR * 0.98) / per_row
                X = left + (xx + 0.5) * DX
                Y = BIN_BOT - hpx
                (c.move_to if s == 0 else c.line_to)(X, Y)
            c.stroke()
            text(c, "The bell curve: pure chance, perfect shape.", W / 2, BIN_BOT + 70, 44, (1, 0.82, 0.25), alpha=a)
        text(c, f"{fmt(TOTAL)} random balls.", W / 2, 200, 70)
        text(c, "Watch what shape they make.", W / 2, 285, 58, (1, 0.82, 0.25))
        text(c, f"Dropped: {fmt(released)}", W / 2, 350, 44, (0.65, 0.65, 0.65), bold=False)
        v.emit(f)
    v.finish()


if __name__ == "__main__":
    render(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else None)
