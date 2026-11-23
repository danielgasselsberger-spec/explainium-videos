import React, { useMemo } from "react";
import * as THREE from "three";
import { FPS, Shot, Sfx, Timeline, makeVideo } from "../../engine/VideoBase";
import timelineJson from "./timeline.json";
import { clamp, easeIn, easeInOut, easeOut, lerp, lerpV, range, rng, smooth } from "../../engine/lib";
import { Character, Pose, animPose, handFrame, pose } from "../../engine/Character";
import { Cam, Post, StudioLights } from "../../engine/common";
import { Backdrop, Glow, Inst, Instances, Motes } from "../../engine/prims";
import { Car, Robot, useFactoryMats } from "../science02/Car";
import { World } from "../science02/Shots";
import { Building, Chips, Conveyor, Cutterhead, Diorama, Field, Fish, Ground, MiniDrill, MudBlobs, Ring, Segment, Ship, TBM, TM, drillTip, useTunnelMats } from "./Tunnel";

// "How a Tunnel Under the Sea Is Built" — made with the /video skill
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
// character + table diorama
// =====================================================================================
const TY = -2.8;
const DIO: [number, number, number] = [0.05, TY, 1.12];
const TUN_Y = TY + 0.3; // tunnel height in the diorama
const BASE = { lw: [1.55, -2.5, 1.55], lp: [2.2, -2.2, -1], rw: [-1.5, -2.5, 1.55], rp: [-2.2, -2.2, -1] };
const DRILL_UP = pose({ ...BASE, lw: [1.85, -1.75, 1.45], lp: [2.8, -2.4, 0.2], eyeYaw: 0.3, eyePitch: -0.3, brow: 0.5, smile: 0.8, head: [0.15, 0.2, -0.05] });
const DRILL_IN = pose({ ...BASE, lw: [1.78, -2.5, 1.35], lp: [3.0, -2.3, 0.4], eyeYaw: 0.35, eyePitch: -0.45, brow: -0.4, lid: 0.5, mouth: 0.5, smile: 0.2, head: [0.25, 0.25, 0.05] });
const LOOP_CAM: C = { pos: [2.7, -0.5, 6.9], target: [0.55, -1.55, 0.9], fov: 42 };

const Bench: React.FC<{ t: number; gt: number; p: Pose; cam: C; progress: number; from?: "right" | "both"; spin?: number; drill?: boolean; drillR?: boolean; extra?: (m: TM) => React.ReactNode; shake?: number; pop?: number }> = ({
  t, gt, p, cam, progress, from = "right", spin = 0, drill = true, drillR = false, extra, shake = 0, pop = 1,
}) => {
  const m = useTunnelMats();
  const hl = handFrame(p, "l");
  const hr = handFrame(p, "r");
  return (
    <>
      <Backdrop top="#cdeeff" bottom="#5fb8f0" />
      <StudioLights />
      <Cam {...cam} t={t} shake={shake} />
      <Character p={p} t={gt}>
        <Diorama m={m} t={gt} progress={progress} from={from} position={DIO} pop={pop} />
        {drill && <MiniDrill m={m} hand={hl.hand} dir={hl.dir} spin={spin} aim={AIM_R} />}
        {drillR && <MiniDrill m={m} hand={hr.hand} dir={hr.dir} spin={-spin} aim={AIM_L} />}
        {extra && extra(m)}
      </Character>
      <Post focus={dist(cam.pos, [DIO[0], TUN_Y + 0.3, DIO[2]])} bokeh={4} bloom={0.55} />
    </>
  );
};

const pushIn = (from: number[], to: number[], target: number[], t: number, d: number): C => {
  const k = easeIn(clamp(t / d));
  return { pos: lerpV(from, to, k), target, fov: lerp(42, 30, k) };
};
const AIM_R = v(DIO[0] + 1.0, TUN_Y, DIO[2] + 0.25);
const AIM_L = v(DIO[0] - 1.0, TUN_Y, DIO[2] + 0.25);
const tipOf = (p: Pose, side: "l" | "r" = "l") => { const h = handFrame(p, side); return drillTip(h.hand, (side === "l" ? AIM_R : AIM_L).clone().sub(h.hand)); };

const HookShot = (t: number, d: number, gt: number) => {
  const hit = 0.55;
  const p = animPose(t, [
    [0, DRILL_UP],
    [hit, DRILL_IN, easeIn],
    [d, pose({ ...DRILL_IN, lw: [1.72, -2.5, 1.35], lid: 0.8, brow: 0.6, smile: 0.7, mouth: 0.3 })],
  ]);
  const k = easeInOut(range(t, 0, d));
  const cam = { pos: lerpV(LOOP_CAM.pos, [2.0, -1.2, 5.0], k), target: lerpV(LOOP_CAM.target, [0.6, -2.2, 1.1], k), fov: lerp(42, 40, k) };
  const age = t - hit;
  return (
    <Bench t={t} gt={gt} p={p} cam={cam} progress={0.12 * smooth(range(t, hit, d))} spin={Math.max(0, age) * 14} shake={age > 0 ? 0.05 * Math.exp(-age * 4) : 0}
      extra={(m) => (age > 0 ? <><Chips m={m} age={age} seed={2} count={40} position={tipOf(p)} speed={1.2} size={0.5} /><Glow position={tipOf(p)} scale={0.7} color="#ffe2a0" opacity={0.9} /></> : null)} />
  );
};

