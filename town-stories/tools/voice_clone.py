"""Clone the reference voice (Chatterbox, MIT) for every script line.
Keeps the existing timings.json (so the rendered shots stay in sync) by gently time-fitting each line.
Usage: voice_clone.py folgeNN reference.wav [exaggeration]"""
import sys, os, json, subprocess, torch, torchaudio
from chatterbox.tts import ChatterboxTTS
d, ref = sys.argv[1], sys.argv[2]
exag = float(sys.argv[3]) if len(sys.argv) > 3 else 0.6
tm = json.load(open(f'{d}/timings.json'))
torch.set_num_threads(4)
model = ChatterboxTTS.from_pretrained(device='cpu')
os.makedirs(f'{d}/audio_clone', exist_ok=True)
def dur(p): return float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',p]))
for i, l in enumerate(tm['lines']):
    out = f'{d}/audio_clone/l{i:02d}.wav'
    if os.path.exists(out): continue
    txt = l['text'].replace('3 A M', '3 A.M.')
    wav = model.generate(txt, audio_prompt_path=ref, exaggeration=exag, cfg_weight=0.5)
    raw = out + '.raw.wav'; torchaudio.save(raw, wav, model.sr)
    trim = out + '.trim.wav'
    subprocess.run(['ffmpeg','-y','-loglevel','error','-i',raw,'-af',
      'silenceremove=start_periods=1:start_threshold=-42dB,areverse,silenceremove=start_periods=1:start_threshold=-42dB,areverse',
      '-ar','48000','-ac','1',trim], check=True)
    r = max(0.82, min(1.25, dur(trim) / l['dur']))
    subprocess.run(['ffmpeg','-y','-loglevel','error','-i',trim,'-af',f'atempo={r:.4f},highpass=f=80','-ar','48000',out], check=True)
    os.remove(raw); os.remove(trim)
    print(i, round(r, 2), txt, flush=True)
total = tm['total']
flt = ''.join(f'[{i}:a]adelay={int(l["start"]*1000)}|{int(l["start"]*1000)}[a{i}];' for i, l in enumerate(tm['lines']))
flt += ''.join(f'[a{i}]' for i in range(len(tm['lines']))) + f'amix=inputs={len(tm["lines"])}:normalize=0,loudnorm=I=-14:TP=-1.5,apad=whole_dur={total}[o]'
cmd = ['ffmpeg','-y','-loglevel','error'] + sum([['-i', f'{d}/audio_clone/l{i:02d}.wav'] for i in range(len(tm['lines']))], []) + ['-filter_complex', flt, '-map', '[o]', '-ar', '48000', f'{d}/voice.wav']
subprocess.run(cmd, check=True); print('DONE voice')
