#!/bin/bash
# wait for a running render, then normalise it and render the next ids. usage: queue_render.sh <waitSlug> <slug>...
cd "$(dirname "$0")/.."
norm() { ffmpeg -loglevel error -y -i out/$1.mp4 -c:v copy -af loudnorm=I=-14:TP=-1.5:LRA=11 -c:a aac -b:a 192k -ar 48000 -movflags +faststart out/$1_n.mp4 && mv out/$1_n.mp4 out/$1.mp4 && echo "normalised $1"; }
w=$1; shift
while pgrep -f "remotion render .* out/$w.mp4" >/dev/null; do sleep 30; done
norm $w
for s in "$@"; do
  id="$(tr '[:lower:]' '[:upper:]' <<< ${s:0:1})${s:1}"
  npx remotion render $id out/$s.mp4 --concurrency=4 > out/render_$s.log 2>&1 && norm $s
done
echo QUEUE_DONE
