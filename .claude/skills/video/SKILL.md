---
name: video
description: Makes a complete 3D science explainer short (1080x1920, 30 fps, over 60 s, seamless loop) about any topic in exactly the style of out/science01.mp4 ("How Your Body Makes a Bruise"): stylized character + macro fly-throughs in Remotion/Three, Andrew voice, word-synced subtitles, ducked music, SFX. Use when the user types /video <topic> or asks for "another video like the bruise one".
argument-hint: <topic, e.g. "how a car is built">
---

# /video <topic>

The user gives only a topic (often in German). You do everything else without asking:
script → voice → timeline → 3D scenes → stills check + fixes → render → loudness → commit/push → send file + caption.
Only ask if the topic is unclear, unsafe, or would require copying a real person, brand or existing video.
Talk to the user in German. The video itself is in English.

The reference implementation is `src/videos/science01/` (bruise video). Read it before building: `Video.tsx` (shot list, SFX),
`CharShots.tsx` (character shots), `Macro.tsx` (inside/macro scenes). Reuse the engine in `src/engine/` unchanged where possible.

## 0. Setup (once per session)
- `npm install` if `node_modules` is missing. `pip install edge-tts` if `python3 -c "import edge_tts"` fails.
- Next free slug: look at `src/videos/` → `science02`, `science03`, … Composition id = capitalised slug (`Science02`). Output `out/<slug>.mp4`.
- edge-tts needs host `speech.platform.bing.com` (already allowed in the "explainium-videos" environment). If it is blocked, ask for it with the environment tools.

## 1. Script (English) → `scripts/<slug>/script.txt`
One sentence per line. Lines that are instructions to the viewer start with `> `.
- **Hook = Desire Hook.** Line 1 is a direct instruction, max 6 words, no intro, that *leads with the desired outcome* (what the viewer gets/sees), e.g. "Hit your arm on a table." / "Build a car in one minute." The character does it at the same moment, camera very close.
- **Tie the outcome to a relatable character:** the stylised middle-aged man with grey moustache, sleeveless shirt, big eyes (engine `Character`). He performs every instruction.
- Every step is a short instruction ("> Now wait two days." / "> Press on it." / "> Add the engine.") followed by 1–3 lines explaining what happens inside. Instruction every 2–4 lines, 5–7 instructions total.
- Factual, surprising, concrete (numbers, real names of parts/cells/processes, one "wow" fact near the end). Double-check facts.
- **Length: the video must be over 60 s.** Aim for ~185–200 words, ~20 lines → timeline 62–66 s.
- **Loop:** the last line ends mid-sentence and leads straight back into line 1 ("…So go ahead and…" → "Hit your arm on a table."). Last shot = first shot.
- Also write `scripts/<slug>/chunks.txt`: same lines (without `> `), split into subtitle chunks of 2–4 words with `|`, breaking at commas/natural phrases. Word count per line must match the script exactly.
- Show the script to the user in the chat, then continue (no waiting).

## 2. Voice + timeline
```bash
python3 tools/tts.py <slug>            # en-US-AndrewNeural, +8 %  → public/<slug>/voice/sNN.mp3
python3 tools/timeline.py <slug>       # → src/videos/<slug>/timeline.json, prints word times
```
If total < 61 s: lengthen the script, rerun both. Use the printed word times to place actions and cuts (impact on the key word, colour change on "green", …).

## 3. Build the scenes → `src/videos/<slug>/`
Copy the structure of science01: `Video.tsx` exports `export const <slug> = { id, slug, frames, component: makeVideo({ slug, timeline, shots, sfx }) }`; register it in `src/videos/index.ts`.

**Shot list** (`Shot = { a, b, kind: "char" | "macro", el: (t, d, gt) => JSX }`, seconds, contiguous from 0 to `timeline.frames/30`):
- Alternate (1) character shots showing the instruction and (2) dramatic macro camera moves INTO the subject (cross-sections, inner parts, particles, cells/molecules/mechanisms).
- Cut every 1–2.5 s (≈ 30–37 shots). Camera always moving (lerp pos/target with `easeInOut(range(t,0,d))`).
- Character→macro and macro→character cuts automatically get the zoom-blur + flash transition. Before a char→macro cut, end the char shot with a push-in toward the detail (see `ZoomIntoArm`).
- First shot: the instruction action, camera close. Last shot must end in exactly the first frame's state (same pose, camera, props, focus) → see `HitShot`/`RaiseLoop`, `LOOP_CAM`. Check frame 0 vs last frame.

**Look:** strong glowing colours (magenta, purple, turquoise, + topic accents), soft studio light (`StudioLights`), light-blue gradient background in character shots (`Backdrop top="#cdeeff" bottom="#5fb8f0"`), dark magenta/purple backgrounds with fog/motes for macro shots (`World` pattern in science01/Macro.tsx), depth of field + bloom via `<Post focus bokeh bloom/>` (focus = distance camera→subject).

