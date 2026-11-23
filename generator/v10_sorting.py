"""V10 (landscape): 4 sorting algorithms race on the same shuffled data at the same speed."""
import math
import random
import sys

from lib import FPS, SCALE, Video, end_card, hsv, text

W, H, DUR = 1920, 1080, 60
N = 110
TARGET_LAST = 53.5


def bubble(a):
    a = a[:]
    n = len(a)
    for i in range(n):
        swapped = False
        for j in range(n - 1 - i):
            yield a, (j, j + 1)
            if a[j] > a[j + 1]:
                a[j], a[j + 1] = a[j + 1], a[j]
                swapped = True
        if not swapped:
            break
    yield a, ()


def insertion(a):
    a = a[:]
    for i in range(1, len(a)):
        j = i
        while j > 0:
            yield a, (j - 1, j)
            if a[j - 1] > a[j]:
                a[j - 1], a[j] = a[j], a[j - 1]
                j -= 1
            else:
                break
    yield a, ()


def merge(a):
    a = a[:]

    def rec(lo, hi):
        if hi - lo < 2:
            return
        mid = (lo + hi) // 2
        yield from rec(lo, mid)
        yield from rec(mid, hi)
        left, right = a[lo:mid], a[mid:hi]
        i = j = 0
        k = lo
        while i < len(left) and j < len(right):
            yield a, (k, mid + j)
            if left[i] <= right[j]:
                a[k] = left[i]; i += 1
            else:
                a[k] = right[j]; j += 1
            k += 1
        while i < len(left):
            a[k] = left[i]; i += 1; k += 1
        while j < len(right):
            a[k] = right[j]; j += 1; k += 1
    yield from rec(0, len(a))
    yield a, ()


def quick(a):
    a = a[:]

    def rec(lo, hi):
        if lo >= hi:
            return
        p = a[hi]
        i = lo
        for j in range(lo, hi):
            yield a, (j, hi)
            if a[j] < p:
                a[i], a[j] = a[j], a[i]
                i += 1
        a[i], a[hi] = a[hi], a[i]
        yield from rec(lo, i - 1)
        yield from rec(i + 1, hi)
    yield from rec(0, len(a) - 1)
    yield a, ()


def selection(a):
    a = a[:]
    n = len(a)
    for i in range(n - 1):
        m = i
        for j in range(i + 1, n):
            yield a, (m, j)
            if a[j] < a[m]:
                m = j
        a[i], a[m] = a[m], a[i]
    yield a, ()


def cocktail(a):
    a = a[:]
    lo, hi = 0, len(a) - 1
    while lo < hi:
        swapped = False
        for j in range(lo, hi):
            yield a, (j, j + 1)
            if a[j] > a[j + 1]:
                a[j], a[j + 1] = a[j + 1], a[j]
                swapped = True
        hi -= 1
        for j in range(hi, lo, -1):
            yield a, (j - 1, j)
            if a[j - 1] > a[j]:
                a[j - 1], a[j] = a[j], a[j - 1]
                swapped = True
        lo += 1
        if not swapped:
            break
    yield a, ()


ALGOS = [("Quick Sort", quick), ("Merge Sort", merge), ("Insertion Sort", insertion),
         ("Cocktail Sort", cocktail), ("Bubble Sort", bubble), ("Selection Sort", selection)]
NA = len(ALGOS)


def pick_seed():
    best = None
    for seed in range(400):
        rnd = random.Random(seed)
        data = list(range(1, N + 1))
        rnd.shuffle(data)
        lens = [sum(1 for _ in fn(data)) for _, fn in ALGOS]
        rate = max(lens) / TARGET_LAST
        fin = sorted(ln / rate for ln in lens)
        gap = fin[-1] - fin[-2]
        if 0.15 < gap < 0.6 and 33 < fin[-3] < 46:
            return seed, [round(x, 1) for x in fin]
    return None


def trace(gen):
    steps = []
    for a, hl in gen:
        steps.append((tuple(a), hl))
    return steps


