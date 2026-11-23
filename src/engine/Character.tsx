import React, { useMemo } from "react";
import * as THREE from "three";
import { bruiseStops, clamp, easeInOut, lerp, mixColor, range, rng, smooth } from "./lib";

export type Pose = {
  lw: number[]; // left wrist target (screen-right arm, carries the bruise)
  lp: number[]; // left elbow pole
  lu: number[]; // left forearm "up" (where the bruise faces)
  rw: number[];
  rp: number[];
  finger: number; // right index finger extension 0..1
  eyeYaw: number;
  eyePitch: number;
  lid: number; // 1 open, 0 closed
  brow: number; // -1 angry/pain, 0 neutral, 1 raised
  mouth: number; // 0 closed, 1 open
  smile: number;
  head: number[]; // head rotation x,y,z
  body: number[]; // body offset
};

export const P = {
  // forearm resting on the table, pointing at the camera
  rest: { lw: [1.2, -2.52, 1.62], lp: [1.6, -2.0, -1.5], lu: [0, 1, 0], rw: [-1.2, -2.52, 1.62], rp: [-1.6, -2.0, -1.5], finger: 0, eyeYaw: 0, eyePitch: 0, lid: 1, brow: 0, mouth: 0, smile: 0.4, head: [0, 0, 0], body: [0, 0, 0] } as Pose,
};
export const pose = (over: Partial<Pose>): Pose => ({ ...P.rest, ...over });
export const RAISED: Partial<Pose> = { lw: [1.55, -0.95, 1.25], lp: [2.2, -2.2, 0.2], lu: [0.3, 0.2, 1], eyeYaw: 0.35, eyePitch: -0.25, brow: 0.2, smile: 0.5, head: [0.12, 0.25, -0.05] };
export const LOOK: Partial<Pose> = { lw: [0.15, -1.35, 1.75], lp: [1.8, -2.4, 0.6], lu: [0.1, 0.35, 1], eyeYaw: 0.05, eyePitch: -0.4, lid: 1.15, brow: 0.9, mouth: 0.55, smile: 0, head: [0.25, 0.08, 0.05] };

export function blendPose(a: Pose, b: Pose, t: number): Pose {
  const o: any = {};
  for (const k of Object.keys(a)) {
    const va = (a as any)[k], vb = (b as any)[k];
    o[k] = Array.isArray(va) ? va.map((x: number, i: number) => lerp(x, vb[i], t)) : lerp(va, vb, t);
  }
  return o;
}
// keyframes: [time, pose, ease?]
export function animPose(t: number, keys: [number, Pose, ((x: number) => number)?][]): Pose {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 0; i < keys.length - 1; i++) {
    const [ta, pa] = keys[i];
    const [tb, pb, e] = keys[i + 1];
    if (t <= tb) return blendPose(pa, pb, (e ?? easeInOut)((t - ta) / (tb - ta)));
  }
  return keys[keys.length - 1][1];
}

const SH_L = new THREE.Vector3(1.08, -1.55, 0);
const SH_R = new THREE.Vector3(-1.08, -1.55, 0);
const UPPER = 1.05;
const FORE = 1.2;

export function solveArm(S: THREE.Vector3, W: THREE.Vector3, pole: THREE.Vector3) {
  const d0 = W.clone().sub(S);
  const d = Math.min(d0.length(), UPPER + FORE - 0.01);
  const dir = d0.clone().normalize();
  const cosA = clamp((UPPER * UPPER + d * d - FORE * FORE) / (2 * UPPER * d), -1, 1);
  const sinA = Math.sqrt(1 - cosA * cosA);
  const pv = pole.clone().sub(S);
  const perp = pv.sub(dir.clone().multiplyScalar(pv.dot(dir))).normalize();
  const E = S.clone().add(dir.clone().multiplyScalar(UPPER * cosA)).add(perp.multiplyScalar(UPPER * sinA));
  const Wc = S.clone().add(dir.multiplyScalar(d));
  return { E, W: Wc };
}

// hand position + forearm direction (for props held in the hand). side "l" = screen-right arm
export function handFrame(p: Pose, side: "l" | "r" = "l") {
  const S = side === "l" ? SH_L : SH_R;
  const { E, W } = solveArm(S, new THREE.Vector3(...(side === "l" ? p.lw : p.rw)), new THREE.Vector3(...(side === "l" ? p.lp : p.rp)));
  const dir = W.clone().sub(E).normalize();
  return { hand: W.clone().add(dir.clone().multiplyScalar(0.2)), dir, elbow: E, wrist: W };
}

