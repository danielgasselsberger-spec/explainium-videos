"""V02 (Short): Every bounce makes the ball bigger. Does it fill the circle?"""
import math
import sys

from lib import FPS, SCALE, Video, end_card, hsv, text

W, H, DUR = 1080, 1920, 60
CX, CY, R = W / 2, H / 2 + 40, 440
G = 1500.0
SUB = 8
R_START = 10
FILL = 0.96


def simulate(dr, record=False):
    x, y, vx, vy, r = CX + 60, CY - 150, 430.0, 0.0, float(R_START)
    t, dt = 0.0, 1 / FPS / SUB
    frames, events, done = [], [], None
    for f in range(DUR * FPS):
        for _ in range(SUB):
            t += dt
            if done:
                break
            vy += G * dt
            x += vx * dt
            y += vy * dt
            dx, dy = x - CX, y - CY
            d = math.hypot(dx, dy) or 1e-9
            if d + r > R:
                nx, ny = dx / d, dy / d
                vn = vx * nx + vy * ny
                if vn > 0:
                    vx -= 2 * vn * nx
                    vy -= 2 * vn * ny
                    sp = math.hypot(vx, vy)
                    tgt = max(sp, 650)
                    vx, vy = vx / sp * tgt, vy / sp * tgt
                    r += dr
                    events.append((t, len(events)))
                    if r >= R * FILL:
                        r = R * FILL
                        done = t
                x, y = CX + nx * (R - r), CY + ny * (R - r)
        if record:
            frames.append((x, y, r, t))
    return done, frames, events


def tune(target=54.0):
    lo, hi = 0.3, 6.0
    for _ in range(30):
        mid = (lo + hi) / 2
        d = simulate(mid)[0] or 999
        if d > target:
            lo = mid
        else:
            hi = mid
    return hi


def render(out, preview=None):
    dr = tune()
    done, frames, events = simulate(dr, record=True)
    print("dr", dr, "done", done, "bounces", len(events))
    v = Video(out, W, H, DUR, preview, 150)
    # melody: rising pentatonic walk, wraps
    for et, k in events:
        v.audio.add(et, "pluck", SCALE[2 + (k % 14)], 0.22)
    if done:
        v.audio.add(done, "boom", 60, 0.6)
        for i, n in enumerate((9, 11, 14, 16)):
            v.audio.add(done + 0.1 * i, "bell", SCALE[n], 0.3)
    trail = []
    ev_i = 0
    for f, (x, y, r, t) in enumerate(frames):
        while ev_i < len(events) and events[ev_i][0] <= t:
            ev_i += 1
        c = v.ctx()
        trail.append((x, y, r))
        trail = trail[-14:]
        for i, (tx, ty, tr) in enumerate(trail[:-1]):
            a = (i + 1) / len(trail)
            c.set_source_rgba(*hsv(t / 25 + i * 0.01), 0.18 * a)
            c.arc(tx, ty, tr, 0, 2 * math.pi)
            c.fill()
        col = hsv(t / 25)
        c.set_source_rgb(*col)
        c.arc(x, y, r, 0, 2 * math.pi)
        c.fill()
        c.set_source_rgba(1, 1, 1, 0.9)
        c.set_line_width(3)
        c.arc(x, y, r, 0, 2 * math.pi)
        c.stroke()
        c.set_source_rgb(1, 1, 1)
        c.set_line_width(6)
        c.arc(CX, CY, R + 3, 0, 2 * math.pi)
        c.stroke()
        text(c, "Every bounce makes", W / 2, 230, 72)
        text(c, "the ball BIGGER", W / 2, 318, 72, (1, 0.82, 0.25))
        pct = (r / R) ** 2 * 100
        text(c, f"Bounces: {ev_i}", W / 2, CY + R + 140, 64)
        text(c, f"Fills {pct:4.1f}% of the circle", W / 2, CY + R + 205, 40, (0.6, 0.6, 0.6), bold=False)
        if done and t > done:
            end_card(c, W, H, [("IT'S FULL!", 130, (1, 0.82, 0.25)),
                               (f"{len(events)} bounces", 60, (1, 1, 1)),
                               ("Did you guess more or less?", 40, (0.75, 0.75, 0.75))], t - done)
        v.emit(f)
    v.finish()


if __name__ == "__main__":
    render(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else None)
