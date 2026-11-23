"""S07 (Short): 'Tomorrow I'll wake up at 6.' Snooze x8, panic, sprint to work... it's Saturday."""
import math

import cairo

import stick as S
from lib import INK, PAPER, SCALE, bubble, caption, end_card, fade, rounded, text

W, H, DUR = 1080, 1920, 60
FLOOR = 1480
me = S.Stick(280, INK)
RED = (0.88, 0.25, 0.25)
RINGS = [5.0 + k * 2.35 for k in range(8)]
SNOOZE_TIMES = [f"{6 + (9 * k) // 60}:{(9 * k) % 60:02d}" for k in range(8)]


def clock_str(t):
    if t < 5:
        return "23:30"
    if t < 24:
        k = max(i for i, r in enumerate(RINGS) if r <= t)
        return SNOOZE_TIMES[k]
    if t < 30:
        return "7:58"
    if t < 44:
        m = 58 + int((t - 30) / 14 * 16)
        return f"{7 + m // 60}:{m % 60:02d}"
    return "8:14"


def bedroom(c, t):
    c.set_source_rgb(*PAPER)
    c.paint()
    day = t > 24
    # window
    c.set_source_rgb(*((0.55, 0.78, 1.0) if day else (0.08, 0.1, 0.22)))
    rounded(c, 620, 520, 340, 300, 16)
    c.fill()
    if day:
        c.set_source_rgb(1, 0.85, 0.3)
        c.arc(860, 610, 50, 0, 2 * math.pi)
    else:
        c.set_source_rgb(0.95, 0.95, 0.85)
        c.arc(860, 610, 40, 0, 2 * math.pi)
    c.fill()
    c.set_source_rgb(*INK)
    c.set_line_width(6)
    rounded(c, 620, 520, 340, 300, 16)
    c.stroke()
    c.move_to(790, 520)
    c.line_to(790, 820)
    c.stroke()
    # bed
    c.set_source_rgb(0.35, 0.5, 0.8)
    rounded(c, 120, FLOOR - 230, 760, 150, 22)
    c.fill()
    c.set_source_rgb(1, 1, 1)
    rounded(c, 140, FLOOR - 285, 230, 75, 30)
    c.fill()
    c.set_source_rgb(*INK)
    c.set_line_width(9)
    for x in (130, 870):
        c.move_to(x, FLOOR - 90)
        c.line_to(x, FLOOR)
    c.stroke()
    # nightstand + clock
    c.set_source_rgb(0.55, 0.4, 0.28)
    c.rectangle(910, FLOOR - 200, 150, 200)
    c.fill()
    ring = any(r <= t < r + 1.2 for r in RINGS) and t < 24
    shake = 6 * math.sin(t * 80) if ring else 0
    c.set_source_rgb(*(RED if ring else INK))
    rounded(c, 915 + shake, FLOOR - 300, 140, 95, 14)
    c.fill()
    text(c, clock_str(t), 985 + shake, FLOOR - 235, 38, (1, 1, 1))
    c.set_source_rgb(*INK)
    c.set_line_width(5)
    c.move_to(0, FLOOR)
    c.line_to(W, FLOOR)
    c.stroke()
    if ring:
        for k in range(3):
            a = -0.9 + k * 0.4
            c.set_source_rgb(*RED)
            c.set_line_width(5)
            c.arc(985, FLOOR - 255, 110 + k * 22, a - 0.25, a + 0.25)
            c.stroke()
            c.new_path()


def street(c, t):
    c.set_source_rgb(0.75, 0.88, 1.0)
    c.paint()
    off = (t - 30) * 900
    for k in range(14):
        x = (k * 260 - off) % 3640 - 300
        hgt = 380 + (k * 137) % 420
        c.set_source_rgb(0.55 + (k % 3) * 0.08, 0.58, 0.66)
        c.rectangle(x, FLOOR - hgt, 220, hgt)
        c.fill()
        c.set_source_rgb(0.9, 0.95, 1)
        for wy in range(int(FLOOR - hgt + 40), FLOOR - 60, 90):
            for wx in (30, 120):
                c.rectangle(x + wx, wy, 60, 50)
        c.fill()
    c.set_source_rgb(0.35, 0.35, 0.38)
    c.rectangle(0, FLOOR, W, H - FLOOR)
    c.fill()
    c.set_source_rgb(1, 1, 1)
    for k in range(8):
        x = (k * 200 - off * 1.2) % 1600 - 200
        c.rectangle(x, FLOOR + 120, 100, 14)
    c.fill()


def office(c, t):
    c.set_source_rgb(0.75, 0.88, 1.0)
    c.paint()
    c.set_source_rgb(0.5, 0.55, 0.65)
    c.rectangle(300, 500, 760, FLOOR - 500)
    c.fill()
    c.set_source_rgb(0.25, 0.3, 0.4)
    c.rectangle(560, FLOOR - 460, 260, 460)
    c.fill()
    text(c, "OFFICE", 690, 620, 70, (1, 1, 1))
    if t > 46:
        rounded(c, 560, FLOOR - 400, 260, 130, 12)
        c.set_source_rgb(1, 1, 1)
        c.fill()
        text(c, "CLOSED", 690, FLOOR - 345, 44, RED)
        text(c, "Saturday", 690, FLOOR - 295, 34, INK)
    c.set_source_rgb(0.35, 0.35, 0.38)
    c.rectangle(0, FLOOR, W, H - FLOOR)
    c.fill()


