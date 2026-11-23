"""V08 (Short): Every brick it breaks makes the ball faster. Can it break out of 3 rings of bricks?"""
import math
import random
import sys

from lib import FPS, SCALE, Video, ball, end_card, hsv, text

W, H, DUR = 1080, 1920, 60
CX, CY = W / 2, H / 2 + 40
NB = 40
LAYERS = [(300, 330), (338, 368), (376, 406), (414, 444)]
BR = 13
SUB = 12
V0 = 540.0
VMAX = 2300.0


def simulate(seed, growth, record=False):
    rnd = random.Random(seed)
    bricks = [[True] * NB for _ in LAYERS]
    x, y = CX, CY
    a = rnd.uniform(0, 2 * math.pi)
    sp = V0
    vx, vy = sp * math.cos(a), sp * math.sin(a)
    t, dt = 0.0, 1 / FPS / SUB
    frames, events, done = [], [], None
    shards = []
    for f in range(DUR * FPS):
        for _ in range(SUB):
            t += dt
            x += vx * dt
            y += vy * dt
            if done:
                continue
            dx, dy = x - CX, y - CY
            d = math.hypot(dx, dy) or 1e-9
            nx, ny = dx / d, dy / d
            ang = math.atan2(dy, dx) % (2 * math.pi)
            dang = math.asin(min(1.0, BR / d))
            hit_any = False
            for li, (ri, ro) in enumerate(LAYERS):
                if d + BR > ri and d - BR < ro:
                    i0 = int(math.floor((ang - dang) / (2 * math.pi) * NB))
                    i1 = int(math.floor((ang + dang) / (2 * math.pi) * NB))
                    hit = []
                    for i in range(i0, i1 + 1):
                        k = i % NB
                        if bricks[li][k]:
                            hit.append(k)
                    if hit:
                        for k in hit:
                            bricks[li][k] = False
                            events.append((t, li, k))
                            shards.append((t, li, k))
                        hit_any = True
                        break
            if hit_any:
                vn = vx * nx + vy * ny
                if vn > 0:
                    vx -= 2 * vn * nx
                    vy -= 2 * vn * ny
                else:
                    tx, ty = -ny, nx
                    vt = vx * tx + vy * ty
                    vx -= 2 * vt * tx
                    vy -= 2 * vt * ty
                sp = min(VMAX, sp * growth)
                th = math.atan2(vy, vx) + rnd.uniform(-0.12, 0.12)
                vx, vy = sp * math.cos(th), sp * math.sin(th)
            if d - BR > LAYERS[-1][1]:
                done = t
        if record:
            frames.append((x, y, [row[:] for row in bricks], t, sp))
        elif done:
            break
    return done, frames, events


def search():
    for growth in (1.006, 1.009, 1.012, 1.016):
        hits = []
        for seed in range(30):
            d = simulate(seed, growth)[0]
            if d and 50 <= d <= 56:
                hits.append((seed, round(d, 1)))
        print(growth, hits, flush=True)


def render(out, seed, growth, preview=None):
    done, frames, events = simulate(seed, growth, record=True)
    print("done", done, "bricks", len(events))
    v = Video(out, W, H, DUR, preview, 150)
    last = -1
    for n, (et, li, k) in enumerate(events):
        if et - last > 0.03:
            v.audio.add(et, "pluck", SCALE[(n * 3) % 14 + 3], 0.2)
            v.audio.add(et, "tick", 2400, 0.08)
            last = et
    if done:
        v.audio.add(done, "boom", 60, 0.7)
        for i, nn in enumerate((9, 11, 14, 16)):
            v.audio.add(done + 0.1 * i, "bell", SCALE[nn], 0.3)
    ev_by_frame = {}
    for et, li, k in events:
        ev_by_frame.setdefault(int(et * FPS), []).append((et, li, k))
    debris = []
    rnd = random.Random(2)
    total = NB * len(LAYERS)
    trail = []
    for f, (x, y, bricks, t, sp) in enumerate(frames):
        for et, li, k in ev_by_frame.get(f, []):
            ri, ro = LAYERS[li]
            a = (k + 0.5) / NB * 2 * math.pi
            rm = (ri + ro) / 2
            for _ in range(8):
                s = rnd.uniform(100, 420)
                b = a + rnd.uniform(-0.8, 0.8)
                debris.append([CX + rm * math.cos(a), CY + rm * math.sin(a), s * math.cos(b), s * math.sin(b), 1.0,
                               li / len(LAYERS)])
        c = v.ctx()
        for li, (ri, ro) in enumerate(LAYERS):
            col = hsv(0.55 + li * 0.12, 0.65, 1)
            for k in range(NB):
                if not bricks[li][k]:
                    continue
                a0 = k / NB * 2 * math.pi + 0.012
                a1 = (k + 1) / NB * 2 * math.pi - 0.012
                c.new_path()
                c.arc(CX, CY, ro, a0, a1)
                c.arc_negative(CX, CY, ri, a1, a0)
                c.close_path()
                c.set_source_rgb(*col)
                c.fill()
        alive = []
        for p in debris:
            p[0] += p[2] / FPS
            p[1] += p[3] / FPS
            p[3] += 600 / FPS
            p[4] -= 1 / FPS / 0.9
            if p[4] > 0:
                c.set_source_rgba(*hsv(0.55 + p[5] * 0.48, 0.65, 1), p[4])
                c.rectangle(p[0] - 4, p[1] - 4, 8, 8)
                c.fill()
                alive.append(p)
        debris = alive
        trail.append((x, y))
        trail = trail[-8:]
        for i, (tx, ty) in enumerate(trail[:-1]):
            c.set_source_rgba(1, 0.8, 0.3, 0.25 * (i + 1) / len(trail))
            c.arc(tx, ty, BR * (0.5 + 0.5 * (i + 1) / len(trail)), 0, 2 * math.pi)
            c.fill()
        ball(c, x, y, BR, (1, 0.85, 0.35))
        left = sum(sum(row) for row in bricks)
        text(c, "Every brick = FASTER.", W / 2, 230, 74)
        text(c, "Can it break out?", W / 2, 318, 74, (1, 0.82, 0.25))
        text(c, f"Bricks left: {left} / {total}", W / 2, CY + 444 + 140, 60)
        text(c, f"Speed: {sp / V0:.1f}x", W / 2, CY + 444 + 205, 42, (0.6, 0.6, 0.6), bold=False)
        if done and t > done + 0.3:
            end_card(c, W, H, [("IT BROKE OUT!", 110, (1, 0.82, 0.25)),
                               (f"after {done:.1f} s at {sp / V0:.1f}x speed", 50, (1, 1, 1)),
                               (f"{total - left} bricks smashed", 40, (0.75, 0.75, 0.75))], t - done - 0.3)
        v.emit(f)
    v.finish()


if __name__ == "__main__":
    if sys.argv[1] == "search":
        search()
    else:
        a = sys.argv
        render(a[2], int(a[3]), float(a[4]), a[5] if len(a) > 5 else None)
