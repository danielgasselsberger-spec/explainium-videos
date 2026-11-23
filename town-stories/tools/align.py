"""Exact word timings with Whisper for each spoken line -> words.json.  Usage: align.py folgeNN audio_dir"""
import sys, json, re
from faster_whisper import WhisperModel
d, ad = sys.argv[1], sys.argv[2]
tm = json.load(open(f'{d}/timings.json'))
m = WhisperModel('small', device='cpu', compute_type='int8')
out = []
for i, l in enumerate(tm['lines']):
    words = l['text'].replace('3 A M', '3AM').split()
    segs, _ = m.transcribe(f'{ad}/l{i:02d}.wav', word_timestamps=True, language='en')
    ww = [w for s in segs for w in s.words]
    if ww and len(ww) == len(words):
        times = [(w.start, w.end) for w in ww]
    else:  # different tokenisation: spread script words over whisper's speech span, by length
        a = ww[0].start if ww else 0; b = ww[-1].end if ww else l['dur']
        wt = [max(1, len(re.sub(r'\W', '', x))) for x in words]; tot = sum(wt); t = a; times = []
        for x in wt:
            dt = (b - a) * x / tot; times.append((t, t + dt)); t += dt
    out.append([[w, l['start'] + s, l['start'] + e] for w, (s, e) in zip(words, times)])
    print(i, len(words), len(ww), flush=True)
json.dump(out, open(f'{d}/words.json', 'w'), indent=0)
