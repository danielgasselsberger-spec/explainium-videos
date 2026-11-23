"""Creepy-cute score: music box (minor), low drone, wind, heartbeat, risers and BOOM hits.
Usage: music.py folgeNN  -> folgeNN/music.wav   (cues from timings.json)"""
import sys, json, numpy as np, soundfile as sf
d = sys.argv[1]; tm = json.load(open(f'{d}/timings.json')); L = tm['lines']; T = lambda i: L[i]['start']
SR = 48000; dur = tm['total']; n = int(dur * SR); t = np.arange(n) / SR
rng = np.random.default_rng(3)
import os
CUES = json.load(open(f'{d}/cues.json')) if os.path.exists(f'{d}/cues.json') else {
    'night_from': T(10), 'intro_until': T(4), 'heartbeat_from': T(11), 'heartbeat_until': T(19) + 6,
    'dropout': [T(13) - 0.2, T(15)], 'risers': [[T(13) - 2.0, 2.0], [T(15) - 1.2, 1.2]],
    'booms': [[T(13) + 0.05, 1.1], [T(11), 0.6], [T(15), 0.7], [T(4) + 1.9, 0.5]]}
out = np.zeros((n, 2))
def env_at(a, b, fade=1.5):
    e = np.clip((t - a) / fade, 0, 1) * np.clip((b - t) / fade, 0, 1); return e
def add(sig, start, gain=1.0, pan=0.0):
    i = int(start * SR); j = min(n, i + len(sig))
    if j <= i: return
    out[i:j, 0] += sig[:j - i] * gain * (1 - pan) ; out[i:j, 1] += sig[:j - i] * gain * (1 + pan)
def lowpass(x, a):  # one-pole
    y = np.empty_like(x); acc = 0.0
    for k in range(len(x)): acc += a * (x[k] - acc); y[k] = acc
    return y
def reverb(x, secs=2.2, mix=0.35):
    ir_n = int(secs * SR); ir = rng.standard_normal(ir_n) * np.exp(-np.arange(ir_n) / (SR * secs / 5))
    ir /= np.sqrt((ir ** 2).sum()); y = np.fft.irfft(np.fft.rfft(x, len(x) + ir_n) * np.fft.rfft(ir, len(x) + ir_n))[:len(x)]
    return x * (1 - mix) + y * mix
# --- music box: A minor with a creepy flat-2 (Bb), slightly detuned, 92 bpm
mel = [69, 72, 76, 74, 72, 71, 70, 69, 64, 67, 69, 72, 71, 70, 69, None,
       69, 72, 76, 77, 76, 74, 72, 70, 69, 67, 64, 65, 64, None, None, None]
beat = 60 / 92 / 2
box = np.zeros(n)
def note(m, length=1.6):
    f = 440 * 2 ** ((m - 69) / 12) * 1.003; k = np.arange(int(length * SR)) / SR
    s = (np.sin(2 * np.pi * f * k) + 0.35 * np.sin(2 * np.pi * 2 * f * k) + 0.12 * np.sin(2 * np.pi * 3.01 * f * k)) * np.exp(-k * 3.2)
    return s * np.minimum(1, k * 400)
pos = 0.3; i = 0
while pos < dur - 2:
    m = mel[i % len(mel)]
    if m: 
        s = note(m); a = int(pos * SR); b = min(n, a + len(s)); box[a:b] += s[:b - a]
    pos += beat * (1.0 + 0.04 * np.sin(i)); i += 1  # wobbly, "broken" music box
box = reverb(box * 0.22, 2.5, 0.45)
box_env = np.ones(n) * 0.9
box_env *= 1 - 0.75 * env_at(CUES['dropout'][0], CUES['dropout'][1], 0.3)   # drop out at the big reveal
out += np.stack([box * box_env] * 2, 1)
# --- drone (enters at night part), detuned low fifth + tritone shimmer
night = np.clip((t - CUES['night_from'] + 1.0) / 3.0, 0, 1)
dr = (np.sin(2 * np.pi * 55 * t) + 0.8 * np.sin(2 * np.pi * 55.4 * t) + 0.5 * np.sin(2 * np.pi * 77.8 * t)
      + 0.25 * np.sin(2 * np.pi * 155.6 * t + np.sin(2 * np.pi * 0.2 * t))) * (0.6 + 0.4 * np.sin(2 * np.pi * 0.11 * t))
intro = 0.35 * np.clip(t / 2, 0, 1) * np.clip((CUES['intro_until'] - t) / 1.5, 0, 1)
out += np.stack([dr * 0.09 * np.maximum(night, intro)] * 2, 1)
# --- wind
wind = lowpass(rng.standard_normal(n), 0.02) * (0.5 + 0.5 * np.sin(2 * np.pi * 0.07 * t))
out += np.stack([wind, np.roll(wind, 900)], 1) * 0.5 * np.maximum(night, intro)[:, None]
# --- heartbeat from 3 o'clock, speeding up towards the reveal
hb_t = CUES['heartbeat_from']; bpm = 70
while hb_t < CUES['heartbeat_until']:
    for off, g in ((0, 1.0), (0.22, 0.7)):
        k = np.arange(int(0.25 * SR)) / SR; s = np.sin(2 * np.pi * 48 * k) * np.exp(-k * 18) * g
        add(s * 0.9, hb_t + off)
    bpm = min(130, bpm + 2.2); hb_t += 60 / bpm
# --- risers + BOOM hits
def riser(start, length):
    k = np.arange(int(length * SR)) / SR; x = lowpass(rng.standard_normal(len(k)), 0.15) * (k / length) ** 2
    x += 0.3 * np.sin(2 * np.pi * (200 + 900 * (k / length) ** 2) * k) * (k / length) ** 2; add(x * 0.6, start)
def boom(at, g=1.0):
    k = np.arange(int(2.5 * SR)) / SR
    s = np.sin(2 * np.pi * (60 * np.exp(-k * 1.5) + 30) * k) * np.exp(-k * 1.6) + 0.4 * rng.standard_normal(len(k)) * np.exp(-k * 12)
    add(reverb(s, 2.0, 0.3) * g, at)
for a_, l_ in CUES['risers']: riser(a_, l_)
for a_, g_ in CUES['booms']: boom(a_, g_)
# --- master
out *= np.clip((dur - t) / 2.0, 0, 1)[:, None]
out /= np.abs(out).max() * 1.12
sf.write(f'{d}/music.wav', out.astype(np.float32), SR); print('music ok', round(dur, 1))
