"""V05 (Short): 8 balls, 1 spinning blade. Every touch costs 1 life. Who survives?"""
import math
import random
import sys

from lib import FPS, NAMES, PALETTE, SCALE, Video, ball, end_card, text

W, H, DUR = 1080, 1920, 60
CX, CY, R = W / 2, H / 2 + 60, 440
BR = 38
SPEED = 620.0
SUB = 8
BLADE = math.radians(70)


def simulate(seed, hp0, spin, record=False):
    rnd = random.Random(seed)
    balls = []
    for k in range(8):
        a = k / 8 * 2 * math.pi
        d = rnd.uniform(0.25, 0.6) * R
        va = rnd.uniform(0, 2 * math.pi)
        balls.append({"x": CX + d * math.cos(a), "y": CY + d * math.sin(a),
                      "vx": SPEED * math.cos(va), "vy": SPEED * math.sin(va),
                      "hp": hp0, "id": k, "alive": True, "flash": -9.0, "dead_t": None})
    t, dt = 0.0, 1 / FPS / SUB
    frames, events, done = [], [], None
    for f in range(DUR * FPS):
        for _ in range(SUB):
            t += dt
            if done:
                break
            live = [b for b in balls if b["alive"]]
            for b in live:
                b["x"] += b["vx"] * dt
                b["y"] += b["vy"] * dt
            for i in range(len(live)):
                for j in range(i + 1, len(live)):
                    a, b = live[i], live[j]
                    dx, dy = b["x"] - a["x"], b["y"] - a["y"]
                    d = math.hypot(dx, dy)
                    if 0 < d < 2 * BR:
                        nx, ny = dx / d, dy / d
                        pen = (2 * BR - d) / 2
                        a["x"] -= nx * pen; a["y"] -= ny * pen
                        b["x"] += nx * pen; b["y"] += ny * pen
                        rv = (b["vx"] - a["vx"]) * nx + (b["vy"] - a["vy"]) * ny
                        if rv < 0:
                            a["vx"] += rv * nx; a["vy"] += rv * ny
                            b["vx"] -= rv * nx; b["vy"] -= rv * ny
                            events.append((t, "clack", a["id"]))
            blade_c = spin * t
            for b in live:
                dx, dy = b["x"] - CX, b["y"] - CY
                d = math.hypot(dx, dy)
                if d + BR > R:
                    nx, ny = dx / d, dy / d
                    vn = b["vx"] * nx + b["vy"] * ny
                    if vn > 0:
                        b["vx"] -= 2 * vn * nx; b["vy"] -= 2 * vn * ny
                        ang = math.atan2(dy, dx)
                        diff = (ang - blade_c + math.pi) % (2 * math.pi) - math.pi
                        if abs(diff) < BLADE / 2:
                            b["hp"] -= 1
                            b["flash"] = t
                            if b["hp"] <= 0:
                                b["alive"] = False
                                b["dead_t"] = t
                                events.append((t, "dead", b["id"]))
                            else:
                                events.append((t, "hit", b["id"]))
                        else:
                            events.append((t, "wall", b["id"]))
                    b["x"], b["y"] = CX + nx * (R - BR), CY + ny * (R - BR)
                # keep speed constant
                sp = math.hypot(b["vx"], b["vy"]) or 1
                b["vx"] *= SPEED / sp; b["vy"] *= SPEED / sp
            if sum(b["alive"] for b in balls) == 1:
                done = t
        if record:
            frames.append(([dict(b) for b in balls], t))
    deaths = [e[0] for e in events if e[1] == "dead"]
    return done, frames, events, deaths


def search():
    for hp in (6, 7, 8, 9, 10):
        for spin in (0.8, 1.2):
            for seed in range(25):
                done, _, _, deaths = simulate(seed, hp, spin)
                if done and 50 <= done <= 56 and deaths[0] > 4:
                    print(hp, spin, seed, round(done, 1), [round(d, 1) for d in deaths], flush=True)


