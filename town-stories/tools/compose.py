"""Frames + voice + subtitles -> final 1080x1920 MP4.
Usage: compose.py folgeNN "SERIES TITLE · PART N" "opt1|opt2|opt3" """
import sys, os, json, re, glob, subprocess, math

d = sys.argv[1]
badge = sys.argv[2]
opts = sys.argv[3].split('|')
FPS = 24
tm = json.load(open(f'{d}/timings.json'))
L, total = tm['lines'], tm['total']


def ts(t):
    t = max(0, t)
    h = int(t // 3600); m = int(t % 3600 // 60); s = t % 60
    return f'{h}:{m:02d}:{s:05.2f}'


# ---------- word timings (proportional to syllable-ish length, pauses at punctuation)
def word_times(line):
    words = line['text'].replace('3 A M', '3AM').split()
    w = [max(1.0, len(re.sub(r'[^A-Za-z0-9]', '', x)) ** 0.8) + (1.6 if re.search(r'[.,:!?]$', x) else 0) for x in words]
    tot = sum(w); t = line['start']; out = []
    for x, wi in zip(words, w):
        dur = line['dur'] * wi / tot
        out.append((x, t, t + dur)); t += dur
    return out


head = """[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Sub,Inter ExtraBold,92,&H00FFFFFF,&H00FFFFFF,&H00000000,&H99000000,1,0,0,0,100,100,0,0,1,10,5,2,60,60,620,1
Style: Badge,Inter ExtraBold,44,&H00FFFFFF,&H00FFFFFF,&H00000000,&HB0000000,1,0,0,0,100,100,1,0,3,14,0,8,40,40,110,1
Style: Opt,Inter ExtraBold,54,&H00FFFFFF,&H00FFFFFF,&H00141414,&H00000000,1,0,0,0,100,100,0,0,3,22,0,5,60,60,0,1
Style: Big,Inter ExtraBold,110,&H0028C9FF,&H00FFFFFF,&H00000000,&H90000000,1,0,0,0,100,100,0,0,1,10,5,8,40,40,240,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
ev = []
YEL = '&H0028E1FF&'
WJ = json.load(open(f'{d}/words.json')) if os.path.exists(f'{d}/words.json') else None
allw = []
for li, line in enumerate(L):
    wt = [tuple(x) for x in WJ[li]] if WJ else word_times(line)
    allw.append(wt)
groups = []
for wt in allw:
    cur = []
    for w in wt:  # max 2 words per screen, break after punctuation
        cur.append(list(w))
        if len(cur) == 2 or re.search(r'[.,:!?]$', w[0]):
            groups.append(cur); cur = []
    if cur: groups.append(cur)
# strictly sequential, no overlaps, no gaps < 0.5 s
flat = [w for g in groups for w in g]
for i, w in enumerate(flat):
    if i and w[1] < flat[i - 1][1] + 0.06: w[1] = flat[i - 1][1] + 0.06
for i, w in enumerate(flat):
    nxt = flat[i + 1][1] if i + 1 < len(flat) else w[2] + 0.5
    w[2] = nxt if nxt - w[2] < 0.5 else w[2] + 0.25
for g in groups:
    for wi, (w, a, b) in enumerate(g):
        parts = []
        for wj, x in enumerate(g):
            u = x[0].upper()
            parts.append((r'{\c' + YEL + r'}' + u + r'{\c&H00FFFFFF&}') if wj == wi else u)
        pop = r'{\fscx112\fscy112\t(0,70,\fscx100\fscy100)}' if wi == 0 else ''
        ev.append(f'Dialogue: 1,{ts(a)},{ts(b)},Sub,,0,0,0,,' + pop + ' '.join(parts))
if badge:
    ev.append(f'Dialogue: 0,{ts(0)},{ts(total)},Badge,,0,0,0,,{badge}')
# option badges during option lines (16,17,18) and final list
colors = ['&H0042B53F&', '&H00C94F8C&', '&H00D98A2F&']  # BGR: green, purple, blue
for k in range(3):
    li = 16 + k
    ev.append(f'Dialogue: 2,{ts(L[li]["start"])},{ts(L[li]["start"] + L[li]["dur"] + 0.3)},Big,,0,0,0,,'
              + r'{\fad(80,80)\fscx130\fscy130\t(0,150,\fscx100\fscy100)}' + f'OPTION {k + 1}')
fs = L[19]['start']
for k, o in enumerate(opts):
    y = 330 + k * 140
    ev.append(f'Dialogue: 3,{ts(fs + 0.2 + k * 0.25)},{ts(total)},Opt,,0,0,0,,'
              + r'{\an5\pos(540,' + str(y) + r')\3c' + colors[k] + r'\fad(150,0)\fscx40\fscy40\t(0,180,\fscx100\fscy100)}'
              + f'{k + 1}   {o}')
ev.append(f'Dialogue: 3,{ts(fs + 1.2)},{ts(total)},Big,,0,0,0,,' + r'{\an5\pos(540,1560)\fscx60\fscy60\t(0,200,\fscx100\fscy100)}COMMENT 1, 2 OR 3!')
ass = f'{d}/subs.ass'
open(ass, 'w').write(head + '\n'.join(ev) + '\n')

# ---------- concat frames into one silent video
dirs = sorted(glob.glob(f'{d}/frames/*/'))
lst = f'{d}/frames.txt'
with open(lst, 'w') as f:
    for dd in dirs:
        for fr in sorted(glob.glob(dd + '*.jpg')):
            f.write(f"file '{os.path.abspath(fr)}'\nduration {1 / FPS:.6f}\n")

# ---------- music bed: soft mysterious pad (synth), very quiet
pad = f'{d}/pad.wav'
if os.path.exists(f'{d}/music.wav'):
    pad = f'{d}/music.wav'
freqs = [110.0, 130.81, 164.81, 196.0]
expr = '+'.join(f'0.18*sin(2*PI*{f}*t)*(0.6+0.4*sin(2*PI*0.{i + 2}*t))' for i, f in enumerate(freqs))
if not pad.endswith('music.wav'): subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'lavfi', '-i', f'aevalsrc={expr}:s=48000:d={total}',
                '-f', 'lavfi', '-i', f'aevalsrc=0.5*sin(2*PI*1200*t)*exp(-60*mod(t\\,1)):s=48000:d={total}',
                '-filter_complex', '[0]lowpass=f=900,volume=0.35[p];[1]volume=0.12[t];[p][t]amix=2:normalize=0,afade=t=out:st=' + str(total - 2) + ':d=2',
                pad], check=True)

out = f'{d}/{os.path.basename(d)}.mp4'
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', lst, '-i', f'{d}/voice.wav', '-i', pad,
                '-filter_complex',
                f'[0:v]scale=1080:1920:flags=lanczos,unsharp=5:5:0.6,fps={FPS},ass={ass}:fontsdir=/usr/share/fonts/opentype/inter[v];'
                f'[1:a]asplit[v1][v2];[2:a]volume=0.55[m0];[m0][v2]sidechaincompress=threshold=0.05:ratio=4:attack=20:release=350[m];[v1][m]amix=2:normalize=0:duration=first,alimiter=limit=0.95[a]',
                '-map', '[v]', '-map', '[a]', '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p',
                '-c:a', 'aac', '-b:a', '192k', '-t', str(total), '-movflags', '+faststart', out], check=True)
print('OK', out)
