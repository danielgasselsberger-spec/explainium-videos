"""Put a ~2 s hook in front of every video: a flash-forward to the most exciting moment, a punch-in zoom,
big hook text, a boom and one short line from Andrew. Then the full video starts.

Reads the plain renders from build/ and writes the final videos to ../stickman_videos/.
"""
import math
import os
import subprocess
import sys

import cairo
import numpy as np

import tts
from lib import FONT, SR, Audio, outlined, wrap

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "build")
DST = os.path.join(HERE, "..", "stickman_videos")

# file stem -> (source time of the flash-forward, on-screen hook text, spoken hook line)
HOOKS = {
    "SM01_overthinker_vs_doer": (47.0, "ONLY ONE OF THEM MAKES IT", "Only one of them makes it."),
    "SM02_one_percent": (46.0, "37x BETTER IN ONE YEAR?!", "Thirty seven times better?!"),
    "SM03_100_days_island": (22.8, "DAY 30: EVERYTHING IS GONE", "Everything is gone."),
    "SM04_through_the_earth": (24.0, "28,000 KM/H THROUGH THE EARTH", "What if you jumped through the Earth?"),
    "SM05_every_jump_doubles": (50.8, "HE JUMPED INTO SPACE?!", "His last jump reaches space."),
    "SM06_introvert_party": (23.0, "EVERY INTROVERT EVER", "Every introvert at every party."),
    "SM07_alarm_saturday": (45.6, "WORST MORNING EVER", "Worst morning ever."),
    "SM08_1_vs_100": (51.6, "1 vs 100... WAIT FOR IT", "Wait for the ending."),
    "SM09_obstacle_race_short": (48.4, "DECIDED BY 0.03 SECONDS", "Pick your color. Quick!"),
    "SM09_obstacle_race_16x9": (48.4, "DECIDED BY 0.03 SECONDS", "Pick your color. Quick!"),
    "SM10_parkour_10_levels_short": (51.4, "10 FAILS... THEN THIS", "Ten fails. Then this."),
    "SM10_parkour_10_levels_16x9": (51.4, "10 FAILS... THEN THIS", "Ten fails. Then this."),
}


def probe(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v", "-show_entries", "stream=width,height",
                          "-of", "csv=p=0", path], capture_output=True, text=True, check=True).stdout.strip()
    w, h = out.split(",")
    return int(w), int(h)


def overlay_png(path, W, H, label):
    s = cairo.ImageSurface(cairo.FORMAT_ARGB32, W, H)
    c = cairo.Context(s)
    g = cairo.RadialGradient(W / 2, H / 2, min(W, H) * 0.25, W / 2, H / 2, max(W, H) * 0.75)
    g.add_color_stop_rgba(0, 0, 0, 0, 0.15)
    g.add_color_stop_rgba(1, 0, 0, 0, 0.6)
    c.set_source(g)
    c.paint()
    portrait = H > W
    size = 104 if portrait else 96
    lines = wrap(c, label, size, W * (0.86 if portrait else 0.7))
    lh = size * 1.12
    y0 = H * (0.36 if portrait else 0.42) - (len(lines) - 1) * lh / 2
    # band behind the text
    c.set_source_rgba(0.9, 0.1, 0.15, 0.92)
    c.rectangle(0, y0 - size * 1.05, W, lh * len(lines) + size * 0.55)
    c.fill()
    for i, l in enumerate(lines):
        outlined(c, l, W / 2, y0 + i * lh, size, fill=(1, 1, 1), stroke=(0, 0, 0), sw=size * 0.12)
    s.write_to_png(path)


def hook_audio(path, line, hl):
    a = Audio(hl)
    a.add(0.0, "boom", 55, 0.9)
    a.add(0.0, "whoosh", 900, 0.6)
    a.add(hl - 0.35, "whoosh", 1500, 0.5)
    smp, _ = tts.synth(line)
    i = int(0.12 * SR)
    j = min(len(a.buf), i + len(smp))
    a.buf[i:j] += smp[: j - i] * 1.8
    a.write(path, hl)


def run(stem):
    src = os.path.join(SRC, stem + ".mp4")
    dst = os.path.join(DST, stem + ".mp4")
    t_src, label, line = HOOKS[stem]
    W, H = probe(src)
    smp, words = tts.synth(line)
    spoken = words[-1][1] if words else len(smp) / SR
    hl = round(min(2.2, max(1.6, 0.12 + spoken + 0.3)), 2)
    tmp = os.path.join(SRC, stem)
    overlay_png(tmp + "_hook.png", W, H, label)
    hook_audio(tmp + "_hook.wav", line, hl)
    # centered 1.1x punch-in, text fades in, white flash at the cut
    vf = (f"[0:v]trim=start={t_src}:duration={hl},setpts=PTS-STARTPTS,"
          f"crop=w=trunc(iw/1.1/2)*2:h=trunc(ih/1.1/2)*2:x=(iw-ow)/2:y=(ih-oh)/2,scale={W}:{H},"
          f"setsar=1[v0];"
          f"[1:v]format=rgba,fade=t=in:st=0.08:d=0.12:alpha=1[ov];"
          f"[v0][ov]overlay=0:0:format=auto,fade=t=out:st={hl - 0.1:.2f}:d=0.1:color=white,format=yuv420p[hv];"
          f"[2:a]aformat=sample_rates=44100:channel_layouts=stereo[ha];"
          f"[3:v]setpts=PTS-STARTPTS,format=yuv420p[mv];[3:a]aformat=sample_rates=44100:channel_layouts=stereo[ma];"
          f"[hv][ha][mv][ma]concat=n=2:v=1:a=1[v][a]")
    cmd = ["ffmpeg", "-v", "error", "-y", "-i", src, "-loop", "1", "-t", str(hl), "-i", tmp + "_hook.png",
           "-i", tmp + "_hook.wav", "-i", src, "-filter_complex", vf, "-map", "[v]", "-map", "[a]",
           "-c:v", "libx264", "-preset", "medium", "-crf", "19", "-r", "30", "-c:a", "aac", "-b:a", "192k",
           "-movflags", "+faststart", dst]
    subprocess.run(cmd, check=True)
    for ext in ("_hook.png", "_hook.wav"):
        os.remove(tmp + ext)
    print(stem, "hook", hl, "s", flush=True)


if __name__ == "__main__":
    stems = sys.argv[1:] or list(HOOKS)
    for st in stems:
        run(st)
