#!/usr/bin/env bash
# Renders the two landscape videos again plus their Shorts versions (1080x1920) into ../stickman_videos/
set -e
cd "$(dirname "$0")"
OUT=../stickman_videos
cat <<JOBS | xargs -P 3 -I{} sh -c '{}'
python3 l09_race.py short render $OUT/SM09_obstacle_race_short.mp4 25
python3 l10_parkour.py short $OUT/SM10_parkour_10_levels_short.mp4
python3 l10_parkour.py $OUT/SM10_parkour_10_levels_16x9.mp4
JOBS