const StartShot = (t: number, d: number, gt: number) => {
  const press = 0.42;
  const btn = v(-1.25, TY + 0.12, 1.85);
  const p = animPose(t, [
    [0, pose({ ...DRILL_IN, rw: [-1.5, -2.5, 1.55], eyeYaw: -0.3, eyePitch: -0.4, brow: 0.6, lid: 1, smile: 0.6, head: [0.2, -0.2, 0] })],
    [press, pose({ ...DRILL_IN, rw: [btn.x + 0.1, btn.y + 0.45, btn.z - 0.25], rp: [-2.4, -2.4, 0.2], eyeYaw: -0.3, eyePitch: -0.45, brow: 0.9, lid: 1.1, mouth: 0.4, smile: 0.5, head: [0.25, -0.2, 0] }), easeIn],
    [d, pose({ ...DRILL_IN, rw: [btn.x + 0.1, btn.y + 0.5, btn.z - 0.25], rp: [-2.4, -2.4, 0.2], eyeYaw: 0.35, eyePitch: -0.45, brow: 1, lid: 1.15, mouth: 0.5, smile: 0.9, head: [0.25, 0.2, 0] })],
  ]);
  const on = t > press;
  const tip = tipOf(p);
  return (
    <Bench t={t} gt={gt} p={p} cam={pushIn([1.2, -0.6, 6.8], [1.6, -2.1, 2.6], [tip.x - 0.2, tip.y, tip.z], t, d)} progress={0.15} spin={on ? (t - press) * 18 : 0}
      extra={(m) => (
        <>
          <mesh material={m.dark} position={[btn.x, TY + 0.06, btn.z]}>
            <boxGeometry args={[0.5, 0.12, 0.4]} />
          </mesh>
          <mesh material={m.red} position={[btn.x, TY + 0.14 - (on ? 0.03 : 0), btn.z]}>
            <cylinderGeometry args={[0.1, 0.1, 0.06, 20]} />
          </mesh>
          {on && <Glow position={[btn.x, TY + 0.2, btn.z]} scale={0.6} color="#ff3355" opacity={0.8} />}
          {on && <Glow position={tip} scale={0.8} color="#2ff0ff" opacity={0.8} />}
        </>
      )} />
  );
};

const PushShot = (t: number, d: number, gt: number) => {
  const p = animPose(t, [
    [0, pose({ ...DRILL_IN, lid: 0.7, brow: 0.2 })],
    [d, pose({ ...DRILL_IN, lw: [1.66, -2.5, 1.35], lid: 0.3, brow: -0.8, mouth: 0.8, smile: 0, head: [0.3, 0.25, 0.1], body: [0.05, -0.05, 0.1] })],
  ]);
  const tip = tipOf(p);
  return (
    <Bench t={t} gt={gt} p={p} cam={pushIn([3.4, -0.4, 6.2], [1.5, -2.2, 2.6], [tip.x, tip.y, tip.z], t, d)} progress={lerp(0.15, 0.3, t / d)} spin={t * 18} shake={0.01}
      extra={(m) => <Chips m={m} age={t} seed={4} count={40} position={tip} speed={1.1} size={0.5} />} />
  );
};

const HoldSeaShot = (t: number, d: number, gt: number) => {
  const top = TY + 1.15;
  const p = animPose(t, [
    [0, pose({ ...DRILL_IN, eyeYaw: -0.1, eyePitch: -0.3, brow: 0.6, lid: 1.1 })],
    [0.6, pose({ ...DRILL_IN, rw: [-0.25, top + 0.25, 1.15], rp: [-2.4, -2.0, 0.5], eyeYaw: -0.05, eyePitch: -0.5, brow: -0.5, lid: 0.6, mouth: 0.6, smile: 0, head: [0.3, -0.1, 0.05] }), easeOut],
    [d, pose({ ...DRILL_IN, rw: [-0.2, top + 0.2, 1.15], rp: [-2.4, -2.0, 0.5], eyeYaw: -0.05, eyePitch: -0.5, brow: -0.7, lid: 0.45, mouth: 0.7, smile: 0, head: [0.3, -0.1, 0.05] })],
  ]);
  return (
    <Bench t={t} gt={gt} p={p} cam={mv([1.4, -0.4, 6.8], [0.9, -0.8, 5.6], t, d, [DIO[0] - 0.1, TY + 0.85, DIO[2]], 42)} progress={0.3} spin={t * 18}
      extra={() => (t > 0.6 ? [0, 1, 2].map((i) => { const k = ((t - 0.6) * 0.9 + i * 0.33) % 1; return <Glow key={i} position={[-0.2, top + 0.02, 1.15]} scale={0.3 + k * 1.6} color="#2ff0ff" opacity={1 - k} />; }) : null)} />
  );
};

const WallsShot = (t: number, d: number, gt: number) => {
  const tgt = v(-0.35, TUN_Y + 0.05, DIO[2] + 0.42);
  const p = animPose(t, [
    [0, pose({ ...DRILL_IN, rw: [-0.6, -1.6, 1.8], rp: [-2.3, -2.4, 0.3], eyeYaw: -0.25, eyePitch: -0.2, brow: 0.7, lid: 1.1, smile: 0.6, head: [0.1, -0.15, 0] })],
    [d * 0.7, pose({ ...DRILL_IN, rw: [tgt.x - 0.15, tgt.y + 0.35, tgt.z + 0.1], rp: [-2.3, -2.4, 0.3], eyeYaw: -0.15, eyePitch: -0.5, brow: 0.6, lid: 1, smile: 0.8, head: [0.3, -0.1, 0] })],
    [d, pose({ ...DRILL_IN, rw: [tgt.x - 0.15, tgt.y + 0.35, tgt.z + 0.1], rp: [-2.3, -2.4, 0.3], eyeYaw: -0.15, eyePitch: -0.5, brow: 0.9, lid: 1.1, smile: 1, head: [0.3, -0.1, 0] })],
  ]);
  const hr = handFrame(p, "r");
  const seg = hr.hand.clone().add(v(0, -0.12, 0.05));
  return (
    <Bench t={t} gt={gt} p={p} cam={pushIn([-1.6, -0.4, 6.8], [-0.4, -1.9, 3.2], [tgt.x, tgt.y + 0.1, tgt.z], t, d)} progress={0.4}
      extra={(m) => (
        <>
          <Segment m={m} i={0} position={seg} rotation={[0, 0, 0.6]} scale={0.28} />
          {[0, 1, 2, 3].map((i) => <Ring key={i} m={m} z={0} />).slice(0, 0)}
          <group position={[tgt.x, tgt.y, tgt.z]} scale={0.12}>
            {[1, 2, 3, 4, 5].map((i) => <Segment key={i} m={m} i={i} />)}
          </group>
          <Glow position={tgt} scale={0.5} color="#2ff0ff" opacity={smooth(range(t, d * 0.6, d))} />
        </>
      )} />
  );
};

