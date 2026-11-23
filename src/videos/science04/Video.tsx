import React from "react";
import * as THREE from "three";
import { FPS, Shot, Sfx, Timeline, makeVideo } from "../../engine/VideoBase";
import timelineJson from "./timeline.json";
import { clamp, easeIn, easeInOut, easeOut, lerp, lerpV, range, smooth } from "../../engine/lib";
import { Character, Pose, animPose, handFrame, pose } from "../../engine/Character";
import { Cam, Post, StudioLights } from "../../engine/common";
import { Backdrop, Glow, Motes } from "../../engine/prims";
import { World, Floor } from "../science02/Shots";
import { CarGrid, Clouds, Flow, JetEngine, PM, Plane, PlaneState, Runway, Vortex, airfoilGeo, usePlaneMats } from "./Plane";

// "How a Plane Can Fly" — made with the /video skill
const timeline = timelineJson as Timeline;
const END = timeline.frames / FPS;
const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
type C = { pos: number[]; target: number[]; fov?: number; roll?: number };
const mv = (a: number[], b: number[], t: number, d: number, target: number[] | ((k: number) => number[]), fov = 40, roll = 0): C => {
  const k = easeInOut(clamp(t / d));
  return { pos: lerpV(a, b, k), target: typeof target === "function" ? target(k) : target, fov, roll };
};

// =====================================================================================
// character with a toy plane
// =====================================================================================
const TY = -2.8;
const RUN_Z = 1.45;
const TOY = 0.26;
const BASE = { rw: [-1.45, -2.52, 1.5], rp: [-2.2, -2.2, -1] };
const ON_TABLE = pose({ ...BASE, lw: [1.15, -2.42, RUN_Z], lp: [2.3, -2.2, -0.6], eyeYaw: 0.25, eyePitch: -0.35, brow: 0.6, smile: 0.8, head: [0.18, 0.15, 0] });
const LOOP_CAM: C = { pos: [2.2, -0.6, 7.0], target: [0.4, -1.6, 0.9], fov: 42 };

type Toy = { roll?: number; yaw?: number; pitch?: number; off?: number[]; st?: PlaneState };
const Bench: React.FC<{ t: number; gt: number; p: Pose; cam: C; toy?: Toy; top?: string; bottom?: string; extra?: (m: PM, toyPos: THREE.Vector3) => React.ReactNode; focusOnToy?: boolean }> = ({
  t, gt, p, cam, toy = {}, top = "#cdeeff", bottom = "#5fb8f0", extra,
}) => {
  const m = usePlaneMats();
  const h = handFrame(p, "l");
  const off = toy.off ?? [-0.05, -0.1, 0.32];
  const tp = h.hand.clone().add(v(off[0], off[1], off[2]));
  return (
    <>
      <Backdrop top={top} bottom={bottom} />
      <StudioLights />
      <Cam {...cam} t={t} />
      <Character p={p} t={gt}>
        <group position={[0.2, TY + 0.005, RUN_Z]}>
          <mesh material={m.runway} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[4.2, 0.42]} />
          </mesh>
          {Array.from({ length: 9 }, (_, i) => (
            <mesh key={i} material={m.white} position={[-1.9 + i * 0.48, 0.003, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[0.2, 0.025]} />
            </mesh>
          ))}
        </group>
        <Plane m={m} position={tp} rotation={new THREE.Euler(toy.roll ?? 0, toy.yaw ?? 0, toy.pitch ?? 0, "YXZ")} scale={TOY} fan={toy.st?.fan ?? 0} gear={toy.st?.gear ?? 1} ail={toy.st?.ail ?? 0} elev={toy.st?.elev ?? 0} exhaust={toy.st?.exhaust ?? 0} />
        {extra && extra(m, tp)}
      </Character>
      <Post focus={dist(cam.pos, tp.toArray())} bokeh={4} bloom={0.55} />
    </>
  );
};
const pushIn = (from: number[], to: number[], target: number[], t: number, d: number): C => {
  const k = easeIn(clamp(t / d));
  return { pos: lerpV(from, to, k), target, fov: lerp(42, 30, k) };
};
const toyPos = (p: Pose) => handFrame(p, "l").hand.clone().add(v(-0.05, -0.1, 0.32));

