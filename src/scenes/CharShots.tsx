import React from "react";
import * as THREE from "three";
import { Character, LOOK, P, Pose, RAISED, animPose, bruisePoint, pose } from "./Character";
import { Cam, Post, StudioLights } from "./common";
import { Backdrop, Glow } from "./prims";
import { clamp, easeIn, easeInOut, easeOut, lerp, lerpV, range, smooth } from "../lib";

// ---------- global bruise stage over the whole video ----------
export function bruiseAt(gt: number) {
  if (gt < 0.62) return 0;
  if (gt < 1.4) return lerp(0.02, 0.12, easeOut(range(gt, 0.62, 1.4)));
  if (gt < 30.4) return lerp(0.12, 0.15, range(gt, 1.4, 30));
  if (gt < 32.1) return lerp(0.15, 0.4, easeInOut(range(gt, 30.4, 32.0)));
  if (gt < 44.6) return 0.4;
  if (gt < 46.3) return lerp(0.4, 0.62, easeInOut(range(gt, 44.6, 46.2)));
  if (gt < 60.3) return 0.62;
  return 1;
}

const Stage: React.FC<{ children: React.ReactNode; top?: string; bottom?: string; focus: number; bokeh?: number; dim?: number; extra?: React.ReactNode }> = ({
  children, top = "#cdeeff", bottom = "#5fb8f0", focus, bokeh = 4, dim = 1,
}) => (
  <>
    <Backdrop top={top} bottom={bottom} />
    <StudioLights dim={dim} />
    {children}
    <Post focus={focus} bokeh={bokeh} bloom={0.55} />
  </>
);

const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
function shot(cam: { pos: number[]; target: number[]; fov?: number }, t: number, shake = 0) {
  return { cam: <Cam {...cam} shake={shake} t={t} />, focus: dist(cam.pos, cam.target) };
}

// ---------------------------------------------------------------------------
// Shot 1 (and loop target): hit the arm on the table
export const LOOP_CAM = { pos: [2.9, -0.4, 6.6], target: [0.55, -1.25, 0.7], fov: 42 };
export const RAISED_POSE = pose(RAISED);
export const HIT_END = { pos: [2.3, -0.5, 5.3], target: [0.75, -1.5, 0.9], fov: 40 };

export const HitShot: React.FC<{ t: number; gt: number }> = ({ t, gt }) => {
  const impact = 0.6;
  const windup = pose({ ...RAISED, lw: [1.6, -0.75, 1.05], brow: 0.5, smile: 0.7 });
  const pain = pose({ eyeYaw: 0.1, eyePitch: -0.1, lid: 0.12, brow: -1, mouth: 0.9, smile: 0, head: [0.05, -0.15, 0.12], body: [0, -0.06, 0] });
  const p = animPose(t, [
    [0, RAISED_POSE],
    [0.34, windup],
    [impact, { ...pain, lid: 0.9, brow: 0.6, mouth: 0.4 }, easeIn],
    [impact + 0.12, pain],
    [1.5, { ...pain, lid: 0.25, mouth: 0.75 }],
  ]);
  // slight bounce of the forearm after the impact
  const bounce = t > impact ? Math.sin((t - impact) * 22) * Math.exp(-(t - impact) * 9) * 0.12 : 0;
  p.lw = [p.lw[0], p.lw[1] + Math.abs(bounce), p.lw[2]];
  const k = easeInOut(range(t, 0, 1.55));
  const cam = {
    pos: lerpV(LOOP_CAM.pos, HIT_END.pos, k),
    target: lerpV(LOOP_CAM.target, HIT_END.target, k),
    fov: lerp(LOOP_CAM.fov, HIT_END.fov, k),
  };
  const shake = t > impact ? 0.12 * Math.exp(-(t - impact) * 7) : 0;
  const { cam: c, focus } = shot(cam, t, shake);
  const b = bruisePoint(p);
  const fl = t > impact ? Math.exp(-(t - impact) * 6) : 0;
  return (
    <Stage focus={focus * 0.92}>
      {c}
      <Character p={p} t={gt} bruise={bruiseAt(gt)} squash={fl} />
      {fl > 0.01 && (
        <>
          <Glow position={b.point.clone().add(b.normal.clone().multiplyScalar(0.1))} scale={0.6 + (1 - fl) * 2.2} color="#ffffff" opacity={fl * 0.9} />
          <Glow position={b.point} scale={1.2 + (1 - fl) * 1.5} color="#ff3d7f" opacity={fl} />
          <ImpactLines center={b.point} k={1 - fl} />
        </>
      )}
    </Stage>
  );
};