const BothShot = (t: number, d: number, gt: number) => {
  const p = animPose(t, [
    [0, pose({ ...DRILL_IN, rw: [-1.6, -1.8, 1.4], rp: [-2.8, -2.4, 0.2], eyeYaw: 0, eyePitch: -0.3, brow: 0.8, lid: 1.1, smile: 0.8 })],
    [0.6, pose({ ...DRILL_IN, rw: [-1.72, -2.5, 1.35], rp: [-3.0, -2.3, 0.4], eyeYaw: 0, eyePitch: -0.45, brow: -0.3, lid: 0.6, mouth: 0.5, smile: 0.3, head: [0.25, 0, 0] }), easeIn],
    [d, pose({ ...DRILL_IN, rw: [-1.66, -2.5, 1.35], rp: [-3.0, -2.3, 0.4], eyeYaw: 0, eyePitch: -0.45, brow: 0.6, lid: 0.9, mouth: 0.3, smile: 0.9, head: [0.25, 0, 0] })],
  ]);
  return (
    <Bench t={t} gt={gt} p={p} cam={{ pos: lerpV([0.2, -0.2, 7.8], [0.3, -0.8, 6.6], easeInOut(t / d)), target: [0.1, -1.9, 1.0], fov: 44 }} progress={lerp(0.4, 0.75, smooth(range(t, 0.6, d)))} from="both" spin={t * 18} drillR />
  );
};

const MiniCar: React.FC<{ x: number; t: number }> = ({ x, t }) => {
  const fm = useFactoryMats();
  return <Car m={fm} paint={1} glass={1} wheels={1} lights={1} position={[x, TUN_Y - 0.05, DIO[2] + 0.43]} scale={0.04} t={t} />;
};
const DriveShot = (t: number, d: number, gt: number) => {
  const p = pose({ ...BASE, rw: [-1.5, -2.5, 1.55], eyeYaw: lerp(0.4, -0.4, t / d), eyePitch: -0.45, brow: 0.9, lid: 1.1, smile: 1, mouth: 0.3, head: [0.25, lerp(0.2, -0.2, t / d), 0] });
  const cx = lerp(1.3, -1.3, easeInOut(range(t, 0.2, d)));
  return (
    <Bench t={t} gt={gt} p={p} drill={false} cam={pushIn([0.4, -0.6, 6.8], [0.2, -2.0, 3.0], [DIO[0], TUN_Y, DIO[2] + 0.4], t, d)} progress={1}
      extra={() => <MiniCar x={cx} t={t} />} />
  );
};

const LoopShot = (t: number, d: number, gt: number) => {
  const k = easeInOut(range(t, 0, d));
  const p = animPose(t, [
    [0, pose({ ...BASE, eyeYaw: -0.4, eyePitch: -0.45, brow: 0.9, lid: 1.1, smile: 1, head: [0.25, -0.2, 0] })],
    [d, DRILL_UP],
  ]);
  const fresh = t > 0.5;
  const pop = fresh ? easeOut(range(t, 0.5, 0.9)) : 1 - easeIn(range(t, 0.2, 0.5));
  return (
    <Bench t={t} gt={gt} p={p} cam={{ pos: lerpV([0.4, -0.4, 6.6], LOOP_CAM.pos, k), target: lerpV([0.3, -1.5, 1.0], LOOP_CAM.target, k), fov: 42 }} progress={fresh ? 0 : 1} pop={Math.max(0.02, pop)} drill={t > 0.7}
      extra={() => (t > 0.45 && t < 1.0 ? <Glow position={[DIO[0], TY + 0.5, DIO[2]]} scale={2} color="#2ff0ff" opacity={Math.sin(range(t, 0.45, 1.0) * Math.PI)} /> : null)} />
  );
};

// =====================================================================================
// macro scenes
// =====================================================================================
// side cut-away: tunnel axis along x, cutterhead of machine A at x=xa facing +x
const HalfRings: React.FC<{ m: TM; from: number; count: number; dir?: 1 | -1 }> = ({ m, from, count, dir = 1 }) => {
  const mm = useMemo(() => ({ ...m, concrete: new THREE.MeshStandardMaterial({ color: "#7d86b0", roughness: 0.6, emissive: new THREE.Color("#1a1a5a"), emissiveIntensity: 0.3 }) }), [m]);
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <group key={i} position={[from - dir * i * 0.32, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
          {/* keep only the segments at the back / top / bottom so the cut-away stays open */}
          {[0, 1, 4, 5].map((s) => <Segment key={s} m={mm} i={s} />)}
          {i % 3 === 0 && (
            <mesh material={m.light}>
              <torusGeometry args={[1.005, 0.012, 6, 64]} />
            </mesh>
          )}
        </group>
      ))}
    </>
  );
};