def render(out, seed, preview=None):
    rnd = random.Random(seed)
    data = list(range(1, N + 1))
    rnd.shuffle(data)
    traces = [trace(fn(data)) for _, fn in ALGOS]
    lens = [len(tr) for tr in traces]
    rate = max(lens) / TARGET_LAST
    finish = [ln / rate for ln in lens]
    print("steps", lens, "rate", round(rate, 1), "finish", [round(f, 1) for f in finish])
    order = sorted(range(NA), key=lambda k: finish[k])
    rank = {k: r + 1 for r, k in enumerate(order)}
    v = Video(out, W, H, DUR, preview, 150)
    for f in range(DUR * FPS):
        t = f / FPS
        for k in range(NA):
            if t < finish[k]:
                st = traces[k][min(lens[k] - 1, int(t * rate))]
                if st[1]:
                    val = st[0][st[1][0]]
                    v.audio.add(t + k * 0.008, "beep", 220 + val / N * 900, 0.06)
    for k in order:
        v.audio.add(finish[k], "bell", SCALE[16 - rank[k]], 0.32)
    v.audio.add(finish[order[-1]], "boom", 60, 0.5)
    pw, ph = 590, 400
    origins = [(45 + col * 620, 125 + row * 455) for row in range(2) for col in range(3)]
    medals = {1: (1, 0.82, 0.25), 2: (0.8, 0.82, 0.88), 3: (0.85, 0.55, 0.3)}
    end_t = finish[order[-1]] + 1.2
    for f in range(DUR * FPS):
        t = f / FPS
        c = v.ctx()
        for k, (name, _) in enumerate(ALGOS):
            ox, oy = origins[k]
            done = t >= finish[k]
            arr, hl = traces[k][min(lens[k] - 1, int(t * rate))]
            bw = pw / N
            for i, val in enumerate(arr):
                bh = val / N * (ph - 70)
                if i in hl and not done:
                    c.set_source_rgb(1, 1, 1)
                elif done:
                    sweep = (t - finish[k]) / 0.6
                    c.set_source_rgb(*(hsv(val / N * 0.8) if i / N > sweep else (0.3, 0.95, 0.5)))
                else:
                    c.set_source_rgb(*hsv(val / N * 0.8))
                c.rectangle(ox + i * bw + 0.5, oy + ph - bh, bw - 1.0, bh)
                c.fill()
            text(c, name, ox, oy + 40, 36, align="left")
            steps_done = min(lens[k], int(t * rate))
            if done:
                r = rank[k]
                label = ["", "1st", "2nd", "3rd", "4th", "5th", "6th"][r]
                text(c, f"{label} · {finish[k]:.1f} s", ox + pw, oy + 40, 36, medals.get(r, (0.6, 0.6, 0.65)),
                     align="right")
            else:
                text(c, f"{steps_done:,} comparisons", ox + pw, oy + 40, 26, (0.6, 0.6, 0.6), bold=False,
                     align="right")
        text(c, "6 sorting algorithms. Same 110 bars. Same speed.", W / 2, 72, 50, (1, 0.82, 0.25))
        text(c, f"{t:4.1f} s", W / 2, H - 30, 36, (0.6, 0.6, 0.6), bold=False)
        if t > end_t:
            w = order[0]
            a, b = order[-2], order[-1]
            end_card(c, W, H, [("PHOTO FINISH", 100, (1, 0.82, 0.25)),
                               (f"{ALGOS[a][0]} {finish[a]:.1f} s  vs  {ALGOS[b][0]} {finish[b]:.1f} s", 50, (1, 1, 1)),
                               (f"{ALGOS[w][0]} won the whole race in {finish[w]:.1f} s", 40, (0.75, 0.75, 0.75))],
                     t - end_t)
        v.emit(f)
    v.finish()


if __name__ == "__main__":
    if sys.argv[1] == "search":
        print(pick_seed())
        sys.exit()
    render(sys.argv[1], int(sys.argv[2]), sys.argv[3] if len(sys.argv) > 3 else None)