const HookShot = (t: number, d: number, gt: number) => {
  const up = pose({ ...BASE, lw: [1.65, -0.95, 1.35], lp: [2.6, -2.0, -0.2], eyeYaw: 0.35, eyePitch: 0.15, brow: 1, lid: 1.15, mouth: 0.6, smile: 0.7, head: [-0.1, 0.25, -0.1] });
  const p = animPose(t, [
    [0, ON_TABLE],
    [0.25, ON_TABLE],
    [1.3, up],
    [d, pose({ ...up, lw: [1.55, -0.85, 1.3], mouth: 0.3, smile: 1 })],
  ]);
  const k = smooth(range(t, 0.25, 1.3));
  const kc = easeInOut(range(t, 0, d));
  const cam = { pos: lerpV(LOOP_CAM.pos, [2.6, -0.5, 6.0], kc), target: lerpV(LOOP_CAM.target, [0.9, -1.3, 1.1], kc), fov: 42 };
  return <Bench t={t} gt={gt} p={p} cam={cam} toy={{ pitch: 0.45 * Math.sin(k * Math.PI) + 0.15 * k, roll: -0.3 * k, st: { gear: 1 - k, fan: t * 20 * k } }}
    extra={(m, tp) => (k > 0.05 ? [0, 1, 2, 3].map((i) => <Glow key={i} position={[tp.x - 0.3 - i * 0.25, tp.y - 0.1 - i * 0.12 * k, tp.z]} scale={0.3} color="#2ff0ff" opacity={0.6 * (1 - i / 4) * k} />) : null)} />;
};

const EngineShot = (t: number, d: number, gt: number) => {
  const flick = 0.45;
  const p0 = toyPos(ON_TABLE);
  const eng = p0.clone().add(v(0.06, -0.08, 0.25));
  const p = animPose(t, [
    [0, pose({ ...ON_TABLE, rw: [-1.45, -2.52, 1.5] })],
    [flick, pose({ ...ON_TABLE, rw: [eng.x - 0.55, eng.y + 0.12, eng.z + 0.25], rp: [-1.5, -2.6, 1.2], eyeYaw: 0.2, eyePitch: -0.5, brow: 0.8, lid: 1.1, smile: 0.6 }), easeIn],
    [d, pose({ ...ON_TABLE, rw: [eng.x - 0.75, eng.y + 0.25, eng.z + 0.2], rp: [-1.5, -2.6, 1.2], eyeYaw: 0.2, eyePitch: -0.5, brow: 1, lid: 1.15, mouth: 0.4, smile: 0.9 })],
  ]);
  const on = Math.max(0, t - flick);
  return <Bench t={t} gt={gt} p={p} cam={pushIn([1.0, -0.8, 6.8], [1.9, -1.8, 4.2], eng.toArray(), t, d)} toy={{ st: { fan: on * on * 30, exhaust: smooth(on * 2) } }} />;
};

const SpeedShot = (t: number, d: number, gt: number) => {
  const k = easeIn(range(t, 0.2, d));
  const p = pose({ ...BASE, lw: [lerp(1.65, 0.35, k), -2.42, RUN_Z], lp: [2.3, -2.2, -0.6], eyeYaw: lerp(0.4, 0, k), eyePitch: -0.4, brow: 0.6, lid: 0.8, mouth: 0.2, smile: 0.4, head: [0.2, lerp(0.25, 0, k), 0] });
  return <Bench t={t} gt={gt} p={p} cam={{ pos: [lerp(1.8, 0.6, k), -0.9, 6.4], target: [lerp(1.1, 0.2, k), -2.1, 1.2], fov: 42 }} toy={{ st: { fan: t * 40, exhaust: 1 } }}
    extra={(m, tp) => [0, 1, 2, 3, 4].map((i) => <mesh key={i} material={m.white} position={[tp.x + 0.5 + i * 0.18, tp.y + 0.02 + (i % 2) * 0.06, tp.z]}><boxGeometry args={[0.25 * k, 0.012, 0.012]} /></mesh>)} />;
};

