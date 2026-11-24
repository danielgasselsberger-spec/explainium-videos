// "How the Human Body Works" — made with the /video skill
import React from "react";
import { FPS, Shot, Sfx, Timeline, makeVideo } from "../../engine/VideoBase";
import timelineJson from "./timeline.json";
import { HookChar, CharShot, HeartShot, LungShot, NeuronShot, MuscleShot, GutShot, KidneyShot, mv, C } from "./Body";
import { pose, animPose, Pose, LOOK } from "../../engine/Character";
import { easeInOut, range, smooth } from "../../engine/lib";

const timeline = timelineJson as Timeline;
const END = timeline.frames / FPS;

const CHEST = pose({ rw: [-1.45, -2.52, 1.5], rp: [-2.2, -2.2, -1], lw: [0.45, -1.55, 1.25], lp: [1.9, -2.2, 0.6], eyeYaw: 0.25, eyePitch: -0.3, brow: 0.6, smile: 0.7, head: [0.12, 0.12, 0] });
const breathe = (t: number): Pose => pose({ ...CHEST, lw: [0.42, -1.95 + 0.05 * Math.sin(t * 2.6), 1.22], brow: 0.5, head: [0.1, 0.12 + 0.03 * Math.sin(t * 2.6), 0] });
const sig = (t: number): Pose => pose({ ...CHEST, lw: [0.8, -1.25, 1.45], lp: [2.1, -2.2, 0.4], eyePitch: -0.2, eyeYaw: 0.2, brow: 0.9, lid: 1.15, head: [0.05, 0.1, 0.15] });
const feet = (t: number): Pose => pose({ ...CHEST, lw: [0.42, -1.95, 1.22], eyePitch: -0.9, eyeYaw: 0, brow: 0.2, head: [0.55, 0.0, 0] });
const hand = (t: number): Pose => animPose(t, [[0, CHEST], [1.5, pose({ ...CHEST, lw: [1.2, -1.9, 1.8], lp: [2.3, -2.3, 0.2], eyePitch: -0.5, brow: 0.8, smile: 0.8 })]]);
const fuel = (t: number): Pose => pose({ ...CHEST, lw: [0.9, -2.2, 1.5], lp: [2.0, -2.4, 0.2], eyePitch: -0.2, brow: 0.7, mouth: 0.5, smile: 0.9, head: [0.2, 0.25, 0] });
const clean = (t: number): Pose => pose({ ...CHEST, lw: [0.7, -2.3, 1.4], eyePitch: -0.4, brow: 0.9, smile: 0.4, head: [0.1, -0.2, 0] });

