"""S06 (Short): Introverts at parties be like... (relatable comedy, captions only)."""
import math

import stick as S
from lib import INK, PALETTE, PAPER, SCALE, bubble, caption, end_card, fade, rounded, text

W, H, DUR = 1080, 1920, 60
FLOOR = 1480
me = S.Stick(290, INK)
guest = S.Stick(280, INK)
BLUE = (0.25, 0.45, 0.85)

BEATS = [(0, 6, "Me arriving at the party:"),
         (6, 12, "Minute 1: already want to go home."),
         (12, 20, "Found the only dog. Best friend now."),
         (20, 28, "Someone walks over..."),
         (28, 36, "*suddenly gets a very important call*"),
         (36, 43, "Leaves without saying bye to anyone."),
         (43, 52, "Home. Pajamas. Silence. Perfect."),
         (52, 56, "Texts the group: 'That was SO fun!'")]


def room(c, t, party=True):
    c.set_source_rgb(*PAPER)
    c.paint()
    if party:
        for k in range(7):
            ph = t * 3 + k * 1.7
            col = PALETTE[k % len(PALETTE)]
            c.set_source_rgba(*col, 0.18 + 0.12 * math.sin(ph))
            c.arc(150 + k * 140, 700 + 60 * math.sin(k), 130, 0, 2 * math.pi)
            c.fill()
        c.set_source_rgb(*INK)
        c.set_line_width(3)
        c.move_to(40, 640)
        for k in range(9):
            c.line_to(40 + k * 125, 640 + (30 if k % 2 else 0))
        c.stroke()
        for k in range(8):
            c.set_source_rgb(*PALETTE[k % len(PALETTE)])
            c.move_to(80 + k * 125, 655 + (15 if k % 2 else 0))
            c.line_to(120 + k * 125, 655 + (15 if k % 2 else 0))
            c.line_to(100 + k * 125, 710 + (15 if k % 2 else 0))
            c.close_path()
            c.fill()
    c.set_source_rgb(*INK)
    c.set_line_width(5)
    c.move_to(0, FLOOR)
    c.line_to(W, FLOOR)
    c.stroke()


def door(c, open_u):
    c.set_source_rgb(0.55, 0.4, 0.28)
    c.rectangle(30, FLOOR - 520, 230 * (1 - open_u * 0.8), 520)
    c.fill()
    c.set_source_rgb(*INK)
    c.set_line_width(5)
    c.rectangle(30, FLOOR - 520, 230, 520)
    c.stroke()


def dog(c, x, t, happy=True):
    c.save()
    c.translate(x, FLOOR)
    c.scale(1.35, 1.35)
    c.translate(-x, -FLOOR)
    _dog(c, x, t, happy)
    c.restore()


def _dog(c, x, t, happy=True):
    y = FLOOR
    c.set_source_rgb(0.75, 0.55, 0.3)
    c.save()
    c.translate(x, y - 75)
    c.scale(1.6, 1)
    c.arc(0, 0, 45, 0, 2 * math.pi)
    c.restore()
    c.fill()
    c.arc(x - 85, y - 120, 38, 0, 2 * math.pi)
    c.fill()
    c.set_source_rgb(0.5, 0.33, 0.18)
    c.save()
    c.translate(x - 108, y - 118)
    c.rotate(0.4)
    c.scale(0.5, 1)
    c.arc(0, 0, 26, 0, 2 * math.pi)
    c.restore()
    c.fill()
    c.set_source_rgb(*INK)
    c.arc(x - 96, y - 128, 5, 0, 2 * math.pi)
    c.fill()
    c.arc(x - 120, y - 112, 7, 0, 2 * math.pi)
    c.fill()
    c.set_line_width(9)
    c.set_source_rgb(0.75, 0.55, 0.3)
    for dx in (-45, -15, 25, 50):
        c.move_to(x + dx, y - 60)
        c.line_to(x + dx, y - 4)
    c.stroke()
    wag = math.sin(t * (18 if happy else 4)) * 0.6
    c.move_to(x + 68, y - 85)
    c.line_to(x + 68 + 55 * math.cos(-0.9 + wag), y - 85 + 55 * math.sin(-0.9 + wag))
    c.stroke()


def crowd(c, t, x0=560):
    for k in range(4):
        ph = t * 5.5 + k * 1.3
        u = (math.sin(ph) + 1) / 2
        pose = S.lerp_pose(dict(S.STAND, ua_l=-60, fa_l=-140, ua_r=60, fa_r=140), S.ARMS_UP, u)
        x = x0 + k * 120
        g = S.Stick(190, PALETTE[(k + 1) % len(PALETTE)])
        g.draw(c, pose, x, g.ground_y(pose, FLOOR - 110) - 20 * u, 1 if k % 2 else -1, "happy", alpha=0.45)


