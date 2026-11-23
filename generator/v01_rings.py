"""V01 (Short): Can 1 ball break 40 rings? Concentric rotating rings with gaps; escaping breaks a ring."""
import math
import random
import sys

from lib import FPS, SCALE, Video, ball, end_card, hsv, text

W, H, DUR = 1080, 1920, 60
N_RINGS = 40
CX, CY = W / 2, H / 2 + 40
R0, R1 = 70, 470
BR = 13
G = 1400.0
SUB = 8


def ring_r(k):
    return R0 + (R1 - R0) * k / (N_RINGS - 1)


def simulate(seed, gap_deg, record=False):
    rnd = random.Random(seed)
    x, y = CX + rnd.uniform(-10, 10), CY
    a = rnd.uniform(0, 2 * math.pi)
    vx, vy = 520 * math.cos(a), 520 * math.sin(a)
    speeds = [(0.9 + 0.5 * rnd.random()) * (1 if k % 2 else -1) for k in range(N_RINGS)]
    offs = [rnd.uniform(0, 2 * math.pi) for _ in range(N_RINGS)]
    cur = 0
    t = 0.0
    dt = 1 / FPS / SUB
    frames, events = [], []
    done_t = None
    nframes = DUR * FPS
    for f in range(nframes):
        for _ in range(SUB):
            t += dt
            vy += G * dt
            x += vx * dt
            y += vy * dt
            if cur < N_RINGS:
                r = ring_r(cur)
                dx, dy = x - CX, y - CY
                d = math.hypot(dx, dy)
                if d + BR > r:
                    ang = math.atan2(dy, dx)
                    gc = offs[cur] + speeds[cur] * t
                    diff = (ang - gc + math.pi) % (2 * math.pi) - math.pi
                    half = math.radians(gap_deg) / 2 - math.asin(min(1, BR / r))
                    if abs(diff) < half:
                        if d - BR > r:  # fully through: ring breaks
                            events.append((t, "break", cur))
                            cur += 1
                            if cur == N_RINGS:
                                done_t = t
                    elif d < r + BR:
                        nx, ny = dx / d, dy / d
                        vn = vx * nx + vy * ny
                        if vn > 0:
                            vx -= 2 * vn * nx
                            vy -= 2 * vn * ny
                            # keep the energy up: small kick so it never settles
                            sp = math.hypot(vx, vy)
                            target = max(sp, 700)
                            vx, vy = vx / sp * target, vy / sp * target
                            events.append((t, "bounce", cur))
                        x, y = CX + nx * (r - BR), CY + ny * (r - BR)
        if record:
            frames.append((x, y, cur, t))
        if done_t and t > done_t + 1.5 and not record:
            break
    return done_t, frames, events, speeds, offs


def search():
    best = []
    for gap in (34, 38, 42, 46, 50):
        for seed in range(40):
            dt_, *_ = simulate(seed, gap)
            if dt_ and 52 <= dt_ <= 56.5:
                best.append((gap, seed, round(dt_, 2)))
        print(gap, [b for b in best if b[0] == gap][:5], flush=True)
    return best


def render(out, seed, gap, preview=None):
    done_t, frames, events, speeds, offs = simulate(seed, gap, record=True)
    v = Video(out, W, H, DUR, preview, 150)
    parts = []  # particles from broken rings: [x,y,vx,vy,life,hue]
    ev_i = 0
    events.sort()
    rnd = random.Random(1)
    for f, (x, y, cur, t) in enumerate(frames):
        while ev_i < len(events) and events[ev_i][0] <= t:
            et, kind, k = events[ev_i]
            ev_i += 1
            if kind == "break":
                v.audio.add(et, "pop", 300 + k * 6, 0.35)
                v.audio.add(et, "bell", SCALE[5 + k % 12], 0.22)
                r = ring_r(k)
                for i in range(70):
                    a = i / 70 * 2 * math.pi
                    sp = rnd.uniform(80, 380)
                    parts.append([CX + r * math.cos(a), CY + r * math.sin(a),
                                  math.cos(a) * sp, math.sin(a) * sp - 200, 1.0, k / N_RINGS])
            else:
                v.audio.add(et, "pluck", SCALE[3 + (k * 3) % 10], 0.12)
        c = v.ctx()
        # rings
        for k in range(cur, N_RINGS):
            r = ring_r(k)
            gc = offs[k] + speeds[k] * t
            half = math.radians(gap) / 2
            c.set_line_width(4 if k > cur else 6)
            col = hsv(k / N_RINGS * 0.85, 0.7, 1.0 if k == cur else 0.75)
            c.set_source_rgb(*col)
            c.arc(CX, CY, r, gc + half, gc - half + 2 * math.pi)
            c.stroke()
        # particles
        alive = []
        for p in parts:
            p[2] *= 0.99
            p[3] += 900 / FPS
            p[0] += p[2] / FPS
            p[1] += p[3] / FPS
            p[4] -= 1 / FPS / 1.2
            if p[4] > 0 and p[1] < H + 20:
                c.set_source_rgba(*hsv(p[5] * 0.85, 0.7, 1), p[4])
                c.arc(p[0], p[1], 4, 0, 2 * math.pi)
                c.fill()
                alive.append(p)
        parts = alive
        ball(c, x, y, BR, (1, 1, 1))
        text(c, "Can 1 ball break", W / 2, 230, 74)
        text(c, f"all {N_RINGS} rings?", W / 2, 320, 74, (1, 0.82, 0.25))
        left = N_RINGS - cur
        text(c, f"Rings left: {left}", W / 2, CY + R1 + 140, 64)
        text(c, f"{t:4.1f} s", W / 2, CY + R1 + 205, 40, (0.6, 0.6, 0.6), bold=False)
        if done_t and t > done_t:
            end_card(c, W, H, [("ESCAPED!", 130, (1, 0.82, 0.25)),
                               (f"All {N_RINGS} rings in {done_t:.1f} s", 58, (1, 1, 1)),
                               ("Guess the time before the end?", 40, (0.75, 0.75, 0.75))], t - done_t)
        v.emit(f)
    if done_t:
        v.audio.add(done_t, "boom", 70, 0.6)
        for i, n in enumerate((7, 9, 11, 14)):
            v.audio.add(done_t + 0.12 * i, "bell", SCALE[n], 0.3)
    v.finish()


if __name__ == "__main__":
    if sys.argv[1] == "search":
        search()
    else:
        render(sys.argv[2], int(sys.argv[3]), float(sys.argv[4]), sys.argv[5] if len(sys.argv) > 5 else None)
