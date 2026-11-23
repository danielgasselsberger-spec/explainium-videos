import numpy as np, wave, subprocess
SR = 44100
rng = np.random.default_rng(7)
def save(path, x, stereo=False):
    x = np.clip(x, -1, 1)
    if not stereo: x = np.stack([x, x], 1)
    with wave.open(path, "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((x * 32767).astype(np.int16).tobytes())
def t_(d): return np.arange(int(d * SR)) / SR
def lp(x, cutoff):  # one-pole lowpass, cutoff may be array
    a = np.exp(-2 * np.pi * np.broadcast_to(cutoff, x.shape) / SR)
    y = np.zeros_like(x); p = 0.0
    for i in range(len(x)):
        p = (1 - a[i]) * x[i] + a[i] * p; y[i] = p
    return y
def fft_band(x, lo, hi):
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR)
    X[(f < lo) | (f > hi)] = 0; return np.fft.irfft(X, len(x))
# ---------------- MUSIC ----------------
D = 70.0; t = t_(D); N = len(t)
def note(m): return 440 * 2 ** ((m - 69) / 12)
chords = [[50, 57, 62, 65, 69], [46, 53, 58, 62, 65], [43, 50, 55, 58, 62], [45, 52, 57, 61, 64]]  # Dm Bb Gm A
bar = 4.0  # seconds per chord
L = np.zeros(N); R = np.zeros(N)
for ci in range(int(D / bar) + 1):
    ch = chords[ci % 4]; s0 = int(ci * bar * SR); s1 = min(N, int((ci + 1) * bar * SR + 1.5 * SR))
    if s0 >= N: break
    tt = np.arange(s1 - s0) / SR
    env = np.minimum(1, tt / 1.2) * np.clip((bar + 1.5 - tt) / 1.5, 0, 1)
    for k, m in enumerate(ch):
        f = note(m)
        for det, pan in ((-0.12, 0.8), (0.12, 0.2)):
            v = np.sin(2 * np.pi * (f + det) * tt + k) * 0.5 + 0.18 * np.sin(4 * np.pi * (f + det) * tt)
            L[s0:s1] += v * env * pan * 0.045; R[s0:s1] += v * env * (1 - pan) * 0.045
# soft arpeggio plucks (eighths), gentle pulse
step = bar / 8
for i in range(int(D / step)):
    ch = chords[int(i * step / bar) % 4]
    m = ch[[1, 2, 3, 4, 3, 2, 4, 2][i % 8]] + 12
    s0 = int(i * step * SR); dur = 0.9; s1 = min(N, s0 + int(dur * SR))
    tt = np.arange(s1 - s0) / SR
    env = np.exp(-tt * 6) * np.minimum(1, tt / 0.005)
    v = (np.sin(2 * np.pi * note(m) * tt) + 0.3 * np.sin(2 * np.pi * 2 * note(m) * tt) * np.exp(-tt * 10)) * env * 0.09
    pan = 0.5 + 0.3 * np.sin(i * 0.7)
    L[s0:s1] += v * pan; R[s0:s1] += v * (1 - pan)
# soft kick-ish pulse every beat + shaker
for i in range(int(D / (bar / 4))):
    s0 = int(i * bar / 4 * SR); tt = t_(0.35); s1 = min(N, s0 + len(tt)); tt = tt[:s1 - s0]
    f = 50 + 70 * np.exp(-tt * 30); ph = 2 * np.pi * np.cumsum(f) / SR
    v = np.sin(ph) * np.exp(-tt * 9) * 0.22
    L[s0:s1] += v; R[s0:s1] += v
    s0h = s0 + int(bar / 8 * SR); nz = rng.standard_normal(int(0.06 * SR))
    nz = np.diff(nz, prepend=0) * np.exp(-np.arange(len(nz)) / SR * 60) * 0.03
    s1h = min(N, s0h + len(nz)); L[s0h:s1h] += nz[:s1h - s0h] * 0.7; R[s0h:s1h] += nz[:s1h - s0h]
# simple reverb via delays
for d, g in ((0.031, 0.35), (0.067, 0.28), (0.113, 0.22), (0.191, 0.16), (0.293, 0.1)):
    k = int(d * SR); L[k:] += R[:-k] * g; R[k:] += L[:-k] * g * 0.9
m = np.stack([L, R], 1); m /= np.abs(m).max() * 1.12
save("tools/musik.wav", m, stereo=True)
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", "tools/musik.wav", "-b:a", "192k", "public/musik.mp3"], check=True)
# ---------------- SFX ----------------
def plop():
    tt = t_(0.18); f = 900 * np.exp(-tt * 22) + 180; ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * np.exp(-tt * 28) * np.minimum(1, tt / 0.002) * 0.9
def drop():
    tt = t_(0.25); f = 600 + 1400 * (1 - np.exp(-tt * 40)); ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * np.exp(-tt * 25) * np.minimum(1, tt / 0.003) * 0.8
def whoosh(d=0.6):
    tt = t_(d); nz = rng.standard_normal(len(tt))
    cut = 300 + 3500 * np.sin(np.pi * tt / d) ** 2
    y = lp(lp(nz, cut), cut) - lp(nz, cut * 0.3) * 0.6
    env = np.sin(np.pi * tt / d) ** 1.5
    return y * env / np.abs(y * env).max() * 0.7
def thud():
    tt = t_(0.45); f = 40 + 120 * np.exp(-tt * 25); ph = 2 * np.pi * np.cumsum(f) / SR
    nz = lp(rng.standard_normal(len(tt)), 1500) * np.exp(-tt * 40) * 2
    y = np.sin(ph) * np.exp(-tt * 8) + nz
    return y / np.abs(y).max() * 0.95
def pop():
    tt = t_(0.09); f = 1800 * np.exp(-tt * 30) + 500; ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * np.exp(-tt * 50) * 0.7
def clink():
    tt = t_(0.6); y = sum(np.sin(2 * np.pi * f * tt) * np.exp(-tt * k) for f, k in ((2400, 9), (3710, 12), (5230, 16)))
    return y / 3 * np.minimum(1, tt / 0.001) * 0.6
def shimmer():
    tt = t_(1.0); y = sum(np.sin(2 * np.pi * f * tt + i) * np.exp(-tt * 4) * np.minimum(1, tt / (0.03 + 0.06 * i)) for i, f in enumerate((1318, 1568, 1976, 2637)))
    return y / 4 * 0.6
def tick():
    tt = t_(0.05); return np.sin(2 * np.pi * 2200 * tt) * np.exp(-tt * 120) * 0.6
def timelapse():  # rising whoosh with ticks
    d = 1.0; y = whoosh(d) * 0.6; tt = t_(d)
    for i in range(10):
        s = int((i / 10) ** 0.8 * d * SR); k = tick(); e = min(len(y), s + len(k)); y[s:e] += k[:e - s] * 0.6
    return y
for name, fn in dict(plop=plop, drop=drop, whoosh=whoosh, thud=thud, pop=pop, clink=clink, shimmer=shimmer, timelapse=timelapse).items():
    save(f"public/sfx/{name}.wav", fn())
print("ok")