const ImpactLines: React.FC<{ center: THREE.Vector3; k: number }> = ({ center, k }) => (
  <group position={center}>
    {Array.from({ length: 9 }, (_, i) => {
      const a = (i / 9) * Math.PI * 2 + 0.3;
      const r = 0.35 + k * 1.1;
      return (
        <mesh key={i} position={[Math.cos(a) * r, 0.15 + Math.sin(a) * r * 0.6, Math.sin(a) * 0.2]} rotation={[0, 0, a + Math.PI / 2]}>
          <capsuleGeometry args={[0.03 * (1 - k), 0.25 * (1 - k * 0.6), 4, 8]} />
          <meshBasicMaterial color="#fff3a0" toneMapped={false} transparent opacity={1 - k} />
        </mesh>
      );
    })}
  </group>
);

// zoom into the bruise (transition shot), pose fixed
export const ZoomIntoArm: React.FC<{ t: number; d: number; gt: number; p: Pose; from: { pos: number[]; target: number[]; fov?: number }; top?: string; bottom?: string; press?: number }> = ({
  t, d, gt, p, from, top, bottom,
}) => {
  const b = bruisePoint(p);
  const end = b.point.clone().add(b.normal.clone().multiplyScalar(0.28));
  const k = easeIn(range(t, 0, d));
  const k2 = easeInOut(range(t, 0, d));
  const tgt = lerpV(from.target, b.point.toArray(), k2);
  const pos = lerpV(from.pos, end.toArray(), k);
  const { cam: c } = shot({ pos, target: tgt, fov: lerp(from.fov ?? 34, 26, k) }, t);
  return (
    <Stage focus={dist(pos, b.point.toArray())} top={top} bottom={bottom} bokeh={3}>
      {c}
      <Character p={p} t={gt} bruise={bruiseAt(gt)} />
    </Stage>
  );
};

// generic "hold pose and move camera" shot
export const ArmShot: React.FC<{
  t: number; d: number; gt: number; p: Pose | ((t: number) => Pose);
  cam: (k: number, b: ReturnType<typeof bruisePoint>) => { pos: number[]; target: number[]; fov?: number };
  top?: string; bottom?: string; ice?: number | ((t: number) => number); dim?: number; children?: React.ReactNode; focusOn?: "arm" | "target";
}> = ({ t, d, gt, p, cam, top, bottom, ice, dim, children }) => {
  const pp = typeof p === "function" ? p(t) : p;
  const b = bruisePoint(pp);
  const cs = cam(easeInOut(range(t, 0, d)), b);
  const { cam: c, focus } = shot(cs, t);
  return (
    <Stage focus={focus} top={top} bottom={bottom} dim={dim}>
      {c}
      <Character p={pp} t={gt} bruise={bruiseAt(gt)} ice={typeof ice === "function" ? ice(t) : ice} />
      {children}
    </Stage>
  );
};

export const LOOK_POSE = pose(LOOK);
export const REST = P.rest;