**Engine API** (`src/engine/`):
- `Character` props: `p` (Pose), `t` (=gt), `bruise` (0 = plain skin), `table` (default true), `ice`, `squash`, `children` (extra props in character space).
  Poses: `pose({...})`, presets `P.rest`, `RAISED`, `LOOK`; animate with `animPose(t, [[time, pose, ease?], …])`. Arms use IK: `lw`/`rw` = wrist targets, `lp`/`rp` = elbow poles, `lu` = forearm "up". `bruisePoint(p)` gives a world point/normal on the left forearm (use it to attach objects or aim cameras). Face: `eyeYaw, eyePitch, lid (0 closed…1.2 wide), brow (-1 pain … 1 surprised), mouth, smile, head`.
  For topic-specific props (car parts, tools, food…) build them from primitives in the video folder and pass them as `children` or render them next to the character.
- `prims.tsx`: `Backdrop`, `Instances` (instanced mesh with per-item transform/colour), `rbcGeometry`, `blobGeometry`/`LiveBlob` (organic shapes), `Motes` (bokeh particles), `Glow` (additive sprite), `tubeGeo` (tubes along curves), `quatFromY`.
- `common.tsx`: `Cam` (pos/target/fov/roll/shake), `StudioLights`, `MacroLights`, `Post`.
- `lib.ts`: `range, smooth, easeIn/Out/InOut, lerp, lerpV, mixColor, rng(seed), noise3`.

**SFX** (`public/sfx`: plop, whoosh, drop, thud, pop, clink, shimmer, timelapse): whoosh on zoom transitions, a hit sound on the hook action, plop/drop/pop on visual events, shimmer on reveals. Volume 0.25–0.75. Music `public/musik.mp3` is mixed automatically (≈10 % under voice, ≈20 % in pauses, fades). New sounds: extend `tools/audio_synth.py`.

**Pitfalls already solved — do not reintroduce:**
- Never use `@react-three/postprocessing`'s `EffectComposer` (blank frames in Remotion). Post FX run through engine `PostFX`; shots only set `<Post …/>`.
- Everything deterministic from `t`/`gt`: no `useFrame` animation, no `Math.random` (use `rng(seed)`), hooks never inside conditions.
- Portrait framing: fov 40–44 for character shots, camera 5–10 units away; the frame is narrow (width ≈ 0.56 × height).
- Organic shapes: use `blobGeometry`/`LiveBlob` (merged vertices → smooth). Glowing coloured particles: `MeshBasicMaterial({toneMapped:false})` + instance colours (an emissive white material turns them white).
- Don't put a child `<meshBasicMaterial>` inside a mesh that already has `material={…}` (it overrides it).
- Keep cameras outside geometry; check transparent big blobs don't fill the frame.
- Subtitles sit at 72 % height: keep important action above that.

## 4. Check and fix (mandatory)
```bash
npx tsc --noEmit -p .
node tools/stills.mjs <Id> 0.3 <24 frames spread over the video>   # → stills/sheet.jpg (look at it)
node tools/stills.mjs <Id> 1 <8 frames>                              # full-res check
node tools/stills.mjs <Id> 0.4 0 <lastFrame>                         # loop: must look the same
```
Look at every sheet with Read. Fix anything ugly (wrong framing, empty/blank shots, faces cut off, unreadable subtitles, wrong colours, objects in wrong place) and re-check those frames before rendering.

## 5. Render (≈ 1.5 h on CPU, run in background)
```bash
npx remotion render <Id> out/<slug>.mp4 --concurrency=4 > out/render.log 2>&1   # run_in_background
```
Progress estimate: bytes piped into ffmpeg (`grep rchar /proc/<ffmpeg pid>/io`, ≈150 KB per frame). Tell the user the ETA in German when asked.
Afterwards:
```bash
ffmpeg -y -i out/<slug>.mp4 -c:v copy -af loudnorm=I=-14:TP=-1.5:LRA=11 -c:a aac -b:a 192k -ar 48000 -movflags +faststart out/<slug>_n.mp4 && mv out/<slug>_n.mp4 out/<slug>.mp4
```
Verify duration > 60 s, voice clearly above music in pauses (`volumedetect` on a pause vs. speech window), first vs. last frame match.

## 6. Deliver
- Commit `scripts/<slug>/`, `src/videos/<slug>/`, `public/<slug>/`, `src/videos/index.ts`, `out/<slug>.mp4`; push to the session branch.
- Send `out/<slug>.mp4` with SendUserFile.
- Give 2–3 English captions with hashtags, Desire-Hook style: lead with the surprising outcome, tie it to the viewer ("your body…"), end with a curiosity gap; recommend one.
