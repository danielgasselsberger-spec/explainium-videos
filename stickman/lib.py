"""Shared helpers: cairo frame rendering piped to ffmpeg, synthesized audio, text styling."""
import math
import os
import subprocess
import wave

import cairo
import numpy as np

FPS = 30
SR = 44100

# Pentatonic scale (C major pentatonic) over several octaves, in Hz.
_PENTA = [0, 2, 4, 7, 9]
SCALE = [261.63 * 2 ** ((o * 12 + s) / 12) for o in range(-1, 3) for s in _PENTA]


def hsv(h, s=0.75, v=1.0):
    h = (h % 1.0) * 6
    i = int(h)
    f = h - i
    p, q, t = v * (1 - s), v * (1 - s * f), v * (1 - s * (1 - f))
    return [(v, t, p), (q, v, p), (p, v, t), (p, q, v), (t, p, v), (v, p, q)][i % 6]


PALETTE = [(1.0, 0.33, 0.33), (0.25, 0.6, 1.0), (0.3, 0.9, 0.45), (1.0, 0.8, 0.2),
           (0.75, 0.4, 1.0), (1.0, 0.55, 0.15), (0.2, 0.9, 0.9), (1.0, 0.45, 0.75)]
NAMES = ["Red", "Blue", "Green", "Yellow", "Purple", "Orange", "Cyan", "Pink"]


