import React from "react";
import * as THREE from "three";
import { FPS, Shot, Sfx, Timeline, makeVideo } from "../../engine/VideoBase";
import timelineJson from "./timeline.json";
import { clamp, easeIn, easeInOut, easeOut, lerp, lerpV, range, smooth } from "../../engine/lib";
import { LOOK, Pose, animPose, handFrame, pose } from "../../engine/Character";
import { Glow, Inst, Instances } from "../../engine/prims";
import { Engine, FM, Sparks, toolTip } from "./Car";
import {
  AssemblyLine, BenchShot, CoilCrane, CoilHero, HAMMER_UP, HookShot, LOOP_CAM, Layers, MINI_POS, Marriage, MileRibbon, MiniPress, PaintBath, PanelsAssemble, PartsSwarm,
  PressSlam, RobotWeld, Screw, SpotWeld, SprayPaint, WaterTest,
} from "./Shots";

// "How a Car Is Built" — made with the /video skill
const timeline = timelineJson as Timeline;
const END = timeline.frames / FPS;
const TY = MINI_POS[1];
const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

// character camera presets (portrait framing)
const benchCam = (from: number[], to: number[], target: number[] = [0.3, -1.6, 1.0], fov = 42) => (k: number) => ({ pos: lerpV(from, to, k), target, fov });
// push into a point at the end of the shot (before a cut into a macro shot)
const pushIn = (from: number[], to: number[], target: number[], d: number) => (k: number) => {
  const kk = easeIn(clamp(k));
  return { pos: lerpV(from, to, kk), target, fov: lerp(42, 30, kk) };
};

const happy = (o: Partial<Pose> = {}) => pose({ eyePitch: -0.35, eyeYaw: 0.1, brow: 0.6, smile: 1, head: [0.18, 0.05, 0], ...o });

// ---------- character shots ----------
const PressBench = (t: number, d: number, gt: number) => {
  const ramK = easeIn(range(t, 0.75, 1.05));
  const top = TY + 0.25 + 4.6 * 0.32 + 0.15;
  const p = animPose(t, [
    [0, pose({ eyePitch: -0.3, eyeYaw: 0.2, brow: 0.4, smile: 0.5, head: [0.2, 0.1, 0] })],
    [0.5, pose({ lw: [0.45, top + 0.35, 1.3], lp: [2.2, -1.6, 0.4], eyePitch: -0.45, brow: 0.6, smile: 0.4, head: [0.25, 0.15, 0] })],
    [1.05, pose({ lw: [0.4, top + 0.12, 1.25], lp: [2.2, -1.6, 0.4], eyePitch: -0.5, brow: -0.6, lid: 0.4, mouth: 0.6, smile: 0, head: [0.3, 0.1, 0.05] }), easeIn],
    [d, pose({ lw: [0.4, top + 0.12, 1.25], lp: [2.2, -1.6, 0.4], eyePitch: -0.5, brow: 0.9, lid: 1.1, mouth: 0.5, smile: 0.5, head: [0.3, 0.1, 0.05] })],
  ]);
  return (
    <BenchShot t={t} d={d} gt={gt} p={() => p} car={() => null}
      cam={pushIn([2.4, -0.4, 6.6], [0.6, -2.0, 3.2], [0.05, -2.35, 1.2], d)}
      extra={(tt, _p, m) => (
        <>
          <MiniPress m={m} ram={ramK} />
          <mesh material={m.steel} position={[MINI_POS[0], TY + 0.27, MINI_POS[2] - 0.1]}>
            <boxGeometry args={[0.9, 0.03, 0.6]} />
          </mesh>
          {tt > 1.05 && <Sparks age={tt - 1.05} seed={8} count={40} speed={1.5} size={0.5} position={[MINI_POS[0], TY + 0.3, MINI_POS[2] + 0.2]} />}
        </>
      )}
    />
  );
};