const PullShot = (t: number, d: number, gt: number) => {
  const k = easeInOut(range(t, 0.3, d));
  const p = pose({ ...BASE, lw: [lerp(0.6, 0.2, k), lerp(-2.42, -2.1, k), RUN_Z], lp: [2.3, -2.2, -0.6], eyeYaw: 0.1, eyePitch: -0.35, brow: 0.9, lid: 1.1, mouth: 0.4, smile: 0.6, head: [0.15, 0.05, 0] });
  return <Bench t={t} gt={gt} p={p} cam={mv([1.6, -1.0, 6.6], [0.9, -1.5, 5.4], t, d, [0.3, -2.1, RUN_Z], 42)} toy={{ pitch: 0.4 * k, st: { fan: t * 40, exhaust: 1, elev: -k, gear: 1 - k * 0.5 } }} />;
};

const ClimbShot = (t: number, d: number, gt: number) => {
  const k = easeInOut(range(t, 0, d * 0.8));
  const p = pose({ ...BASE, lw: [lerp(0.6, 1.2, k), lerp(-2.0, 0.35, k), lerp(RUN_Z, 1.0, k)], lp: [2.4, -2.2, -0.6], eyeYaw: 0.25, eyePitch: lerp(-0.2, 0.5, k), brow: 1, lid: 1.15, mouth: 0.5, smile: 0.8, head: [lerp(0, -0.3, k), 0.15, 0] });
  const top = "#" + new THREE.Color("#cdeeff").lerp(new THREE.Color("#3a4ad0"), k * 0.8).getHexString();
  return <Bench t={t} gt={gt} p={p} top={top} cam={{ pos: [lerp(1.8, 2.4, k), lerp(-1.0, -0.6, k), lerp(6.4, 7.2, k)], target: [0.7, lerp(-1.6, -0.3, k), 0.9], fov: 44 }} toy={{ pitch: 0.3, st: { fan: t * 40, exhaust: 1, gear: 0 } }} />;
};

const TipShot = (t: number, d: number, gt: number) => {
  const k = easeInOut(range(t, 0, 0.9));
  const p = pose({ ...BASE, lw: [lerp(1.2, 0.75, k), lerp(-1.2, -0.7, k), lerp(1.0, 1.35, k)], lp: [2.4, -2.2, -0.2], eyeYaw: lerp(0.2, 0.35, k), eyePitch: -0.25, brow: 0.9, lid: 1.2, mouth: 0.5, smile: 0.2, head: [0.1, 0.25, 0.05] });
  const tp = toyPos(p);
  const tip = tp.clone().add(v(-0.33, -0.03, -0.6));
  return <Bench t={t} gt={gt} p={p} cam={pushIn([1.6, -0.2, 6.4], [0.9, -0.5, 3.6], tip.toArray(), t, d)} toy={{ yaw: 0.6, st: { fan: t * 40, gear: 0 } }}
    extra={() => <Glow position={tip} scale={0.4 + 0.2 * Math.sin(t * 8)} color="#bff8ff" opacity={0.8 * k} />} />;
};

const TurnShot = (t: number, d: number, gt: number) => {
  const k = easeInOut(range(t, 0, d));
  const a = lerp(-0.4, 0.6, k);
  const p = pose({ ...BASE, lw: [1.1 + Math.sin(a) * 0.5, -1.3, 1.2 + Math.cos(a) * 0.3], lp: [2.4, -2.2, -0.2], eyeYaw: 0.3, eyePitch: -0.1, brow: 0.8, lid: 1.1, mouth: 0.3, smile: 1, head: [0.05, 0.25, -0.2 * k] });
  return <Bench t={t} gt={gt} p={p} cam={{ pos: [lerp(2.0, 1.2, k), -0.4, 6.4], target: [0.9, -1.1, 1.1], fov: 42 }} toy={{ roll: -0.7 * smooth(range(t, 0.2, 0.8)), yaw: -0.4 * k, st: { fan: t * 40, ail: smooth(range(t, 0.1, 0.5)), gear: 0 } }} />;
};