class Audio:
    def __init__(self, dur):
        self.buf = np.zeros(int(SR * (dur + 2)), dtype=np.float64)
        self._cache = {}

    def _tone(self, kind, freq):
        key = (kind, round(freq, 1))
        if key in self._cache:
            return self._cache[key]
        if kind == "pluck":
            n = int(SR * 0.45)
            t = np.arange(n) / SR
            env = np.exp(-t * 9) * np.minimum(1, t * 400)
            s = (np.sin(2 * np.pi * freq * t) + 0.35 * np.sin(4 * np.pi * freq * t)
                 + 0.12 * np.sin(6 * np.pi * freq * t)) * env
        elif kind == "bell":
            n = int(SR * 1.2)
            t = np.arange(n) / SR
            env = np.exp(-t * 3.5) * np.minimum(1, t * 600)
            s = (np.sin(2 * np.pi * freq * t) + 0.5 * np.sin(2 * np.pi * freq * 2.76 * t) * np.exp(-t * 6)
                 + 0.25 * np.sin(2 * np.pi * freq * 5.4 * t) * np.exp(-t * 9)) * env
        elif kind == "beep":
            n = int(SR * 0.07)
            t = np.arange(n) / SR
            s = (np.sin(2 * np.pi * freq * t) + 0.3 * np.sign(np.sin(2 * np.pi * freq * t)) * 0.3) \
                * np.minimum(1, t * 800) * np.exp(-t * 35)
        elif kind == "whoosh":
            n = int(SR * 0.45)
            t = np.arange(n) / SR
            rng = np.random.default_rng(7)
            noise = rng.standard_normal(n)
            k = int(max(2, freq / 100))
            noise = np.convolve(noise, np.ones(k) / k, mode="same")
            env = np.sin(np.pi * np.minimum(1, t / 0.45)) ** 2
            s = noise * env * 1.6
        elif kind == "thud":
            n = int(SR * 0.35)
            t = np.arange(n) / SR
            f = freq * (1 + 2 * np.exp(-t * 30))
            s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 12)
            rng = np.random.default_rng(3)
            s += 0.4 * rng.standard_normal(n) * np.exp(-t * 60)
        elif kind == "kick":
            n = int(SR * 0.25)
            t = np.arange(n) / SR
            f = 50 * (1 + 3 * np.exp(-t * 40))
            s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 14)
        elif kind == "hat":
            n = int(SR * 0.05)
            t = np.arange(n) / SR
            rng = np.random.default_rng(5)
            x = rng.standard_normal(n)
            s = (x - np.concatenate([[0], x[:-1]])) * np.exp(-t * 90) * 0.5
        elif kind == "snare":
            n = int(SR * 0.2)
            t = np.arange(n) / SR
            rng = np.random.default_rng(9)
            s = rng.standard_normal(n) * np.exp(-t * 25) * 0.7 + np.sin(2 * np.pi * 190 * t) * np.exp(-t * 30) * 0.5
        elif kind == "bass":
            n = int(SR * 0.4)
            t = np.arange(n) / SR
            s = (np.sin(2 * np.pi * freq * t) + 0.3 * np.sin(4 * np.pi * freq * t)) * np.exp(-t * 4) \
                * np.minimum(1, t * 300)
        elif kind == "keys":
            n = int(SR * 0.9)
            t = np.arange(n) / SR
            s = (np.sin(2 * np.pi * freq * t) + 0.25 * np.sin(4 * np.pi * freq * t)) * np.exp(-t * 3.2) \
                * np.minimum(1, t * 200)
        elif kind == "tick":
            n = int(SR * 0.06)
            t = np.arange(n) / SR
            s = np.sin(2 * np.pi * freq * t) * np.exp(-t * 70)
        elif kind == "pop":
            n = int(SR * 0.18)
            t = np.arange(n) / SR
            rng = np.random.default_rng(int(freq))
            noise = rng.standard_normal(n)
            noise = np.convolve(noise, np.ones(6) / 6, mode="same")
            sweep = np.sin(2 * np.pi * np.cumsum(freq * (1 + 2 * np.exp(-t * 40))) / SR)
            s = (0.6 * noise * np.exp(-t * 45) + sweep * np.exp(-t * 22))
        elif kind == "boom":
            n = int(SR * 1.5)
            t = np.arange(n) / SR
            f = freq * (1 + 1.5 * np.exp(-t * 8))
            s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 2.5)
        else:
            raise ValueError(kind)
        self._cache[key] = s
        return s

    def add(self, t, kind, freq=440.0, vol=0.3):
        s = self._tone(kind, freq) * vol
        i = int(t * SR)
        if i < 0 or i >= len(self.buf):
            return
        j = min(len(self.buf), i + len(s))
        self.buf[i:j] += s[: j - i]

    def pad(self, t0, t1, freqs, vol=0.05):
        """Soft sustained chord between t0 and t1."""
        i0, i1 = int(t0 * SR), min(len(self.buf), int(t1 * SR))
        t = np.arange(i1 - i0) / SR
        dur = (i1 - i0) / SR
        env = np.minimum(1, t / 2.0) * np.minimum(1, (dur - t) / 2.0)
        s = sum(np.sin(2 * np.pi * f * t + k) for k, f in enumerate(freqs))
        self.buf[i0:i1] += s * env * vol

    def music(self, t0, t1, bpm=100, chords=((0, 4, 7), (9, 12, 16), (5, 9, 12), (7, 11, 14)), root=220.0,
              vol=0.5, drums=True, swing=0.0):
        """Simple loop: kick/snare/hat, bass root notes, keyboard chords. One chord per bar."""
        beat = 60.0 / bpm
        t = t0
        b = 0
        while t < t1:
            bar = b // 4
            ch = chords[bar % len(chords)]
            f0 = root * 2 ** (ch[0] / 12)
            if drums:
                self.add(t, "kick" if b % 2 == 0 else "snare", 0, 0.22 * vol)
                self.add(t + beat / 2 + swing * beat, "hat", 0, 0.12 * vol)
            self.add(t, "bass", f0 / 2, 0.22 * vol)
            if b % 4 == 0:
                for n in ch:
                    self.add(t, "keys", root * 2 ** (n / 12), 0.07 * vol)
            if b % 4 == 2:
                for n in ch:
                    self.add(t, "keys", root * 2 ** (n / 12) * 2, 0.04 * vol)
            t += beat
            b += 1

    def write(self, path, dur):
        x = self.buf[: int(SR * dur)]
        x = np.tanh(x * 1.2)  # soft limiter
        peak = np.max(np.abs(x)) or 1.0
        x = x / peak * 0.89
        fade = int(SR * 0.8)
        x[-fade:] *= np.linspace(1, 0, fade)
        st = np.repeat((x * 32767).astype(np.int16)[:, None], 2, axis=1)
        with wave.open(path, "wb") as w:
            w.setnchannels(2)
            w.setsampwidth(2)
            w.setframerate(SR)
            w.writeframes(st.tobytes())


