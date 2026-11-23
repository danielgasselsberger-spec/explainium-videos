"""S01 (Short): Overthinker vs Doer - same mountain, same year."""
import math

import stick as S
from lib import (INK, PALETTE, SCALE, Particles, bubble, camera, ease, end_card, fade, narrated_sound, paper, pulse,
                 rounded, text, word_captions)
from tts import Narration

NARR = Narration([
    (0.3, "Two guys. Same mountain. Same year."),
    (3.0, "The doer just starts walking. No plan, no perfect shoes."),
    (7.6, "The overthinker asks: what if I fall?"),
    (12.0, "And the doer does fall. Gets up. Keeps going."),
    (17.0, "Meanwhile: tutorials, plans, and version seven of the plan."),
    (25.0, "Day after day, the doer takes one small step."),
    (32.5, "The weather isn't perfect, says the overthinker. Maybe next month."),
    (40.5, "Day three hundred and fifty."),
    (46.6, "The doer is standing on the top."),
    (51.3, "Don't wait for the perfect moment. Which one are you?"),
])
CHUNKS = NARR.chunks()
FX = Particles(3)
B_DOER, B_OVER = S.Blend(), S.Blend()

W, H, DUR = 1080, 1920, 60
PANEL_H = 760
TOPS = [300, 300 + PANEL_H + 40]
GREEN, RED = (0.2, 0.65, 0.35), (0.85, 0.25, 0.25)
st = S.Stick(150, INK)


def mountain(c, y0):
    base = y0 + PANEL_H - 90
    c.set_source_rgb(0.82, 0.86, 0.8)
    c.move_to(80, base)
    c.line_to(860, y0 + 150)
    c.line_to(1020, base)
    c.close_path()
    c.fill()
    c.set_source_rgb(1, 1, 1)
    c.move_to(760, y0 + 205)
    c.line_to(860, y0 + 150)
    c.line_to(905, y0 + 210)
    c.line_to(860, y0 + 225)
    c.close_path()
    c.fill()
    c.set_source_rgb(*INK)
    c.set_line_width(4)
    c.move_to(80, base)
    c.line_to(860, y0 + 150)
    c.line_to(1020, base)
    c.stroke()
    c.move_to(32, base)
    c.line_to(1048, base)
    c.stroke()
    return base


def slope_point(y0, u):
    base = y0 + PANEL_H - 90
    x = 150 + (860 - 150) * u
    y = base + (y0 + 150 - base) * ((x - 80) / (860 - 80))
    return x, y


def doer_progress(t):
    if t < 3:
        return 0.0, "stand"
    if t < 12:
        return ease((t - 3) / 9) * 0.32, "walk"
    if t < 13.5:
        return 0.32 - ease((t - 12) / 1.5) * 0.12, "fall"
    if t < 15:
        return 0.20, "getup"
    if t < 47:
        return 0.20 + (t - 15) / 32 * 0.8, "walk"
    return 1.0, "top"


def frame(c, t):
    paper(c, W, H)
    top_x, top_y = slope_point(TOPS[0], 1.0)
    z = 1 + 0.12 * S.ease((t - 47) / 1.2) if 47 < t < 52 else 1.0
    camera(c, W, H, t, zoom=z, fx=W / 2 + (top_x - W / 2) * (z - 1) / 0.12 * 0.5,
           fy=H / 2 + (top_y - H / 2) * (z - 1) / 0.12 * 0.6, shake=pulse(t, 13.4, 0.5, 16))
    scene(c, t)
    c.restore()
    if t > 51:
        end_card(c, W, H, [("Don't wait for", 90, (1, 1, 1)), ("the perfect moment.", 90, (1, 0.82, 0.25)),
                           ("Which one are you?", 46, (0.8, 0.8, 0.8))], t - 51)
    word_captions(c, CHUNKS, t, W / 2, 1105 if t < 51 else 1500, 72)


