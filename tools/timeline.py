import json, re
FPS = 30
d = json.load(open("tools/words_raw.json"))
# gap AFTER each sentence (seconds). commands get longer gaps for the action.
commands = {0, 4, 7, 9, 12, 14}
gaps = []
for i in range(len(d)):
    if i == len(d) - 1: gaps.append(0.12)
    elif i in commands: gaps.append(1.05)
    elif i + 1 in commands: gaps.append(0.85)
    else: gaps.append(0.38)
t = 0.0
sents = []
for i, s in enumerate(d):
    lead = s["words"][0]["s"]
    start = t - lead + (0.0 if i == 0 else 0.0)
    if i == 0: start = 0.0
    end_speech = start + s["words"][-1]["e"]
    words = [{"w": w["w"], "s": round(start + w["s"], 3), "e": round(start + w["e"], 3)} for w in s["words"]]
    sents.append({"i": i, "text": s["text"], "start": round(start, 3), "speechStart": round(start + lead, 3),
                  "speechEnd": round(end_speech, 3), "words": words})
    t = end_speech + gaps[i]
total = t
# subtitle chunks: 2-4 words, break at punctuation
CH = [l.strip() for l in open("tools/chunks.txt") if l.strip()]
def chunks(sent):
    ws = sent["words"]; parts = [p.split() for p in CH[sent["i"]].split("|")]
    assert sum(map(len, parts)) == len(ws), (parts, [w["w"] for w in ws])
    out, k = [], 0
    for p in parts:
        seg = ws[k:k+len(p)]; k += len(p)
        out.append({"text": " ".join(p), "s": seg[0]["s"], "e": seg[-1]["e"], "words": [{"w": t, "s": w["s"]} for t, w in zip(p, seg)]})
    return out
subs = []
for s in sents: subs += chunks(s)
# extend each chunk until next chunk start (max +0.6s)
for a, b in zip(subs, subs[1:]):
    a["e"] = round(min(b["s"], a["e"] + 0.6), 3)
subs[-1]["e"] = round(total, 3)
json.dump({"fps": FPS, "duration": round(total, 3), "frames": int(round(total * FPS)), "sentences": sents, "subs": subs},
          open("src/timeline.json", "w"), indent=1)
print("total", total)
for s in sents: print(s["i"], s["start"], s["speechEnd"], s["text"][:40])
for c in subs: print(f'{c["s"]:6.2f} {c["text"]}')
