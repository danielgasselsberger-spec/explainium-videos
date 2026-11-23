"""Kokoro TTS -> kindliche Stimme. Usage: tts.py voice speed semitones out.wav "text" """
import sys, subprocess, soundfile as sf, numpy as np
from kokoro_onnx import Kokoro
voice, speed, semi, out, text = sys.argv[1], float(sys.argv[2]), float(sys.argv[3]), sys.argv[4], sys.argv[5]
k = Kokoro('/home/user/models/kokoro-v1.0.onnx', '/home/user/models/voices-v1.0.bin')
samples, sr = k.create(text, voice=voice, speed=speed, lang='en-us')
tmp = out + '.raw.wav'; sf.write(tmp, samples, sr)
f = 2 ** (semi / 12)
# pitch up, keep tempo (kid timbre)
subprocess.run(['ffmpeg','-y','-loglevel','error','-i',tmp,'-af',
  f'asetrate={int(sr*f)},aresample=48000,atempo={1/f:.4f},highpass=f=90,acompressor=threshold=-18dB:ratio=3,loudnorm=I=-15',
  '-ar','48000',out], check=True)
import os; os.remove(tmp)
