"""Stickman rig: poses as absolute limb angles, forward kinematics, drawing, procedural motion cycles.

Angles are in degrees, 0 = pointing straight down, +90 = pointing in the facing direction.
`lean` tilts the torso (0 = upright, + = leaning forward).
"""
import math

import cairo

KEYS = ["lean", "head", "ua_l", "fa_l", "ua_r", "fa_r", "th_l", "sh_l", "th_r", "sh_r"]

STAND = dict(lean=0, head=0, ua_l=-8, fa_l=-4, ua_r=8, fa_r=4, th_l=-6, sh_l=-6, th_r=6, sh_r=6)
SIT = dict(lean=-5, head=0, ua_l=10, fa_l=60, ua_r=20, fa_r=70, th_l=88, sh_l=0, th_r=92, sh_r=4)
ARMS_UP = dict(STAND, ua_l=-135, fa_l=-155, ua_r=135, fa_r=155)
THINK = dict(STAND, head=-8, ua_r=25, fa_r=160, ua_l=10, fa_l=80)
CROUCH = dict(lean=25, head=-10, ua_l=-30, fa_l=0, ua_r=-20, fa_r=10, th_l=70, sh_l=-30, th_r=80, sh_r=-20)
LIE = dict(lean=-90, head=0, ua_l=-100, fa_l=-100, ua_r=-80, fa_r=-80, th_l=90, sh_l=90, th_r=92, sh_r=92)
PULL = dict(lean=-28, head=-10, ua_l=70, fa_l=80, ua_r=75, fa_r=85, th_l=35, sh_l=30, th_r=-25, sh_r=-25)
PUSH = dict(lean=30, head=10, ua_l=95, fa_l=90, ua_r=100, fa_r=95, th_l=-35, sh_l=-35, th_r=20, sh_r=10)
SHRUG = dict(STAND, ua_l=-40, fa_l=-120, ua_r=40, fa_r=120)
FACEPALM = dict(STAND, head=15, ua_r=40, fa_r=170)
PHONE = dict(STAND, head=12, ua_r=20, fa_r=120, ua_l=-10, fa_l=110)


def lerp_pose(a, b, u):
    return {k: a[k] + (b[k] - a[k]) * u for k in KEYS}


def ease(u):
    u = max(0.0, min(1.0, u))
    return u * u * (3 - 2 * u)


def walk(p, amp=28, run=False):
    """p = phase in radians. Returns a walk (or run) pose."""
    s = math.sin(p)
    if run:
        amp = 45
    th_l, th_r = amp * s, -amp * s
    bend = 55 if run else 28
    sh_l = th_l - bend * max(0, -math.cos(p))
    sh_r = th_r - bend * max(0, math.cos(p))
    arm = (40 if run else 22)
    ua_l, ua_r = -arm * s, arm * s
    elbow = 85 if run else 18
    return dict(lean=14 if run else 3, head=0, ua_l=ua_l, fa_l=ua_l + elbow, ua_r=ua_r, fa_r=ua_r + elbow,
                th_l=th_l, sh_l=sh_l, th_r=th_r, sh_r=sh_r)


def climb(p):
    s = math.sin(p)
    return dict(lean=10, head=-15, ua_l=150 + 20 * s, fa_l=165 + 15 * s, ua_r=150 - 20 * s, fa_r=165 - 15 * s,
                th_l=40 + 30 * s, sh_l=0 + 20 * s, th_r=40 - 30 * s, sh_r=0 - 20 * s)


def pushup(p):
    d = (1 - math.cos(p)) / 2  # 0 = up, 1 = down
    return dict(lean=78 + 8 * d, head=0, ua_l=-8 - 40 * d, fa_l=-8 + 45 * d, ua_r=-4 - 40 * d, fa_r=-4 + 45 * d,
                th_l=-50 - 16 * d, sh_l=-50 - 16 * d, th_r=-52 - 16 * d, sh_r=-52 - 16 * d)


