#!/usr/bin/env bash
# Renders all stickman videos (10 Shorts + 2 landscape) with Andrew narration into ../stickman_videos/
set -e
cd "$(dirname "$0")"
OUT=../stickman_videos
mkdir -p "$OUT"
cat <<JOBS | xargs -P 3 -I{} sh -c '{}'
python3 s01_overthinker.py $OUT/SM01_overthinker_vs_doer.mp4
python3 s02_one_percent.py $OUT/SM02_one_percent.mp4
python3 s03_island.py $OUT/SM03_100_days_island.mp4
python3 s04_earth.py $OUT/SM04_through_the_earth.mp4
python3 s05_jump.py $OUT/SM05_every_jump_doubles.mp4
python3 s06_party.py $OUT/SM06_introvert_party.mp4
python3 s07_alarm.py $OUT/SM07_alarm_saturday.mp4
python3 s08_tug.py $OUT/SM08_1_vs_100.mp4
python3 l09_race.py short render $OUT/SM09_obstacle_race_short.mp4 25
python3 l10_parkour.py short $OUT/SM10_parkour_10_levels_short.mp4
python3 l09_race.py render $OUT/SM09_obstacle_race_16x9.mp4 25
python3 l10_parkour.py $OUT/SM10_parkour_10_levels_16x9.mp4
JOBS
