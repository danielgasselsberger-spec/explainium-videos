"""Timeline + subtitle chunks.  usage: python3 tools/timeline.py <slug>
Reads scripts/<slug>/script.txt ("> " = command line), scripts/<slug>/chunks.txt
(same lines, subtitle chunks separated by "|"), scripts/<slug>/words_raw.json.
Writes src/videos/<slug>/timeline.json and prints sentence + word timings."""
import json, os, sys
slug = sys.argv[1]
FPS = 30
raw = [l.strip() for l in open(f"scripts/{slug}/script.txt") if l.strip()]
commands = {i for i, l in enumerate(raw) if l.startswith(">")}
d = json.load(open(f"scripts/{slug}/words_raw.json"))
# edge-tts sometimes merges words into one boundary ("Now drive") -> split evenly
for s_ in d:
    out = []
    for w in s_["words"]:
        parts = w["w"].split()
        n = len(parts)
        for j, p in enumerate(parts):
            out.append({"w": p, "s": w["s"] + (w["e"] - w["s"]) * j / n, "e": w["s"] + (w["e"] - w["s"]) * (j + 1) / n})
    s_["words"] = out
CH = [l.strip() for l in open(f"scripts/{slug}/chunks.txt") if l.strip()]
assert len(CH) == len(d), f"chunks.txt has {len(CH)} lines, script has {len(d)}"
gaps = []
for i in range(len(d)):
    if i == len(d) - 1: gaps.append(0.12)          # last line flows straight into the loop
    elif i in commands: gaps.append(1.05)          # time for the character's action
    elif i + 1 in commands: gaps.append(0.85)      # breath before the next instruction
    else: gaps.append(0.28 + 0.1)
t, sents = 0.0, []
for i, s in enumerate(d):
    lead = s["words"][0]["s"]
    start = 0.0 if i == 0 else t - lead
    words = [{"w": w["w"], "s": round(start + w["s"], 3), "e": round(start + w["e"], 3)} for w in s["words"]]
    sents.append({"i": i, "text": s["text"], "start": round(start, 3), "speechStart": round(start + lead, 3),
                  "speechEnd": round(start + s["words"][-1]["e"], 3), "words": words})
    t = start + s["words"][-1]["e"] + gaps[i]
total = t
subs = []
for s in sents:
    ws = s["words"]; parts = [p.split() for p in CH[s["i"]].split("|")]
    assert sum(map(len, parts)) == len(ws), (s["i"], [" ".join(p) for p in parts], [w["w"] for w in ws])
    k = 0
    for p in parts:
        seg = ws[k:k + len(p)]; k += len(p)
        subs.append({"text": " ".join(p), "s": seg[0]["s"], "e": seg[-1]["e"]})
for a, b in zip(subs, subs[1:]):
    a["e"] = round(min(b["s"], a["e"] + 0.6), 3)
subs[-1]["e"] = round(total, 3)
os.makedirs(f"src/videos/{slug}", exist_ok=True)
json.dump({"fps": FPS, "duration": round(total, 3), "frames": int(round(total * FPS)), "sentences": sents, "subs": subs},
          open(f"src/videos/{slug}/timeline.json", "w"), indent=1)
print(f"total {total:.2f}s  ({int(round(total * FPS))} frames)")
for s in sents:
    print(f'{s["i"]:2d} {s["start"]:6.2f}-{s["speechEnd"]:6.2f}', " ".join(f'{w["w"]}@{w["s"]:.2f}' for w in s["words"]))