const Machine: React.FC<{ m: TM; x: number; t: number; spin: number; dir?: 1 | -1; rams?: number; trailers?: number }> = ({ m, x, t, spin, dir = 1, rams = 0, trailers = 5 }) => (
  <group position={[x, 0, 0]} rotation={[0, dir > 0 ? Math.PI / 2 : -Math.PI / 2, 0]}>
    <TBM m={m} spin={spin} t={t} rams={rams} trailers={trailers} />
  </group>
);

const SideWorld: React.FC<{ cam: C; t: number; children: React.ReactNode; seaTop?: number; bloom?: number }> = ({ cam, t, children, seaTop = 9, bloom = 1.1 }) => {
  const m = useTunnelMats();
  return (
    <World cam={cam} t={t} top="#3a7ad0" bottom="#1a0a3a" bloom={bloom} tint="#ff4fb0" rim="#2ff0ff">
      <Ground m={m} t={t} seaTop={seaTop} />
      {children}
      <Motes t={t} count={40} spread={20} center={[0, 0, 3]} color="#e8f8ff" size={0.04} />
    </World>
  );
};

const MachineSideC: React.FC<{ t: number; cam: C; extra?: (m: TM) => React.ReactNode; x: number; rams: number }> = ({ t, cam, extra, x, rams }) => {
  const m = useTunnelMats();
  return (
    <SideWorld cam={cam} t={t}>
      <Machine m={m} x={x} t={t} spin={t * 3} rams={rams} trailers={7} />
      <HalfRings m={m} from={x - 2.2} count={50} />
      {extra && extra(m)}
    </SideWorld>
  );
};
const MachineSide = (t: number, d: number, cam: C, extra?: (m: TM) => React.ReactNode, x = 2, rams = 0) => <MachineSideC t={t} cam={cam} extra={extra} x={x} rams={rams} />;

const CutterFront: React.FC<{ t: number; d: number; cam: C; building?: number; chips?: boolean }> = ({ t, d, cam, building = 0, chips = true }) => {
  const m = useTunnelMats();
  return (
    <World cam={cam} t={t} top="#7a1a9a" bottom="#0e0424" bloom={1.3} fog="#2a0848">
      <group rotation={[0, 0, 0]}>
        <TBM m={m} spin={t * 1.8} t={t} trailers={4} />
      </group>
      <mesh material={m.rock1} position={[0, 0, -1.2]}>
        <torusGeometry args={[1.6, 0.55, 16, 48]} />
      </mesh>
      {chips && <Chips m={m} age={t} seed={6} count={60} position={[0, -0.2, 0.3]} speed={1.6} size={1.2} />}
      {building > 0 && <Building m={m} position={[2.6, -1.0, 0]} scale={[building, building, building]} floors={4} />}
      <Motes t={t} count={60} spread={12} center={[0, 0, 2]} color="#e8d0ff" size={0.04} />
    </World>
  );
};

const DiscCutters: React.FC<{ t: number; d: number; cam: C; crack?: number }> = ({ t, d, cam, crack = 0 }) => {
  const m = useTunnelMats();
  const face = useMemo(() => {
    const g = new THREE.PlaneGeometry(12, 12, 90, 90);
    const p = g.attributes.position as THREE.BufferAttribute;
    const r = rng(3);
    for (let i = 0; i < p.count; i++) p.setZ(i, (Math.sin(p.getX(i) * 3.1) * Math.cos(p.getY(i) * 2.7) + Math.sin(p.getX(i) * 7 + p.getY(i) * 5) * 0.4) * 0.12 + r() * 0.03);
    g.computeVertexNormals();
    return g;
  }, []);
  const cracks = useMemo(() => {
    const r = rng(8);
    return Array.from({ length: 14 }, () => ({ x: (r() - 0.5) * 4, y: (r() - 0.5) * 4, a: r() * Math.PI, l: 0.6 + r() * 1.2 }));
  }, []);
  const crackMat = useMemo(() => new THREE.MeshBasicMaterial({ color: "#ff9a3a", toneMapped: false }), []);
  const rot = t * 1.6;
  return (
    <World cam={cam} t={t} top="#5a1a8a" bottom="#0e0424" bloom={1.5} tint="#ff7a2a">
      <mesh geometry={face} material={m.chalk} position={[0, 0, -0.15]} />
      {[0, 1, 2].map((i) => {
        const a = rot + (i * Math.PI * 2) / 3;
        const r = 0.9;
        return (
          <group key={i} position={[Math.cos(a) * r, Math.sin(a) * r, 0.3]} rotation={[0, Math.PI / 2, a]}>
            <mesh material={m.steel} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.55, 0.55, 0.12, 40]} />
            </mesh>
            <mesh material={m.shell} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.2, 0.2, 0.3, 20]} />
            </mesh>
          </group>
        );
      })}
      {cracks.map((c, i) => (
        <mesh key={i} material={crackMat} position={[c.x, c.y, 0.0]} rotation={[0, 0, c.a]} scale={[smooth(range(crack, i * 0.05, i * 0.05 + 0.3)), 1, 1]}>
          <boxGeometry args={[c.l, 0.025, 0.02]} />
        </mesh>
      ))}
      {[0, 1, 2].map((i) => {
        const a = rot + (i * Math.PI * 2) / 3;
        return <Chips key={i} m={m} age={t + i * 0.3} seed={30 + i} count={30} position={[Math.cos(a) * 0.9, Math.sin(a) * 0.9, 0.2]} speed={1.4} size={1.1} />;
      })}
      <Motes t={t} count={50} spread={10} center={[0, 0, 2]} color="#ffd0a0" size={0.04} />
    </World>
  );
};

