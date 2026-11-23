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