const LoopShot = (t: number, d: number, gt: number) => {
  const k = easeInOut(range(t, 0, d));
  const p = animPose(t, [
    [0, pose({ ...BASE, lw: [1.4, -1.25, 1.25], lp: [2.4, -2.2, -0.2], eyeYaw: 0.3, eyePitch: -0.1, brow: 0.8, lid: 1.1, smile: 1 })],
    [d * 0.85, ON_TABLE],
    [d, ON_TABLE],
  ]);
  const land = smooth(range(t, 0, d * 0.85));
  return <Bench t={t} gt={gt} p={p} cam={{ pos: lerpV([1.8, -0.5, 6.6], LOOP_CAM.pos, k), target: lerpV([0.8, -1.4, 1.0], LOOP_CAM.target, k), fov: 42 }} toy={{ pitch: 0.15 * (1 - land), st: { gear: land, fan: 0 } }} />;
};

// =====================================================================================
// macro scenes
// =====================================================================================
const Ground: React.FC<{ cam: C; t: number; speed?: number; children: React.ReactNode; bloom?: number }> = ({ cam, t, speed = 0, children, bloom = 1.1 }) => {
  const m = usePlaneMats();
  return (
    <World cam={cam} t={t} top="#ff9ad8" bottom="#3a0a6a" bloom={bloom} fog="#a05ad0">
      <Floor y={-0.02} />
      <Runway m={m} t={t} speed={speed} />
      {children}
      <Motes t={t} count={40} spread={30} center={[0, 3, 0]} size={0.05} />
    </World>
  );
};
const Sky: React.FC<{ cam: C; t: number; children: React.ReactNode; high?: number; bloom?: number }> = ({ cam, t, children, high = 0, bloom = 1.1 }) => {
  const top = "#" + new THREE.Color("#7ad8ff").lerp(new THREE.Color("#1a1a6a"), high).getHexString();
  const bottom = "#" + new THREE.Color("#ff8ad8").lerp(new THREE.Color("#5a2aa0"), high).getHexString();
  return (
    <World cam={cam} t={t} top={top} bottom={bottom} bloom={bloom} rim="#bff8ff">
      {children}
    </World>
  );
};

const PlaneOnRunway: React.FC<{ t: number; cam: C; x?: number; pitch?: number; lift?: number; st?: PlaneState; speed?: number; cars?: number }> = ({ t, cam, x = 0, pitch = 0, lift = 0, st = {}, speed = 0, cars = 0 }) => {
  const m = usePlaneMats();
  return (
    <Ground cam={cam} t={t} speed={speed}>
      <group position={[x, 0.95 + lift, 0]} rotation={[0, 0, pitch]}>
        <group position={[2.2, 0, 0]}>
          <group position={[-2.2, 0, 0]}>
            <Plane m={m} {...st} />
          </group>
        </group>
      </group>
      {cars > 0 && <CarGrid m={m} n={200} reveal={cars} origin={[-11, 0, 4.5]} />}
    </Ground>
  );
};

const EngineCut: React.FC<{ t: number; d: number; cam: C; stage: number }> = ({ t, d, cam, stage }) => {
  const m = usePlaneMats();
  return (
    <World cam={cam} t={t} top="#5a1aa0" bottom="#0e0426" bloom={1.5} tint="#ff7a2a">
      <JetEngine m={m} t={t} stage={stage} />
      <Motes t={t} count={40} spread={14} size={0.04} />
    </World>
  );
};