// world-space point on the bruise (used for camera targets & ice/finger placement)
export const BRUISE_ALONG = 0.62; // fraction from elbow to wrist
export function bruisePoint(p: Pose) {
  const { E, W } = solveArm(SH_L, new THREE.Vector3(...p.lw), new THREE.Vector3(...p.lp));
  const axis = W.clone().sub(E).normalize();
  const up = new THREE.Vector3(...p.lu);
  up.sub(axis.clone().multiplyScalar(up.dot(axis))).normalize();
  const c = E.clone().lerp(W, BRUISE_ALONG).add(up.clone().multiplyScalar(0.27));
  return { point: c, normal: up, axis };
}

const SKIN = "#f4b089";

function useMats() {
  return useMemo(() => {
    const skin = new THREE.MeshStandardMaterial({ color: SKIN, roughness: 0.55, emissive: new THREE.Color("#7a2d1a"), emissiveIntensity: 0.12 });
    const shirt = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.75 });
    const stripe = new THREE.MeshStandardMaterial({ color: "#19c3c9", roughness: 0.6 });
    const grey = new THREE.MeshStandardMaterial({ color: "#c9c9d2", roughness: 0.9 });
    const white = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.15 });
    const iris = new THREE.MeshStandardMaterial({ color: "#3c7bd9", roughness: 0.2, emissive: new THREE.Color("#0b2a66"), emissiveIntensity: 0.4 });
    const pupil = new THREE.MeshStandardMaterial({ color: "#0a0a12", roughness: 0.1 });
    const shine = new THREE.MeshBasicMaterial({ color: "#ffffff" });
    const mouth = new THREE.MeshStandardMaterial({ color: "#5a1420", roughness: 0.6 });
    const blush = new THREE.MeshStandardMaterial({ color: "#ff7a8a", roughness: 0.8, transparent: true, opacity: 0.35 });
    const table = new THREE.MeshStandardMaterial({ color: "#ff8fb8", roughness: 0.45 });
    const tableTop = new THREE.MeshStandardMaterial({ color: "#ffd6e6", roughness: 0.35 });
    return { skin, shirt, stripe, grey, white, iris, pupil, shine, mouth, blush, table, tableTop };
  }, []);
}