def frame(c, t):
    if t < 30:
        bedroom(c, t)
        if t < 24:
            ring = any(r <= t < r + 1.2 for r in RINGS)
            slap = any(r + 0.9 <= t < r + 1.3 for r in RINGS)
            pose = dict(S.LIE)
            if slap:
                pose.update(ua_r=-60, fa_r=-20)
            me.draw(c, pose, 520, FLOOR - 236, 1, "sleep" if not ring else "flat")
            if t < 5:
                bubble(c, 540, 600, "Tomorrow I wake up at 6 and go for a run!", 46, 760,
                       tail=(330, FLOOR - 330), think=True, alpha=fade(t, 0.3, 4.9))
            if 5.3 < t < 24:
                k = max(i for i, r in enumerate(RINGS) if r <= t)
                text(c, f"SNOOZE x{k + 1}", W / 2, 1000, 90, RED)
                bubble(c, 330, 1100, "5 more minutes...", 42, 520, tail=(260, FLOOR - 300),
                       alpha=fade(t, RINGS[k] + 1.0, RINGS[k] + 2.3))
        else:
            u = (t - 24) / 6
            if u < 0.35:
                me.draw(c, S.LIE, 520, FLOOR - 236, 1, "shock")
                text(c, "7:58?!", W / 2, 1000, 150, RED)
            else:
                pose = S.ARMS_UP if u < 0.6 else S.walk(t * 10, run=True)
                x = 520 + max(0, u - 0.6) * 1400
                me.draw(c, pose, x, me.ground_y(pose, FLOOR) - (120 if u < 0.6 else 0), 1, "scream")
    elif t < 44:
        street(c, t)
        pose = S.walk(t * 14, run=True)
        me.draw(c, pose, 420, me.ground_y(pose, FLOOR), 1, "scream")
        c.set_source_rgba(*INK, 0.5)
        c.set_line_width(5)
        for k in range(5):
            y = FLOOR - 120 - k * 70
            x0 = 200 - ((t * 900 + k * 90) % 160)
            c.move_to(x0, y)
            c.line_to(x0 + 120, y)
        c.stroke()
        text(c, clock_str(t), W / 2, 1000, 120, RED)
    else:
        office(c, t)
        if t < 46:
            pose = S.walk(t * 14, run=True)
            x = 100 + (t - 44) / 2 * 330
            me.draw(c, pose, x, me.ground_y(pose, FLOOR), 1, "scream")
        elif t < 50:
            me.draw(c, S.STAND, 430, me.ground_y(S.STAND, FLOOR), 1, "shock")
        else:
            me.draw(c, S.FACEPALM, 430, me.ground_y(S.FACEPALM, FLOOR), 1, "sad")
    text(c, "\"I'll wake up at 6", W / 2, 170, 70, INK)
    text(c, "tomorrow.\"", W / 2, 255, 70, RED)
    beats = [(0.3, 4.9, "Me at night, full of plans:"), (5.2, 9.6, "6:00. The alarm rings."), (9.8, 23.8, "Just 5 more minutes. Again. And again."),
             (24.2, 29.8, "Wait. WHAT time is it?!"), (30.2, 43.8, "No shower. No breakfast. RUN."),
             (44.2, 49.8, "Made it! ...right?"), (50.2, 55.8, "It was Saturday.")]
    for a, b, s in beats:
        al = fade(t, a, b)
        if al:
            caption(c, s, W / 2, 1680, 52, 980, alpha=al)
    if t > 56:
        end_card(c, W, H, [("Be honest:", 70, (1, 1, 1)), ("how many snoozes?", 90, (1, 0.82, 0.25))], t - 56)


def sound(a):
    a.music(0, 24, bpm=70, chords=((0, 4, 7), (5, 9, 12)), root=261.6, vol=0.3, drums=False)
    for r in RINGS:
        for k in range(6):
            a.add(r + k * 0.16, "beep", 1760, 0.22)
        a.add(r + 1.0, "thud", 160, 0.35)
    a.add(24.0, "boom", 70, 0.5)
    a.add(26.0, "whoosh", 700, 0.5)
    a.music(28, 44, bpm=160, chords=((0, 3, 7), (5, 8, 12), (3, 7, 10), (7, 10, 14)), root=220.0, vol=0.6)
    for k in range(int(16 * 4)):
        a.add(28 + k * 0.22, "tick", 500, 0.12)
    a.add(46.0, "pop", 300, 0.3)
    a.add(50.0, "thud", 120, 0.4)
    a.music(50, 60, bpm=70, chords=((0, 3, 7), (5, 8, 12)), root=196.0, vol=0.35, drums=False)
    for i, n in enumerate((4, 3, 2, 1)):
        a.add(50.3 + 0.25 * i, "pluck", SCALE[n + 5], 0.3)


if __name__ == "__main__":
    import sys
    import lib
    lib.run(sys.modules[__name__], sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else None)
