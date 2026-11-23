# Explainium videos

Video files for scheduled posts.

## 3D science shorts (Remotion + Three)

- `/video <topic>` (Claude Code skill in `.claude/skills/video/`) builds a new short in the style of `out/science01.mp4`.
- Engine: `src/engine/` · videos: `src/videos/<slug>/` · scripts/voice timing: `scripts/<slug>/` · audio: `public/`.
- Stills: `node tools/stills.mjs Science01 0.3 0 300 600` · Render: `npx remotion render Science01 out/science01.mp4`.
