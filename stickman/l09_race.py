"""L09 (landscape): 8 stickmen, 1 obstacle course. Hurdles, mud and walls. Pick your color!"""
import math
import random
import sys

import cairo

import stick as S
from lib import FPS, NAMES, PALETTE, SCALE, caption, end_card, fade, rounded, text

W, H, DUR = 1920, 1080, 60
N = 8
L = 11000.0
LANE0, LANE_DY = 640, 52
OBST = []  # (x, kind)
for k in range(12):
    OBST.append((900 + k * 1000, ["hurdle", "mud", "hurdle", "wall"][k % 4]))
MUD_W = 320
WALL_H = 0.55  # relative to body size


def simulate(seed):
    rnd = random.Random(seed)
    base = [rnd.uniform(255, 285) for _ in range(N)]
    phase = [rnd.uniform(0, 6.28) for _ in range(N)]
    freq = [rnd.uniform(0.15, 0.35) for _ in range(N)]
    x = [0.0] * N
    mode = ["run"] * N
    mt = [0.0] * N
    done_t = [None] * N
    nxt = [0] * N
    frames, events = [], []
    dt = 1 / FPS
    for f in range(DUR * FPS):
        t = f * dt
        for i in range(N):
            if t < 2.0 or done_t[i] is not None:
                continue
            v = base[i] * (1 + 0.12 * math.sin(freq[i] * t * 6.28 + phase[i]))
            m = mode[i]
            if m == "trip":
                mt[i] += dt
                if mt[i] > 1.3:
                    mode[i], mt[i] = "run", 0.0
                continue
            if m == "climb":
                mt[i] += dt
                if mt[i] > climb_time[i]:
                    mode[i], mt[i] = "run", 0.0
                    x[i] += 40
                continue
            if m == "jump":
                mt[i] += dt
                x[i] += v * 1.1 * dt
                if mt[i] > 0.55:
                    mode[i], mt[i] = "run", 0.0
                continue
            ox, kind = OBST[nxt[i]] if nxt[i] < len(OBST) else (1e9, None)
            if kind == "mud" and ox <= x[i] < ox + MUD_W:
                x[i] += v * 0.35 * dt
                mode[i] = "mud"
                if x[i] >= ox + MUD_W:
                    nxt[i] += 1
                    mode[i] = "run"
                continue
            x[i] += v * dt
            mode[i] = "run"
            if kind == "hurdle" and x[i] >= ox - 70:
                nxt[i] += 1
                if rnd.random() < 0.8:
                    mode[i], mt[i] = "jump", 0.0
                else:
                    mode[i], mt[i] = "trip", 0.0
                    x[i] = ox - 20
                    events.append((t, "trip", i))
            elif kind == "wall" and x[i] >= ox - 40:
                nxt[i] += 1
                mode[i], mt[i] = "climb", 0.0
                climb_time[i] = rnd.uniform(0.7, 2.4)
                x[i] = ox - 40
            if x[i] >= L:
                x[i] = L
                done_t[i] = t
                events.append((t, "finish", i))
        frames.append((list(x), list(mode), list(mt), t))
    return frames, events, done_t


climb_time = [1.0] * N


def score(seed):
    frames, events, done_t = simulate(seed)
    if sum(d is not None for d in done_t) < 2:
        return None
    order = sorted(range(N), key=lambda i: done_t[i] if done_t[i] is not None else 1e9)
    win = done_t[order[0]]
    gap = done_t[order[1]] - win
    leaders = [max(range(N), key=lambda i: fr[0][i]) for fr in frames[FPS * 5:FPS * 48]]
    changes = sum(1 for a, b in zip(leaders, leaders[1:]) if a != b)
    return win, gap, changes, order


def search():
    for seed in range(200):
        s = score(seed)
        if s and 47 <= s[0] <= 52 and s[1] < 0.5 and s[2] >= 6:
            print(seed, round(s[0], 2), round(s[1], 2), s[2], [NAMES[i] for i in s[3][:3]], flush=True)


def lane_y(i):
    return LANE0 + i * LANE_DY


def stick_for(i):
    return S.Stick(150 + i * 8, PALETTE[i])