const Wing: React.FC<{ t: number; d: number; cam: C; aoa: number; lift?: number; pressure?: number; fastTop?: number; rise?: number }> = ({ t, d, cam, aoa, lift = 0, pressure = 0, fastTop = 1, rise = 0 }) => {
  const m = usePlaneMats();
  return (
    <World cam={cam} t={t} top="#3a2aa0" bottom="#0e0426" bloom={1.3}>
      <group position={[0, rise, 0]}>
        <mesh geometry={airfoilGeo()} material={m.body} rotation={[0, 0, -aoa]} />
        {lift > 0 && (
          <group position={[0.1, 0.9, 0]}>
            <mesh material={m.accent} position={[0, 0.7 * lift, 0]}>
              <cylinderGeometry args={[0.07, 0.07, 1.4 * lift, 16]} />
            </mesh>
            <mesh material={m.accent} position={[0, 1.4 * lift + 0.2, 0]}>
              <coneGeometry args={[0.2, 0.4, 20]} />
            </mesh>
            <Glow position={[0, 1.2 * lift, 0.3]} scale={1.8 * lift} color="#2ff0ff" opacity={0.6} />
          </group>
        )}
        {pressure > 0 && (
          <>
            <Glow position={[0.2, 0.75, 1.6]} scale={3.2} color="#2f8aff" opacity={0.7 * pressure} />
            <Glow position={[0.2, -0.65, 1.6]} scale={3.2} color="#ff3fb0" opacity={0.7 * pressure} />
          </>
        )}
      </group>
      <Flow t={t} aoa={aoa} fastTop={fastTop} />
    </World>
  );
};

const Cruise: React.FC<{ t: number; d: number; cam: C; high?: number; clouds?: boolean; frost?: number; vortex?: boolean; small?: number; roll?: number; ail?: number; drag?: number; air?: boolean }> = ({
  t, d, cam, high = 0, clouds = true, frost = 0, vortex = false, small = -1, roll = 0, ail = 0, drag = -1, air = false,
}) => {
  const m = usePlaneMats();
  return (
    <Sky cam={cam} t={t} high={high}>
      <group rotation={[roll, 0, 0]}>
        <Plane m={m} fan={t * 30} gear={0} exhaust={0.6} ail={ail} />
        {vortex && (
          <>
            <group position={[-2.0, -0.15, 3.55]}><Vortex t={t} spinDir={1} /></group>
            <group position={[-2.0, -0.15, -3.55]}><Vortex t={t} spinDir={-1} /></group>
          </>
        )}
      </group>
      {clouds && <Clouds m={m} t={t} center={[0, -5 + high * 2, -8]} speed={8} />}
      {frost > 0 && <Motes t={t} count={120} spread={16} color="#e8fbff" size={0.04} opacity={frost} />}
      {drag >= 0 && <AirDots t={t} density={drag} />}
      {air && <Flow t={t} aoa={0.05} count={180} />}
      {small >= 0 && (
        <group position={[-9 + small * 1.5, 0.2, 3.55]} rotation={[small * 4, 0, 0]}>
          <Plane m={m} scale={0.3} gear={0} fan={t * 30} />
        </group>
      )}
    </Sky>
  );
};

const AirDots: React.FC<{ t: number; density: number }> = ({ t, density }) => {
  const items = Array.from({ length: Math.round(200 * density) }, (_, i) => {
    const x = (((i * 7.3) % 30) - 15 - t * 9 + 300) % 30 - 15;
    return <mesh key={i} position={[x, ((i * 3.1) % 8) - 4, ((i * 5.7) % 10) - 5]}><sphereGeometry args={[0.05, 6, 4]} /><meshBasicMaterial color="#bff8ff" toneMapped={false} /></mesh>;
  });
  return <>{items}</>;
};

