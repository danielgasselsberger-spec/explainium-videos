"""Narration with Microsoft's 'Andrew' neural voice (en-US-AndrewNeural) via edge-tts.

Each line is synthesized once and cached in voice_cache/ (mp3 + word timings), so re-renders
do not call the service again.
"""
import asyncio
import hashlib
import json
import os
import subprocess

import numpy as np

VOICE = "en-US-AndrewNeural"
RATE = "+6%"
SR = 44100
CACHE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "voice_cache")
if os.path.exists("/root/.ccr/ca-bundle.crt"):
    os.environ.setdefault("SSL_CERT_FILE", "/root/.ccr/ca-bundle.crt")


async def _fetch(text, mp3, meta):
    import edge_tts
    proxy = os.environ.get("HTTPS_PROXY") or os.environ.get("https_proxy")
    com = edge_tts.Communicate(text, VOICE, rate=RATE, boundary="WordBoundary", proxy=proxy)
    words = []
    with open(mp3, "wb") as fh:
        async for chunk in com.stream():
            if chunk["type"] == "audio":
                fh.write(chunk["data"])
            elif chunk["type"] == "WordBoundary":
                s = chunk["offset"] / 1e7
                words.append([s, s + chunk["duration"] / 1e7, chunk["text"]])
    with open(meta, "w") as fh:
        json.dump(words, fh)


def synth(text):
    """Returns (mono float samples at 44.1 kHz, [[start, end, word], ...])."""
    os.makedirs(CACHE, exist_ok=True)
    key = hashlib.sha1(f"{VOICE}|{RATE}|{text}".encode()).hexdigest()[:16]
    mp3 = os.path.join(CACHE, key + ".mp3")
    meta = os.path.join(CACHE, key + ".json")
    if not (os.path.exists(mp3) and os.path.exists(meta) and os.path.getsize(mp3) > 0):
        for attempt in range(4):
            try:
                asyncio.run(_fetch(text, mp3, meta))
                break
            except Exception:
                if attempt == 3:
                    raise
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", mp3, "-f", "f32le", "-ac", "1", "-ar", str(SR), "-"],
                         capture_output=True, check=True).stdout
    with open(meta) as fh:
        words = json.load(fh)
    return np.frombuffer(raw, dtype=np.float32).astype(np.float64), words


class Narration:
    """lines: [(planned_start, text)]. Lines never overlap: a line starts at max(planned, previous end + gap)."""

    def __init__(self, lines, gap=0.15):
        self.items = []
        prev_end = -1.0
        for t0, text in lines:
            smp, words = synth(text)
            dur = len(smp) / SR
            start = max(t0, prev_end + gap)
            self.items.append((start, text, smp, words, dur))
            prev_end = start + dur

    def mix(self, audio, vol=1.0):
        for start, text, smp, words, dur in self.items:
            i = int(start * SR)
            j = min(len(audio.buf), i + len(smp))
            audio.buf[i:j] += smp[: j - i] * vol * 1.6

    def end(self):
        s, _, _, _, d = self.items[-1]
        return s + d

    def chunks(self, max_words=4, max_chars=24):
        """Caption chunks: (t_start, t_end, [(word, t0, t1), ...])."""
        out = []
        for start, text, smp, words, dur in self.items:
            cur = []
            for w0, w1, w in words:
                item = (w, start + w0, start + w1)
                pause = cur and (start + w0 - cur[-1][2]) > 0.22
                if cur and (len(cur) >= max_words or sum(len(x[0]) + 1 for x in cur) + len(w) > max_chars
                            or pause):
                    out.append(cur)
                    cur = []
                cur.append(item)
            if cur:
                out.append(cur)
        res = []
        for k, ch in enumerate(out):
            t0 = ch[0][1]
            t1 = ch[-1][2] + 0.25
            if k + 1 < len(out):
                t1 = min(max(t1, ch[-1][2]), out[k + 1][0][1])
            res.append((t0, t1, ch))
        return res