const WeldBench = (t: number, d: number, gt: number) => {
  const p = animPose(t, [
    [0, pose({ lw: [1.3, -1.6, 1.5], lp: [2.2, -2.2, 0.2], eyePitch: -0.4, eyeYaw: 0.2, brow: 0.5, smile: 0.6, head: [0.2, 0.15, 0] })],
    [0.6, pose({ lw: [0.95, -2.05, 1.85], lp: [2.2, -2.2, 0.2], eyePitch: -0.5, eyeYaw: 0.15, lid: 0.6, brow: 0.3, smile: 0.3, mouth: 0.2, head: [0.3, 0.15, 0] })],
    [d, pose({ lw: [0.65, -2.1, 1.85], lp: [2.2, -2.2, 0.2], eyePitch: -0.5, eyeYaw: 0.05, lid: 0.55, brow: 0.3, smile: 0.4, mouth: 0.2, head: [0.3, 0.1, 0] })],
  ]);
  const hf = handFrame(p, "l");
  const tip = toolTip(hf.hand, hf.dir, 0.85);
  return (
    <BenchShot t={t} d={d} gt={gt} p={() => p} tool="torch" car={() => ({ paint: 0, glass: 0, wheels: 0 })}
      cam={(k) => ({ pos: lerpV([2.8, -0.6, 6.0], [1.6, -1.2, 4.6], k), target: [0.4, -1.9, 1.1], fov: 42 })}
      extra={(tt) =>
        tt > 0.55 ? (
          <>
            <Sparks age={(tt - 0.55) % 0.45} seed={20 + Math.floor((tt - 0.55) / 0.45)} count={40} speed={1.6} size={0.45} position={tip} />
            <Glow position={tip} scale={0.6 + 0.2 * Math.sin(tt * 40)} color="#ffe2a0" opacity={0.95} />
            <pointLight position={tip} color="#ff9a3a" intensity={6} distance={4} />
          </>
        ) : null
      }
    />
  );
};

