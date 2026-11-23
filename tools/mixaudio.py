"""Rebuild a video's soundtrack without re-rendering the picture (same mix as engine/VideoBase.tsx).
usage: python3 tools/mixaudio.py <slug>   -> replaces the audio track of out/<slug>.mp4 (loudness -14 LUFS)"""
import json, re, subprocess, sys, numpy as np
slug = sys.argv[1]
SR = 48000
tl = json.load(open(f"src/videos/{slug}/timeline.json"))
total = tl["frames"] / 30
def load(path):
    raw = subprocess.run(["ffmpeg", "-loglevel", "error", "-i", path, "-f", "f32le", "-ac", "2", "-ar", str(SR), "-"], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).reshape(-1, 2)
N = int(total * SR)
mix = np.zeros((N, 2), np.float32)
def add(x, at, gain=1.0):
    s = int(round(at * 30)) / 30 * SR  # Remotion places sequences on frame boundaries
    s = int(s)
    if s >= N: return
    n = min(len(x), N - s)
    mix[s:s + n] += x[:n] * gain
# voice
for st in tl["sentences"]:
    add(load(f"public/{slug}/voice/s{st['i']:02d}.mp3"), st["start"])
# music with ducking curve
def smooth(x): x = np.clip(x, 0, 1); return x * x * (3 - 2 * x)
t = np.arange(N) / SR
dmin = np.full(N, 1e9)
for st in tl["sentences"]:
    a, b = st["speechStart"], st["speechEnd"]
    dmin = np.minimum(dmin, np.where(t < a, a - t, np.where(t > b, t - b, 0)))
vol = (0.1 + 0.1 * smooth((dmin - 0.12) / 0.43)) * smooth(t / 0.8) * smooth((total - t) / 1.0)
mus = load("public/musik.mp3")[:N]
mix[: len(mus)] += mus * vol[: len(mus), None]
# sfx parsed from Video.tsx
src = open(f"src/videos/{slug}/Video.tsx").read()
for at, name, g in re.findall(r'\[([0-9.]+), "(\w+)", ([0-9.]+)\]', src[src.index("SFX"):]):
    add(load(f"public/sfx/{name}.wav")[: int(1.5 * SR)], float(at), float(g))
out = f"out/{slug}_mix.wav"
pcm = (np.clip(mix, -1, 1) * 32767).astype(np.int16)
subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-f", "s16le", "-ac", "2", "-ar", str(SR), "-i", "-", out], input=pcm.tobytes(), check=True)
subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", f"out/{slug}.mp4", "-i", out, "-map", "0:v", "-map", "1:a", "-c:v", "copy",
                "-af", "loudnorm=I=-14:TP=-1.5:LRA=11", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-shortest", "-movflags", "+faststart", f"out/{slug}_new.mp4"], check=True)
subprocess.run(["mv", f"out/{slug}_new.mp4", f"out/{slug}.mp4"], check=True)
subprocess.run(["rm", out])
print("remixed", slug)