def frame(c, t):
    home = 43 <= t
    room(c, t, party=not home)
    if not home:
        door(c, 1.0 if t < 3 or 39 < t < 43 else 0.0)
        c.set_source_rgba(0.6, 0.55, 0.5, 0.25)
        c.rectangle(0, FLOOR - 110, W, 110)
        c.fill()
        crowd(c, t, 560)
    else:
        # bedroom: bed + lamp
        c.set_source_rgb(0.3, 0.45, 0.75)
        rounded(c, 140, FLOOR - 200, 800, 120, 20)
        c.fill()
        c.set_source_rgb(1, 1, 1)
        rounded(c, 160, FLOOR - 250, 220, 70, 30)
        c.fill()
        c.set_source_rgb(*INK)
        c.set_line_width(8)
        c.move_to(150, FLOOR - 80)
        c.line_to(150, FLOOR)
        c.move_to(930, FLOOR - 80)
        c.line_to(930, FLOOR)
        c.stroke()
        c.set_source_rgba(1, 0.85, 0.4, 0.35)
        c.arc(980, FLOOR - 520, 160, 0, 2 * math.pi)
        c.fill()
    # main character
    if t < 6:
        x = 150 + min(1, t / 4) * 230
        pose = S.walk(t * 6) if t < 4 else S.STAND
        me.draw(c, pose, x, me.ground_y(pose, FLOOR), 1, "flat")
    elif t < 12:
        me.draw(c, S.STAND, 380, me.ground_y(S.STAND, FLOOR), 1, "sad")
        bubble(c, 330, 640, "I miss my bed.", 46, 520, tail=(380, FLOOR - 430), think=True,
               alpha=fade(t, 6.5, 12))
    elif t < 20:
        dog(c, 470, t)
        pose = S.lerp_pose(S.STAND, S.CROUCH, S.ease((t - 12) / 0.8))
        pose = dict(pose, ua_r=70 + 15 * math.sin(t * 8), fa_r=90)
        me.draw(c, pose, 260, me.ground_y(pose, FLOOR), 1, "happy")
        for k in range(3):
            hx = 380 + k * 40 + 10 * math.sin(t * 3 + k)
            hy = FLOOR - 400 - ((t * 120 + k * 60) % 220)
            c.set_source_rgba(0.9, 0.3, 0.4, 0.8)
            c.arc(hx - 9, hy, 10, math.pi, 2 * math.pi)
            c.arc(hx + 9, hy, 10, math.pi, 2 * math.pi)
            c.line_to(hx, hy + 22)
            c.close_path()
            c.fill()
    elif t < 28:
        dog(c, 470, t, happy=False)
        gx = 1100 - min(1, (t - 20) / 2.5) * 420
        gp = S.walk(t * 6) if t < 22.5 else S.STAND
        guest.draw(c, gp, gx, guest.ground_y(gp, FLOOR), -1, "smile", color=BLUE)
        me.draw(c, S.CROUCH if t < 22 else S.STAND, 260,
                me.ground_y(S.CROUCH if t < 22 else S.STAND, FLOOR), 1, "shock" if t > 23 else "flat")
        if t > 23:
            bubble(c, 700, 600, "So... what do you do?", 48, 520, tail=(gx - 10, FLOOR - 400),
                   alpha=fade(t, 23, 28))
            for k in range(3):
                yy = FLOOR - 420 + ((t * 150 + k * 40) % 120)
                c.set_source_rgb(0.4, 0.65, 0.95)
                c.arc(330 + k * 12, yy, 8, 0, 2 * math.pi)
                c.fill()
    elif t < 36:
        guest.draw(c, S.SHRUG, 680, guest.ground_y(S.SHRUG, FLOOR), -1, "flat", color=BLUE)
        x = 260 - max(0, (t - 31)) * 25
        pose = S.PHONE if t < 31 else dict(S.walk(t * 5), ua_r=20, fa_r=120)
        me.draw(c, pose, x, me.ground_y(pose, FLOOR), 1 if t < 31 else -1, "flat")
        j = me.joints(pose, x, me.ground_y(pose, FLOOR), 1 if t < 31 else -1)
        hx, hy = j["hand_r"]
        c.set_source_rgb(*INK)
        rounded(c, hx - 12, hy - 50, 30, 56, 6)
        c.fill()
        bubble(c, 420, 620, "Oh no, I HAVE to take this!", 46, 560, tail=(x + 20, FLOOR - 430),
               alpha=fade(t, 28.5, 33))
    elif t < 43:
        x = 140 - min(1, (t - 36) / 3) * 260
        pose = S.walk(t * 6)
        me.draw(c, pose, x + 260, me.ground_y(pose, FLOOR), -1, "smile")
        door(c, 1.0 if t < 40 else 0.0)
    else:
        pose = dict(S.LIE)
        me.draw(c, pose, 560, FLOOR - 222, 1, "happy")
        if t >= 52:
            bubble(c, 560, 700, "That was SO fun! Let's do it again!", 46, 600, alpha=fade(t, 52.2, 56))
    text(c, "Introverts at parties", W / 2, 170, 72, INK)
    text(c, "be like:", W / 2, 255, 72, (0.85, 0.3, 0.3))
    for a, b, s in BEATS:
        al = fade(t, a + 0.1, b - 0.05)
        if al:
            caption(c, s, W / 2, 1640, 50, 980, alpha=al)
    if t > 56:
        end_card(c, W, H, [("Tag an introvert", 92, (1, 0.82, 0.25)), ("who does this", 60, (1, 1, 1))],
                 t - 56)


def sound(a):
    # loud party music until he leaves, then quiet keys at home
    a.music(0, 40, bpm=124, chords=((0, 4, 7), (9, 12, 16), (5, 9, 12), (7, 11, 14)), root=220.0, vol=0.75)
    a.music(43, 60, bpm=70, chords=((0, 4, 7), (5, 9, 12)), root=261.6, vol=0.35, drums=False)
    a.add(6.5, "pop", 300, 0.2)
    a.add(12.3, "pluck", SCALE[9], 0.3)
    a.add(23.0, "pop", 600, 0.3)
    a.add(23.2, "tick", 2000, 0.3)
    for k in range(6):
        a.add(28.3 + k * 0.35, "beep", 1400, 0.12 if k % 2 == 0 else 0.0)
    a.add(40.0, "thud", 90, 0.5)
    for i, n in enumerate((7, 9, 11)):
        a.add(43.3 + 0.12 * i, "bell", SCALE[n], 0.2)
    a.add(52.2, "pop", 900, 0.25)


if __name__ == "__main__":
    import sys
    import lib
    lib.run(sys.modules[__name__], sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else None)
