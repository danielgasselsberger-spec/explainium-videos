import asyncio, json, os, sys, edge_tts
PROXY = os.environ.get("HTTPS_PROXY") or os.environ.get("https_proxy")
lines = [l.strip() for l in open("voice-samples/script.txt") if l.strip()]
async def one(i, text):
    c = edge_tts.Communicate(text, "en-US-AndrewNeural", rate="+8%", boundary="WordBoundary", proxy=PROXY)
    words = []
    with open(f"public/voice/s{i:02d}.mp3", "wb") as f:
        async for ch in c.stream():
            if ch["type"] == "audio": f.write(ch["data"])
            elif ch["type"] == "WordBoundary":
                words.append({"w": ch["text"], "s": ch["offset"]/1e7, "e": (ch["offset"]+ch["duration"])/1e7})
    return {"text": text, "words": words}
async def main():
    out = []
    for i, t in enumerate(lines):
        out.append(await one(i, t))
    json.dump(out, open("tools/words_raw.json", "w"), indent=1)
asyncio.run(main())