class Stick:
    def __init__(self, size=200, color=(1, 1, 1), width=None):
        self.s = size
        self.color = color
        self.w = width or max(3.0, size * 0.065)
        L = size
        self.torso, self.neck, self.head_r = 0.36 * L, 0.05 * L, 0.11 * L
        self.ua, self.fa, self.th, self.sh = 0.19 * L, 0.19 * L, 0.25 * L, 0.25 * L

    def joints(self, pose, x, y, face=1):
        """x, y = hip position. Returns dict of joint coordinates."""
        def vec(ang, ln):
            a = math.radians(ang)
            return face * math.sin(a) * ln, math.cos(a) * ln

        j = {"hip": (x, y)}
        lean = math.radians(pose["lean"])
        nx, ny = face * math.sin(lean) * self.torso, -math.cos(lean) * self.torso
        j["neck"] = (x + nx, y + ny)
        sh = j["neck"]
        ha = lean + math.radians(pose["head"])
        j["head"] = (sh[0] + face * math.sin(ha) * (self.neck + self.head_r),
                     sh[1] - math.cos(ha) * (self.neck + self.head_r))
        for side in ("l", "r"):
            ex, ey = vec(pose["ua_" + side], self.ua)
            j["elbow_" + side] = (sh[0] + ex, sh[1] + ey)
            hx, hy = vec(pose["fa_" + side], self.fa)
            j["hand_" + side] = (sh[0] + ex + hx, sh[1] + ey + hy)
            kx, ky = vec(pose["th_" + side], self.th)
            j["knee_" + side] = (x + kx, y + ky)
            fx, fy = vec(pose["sh_" + side], self.sh)
            j["foot_" + side] = (x + kx + fx, y + ky + fy)
        return j

    def ground_y(self, pose, ground, hands=False):
        """Hip y so that the lowest point of the feet (and optionally hands) touches `ground`."""
        j = self.joints(pose, 0, 0)
        pts = ["foot_l", "foot_r", "knee_l", "knee_r"] + (["hand_l", "hand_r"] if hands else [])
        low = max(j[k][1] for k in pts)
        return ground - low - self.w / 2

    def draw(self, c, pose, x, y, face=1, expr="flat", color=None, alpha=1.0, belly=0.0, muscle=0.0,
             hat=None, t=None, shadow=None, talk=False):
        """t: enables breathing + blinking. shadow: ground y for a soft shadow. talk: mouth flaps."""
        if t is not None:
            pose = dict(pose)
            pose["lean"] = pose["lean"] + 1.2 * math.sin(t * 2.4 + x * 0.01)
            pose["head"] = pose["head"] + 2.0 * math.sin(t * 1.3 + x * 0.02)
            if expr in ("flat", "smile", "sad") and ((t + x * 0.003) % 3.6) < 0.13:
                expr = "blink"
            if talk and expr != "blink" and (t * 9) % 2 < 1:
                expr = "talk"
        j = self.joints(pose, x, y, face)
        if shadow is not None:
            col0 = color or self.color
            h = max(0.0, shadow - max(j["foot_l"][1], j["foot_r"][1]))
            k = max(0.25, 1 - h / (self.s * 1.5))
            c.save()
            c.translate(j["hip"][0], shadow + 3)
            c.scale(1, 0.18)
            c.new_path()
            c.arc(0, 0, self.s * 0.32 * k, 0, 2 * math.pi)
            c.restore()
            c.set_source_rgba(0, 0, 0, 0.22 * k * alpha)
            c.fill()
        col = color or self.color
        c.set_line_cap(cairo.LINE_CAP_ROUND)
        c.set_line_join(cairo.LINE_JOIN_ROUND)
        c.set_source_rgba(*col, alpha)
        w = self.w
        for side in ("l", "r"):
            c.set_line_width(w * (1 + muscle * 0.9))
            c.move_to(*j["neck"])
            c.line_to(*j["elbow_" + side])
            c.line_to(*j["hand_" + side])
            c.stroke()
            c.set_line_width(w)
            c.move_to(*j["hip"])
            c.line_to(*j["knee_" + side])
            c.line_to(*j["foot_" + side])
            c.stroke()
        c.set_line_width(w * (1 + muscle * 0.6))
        c.move_to(*j["hip"])
        c.line_to(*j["neck"])
        c.stroke()
        if belly > 0:
            mx = (j["hip"][0] * 0.55 + j["neck"][0] * 0.45) + face * belly * self.s * 0.06
            my = j["hip"][1] * 0.55 + j["neck"][1] * 0.45
            c.new_path()
            c.arc(mx, my, belly * self.s * 0.13, 0, 2 * math.pi)
            c.fill()
        hx, hy = j["head"]
        r = self.head_r
        c.set_line_width(w)
        c.new_path()
        c.arc(hx, hy, r, 0, 2 * math.pi)
        c.stroke()
        self.face(c, hx, hy, r, face, expr, col, alpha)
        if hat == "cap":
            c.set_source_rgba(*col, alpha)
            c.arc(hx, hy - r * 0.2, r * 1.02, math.pi, 2 * math.pi)
            c.fill()
            c.rectangle(hx if face > 0 else hx - r * 1.6, hy - r * 0.28, r * 1.6, r * 0.22)
            c.fill()
        return j

    def face(self, c, hx, hy, r, face, expr, col, alpha):
        if expr is None:
            return
        c.set_source_rgba(*col, alpha)
        ex = hx + face * r * 0.32
        for dx in (-0.22, 0.22):
            if expr == "blink":
                c.set_line_width(max(2, r * 0.1))
                c.move_to(ex + dx * r * 1.4 - r * 0.1, hy - r * 0.15)
                c.line_to(ex + dx * r * 1.4 + r * 0.1, hy - r * 0.15)
                c.stroke()
            elif expr in ("sleep", "happy"):
                c.set_line_width(max(2, r * 0.12))
                c.arc(ex + dx * r * 1.4, hy - r * 0.12, r * 0.13, math.pi * 1.1, math.pi * 1.9)
                c.stroke()
            elif expr == "shock":
                c.set_line_width(max(2, r * 0.08))
                c.arc(ex + dx * r * 1.4, hy - r * 0.15, r * 0.16, 0, 2 * math.pi)
                c.stroke()
            else:
                c.arc(ex + dx * r * 1.4, hy - r * 0.15, r * 0.1, 0, 2 * math.pi)
                c.fill()
        c.set_line_width(max(2, r * 0.1))
        my = hy + r * 0.35
        if expr in ("smile", "happy"):
            c.arc(ex, my - r * 0.15, r * 0.3, 0.15 * math.pi, 0.85 * math.pi)
            c.stroke()
        elif expr == "sad":
            c.arc(ex, my + r * 0.2, r * 0.25, 1.2 * math.pi, 1.8 * math.pi)
            c.stroke()
        elif expr in ("shock", "scream"):
            c.arc(ex, my, r * 0.16, 0, 2 * math.pi)
            c.fill()
        elif expr == "sleep":
            pass
        elif expr == "talk":
            c.save()
            c.translate(ex, my)
            c.scale(1, 0.7)
            c.arc(0, 0, r * 0.17, 0, 2 * math.pi)
            c.restore()
            c.fill()
        else:
            c.move_to(ex - r * 0.2, my)
            c.line_to(ex + r * 0.2, my)
            c.stroke()


class Blend:
    """Smoothly blends between successive target poses (per character)."""

    def __init__(self, dur=0.22):
        self.dur = dur
        self.cur = None
        self.src = None
        self.tgt = None
        self.t0 = 0.0

    def __call__(self, target, t):
        if self.tgt is None:
            self.cur = self.src = self.tgt = dict(target)
            self.t0 = t
            return self.cur
        if any(abs(target[k] - self.tgt[k]) > 25 for k in KEYS):
            self.src = dict(self.cur)
            self.t0 = t
        self.tgt = dict(target)
        u = ease((t - self.t0) / self.dur)
        self.cur = lerp_pose(self.src, self.tgt, u) if u < 1 else dict(self.tgt)
        return self.cur