export const SHOTS: Shot[] = [
  { a: 0, b: 1.87, kind: "char", el: () => <HookChar t={0} d={1} gt={0} /> },
  { a: 1.87, b: 4.42, kind: "macro", el: (t, d, gt) => <HeartShot t={t} d={d} gt={gt} cam={mv([2.5, 1.5, 9], [1.2, 0.8, 8], t, d, [0, 0.8, 0], 40)} /> },
  { a: 4.42, b: 8.97, kind: "macro", el: (t, d, gt) => <HeartShot t={t} d={d} gt={gt} flow cam={mv([-2, -3, 9], [-1, -2, 8], t, d, [0, 0, 0], 42)} /> },
  { a: 8.97, b: 10.73, kind: "char", el: (t, d, gt) => <CharShot t={t} d={d} gt={gt} p={breathe} cam={(k) => ({ pos: [lerp1(1.5, 0.9, k), lerp1(-0.2, -0.6, k), lerp1(6.4, 5.4, k)], target: [0.2, -1.5, 0.9], fov: 42 })} /> },
  { a: 10.73, b: 13.3, kind: "macro", el: (t, d, gt) => <LungShot t={t} d={d} gt={gt} cam={mv([-3, 1.5, 10], [-1, 1.2, 9], t, d, [0, 1.2, 0], 42)} /> },
  { a: 13.3, b: 15.93, kind: "macro", el: (t, d, gt) => <LungShot t={t} d={d} gt={gt} zoom cam={mv([1.5, 0.5, 8], [0.4, 1.0, 5], t, d, [0, 1.2, 0], 40)} /> },
  { a: 15.93, b: 21.02, kind: "macro", el: (t, d, gt) => <LungShot t={t} d={d} gt={gt} zoom cam={mv([3, 0.8, 4.2], [1.2, 0.8, 3.0], t, d, [0.4, 1.0, 0], 36)} /> },
  { a: 21.02, b: 22.83, kind: "char", el: (t, d, gt) => <CharShot t={t} d={d} gt={gt} p={sig} cam={(k) => ({ pos: [lerp1(1.4, 1.0, k), lerp1(0.3, 0.2, k), lerp1(5.6, 5.0, k)], target: [0.1, -1.0, 0.9], fov: 42 })} /> },
  { a: 22.83, b: 25.5, kind: "macro", el: (t, d, gt) => <NeuronShot t={t} d={d} gt={gt} cam={mv([-1, 1.4, 9], [0, 0.6, 8], t, d, [0, 0, 0], 42)} /> },
  { a: 25.5, b: 27.45, kind: "macro", el: (t, d, gt) => <NeuronShot t={t} d={d} gt={gt} speed={0.2} cam={mv([1.5, 0.8, 5], [2.2, 0.4, 4], t, d, [1.5, 0.2, 0], 38)} /> },
  { a: 27.45, b: 30.96, kind: "char", el: (t, d, gt) => <CharShot t={t} d={d} gt={gt} p={feet} cam={(k) => ({ pos: [lerp1(0.5, 0.2, k), lerp1(-2.6, -2.8, k), lerp1(5.0, 4.2, k)], target: [0, -2.4, 0.8], fov: 42 })} /> },
  { a: 30.96, b: 32.9, kind: "char", el: (t, d, gt) => <CharShot t={t} d={d} gt={gt} p={hand} cam={(k) => ({ pos: [lerp1(1.2, 2.0, k), lerp1(-0.4, -0.2, k), lerp1(5.4, 6.0, k)], target: [0.4, -1.8, 1.0], fov: 42 })} /> },
  { a: 32.9, b: 36.5, kind: "macro", el: (t, d, gt) => <MuscleShot t={t} d={d} gt={gt} cam={mv([3.5, 0.5, 10], [2.0, 0.4, 8], t, d, [0, 0, 0], 42)} /> },
  { a: 36.5, b: 41.71, kind: "macro", el: (t, d, gt) => <MuscleShot t={t} d={d} gt={gt} cam={mv([-1.5, 1.5, 6], [-0.6, 1.0, 4.5], t, d, [0, 0.4, 0], 40)} /> },
  { a: 41.71, b: 43.5, kind: "char", el: (t, d, gt) => <CharShot t={t} d={d} gt={gt} p={fuel} cam={(k) => ({ pos: [lerp1(2.5, 1.4, k), lerp1(-0.6, -1.0, k), lerp1(6.0, 5.2, k)], target: [0.4, -1.7, 1.0], fov: 42 })} /> },
  { a: 43.5, b: 47.73, kind: "macro", el: (t, d, gt) => <GutShot t={t} d={d} gt={gt} cam={mv([0, 0.5, 11], [0, 0.4, 9], t, d, [0, 0, 0], 42)} /> },
  { a: 47.73, b: 52.0, kind: "macro", el: (t, d, gt) => <GutShot t={t} d={d} gt={gt} cam={mv([3, 1.5, 6], [1.2, 0.8, 4.5], t, d, [0, 0, 0], 40)} /> },
  { a: 52.0, b: 53.56, kind: "char", el: (t, d, gt) => <CharShot t={t} d={d} gt={gt} p={clean} cam={(k) => ({ pos: [lerp1(-1.6, -0.8, k), lerp1(-0.4, -0.5, k), lerp1(5.6, 5.0, k)], target: [0.2, -1.6, 1.0], fov: 42 })} /> },
  { a: 53.56, b: 57.01, kind: "macro", el: (t, d, gt) => <KidneyShot t={t} d={d} gt={gt} cam={mv([0, 1.5, 10], [0, 0.6, 8], t, d, [0, 0, 0], 42)} /> },
  { a: 57.01, b: 60.49, kind: "macro", el: (t, d, gt) => <KidneyShot t={t} d={d} gt={gt} zoom cam={mv([-3, 0.5, 6], [-1.2, 0.2, 4.5], t, d, [0, 0, 0], 40)} /> },
  { a: 60.49, b: END, kind: "char", el: () => <HookChar t={0} d={1} gt={0} /> },
];

function lerp1(a: number, b: number, k: number) { return a + (b - a) * k; }

const SFX: Sfx[] = [
  [0.6, "thud", 0.6], [2.0, "pop", 0.35], [5.0, "plop", 0.35], [8.9, "shimmer", 0.35], [11.0, "shimmer", 0.3], [16.2, "pop", 0.35], [21.9, "shimmer", 0.4],
  [23.0, "clink", 0.4], [27.0, "plop", 0.35], [31.2, "thud", 0.4], [33.5, "pop", 0.35], [41.9, "drop", 0.35], [43.8, "plop", 0.35], [48.0, "shimmer", 0.35],
  [53.7, "drop", 0.35], [57.1, "shimmer", 0.35], [60.6, "pop", 0.45],
];

export const science06 = { id: "Science06", slug: "science06", frames: timeline.frames, component: makeVideo({ slug: "science06", timeline, shots: SHOTS, sfx: SFX }) };
