"""Script -> per-line WAVs + timings.json. Usage: voice_lines.py folgeNN voice speed semitones"""
import sys, re, json, subprocess, soundfile as sf
from kokoro_onnx import Kokoro
d, voice, speed, semi = sys.argv[1], sys.argv[2], float(sys.argv[3]), float(sys.argv[4])
txt = open(f'{d}/skript.md').read().split('## Narration')[1].split('\n## ')[0]
lines = [re.sub(r'^\d+\.\s*', '', l).strip() for l in txt.splitlines() if re.match(r'^\d+\.', l.strip())]
k = Kokoro('/home/user/models/kokoro-v1.0.onnx', '/home/user/models/voices-v1.0.bin')
import os; os.makedirs(f'{d}/audio', exist_ok=True)
f = 2 ** (semi / 12); out = []
for i, l in enumerate(lines):
    spoken = l.replace('3 A M', 'three A.M.')
    s, sr = k.create(spoken, voice=voice, speed=speed, lang='en-us')
    raw = f'{d}/audio/raw{i:02d}.wav'; sf.write(raw, s, sr); p = f'{d}/audio/l{i:02d}.wav'
    subprocess.run(['ffmpeg','-y','-loglevel','error','-i',raw,'-af',
      f'silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse,'
      f'asetrate={int(sr*f)},aresample=48000,atempo={1/f:.4f},highpass=f=90',
      '-ar','48000','-ac','1',p], check=True); os.remove(raw)
    dur = float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',p]))
    out.append({'text': l, 'file': p, 'dur': dur})
gap = 0.38; t = 0.3
for o in out: o['start'] = t; t += o['dur'] + gap
json.dump({'lines': out, 'total': t + 3.0}, open(f'{d}/timings.json','w'), indent=1)
# concat
flt = ''.join(f'[{i}:a]adelay={int(o["start"]*1000)}|{int(o["start"]*1000)}[a{i}];' for i,o in enumerate(out))
flt += ''.join(f'[a{i}]' for i in range(len(out))) + f'amix=inputs={len(out)}:normalize=0,loudnorm=I=-14:TP=-1.5,apad=whole_dur={t+3.0}[o]'
cmd = ['ffmpeg','-y','-loglevel','error'] + sum([['-i',o['file']] for o in out], []) + ['-filter_complex',flt,'-map','[o]','-ar','48000',f'{d}/voice.wav']
subprocess.run(cmd, check=True); print('total', round(t+3.0,1), 's')
