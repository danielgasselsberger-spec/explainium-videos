"""V07 (Short): 16 pendulums released together drift apart into waves and line up again at 56 s."""
import math
import sys

from lib import FPS, SCALE, Video, ball, end_card, hsv, text

W, H, DUR = 1080, 1920, 60
N = 16
GAMMA = 56.0
N0 = 22
PX, PY = W / 2, 400
LMAX = 1300.0
AMP = math.radians(21)


def freq(n):
    return (N0 + n) / GAMMA


def length(n):
    return LMAX * (freq(0) / freq(n)) ** 2


def render(out, preview=None):
    v = Video(out, W, H, DUR, preview, 150)
    # audio: a note every time a bob passes the bottom (theta crosses 0)
    for n in range(N):
        f = freq(n)
        k = 0
        while True:
            tc = (k + 0.5) / (2 * f)
            if tc > DUR:
                break
            v.audio.add(tc, "pluck", SCALE[2 + n], 0.11)
            k += 1
    for i, nn in enumerate((7, 9, 11, 14, 16)):
        v.audio.add(GAMMA + 0.1 * i, "bell", SCALE[nn], 0.22)
    trails = [[] for _ in range(N)]
    for fr in range(v.nframes):
        t = fr / FPS
        c = v.ctx()
        pos = []
        for n in range(N):
            th = AMP * math.cos(2 * math.pi * freq(n) * t)
            L = length(n)
            x, y = PX + L * math.sin(th), PY + L * math.cos(th)
            pos.append((x, y))
            trails[n].append((x, y))
            trails[n] = trails[n][-10:]
        for n in range(N):
            col = hsv(n / N * 0.85)
            tr = trails[n]
            for i in range(1, len(tr)):
                c.set_source_rgba(*col, 0.5 * i / len(tr))
                c.set_line_width(14 * i / len(tr))
                c.move_to(*tr[i - 1])
                c.line_to(*tr[i])
                c.stroke()
        c.set_line_width(1.6)
        for n, (x, y) in enumerate(pos):
            c.set_source_rgba(1, 1, 1, 0.35)
            c.move_to(PX, PY)
            c.line_to(x, y)
            c.stroke()
        for n, (x, y) in enumerate(pos):
            ball(c, x, y, 17, hsv(n / N * 0.85))
        c.set_source_rgb(0.85, 0.85, 0.9)
        c.arc(PX, PY, 9, 0, 2 * math.pi)
        c.fill()
        text(c, "16 pendulums, released together.", W / 2, 190, 56)
        text(c, "Keep watching until 0:56", W / 2, 270, 62, (1, 0.82, 0.25))
        text(c, f"{t:4.1f} s", W / 2, 340, 44, (0.65, 0.65, 0.65), bold=False)
        if t > GAMMA + 0.6:
            end_card(c, W, H, [("BACK IN SYNC", 110, (1, 0.82, 0.25)),
                               ("after exactly 56 seconds", 54, (1, 1, 1)),
                               ("Each one swings once more than", 40, (0.75, 0.75, 0.75)),
                               ("its neighbour in that time.", 40, (0.75, 0.75, 0.75))], t - GAMMA - 0.6)
        v.emit(fr)
    v.finish()


if __name__ == "__main__":
    render(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else None)
