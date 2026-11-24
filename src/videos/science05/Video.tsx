// "How an Engine Works" — made with the /video skill
import { FPS, Shot, Sfx, Timeline, makeVideo } from "../../engine/VideoBase";
import timelineJson from "./timeline.json";
import { SHOTS as SHOT_LIST, SFX as SFX_LIST } from "./Engine";

const timeline = timelineJson as Timeline;
export const SHOTS = SHOT_LIST as Shot[];
export const SFX = SFX_LIST as Sfx[];
export const science05 = { id: "Science05", slug: "science05", frames: timeline.frames, component: makeVideo({ slug: "science05", timeline, shots: SHOTS, sfx: SFX }) };