def render(out, seed, preview=None):
    from lib import Video
    frames, events, done_t = simulate(seed)
    order = sorted(range(N), key=lambda i: done_t[i] if done_t[i] is not None else 1e9 - frames[-1][0][i])
    win = order[0]
    v = Video(out, W, H, DUR, preview, 120)
    a = v.audio
    a.music(0, 60, bpm=138, chords=((0, 4, 7), (5, 9, 12), (7, 11, 14), (9, 12, 16)), root=220.0, vol=0.6)
    a.add(1.2, "beep", 880, 0.3)
    a.add(1.6, "beep", 880, 0.3)
    a.add(2.0, "beep", 1760, 0.35)
    for t_, kind, i in events:
        if kind == "trip":
            a.add(t_, "thud", 100, 0.3)
        elif kind == "finish":
            a.add(t_, "bell", SCALE[16 - order.index(i)], 0.35 if i == win else 0.15)
    cam = 0.0
    trip_caps = [(t_, i) for t_, k, i in events if k == "trip"]
    for f, (xs, modes, mts, t) in enumerate(frames):
        lead = sorted(xs, reverse=True)
        target = (lead[0] + lead[1] + lead[2]) / 3
        cam += (target - cam) * 0.08
        sx0 = cam - 1000
        c = v.ctx()
        g = cairo.LinearGradient(0, 0, 0, 560)
        g.add_color_stop_rgb(0, 0.5, 0.75, 1.0)
        g.add_color_stop_rgb(1, 0.85, 0.93, 1.0)
        c.set_source(g)
        c.rectangle(0, 0, W, 560)
        c.fill()
        c.set_source_rgb(0.6, 0.8, 0.6)
        for k in range(12):
            hx = (k * 420 - sx0 * 0.3) % 5040 - 400
            c.arc(hx, 600, 260, math.pi, 2 * math.pi)
            c.fill()
        c.set_source_rgb(0.82, 0.55, 0.4)
        c.rectangle(0, 560, W, H - 560)
        c.fill()
        c.set_source_rgba(1, 1, 1, 0.6)
        c.set_line_width(3)
        for i in range(N + 1):
            y = lane_y(i) - LANE_DY / 2 + 8
            c.move_to(0, y)
            c.line_to(W, y)
        c.stroke()
        # finish line
        fx = L - sx0
        if -50 < fx < W + 50:
            for k in range(14):
                c.set_source_rgb(*((0, 0, 0) if k % 2 else (1, 1, 1)))
                c.rectangle(fx - 10, 590 + k * 34, 20, 34)
                c.fill()
        # obstacles + runners, back lane first
        for i in range(N):
            y = lane_y(i)
            for ox, kind in OBST:
                X = ox - sx0 + i * 6
                if not -400 < X < W + 400:
                    continue
                if kind == "hurdle":
                    c.set_source_rgb(0.95, 0.95, 0.95)
                    c.set_line_width(6)
                    c.move_to(X, y)
                    c.line_to(X, y - 60)
                    c.line_to(X + 10, y - 60)
                    c.stroke()
                    c.set_source_rgb(0.9, 0.2, 0.2)
                    c.rectangle(X - 6, y - 66, 22, 12)
                    c.fill()
                elif kind == "mud" and i == 0:
                    c.set_source_rgb(0.4, 0.27, 0.15)
                    top, bot = lane_y(0) - LANE_DY / 2 + 8, lane_y(N - 1) + LANE_DY / 2 + 8
                    c.move_to(X, top)
                    c.line_to(X + MUD_W, top)
                    c.line_to(X + MUD_W + 6 * N, bot)
                    c.line_to(X + 6 * N, bot)
                    c.close_path()
                    c.fill()
                    c.set_source_rgba(0.3, 0.2, 0.1, 0.8)
                    for k in range(6):
                        c.arc(X + 40 + (k * 53) % (MUD_W - 60), top + 30 + (k * 71) % (bot - top - 50), 12, 0,
                              2 * math.pi)
                        c.fill()
                elif kind == "wall":
                    c.set_source_rgb(0.55, 0.55, 0.6)
                    c.rectangle(X, y - 120, 26, 120)
                    c.fill()
            st = stick_for(i)
            X = xs[i] - sx0 + i * 6
            m = modes[i]
            yy = y
            if done_t[i] is not None and t >= done_t[i]:
                pose = S.ARMS_UP if i == win else S.STAND
                expr = "happy" if i == win else "flat"
            elif t < 2:
                pose, expr = S.CROUCH, "flat"
            elif m == "trip":
                pose, expr = (S.LIE, "shock") if mts[i] < 0.9 else (S.CROUCH, "sad")
            elif m == "jump":
                u = mts[i] / 0.55
                yy = y - 110 * 4 * u * (1 - u)
                pose, expr = S.CROUCH if 0.2 < u < 0.8 else S.walk(t * 14, run=True), "smile"
            elif m == "climb":
                u = min(1, mts[i] / climb_time[i])
                yy = y - 120 * math.sin(u * math.pi * 0.9)
                pose, expr = S.climb(t * 10), "flat"
            elif m == "mud":
                pose, expr = S.walk(t * 5), "sad"
            else:
                pose, expr = S.walk(t * 14, run=True), "flat"
            if pose is S.LIE:
                st.draw(c, pose, X, yy - st.w, 1, expr)
            else:
                st.draw(c, pose, X, st.ground_y(pose, yy), 1, expr)
        # HUD: title, progress, ranking
        rounded(c, 30, 24, 1180, 120, 24)
        c.set_source_rgba(0, 0, 0, 0.55)
        c.fill()
        text(c, "8 stickmen. 1 obstacle course.", 60, 80, 48, align="left")
        text(c, "Pick your color NOW!", 60, 128, 38, (1, 0.82, 0.25), align="left")
        rank = sorted(range(N), key=lambda i: (done_t[i] if done_t[i] is not None and done_t[i] <= t else 1e9,
                                               -xs[i]))
        rounded(c, 1530, 24, 360, 520, 24)
        c.set_source_rgba(0, 0, 0, 0.55)
        c.fill()
        for r, i in enumerate(rank):
            yy = 80 + r * 60
            c.set_source_rgb(*PALETTE[i])
            c.arc(1580, yy - 12, 16, 0, 2 * math.pi)
            c.fill()
            label = f"{r + 1}. {NAMES[i]}"
            if done_t[i] is not None and t >= done_t[i]:
                label += f"  {done_t[i] - 2:.2f}s"
            text(c, label, 1610, yy, 34, (1, 1, 1), align="left")
        # progress bar
        c.set_source_rgba(1, 1, 1, 0.8)
        rounded(c, 30, 160, 1180, 14, 7)
        c.fill()
        for i in range(N):
            c.set_source_rgb(*PALETTE[i])
            c.arc(30 + 1180 * min(1, xs[i] / L), 167, 12, 0, 2 * math.pi)
            c.fill()
        if t < 2.2:
            n = 3 - int(t / 0.4) if t < 1.2 else ("GO!" if t >= 2.0 else str(3 - int((t - 0.0) / 0.67)))
            text(c, "GO!" if t >= 1.9 else "READY...", W / 2 - 200, 420, 120, (1, 1, 1))
        for t_, i in trip_caps:
            if 0 <= t - t_ < 1.6 and t_ < done_t[win]:
                caption(c, f"{NAMES[i]} tripped!", W / 2 - 200, 1030, 44, 800, alpha=fade(t, t_, t_ + 1.6))
                break
        wt = done_t[win]
        if t > wt + 2.5:
            second = order[1]
            end_card(c, W, H, [(f"{NAMES[win].upper()} WINS!", 120, PALETTE[win]),
                               (f"by {done_t[second] - wt:.2f} s over {NAMES[second]}", 56, (1, 1, 1)),
                               ("Did your color win?", 44, (0.8, 0.8, 0.8))], t - wt - 2.5)
        v.emit(f)
    v.finish()


if __name__ == "__main__":
    if sys.argv[1] == "search":
        search()
    else:
        render(sys.argv[2], int(sys.argv[3]), sys.argv[4] if len(sys.argv) > 4 else None)
