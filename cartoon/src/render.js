const {chromium}=require('playwright');const http=require('http');const fs=require('fs');const path=require('path');const {spawn}=require('child_process');
const root=path.join(__dirname,'web');
const mime={'.html':'text/html','.js':'text/javascript','.json':'application/json','.ttf':'font/ttf'};
const srv=http.createServer((q,r)=>{const f=path.join(root,decodeURIComponent(q.url.split('?')[0])==='/'?'index.html':decodeURIComponent(q.url.split('?')[0]));
  fs.readFile(f,(e,d)=>{if(e){r.writeHead(404);r.end();return;}r.writeHead(200,{'Content-Type':mime[path.extname(f)]||'application/octet-stream'});r.end(d);});}).listen(8765);
(async()=>{
  const mode=process.argv[2]; // "stills" or "video"
  const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
  const p=await b.newPage({viewport:{width:1080,height:1920}});
  p.on('console',m=>console.log('PAGE',m.text()));p.on('pageerror',e=>console.log('ERR',e.message));
  await p.goto('http://localhost:8765/');await p.waitForFunction('window.ready===true',null,{timeout:60000});
  const dur=await p.evaluate('window.DUR');
  if(mode==='stills'){const ts=process.argv.slice(3).map(Number);
    for(const t of ts){const d=await p.evaluate(t=>window.renderAt(t),t);fs.writeFileSync(`still_${t}.jpg`,Buffer.from(d.split(',')[1],'base64'));}
  }else{
    const fps=30,n=Math.ceil(dur*fps);
    const ff=spawn('ffmpeg',['-y','-loglevel','error','-f','image2pipe','-framerate',''+fps,'-c:v','mjpeg','-i','-','-c:v','libx264','-preset','medium','-crf','18','-pix_fmt','yuv420p','video_only.mp4']);
    const t0=Date.now();
    for(let i=0;i<n;i++){const d=await p.evaluate(t=>window.renderAt(t),i/fps);
      if(!ff.stdin.write(Buffer.from(d.split(',')[1],'base64')))await new Promise(r=>ff.stdin.once('drain',r));
      if(i%60==0)console.log(`frame ${i}/${n} ${((Date.now()-t0)/1000).toFixed(0)}s`);}
    ff.stdin.end();await new Promise(r=>ff.on('close',r));
  }
  await b.close();srv.close();
})();
