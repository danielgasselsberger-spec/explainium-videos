# Build Folge 1
1. `pip install piper-tts faster-whisper` und Stimme `de_DE-thorsten-medium` (rhasspy/piper-voices) laden
2. `python3 tts.py <de_DE-thorsten-medium.onnx> <out_dir>` → `voice.wav` + `timing.json` (Whisper-Wortzeiten)
3. `node render.js <out_dir>/timing.json <out_dir>/voice.wav ../folge01.mp4` (Playwright + ffmpeg, 1080×1920, 30 fps)
   Vorschau einzelner Zeitpunkte: `node render.js timing.json x prev/p --preview 2,5,8`