def scene(c, t):
    text(c, "OVERTHINKER vs DOER", W / 2, 150, 76, INK)
    text(c, "Same mountain. Same year.", W / 2, 230, 48, (0.45, 0.45, 0.5), bold=False)
    day = 1 + int(364 * min(1, t / 50))
    for k, y0 in enumerate(TOPS):
        rounded(c, 30, y0, W - 60, PANEL_H, 30)
        c.set_source_rgb(1, 1, 1)
        c.fill_preserve()
        c.set_source_rgb(*INK)
        c.set_line_width(4)
        c.stroke()
        mountain(c, y0)
        col = GREEN if k == 0 else RED
        rounded(c, 60, y0 + 28, 330, 66, 18)
        c.set_source_rgb(*col)
        c.fill()
        text(c, "DOER" if k == 0 else "OVERTHINKER", 225, y0 + 76, 40, (1, 1, 1))
        text(c, f"Day {day}", W - 80, y0 + 76, 40, INK, align="right")
    # ---- doer (top) ----
    y0 = TOPS[0]
    u, mode = doer_progress(t)
    x, gy = slope_point(y0, u)
    if mode == "walk":
        pose = S.walk(t * 7)
        pose["lean"] += 14
        expr = "flat"
        if int(t * 30) % 13 == 0:
            FX.emit(x, gy, 3, (0.6, 0.55, 0.45), speed=(30, 90), up=60, life=(0.3, 0.6), size=(3, 6), gravity=300)
    elif mode == "fall":
        pose = S.LIE
        expr = "shock"
    elif mode == "getup":
        pose = S.lerp_pose(S.CROUCH, S.STAND, S.ease((t - 13.5) / 1.5))
        expr = "flat"
    elif mode == "top":
        pose = S.ARMS_UP if (t * 2) % 2 < 1.4 else S.STAND
        expr = "happy"
    else:
        pose, expr = S.STAND, "smile"
    if abs(t - 13.4) < 0.5 / 30:
        FX.emit(x, gy, 26, (0.55, 0.5, 0.42), speed=(80, 260), up=150, life=(0.4, 0.9), size=(4, 9), gravity=500)
    if abs(t - 47.3) < 0.5 / 30:
        FX.emit(x, gy - 150, 90, list(PALETTE), speed=(200, 650), up=300, life=(1.2, 2.2), size=(6, 11),
                gravity=500, kind="confetti")
    if mode == "fall":
        st.draw(c, S.LIE, x, gy - 18, 1, "shock")
    else:
        p = B_DOER(pose, t)
        st.draw(c, p, x, st.ground_y(p, gy), 1, expr, t=t, shadow=gy)
    if t > 47:
        fx, fy = slope_point(y0, 1.0)
        c.set_source_rgb(*INK)
        c.set_line_width(5)
        c.move_to(fx + 60, fy)
        c.line_to(fx + 60, fy - 130)
        c.stroke()
        h = min(1, (t - 47) / 0.6)
        c.set_source_rgb(*GREEN)
        c.move_to(fx + 62, fy - 130)
        c.line_to(fx + 62 + 90 * h, fy - 105)
        c.line_to(fx + 62, fy - 80)
        c.close_path()
        c.fill()
    d_lines = [(3, 11, "Just starts."), (12.2, 16, "Falls. Gets up."), (17, 30, "Step by step..."),
               (30, 46, "Still going."), (47.5, 60, "Made it.")]
    for a, b, s in d_lines:
        al = fade(t, a, b)
        if al:
            bubble(c, 330, y0 + 130, s, 40, 420, alpha=al)
    # ---- overthinker (bottom) ----
    y0 = TOPS[1]
    x, gy = slope_point(y0, 0.0)
    x -= 20
    o_beats = [(3, 10, "What if I fall?", S.THINK, "flat"),
               (10, 17, "I need better shoes first...", S.THINK, "flat"),
               (17, 25, "Watching 'how to climb' videos", S.PHONE, "flat"),
               (25, 33, "Plan v1... v2... v7", S.THINK, "flat"),
               (33, 41, "Weather isn't perfect yet", S.SHRUG, "sad"),
               (41, 48, "Maybe next month", S.THINK, "flat"),
               (48, 60, "Wait... he's at the TOP?!", S.STAND, "shock")]
    pose, expr = S.STAND, "flat"
    for a, b, s, p, e in o_beats:
        if a <= t < b:
            pose, expr = p, e
        al = fade(t, a, b)
        if al:
            bubble(c, 560, y0 + 140, s, 40, 520, tail=(x + 30, gy - 230), think=a < 48, alpha=al)
    p = B_OVER(pose, t)
    st.draw(c, p, x, st.ground_y(p, gy), 1, expr, t=t, shadow=gy)
    if 33 <= t < 41 and int(t * 30) % 3 == 0:
        FX.emit(x + FX.r.uniform(-60, 70), gy - 5, 2, (0.35, 0.55, 0.95), speed=(40, 120), up=120,
                life=(0.2, 0.4), size=(2, 4), gravity=900)
    if pose is S.PHONE:
        j = st.joints(pose, x, st.ground_y(pose, gy), 1)
        hx, hy = j["hand_r"]
        c.set_source_rgb(*INK)
        rounded(c, hx - 8, hy - 34, 26, 44, 5)
        c.fill()
    if 33 <= t < 41:
        cx_, cy_ = x + 10, gy - 330
        c.set_source_rgb(0.55, 0.58, 0.65)
        for dx, r in ((-50, 40), (0, 55), (50, 40)):
            c.arc(cx_ + dx, cy_, r, 0, 2 * math.pi)
            c.fill()
        c.set_source_rgb(0.3, 0.5, 0.9)
        c.set_line_width(4)
        for k in range(6):
            yy = cy_ + 50 + ((t * 300 + k * 37) % 120)
            xx = cx_ - 60 + k * 24
            c.move_to(xx, yy)
            c.line_to(xx - 6, yy + 18)
        c.stroke()
    FX.step_draw(c, t)


def sound(a):
    narrated_sound(a, NARR, _music)


def _music(a):
    a.music(0, 60, bpm=96, chords=((0, 4, 7), (7, 11, 14), (9, 12, 16), (5, 9, 12)), root=220.0, vol=0.55)
    a.add(12.0, "whoosh", 400, 0.4)
    a.add(13.4, "thud", 70, 0.6)
    for k in range(int((47 - 15) * 3.5)):
        a.add(15 + k / 3.5, "tick", 900, 0.05)
    a.add(47.2, "bell", SCALE[12], 0.35)
    a.add(47.4, "bell", SCALE[14], 0.35)
    a.add(48.2, "pop", 400, 0.3)
    a.add(51, "whoosh", 600, 0.3)


if __name__ == "__main__":
    import sys
    import lib
    lib.run(sys.modules[__name__], sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else None)