class Video:
    """Draw frames with cairo, pipe them to ffmpeg, mux audio at the end."""

    def __init__(self, path, W, H, dur, preview_dir=None, preview_every=None):
        self.path, self.W, self.H, self.dur = path, W, H, dur
        self.nframes = int(round(dur * FPS))
        self.surface = cairo.ImageSurface(cairo.FORMAT_ARGB32, W, H)
        self.preview_dir = preview_dir
        self.preview_every = preview_every
        self.audio = Audio(dur)
        self.tmp = path + ".silent.mp4"
        self.proc = None
        if not preview_dir:
            self.proc = subprocess.Popen(
                ["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgra", "-s", f"{W}x{H}",
                 "-r", str(FPS), "-i", "-", "-c:v", "libx264", "-preset", "medium", "-crf", "19",
                 "-pix_fmt", "yuv420p", "-threads", "2", self.tmp],
                stdin=subprocess.PIPE)

    def ctx(self):
        c = cairo.Context(self.surface)
        c.set_source_rgb(0, 0, 0)
        c.paint()
        return c

    def emit(self, i):
        self.surface.flush()
        if self.proc:
            self.proc.stdin.write(self.surface.get_data())
        elif i % self.preview_every == 0:
            os.makedirs(self.preview_dir, exist_ok=True)
            self.surface.write_to_png(os.path.join(self.preview_dir, f"f{i:05d}.png"))

    def finish(self):
        if not self.proc:
            return
        self.proc.stdin.close()
        self.proc.wait()
        wav = self.path + ".wav"
        self.audio.write(wav, self.dur)
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", self.tmp, "-i", wav, "-c:v", "copy",
                        "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", self.path],
                       check=True)
        os.remove(self.tmp)
        os.remove(wav)


FONT = "Inter"


def text(c, s, x, y, size, rgb=(1, 1, 1), bold=True, align="center", alpha=1.0):
    c.select_font_face(FONT, cairo.FONT_SLANT_NORMAL,
                       cairo.FONT_WEIGHT_BOLD if bold else cairo.FONT_WEIGHT_NORMAL)
    c.set_font_size(size)
    ext = c.text_extents(s)
    if align == "center":
        x -= ext.x_advance / 2
    elif align == "right":
        x -= ext.x_advance
    c.move_to(x, y)
    c.set_source_rgba(*rgb, alpha)
    c.show_text(s)
    c.new_path()
    return ext.x_advance


def rich(c, parts, x, y, size, align="center"):
    """parts: list of (string, rgb). Drawn on one line."""
    c.select_font_face(FONT, cairo.FONT_SLANT_NORMAL, cairo.FONT_WEIGHT_BOLD)
    c.set_font_size(size)
    total = sum(c.text_extents(s).x_advance for s, _ in parts)
    if align == "center":
        x -= total / 2
    for s, rgb in parts:
        c.move_to(x, y)
        c.set_source_rgb(*rgb)
        c.show_text(s)
        x += c.text_extents(s).x_advance


def ball(c, x, y, r, rgb, glow=True, alpha=1.0):
    if glow and r > 3:
        g = cairo.RadialGradient(x, y, r * 0.6, x, y, r * 2.0)
        g.add_color_stop_rgba(0, *rgb, 0.35 * alpha)
        g.add_color_stop_rgba(1, *rgb, 0)
        c.set_source(g)
        c.arc(x, y, r * 2.0, 0, 2 * math.pi)
        c.fill()
    g = cairo.RadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r)
    hi = tuple(min(1, v * 0.5 + 0.6) for v in rgb)
    g.add_color_stop_rgba(0, *hi, alpha)
    g.add_color_stop_rgba(1, *rgb, alpha)
    c.set_source(g)
    c.arc(x, y, r, 0, 2 * math.pi)
    c.fill()


def fmt(n):
    return f"{n:,}"


def ease(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)


def end_card(c, W, H, lines, t_in):
    """Fade in a dark panel with result lines. lines: list of (text, size, rgb)."""
    a = ease(t_in / 0.6)
    if a <= 0:
        return
    c.set_source_rgba(0, 0, 0, 0.9 * a)
    c.paint()
    total = sum(size * 1.35 for _, size, _ in lines)
    y = H / 2 - total / 2
    for s, size, rgb in lines:
        y += size * 1.1
        text(c, s, W / 2, y, size, rgb, alpha=a)
        y += size * 0.25


def rounded(c, x, y, w, h, r):
    c.new_path()
    c.arc(x + w - r, y + r, r, -math.pi / 2, 0)
    c.arc(x + w - r, y + h - r, r, 0, math.pi / 2)
    c.arc(x + r, y + h - r, r, math.pi / 2, math.pi)
    c.arc(x + r, y + r, r, math.pi, 1.5 * math.pi)
    c.close_path()