const PressureParticles: React.FC<{ t: number; x0: number; x1: number; yTop: number; yBot: number; count?: number; bounce?: number; dirX?: boolean }> = ({ t, x0, x1, yTop, yBot, count = 160, bounce = 0, dirX }) => {
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color: "#bff8ff", toneMapped: false, transparent: true, opacity: 0.8 }), []);
  const geo = useMemo(() => new THREE.CapsuleGeometry(0.03, 0.25, 3, 6), []);
  const ps = useMemo(() => {
    const r = rng(17);
    return Array.from({ length: count }, () => ({ x: r(), z: (r() - 0.3) * 3, ph: r(), sp: 0.7 + r() * 0.6 }));
  }, [count]);
  const items: Inst[] = ps.map((q) => {
    const u = (t * q.sp * 0.8 + q.ph) % 1;
    let k = u;
    if (bounce > 0 && u > 0.7) k = 0.7 - (u - 0.7) * bounce;
    if (dirX) return { p: v(lerp(x1, x0, k), lerp(yBot, yTop, q.x), q.z), r: new THREE.Euler(0, 0, Math.PI / 2), s: 1 };
    return { p: v(lerp(x0, x1, q.x), lerp(yTop, yBot, k), q.z), r: new THREE.Euler(), s: 1 };
  });
  return <Instances geometry={geo} material={mat} items={items} max={count} />;
};

const Chamber: React.FC<{ t: number; d: number; cam: C; fill: number; push: number }> = ({ t, d, cam, fill, push }) => {
  const m = useTunnelMats();
  return (
    <World cam={cam} t={t} top="#1a5aa0" bottom="#0a0424" bloom={1.3} tint="#ff4fb0">
      <mesh material={m.shell} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -0.2]}>
        <cylinderGeometry args={[1.05, 1.05, 1.2, 64, 1, true]} />
      </mesh>
      <mesh material={m.dark} position={[0, 0, -0.8]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[1.05, 1.05, 0.06, 64]} />
      </mesh>
      <group position={[0, 0, -0.6]}>
        <MudBlobs m={m} t={t} fill={fill} push={push} />
      </group>
      <PressureParticles t={t} x0={-2.5} x1={2.5} yTop={4} yBot={1.0} count={120} bounce={push * 1.2} />
      <Glow position={[0, 0, 0.6]} scale={2.6 + push * 1.5} color={push > 0.3 ? "#ff6fd0" : "#2ff0ff"} opacity={0.35 + push * 0.4} />
      <Motes t={t} count={40} spread={10} center={[0, 0, 2]} color="#e8f8ff" size={0.04} />
    </World>
  );
};