const DipBench = (t: number, d: number, gt: number) => {
  const sink = easeInOut(range(t, 0.55, 1.5));
  const carY = lerp(TY + 0.62, TY + 0.12, sink);
  const p = animPose(t, [
    [0, pose({ eyePitch: -0.4, eyeYaw: 0.2, brow: 0.6, smile: 0.7, head: [0.2, 0.1, 0] })],
    [0.5, pose({ lw: [0.35, TY + 0.62 + 0.75, 1.35], lp: [2.2, -1.6, 0.4], eyePitch: -0.5, brow: 0.7, smile: 0.8, head: [0.25, 0.1, 0] })],
    [1.5, pose({ lw: [0.35, TY + 0.12 + 0.75, 1.35], lp: [2.2, -1.6, 0.4], eyePitch: -0.5, brow: 1, lid: 1.1, smile: 0.6, mouth: 0.4, head: [0.3, 0.1, 0] })],
  ]);
  return (
    <BenchShot t={t} d={d} gt={gt} p={() => p} car={() => ({ paint: 0, glass: 0, wheels: 0, position: [MINI_POS[0], carY, MINI_POS[2]] })}
      cam={pushIn([2.6, -0.5, 6.4], [0.5, -1.5, 3.4], [0.05, TY + 0.6, 1.25], d)}
      extra={(tt, _p, m) => (
        <group position={[MINI_POS[0], TY, MINI_POS[2]]}>
          <mesh material={m.robot} position={[0, 0.25, 0]}>
            <boxGeometry args={[1.9, 0.5, 0.95]} />
          </mesh>
          <mesh position={[0, 0.51, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[1.8, 0.85]} />
            <meshStandardMaterial color="#2fe8ff" emissive="#10c0e0" emissiveIntensity={1.2} transparent opacity={0.85} />
          </mesh>
          <Glow position={[0, 0.6, 0.2]} scale={2 + sink} color="#2ff0ff" opacity={0.5} />
        </group>
      )}
    />
  );
};

const HeartBench = (t: number, d: number, gt: number) => {
  const p = animPose(t, [
    [0, pose({ lw: [1.25, -2.4, 1.6], eyePitch: -0.3, brow: 0.5, smile: 0.6 })],
    [0.7, pose({ ...LOOK, lw: [0.75, -1.25, 1.85], lp: [2.2, -2.2, 0.3], eyePitch: -0.15, eyeYaw: 0.25, lid: 1.15, brow: 1, mouth: 0.5, smile: 0.3, head: [0.05, 0.2, -0.05] })],
    [d, pose({ ...LOOK, lw: [0.65, -1.35, 1.9], lp: [2.2, -2.2, 0.3], eyePitch: -0.15, eyeYaw: 0.25, lid: 1.2, brow: 1, mouth: 0.6, smile: 0.5, head: [0.05, 0.2, -0.05] })],
  ]);
  const hf = handFrame(p, "l");
  const ep = hf.hand.clone().add(v(-0.1, 0.25, 0.1));
  return (
    <BenchShot t={t} d={d} gt={gt} p={() => p} car={() => ({ paint: 1, glass: 1, wheels: 0 })}
      cam={pushIn([1.8, -0.2, 6.6], [0.9, -0.9, 3.6], [ep.x, ep.y, ep.z], d)}
      extra={(tt, _p, m) => <Engine m={m} position={ep} scale={0.32} t={tt} glow={1} />}
    />
  );
};

const MarriageBench = (t: number, d: number, gt: number) => {
  const p = pose({ eyePitch: -0.4, eyeYaw: 0.1, brow: 0.8, smile: 1, lid: 0.8, head: [0.2, 0.05, 0.08 + Math.sin(t * 3) * 0.04] });
  return (
    <BenchShot t={t} d={d} gt={gt} p={() => p} car={() => ({ paint: 1, glass: 1, wheels: 1, engine: true })}
      cam={benchCam([-1.2, -0.2, 6.8], [0.8, -0.4, 6.0], [0.2, -1.4, 1.0])}
      extra={() => (
        <>
          {[0, 1, 2].map((i) => {
            const k = ((t * 0.7 + i * 0.33) % 1);
            return <Glow key={i} position={[MINI_POS[0] + Math.sin(i * 2) * 0.4, TY + 0.6 + k * 1.4, MINI_POS[2]]} scale={0.5} color="#ff4fb0" opacity={Math.sin(k * Math.PI)} />;
          })}
        </>
      )}
    />
  );
};

const CountBench = (t: number, d: number, gt: number) => {
  const p = pose({
    rw: [-0.55, -1.55, 1.85], rp: [-2.2, -2.2, 0.3], finger: 1,
    eyeYaw: Math.sin(t * 6) * 0.4, eyePitch: -0.1 + Math.cos(t * 5) * 0.15, lid: 1.1, brow: 0.8, mouth: 0.3 + 0.2 * Math.abs(Math.sin(t * 8)), smile: 0.2, head: [0.05, Math.sin(t * 3) * 0.15, 0],
  });
  return (
    <BenchShot t={t} d={d} gt={gt} p={() => p} car={() => ({ paint: 1, glass: 1, wheels: 1 })}
      cam={benchCam([2.2, -0.2, 7.2], [1.2, -0.5, 6.0], [0.1, -1.4, 1.0], 44)}
      extra={(tt, _p, m) => <FloatingParts m={m} t={tt} />}
    />
  );
};
const FloatingParts: React.FC<{ m: FM; t: number }> = ({ m, t }) => {
  const items: Inst[] = Array.from({ length: 90 }, (_, i) => {
    const a = i * 2.39996 + t * (0.3 + (i % 5) * 0.05);
    const r = 1.1 + (i % 7) * 0.12;
    return { p: v(MINI_POS[0] + Math.cos(a) * r, TY + 0.4 + ((i * 0.37) % 1.6), MINI_POS[2] + Math.sin(a) * r * 0.5), r: new THREE.Euler(i, t * 2 + i, 0), s: 0.035 + (i % 3) * 0.015 };
  });
  const geo = React.useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  return <Instances geometry={geo} material={m.robotJoint} items={items} max={90} />;
};

const HoseBench = (t: number, d: number, gt: number) => {
  const p = animPose(t, [
    [0, pose({ lw: [1.3, -1.7, 1.6], lp: [2.2, -2.2, 0.2], eyePitch: -0.35, eyeYaw: 0.2, brow: 0.6, smile: 0.8, head: [0.2, 0.15, 0] })],
    [d, pose({ lw: [1.05, -1.75, 1.8], lp: [2.2, -2.2, 0.2], eyePitch: -0.45, eyeYaw: 0.1, brow: 0.8, smile: 1, head: [0.25, 0.1, 0] })],
  ]);
  const hf = handFrame(p, "l");
  const tip = toolTip(hf.hand, hf.dir, 0.65);
  const target = v(MINI_POS[0] + 0.2, TY + 0.45, MINI_POS[2]);
  return (
    <BenchShot t={t} d={d} gt={gt} p={() => p} tool="hose" car={() => ({ paint: 1, glass: 1, wheels: 1, wet: smooth(range(t, 0.2, 1.2)) })}
      cam={pushIn([2.6, -0.4, 6.6], [0.9, -1.8, 2.8], [MINI_POS[0], TY + 0.35, MINI_POS[2]], d)}
      extra={() => <WaterStream from={tip} to={target} t={t} />}
    />
  );
};
const WaterStream: React.FC<{ from: THREE.Vector3; to: THREE.Vector3; t: number }> = ({ from, to, t }) => {
  const mat = React.useMemo(() => new THREE.MeshBasicMaterial({ color: "#bff6ff", toneMapped: false, transparent: true, opacity: 0.85 }), []);
  const geo = React.useMemo(() => new THREE.SphereGeometry(1, 8, 6), []);
  const items: Inst[] = Array.from({ length: 70 }, (_, i) => {
    const u = ((t * 2.2 + i / 70) % 1);
    const p = from.clone().lerp(to, u);
    p.y += Math.sin(u * Math.PI) * 0.25 + Math.sin(i * 7.1) * 0.03;
    p.z += Math.cos(i * 3.3) * 0.04 * u;
    return { p, r: new THREE.Euler(), s: 0.025 + 0.02 * u };
  });
  return <Instances geometry={geo} material={mat} items={items} max={70} />;
};

const DoneBench = (t: number, d: number, gt: number) => {
  const drive = easeIn(range(t, 1.0, d));
  const p = animPose(t, [
    [0, happy({ eyePitch: -0.4, eyeYaw: 0.1 })],
    [d, happy({ eyePitch: -0.3, eyeYaw: 0.55, lid: 1.1, brow: 0.9, head: [0.15, 0.35, 0] })],
  ]);
  return (
    <BenchShot t={t} d={d} gt={gt} p={() => p} car={() => ({ paint: 1, glass: 1, wheels: 1, lights: smooth(range(t, 0.1, 0.4)), position: [MINI_POS[0] + drive * 3.5, TY, MINI_POS[2]] })}
      cam={benchCam([0.4, -0.3, 6.8], [1.6, -0.3, 6.6], [0.4, -1.4, 1.0])}
    />
  );
};

// last shot: new sheet pops in, hammer back up -> identical to frame 0
const LoopBench = (t: number, d: number, gt: number) => {
  const k = easeInOut(range(t, 0, d));
  const p = animPose(t, [
    [0, happy({ eyePitch: -0.3, eyeYaw: 0.55, lid: 1.1, brow: 0.9, head: [0.15, 0.35, 0] })],
    [d, HAMMER_UP],
  ]);
  const sheet = easeOut(range(t, 0.15, 0.5));
  const hammer = easeOut(range(t, 0.35, 0.75));
  return (
    <BenchShot t={t} d={d} gt={gt} p={() => p} car={() => null} tool={hammer > 0.01 ? "hammer" : undefined}
      cam={() => ({ pos: lerpV([1.6, -0.3, 6.6], LOOP_CAM.pos, k), target: lerpV([0.4, -1.4, 1.0], LOOP_CAM.target, k), fov: 42 })}
      extra={(tt, _p, m) => (
        <>
          <mesh material={m.steel} position={[MINI_POS[0], TY + 0.03, MINI_POS[2]]} scale={[sheet, 1, sheet]}>
            <boxGeometry args={[1.5, 0.05, 0.95]} />
          </mesh>
          {tt > 0.15 && tt < 0.6 && <Glow position={[MINI_POS[0], TY + 0.2, MINI_POS[2]]} scale={1.5} color="#2ff0ff" opacity={Math.sin(range(tt, 0.15, 0.6) * Math.PI)} />}
        </>
      )}
    />
  );
};

// ---------- shot list ----------
const c = (pos: number[], target: number[], fov = 40) => ({ pos, target, fov });
const mv = (a: number[], b: number[], t: number, d: number, target: number[], fov = 40) => c(lerpV(a, b, easeInOut(t / d)), target, fov);

export const SHOTS: Shot[] = [
  { a: 0, b: 2.2, kind: "char", el: (t, d, gt) => <HookShot t={t} d={d} gt={gt} /> },
  { a: 2.2, b: 3.8, kind: "macro", el: (t, d, gt) => <CoilHero t={t} d={d} gt={gt} /> },
  { a: 3.8, b: 5.2, kind: "macro", el: (t, d, gt) => <CoilHero t={t + 1.6} d={d} gt={gt} cam={mv([3.2, 1.0, 3.6], [1.6, 0.6, 5.0], t, d, [0, 1.6, 0.8], 38)} /> },
  { a: 5.2, b: 6.85, kind: "macro", el: (t, d, gt) => <CoilCrane t={t} d={d} gt={gt} /> },
  { a: 6.85, b: 8.85, kind: "macro", el: (t, d, gt) => <MileRibbon t={t} d={d} gt={gt} /> },
  { a: 8.85, b: 11.0, kind: "char", el: (t, d, gt) => PressBench(t, d, gt) },
  { a: 11.0, b: 12.6, kind: "macro", el: (t, d, gt) => <PressSlam t={t} d={d} gt={gt} impactAt={0.98} /> },
  { a: 12.6, b: 14.36, kind: "macro", el: (t, d, gt) => <PressSlam t={t} d={d} gt={gt} impactAt={0} after /> },
  { a: 14.36, b: 15.6, kind: "macro", el: (t, d, gt) => <PressSlam t={t} d={d} gt={gt} impactAt={0.43} cam={mv([-4, 1.2, 6.5], [-3, 0.9, 6.0], t, d, [0, 1.2, 0], 42)} /> },
  { a: 15.6, b: 17.3, kind: "macro", el: (t, d, gt) => <PanelsAssemble t={t} d={d} gt={gt} times={[0.74, 1.45, 2.26]} /> },
  { a: 17.3, b: 18.93, kind: "macro", el: (t, d, gt) => <PanelsAssemble t={t + 1.7} d={d} gt={gt} times={[0.74, 1.45, 2.26]} cam={mv([-4.5, 3.5, 5.5], [-2.5, 2.5, 7.0], t, d, [0, 0.9, 0], 40)} /> },
  { a: 18.93, b: 20.76, kind: "char", el: (t, d, gt) => WeldBench(t, d, gt) },
  { a: 20.76, b: 22.5, kind: "macro", el: (t, d, gt) => <RobotWeld t={t} d={d} gt={gt} /> },
  { a: 22.5, b: 24.25, kind: "macro", el: (t, d, gt) => <RobotWeld t={t + 1.7} d={d} gt={gt} close /> },
  { a: 24.25, b: 26.2, kind: "macro", el: (t, d, gt) => <SpotWeld t={t} d={d} gt={gt} current={smooth(range(t, 1.7, 1.85))} melt={0} /> },
  { a: 26.2, b: 27.6, kind: "macro", el: (t, d, gt) => <SpotWeld t={t + 2} d={d} gt={gt} current={1} melt={easeOut(range(t, 0.2, 1.2))} cam={mv([2.2, 0.8, 5.2], [0.8, 0.5, 4.4], t, d, [0, 0, 0], 40)} /> },
  { a: 27.6, b: 28.91, kind: "macro", el: (t, d, gt) => <SpotWeld t={t + 3.4} d={d} gt={gt} current={1 - range(t, 0.6, 1.1)} melt={1} cam={mv([-0.8, 2.2, 5.0], [-1.8, 1.2, 5.4], t, d, [0, 0, 0], 40)} /> },
  { a: 28.91, b: 30.9, kind: "char", el: (t, d, gt) => DipBench(t, d, gt) },
  { a: 30.9, b: 32.6, kind: "macro", el: (t, d, gt) => <PaintBath t={t} d={d} gt={gt} /> },
  { a: 32.6, b: 34.2, kind: "macro", el: (t, d, gt) => <PaintBath t={t} d={d * 2} gt={gt} inside /> },
  { a: 34.2, b: 35.77, kind: "macro", el: (t, d, gt) => <PaintBath t={t + 1.6} d={3.2} gt={gt} inside cam={mv([-3.5, -0.6, 3.8], [-2.2, -0.2, 3.0], t, d, [0, -0.6, 0.6], 40)} /> },
  { a: 35.77, b: 37.4, kind: "macro", el: (t, d, gt) => <SprayPaint t={t} d={d} gt={gt} from={0.15} to={0.45} /> },
  { a: 37.4, b: 39.58, kind: "macro", el: (t, d, gt) => <SprayPaint t={t} d={d} gt={gt} from={0.45} to={1} gloss cam={mv([-6, 2.6, 7.5], [4.0, 2.2, 8.0], t, d, [0, 0.9, 0], 40)} /> },
  { a: 39.58, b: 41.3, kind: "macro", el: (t, d, gt) => <Layers t={t} d={d} gt={gt} /> },
  { a: 41.3, b: 43.25, kind: "macro", el: (t, d, gt) => <Layers t={t} d={d} gt={gt} paper /> },
  { a: 43.25, b: 45.06, kind: "char", el: (t, d, gt) => HeartBench(t, d, gt) },
  { a: 45.06, b: 46.9, kind: "macro", el: (t, d, gt) => <Marriage t={t} d={d} gt={gt} phase={0} /> },
  { a: 46.9, b: 48.75, kind: "macro", el: (t, d, gt) => <Marriage t={t} d={d} gt={gt} phase={1} /> },
  { a: 48.75, b: 50.3, kind: "macro", el: (t, d, gt) => <Marriage t={t} d={d} gt={gt} phase={2} /> },
  { a: 50.3, b: 51.81, kind: "char", el: (t, d, gt) => MarriageBench(t, d, gt) },
  { a: 51.81, b: 53.66, kind: "char", el: (t, d, gt) => CountBench(t, d, gt) },
  { a: 53.66, b: 55.8, kind: "macro", el: (t, d, gt) => <PartsSwarm t={t} d={d} gt={gt} /> },
  { a: 55.8, b: 57.0, kind: "macro", el: (t, d, gt) => <PartsSwarm t={t + 2.1} d={3.3} gt={gt} cam={mv([1.5, 1.2, 3.2], [0.5, 0.9, 2.2], t, d, [0, 0.8, 0], 42)} /> },
  { a: 57.0, b: 58.46, kind: "macro", el: (t, d, gt) => <Screw t={t} d={d} gt={gt} /> },
  { a: 58.46, b: 60.31, kind: "char", el: (t, d, gt) => HoseBench(t, d, gt) },
  { a: 60.31, b: 62.3, kind: "macro", el: (t, d, gt) => <WaterTest t={t} d={d} gt={gt} /> },
  { a: 62.3, b: 64.33, kind: "macro", el: (t, d, gt) => <WaterTest t={t + 2} d={d} gt={gt} close /> },
  { a: 64.33, b: 66.2, kind: "macro", el: (t, d, gt) => <AssemblyLine t={t} d={d} gt={gt} /> },
  { a: 66.2, b: 67.87, kind: "macro", el: (t, d, gt) => <AssemblyLine t={t} d={d} gt={gt} exit /> },
  { a: 67.87, b: 69.8, kind: "char", el: (t, d, gt) => DoneBench(t, d, gt) },
  { a: 69.8, b: END, kind: "char", el: (t, d, gt) => LoopBench(t, d, gt) },
];

const SFX: Sfx[] = [
  [0.6, "thud", 0.75], [0.66, "pop", 0.4], [9.88, "clink", 0.45], 
  [11.96, "thud", 0.8], [14.77, "thud", 0.55], [16.32, "plop", 0.5], [17.03, "plop", 0.5], [17.85, "plop", 0.5], [19.5, "pop", 0.3],
  [21.0, "pop", 0.25], [21.6, "pop", 0.25], [25.95, "pop", 0.5], [26.4, "shimmer", 0.35], [29.55, "drop", 0.5],
  [31.8, "drop", 0.45], [33.5, "shimmer", 0.35], [38.7, "shimmer", 0.4], [42.05, "pop", 0.45],
  [47.3, "clink", 0.45], [47.5, "clink", 0.4], [47.7, "clink", 0.4], [50.55, "shimmer", 0.45],
  [57.35, "clink", 0.4], [58.6, "drop", 0.4], [60.4, "timelapse", 0.25], [63.7, "drop", 0.45],
  [68.0, "shimmer", 0.4], [69.95, "pop", 0.45],
];

export const science02 = { id: "Science02", slug: "science02", frames: timeline.frames, component: makeVideo({ slug: "science02", timeline, shots: SHOTS, sfx: SFX }) };
