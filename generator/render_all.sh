#!/usr/bin/env bash
# Renders all 10 videos into ../neu/ with the parameters chosen by the seed searches.
set -e
cd "$(dirname "$0")"
OUT=../neu
mkdir -p "$OUT"
cat <<JOBS | xargs -P 3 -I{} sh -c '{}'
python3 v01_rings.py render $OUT/N01_rings.mp4 51 70
python3 v02_grow.py $OUT/N02_grow.mp4
python3 v03_split.py render $OUT/N03_split.mp4 11 70 1.3
python3 v04_territory.py render $OUT/N04_territory.mp4 24
python3 v05_survivor.py render $OUT/N05_survivor.mp4 7 8 1.2
python3 v06_galton.py $OUT/N06_galton.mp4
python3 v07_pendulum.py $OUT/N07_pendulum.mp4
python3 v08_bricks.py render $OUT/N08_bricks.mp4 18 1.012
python3 v09_chaos.py render $OUT/N09_chaos_16x9.mp4 1e-10
python3 v10_sorting.py $OUT/N10_sorting_16x9.mp4 0
JOBS