const Erector: React.FC<{ t: number; d: number; cam: C; mode: "lift" | "car" | "lock" }> = ({ t, d, cam, mode }) => {
  const m = useTunnelMats();
  const fm = useFactoryMats();
  const lift = mode === "lift" ? easeInOut(range(t, 0.1, d)) : 1;
  const lock = mode === "lock" ? easeOut(range(t, 0.2, 0.9)) : 0;
  const segA = mode === "car" ? -0.5 : lerp(-2.4, -0.4, lift);
  return (
    <World cam={cam} t={t} top="#2a2a7a" bottom="#0a0424" bloom={1.2}>
      {/* completed rings behind */}
      {Array.from({ length: 14 }, (_, i) => (
        <group key={i} position={[0, 0, -0.4 - i * 0.32]} scale={2}>
          {Array.from({ length: 6 }, (_, s) => <Segment key={s} m={m} i={s} />)}
          <mesh material={m.light}>
            <torusGeometry args={[0.905, 0.006, 6, 64]} />
          </mesh>
        </group>
      ))}
      {/* ring being built at z=0.3: 4 placed, one coming in */}
      <group position={[0, 0, 0.3]} scale={2}>
        {[0, 1, 2, 3].map((s) => <Segment key={s} m={m} i={s} />)}
        <group rotation={[0, 0, (1 - lock) * 0.25 + segA * 0]} position={[0, 0, (1 - lock) * (mode === "lock" ? 0.25 : 0)]}>
          <group rotation={[0, 0, mode === "lock" ? 0 : segA]}>
            <Segment m={m} i={4} />
          </group>
        </group>
        {lock > 0.95 && <Segment m={m} i={5} />}
        {mode === "lock" && lock > 0.9 && <mesh material={m.light}><torusGeometry args={[0.905, 0.01, 6, 64]} /></mesh>}
      </group>
      <Robot m={fm} a={[0.3 + Math.sin(t * 2) * 0.1, lerp(1.1, 0.6, lift), lerp(0.6, 1.2, lift), 0.4]} position={[0.2, -1.8, 1.2]} scale={0.45} />
      {mode === "car" && <Car m={fm} paint={1} glass={1} wheels={1} position={[0.4, -1.78, 1.3]} rotation={[0, -0.6, 0]} scale={0.35} t={t} />}
      {mode === "car" && <Glow position={[-1.2, -1.0, 0.8]} scale={2} color="#2ff0ff" opacity={0.3} />}
      <mesh material={m.dark} position={[0, -1.85, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[3.2, 12]} />
      </mesh>
      {mode === "lock" && lock > 0.95 && <Glow position={[0, 0, 0.6]} scale={4} color="#2ff0ff" opacity={Math.max(0, 1 - (t - 0.9) * 2)} />}
    </World>
  );
};

const SpineFly: React.FC<{ t: number; d: number; speed?: number; drive?: boolean }> = ({ t, d, speed = 4, drive }) => {
  const m = useTunnelMats();
  const fm = useFactoryMats();
  const z = -t * speed;
  const N = 60;
  const base = Math.floor(-z / 0.32);
  const road = useMemo(() => new THREE.MeshStandardMaterial({ color: "#2a2244", roughness: 0.6 }), []);
  const cam: C = { pos: [0.15, drive ? -0.35 : 0, z + 2], target: [0, drive ? -0.4 : 0, z - 6], fov: 52, roll: drive ? 0 : t * 0.2 };
  return (
    <World cam={cam} t={t} top="#1a1a5a" bottom="#05021a" bloom={1.5} bokeh={2} focus={6}>
      {Array.from({ length: N }, (_, i) => {
        const zi = -(base + i) * 0.32 + 2;
        return (
          <group key={i} position={[0, 0, zi]} scale={1.3}>
            {Array.from({ length: 6 }, (_, s) => <Segment key={s} m={m} i={s} />)}
            {(base + i) % 6 === 0 && (
              <mesh material={m.light}>
                <torusGeometry args={[0.9, 0.012, 6, 64]} />
              </mesh>
            )}
          </group>
        );
      })}
      {drive && (
        <>
          <mesh material={road} position={[0, -0.7, z - 10]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[1.6, 60]} />
          </mesh>
          {Array.from({ length: 30 }, (_, i) => (
            <mesh key={i} material={m.light} position={[0, -0.69, -Math.floor(-z / 1.2) * 1.2 - i * 1.2 + 2]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[0.04, 0.5]} />
            </mesh>
          ))}
          <Car m={fm} paint={1} glass={1} wheels={1} lights={1} position={[0.35, -0.7, z - 4 - t * 0.3]} rotation={[0, Math.PI / 2, 0]} scale={0.18} t={t} />
        </>
      )}
    </World>
  );
};

const Ocean: React.FC<{ t: number; d: number; cam: C }> = ({ t, d, cam }) => {
  const m = useTunnelMats();
  const fm = useFactoryMats();
  return (
    <SideWorld cam={cam} t={t} seaTop={11} bloom={1.2}>
      <HalfRings m={m} from={20} count={125} />
      {Array.from({ length: 12 }, (_, i) => <Glow key={i} position={[-18 + i * 3.4, 0.7, -0.6]} scale={0.6} color="#fff0c0" opacity={0.9} />)}
      <Car m={fm} paint={1} glass={1} wheels={1} lights={1} position={[lerp(-6, 6, t / 4), -0.95, 0]} scale={0.35} t={t} />
      <Fish m={m} t={t} count={40} center={[0, 7.5, -1]} spread={[24, 4, 5]} />
      <Ship m={m} x={lerp(-6, 4, t / 6)} y={11.2} z={-4} />
    </SideWorld>
  );
};

const TwoMachines: React.FC<{ t: number; d: number; cam: C; gap: number; flash?: number; lasers?: boolean }> = ({ t, d, cam, gap, flash = 0, lasers }) => {
  const m = useTunnelMats();
  const laser = useMemo(() => new THREE.MeshBasicMaterial({ color: "#ff3355", toneMapped: false }), []);
  const xa = -gap / 2, xb = gap / 2;
  return (
    <SideWorld cam={cam} t={t}>
      <Machine m={m} x={xa} t={t} spin={t * 3} trailers={6} />
      <HalfRings m={m} from={xa - 2.2} count={40} />
      <Machine m={m} x={xb} t={t} spin={-t * 3} dir={-1} trailers={6} />
      <HalfRings m={m} from={xb + 2.2} count={40} dir={-1} />
      {/* rock plug between the two machines */}
      {gap > 0.25 && (
        <mesh material={m.rock2} position={[0, 0, -0.6]} scale={[Math.max(0.01, gap - 0.2), 1, 1]}>
          <boxGeometry args={[1, 2.2, 1.0]} />
        </mesh>
      )}
      {lasers &&
        [-1, 1].map((s) => (
          <mesh key={s} material={laser} position={[s * (gap / 2 + 9), 0.55, 0.3]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.012, 0.012, 18, 6]} />
          </mesh>
        ))}
      {lasers && [-1, 1].map((s) => <Glow key={s} position={[s * (gap / 2 + 0.2), 0.55, 0.3]} scale={0.5} color="#ff3355" opacity={0.9} />)}
      {flash > 0 && <Glow position={[0, 0, 1]} scale={2 + flash * 8} color="#ffffff" opacity={flash} />}
      {flash > 0 && <Chips m={m} age={(1 - flash) * 0.8} seed={40} count={80} position={[0, 0, 0.5]} speed={3} size={2} />}
    </SideWorld>
  );
};

// =====================================================================================
// shot list
// =====================================================================================
const side = (t: number, d: number, a: number[], b: number[], tgt: number[] | ((k: number) => number[]), fov = 40) => mv(a, b, t, d, tgt, fov);