def render(out, seed, hp0, spin, preview=None):
    done, frames, events, deaths = simulate(seed, hp0, spin, record=True)
    print("done", done, deaths)
    v = Video(out, W, H, DUR, preview, 150)
    last_clack = -1
    for et, kind, k in events:
        if kind == "hit":
            v.audio.add(et, "pop", 220, 0.35)
            v.audio.add(et, "tick", 1800, 0.2)
        elif kind == "dead":
            v.audio.add(et, "boom", 90, 0.5)
            v.audio.add(et, "bell", SCALE[2 + k], 0.3)
        elif kind == "wall":
            v.audio.add(et, "pluck", SCALE[4 + k], 0.1)
        elif kind == "clack" and et - last_clack > 0.05:
            v.audio.add(et, "tick", 900, 0.12)
            last_clack = et
    winner = None
    if done:
        for i, nn in enumerate((9, 11, 14, 16)):
            v.audio.add(done + 0.1 * i, "bell", SCALE[nn], 0.3)
    for f, (balls, t) in enumerate(frames):
        c = v.ctx()
        c.set_source_rgba(1, 1, 1, 0.9)
        c.set_line_width(6)
        c.arc(CX, CY, R + 3, 0, 2 * math.pi)
        c.stroke()
        bc = spin * t
        c.set_source_rgb(1, 0.15, 0.15)
        c.set_line_width(16)
        c.arc(CX, CY, R + 8, bc - BLADE / 2, bc + BLADE / 2)
        c.stroke()
        nsp = 9
        for s in range(nsp):
            a = bc - BLADE / 2 + BLADE * (s + 0.5) / nsp
            c.move_to(CX + (R + 2) * math.cos(a - 0.03), CY + (R + 2) * math.sin(a - 0.03))
            c.line_to(CX + (R - 30) * math.cos(a), CY + (R - 30) * math.sin(a))
            c.line_to(CX + (R + 2) * math.cos(a + 0.03), CY + (R + 2) * math.sin(a + 0.03))
            c.close_path()
            c.fill()
        alive = [b for b in balls if b["alive"]]
        for b in balls:
            if not b["alive"]:
                age = t - b["dead_t"]
                if age < 0.6:
                    for p in range(14):
                        a = p / 14 * 2 * math.pi
                        rr = BR + age * 500
                        c.set_source_rgba(*PALETTE[b["id"]], 1 - age / 0.6)
                        c.arc(b["x"] + rr * math.cos(a), b["y"] + rr * math.sin(a), 7, 0, 2 * math.pi)
                        c.fill()
                continue
            col = PALETTE[b["id"]]
            if t - b["flash"] < 0.15:
                col = (1, 1, 1)
            ball(c, b["x"], b["y"], BR, col)
            text(c, str(b["hp"]), b["x"], b["y"] + 15, 42, (0, 0, 0))
        text(c, "8 balls, 1 spinning blade.", W / 2, 200, 64)
        text(c, "Who survives?", W / 2, 285, 72, (1, 0.82, 0.25))
        text(c, f"Alive: {len(alive)} / 8", W / 2, CY + R + 130, 60)
        text(c, "Every touch of the blade = −1 life", W / 2, CY + R + 190, 36, (0.6, 0.6, 0.6), bold=False)
        if done and t > done:
            winner = alive[0]["id"]
            end_card(c, W, H, [(f"{NAMES[winner].upper()} WINS", 120, PALETTE[winner]),
                               (f"with {alive[0]['hp']} lives left", 58, (1, 1, 1)),
                               ("Did your color make it?", 40, (0.75, 0.75, 0.75))], t - done)
        v.emit(f)
    v.finish()


if __name__ == "__main__":
    if sys.argv[1] == "search":
        search()
    else:
        a = sys.argv
        render(a[2], int(a[3]), int(a[4]), float(a[5]), a[6] if len(a) > 6 else None)