def wrap(c, s, size, maxw):
    c.select_font_face(FONT, cairo.FONT_SLANT_NORMAL, cairo.FONT_WEIGHT_BOLD)
    c.set_font_size(size)
    words, lines, cur = s.split(), [], ""
    for w in words:
        test = (cur + " " + w).strip()
        if c.text_extents(test).x_advance > maxw and cur:
            lines.append(cur)
            cur = w
        else:
            cur = test
    if cur:
        lines.append(cur)
    return lines


def caption(c, s, cx, y, size, maxw, fg=(1, 1, 1), box=(0, 0, 0), box_alpha=0.72, alpha=1.0, hl=None):
    """Bold caption in a rounded box, wrapped to maxw. hl = word to color yellow."""
    lines = wrap(c, s, size, maxw)
    lh = size * 1.18
    widths = [c.text_extents(l).x_advance for l in lines]
    bw = max(widths) + size * 0.9
    bh = lh * len(lines) + size * 0.5
    rounded(c, cx - bw / 2, y - size * 0.95, bw, bh, size * 0.3)
    c.set_source_rgba(*box, box_alpha * alpha)
    c.fill()
    for i, l in enumerate(lines):
        x = cx - widths[i] / 2
        for word in l.split(" "):
            col = (1, 0.82, 0.25) if hl and word.strip(".,!?").lower() == hl.lower() else fg
            c.move_to(x, y + i * lh)
            c.set_source_rgba(*col, alpha)
            c.show_text(word + " ")
            x += c.text_extents(word + " ").x_advance
    c.new_path()


def timeline(t, beats):
    """beats: list of (start, end, payload). Returns (payload, local_t, local_u) of the active beat or None."""
    for s, e, p in beats:
        if s <= t < e:
            return p, t - s, (t - s) / (e - s)
    return None, 0.0, 0.0


PAPER = (0.96, 0.95, 0.91)
INK = (0.1, 0.1, 0.12)


def paper(c, W, H):
    c.set_source_rgb(*PAPER)
    c.paint()
    c.set_source_rgba(0.55, 0.65, 0.85, 0.18)
    c.set_line_width(2)
    y = 60
    while y < H:
        c.move_to(0, y)
        c.line_to(W, y)
        y += 64
    c.stroke()


def bubble(c, x, y, s, size=40, maxw=520, tail=None, think=False, alpha=1.0, fg=INK, bg=(1, 1, 1)):
    """Speech/thought bubble centered at x, top at y. tail=(tx, ty) points at the speaker."""
    lines = wrap(c, s, size, maxw)
    lh = size * 1.2
    widths = [c.text_extents(l).x_advance for l in lines]
    bw = max(widths) + size * 1.2
    bh = lh * len(lines) + size * 0.8
    bx, by = x - bw / 2, y
    if tail and not think:
        c.new_path()
        c.move_to(x - size * 0.4, by + bh - 2)
        c.line_to(*tail)
        c.line_to(x + size * 0.4, by + bh - 2)
        c.close_path()
        c.set_source_rgba(*bg, alpha)
        c.fill_preserve()
        c.set_source_rgba(*fg, alpha)
        c.set_line_width(3)
        c.stroke()
    if tail and think:
        tx, ty = tail
        for k, r in enumerate((6, 10, 15)):
            u = (k + 1) / 4
            cx_, cy_ = tx + (x - tx) * u, ty + (by + bh - ty) * u
            c.new_path()
            c.arc(cx_, cy_, r, 0, 2 * math.pi)
            c.set_source_rgba(*bg, alpha)
            c.fill_preserve()
            c.set_source_rgba(*fg, alpha)
            c.set_line_width(3)
            c.stroke()
    rounded(c, bx, by, bw, bh, size * (0.9 if think else 0.45))
    c.set_source_rgba(*bg, alpha)
    c.fill_preserve()
    c.set_source_rgba(*fg, alpha)
    c.set_line_width(3)
    c.stroke()
    c.set_source_rgba(*fg, alpha)
    for i, l in enumerate(lines):
        c.move_to(x - widths[i] / 2, by + size * 0.4 + size + i * lh - size * 0.15)
        c.show_text(l)
    c.new_path()
    return bh


def fade(t, t0, t1, edge=0.3):
    """1 inside [t0, t1] with soft edges."""
    if t < t0 or t > t1:
        return 0.0
    return min(1.0, (t - t0) / edge, (t1 - t) / edge)


def run(mod, out, preview=None):
    v = Video(out, mod.W, mod.H, mod.DUR, preview, 120)
    mod.sound(v.audio)
    for f in range(v.nframes):
        t = f / FPS
        c = v.ctx()
        mod.frame(c, t)
        v.emit(f)
    v.finish()
