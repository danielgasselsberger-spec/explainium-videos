"""Voice for one video.  usage: python3 tools/tts.py <slug> [voice] [rate]
Reads scripts/<slug>/script.txt (one sentence per line, command lines start with "> ").
Writes public/<slug>/voice/sNN.mp3 and scripts/<slug>/words_raw.json (word timings)."""
import asyncio, json, os, sys, edge_tts
slug = sys.argv[1]
VOICE = sys.argv[2] if len(sys.argv) > 2 else "en-US-AndrewNeural"
RATE = sys.argv[3] if len(sys.argv) > 3 else "+8%"
PROXY = os.environ.get("HTTPS_PROXY") or os.environ.get("https_proxy")
lines = [l.strip().lstrip(">").strip() for l in open(f"scripts/{slug}/script.txt") if l.strip()]
os.makedirs(f"public/{slug}/voice", exist_ok=True)
async def one(i, text):
    c = edge_tts.Communicate(text, VOICE, rate=RATE, boundary="WordBoundary", proxy=PROXY)
    words = []
    with open(f"public/{slug}/voice/s{i:02d}.mp3", "wb") as f:
        async for ch in c.stream():
            if ch["type"] == "audio": f.write(ch["data"])
            elif ch["type"] == "WordBoundary":
                words.append({"w": ch["text"], "s": ch["offset"] / 1e7, "e": (ch["offset"] + ch["duration"]) / 1e7})
    return {"text": text, "words": words}
async def main():
    out = [await one(i, t) for i, t in enumerate(lines)]
    json.dump(out, open(f"scripts/{slug}/words_raw.json", "w"), indent=1)
    print(len(out), "sentences")
asyncio.run(main())
