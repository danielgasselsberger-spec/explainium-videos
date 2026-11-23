// usage: node tools/stills.mjs scale frame1 frame2 ...   -> stills/fNNNN.jpg + stills/sheet.jpg
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition, openBrowser } from "@remotion/renderer";
import path from "node:path";
import { execSync } from "node:child_process";
const [scale, ...frames] = process.argv.slice(2);
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts") });
const browserExecutable = "/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";
const chromiumOptions = { gl: "swangle" };
const browser = await openBrowser("chrome", { browserExecutable, chromiumOptions });
const composition = await selectComposition({ serveUrl, id: "Science01", puppeteerInstance: browser, chromiumOptions });
const outs = [];
const queue = frames.map(Number);
const work = async () => {
  while (queue.length) {
    const f = queue.shift();
    const output = `stills/f${String(f).padStart(4, "0")}.jpg`;
    const t0 = Date.now();
    await renderStill({ serveUrl, composition, frame: f, output, scale: Number(scale), imageFormat: "jpeg", jpegQuality: 85, puppeteerInstance: browser, chromiumOptions,
      onBrowserLog: (l) => { if (l.type === "error") console.log("LOG", l.text.slice(0, 300)); } });
    console.log(output, Date.now() - t0, "ms");
    outs.push(output);
  }
};
await Promise.all([work(), work()]);
await browser.close({ silent: true });
outs.sort();
if (outs.length > 1) {
  const n = outs.length, cols = Math.min(n, 4);
  execSync(`ffmpeg -y -loglevel error ${outs.map((o) => `-i ${o}`).join(" ")} -filter_complex "${outs.map((_, i) => `[${i}]scale=270:480,drawtext=text='${outs[i].slice(8, 13)}':x=8:y=8:fontsize=22:fontcolor=yellow:box=1:boxcolor=black[v${i}]`).join(";")};${outs.map((_, i) => `[v${i}]`).join("")}xstack=inputs=${n}:layout=${outs.map((_, i) => `${(i % cols) * 270}_${Math.floor(i / cols) * 480}`).join("|")}:fill=black" stills/sheet.jpg`);
}