export const SHOTS: Shot[] = [
  { a: 0, b: 2.2, kind: "char", el: (t, d, gt) => HookShot(t, d, gt) },
  { a: 2.2, b: 3.7, kind: "macro", el: (t, d) => MachineSide(t, d, side(t, d, [6, 0.4, 5.5], [0, 0.3, 6.5], (k) => [lerp(3, -3, k), 0, 0])) },
  { a: 3.7, b: 5.13, kind: "macro", el: (t, d) => MachineSide(t, d, side(t, d, [-1, 0.6, 9], [-6, 0.9, 14], [-5, -0.5, 0], 44), (m) => <Field position={[-6.5, -1.08, 2.6]} length={13} />) },
  { a: 5.13, b: 7.0, kind: "macro", el: (t, d) => <CutterFront t={t} d={d} cam={side(t, d, [1.5, 0.6, 4.5], [-0.8, -0.3, 3.4], [0, 0, 0])} /> },
  { a: 7.0, b: 8.3, kind: "macro", el: (t, d) => <CutterFront t={t + 1.9} d={d} cam={side(t, d, [3.5, 0.2, 4.2], [4.2, 0.6, 5.5], [0.8, 0, 0])} chips={false} /> },
  { a: 8.3, b: 9.57, kind: "macro", el: (t, d) => <CutterFront t={t + 3.2} d={d} cam={side(t, d, [3.0, 0.5, 6.5], [2.4, 0.6, 7.4], [1.2, 0, 0])} chips={false} building={smooth(range(t, 0, 0.5))} /> },
  { a: 9.57, b: 11.48, kind: "char", el: (t, d, gt) => StartShot(t, d, gt) },
  { a: 11.48, b: 13.3, kind: "macro", el: (t, d) => <DiscCutters t={t} d={d} cam={side(t, d, [1.8, -1.2, 3.0], [0.8, -0.6, 2.4], [0, 0, 0])} /> },
  { a: 13.3, b: 14.6, kind: "macro", el: (t, d) => <DiscCutters t={t + 1.8} d={d} cam={side(t, d, [-1.2, 1.2, 2.6], [-0.6, 0.6, 2.2], [0, 0, 0])} crack={range(t, 0.3, d)} /> },
  { a: 14.6, b: 15.85, kind: "macro", el: (t, d) => <DiscCutters t={t + 3.1} d={d} cam={side(t, d, [0.6, 0.3, 2.6], [0.3, -0.4, 4.5], [0, 0, 0])} crack={1} /> },
  { a: 15.85, b: 17.61, kind: "char", el: (t, d, gt) => PushShot(t, d, gt) },
  { a: 17.61, b: 19.6, kind: "macro", el: (t, d) => MachineSide(t, d, side(t, d, [1.4, 0.9, 3.2], [0.6, 0.5, 2.6], [-0.2, 0, 0]), undefined, 2 + 0.3 * range(t, 0.3, d), range(t, 0.3, d)) },
  { a: 19.6, b: 21.88, kind: "macro", el: (t, d) => MachineSide(t + 2, d, side(t, d, [7, 1.2, 6], [4, 0.8, 5.5], [2, 0, 0]), (m) => (
    <>{Array.from({ length: 9 }, (_, i) => <mesh key={i} material={m.light} position={[2.4 + i * 0.4 - (t * 0.12), -1.08, 1.4]}><boxGeometry args={[0.03, 0.02, i % 4 === 0 ? 0.5 : 0.25]} /></mesh>)}</>
  ), 2.4 + t * 0.12) },
  { a: 21.88, b: 23.9, kind: "macro", el: (t, d) => MachineSide(t + 4, d, side(t, d, [-3, 0.3, 2.2], [-8, 0.2, 2.0], (k) => [lerp(-6, -11, k), 0, 0], 44)) },
  { a: 23.9, b: 25.3, kind: "macro", el: (t, d) => MachineSide(t + 6, d, side(t, d, [-4, 1, 9], [-10, 3, 20], [-14, 0, 0], 46), (m) => <Glow position={[-20, 0.2, 0.3]} scale={6} color="#2ff0ff" opacity={0.4} />) },
  { a: 25.3, b: 26.74, kind: "macro", el: (t, d) => MachineSide(t + 7.4, d, side(t, d, [-14, 6, 26], [-16, 8, 30], [-12, 3, 0], 46), (m) => (
    <><mesh material={m.sand} position={[-30, 6, -6]}><boxGeometry args={[14, 12, 20]} /></mesh><Glow position={[-23, 0.3, 0.3]} scale={5} color="#2ff0ff" opacity={0.6} /></>
  )) },
  { a: 26.74, b: 28.84, kind: "char", el: (t, d, gt) => HoldSeaShot(t, d, gt) },
  { a: 28.84, b: 30.8, kind: "macro", el: (t, d) => MachineSide(t, d, side(t, d, [1, 4, 14], [-1, 5, 17], [0, 4, 0], 46), (m) => (
    <><PressureParticles t={t} x0={-8} x1={8} yTop={10} yBot={5} count={180} />
      <mesh material={m.light} position={[4.5, 5, 1]}><boxGeometry args={[0.04, 10, 0.04]} /></mesh>
      {Array.from({ length: 6 }, (_, i) => <mesh key={i} material={m.light} position={[4.5, i * 2, 1]}><boxGeometry args={[0.3, 0.04, 0.04]} /></mesh>)}</>
  )) },
  { a: 30.8, b: 32.95, kind: "macro", el: (t, d) => MachineSide(t + 2, d, side(t, d, [5, 0.8, 5.5], [3.5, 0.6, 4.6], [3.4, 0.2, 0], 42), (m) => (
    <PressureParticles t={t} x0={3.6} x1={9} yTop={1.0} yBot={-1.0} count={140} dirX />
  )) },
  { a: 32.95, b: 35.0, kind: "macro", el: (t, d) => <Chamber t={t} d={d} cam={side(t, d, [1.8, 0.6, 4.2], [0.6, 0.2, 3.4], [0, 0, -0.3])} fill={smooth(range(t, 0.3, d))} push={0} /> },
  { a: 35.0, b: 36.4, kind: "macro", el: (t, d) => <Chamber t={t + 2} d={d} cam={side(t, d, [-1.6, 1.5, 3.8], [-0.8, 0.9, 3.0], [0, 0.2, -0.3])} fill={1} push={smooth(range(t, 0.3, d))} /> },
  { a: 36.4, b: 37.67, kind: "macro", el: (t, d) => <Chamber t={t + 3.4} d={d} cam={side(t, d, [0.4, 3.2, 3.6], [0.2, 2.2, 4.4], [0, 0.6, 0])} fill={1} push={1} /> },
  { a: 37.67, b: 39.52, kind: "char", el: (t, d, gt) => WallsShot(t, d, gt) },
  { a: 39.52, b: 41.4, kind: "macro", el: (t, d) => <Erector t={t} d={d} mode="lift" cam={side(t, d, [1.4, 0.4, 5.6], [0.5, 0.2, 4.6], [0, 0, 0], 44)} /> },
  { a: 41.4, b: 43.3, kind: "macro", el: (t, d) => <Erector t={t} d={d} mode="car" cam={side(t, d, [2.2, -0.8, 5.2], [1.4, -1.0, 4.4], [0, -1.0, 0.5], 44)} /> },
  { a: 43.3, b: 45.11, kind: "macro", el: (t, d) => <Erector t={t} d={d} mode="lock" cam={side(t, d, [-1.2, 1.0, 4.6], [-0.4, 0.4, 3.8], [0, 0, 0], 44)} /> },
  { a: 45.11, b: 47.0, kind: "macro", el: (t, d) => MachineSide(t, d, side(t, d, [-3.5, 1.4, 9.5], [-1.5, 1.0, 8.5], [-2.2, 0, 0], 44), undefined, lerp(-1, 2.5, t / d)) },
  { a: 47.0, b: 48.3, kind: "macro", el: (t, d) => <SpineFly t={t} d={d} /> },
  { a: 48.3, b: 49.71, kind: "macro", el: (t, d) => <SpineFly t={t + 1.3} d={d} speed={6} /> },
  { a: 49.71, b: 51.87, kind: "char", el: (t, d, gt) => BothShot(t, d, gt) },
  { a: 51.87, b: 53.2, kind: "macro", el: (t, d) => <TwoMachines t={t} d={d} gap={lerp(3.8, 3.3, t / d)} cam={side(t, d, [0, 1.4, 12], [0, 1.1, 10.5], [0, 0.2, 0], 46)} /> },
  { a: 53.2, b: 54.51, kind: "macro", el: (t, d) => <TwoMachines t={t + 1.3} d={d} gap={lerp(3.3, 2.9, t / d)} cam={side(t, d, [5, 0.8, 7], [3, 0.6, 6], [5, 0, 0], 42)} /> },
  { a: 54.51, b: 56.0, kind: "macro", el: (t, d) => <TwoMachines t={t + 2.6} d={d} gap={lerp(2.9, 2.4, t / d)} lasers cam={side(t, d, [-3.5, 1.4, 6.5], [-2.2, 1.0, 5.8], (k) => [lerp(-3, -1.5, k), 0.3, 0], 42)} /> },
  { a: 56.0, b: 57.4, kind: "macro", el: (t, d) => <TwoMachines t={t + 4} d={d} gap={lerp(2.4, 0.6, t / d)} lasers cam={side(t, d, [0.5, 0.5, 6.5], [0.2, 0.3, 5.5], [0, 0, 0], 42)} /> },
  { a: 57.4, b: 59.31, kind: "macro", el: (t, d) => <TwoMachines t={t + 5.4} d={d} gap={0.22} flash={t < 0.6 ? 1 - t / 0.6 : 0} cam={side(t, d, [0.3, 0.6, 4.2], [0, 0.2, 3.2], [0, 0, 0], 40)} /> },
  { a: 59.31, b: 61.12, kind: "char", el: (t, d, gt) => DriveShot(t, d, gt) },
  { a: 61.12, b: 62.9, kind: "macro", el: (t, d) => <SpineFly t={t} d={d} speed={7} drive /> },
  { a: 62.9, b: 64.9, kind: "macro", el: (t, d) => <Ocean t={t} d={d} cam={side(t, d, [-3, 2, 15], [2, 6, 17], [0, 4.5, 0], 46)} /> },
  { a: 64.9, b: 66.6, kind: "macro", el: (t, d) => <Ocean t={t + 2} d={d} cam={side(t, d, [3, 6.5, 8], [0, 5.5, 9], [0, 3, -1], 42)} /> },
  { a: 66.6, b: END, kind: "char", el: (t, d, gt) => LoopShot(t, d, gt) },
];