// forearm texture with bruise painted on
function drawBruise(ctx: CanvasRenderingContext2D, stage: number, size: number) {
  const W = ctx.canvas.width, H = ctx.canvas.height;
  ctx.fillStyle = SKIN;
  ctx.fillRect(0, 0, W, H);
  if (stage <= 0.001 || stage >= 0.999) return;
  const cx = W * 0.5, cy = H * (1 - (1 - BRUISE_ALONG));
  const fade = range(stage, 0, 0.06) * (1 - range(stage, 0.86, 0.99));
  const spread = 1 + range(stage, 0.1, 0.5) * 0.35;
  const sunset = smooth(range(stage, 0.32, 0.62));
  const layers = [
    { r: 1.0, c: mixColor(bruiseStops, Math.min(0.92, stage + 0.33 * sunset)), a: 0.55 },
    { r: 0.72, c: mixColor(bruiseStops, Math.min(0.92, stage + 0.18 * sunset)), a: 0.75 },
    { r: 0.45, c: mixColor(bruiseStops, stage), a: 0.9 },
  ];
  const R = 95 * size * spread;
  const r = rng(11);
  for (const L of layers) {
    for (let k = 0; k < 7; k++) {
      const ox = (r() - 0.5) * R * 0.5, oy = (r() - 0.5) * R * 0.5;
      const rr = R * L.r * (0.7 + r() * 0.4);
      const g = ctx.createRadialGradient(cx + ox, cy + oy, 0, cx + ox, cy + oy, rr);
      const col = `rgba(${Math.round(L.c.r * 255)},${Math.round(L.c.g * 255)},${Math.round(L.c.b * 255)},`;
      g.addColorStop(0, col + (L.a * fade * 0.55).toFixed(3) + ")");
      g.addColorStop(0.6, col + (L.a * fade * 0.35).toFixed(3) + ")");
      g.addColorStop(1, col + "0)");
      ctx.fillStyle = g;
      ctx.save();
      ctx.translate(cx + ox, cy + oy);
      ctx.scale(0.62, 1); // circumference is longer than the arm segment
      ctx.translate(-(cx + ox), -(cy + oy));
      ctx.beginPath();
      ctx.arc(cx + ox, cy + oy, rr, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}

function useForearmTexture(stage: number, size: number) {
  const q = Math.round(stage * 200) / 200;
  const qs = Math.round(size * 40) / 40;
  return useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 512;
    drawBruise(c.getContext("2d")!, q, qs);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  }, [q, qs]);
}

const Bone: React.FC<{ a: THREE.Vector3; b: THREE.Vector3; r: number; mat: THREE.Material; up?: THREE.Vector3; open?: boolean }> = ({ a, b, r, mat, up, open }) => {
  const len = a.distanceTo(b);
  const mid = a.clone().add(b).multiplyScalar(0.5);
  const y = a.clone().sub(b).normalize(); // +Y towards a (elbow)
  let z = (up ?? new THREE.Vector3(0, 0, 1)).clone();
  z.sub(y.clone().multiplyScalar(z.dot(y)));
  if (z.lengthSq() < 1e-6) z = new THREE.Vector3(1, 0, 0);
  z.normalize();
  const x = new THREE.Vector3().crossVectors(y, z);
  const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
  return (
    <group position={mid} quaternion={q}>
      <mesh material={mat}>
        {open ? <cylinderGeometry args={[r, r * 1.08, len, 48, 1, true, -Math.PI, Math.PI * 2]} /> : <capsuleGeometry args={[r, len, 8, 24]} />}
      </mesh>
    </group>
  );
};

export const Character: React.FC<{ p: Pose; t: number; bruise?: number; bruiseSize?: number; squash?: number; ice?: number; pressDepth?: number; table?: boolean; children?: React.ReactNode }> = ({
  p, t, bruise = 0, bruiseSize = 1, squash = 0, ice = 0, pressDepth = 0, table = true, children,
}) => {
  const m = useMats();
  const tex = useForearmTexture(bruise, bruiseSize);
  const foreMat = useMemo(() => new THREE.MeshStandardMaterial({ roughness: 0.55, emissive: new THREE.Color("#7a2d1a"), emissiveIntensity: 0.12 }), []);
  foreMat.map = tex;
  foreMat.needsUpdate = true;

  const L = solveArm(SH_L, new THREE.Vector3(...p.lw), new THREE.Vector3(...p.lp));
  const R = solveArm(SH_R, new THREE.Vector3(...p.rw), new THREE.Vector3(...p.rp));
  const lUp = new THREE.Vector3(...p.lu);
  const lDir = L.W.clone().sub(L.E).normalize();
  const rDir = R.W.clone().sub(R.E).normalize();
  const lHand = L.W.clone().add(lDir.clone().multiplyScalar(0.2));
  const rHand = R.W.clone().add(rDir.clone().multiplyScalar(0.2));

  // blinking
  const blinkT = (t + 0.7) % 3.1;
  const blink = blinkT < 0.14 ? Math.sin((blinkT / 0.14) * Math.PI) : 0;
  const lid = clamp(p.lid * (1 - blink), 0, 1.2);
  const breathe = Math.sin(t * 2.2) * 0.03;

  const eye = (sx: number) => (
    <group position={[sx * 0.37, 0.2, 0.74]}>
      <mesh material={m.white} scale={[1, 1.08, 0.9]}>
        <sphereGeometry args={[0.32, 32, 24]} />
      </mesh>
      <group rotation={[p.eyePitch, p.eyeYaw, 0]}>
        <mesh material={m.iris} position={[0, 0, 0.215]} scale={[1, 1, 0.55]}>
          <sphereGeometry args={[0.19, 32, 16]} />
        </mesh>
        <mesh material={m.pupil} position={[0, 0, 0.3]} scale={[1, 1, 0.4]}>
          <sphereGeometry args={[0.1 + 0.02 * (1 - Math.min(1, p.lid)), 24, 12]} />
        </mesh>
        <mesh material={m.shine} position={[0.06, 0.07, 0.34]}>
          <sphereGeometry args={[0.04, 12, 8]} />
        </mesh>
      </group>
      {/* upper lid: skin cap that rotates down */}
      <group rotation={[lerp(-1.75, 0.15, clamp(1 - lid)) - (lid > 1 ? (lid - 1) * 1.5 : 0), 0, sx * -0.05]}>
        <mesh material={m.skin} scale={[1.04, 1.12, 0.96]}>
          <sphereGeometry args={[0.335, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
        </mesh>
      </group>
      {/* lower lid */}
      <group rotation={[Math.PI + 1.45 - (lid < 0.4 ? (0.4 - lid) * 1.2 : 0), 0, 0]}>
        <mesh material={m.skin} scale={[1.04, 1.12, 0.96]}>
          <sphereGeometry args={[0.335, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
        </mesh>
      </group>
      {/* brow */}
      <mesh material={m.grey} position={[sx * 0.02, 0.45 + p.brow * 0.08, 0.2]} rotation={[0.2, 0, Math.PI / 2 + sx * (0.05 - p.brow * 0.2)]}>
        <capsuleGeometry args={[0.075, 0.3, 6, 12]} />
      </mesh>
    </group>
  );

  return (
    <group position={p.body as any}>
      {/* torso: sleeveless shirt */}
      <group position={[0, -2.35 + breathe * 0.3, -0.1]} scale={[1 + squash * 0.04, 1 - squash * 0.03, 1]}>
        <mesh material={m.shirt} scale={[1.05, 1, 0.75]}>
          <capsuleGeometry args={[0.95, 1.3, 12, 32]} />
        </mesh>
        <mesh material={m.stripe} position={[0, 0.35, 0]} scale={[1.06, 1, 0.76]}>
          <cylinderGeometry args={[0.97, 0.97, 0.16, 48, 1, true]} />
        </mesh>
        {/* neckline + armholes in skin */}
        <mesh material={m.skin} position={[0, 1.18, 0.05]} scale={[1, 0.55, 0.8]}>
          <sphereGeometry args={[0.6, 32, 16]} />
        </mesh>
      </group>
      {/* shoulders */}
      <mesh material={m.skin} position={SH_L}>
        <sphereGeometry args={[0.4, 32, 16]} />
      </mesh>
      <mesh material={m.skin} position={SH_R}>
        <sphereGeometry args={[0.4, 32, 16]} />
      </mesh>
      {/* neck */}
      <mesh material={m.skin} position={[0, -0.95, 0]}>
        <cylinderGeometry args={[0.38, 0.45, 0.7, 24]} />
      </mesh>
      {/* head */}
      <group position={[0, 0.05 + breathe, 0]} rotation={p.head as any}>
        <mesh material={m.skin} scale={[0.98, 1.05, 0.95]}>
          <sphereGeometry args={[1, 64, 48]} />
        </mesh>
        {/* jaw */}
        <mesh material={m.skin} position={[0, -0.42, 0.12]} scale={[0.82, 0.6, 0.78]}>
          <sphereGeometry args={[1, 48, 32]} />
        </mesh>
        {/* ears */}
        {[-1, 1].map((s) => (
          <mesh key={s} material={m.skin} position={[s * 0.97, 0.0, -0.05]} scale={[0.45, 1, 0.75]}>
            <sphereGeometry args={[0.26, 24, 16]} />
          </mesh>
        ))}
        {/* grey hair on the sides, bald top */}
        {[-1, 1].map((s) => (
          <mesh key={s} material={m.grey} position={[s * 0.72, 0.2, -0.35]} scale={[0.42, 0.62, 0.7]}>
            <sphereGeometry args={[1, 32, 24]} />
          </mesh>
        ))}
        <mesh material={m.grey} position={[0, 0.22, -0.7]} scale={[0.85, 0.6, 0.45]}>
          <sphereGeometry args={[1, 32, 24]} />
        </mesh>
        {/* cheeks */}
        {[-1, 1].map((s) => (
          <mesh key={s} material={m.blush} position={[s * 0.55, -0.25, 0.72]} scale={[1, 0.7, 0.5]}>
            <sphereGeometry args={[0.2, 16, 12]} />
          </mesh>
        ))}
        {eye(-1)}
        {eye(1)}
        {/* nose */}
        <mesh material={m.skin} position={[0, -0.18, 1.0]} scale={[1, 0.95, 1]}>
          <sphereGeometry args={[0.24, 32, 24]} />
        </mesh>
        {/* mouth */}
        <mesh material={m.mouth} position={[0, -0.62 - p.mouth * 0.04, 0.83]} scale={[0.22 + p.smile * 0.08 - p.mouth * 0.06, 0.03 + p.mouth * 0.13, 0.08]}>
          <sphereGeometry args={[1, 24, 16]} />
        </mesh>
        {/* grey moustache: two bushy lobes */}
        {[-1, 1].map((s) => (
          <group key={s} position={[s * 0.24, -0.43, 0.93]} rotation={[0.1, s * 0.35, s * (0.28 - p.smile * 0.12)]}>
            <mesh material={m.grey} scale={[0.34, 0.14, 0.16]}>
              <sphereGeometry args={[1, 32, 16]} />
            </mesh>
            <mesh material={m.grey} position={[s * 0.18, -0.06, -0.03]} scale={[0.2, 0.1, 0.12]}>
              <sphereGeometry args={[1, 24, 12]} />
            </mesh>
          </group>
        ))}
      </group>
      {/* left arm (bruise arm) */}
      <Bone a={SH_L} b={L.E} r={0.31} mat={m.skin} />
      <mesh material={m.skin} position={L.E}>
        <sphereGeometry args={[0.29, 24, 16]} />
      </mesh>
      <Bone a={L.E} b={L.W} r={0.27} mat={foreMat} up={lUp} open />
      <group position={lHand} quaternion={new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), lDir)}>
        <mesh material={m.skin} scale={[1.05, 1.15, 0.8]}>
          <sphereGeometry args={[0.3, 32, 16]} />
        </mesh>
        <mesh material={m.skin} position={[0.24, -0.02, 0.1]} scale={[0.5, 0.8, 0.5]}>
          <sphereGeometry args={[0.2, 16, 12]} />
        </mesh>
      </group>
      {/* right arm */}
      <Bone a={SH_R} b={R.E} r={0.31} mat={m.skin} />
      <mesh material={m.skin} position={R.E}>
        <sphereGeometry args={[0.29, 24, 16]} />
      </mesh>
      <Bone a={R.E} b={R.W} r={0.27} mat={m.skin} />
      <group position={rHand} quaternion={new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), rDir)}>
        <mesh material={m.skin} scale={[1.05, 1.15, 0.8]}>
          <sphereGeometry args={[0.3, 32, 16]} />
        </mesh>
        <mesh material={m.skin} position={[0, 0.2 + p.finger * 0.22, 0.05]} scale={[1, 1 + p.finger * 1.2, 1]}>
          <capsuleGeometry args={[0.085, 0.18, 6, 12]} />
        </mesh>
      </group>
      {/* table */}
      {table && <group position={[0, -2.95, 0.6]}>
        <mesh material={m.tableTop} position={[0, 0.12, 0]}>
          <boxGeometry args={[7, 0.06, 2.4]} />
        </mesh>
        <mesh material={m.table}>
          <boxGeometry args={[7, 0.2, 2.4]} />
        </mesh>
        <mesh material={m.table} position={[0, -0.1, 1.2]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.1, 0.1, 7, 16]} />
        </mesh>
      </group>}
      {ice > 0 && <IcePack p={p} ice={ice} t={t} />}
      {children}
    </group>
  );
};

const IcePack: React.FC<{ p: Pose; ice: number; t: number }> = ({ p, ice, t }) => {
  const b = bruisePoint(p);
  const drop = (1 - easeInOut(ice)) * 2.2;
  const pos = b.point.clone().add(b.normal.clone().multiplyScalar(0.2 + drop));
  const mat = useMemo(() => new THREE.MeshPhysicalMaterial({ color: "#bdf3ff", roughness: 0.08, transmission: 0, transparent: true, opacity: 0.72, clearcoat: 1, emissive: new THREE.Color("#3fd6ff"), emissiveIntensity: 0.35 }), []);
  const cubes = [
    [0, 0, 0, 0.3],
    [0.33, 0.05, 0.15, 0.6],
    [-0.3, 0.04, -0.12, 1.1],
  ];
  return (
    <group position={pos}>
      {cubes.map(([x, y, z, r], i) => (
        <mesh key={i} material={mat} position={[x, y + Math.sin(t * 3 + i) * 0.01, z]} rotation={[r * 0.3, r, r * 0.2]}>
          <boxGeometry args={[0.32, 0.32, 0.32]} />
        </mesh>
      ))}
    </group>
  );
};
