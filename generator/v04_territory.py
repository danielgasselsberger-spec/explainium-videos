"""V04 (Short): 4 colors fight for territory. Every 12 s the last place gets a bonus ball. Who wins?"""
import math
import random
import sys

import numpy as np

from lib import FPS, NAMES, PALETTE, SCALE, Video, end_card, rich, text

W, H, DUR = 1080, 1920, 60
CELL = 36
GW, GH = 27, 33
X0 = (W - GW * CELL) / 2
Y0 = 470
BR = 11
SPEED = 950.0
SUB = 10
TEAMS = [0, 1, 2, 3]
COLS = [PALETTE[0], PALETTE[1], PALETTE[2], PALETTE[3]]
END_T = 57.0
BONUS_EVERY = 12.0


def dark(c, k=0.42):
    return tuple(v * k for v in c)


def simulate(seed, record=False):
    rnd = random.Random(seed)
    grid = np.zeros((GH, GW), np.int8)
    grid[: GH // 2, : GW // 2] = 0
    grid[: GH // 2, GW // 2:] = 1
    grid[GH // 2:, : GW // 2] = 2
    grid[GH // 2:, GW // 2:] = 3
    balls = []  # [x, y, vx, vy, team]
    for tm, (qx, qy) in enumerate([(0.25, 0.25), (0.75, 0.25), (0.25, 0.75), (0.75, 0.75)]):
        for j in range(3):
            a = rnd.uniform(0, 2 * math.pi)
            balls.append([X0 + GW * CELL * (qx + rnd.uniform(-0.12, 0.12)), Y0 + GH * CELL * (qy + rnd.uniform(-0.12, 0.12)),
                          SPEED * math.cos(a), SPEED * math.sin(a), tm])
    t, dt = 0.0, 1 / FPS / SUB
    frames, events = [], []
    next_bonus = BONUS_EVERY
    leaders = []
    for f in range(DUR * FPS):
        for _ in range(SUB):
            t += dt
            if t < END_T:
                for b in balls:
                    b[0] += b[2] * dt
                    b[1] += b[3] * dt
                    # walls
                    if b[0] < X0 + BR:
                        b[0] = X0 + BR; b[2] = abs(b[2])
                    if b[0] > X0 + GW * CELL - BR:
                        b[0] = X0 + GW * CELL - BR; b[2] = -abs(b[2])
                    if b[1] < Y0 + BR:
                        b[1] = Y0 + BR; b[3] = abs(b[3])
                    if b[1] > Y0 + GH * CELL - BR:
                        b[1] = Y0 + GH * CELL - BR; b[3] = -abs(b[3])
                    for k in range(8):
                        a = k * math.pi / 4
                        px = b[0] + math.cos(a) * BR
                        py = b[1] + math.sin(a) * BR
                        gx, gy = int((px - X0) // CELL), int((py - Y0) // CELL)
                        if 0 <= gx < GW and 0 <= gy < GH and grid[gy, gx] != b[4]:
                            grid[gy, gx] = b[4]
                            events.append((t, b[4]))
                            if abs(math.cos(a)) > abs(math.sin(a)):
                                b[2] = -b[2]
                            else:
                                b[3] = -b[3]
                            # tiny random turn so it never locks into a loop
                            ang = math.atan2(b[3], b[2]) + rnd.uniform(-0.05, 0.05)
                            b[2], b[3] = SPEED * math.cos(ang), SPEED * math.sin(ang)
                            break
                if t >= next_bonus and t < END_T - 3:
                    next_bonus += BONUS_EVERY
                    counts = [(int((grid == tm).sum()), tm) for tm in TEAMS]
                    alive = [ct for ct in counts if ct[0] > 0]
                    last = min(alive)[1]
                    ys, xs = np.nonzero(grid == last)
                    k = rnd.randrange(len(xs))
                    a = rnd.uniform(0, 2 * math.pi)
                    balls.append([X0 + (xs[k] + 0.5) * CELL, Y0 + (ys[k] + 0.5) * CELL,
                                  SPEED * math.cos(a), SPEED * math.sin(a), last])
                    events.append((t, 10 + last))
        counts = [int((grid == tm).sum()) for tm in TEAMS]
        leaders.append(int(np.argmax(counts)))
        if record:
            frames.append((grid.copy(), [tuple(b) for b in balls], counts, t))
    changes = sum(1 for a, b in zip(leaders[FPS * 10:], leaders[FPS * 10 + 1:]) if a != b)
    final = counts
    return frames, events, changes, final, leaders


def search():
    for seed in range(40):
        _, _, ch, fin, leaders = simulate(seed)
        s = sorted(fin, reverse=True)
        lead30 = leaders[30 * FPS]
        print(seed, ch, fin, "margin", s[0] - s[1], "leader@30", lead30, "final", int(np.argmax(fin)), flush=True)


def render(out, seed, preview=None):
    frames, events, _, final, _ = simulate(seed, record=True)
    v = Video(out, W, H, DUR, preview, 150)
    last = [-1.0] * 4
    for et, tm in events:
        if tm >= 10:
            v.audio.add(et, "bell", SCALE[12], 0.35)
            continue
        if et - last[tm] > 0.07:
            v.audio.add(et, "tick", SCALE[4 + tm * 2], 0.25)
            last[tm] = et
    total = GW * GH
    winner = int(np.argmax(final))
    v.audio.add(END_T, "boom", 60, 0.7)
    for i, nn in enumerate((9, 11, 14, 16)):
        v.audio.add(END_T + 0.1 * i, "bell", SCALE[nn], 0.3)
    bonus_flash = [(et, tm - 10) for et, tm in events if tm >= 10]
    for f, (grid, balls, counts, t) in enumerate(frames):
        c = v.ctx()
        for tm in TEAMS:
            c.set_source_rgb(*dark(COLS[tm]))
            ys, xs = np.nonzero(grid == tm)
            for gy, gx in zip(ys, xs):
                c.rectangle(X0 + gx * CELL, Y0 + gy * CELL, CELL + 0.6, CELL + 0.6)
            c.fill()
        for (x, y, _, _, tm) in balls:
            c.set_source_rgb(*COLS[tm])
            c.arc(x, y, BR, 0, 2 * math.pi)
            c.fill()
            c.set_source_rgb(1, 1, 1)
            c.set_line_width(2)
            c.arc(x, y, BR, 0, 2 * math.pi)
            c.stroke()
        text(c, "4 colors fight for space.", W / 2, 170, 62)
        text(c, "Who owns the most at 0?", W / 2, 248, 62, (1, 0.82, 0.25))
        # bars
        by = 300
        bw = (W - 120) / 4
        order = sorted(TEAMS, key=lambda k: -counts[k])
        for k in TEAMS:
            x = 60 + k * bw
            pct = counts[k] / total * 100
            c.set_source_rgb(*COLS[k])
            c.rectangle(x + 6, by + 70, (bw - 12) * min(1.0, pct / 50), 12)
            c.fill()
            crown = " ★" if order[0] == k else ""
            text(c, f"{pct:4.1f}%{crown}", x + bw / 2, by + 50, 44, COLS[k])
        remain = max(0.0, END_T - t)
        text(c, f"{remain:4.1f}", W / 2, Y0 + GH * CELL + 110, 80)
        for bt, tm in bonus_flash:
            if 0 <= t - bt < 1.6:
                a = 1 - (t - bt) / 1.6
                text(c, f"+1 ball for last place: {NAMES[tm]}", W / 2, Y0 + GH * CELL + 175, 42, COLS[tm], alpha=a)
        if t >= END_T:
            pct = final[winner] / total * 100
            end_card(c, W, H, [(f"{NAMES[winner].upper()} WINS", 120, COLS[winner]),
                               (f"with {pct:.1f}% of the board", 58, (1, 1, 1)),
                               ("Which color did you pick?", 40, (0.75, 0.75, 0.75))], t - END_T)
        v.emit(f)
    v.finish()


if __name__ == "__main__":
    if sys.argv[1] == "search":
        search()
    else:
        render(sys.argv[2], int(sys.argv[3]), sys.argv[4] if len(sys.argv) > 4 else None)