const SFX: Sfx[] = [
  [0.52, "thud", 0.6], [0.6, "pop", 0.35], [2.0, "whoosh", 0.4], [5.6, "timelapse", 0.25], [8.4, "shimmer", 0.35], [9.95, "clink", 0.5], [11.3, "whoosh", 0.4],
  [13.8, "pop", 0.35], [14.1, "pop", 0.35], [14.6, "drop", 0.3], [15.6, "whoosh", 0.35], [17.45, "whoosh", 0.4], [18.4, "thud", 0.45], [23.5, "whoosh", 0.3],
  [26.6, "whoosh", 0.35], [27.4, "drop", 0.5], [28.7, "whoosh", 0.4], [33.4, "plop", 0.4], [34.0, "plop", 0.35], [36.2, "shimmer", 0.4], [37.5, "whoosh", 0.35],
  [39.4, "whoosh", 0.4], [43.85, "clink", 0.5], [44.5, "shimmer", 0.35], [47.0, "whoosh", 0.4], [49.55, "whoosh", 0.35], [50.3, "thud", 0.4], [51.8, "whoosh", 0.35],
  [55.0, "shimmer", 0.3], [57.4, "thud", 0.75], [57.5, "pop", 0.5], [59.2, "whoosh", 0.35], [60.9, "whoosh", 0.45], [62.3, "drop", 0.4], [63.0, "drop", 0.35],
  [66.5, "whoosh", 0.3], [67.2, "pop", 0.45],
];

export const science03 = { id: "Science03", slug: "science03", frames: timeline.frames, component: makeVideo({ slug: "science03", timeline, shots: SHOTS, sfx: SFX }) };