// time-lapse shot: day/night cycling backdrop, sun & moon sweeping
export const TimeLapse: React.FC<{ t: number; d: number; gt: number; cycles?: number }> = ({ t, d, gt, cycles = 2 }) => {
  const k = range(t, 0.15, d - 0.25);
  const ph = k * cycles; // 0..cycles
  const night = smooth(Math.max(0, Math.sin(ph * Math.PI * 2 - Math.PI / 2) * 0.5 + 0.5) * 1.0);
  const top = new THREE.Color("#cdeeff").lerp(new THREE.Color("#2a1f6e"), night * 0.85);
  const bottom = new THREE.Color("#5fb8f0").lerp(new THREE.Color("#7a2a8a"), night * 0.85);
  const p = pose({
    eyeYaw: Math.sin(t * 5) * 0.35, eyePitch: 0.15 + Math.sin(t * 3) * 0.1, brow: 0.3, smile: 0.2, lid: 0.85 - night * 0.3,
    head: [-0.05 + Math.sin(t * 4) * 0.03, Math.sin(t * 2.5) * 0.15, Math.sin(t * 5) * 0.06],
  });
  const a = ph * Math.PI * 2;
  const sunPos = [Math.cos(a - Math.PI / 2) * -9, -2 + Math.sin(a - Math.PI / 2) * -6, -14];
  const moonPos = [-sunPos[0], -4 - (sunPos[1] + 2), -14];
  const kc = easeInOut(range(t, 0, d));
  const cam = { pos: [lerp(-3.2, 2.8, kc), lerp(0.2, 0.6, kc), lerp(10.5, 9.8, kc)], target: [0.3, -1.3, 0.5], fov: 44 };
  const { cam: c, focus } = shot(cam, t);
  return (
    <Stage focus={focus} top={"#" + top.getHexString()} bottom={"#" + bottom.getHexString()} dim={1 - night * 0.35} bokeh={2}>
      {c}
      <Character p={p} t={gt} bruise={bruiseAt(gt)} />
      <mesh position={sunPos as any}>
        <sphereGeometry args={[1.1, 32, 16]} />
        <meshBasicMaterial color="#ffd23f" toneMapped={false} />
      </mesh>
      <Glow position={sunPos} scale={6} color="#ffb03f" opacity={0.8} />
      <mesh position={moonPos as any}>
        <sphereGeometry args={[0.8, 32, 16]} />
        <meshBasicMaterial color="#f4f0ff" toneMapped={false} />
      </mesh>
      <Glow position={moonPos} scale={4} color="#b9a8ff" opacity={0.7} />
    </Stage>
  );
};

// pressing on the bruise with the right index finger
export const PressShot: React.FC<{ t: number; d: number; gt: number }> = ({ t, d, gt }) => {
  const base = REST;
  const b = bruisePoint(base);
  const tip = b.point.clone().add(b.normal.clone().multiplyScalar(0.06));
  const S = new THREE.Vector3(-1.08, -1.55, 0);
  const dir = tip.clone().sub(S).normalize();
  const reach = tip.clone().sub(dir.clone().multiplyScalar(0.2 + 0.62)); // wrist position for the fingertip to touch
  const hover = reach.clone().add(new THREE.Vector3(-0.25, 0.55, 0.1));
  const press = reach.clone().add(dir.clone().multiplyScalar(0.06)).add(new THREE.Vector3(0, -0.05, 0));
  const pain = { lid: 0.15, brow: -1, mouth: 0.85, smile: 0, head: [0.08, 0.2, 0.15], eyePitch: -0.2, eyeYaw: 0.3 };
  const pHover = pose({ rw: hover.toArray(), rp: [-1.8, -2.6, 0.5], finger: 1, eyeYaw: 0.3, eyePitch: -0.4, brow: 0.4, head: [0.2, 0.15, 0], smile: 0.2 });
  const pPress = pose({ ...pHover, rw: press.toArray(), ...pain });
  const p = animPose(t, [
    [0, pose({ finger: 0.3, eyePitch: -0.4, eyeYaw: 0.3, head: [0.2, 0.1, 0] })],
    [0.22, pHover],
    [0.42, pPress, easeIn],
    [d, { ...pPress, lid: 0.25 }],
  ]);
  const hit = t > 0.42 ? Math.exp(-(t - 0.42) * 4) : 0;
  const kc = easeInOut(range(t, 0, d));
  const cam = { pos: [lerp(3.8, 2.9, kc), lerp(0.6, 0.0, kc), lerp(6.0, 5.0, kc)], target: [0.4, -1.5, 1.0], fov: 42 };
  const { cam: c, focus } = shot(cam, t, hit * 0.05);
  return (
    <Stage focus={focus}>
      {c}
      <Character p={p} t={gt} bruise={bruiseAt(gt)} />
      {t > 0.42 &&
        [0, 0.25, 0.5].map((o, i) => {
          const k = ((t - 0.42 + o) % 0.75) / 0.75;
          return <Glow key={i} position={b.point} scale={0.4 + k * 2.4} color="#ff2d6f" opacity={(1 - k) * 0.9} />;
        })}
    </Stage>
  );
};

