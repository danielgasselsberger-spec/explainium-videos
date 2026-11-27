// Aufruf: node render.js <timing.json> <voice.wav> <out.mp4> [--preview t1,t2,...] 
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs'), path = require('path');
const [timingPath, voicePath, outPath] = process.argv.slice(2);
const pi = process.argv.indexOf('--preview');
const FPS = 30;
(async () => {
  const timing = JSON.parse(fs.readFileSync(timingPath, 'utf8'));
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  await page.goto('file://' + path.resolve(__dirname, 'scene.html'));
  await page.evaluate(tm => window.setTiming(tm), timing);
  await page.evaluate(() => document.fonts.ready);
  if (pi > 0) {
    const ts = process.argv[pi + 1].split(',').map(Number);
    for (const t of ts) {
      await page.evaluate(t => window.renderAt(t), t);
      await page.screenshot({ path: `${outPath}_${t.toFixed(2)}.jpg`, type: 'jpeg', quality: 85 });
    }
    await browser.close(); return;
  }
  const n = Math.ceil(timing.duration * FPS);
  const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-i', voicePath, '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p', '-r', String(FPS),
    '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', outPath], { stdio: ['pipe', 'inherit', 'inherit'] });
  for (let i = 0; i < n; i++) {
    await page.evaluate(t => window.renderAt(t), i / FPS);
    const buf = await page.screenshot({ type: 'jpeg', quality: 93 });
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if (i % 150 === 0) console.log(`frame ${i}/${n}`);
  }
  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
  await browser.close();
  console.log('fertig', outPath);
})();
