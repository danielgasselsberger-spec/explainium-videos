import React from "react";
import { AbsoluteFill, Audio, Sequence, continueRender, delayRender, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import { PostFX } from "./scenes/common";
import * as THREE from "three";
import timeline from "./timeline.json";
import { clamp, easeInOut, lerp, lerpV, range, smooth } from "./lib";
import { ArmShot, HIT_END, HealedShot, HitShot, LOOK_POSE, PressShot, REST, RaiseLoop, TimeLapse, ZoomIntoArm, bruiseAt } from "./scenes/CharShots";
import { LOOK, animPose, pose } from "./scenes/Character";
import { Capillary, HairCompare, Macrophage, Network, NerveFire, OxygenCell, PoolTopView, SkinDive, Swelling, ThroughSkin, TrappedBetweenCells } from "./scenes/Macro";

export const FPS = 30;
export const DURATION_FRAMES = timeline.frames;
const TOTAL = timeline.frames / FPS;

// ---------- font ----------
const fontHandle = typeof document !== "undefined" ? delayRender("font") : 0;
if (typeof document !== "undefined") {
  const f = new FontFace("InterX", `url(${staticFile("fonts/Inter-ExtraBold.otf")})`, { weight: "800" });
  f.load().then((ff) => { (document as any).fonts.add(ff); continueRender(fontHandle); }).catch(() => continueRender(fontHandle));
}

type Shot = { a: number; b: number; kind: "char" | "macro"; el: (t: number, d: number, gt: number) => React.ReactNode };

const pain = pose({ eyeYaw: 0.1, eyePitch: -0.1, lid: 0.25, brow: -1, mouth: 0.75, smile: 0, head: [0.05, -0.15, 0.12], body: [0, -0.06, 0] });
const relief = (t: number) =>
  animPose(t, [
    [0, pose({ eyePitch: -0.35, eyeYaw: 0.3, brow: -0.4, lid: 0.6, mouth: 0.3, smile: 0, head: [0.2, 0.15, 0.05] })],
    [1.0, pose({ eyePitch: -0.35, eyeYaw: 0.3, brow: 0.6, lid: 0.35, mouth: 0, smile: 0.9, head: [0.2, 0.15, -0.05] })],
  ]);
const lookAnim = (t: number) =>
  animPose(t, [
    [0, pose({ eyePitch: -0.2, eyeYaw: 0.3, brow: -0.3, lid: 0.7, smile: 0, head: [0.1, 0.1, 0] })],
    [0.75, LOOK_POSE],
    [2, pose({ ...LOOK, lid: 1.2, brow: 1, mouth: 0.7 })],
  ]);
const sunsetLook = pose({ ...LOOK, lid: 1.05, brow: 0.8, mouth: 0.35, smile: 0.4 });

export const SHOTS: Shot[] = [
  { a: 0, b: 1.55, kind: "char", el: (t, d, gt) => <HitShot t={t} gt={gt} /> },
  { a: 1.55, b: 2.25, kind: "char", el: (t, d, gt) => <ZoomIntoArm t={t} d={d} gt={gt} p={pain} from={HIT_END} /> },
  { a: 2.25, b: 4.3, kind: "macro", el: (t, d, gt) => <SkinDive t={t} d={d} gt={gt} /> },
  { a: 4.3, b: 5.9, kind: "macro", el: (t, d, gt) => <Capillary t={t} d={d} gt={gt} tearAt={0.9} spill={0.6} cam={{ pos: lerpV([-5, 1.2, 5.5], [-1.2, 1.4, 3.6], easeInOut(t / d)), target: [0, 0.2, 0], fov: 36 }} shake={t > 0.9 ? 0.04 * Math.exp(-(t - 0.9) * 6) : 0} /> },
  { a: 5.9, b: 7.2, kind: "macro", el: (t, d, gt) => <HairCompare t={t} d={d} gt={gt} /> },
  { a: 7.2, b: 8.65, kind: "macro", el: (t, d, gt) => <Network t={t} d={d} gt={gt} /> },
  { a: 8.65, b: 10.2, kind: "macro", el: (t, d, gt) => <Capillary t={t + 1.5} d={d} gt={gt} tearAt={-2} gapMax={0.6} spill={1} cam={{ pos: lerpV([2.5, 0.5, 5], [0.8, 3.2, 4.2], easeInOut(t / d)), target: lerpV([0, 0.6, 0], [0, 2.2, 0.5], easeInOut(t / d)), fov: 38 }} /> },
  { a: 10.2, b: 12.2, kind: "macro", el: (t, d, gt) => <TrappedBetweenCells t={t} d={d} gt={gt} /> },
  { a: 12.2, b: 14.2, kind: "char", el: (t, d, gt) => <ArmShot t={t} d={d} gt={gt} p={lookAnim} cam={(k) => ({ pos: [lerp(1.8, 1.0, k), lerp(0.1, -0.4, k), lerp(8.0, 6.4, k)], target: [0.4, -1.05, 0.9], fov: 42 })} /> },
  { a: 14.2, b: 15.75, kind: "char", el: (t, d, gt) => <ZoomIntoArm t={t} d={d} gt={gt} p={pose({ ...LOOK, lid: 1.2, brow: 1, mouth: 0.7 })} from={{ pos: [1.0, -0.4, 6.2], target: [0.4, -1.1, 1.1], fov: 42 }} /> },
  { a: 15.75, b: 17.45, kind: "macro", el: (t, d, gt) => <OxygenCell t={t} d={d} gt={gt} /> },
  { a: 17.45, b: 19.7, kind: "macro", el: (t, d, gt) => <Capillary t={t + 3} d={d} gt={gt} tearAt={-2} spill={0.35} platelets={1} plug={range(t, 0.8, d) * 0.35} cam={{ pos: lerpV([-6, 0.8, 4.5], [-2.2, 1.0, 3.6], easeInOut(t / d)), target: [0, 0.3, 0], fov: 38 }} /> },
  { a: 19.7, b: 21.3, kind: "macro", el: (t, d, gt) => <Capillary t={t + 5} d={d} gt={gt} tearAt={-2} spill={0.3} platelets={1} plug={lerp(0.35, 0.75, t / d)} cam={{ pos: lerpV([1.8, 2.2, 3.2], [-0.6, 2.0, 3.0], easeInOut(t / d)), target: [0, 0.4, 0], fov: 36 }} /> },
  { a: 21.3, b: 22.7, kind: "macro", el: (t, d, gt) => <Capillary t={t + 7} d={d} gt={gt} tearAt={-2} gapMax={lerp(0.5, 0.3, t / d)} spill={0.25} platelets={1} plug={lerp(0.75, 1, t / d)} cam={{ pos: lerpV([0.3, 1.9, 2.3], [0.9, 1.4, 1.9], easeInOut(t / d)), target: [0, 0.45, 0], fov: 34 }} /> },
  { a: 22.7, b: 25.0, kind: "char", el: (t, d, gt) => <ArmShot t={t} d={d} gt={gt} p={relief} ice={(tt) => range(tt, 0.35, 0.95)} cam={(k, b) => ({ pos: lerpV([3.6, 0.8, 6.2], [b.point.x + 0.9, b.point.y + 1.0, b.point.z + 1.4], easeInOut(range(t, 0, d)) ** 1.5), target: lerpV([0.8, -1.7, 1.0], b.point.toArray(), k), fov: 40 })} /> },
  { a: 25.0, b: 26.8, kind: "macro", el: (t, d, gt) => <Capillary t={t} d={d} gt={gt} cold={smooth(range(t, 0, 0.6))} squeeze={easeInOut(range(t, 0.3, 1.5))} flow={1 - 0.5 * range(t, 0.3, 1.5)} cam={{ pos: lerpV([-3.5, 1.6, 6], [2.5, 0.6, 4.4], easeInOut(t / d)), target: [0, 0, 0], fov: 36 }} /> },
  { a: 26.8, b: 28.3, kind: "macro", el: (t, d, gt) => <Capillary t={t + 2} d={d} gt={gt} cold={1} squeeze={1} flow={0.5} tearAt={-2} gapMax={0.35} spill={0.12} cam={{ pos: lerpV([-2, 2.2, 4.4], [1.5, 2.6, 4], easeInOut(t / d)), target: [0, 0.8, 0], fov: 38 }} /> },
  { a: 28.3, b: 29.95, kind: "macro", el: (t, d, gt) => <PoolTopView t={t} d={d} gt={gt} /> },
  { a: 29.95, b: 32.15, kind: "char", el: (t, d, gt) => <TimeLapse t={t} d={d} gt={gt} cycles={2} /> },
  { a: 32.15, b: 34.35, kind: "macro", el: (t, d, gt) => <OxygenCell t={t} d={d} gt={gt} deoxy={smooth(range(t, 0.2, 1.9))} /> },
  { a: 34.35, b: 36.1, kind: "macro", el: (t, d, gt) => <ThroughSkin t={t} d={d} gt={gt} /> },
  { a: 36.1, b: 37.5, kind: "char", el: (t, d, gt) => <ArmShot t={t} d={d} gt={gt} p={pose({ ...LOOK, lid: 1.15, brow: 1, mouth: 0.6 })} cam={(k, b) => { const n = b.normal; const c = b.point; const a = lerp(-0.5, 0.5, k); return { pos: [c.x + n.x * 1.6 + Math.sin(a) * 1.2, c.y + n.y * 1.6 + 0.3, c.z + n.z * 1.6 + Math.cos(a) * 0.4], target: c.toArray(), fov: 30 }; }} /> },
  { a: 37.5, b: 38.95, kind: "char", el: (t, d, gt) => <ArmShot t={t} d={d} gt={gt} p={(tt) => pose({ ...LOOK, lid: 1.15, brow: 1, mouth: 0.6, eyePitch: lerp(-0.4, -0.1, range(tt, 0.4, 1.0)), eyeYaw: lerp(0.05, 0, range(tt, 0.4, 1)) })} cam={(k) => ({ pos: [lerp(-1.8, -0.8, k), lerp(0.0, 0.2, k), lerp(5.6, 6.2, k)], target: [0.1, -0.7, 0.8], fov: 42 })} /> },
  { a: 38.95, b: 40.65, kind: "char", el: (t, d, gt) => <PressShot t={t} d={d} gt={gt} /> },
  { a: 40.65, b: 42.3, kind: "macro", el: (t, d, gt) => <Swelling t={t} d={d} gt={gt} /> },
  { a: 42.3, b: 44.35, kind: "macro", el: (t, d, gt) => <NerveFire t={t} d={d} gt={gt} /> },
  { a: 44.35, b: 46.25, kind: "char", el: (t, d, gt) => <TimeLapse t={t} d={d} gt={gt} cycles={3} /> },
  { a: 46.25, b: 47.9, kind: "macro", el: (t, d, gt) => <Macrophage t={t} d={d} gt={gt} phase="approach" /> },
  { a: 47.9, b: 49.5, kind: "macro", el: (t, d, gt) => <Macrophage t={t} d={d} gt={gt} phase="engulf" /> },
  { a: 49.5, b: 51.2, kind: "macro", el: (t, d, gt) => <Macrophage t={t} d={d * 1.9} gt={gt} phase="green" /> },
  { a: 51.2, b: 52.7, kind: "macro", el: (t, d, gt) => <Macrophage t={t + 1.7} d={3.2} gt={gt} phase="green" camOverride={{ pos: lerpV([3, 1.5, 5], [1.2, -0.8, 4.2], easeInOut(t / d)), target: [0, 0, 0], fov: 40 }} /> },
  { a: 52.7, b: 54.95, kind: "macro", el: (t, d, gt) => <Macrophage t={t} d={d} gt={gt} phase="yellow" /> },
  { a: 54.95, b: 57.3, kind: "char", el: (t, d, gt) => <ArmShot t={t} d={d} gt={gt} p={sunsetLook} top="#ffd27a" bottom="#ff5fa8" cam={(k, b) => { const c = b.point; const a = lerp(0.6, -0.4, k); return { pos: [c.x + Math.sin(a) * 2.2, c.y + 0.6 + k * 0.3, c.z + Math.cos(a) * 2.2], target: [c.x - 0.2 * k, c.y + 0.3 * k, c.z], fov: 32 }; }} /> },
  { a: 57.3, b: 59.0, kind: "macro", el: (t, d, gt) => <Macrophage t={t} d={d} gt={gt} phase="digest" /> },
  { a: 59.0, b: 60.3, kind: "macro", el: (t, d, gt) => <SkinDive t={t} d={d} gt={gt} reverse /> },
  { a: 60.3, b: 62.0, kind: "char", el: (t, d, gt) => <HealedShot t={t} d={d} gt={gt} /> },
  { a: 62.0, b: TOTAL, kind: "char", el: (t, d, gt) => <RaiseLoop t={t} d={d} gt={gt} /> },
];

const SFX: [number, string, number][] = [
  [0.58, "thud", 0.75], [1.95, "whoosh", 0.45], [5.15, "pop", 0.6], [5.8, "whoosh", 0.25], [8.75, "drop", 0.5], [12.0, "whoosh", 0.35],
  [15.45, "whoosh", 0.45], [17.9, "plop", 0.45], [18.35, "plop", 0.4], [18.8, "plop", 0.4], [21.9, "shimmer", 0.4], [23.6, "clink", 0.5],
  [24.75, "whoosh", 0.4], [29.95, "timelapse", 0.45], [32.0, "whoosh", 0.35], [34.4, "drop", 0.45], [39.37, "pop", 0.55], [40.5, "whoosh", 0.4],
  [44.35, "timelapse", 0.45], [46.1, "whoosh", 0.35], [48.4, "plop", 0.5], [51.9, "shimmer", 0.45], [54.3, "drop", 0.5], [57.15, "whoosh", 0.35],
  [59.0, "whoosh", 0.4], [60.45, "shimmer", 0.4],
];

// music level: ~10 % under the voice, ~20 % in pauses, soft ramps, fade in/out
const speech = timeline.sentences.map((s) => [s.speechStart, s.speechEnd]);
function musicVolume(t: number) {
  let dmin = 1e9;
  for (const [a, b] of speech) {
    const d = t < a ? a - t : t > b ? t - b : 0;
    dmin = Math.min(dmin, d);
  }
  const v = 0.1 + 0.1 * smooth(range(dmin, 0.12, 0.55));
  return v * smooth(range(t, 0, 0.8)) * smooth(range(TOTAL - t, 0, 1.0));
}

const Subtitles: React.FC<{ t: number }> = ({ t }) => {
  const subs = timeline.subs;
  let cur = subs.find((s, i) => t >= (i === 0 ? 0 : s.s - 0.05) && t < s.e);
  if (!cur) return null;
  const age = cur === subs[0] ? Math.max(1, t) : t - cur.s + 0.05;
  const pop = 0.9 + 0.1 * smooth(age / 0.12);
  return (
    <div style={{ position: "absolute", top: 1920 * 0.72, left: 0, right: 0, transform: "translateY(-50%)", display: "flex", justifyContent: "center" }}>
      <div
        style={{
          fontFamily: "InterX, Inter, sans-serif", fontWeight: 800, fontSize: 82, lineHeight: 1.1, color: "white", textAlign: "center", maxWidth: 940,
          textShadow: "0 4px 18px rgba(0,0,0,0.5), 0 2px 5px rgba(0,0,0,0.55), 0 0 2px rgba(0,0,0,0.35)", transform: `scale(${pop})`, opacity: clamp(age / 0.06 + 0.4), letterSpacing: -0.5,
        }}
      >
        {cur.text}
      </div>
    </div>
  );
};

// re-render after all children (EffectComposer) registered their frame callbacks
const LateAdvance: React.FC<{ frame: number }> = ({ frame }) => {
  const advance = useThree((s) => s.advance);
  React.useEffect(() => { advance(performance.now()); }, [frame, advance]);
  return null;
};

export const Science01: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const gt = frame / FPS;
  const idx = Math.max(0, SHOTS.findIndex((s) => gt >= s.a && gt < s.b));
  const sh = SHOTS[idx];
  const t = gt - sh.a;
  const d = sh.b - sh.a;
  // zoom-blur transitions between outside (character) and inside (macro)
  const next = SHOTS[idx + 1];
  const prev = SHOTS[idx - 1];
  const TR = 0.22;
  let scale = 1, blur = 0, flash = 0;
  if (next && next.kind !== sh.kind && d - t < TR) {
    const k = 1 - (d - t) / TR;
    scale = 1 + 0.35 * k * k; blur = 10 * k; flash = 0.5 * k;
  }
  if (prev && prev.kind !== sh.kind && t < TR) {
    const k = 1 - t / TR;
    scale = 1 + 0.25 * k * k; blur = 8 * k; flash = Math.max(flash, 0.5 * k);
  }
  return (
    <AbsoluteFill style={{ backgroundColor: "#7cc8f2" }}>
      <AbsoluteFill style={{ transform: `scale(${scale})`, filter: blur > 0.1 ? `blur(${blur}px)` : undefined }}>
        <ThreeCanvas width={width} height={height} gl={{ antialias: true, preserveDrawingBuffer: true }} dpr={1}>
          <React.Fragment key={idx}>{sh.el(t, d, gt)}</React.Fragment>
          <PostFX />
          <LateAdvance frame={frame} />
        </ThreeCanvas>
      </AbsoluteFill>
      {flash > 0.01 && <AbsoluteFill style={{ background: "radial-gradient(circle, rgba(255,255,255,0.9) 0%, rgba(255,190,235,0.5) 45%, rgba(255,255,255,0) 75%)", opacity: flash }} />}
      <Subtitles t={gt} />
      {timeline.sentences.map((s) => (
        <Sequence key={s.i} from={Math.round(s.start * FPS)} durationInFrames={Math.ceil((s.speechEnd - s.start + 0.6) * FPS)}>
          <Audio src={staticFile(`voice/s${String(s.i).padStart(2, "0")}.mp3`)} volume={1} />
        </Sequence>
      ))}
      <Audio src={staticFile("musik.mp3")} volume={(f) => musicVolume(f / FPS)} />
      {SFX.map(([at, name, vol], i) => (
        <Sequence key={"sfx" + i} from={Math.round(at * FPS)} durationInFrames={45}>
          <Audio src={staticFile(`sfx/${name}.wav`)} volume={vol} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
