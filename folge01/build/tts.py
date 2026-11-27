"""Erzeugt Sprachspur + Wort-Zeitstempel für Folge 1.
Piper (de_DE-thorsten-medium) pro Teilsatz, leicht hochgepitcht, Whisper für Wort-Zeiten.
Aufruf: python3 tts.py <voice.onnx> <out_dir>"""
import json, subprocess, sys, os, re
import numpy as np

VOICE, OUT = sys.argv[1], sys.argv[2]
os.makedirs(OUT, exist_ok=True)
SR = 22050
PITCH = 1.12   # etwas jünger klingen
GAP = 0.28     # Pause zwischen Teilsätzen
SCENE_GAP = 0.45

# (Szene, gesprochen, Untertitel)
SEGS = [
 (1, "In meiner Stadt kommen nachts die Schatten.", None),
 (1, "Und ich bin allein.", None),
 (2, "Alle anderen sind weg.", None),
 (2, "Nur ich und dieser alte Leuchtturm.", None),
 (3, "Licht ist das Einzige, wovor die Schatten Angst haben.", None),
 (4, "Mein Vorrat: eine Taschenlampe.", None),
 (4, "Und eine einzige Batterie.", None),
 (5, "Die hält genau eine Nacht.", None),
 (6, "Aber ich muss nicht allein bleiben.", None),
 (7, "Jeder Follo ist ein neuer Mitbewohner im Leuchtturm.", "Jeder Follow ist ein neuer Mitbewohner im Leuchtturm."),
 (8, "Die Sonne geht unter.", None),
 (8, "Und ich höre schon etwas.", None),
 (9, "Was soll ich tun?", None),
 (9, "Eins: Licht an und durchhalten.", "1: Licht an und durchhalten."),
 (9, "Zwei: Im Supermarkt Batterien suchen.", "2: Im Supermarkt Batterien suchen."),
 (9, "Drei: Den großen Scheinwerfer reparieren.", "3: Den großen Scheinwerfer reparieren."),
]
END_HOLD = 2.6

def synth(text, path):
    raw = path + ".raw.wav"
    subprocess.run([sys.executable, "-m", "piper", "-m", VOICE, "-f", raw, "--length-scale", "0.93"],
                   input=text.encode(), check=True, capture_output=True)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", raw, "-af",
                    f"asetrate={int(SR*PITCH)},aresample={SR},atempo={1/PITCH:.5f}",
                    "-ac", "1", "-ar", str(SR), "-f", "f32le", path], check=True)
    a = np.fromfile(path, dtype=np.float32)
    # Stille vorne/hinten abschneiden
    env = np.convolve(np.abs(a), np.ones(256) / 256, mode="same")
    idx = np.where(env > 0.01)[0]
    a = a[max(0, idx[0] - 400): idx[-1] + 1200]
    return a

from faster_whisper import WhisperModel
model = WhisperModel("small", device="cpu", compute_type="int8")

def norm(w):
    return re.sub(r"[^a-zäöüß0-9]", "", w.lower())

def syl(w):
    return max(1, len(re.findall(r"[aeiouäöüy]+", w.lower())))

def word_times(a, spoken, shown):
    a16 = np.interp(np.arange(0, len(a), SR / 16000), np.arange(len(a)), a).astype(np.float32)
    shown_words = shown.split()
    dur = len(a) / SR
    for prompt in (None, spoken):
        segs, _ = model.transcribe(a16, language="de", word_timestamps=True, initial_prompt=prompt)
        ww = [w for s in segs for w in s.words]
        if len(ww) == len(shown_words):
            return [(w.start, min(w.end, dur), sw) for w, sw in zip(ww, shown_words)], True
    # Fallback: nach Silben verteilen
    sy = [syl(w) for w in spoken.split()]
    tot, t, out = sum(sy), 0.05, []
    for s, sw in zip(sy, shown_words):
        d = (dur - 0.1) * s / tot
        out.append((t, t + d, sw)); t += d
    return out, False

audio, words, scenes, segments = [], [], {}, []
t = 0.0
prev_scene = None
for i, (sc, spoken, shown) in enumerate(SEGS):
    shown = shown or spoken
    if prev_scene is not None:
        gap = SCENE_GAP if sc != prev_scene else GAP
        audio.append(np.zeros(int(gap * SR), np.float32)); t += gap
    if sc != prev_scene:
        scenes.setdefault(sc, {})["start"] = t
    a = synth(spoken, f"{OUT}/seg{i:02d}.f32")
    wt, ok = word_times(a, spoken, shown)
    print(f"seg {i:2d} sc{sc} {len(a)/SR:5.2f}s whisper={'ok' if ok else 'FALLBACK'}  {shown}")
    for s, e, w in wt:
        words.append({"t0": round(t + s, 3), "t1": round(t + e, 3), "w": w, "seg": i, "scene": sc})
    segments.append({"t0": round(t, 3), "t1": round(t + len(a) / SR, 3), "scene": sc, "text": shown})
    audio.append(a); t += len(a) / SR
    prev_scene = sc
audio.append(np.zeros(int(END_HOLD * SR), np.float32)); t += END_HOLD
sc_ids = sorted(scenes)
for j, sc in enumerate(sc_ids):
    scenes[sc]["end"] = scenes[sc_ids[j + 1]]["start"] if j + 1 < len(sc_ids) else t
full = np.concatenate(audio)
full = full / max(1e-6, np.abs(full).max()) * 0.89
full.astype(np.float32).tofile(f"{OUT}/voice.f32")
subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ar", str(SR), "-ac", "1", "-i", f"{OUT}/voice.f32",
                "-af", "highpass=f=70,acompressor=threshold=-18dB:ratio=3:attack=5:release=80",
                f"{OUT}/voice.wav"], check=True)
json.dump({"duration": round(t, 3), "scenes": {str(k): v for k, v in scenes.items()},
           "segments": segments, "words": words}, open(f"{OUT}/timing.json", "w"), indent=1, ensure_ascii=False)
print("total", round(t, 2), "s")
