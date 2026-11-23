#!/bin/bash
# Restart-safe render: renders <slug> in chunks into out/parts/<slug>/, skips finished chunks,
# then concatenates, remixes the audio (tools/mixaudio.py) and writes out/<slug>.mp4.
# usage: tools/render_chunks.sh <slug> [chunkFrames=450]
set -e
cd "$(dirname "$0")/.."
slug=$1; n=${2:-450}
id="$(tr '[:lower:]' '[:upper:]' <<< ${slug:0:1})${slug:1}"
frames=$(python3 -c "import json;print(json.load(open('src/videos/$slug/timeline.json'))['frames'])")
mkdir -p out/parts/$slug
list=out/parts/$slug/list.txt; : > $list
for ((a=0; a<frames; a+=n)); do
  b=$((a+n-1)); [ $b -ge $frames ] && b=$((frames-1))
  f=out/parts/$slug/p$(printf %05d $a).mp4
  echo "file '$(basename $f)'" >> $list
  [ -s $f ] && { echo "skip $f"; continue; }
  npx remotion render $id $f --frames=$a-$b --concurrency=4 --timeout=180000 --muted > out/parts/$slug/log.txt 2>&1
  echo "done $f"
done
ffmpeg -loglevel error -y -f concat -safe 0 -i $list -c copy out/$slug.mp4
python3 tools/mixaudio.py $slug
echo RENDER_DONE $slug
