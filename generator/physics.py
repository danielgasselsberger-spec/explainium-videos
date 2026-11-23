"""Numba ball physics: many equal balls, gravity, ball-ball collisions via a uniform grid."""
import numpy as np
from numba import njit


@njit(cache=True)
def collide_balls(x, y, vx, vy, r, n, cell, gw, gh, ox, oy, rest):
    """Positional + velocity resolution of overlapping balls. Returns number of hard contacts."""
    head = -np.ones(gw * gh, np.int64)
    nxt = -np.ones(n, np.int64)
    for i in range(n):
        cx = int((x[i] - ox) / cell)
        cy = int((y[i] - oy) / cell)
        if cx < 0 or cy < 0 or cx >= gw or cy >= gh:
            continue
        k = cy * gw + cx
        nxt[i] = head[k]
        head[k] = i
    hits = 0
    for i in range(n):
        cx = int((x[i] - ox) / cell)
        cy = int((y[i] - oy) / cell)
        for ddy in range(-1, 2):
            for ddx in range(-1, 2):
                gx, gy = cx + ddx, cy + ddy
                if gx < 0 or gy < 0 or gx >= gw or gy >= gh:
                    continue
                j = head[gy * gw + gx]
                while j != -1:
                    if j > i:
                        dx = x[j] - x[i]
                        dy = y[j] - y[i]
                        rr = r[i] + r[j]
                        d2 = dx * dx + dy * dy
                        if d2 < rr * rr and d2 > 1e-12:
                            d = np.sqrt(d2)
                            nx, ny = dx / d, dy / d
                            pen = (rr - d) * 0.5
                            x[i] -= nx * pen
                            y[i] -= ny * pen
                            x[j] += nx * pen
                            y[j] += ny * pen
                            rv = (vx[j] - vx[i]) * nx + (vy[j] - vy[i]) * ny
                            if rv < 0:
                                imp = -(1 + rest) * rv * 0.5
                                vx[i] -= imp * nx
                                vy[i] -= imp * ny
                                vx[j] += imp * nx
                                vy[j] += imp * ny
                                if rv < -150:
                                    hits += 1
                    j = nxt[j]
    return hits
