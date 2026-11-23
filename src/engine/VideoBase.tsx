import React from "react";
import { AbsoluteFill, Audio, Sequence, continueRender, delayRender, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import { PostFX } from "./common";
import { clamp, range, smooth } from "./lib";

/*
 * Generic science-explainer video shell.
 * A video = timeline.json (from tools/timeline.py) + list of shots + list of sound effects.
 * Handles: one ThreeCanvas with synchronous post FX, zoom-blur transitions between
 * "char" and "macro" shots, word-synced subtitles, voice clips, ducked music, SFX.
 */

export const FPS = 30;

export type Timeline = {
  fps: number;
  duration: number;
  frames: number;
  sentences: { i: number; text: string; start: number; speechStart: number; speechEnd: number; words: { w: string; s: number; e: number }[] }[];
  subs: { text: string; s: number; e: number }[];
};
export type Shot = { a: number; b: number; kind: "char" | "macro"; el: (t: number, d: number, gt: number) => React.ReactNode };
export type Sfx = [number, string, number]; // [seconds, name in public/sfx, volume]

// ---------- font (Inter ExtraBold, bundled in public/fonts) ----------
const fontHandle = typeof document !== "undefined" ? delayRender("font") : 0;
if (typeof document !== "undefined") {
  const f = new FontFace("InterX", `url(${staticFile("fonts/Inter-ExtraBold.otf")})`, { weight: "800" });
  f.load().then((ff) => { (document as any).fonts.add(ff); continueRender(fontHandle); }).catch(() => continueRender(fontHandle));
}

// music level: ~10 % under the voice, ~20 % in pauses, soft ramps, fade in/out
function makeMusicVolume(tl: Timeline) {
  const speech = tl.sentences.map((s) => [s.speechStart, s.speechEnd]);
  const total = tl.frames / FPS;
  return (t: number) => {
    let dmin = 1e9;
    for (const [a, b] of speech) dmin = Math.min(dmin, t < a ? a - t : t > b ? t - b : 0);
    const v = 0.1 + 0.1 * smooth(range(dmin, 0.12, 0.55));
    return v * smooth(range(t, 0, 0.8)) * smooth(range(total - t, 0, 1.0));
  };
}

// subtitles: white, bold sans, sentence case, soft dark shadow, centred at 72 % height
const Subtitles: React.FC<{ t: number; tl: Timeline }> = ({ t, tl }) => {
  const subs = tl.subs;
  const cur = subs.find((s, i) => t >= (i === 0 ? 0 : s.s - 0.05) && t < s.e);
  if (!cur) return null;
  const age = cur === subs[0] ? Math.max(1, t) : t - cur.s + 0.05; // first chunk visible on frame 0 (loop)
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

// Remotion advances R3F before children register frame callbacks -> advance again afterwards
const LateAdvance: React.FC<{ frame: number }> = ({ frame }) => {
  const advance = useThree((s) => s.advance);
  React.useEffect(() => { advance(performance.now()); }, [frame, advance]);
  return null;
};

export function makeVideo(opts: { slug: string; timeline: Timeline; shots: Shot[]; sfx: Sfx[]; music?: string }) {
  const { slug, timeline: tl, shots, sfx, music = "musik.mp3" } = opts;
  const musicVolume = makeMusicVolume(tl);
  const Comp: React.FC = () => {
    const frame = useCurrentFrame();
    const { width, height } = useVideoConfig();
    const gt = frame / FPS;
    const idx = Math.max(0, shots.findIndex((s) => gt >= s.a && gt < s.b));
    const sh = shots[idx];
    const t = gt - sh.a;
    const d = sh.b - sh.a;
    const next = shots[idx + 1];
    const prev = shots[idx - 1];
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
        <Subtitles t={gt} tl={tl} />
        {tl.sentences.map((s) => (
          <Sequence key={s.i} from={Math.round(s.start * FPS)} durationInFrames={Math.ceil((s.speechEnd - s.start + 0.6) * FPS)}>
            <Audio src={staticFile(`${slug}/voice/s${String(s.i).padStart(2, "0")}.mp3`)} volume={1} />
          </Sequence>
        ))}
        <Audio src={staticFile(music)} volume={(f) => musicVolume(f / FPS)} />
        {sfx.map(([at, name, vol], i) => (
          <Sequence key={"sfx" + i} from={Math.round(at * FPS)} durationInFrames={45}>
            <Audio src={staticFile(`sfx/${name}.wav`)} volume={vol} />
          </Sequence>
        ))}
      </AbsoluteFill>
    );
  };
  return Comp;
}