// =====================================================================================
// shot list
// =====================================================================================
export const SHOTS: Shot[] = [
  { a: 0, b: 1.99, kind: "char", el: (t, d, gt) => HookShot(t, d, gt) },
  { a: 1.99, b: 3.3, kind: "macro", el: (t, d) => <PlaneOnRunway t={t} cam={mv([6, 0.4, 5], [2, 0.6, 7], t, d, [0, 1.2, 0], 42)} st={{ fan: t * 4 }} /> },
  { a: 3.3, b: 5.43, kind: "macro", el: (t, d) => <PlaneOnRunway t={t} cam={mv([4, 3, 12], [1, 6, 16], t, d, [-1, 0.5, 2.5], 46)} st={{ fan: t * 4 }} cars={smooth(range(t, 0.3, 1.2))} /> },
  { a: 5.43, b: 7.52, kind: "char", el: (t, d, gt) => EngineShot(t, d, gt) },
  { a: 7.52, b: 9.0, kind: "macro", el: (t, d) => <EngineCut t={t} d={d} stage={0} cam={mv([-6.5, 1.0, 4.0], [-4.2, 0.6, 4.2], t, d, [-2, 0, 0], 42)} /> },
  { a: 9.0, b: 10.0, kind: "macro", el: (t, d) => <EngineCut t={t + 1.5} d={d} stage={0} cam={mv([-2.2, 1.2, 3.4], [-0.8, 0.9, 3.2], t, d, [-0.8, 0, 0], 40)} /> },
  { a: 10.0, b: 11.2, kind: "macro", el: (t, d) => <EngineCut t={t + 2.5} d={d} stage={2} cam={mv([0.0, 1.0, 3.0], [0.8, 0.7, 2.8], t, d, [0.4, 0, 0], 40)} /> },
  { a: 11.2, b: 12.64, kind: "macro", el: (t, d) => <EngineCut t={t + 3.7} d={d} stage={3} cam={mv([2.5, 1.2, 4.5], [5.0, 0.8, 4.0], t, d, (k) => [lerp(2, 5, k), 0, 0], 42)} /> },
  { a: 12.64, b: 14.3, kind: "macro", el: (t, d) => <PlaneOnRunway t={t} cam={mv([-8, 1.0, 2.2], [-6, 0.9, 3.2], t, d, [0, 1, 0], 42)} st={{ fan: t * 30, exhaust: 1 }} speed={t * 4} /> },
  { a: 14.3, b: 16.58, kind: "macro", el: (t, d) => <PlaneOnRunway t={t} cam={mv([1, 0.6, 7], [3, 1.0, 6.5], t, d, [0.5, 1, 0], 44)} st={{ fan: t * 30, exhaust: 1 }} speed={8 + t * 6} /> },
  { a: 16.58, b: 18.37, kind: "char", el: (t, d, gt) => SpeedShot(t, d, gt) },
  { a: 18.37, b: 20.62, kind: "macro", el: (t, d) => <Wing t={t} d={d} aoa={0} cam={mv([-1, 1.5, 9], [1, 0.5, 8], t, d, [0, 0, 0], 44)} /> },
  { a: 20.62, b: 22.5, kind: "macro", el: (t, d) => <Wing t={t + 2} d={d} aoa={0.12 * smooth(range(t, 0.3, 1.4))} cam={mv([2, 0.2, 7.5], [0.5, 0.0, 7.0], t, d, [0, 0, 0], 44)} /> },
  { a: 22.5, b: 24.62, kind: "macro", el: (t, d) => <Wing t={t + 4} d={d} aoa={0.12} cam={mv([3.5, 0.0, 6.5], [4.5, -0.6, 6.0], t, d, [2.5, -0.6, 0], 44)} /> },
  { a: 24.62, b: 26.2, kind: "macro", el: (t, d) => <Wing t={t + 6} d={d} aoa={0.14} cam={mv([1.5, -2.2, 7], [0.5, -1.8, 6.5], t, d, [1.5, -1.2, 0], 44)} /> },
  { a: 26.2, b: 28.0, kind: "macro", el: (t, d) => <Wing t={t + 8} d={d} aoa={0.14} lift={easeOut(range(t, 0.6, 1.4))} rise={0.3 * smooth(range(t, 0.8, d))} cam={mv([-1, 0.8, 9], [0, 1.5, 9.5], t, d, [0, 0.8, 0], 46)} /> },
  { a: 28.0, b: 30.3, kind: "macro", el: (t, d) => <Wing t={t + 10} d={d} aoa={0.14} fastTop={1.8} cam={mv([-1.5, 1.8, 5.5], [1.5, 1.6, 5.0], t, d, [0, 0.6, 0], 42)} /> },
  { a: 30.3, b: 32.0, kind: "macro", el: (t, d) => <Wing t={t + 12} d={d} aoa={0.14} fastTop={1.8} pressure={smooth(range(t, 0.1, 0.8))} cam={mv([0.5, 0.3, 8], [0.2, 0.2, 7], t, d, [0, 0, 0], 44)} /> },
  { a: 32.0, b: 33.32, kind: "macro", el: (t, d) => <Wing t={t + 13.7} d={d} aoa={0.14} fastTop={1.8} pressure={1} lift={1} rise={0.6 * easeIn(range(t, 0, d))} cam={mv([2, -0.5, 8], [2, 0.5, 8], t, d, [0, 0.4, 0], 44)} /> },
  { a: 33.32, b: 35.37, kind: "char", el: (t, d, gt) => PullShot(t, d, gt) },
  { a: 35.37, b: 37.0, kind: "macro", el: (t, d) => <PlaneOnRunway t={t} cam={mv([-6.5, 1.6, 3.4], [-5.2, 1.4, 2.6], t, d, [-3, 1.2, 0], 40)} st={{ fan: t * 30, exhaust: 1, elev: -smooth(range(t, 0.6, 1.0)) }} speed={14} /> },
  { a: 37.0, b: 38.3, kind: "macro", el: (t, d) => <PlaneOnRunway t={t} cam={mv([1.5, 0.5, 8], [2.5, 0.8, 7.5], t, d, [0, 1.2, 0], 44)} pitch={0.18 * smooth(range(t, 0, 0.8))} st={{ fan: t * 30, exhaust: 1, elev: -1 }} speed={16} /> },
  { a: 38.3, b: 39.57, kind: "macro", el: (t, d) => <PlaneOnRunway t={t} cam={mv([-2, 3.5, 7], [-1, 2.8, 7.5], t, d, [0, 1.2, 0], 44)} pitch={0.18} st={{ fan: t * 30, exhaust: 1, elev: -1 }} speed={17} /> },
  { a: 39.57, b: 41.0, kind: "macro", el: (t, d) => <PlaneOnRunway t={t} cam={mv([3, 0.3, 4.5], [1, 0.25, 4.8], t, d, [0, 0.4, 0], 44)} pitch={0.18} st={{ fan: t * 30, exhaust: 1, elev: -1 }} speed={20} /> },
  { a: 41.0, b: 42.4, kind: "macro", el: (t, d) => <PlaneOnRunway t={t} cam={mv([0.5, 0.15, 2.5], [-0.5, 0.15, 2.8], t, d, [-0.5, 0.3, 0.5], 42)} pitch={0.18} st={{ fan: t * 30, exhaust: 1, elev: -1 }} speed={22} /> },
  { a: 42.4, b: 43.8, kind: "macro", el: (t, d) => <PlaneOnRunway t={t} cam={mv([4, 0.6, 9], [2, 1.0, 9], t, d, [0, 1.3, 0], 44)} pitch={0.18} lift={0.4 * easeIn(range(t, 0.5, d))} st={{ fan: t * 30, exhaust: 1, elev: -1 }} speed={22} /> },
  { a: 43.8, b: 45.32, kind: "macro", el: (t, d) => <PlaneOnRunway t={t} cam={mv([3, 0.4, 10], [-2, 0.8, 12], t, d, (k) => [0, 1.5 + k * 1.5, 0], 46)} pitch={0.22} lift={0.4 + 2.5 * easeIn(range(t, 0, d))} st={{ fan: t * 30, exhaust: 1, elev: -1, gear: 1 - range(t, 0.6, d) }} speed={22} /> },
  { a: 45.32, b: 47.21, kind: "char", el: (t, d, gt) => ClimbShot(t, d, gt) },
  { a: 47.21, b: 49.4, kind: "macro", el: (t, d) => <Cruise t={t} d={d} high={0.2 + 0.3 * t / d} cam={mv([5, -1.5, 9], [3, 1.5, 9], t, d, [0, 0, 0], 44)} /> },
  { a: 49.4, b: 50.7, kind: "macro", el: (t, d) => <Cruise t={t + 2} d={d} high={0.75} frost={1} clouds={false} cam={mv([3, 1.4, 4.5], [2, 1.0, 3.8], t, d, [1, 0.2, 0], 42)} /> },
  { a: 50.7, b: 51.96, kind: "macro", el: (t, d) => <Cruise t={t + 3.3} d={d} high={0.8} frost={1} cam={mv([-4, 2.5, 8], [-3, 3.5, 9], t, d, [0, 0, 0], 44)} /> },
  { a: 51.96, b: 53.9, kind: "macro", el: (t, d) => <Cruise t={t + 4.5} d={d} high={0.8} clouds={false} drag={lerp(1, 0.25, smooth(range(t, 0.3, 1.5)))} cam={mv([0, 1.5, 11], [1, 1.0, 10], t, d, [0, 0, 0], 46)} /> },
  { a: 53.9, b: 55.2, kind: "macro", el: (t, d) => <Cruise t={t * 1.6 + 6} d={d} high={0.8} cam={mv([-7, 0.6, 3.5], [-6, 0.4, 2.5], t, d, [0, 0, 0], 40)} /> },
  { a: 55.2, b: 56.36, kind: "macro", el: (t, d) => <Cruise t={t * 1.6 + 8} d={d} high={0.8} cam={mv([6, -1.0, 7], [8, -0.6, 5], t, d, [0, 0, 0], 42)} /> },
  { a: 56.36, b: 58.3, kind: "char", el: (t, d, gt) => TipShot(t, d, gt) },
  { a: 58.3, b: 60.0, kind: "macro", el: (t, d) => <Cruise t={t} d={d} high={0.7} vortex cam={mv([-3, 1.2, 9], [-6, 0.8, 8], t, d, [-4, 0, 2.5], 44)} /> },
  { a: 60.0, b: 61.6, kind: "macro", el: (t, d) => <Cruise t={t + 1.7} d={d} high={0.7} vortex clouds={false} cam={mv([-9, 0.4, 3.6], [-6, 0.2, 3.6], t, d, [-12, -0.1, 3.55], 44)} /> },
  { a: 61.6, b: 63.65, kind: "macro", el: (t, d) => <Cruise t={t + 3.3} d={d} high={0.7} vortex clouds={false} small={smooth(range(t, 0.2, d))} cam={mv([-6, 1.5, 9], [-8, 1.0, 8.5], t, d, [-7, 0, 3.5], 44)} /> },
  { a: 63.65, b: 65.35, kind: "char", el: (t, d, gt) => TurnShot(t, d, gt) },
  { a: 65.35, b: 67.2, kind: "macro", el: (t, d) => <Cruise t={t} d={d} high={0.5} clouds={false} ail={smooth(range(t, 0.7, 1.2))} cam={mv([-5, 3.2, 8.5], [-3.5, 2.6, 8.0], t, d, [-1.8, 0, 2.5], 42)} /> },
  { a: 67.2, b: 68.4, kind: "macro", el: (t, d) => <Cruise t={t + 1.9} d={d} high={0.5} ail={1} roll={0.6 * smooth(range(t, 0, d))} cam={mv([-9, 1, 0], [-9, 1.2, 1.5], t, d, [0, 0, 0], 44)} /> },
  { a: 68.4, b: 69.75, kind: "macro", el: (t, d) => <Cruise t={t + 3.1} d={d} high={0.5} ail={0.6} roll={0.6} cam={mv([4, 4, 10], [-2, 3, 11], t, d, [0, 0, 0], 46)} /> },
  { a: 69.75, b: 71.9, kind: "macro", el: (t, d) => <Cruise t={t + 5} d={d} high={0.4} air cam={mv([1, 0.4, 13], [-1, 0.8, 11], t, d, [0, 0, 0], 46)} /> },
  { a: 71.9, b: END, kind: "char", el: (t, d, gt) => LoopShot(t, d, gt) },
];

const SFX: Sfx[] = [
  [0.4, "shimmer", 0.3], [4.0, "plop", 0.35], [4.2, "plop", 0.3], [5.95, "clink", 0.5], [8.1, "timelapse", 0.25], [10.05, "pop", 0.45], [11.3, "thud", 0.5],
  [13.6, "thud", 0.4], [27.38, "shimmer", 0.45], [32.0, "pop", 0.35], [36.28, "clink", 0.4], [43.95, "shimmer", 0.45], [49.5, "drop", 0.35],
  [59.98, "timelapse", 0.3], [61.46, "pop", 0.4], [66.34, "clink", 0.4], [72.17, "shimmer", 0.4],
];

export const science04 = { id: "Science04", slug: "science04", frames: timeline.frames, component: makeVideo({ slug: "science04", timeline, shots: SHOTS, sfx: SFX }) };
