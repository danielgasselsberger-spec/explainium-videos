import numpy as np, wave, json
sr=44100; dur=json.load(open('words.json'))['dur']+0.3
N=int(sr*dur); mix=np.zeros(N)
def ks(freq,length,decay=0.996,bright=0.5):
    n=int(sr*length);p=int(sr/freq);buf=np.random.uniform(-1,1,p);out=np.zeros(n)
    for i in range(n):
        out[i]=buf[i%p];buf[i%p]=decay*(bright*buf[i%p]+(1-bright)*buf[(i+1)%p]) if True else 0
    return out
np.random.seed(1)
def note(m):return 440*2**((m-69)/12)
cache={}
def pluck(m,l=0.35):
    k=(m,l)
    if k not in cache: cache[k]=ks(note(m),l,0.994,0.5)*np.linspace(1,0.6,int(sr*l))
    return cache[k]
bpm=138; eighth=60/bpm/2  # 6/8 feel: triplets
prog=[[57,60,64],[57,60,64],[52,56,59],[52,56,59],[50,53,57],[50,53,57],[52,56,59],[57,60,64]]  # Am Am E E Dm Dm E Am
t=0.0;bar=0
while t<dur:
    ch=prog[bar%len(prog)]
    pat=[ch[0]+12,ch[1]+12,ch[2]+12,ch[1]+12,ch[2]+12,ch[0]+24]
    for i,m in enumerate(pat):
        s=int((t+i*eighth)*sr);x=pluck(m)
        e=min(N,s+len(x))
        if s<N: mix[s:e]+=x[:e-s]*0.22
    # bass on 1 and 4
    for i in (0,3):
        s=int((t+i*eighth)*sr);x=pluck(ch[0]-12,0.5)
        e=min(N,s+len(x))
        if s<N: mix[s:e]+=x[:e-s]*0.35
    t+=6*eighth;bar+=1
# fade
mix*=np.minimum(1,np.minimum(np.arange(N)/(sr*0.3),(N-np.arange(N))/(sr*1.5)))
def sfx_pop(t0,f0=500,f1=1200,l=0.12,a=0.5):
    n=int(sr*l);tt=np.arange(n)/sr;f=np.linspace(f0,f1,n);ph=2*np.pi*np.cumsum(f)/sr
    s=int(t0*sr);mix[s:s+n]+=np.sin(ph)*np.exp(-tt*25)*a
def sfx_ding(t0,a=0.4):
    n=int(sr*1.0);tt=np.arange(n)/sr
    x=(np.sin(2*np.pi*1568*tt)+0.5*np.sin(2*np.pi*2349*tt)+0.3*np.sin(2*np.pi*3136*tt))*np.exp(-tt*4)
    s=int(t0*sr);mix[s:s+n]+=x*a
def sfx_thud(t0,a=0.8):
    n=int(sr*0.3);tt=np.arange(n)/sr;f=np.linspace(120,45,n);x=np.sin(2*np.pi*np.cumsum(f)/sr)*np.exp(-tt*14)
    s=int(t0*sr);mix[s:s+n]+=x*a
def sfx_whoosh(t0,l=0.5,a=0.25):
    n=int(sr*l);x=np.random.randn(n);x=np.convolve(x,np.ones(30)/30,'same');env=np.sin(np.pi*np.arange(n)/n)**2
    s=int(t0*sr);mix[s:s+n]+=x*env*a
S=[0,3.85,8.3,12.35,19.85,26.1,31.7]
for t0 in S[1:]: sfx_whoosh(t0-0.2)
sfx_pop(2.85); sfx_thud(3.85+3.25); sfx_ding(3.85+3.3,0.25)   # lock lands
sfx_thud(8.3+0.5); sfx_ding(8.3+2.1,0.3)
for i in range(14): sfx_pop(8.3+2.4+i*0.06+0.3,900,1500,0.06,0.18)
for i in range(2): sfx_pop(12.35+1.6+i*1.1+0.2,300,700,0.1,0.3)
sfx_ding(12.35+4.85+1.6,0.35)
sfx_pop(26.1+0.1,400,900); sfx_thud(26.1+1.75+1.5,1.0); sfx_ding(26.1+1.75+2.4,0.3)
sfx_ding(31.7,0.3)
mix=np.clip(mix,-1,1)
with wave.open('music.wav','wb') as w:
    w.setnchannels(1);w.setsampwidth(2);w.setframerate(sr);w.writeframes((mix*32767*0.9).astype(np.int16).tobytes())
print('ok',dur)
