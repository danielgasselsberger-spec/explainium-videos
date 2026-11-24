import re, json, wave, numpy as np
from piper import PiperVoice
from piper.config import SynthesisConfig
v = PiperVoice.load("voices/thorsten.onnx")
cfg = SynthesisConfig(length_scale=0.92)
text = open("script.txt").read().strip()
sents = re.findall(r'[^.?!:]+[.?!:]', text)
sr = v.config.sample_rate
out=[]; words=[]; t=0.35
out.append(np.zeros(int(sr*0.35),np.int16))
for s in sents:
    s=s.strip()
    a=np.concatenate([c.audio_int16_array for c in v.synthesize(s, cfg)])
    # trim silence
    thr=400; idx=np.where(np.abs(a)>thr)[0]
    a=a[max(0,idx[0]-200):idx[-1]+400]
    dur=len(a)/sr
    ws=s.split()
    wts=[len(re.sub(r'[^\wäöüÄÖÜß]','',w))+1.5 for w in ws]
    tot=sum(wts); c=t
    for w,wt in zip(ws,wts):
        d=dur*wt/tot; words.append({"w":w,"s":round(c,3),"e":round(c+d,3)}); c+=d
    out.append(a); t+=dur
    gap=0.32 if s[-1] in '.!' else 0.4
    out.append(np.zeros(int(sr*gap),np.int16)); t+=gap
out.append(np.zeros(int(sr*0.8),np.int16))
aud=np.concatenate(out)
with wave.open("vo.wav","wb") as w:
    w.setnchannels(1);w.setsampwidth(2);w.setframerate(sr);w.writeframes(aud.tobytes())
json.dump({"words":words,"sents":[], "dur":len(aud)/sr},open("words.json","w"),ensure_ascii=False)
print(len(aud)/sr)
for x in words: print(f"{x['s']:.2f} {x['w']}")