// final shots: arm healed, then raise into the loop pose
export const HealedShot: React.FC<{ t: number; d: number; gt: number }> = ({ t, d, gt }) => {
  const p = animPose(t, [
    [0, pose({ ...LOOK, lid: 1.1, brow: 0.6, mouth: 0.3, smile: 0.3 })],
    [0.9, pose({ ...LOOK, lid: 1, brow: 0.8, mouth: 0, smile: 1, eyePitch: -0.3 })],
    [d, pose({ ...LOOK, lw: [0.3, -1.4, 1.7], eyePitch: 0.05, eyeYaw: 0, lid: 1, brow: 0.5, smile: 1, head: [0, 0, 0.05] })],
  ]);
  const kc = easeInOut(range(t, 0, d));
  const cam = { pos: [lerp(1.6, 1.0, kc), lerp(-0.4, -0.3, kc), lerp(6.0, 7.0, kc)], target: [0.3, -1.0, 0.8], fov: 42 };
  const { cam: c, focus } = shot(cam, t);
  return (
    <Stage focus={focus}>
      {c}
      <Character p={p} t={gt} bruise={1} />
      {[0, 1, 2, 3].map((i) => {
        const k = clamp((t - 0.2 - i * 0.15) / 0.8);
        const b = bruisePoint(p).point;
        return <Glow key={i} position={[b.x + Math.cos(i * 1.7) * 0.6 * k, b.y + 0.3 + k * 0.5, b.z + Math.sin(i * 1.7) * 0.3]} scale={0.35} color="#fff6b0" opacity={Math.sin(k * Math.PI)} />;
      })}
    </Stage>
  );
};

export const RaiseLoop: React.FC<{ t: number; d: number; gt: number }> = ({ t, d, gt }) => {
  const start = pose({ ...LOOK, lw: [0.3, -1.4, 1.7], eyePitch: 0.05, eyeYaw: 0, lid: 1, brow: 0.5, smile: 1, head: [0, 0, 0.05] });
  const p = animPose(t, [
    [0, start],
    [0.5, pose({ eyeYaw: 0, eyePitch: 0, brow: 0.6, smile: 0.8, head: [0, 0.1, 0] })],
    [d, RAISED_POSE],
  ]);
  const kc = easeInOut(range(t, 0, d));
  const cam = { pos: lerpV([1.0, -0.3, 7.0], LOOP_CAM.pos, kc), target: lerpV([0.3, -1.0, 0.8], LOOP_CAM.target, kc), fov: lerp(42, LOOP_CAM.fov, kc) };
  const { cam: c, focus } = shot(cam, t);
  // focus must match HitShot's first frame at the very end
  const hitFocus = dist(LOOP_CAM.pos, LOOP_CAM.target) * 0.92;
  return (
    <Stage focus={lerp(focus, hitFocus, kc)}>
      {c}
      <Character p={p} t={gt} bruise={0} />
    </Stage>
  );
};
