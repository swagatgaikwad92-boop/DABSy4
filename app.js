(()=>{"use strict";const __m={};
__m['store.js']=(()=>{
const P='dabsy4:',all=new Set();
function store(key,init){
  let d;try{d={...init,...JSON.parse(localStorage.getItem(P+key)).d}}catch{d=structuredClone(init)}
  const subs=new Set();let t;
  const save=()=>{clearTimeout(t);try{localStorage.setItem(P+key,JSON.stringify({d}))}catch{}};
  const s={get:()=>d,set(p){d=typeof p==='function'?p(d):{...d,...p};clearTimeout(t);t=setTimeout(save,150);subs.forEach(f=>f(d));return d},
    on(f){subs.add(f);return()=>subs.delete(f)},flush:save,reset(){d=structuredClone(init);save();subs.forEach(f=>f(d))}};
  all.add(s);return s}
addEventListener('pagehide',()=>all.forEach(s=>s.flush()));
document.addEventListener('visibilitychange',()=>document.hidden&&all.forEach(s=>s.flush()));
const resetAll=()=>all.forEach(s=>s.reset());

return{get store(){return store},get resetAll(){return resetAll}}})();
__m['state.js']=(()=>{
const {store}=__m['store.js'];
const uid=(p='')=>p+Math.random().toString(36).slice(2,8)+Date.now().toString(36).slice(-3);
const ymd=(d=new Date())=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const prefs=store('prefs',{scene:'bedroom',tod:'auto',motion:'auto',text:1,style:'balanced',lang:'auto',notif:true,nudges:true,onboarded:false});
const tasks=store('tasks',{items:[]});
const events=store('events',{items:[]});
const study=store('study',{log:{}});
const widgets=store('widgets',{items:[]});
const memory=store('memory',{facts:[]});
const chat=store('chat',{api:[]});
const L=new Map();
const bus={on(e,f){(L.get(e)||L.set(e,new Set()).get(e)).add(f);return()=>L.get(e).delete(f)},emit(e,d){(L.get(e)||[]).forEach(f=>{try{f(d)}catch(x){console.error(e,x)}})}};
const reduced=()=>{const m=prefs.get().motion;return m==='reduced'||(m==='auto'&&matchMedia('(prefers-reduced-motion: reduce)').matches)};
const $=(t,a={},...k)=>{const e=document.createElement(t);for(const[n,v]of Object.entries(a)){if(v==null||v===false)continue;if(n==='class')e.className=v;else if(n.startsWith('on'))e.addEventListener(n.slice(2),v);else if(n==='html')e.innerHTML=v;else e.setAttribute(n,v===true?'':v)}for(const c of k.flat())if(c!=null&&c!==false)e.append(c);return e};

return{get uid(){return uid},get ymd(){return ymd},get prefs(){return prefs},get tasks(){return tasks},get events(){return events},get study(){return study},get widgets(){return widgets},get memory(){return memory},get chat(){return chat},get bus(){return bus},get reduced(){return reduced},get $(){return $}}})();
__m['ai.js']=(()=>{
class AIError extends Error{constructor(kind,msg,o={}){super(msg);this.kind=kind;this.retry=!!o.retry;this.code=o.code||''}}
const DEFAULT_API='https://dabsy-brain.swagatdemo9292.workers.dev',LEGACY_API='https://dabsy-ai.swagatdemo9292.workers.dev';
let API=DEFAULT_API,FALLBACK=LEGACY_API;
async function loadConfig(){try{const r=await fetch('./config.json',{cache:'no-store'});const j=await r.json(),u=x=>String(x||'').trim().replace(/\/+$/,'');API=u(j.apiUrl)||DEFAULT_API;FALLBACK=u(j.fallbackApiUrl)}catch{API=DEFAULT_API;FALLBACK=LEGACY_API}return API}
async function ping(base){try{const c=new AbortController();setTimeout(()=>c.abort(),8000);const r=await fetch(base+'/health',{signal:c.signal,cache:'no-store'});const j=await r.json().catch(()=>({}));return j.ok===true?{ok:true,model:j.model||''}:{ok:false,reason:'bad-response'}}catch{return{ok:false,reason:'unreachable'}}}
async function health(){
  if(!API)return{ok:false,reason:'not-configured'};
  let h=await ping(API);
  if(!h.ok&&FALLBACK&&FALLBACK!==API){const f=await ping(FALLBACK);if(f.ok){API=FALLBACK;FALLBACK='';h=f}}
  return h}
function parseSSE(){let buf='',ev='',data=[];return chunk=>{buf+=chunk;const out=[];let i;while((i=buf.search(/\r?\n/))>=0){const m=buf.match(/\r?\n/)[0].length;const line=buf.slice(0,i);buf=buf.slice(i+m);
  if(line===''){if(data.length||ev)out.push({event:ev||'message',data:data.join('\n')});ev='';data=[];continue}
  if(line[0]===':')continue;const k=line.indexOf(':');const f=k<0?line:line.slice(0,k);let v=k<0?'':line.slice(k+1);if(v[0]===' ')v=v.slice(1);if(f==='event')ev=v;else if(f==='data')data.push(v)}return out}}
async function once({system,messages,tools,signal,onText},state){
  const ctl=new AbortController();let why='';const abort=r=>{why=why||r;ctl.abort()};
  signal?.addEventListener('abort',()=>abort('user'),{once:true});if(signal?.aborted)throw new AIError('aborted','Stopped');
  const conn=setTimeout(()=>abort('connect'),25000);let idle;const bump=()=>{clearTimeout(idle);idle=setTimeout(()=>abort('idle'),45000)};
  try{
    let res;try{res=await fetch(API+'/chat',{method:'POST',headers:{'content-type':'application/json',accept:'text/event-stream'},body:JSON.stringify({system,messages,tools}),signal:ctl.signal,cache:'no-store'})}
    catch{throw why==='user'?new AIError('aborted','Stopped'):why?new AIError('timeout','The connection timed out.',{retry:true}):new AIError('network','Could not reach the server.',{retry:true})}
    clearTimeout(conn);
    if(!res.ok){let m=`Server returned ${res.status}.`,c='';try{const j=await res.json();m=j?.error?.message||m;c=j?.error?.code||''}catch{}throw new AIError('http',m,{code:c,retry:[502,503,504,529].includes(res.status)})}
    if(!res.body)throw new AIError('server','The server sent no stream.');
    bump();const rd=res.body.getReader(),dec=new TextDecoder(),p=parseSSE();let text='',calls=[],stop='end_turn',done=false;
    for(;;){let r;try{r=await rd.read()}catch{throw why==='user'?new AIError('aborted','Stopped'):new AIError(why?'timeout':'network','The connection dropped.',{retry:!state.got})}
      if(r.done)break;bump();
      for(const e of p(dec.decode(r.value,{stream:true}))){let j;try{j=JSON.parse(e.data)}catch{continue}state.got=true;
        if(e.event==='error')throw new AIError('server',j.message||'The model reported an error.',{code:j.code});
        if(e.event==='text'){text+=j.t;onText?.(text)}else if(e.event==='tool')calls.push(j);else if(e.event==='done'){done=true;stop=j.stop||'end_turn'}}}
    if(!done)throw new AIError('truncated','The response was cut off.',{retry:!state.got});
    return{text,calls,stop}
  }finally{clearTimeout(conn);clearTimeout(idle)}}
async function stream(o){
  if(!API)throw new AIError('config','not-configured');
  const state={got:false};
  for(let n=0;;n++)try{return await once(o,state)}catch(e){if(!(e instanceof AIError))throw new AIError('network',e.message,{retry:true});
    if(e.retry&&!state.got&&n<1&&!o.signal?.aborted){await new Promise(r=>setTimeout(r,800));continue}throw e}}

return{get AIError(){return AIError},get DEFAULT_API(){return DEFAULT_API},get API(){return API},get loadConfig(){return loadConfig},get health(){return health},get stream(){return stream}}})();
__m['brain.js']=(()=>{
const S={IDLE:'idle',CURIOUS:'curious',HAPPY:'happy',SLEEPY:'sleepy',PLAYFUL:'playful',FOCUSED:'focused',AFFECTIONATE:'affectionate',GRUMPY:'grumpy',EXCITED:'excited'};
/* Needs-driven state machine. Every state has a hard expiry, so nothing (esp. GRUMPY) can persist. */
function createBrain({onChange,hour=()=>new Date().getHours()}){
 const n={energy:.8,affection:.5,boredom:.2};let state=S.IDLE,until=0,dizzyUntil=0,drops=[],lastInt=Date.now(),lastNudge=0,locked=false,grump=0,sleepSince=0;
 const now=()=>performance.now();
 function set(s,ms){const ch=s!==state;state=s;until=now()+ms;if(ch)onChange(s,now()<dizzyUntil)}
 function touch(){lastInt=Date.now();if(state===S.SLEEPY){n.energy=Math.max(n.energy,.55);return true}return false}
 function event(type,d={}){const woke=touch();if(locked&&type!=='pet'&&type!=='drop')return;
  switch(type){
   case'tap':set(woke?S.CURIOUS:S.CURIOUS,3000);n.affection=Math.min(1,n.affection+.02);n.boredom=Math.max(0,n.boredom-.1);break;
   case'pet':n.affection=Math.min(1,n.affection+(d.amount||.05));n.boredom=Math.max(0,n.boredom-.05);if(locked)break;
     if(state===S.GRUMPY){grump+=d.amount||.05;if(grump>.18){grump=0;set(S.HAPPY,5000)}else set(S.GRUMPY,Math.min(12000,until-now()+500))}
     else set(n.affection>.75?S.AFFECTIONATE:S.HAPPY,5000);break;
   case'drop':{const t=now();drops=drops.filter(x=>t-x<25000);drops.push(t);
     if(drops.length>=3){dizzyUntil=t+3500;grump=0;n.affection=Math.max(0,n.affection-.1);locked=false;set(S.GRUMPY,12000);onChange(S.GRUMPY,true);setTimeout(()=>onChange(state,false),3500)}
     else if(!locked)set(drops.length===2?S.CURIOUS:S.PLAYFUL,2500);break}
   case'widget':set(S.CURIOUS,2500);break;
   case'return':if(!locked)set(S.EXCITED,4500);break;
   case'notify':if(!locked)set(S.CURIOUS,3500);break;
  }}
 function tick(){const t=now();
  if(state===S.SLEEPY)n.energy=Math.min(1,n.energy+.012);else n.energy=Math.max(0,n.energy-.0012);
  n.boredom=Math.min(1,n.boredom+.006);n.affection=Math.max(0,n.affection-.0007);
  if(locked||t<until)return;
  const h=hour(),night=h>=23||h<6;
  if(state===S.SLEEPY&&n.energy<.8&&Date.now()-lastInt>8000)return set(S.SLEEPY,15000);
  if(night||n.energy<.22)return set(S.SLEEPY,30000);
  if(n.boredom>.65){n.boredom=.15;return set(S.PLAYFUL,9000)}
  if(n.affection>.8&&Math.random()<.3)return set(S.AFFECTIONATE,6000);
  set(Math.random()<.3?S.CURIOUS:S.IDLE,8000)}
 return{event,tick,needs:n,get state(){return state},get dizzy(){return now()<dizzyUntil},
  lock(s){locked=true;set(s,1e9)},unlock(){locked=false;set(S.IDLE,1500)},
  shouldNudge(enabled){const t=Date.now();if(!enabled||locked||state===S.SLEEPY||t-lastInt<24e4||t-lastNudge<36e4)return false;lastNudge=t;return true},
  set};}

return{get S(){return S},get createBrain(){return createBrain}}})();
__m['character.js']=(()=>{
const {$,reduced}=__m['state.js'];
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v)),now=()=>performance.now();
/* world(): {W,H,floor,top}.  x,y = bottom-centre of DABSy in app px. */
function createDabsy({layer,world,cb}){
 const img=(c,s)=>$('img',{class:c,src:'./'+s,alt:'',draggable:'false',decoding:'async'});
 const eyes=$('div',{class:'dabsy__eyes'},img('dabsy__eye l','char-eye-l.webp'),img('dabsy__eye r','char-eye-r.webp'));
 const squash=$('div',{class:'dabsy__squash'},img('dabsy__body','char-body.webp'),eyes,img('dabsy__bow','char-bow.webp'),$('i',{class:'zz'},'z'),$('i',{class:'sp s1'}),$('i',{class:'sp s2'}),$('i',{class:'sp s3'}));
 const rotEl=$('div',{class:'dabsy__rot'},$('div',{class:'dabsy__float'},squash));
 const shadow=$('div',{class:'dabsy__shadow'});
 const el=$('div',{class:'dabsy','data-state':'idle','data-act':'','aria-label':'DABSy, your companion',role:'img'},shadow,rotEl);
 layer.append(el);
 let w=100,h=106,x=0,y=0,vx=0,vy=0,rot=0,vr=0,sq=0,sqv=0,sc=1,tsc=1,mode='perch',lean=0,fall=null,raf=0,last=0,fly=null,hp=null,pose='stand',ps=0;const PT={stand:0,sit:.09,curl:.17,loaf:.12};
 const size=()=>{const W=world().W;w=clamp(W*.25,78,116);h=w*1028/970;el.style.width=w+'px'};
 size();
 function render(){el.style.transform=`translate3d(${x-w/2}px,${y-h}px,0) scale(${sc})`;
  rotEl.style.transform=`rotate(${rot+lean*12}deg)`;
  {const q=sq+ps;squash.style.transform=`scale(${1+q*.7},${1-q}) skewX(${-lean*5}deg)`}
  shadow.style.opacity=mode==='drag'||mode==='fall'?clamp(.5-(world().floor-y)/700,.15,.5):.5;}
 const active=()=>mode==='drag'||mode==='fall'||mode==='fly'||mode==='hop'||Math.abs(PT[pose]-ps)>.004||Math.abs(tsc-sc)>.004&&mode!=='fly'&&mode!=='hop'||Math.abs(sq)>.003||Math.abs(sqv)>.02||Math.abs(rot)>.15||Math.abs(lean)>.01;
 const kick=()=>{if(!raf){last=now();raf=requestAnimationFrame(frame)}};
 function frame(t){raf=0;const dt=Math.min(.033,(t-last)/1000);last=t;step(dt);render();if(active())raf=requestAnimationFrame(frame)}
 function step(dt){const B=world(),minX=w/2,maxX=B.W-w/2,floor=B.floor,gnd=(px,py)=>B.ground?B.ground(px,py):floor;ps+=(PT[pose]-ps)*Math.min(1,dt*8);if(mode!=='fly'&&mode!=='hop'&&Math.abs(tsc-sc)>.002)sc+=(tsc-sc)*Math.min(1,dt*6);
  sqv+=(-sq*380-sqv*13)*dt;sq+=sqv*dt;
  if(mode==='drag'){const k=1-Math.exp(-dt*20),px=clamp(drag.px,minX,maxX),py=clamp(drag.py+h*.5,B.top+h,floor+h*.25);vx=(px-x)/dt;x+=(px-x)*k;y+=(py-y)*k;
   rot+=(clamp(vx*.012,-22,22)-rot)*Math.min(1,dt*10)}
  else if(mode==='fall'){const fl=gnd(x,y-4),st=B.steer?B.steer(x,y):null;if(st!=null){vx+=(st-x)*16*dt;vx*=Math.max(0,1-dt*4)}vy+=2400*dt;x+=vx*dt;y+=vy*dt;rot+=vr*dt;
   if(x<minX){x=minX;vx=Math.abs(vx)*.5;vr*=.6}if(x>maxX){x=maxX;vx=-Math.abs(vx)*.5;vr*=.6}
   if(y<B.top+h){y=B.top+h;vy=Math.abs(vy)*.4}
   if(y>=fl){y=fl;if(vy>380){sq=clamp(vy/2600,.08,.38);sqv=0;vy*=-.28;vx*=.6;vr*=.5;cb.thud?.(vy)}else{vy=0;vx=0;vr=0;mode='rest';sq=Math.max(sq,.12);land()}}}
  else if(mode==='fly'){const k=1-Math.exp(-dt*7);x+=(fly.x-x)*k;y+=(fly.y-y)*k;sc+=(fly.s-sc)*k;rot+=(0-rot)*k;
   if(Math.hypot(fly.x-x,fly.y-y)<1.5&&Math.abs(fly.s-sc)<.01){x=fly.x;y=fly.y;sc=fly.s;mode=fly.anchored?'perch':'rest';el.dataset.act='';const f=fly;fly=null;f.done()}}
  else if(mode==='hop'){hp.t+=dt;const u=Math.min(1,hp.t/hp.d),e=u<.5?2*u*u:1-Math.pow(-2*u+2,2)/2;x=hp.x0+(hp.x1-hp.x0)*e;y=hp.y0+(hp.y1-hp.y0)*e-Math.sin(Math.PI*u)*hp.arc;sc=hp.s0+(hp.s1-hp.s0)*e;rot=Math.sin(u*Math.PI)*(hp.x1>hp.x0?5:-5);if(u>=1){x=hp.x1;y=hp.y1;sc=tsc=hp.s1;sq=.15;sqv=0;mode='perch';const f=hp.done;hp=null;f(true)}}
  else if(mode==='rest'&&y<gnd(x,y)-1){mode='fall';vy=0}
  if(mode!=='drag'&&mode!=='fall'&&mode!=='hop')rot+=(0-rot)*Math.min(1,dt*9);
  lean+=(petLean-lean)*Math.min(1,dt*10)}
 let landed=null,petLean=0;
 function land(){rot=0;const f=landed;landed=null;if(f)cb.drop?.(f);cb.landed?.(x,y)}
 /* ---------- gesture arbiter: tap / double / long-press-lift / stroke (pet) / swipe (drag+throw) ---------- */
 let drag={px:0,py:0},g=null,tapT=0,tapTimer=0,samples=[];
 el.addEventListener('pointerdown',e=>{if(g||mode==='fly'||!e.isPrimary)return;el.setPointerCapture(e.pointerId);
  const r=el.parentElement.getBoundingClientRect();g={id:e.pointerId,x0:e.clientX-r.left,y0:e.clientY-r.top,px:e.clientX-r.left,py:e.clientY-r.top,t0:now(),m:'pending',pet:null};
  g.hold=setTimeout(()=>{if(g&&g.m==='pending')startDrag(true)},450);e.preventDefault()});
 el.addEventListener('pointermove',e=>{if(!g||e.pointerId!==g.id)return;const r=el.parentElement.getBoundingClientRect(),px=e.clientX-r.left,py=e.clientY-r.top,dx=px-g.px,dy=py-g.py;g.px=px;g.py=py;
  if(g.m==='pending'){const d=Math.hypot(px-g.x0,py-g.y0);if(d<10)return;clearTimeout(g.hold);const sp=d/Math.max(1,now()-g.t0);
   if(sp>.5||mode==='drag')startDrag(false);else startPet()}
  if(g.m==='drag'){drag.px=px;drag.py=py;samples.push({t:now(),x:px,y:py});if(samples.length>8)samples.shift();cb.look?.(px,py)}
  else if(g.m==='pet'){const p=g.pet,seg=Math.hypot(dx,dy);p.len+=seg;p.sdy+=dy;p.sdx+=dx;if(Math.abs(dx)>1&&Math.sign(dx)!==p.sg&&p.sg!==0)p.rev++;if(Math.abs(dx)>1)p.sg=Math.sign(dx);
   petLean=clamp((px-x)/w,-.5,.5);kick();
   if(now()-p.t>350){const amount=p.len/(w*7),dir=p.rev>=3?'scratch':p.sdy>w*.15?'down':p.sdy<-w*.15?'up':'side';
    el.dataset.pet=dir;cb.pet?.({amount,dir});p.t=now();p.len=0;p.sdy=0;p.sdx=0;p.rev=0;if(!reduced())navigator.vibrate?.(6)}}});
 function startDrag(lift){clearTimeout(g.hold);if(hp){hp.done(false);hp=null}pose='stand';cb.lifted?.();g.m='drag';mode='drag';fly=null;drag={px:g.px,py:g.py};samples=[{t:now(),x:g.px,y:g.py}];vx=vy=0;el.dataset.act='held';landed=null;if(lift)navigator.vibrate?.(10);cb.dragStart?.();kick()}
 function startPet(){g.m='pet';g.pet={len:0,sdy:0,sdx:0,rev:0,sg:0,t:now()};el.dataset.act='petting';cb.petStart?.();kick()}
 function end(e){if(!g||e.pointerId!==g.id)return;clearTimeout(g.hold);const m=g.m,dur=now()-g.t0;g=null;
  if(m==='pending'){el.dataset.act='';if(dur<450){const t=now();if(t-tapT<320){clearTimeout(tapTimer);tapT=0;cb.double?.()}else{tapT=t;tapTimer=setTimeout(()=>{tapT=0;cb.tap?.()},300)}}}
  else if(m==='pet'){petLean=0;el.dataset.act='';el.dataset.pet='';cb.petEnd?.();kick()}
  else if(m==='drag'){const s=samples.filter(a=>now()-a.t<110),a=s[0],b=s[s.length-1];let ux=0,uy=0;if(a&&b&&b.t>a.t){ux=(b.x-a.x)/((b.t-a.t)/1000);uy=(b.y-a.y)/((b.t-a.t)/1000)}
   vx=clamp(ux,-1900,1900);vy=clamp(uy,-1900,1900);vr=clamp(vx*.18,-420,420);el.dataset.act='';
   const height=world().floor-y;landed=height>40?{height,speed:Math.hypot(vx,vy)}:null;
   if(reduced()){y=world().floor;vx=vy=vr=0;mode='rest';rot=0;land()}else mode='fall';kick();cb.release?.()}}
 el.addEventListener('pointerup',end);el.addEventListener('pointercancel',end);
 el.addEventListener('contextmenu',e=>e.preventDefault());
 /* ---------- public ---------- */
 const api={el,get x(){return x},get y(){return y},get w(){return w},get h(){return h},get mode(){return mode},
  place(nx,ny,s=1,perch=false,p='stand'){x=nx;y=ny;sc=tsc=s;pose=p;ps=PT[p];mode=perch?'perch':ny<world().floor-2?'fall':'rest';el.dataset.ready='1';render();kick()},
  flyTo(nx,ny,s=1,anchored=false){return new Promise(res=>{if(reduced()){x=nx;y=ny;sc=s;mode=anchored?'perch':'rest';render();return res()}
    pose='stand';fly={x:nx,y:ny,s,anchored,done:res};mode='fly';el.dataset.act='flying';kick()})},
  setPose(p){pose=p;kick()},get pose(){return pose},get scale(){return sc},scaleTo(s){tsc=s;kick()},
  snap(nx,ny,s,p){if(hp){hp.done(false);hp=null}x=nx;y=ny;sc=tsc=s;if(p)pose=p;mode='perch';render();kick()},
  /* hop (in short bounds) to a surface point; resolves true on arrival, false if interrupted */
  async hopTo(tx,ty,ts,p='sit'){if(mode==='drag'||mode==='fly')return false;if(reduced()){this.snap(tx,ty,ts,p);return true}
    pose='stand';mode='perch';const n=Math.max(1,Math.ceil(Math.hypot(tx-x,ty-y)/190));
    for(let i=1;i<=n;i++){const x0=x,y0=y,s0=sc,x1=x0+(tx-x0)/(n-i+1),y1=y0+(ty-y0)/(n-i+1),s1=s0+(ts-s0)/(n-i+1),d=Math.hypot(x1-x0,y1-y0);
      sq=.2;sqv=0;kick();await new Promise(r=>setTimeout(r,150));if(mode==='drag'||mode==='fly')return false;
      const ok=await new Promise(res=>{hp={x0,y0,x1,y1,s0,s1,t:0,d:Math.min(.95,Math.max(.5,d/520+.38)),arc:Math.min(95,18+d*.4),done:res};mode='hop';kick()});if(!ok)return false}
    mode='perch';pose=p;kick();return true},
  state(s,dz){el.dataset.state=s;el.dataset.dizzy=dz?'1':'0';el.dataset.sleep=s==='sleepy'?'1':'0'},
  act(a){el.dataset.act=a;},
  look(px,py){const dx=clamp((px-x)/(w*1.4),-1,1),dy=clamp((py-(y-h*.6))/(h*1.4),-1,1);eyes.style.transform=`translate(${dx*4}%,${dy*3}%)`},
  lookRel(dx,dy){eyes.style.transform=`translate(${dx*4}%,${dy*3}%)`},
  hop(p=620){if(mode!=='rest'||reduced())return;vy=-p;vx=(Math.random()-.5)*160;vr=vx*.1;mode='fall';landed=null;kick()},
  stretch(){if(reduced())return;el.classList.remove('stretch');void el.offsetWidth;el.classList.add('stretch')},
  nod(){sq=-.12;sqv=0;kick()},
  resize(){size();if(mode==='rest'||mode==='fall'){x=clamp(x,w/2,world().W-w/2);mode='fall';vy=0}render();kick()},
  get busy(){return mode!=='rest'&&mode!=='perch'},get settled(){return mode==='rest'||mode==='perch'}};
 return api}

return{get createDabsy(){return createDabsy}}})();
__m['widgets.js']=(()=>{
const {$,widgets:store,tasks,events,study,uid,ymd,reduced,bus}=__m['state.js'];
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v)),now=()=>performance.now();
const DEFS={clock:{name:'Clock',w:132,h:88,g:0,rest:.6,min:.8,max:1.9},weather:{name:'Weather',w:132,h:96,g:0,rest:.55,min:.8,max:1.8},
 tasks:{name:'Priorities',w:160,h:140,g:1,rest:.3,min:.8,max:1.7},calendar:{name:'Agenda',w:160,h:116,g:1,rest:.35,min:.8,max:1.7},study:{name:'Study',w:128,h:100,g:.6,rest:.45,min:.8,max:1.8}};
const IC={clock:'<circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/>',weather:'<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4"/>',tasks:'<rect x="5" y="4" width="14" height="16" rx="3"/><path d="M9 10l2 2 4-4M9 16h6"/>',calendar:'<rect x="4" y="5" width="16" height="15" rx="3"/><path d="M4 10h16M9 3v4M15 3v4"/>',study:'<path d="M4 6c3-1 6-1 8 1 2-2 5-2 8-1v12c-3-1-6-1-8 1-2-2-5-2-8-1z"/>'};
const icon=(k,s=22)=>`<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${IC[k]||''}</svg>`;
/* weather (Open-Meteo, device location; cached 30 min) */
let wx=null,wxBusy=false;
try{wx=JSON.parse(localStorage.getItem('dabsy4:wx'))}catch{}
async function loadWx(force){if(wxBusy||(!force&&wx&&Date.now()-wx.t<18e5))return;wxBusy=true;
 try{const p=await new Promise((r,j)=>navigator.geolocation.getCurrentPosition(r,j,{timeout:9000,maximumAge:6e5}));
  const j=await(await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${p.coords.latitude.toFixed(2)}&longitude=${p.coords.longitude.toFixed(2)}&current=temperature_2m,weather_code,is_day`)).json();
  wx={t:Date.now(),temp:Math.round(j.current.temperature_2m),code:j.current.weather_code,day:j.current.is_day};localStorage.setItem('dabsy4:wx',JSON.stringify(wx))}
 catch{if(!wx)wx={err:1,t:Date.now()-17e5}}finally{wxBusy=false;bus.emit('wx')}}
const WC=c=>c===0?'Clear':c<4?'Partly cloudy':c<50?'Foggy':c<70?'Rain':c<80?'Snow':c<90?'Showers':'Storm';
const hm=d=>d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',hour12:false});
function fill(wg){const {type,el,w,h}=wg,td=ymd(),b=$('div',{class:'wb'});
 if(type==='clock'){const d=new Date();b.append($('div',{class:'big'},hm(d)),$('div',{class:'sub'},d.toLocaleDateString([],{weekday:'long',day:'numeric',month:'short'})))}
 else if(type==='weather'){if(!wx||wx.err){b.append($('div',{class:'sub'},'Weather'),$('div',{class:'big sm'},'—'),$('div',{class:'sub'},wx?.err?'Tap to allow location':'Loading…'));if(!wx)loadWx()}
  else{b.append($('div',{class:'big'},wx.temp+'°'),$('div',{class:'sub'},WC(wx.code)));loadWx()}}
 else if(type==='tasks'){const rows=Math.max(1,Math.floor((h-38)/25)),it=tasks.get().items.filter(t=>!t.done).sort((a,c)=>((a.due||'9')+(a.time||'99'))<((c.due||'9')+(c.time||'99'))?-1:1).slice(0,rows);
  b.append($('div',{class:'sub'},'Priorities'),it.length?it.map(t=>$('div',{class:'row'},$('i',{class:'dot '+t.priority}),$('span',{},t.title))):$('div',{class:'sub dim'},'Nothing pending ✨'))}
 else if(type==='calendar'){const rows=Math.max(1,Math.floor((h-38)/25)),items=[...events.get().items.filter(e=>e.date>=td).map(e=>({d:e.date,t:e.start,x:e.title})),...tasks.get().items.filter(t=>!t.done&&t.time&&t.due>=td).map(t=>({d:t.due,t:t.time,x:t.title}))].sort((a,c)=>(a.d+a.t<c.d+c.t?-1:1)).slice(0,rows);
  b.append($('div',{class:'sub'},'Up next'),items.length?items.map(e=>$('div',{class:'row'},$('b',{},(e.d===td?'':e.d.slice(5)+' ')+e.t),$('span',{},e.x))):$('div',{class:'sub dim'},'Clear schedule'))}
 else if(type==='study'){const m=study.get().log[td]||0,goal=60;b.append($('div',{class:'sub'},'Studied today'),$('div',{class:'big'},m+'m'),$('div',{class:'bar'},$('i',{style:`width:${Math.min(100,m/goal*100)}%`})))}
 el.replaceChildren(b)}
function createWidgets({layer,trayHost,world,cb}){
 const list=[],tray=$('div',{class:'tray glass','data-open':'0'});trayHost.append(tray);
 let loop=0,last=0,trayOpen=false;
 const B=()=>{const b=world();return{...b,bot:b.H-18,left:6,right:b.W-6}};
 function mk(type,o={}){const D=DEFS[type],s=o.s||1,wg={id:o.id||uid('w_'),type,s,w:D.w*s,h:D.h*s,x:0,y:0,vx:0,vy:0,sq:0,sqv:0,held:false,
   el:$('div',{class:`widget glass w-${type}`,'data-type':type,'aria-label':D.name})};
  wg.el.style.width=wg.w+'px';wg.el.style.height=wg.h+'px';layer.append(wg.el);list.push(wg);fill(wg);attach(wg);return wg}
 function save(){store.set({items:list.map(w=>({id:w.id,type:w.type,fx:w.x/world().W,fy:w.y/world().H,s:w.s}))})}
 function pos(wg){const b=B();wg.x=clamp(wg.x,b.left,b.right-wg.w);wg.y=clamp(wg.y,b.top,b.bot-wg.h)}
 function render(wg){wg.el.style.transform=`translate3d(${wg.x}px,${wg.y}px,0) scale(${(wg.held?1.06:1)*(1+wg.sq*.6)},${(wg.held?1.06:1)*(1-wg.sq)})`}
 const wake=()=>{if(!loop){last=now();loop=requestAnimationFrame(frame)}};
 function frame(t){loop=0;const dt=Math.min(.033,(t-last)/1000);last=t;let act=false;const b=B();
  for(const wg of list){wg.sqv+=(-wg.sq*340-wg.sqv*12)*dt;wg.sq+=wg.sqv*dt;if(wg.held){render(wg);act=true;continue}
   const D=DEFS[wg.type],bottom=D.g>0?Math.min(b.bot,b.floor+wg.h*.12):b.bot;
   if(D.g>0)wg.vy+=1900*D.g*dt;const fr=Math.exp(-dt*(D.g>0?(wg.y+wg.h>=bottom-1?5:.6):2.4));wg.vx*=fr;if(D.g===0)wg.vy*=fr;
   wg.x+=wg.vx*dt;wg.y+=wg.vy*dt;
   if(wg.x<b.left){wg.x=b.left;wg.vx=Math.abs(wg.vx)*D.rest;wg.sq=Math.min(.18,Math.abs(wg.vx)/3000)}
   if(wg.x+wg.w>b.right){wg.x=b.right-wg.w;wg.vx=-Math.abs(wg.vx)*D.rest;wg.sq=Math.min(.18,Math.abs(wg.vx)/3000)}
   if(wg.y<b.top){wg.y=b.top;wg.vy=Math.abs(wg.vy)*D.rest}
   if(wg.y+wg.h>bottom){wg.y=bottom-wg.h;if(Math.abs(wg.vy)>260){wg.sq=Math.min(.2,Math.abs(wg.vy)/3200);wg.sqv=0}wg.vy=Math.abs(wg.vy)>260?-wg.vy*D.rest:0}}
  for(let i=0;i<list.length;i++)for(let j=i+1;j<list.length;j++){const a=list[i],c=list[j];if(a.held||c.held)continue;
   const ox=Math.min(a.x+a.w,c.x+c.w)-Math.max(a.x,c.x),oy=Math.min(a.y+a.h,c.y+c.h)-Math.max(a.y,c.y);if(ox<=0||oy<=0)continue;
   if(ox<oy){const s=a.x<c.x?-1:1;a.x+=s*ox/2;c.x-=s*ox/2;const t=a.vx;a.vx=c.vx*.7;c.vx=t*.7;a.sq=c.sq=.06}else{const s=a.y<c.y?-1:1;a.y+=s*oy/2;c.y-=s*oy/2;const t=a.vy;a.vy=c.vy*.5;c.vy=t*.5}pos(a);pos(c)}
  for(const wg of list){render(wg);if(Math.abs(wg.vx)>4||Math.abs(wg.vy)>4||Math.abs(wg.sq)>.004||(DEFS[wg.type].g>0&&wg.y+wg.h<Math.min(b.bot,b.floor+wg.h*.12)-1))act=true}
  if(act)loop=requestAnimationFrame(frame);else save()}
 /* ---- interaction ---- */
 const over=(e)=>{const r=tray.getBoundingClientRect();return trayOpen&&e.clientY>r.top-10&&e.clientY<r.bottom+10};
 function attach(wg){const P=new Map();let g=null;
  const rel=e=>{const r=layer.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top}};
  wg.el.addEventListener('pointerdown',e=>{wg.el.setPointerCapture(e.pointerId);P.set(e.pointerId,rel(e));
   if(P.size===2){clearTimeout(g?.hold);const[a,c]=[...P.values()];g={m:'pinch',d0:Math.hypot(a.x-c.x,a.y-c.y)||1,s0:wg.s,cx:wg.x+wg.w/2,cy:wg.y+wg.h/2};wg.held=true;wg.vx=wg.vy=0;wg.el.classList.add('held');wake();return}
   const p=rel(e);g={m:'pending',x0:p.x,y0:p.y,t0:now(),ox:p.x-wg.x,oy:p.y-wg.y,smp:[]};g.hold=setTimeout(()=>{if(g?.m==='pending')pick()},380);e.preventDefault()});
  function pick(){g.m='drag';wg.held=true;wg.vx=wg.vy=0;wg.el.classList.add('held');navigator.vibrate?.(10);openTray(true);cb.pickup?.();wake()}
  wg.el.addEventListener('pointermove',e=>{if(!P.has(e.pointerId))return;P.set(e.pointerId,rel(e));if(!g)return;
   if(g.m==='pinch'&&P.size>=2){const[a,c]=[...P.values()],D=DEFS[wg.type],s=clamp(g.s0*Math.hypot(a.x-c.x,a.y-c.y)/g.d0,D.min,D.max);wg.s=s;wg.w=D.w*s;wg.h=D.h*s;wg.x=g.cx-wg.w/2;wg.y=g.cy-wg.h/2;pos(wg);
    wg.el.style.width=wg.w+'px';wg.el.style.height=wg.h+'px';if(!g.f){g.f=requestAnimationFrame(()=>{g&&(g.f=0);fill(wg)})}return}
   const p=rel(e);if(g.m==='pending'&&Math.hypot(p.x-g.x0,p.y-g.y0)>12){clearTimeout(g.hold);g.m='scroll'}
   if(g.m==='drag'){wg.x=p.x-g.ox;wg.y=p.y-g.oy;g.smp.push({t:now(),x:wg.x,y:wg.y});if(g.smp.length>8)g.smp.shift();tray.dataset.hot=over(e)?'1':'0'}});
  const up=e=>{if(!P.has(e.pointerId))return;P.delete(e.pointerId);if(!g)return;clearTimeout(g.hold);
   if(g.m==='pinch'){if(P.size<2){g=null;wg.held=false;wg.el.classList.remove('held');fill(wg);pos(wg);wake();save();cb.pinched?.()}return}
   if(g.m==='pending'&&now()-g.t0<380){cb.open?.(wg.type,wg)}
   if(g.m==='drag'){const rm=over(e);wg.held=false;wg.el.classList.remove('held');tray.dataset.hot='0';
    if(rm){remove(wg)}else{const s=g.smp.filter(a=>now()-a.t<110),a=s[0],c=s[s.length-1];if(a&&c&&c.t>a.t&&!reduced()){wg.vx=clamp((c.x-a.x)/((c.t-a.t)/1000),-2200,2200);wg.vy=clamp((c.y-a.y)/((c.t-a.t)/1000),-2200,2200)}pos(wg);wake();save()}}
   g=null};
  wg.el.addEventListener('pointerup',up);wg.el.addEventListener('pointercancel',up);wg.el.addEventListener('contextmenu',e=>e.preventDefault())}
 function remove(wg){const i=list.indexOf(wg);if(i<0)return;list.splice(i,1);wg.el.classList.add('gone');setTimeout(()=>wg.el.remove(),reduced()?0:260);save();updChips();cb.removed?.()}
 /* ---- tray (collection) ---- */
 const chips={};
 for(const[type,D]of Object.entries(DEFS)){const c=$('button',{class:'chip-w',type:'button','aria-label':`${D.name} widget`,html:`${icon(type,24)}<span>${D.name}</span>`});chips[type]=c;tray.append(c);
  let nw=null;
  c.addEventListener('pointerdown',e=>{c.setPointerCapture(e.pointerId);const ex=list.find(w=>w.type===type);if(ex){ex.vy=-500;ex.sq=.1;wake();nw=null;return}
   const r=layer.getBoundingClientRect(),W=mk(type);W.x=e.clientX-r.left-W.w/2;W.y=e.clientY-r.top-W.h/2;W.held=true;W.el.classList.add('held','spawn');nw={W,smp:[]};render(W);updChips();wake();e.preventDefault()});
  c.addEventListener('pointermove',e=>{if(!nw)return;const r=layer.getBoundingClientRect(),W=nw.W;W.x=e.clientX-r.left-W.w/2;W.y=e.clientY-r.top-W.h/2;nw.smp.push({t:now(),x:W.x,y:W.y});if(nw.smp.length>8)nw.smp.shift();tray.dataset.hot=over(e)?'1':'0'});
  const end=e=>{if(!nw)return;const{W,smp}=nw;nw=null;tray.dataset.hot='0';W.held=false;W.el.classList.remove('held','spawn');
   if(over(e)){const i=list.indexOf(W);if(i>=0){list.splice(i,1);W.el.remove();updChips()}return}
   const a=smp.filter(s=>now()-s.t<110)[0],z=smp[smp.length-1];if(a&&z&&z.t>a.t&&!reduced()){W.vx=clamp((z.x-a.x)/((z.t-a.t)/1000),-2200,2200);W.vy=clamp((z.y-a.y)/((z.t-a.t)/1000),-2200,2200)}
   if(DEFS[type].g>0&&W.vy===0)W.vy=1;pos(W);wake();save();cb.placed?.(type);bus.emit('widget-placed')};
  c.addEventListener('pointerup',end);c.addEventListener('pointercancel',end)}
 function updChips(){for(const[t,c]of Object.entries(chips))c.dataset.on=list.some(w=>w.type===t)?'1':'0'}
 function openTray(v){trayOpen=!!v;tray.dataset.open=v?'1':'0'}
 /* ---- lifecycle ---- */
 function restore(){const W=world().W,H=world().H;for(const it of store.get().items){if(!DEFS[it.type]||list.some(w=>w.type===it.type))continue;const wg=mk(it.type,{id:it.id,s:clamp(it.s||1,DEFS[it.type].min,DEFS[it.type].max)});wg.x=it.fx*W;wg.y=it.fy*H;pos(wg);render(wg)}updChips();wake()}
 const refresh=()=>list.forEach(fill);
 [tasks,events,study].forEach(s=>s.on(()=>{clearTimeout(refresh.t);refresh.t=setTimeout(refresh,60)}));bus.on('wx',refresh);
 setInterval(()=>list.some(w=>w.type==='clock')&&!document.hidden&&refresh(),15000);
 return{restore,openTray,get trayOpen(){return trayOpen},tray,relayout(){list.forEach(w=>{pos(w);render(w)});wake()},reset(){[...list].forEach(w=>{w.el.remove()});list.length=0;store.set({items:[]});updChips()},list};}

return{get DEFS(){return DEFS},get icon(){return icon},get loadWx(){return loadWx},get createWidgets(){return createWidgets}}})();
__m['tools.js']=(()=>{
const {tasks,events,study,memory,prefs,uid,ymd,bus}=__m['state.js'];
const D=/^\d{4}-\d{2}-\d{2}$/,T=/^\d{2}:\d{2}$/,PR=['high','normal','low'];
const S=(p,r=[])=>({type:'object',properties:p,required:r});
const str=d=>({type:'string',description:d}),pr={type:'string',enum:PR};
const TOOLS=[
 {name:'create_task',description:'Create ONE task the user asked for. Call once per task.',input_schema:S({title:str('Short title, may start with a fitting emoji'),due:str('YYYY-MM-DD'),time:str('HH:MM 24h'),priority:pr,notes:str('optional')},['title'])},
 {name:'complete_task',description:'Mark a task done (or undone) by id from the snapshot.',input_schema:S({id:str('task id'),done:{type:'boolean'}},['id'])},
 {name:'rename_task',description:'Rename a task by id.',input_schema:S({id:str(''),title:str('')},['id','title'])},
 {name:'set_priority',description:'Change priority of a task by id.',input_schema:S({id:str(''),priority:pr},['id','priority'])},
 {name:'move_task',description:'Change deadline/time of a task by id.',input_schema:S({id:str(''),due:str('YYYY-MM-DD'),time:str('HH:MM')},['id','due'])},
 {name:'delete_task',description:'Delete a task by id. The user confirms in the app.',input_schema:S({id:str('')},['id'])},
 {name:'list_tasks',description:'List tasks for a scope when the snapshot is not enough.',input_schema:S({scope:{type:'string',enum:['today','upcoming','all','done']}},['scope'])},
 {name:'plan_day',description:'Propose a schedule for one day. The user reviews, edits and confirms in the app before anything is saved.',input_schema:S({date:str('YYYY-MM-DD'),mood:str('theme of the day, e.g. Ghibli'),items:{type:'array',items:S({title:str('with a fitting emoji'),time:str('HH:MM'),duration_min:{type:'number'},existing_id:str('id of an existing open task to reuse')},['title','time'])}},['date','items'])},
 {name:'add_event',description:'Add a calendar event (stored on this device).',input_schema:S({title:str(''),date:str('YYYY-MM-DD'),start:str('HH:MM'),end:str('HH:MM')},['title','date','start'])},
 {name:'start_focus',description:'Open Study Space and start a focus timer.',input_schema:S({minutes:{type:'number'},topic:str('')})},
 {name:'open_app',description:'Open one of the user\'s apps: ghibli (Ghibli Calendar, synced with DABSy), study (Study Space), solve (SolveCount). Use when asked to open or show it.',input_schema:S({app:{type:'string',enum:['ghibli','study','solve']}},['app'])},
 {name:'remember',description:'Save a short durable fact about the user (preferences, exam dates, name). Only when it will help later.',input_schema:S({fact:str('one short sentence')},['fact'])}];
const bad=e=>({ok:false,error:e}),good=o=>({ok:true,...o});
const clean=s=>String(s??'').replace(/\s+/g,' ').trim().slice(0,140);
const find=id=>tasks.get().items.find(t=>t.id===id);
const upd=(id,p)=>tasks.set({items:tasks.get().items.map(t=>t.id===id?{...t,...p}:t)});
const pub=t=>({id:t.id,title:t.title,due:t.due||null,time:t.time||null,priority:t.priority,done:t.done});
function createExecutor(ui){
 return async function run(name,i={}){
  switch(name){
  case'create_task':{const title=clean(i.title);if(!title)return bad('title is required');if(i.due&&!D.test(i.due))return bad('due must be YYYY-MM-DD');if(i.time&&!T.test(i.time))return bad('time must be HH:MM');
    const t={id:uid('t_'),title,due:i.due||'',time:i.time||'',priority:PR.includes(i.priority)?i.priority:'normal',done:false,notes:clean(i.notes),created:Date.now()};
    tasks.set({items:[...tasks.get().items,t]});ui.card('task',`Added “${t.title}”${t.due?' · '+t.due:''}${t.time?' '+t.time:''}`);return good({task:pub(t)})}
  case'complete_task':{const t=find(i.id);if(!t)return bad('no task with that id');upd(t.id,{done:i.done!==false});ui.card('check',`${i.done===false?'Reopened':'Done'}: ${t.title}`);return good({task:pub(find(t.id))})}
  case'rename_task':{const t=find(i.id);const n=clean(i.title);if(!t||!n)return bad('no task with that id or empty title');upd(t.id,{title:n});ui.card('task',`Renamed to “${n}”`);return good({task:pub(find(t.id))})}
  case'set_priority':{const t=find(i.id);if(!t||!PR.includes(i.priority))return bad('bad id or priority');upd(t.id,{priority:i.priority});ui.card('task',`“${t.title}” → ${i.priority} priority`);return good({task:pub(find(t.id))})}
  case'move_task':{const t=find(i.id);if(!t||!D.test(i.due||''))return bad('bad id or due date');if(i.time&&!T.test(i.time))return bad('time must be HH:MM');upd(t.id,{due:i.due,time:i.time??t.time});ui.card('task',`Moved “${t.title}” to ${i.due}${i.time?' '+i.time:''}`);return good({task:pub(find(t.id))})}
  case'delete_task':{const t=find(i.id);if(!t)return bad('no task with that id');if(!await ui.confirmDelete(t))return bad('the user declined');tasks.set({items:tasks.get().items.filter(x=>x.id!==t.id)});ui.card('task',`Deleted “${t.title}”`);return good({deleted:t.id})}
  case'list_tasks':{const td=ymd(),it=tasks.get().items;const f={today:t=>!t.done&&t.due===td,upcoming:t=>!t.done&&t.due>td,all:t=>!t.done,done:t=>t.done}[i.scope]||(t=>!t.done);return good({tasks:it.filter(f).map(pub)})}
  case'add_event':{if(!clean(i.title)||!D.test(i.date||'')||!T.test(i.start||''))return bad('title, date (YYYY-MM-DD) and start (HH:MM) are required');if(i.end&&!T.test(i.end))return bad('end must be HH:MM');
    const e={id:uid('e_'),title:clean(i.title),date:i.date,start:i.start,end:i.end||''};events.set({items:[...events.get().items,e]});ui.card('cal',`Event “${e.title}” · ${e.date} ${e.start}`);return good({event:e})}
  case'plan_day':{if(!D.test(i.date||'')||!Array.isArray(i.items)||!i.items.length)return bad('date and items are required');
    const items=i.items.filter(x=>x&&clean(x.title)&&T.test(x.time||'')).map(x=>({title:clean(x.title),time:x.time,dur:Math.max(5,Math.min(480,+x.duration_min||30)),existing:x.existing_id&&find(x.existing_id)?x.existing_id:'',on:true}));
    if(!items.length)return bad('no valid items (need title and HH:MM time)');
    const out=await ui.confirmPlan({date:i.date,mood:clean(i.mood),items});if(!out)return bad('the user declined the plan');
    const saved=[];for(const x of out){if(x.existing){upd(x.existing,{due:i.date,time:x.time});saved.push({id:x.existing,title:x.title,time:x.time})}
      else{const t={id:uid('t_'),title:x.title,due:i.date,time:x.time,priority:'normal',done:false,notes:'',created:Date.now(),dur:x.dur};tasks.set({items:[...tasks.get().items,t]});saved.push({id:t.id,title:t.title,time:t.time})}}
    ui.card('cal',`Saved ${saved.length} item${saved.length===1?'':'s'} for ${i.date}`);return good({saved})}
  case'start_focus':{ui.focus(Math.max(5,Math.min(180,+i.minutes||25)),clean(i.topic));return good({started:true})}
  case'open_app':{if(!['ghibli','study','solve'].includes(i.app))return bad('unknown app');ui.app?.(i.app);return good({opened:i.app})}
  case'remember':{const f=clean(i.fact);if(!f)return bad('empty fact');const m=memory.get().facts;if(!m.includes(f))memory.set({facts:[...m,f].slice(-25)});return good({saved:true})}
  default:return bad('unknown tool '+name)}}}
const LEN={concise:'Default to 1–3 sentences; expand only if asked.',balanced:'Simple questions: 1–3 sentences. "Explain/how/why": a clear explanation, usually 1–4 short paragraphs. Never pad.',detailed:'Thorough, well-structured explanations with examples; stay skimmable (short headings, lists).'};
const LANG={auto:'Mirror the user’s language and script each turn (English, Hindi, Marathi, Hinglish in Roman script). Do not switch language on your own.',en:'Reply in English.',hi:'Reply in Hindi (Devanagari) unless the user writes otherwise.',mr:'Reply in Marathi (Devanagari) unless the user writes otherwise.',hinglish:'Reply in Hinglish (Hindi in Roman script mixed with English).'};
function buildSystem({studyMode}){
 const now=new Date(),td=ymd(now),p=prefs.get();
 const open=tasks.get().items.filter(t=>!t.done).sort((a,b)=>(a.due||'9')+(a.time||'99')<(b.due||'9')+(b.time||'99')?-1:1).slice(0,40).map(t=>`- [${t.id}] ${t.title} | due ${t.due||'none'}${t.time?' '+t.time:''} | ${t.priority}`).join('\n');
 const ev=events.get().items.filter(e=>e.date>=td&&e.date<=ymd(new Date(+now+7*864e5))).sort((a,b)=>(a.date+a.start<b.date+b.start?-1:1)).map(e=>`- ${e.date} ${e.start}${e.end?'–'+e.end:''} ${e.title}`).join('\n');
 const sl=study.get().log,mins=sl[td]||0,wk=Object.entries(sl).filter(([d])=>d>=ymd(new Date(+now-6*864e5))).reduce((a,[,v])=>a+v,0);
 const facts=memory.get().facts.map(f=>'- '+f).join('\n');
 return[`You are DABSy: a small, fluffy midnight creature who lives in the user's phone — their butler and study buddy. Curious, warm, quick, occasionally funny, calm when the moment needs it.
VOICE: plainspoken and natural; no canned openers ("Great question!", "Sure!"), no repetitive greetings, not relentlessly cheerful. Use emoji sparingly (task titles may carry one fitting emoji). ${LANG[p.lang]||LANG.auto}
LENGTH: ${LEN[p.style]||LEN.balanced}
HONESTY: be correct before charming; say so if unsure; never invent facts, links or data about the user. You have no live web access.
INTENT: tell casual chat, questions, study requests, planning and task commands apart. Follow-ups build on the conversation. After a substantial explanation, do NOT force study mode; the app offers it.`,
`BUTLER (tools act on the user's real data)
- create_task = exactly ONE task; several named tasks → several calls. Do not ask category/priority questions; "tomorrow" etc. resolve to YYYY-MM-DD from today's date below.
- plan_day for planning a day: use the snapshot (open tasks, calendar), find free time between about 08:00–21:00, balance focus work, breaks, meals and enjoyable things that match the mood (e.g. a "Ghibli day": slow morning tea, a walk, sketching, a cozy reading hour, a favourite film in the evening). Reuse open tasks via existing_id; do not ask how many hours to study. The user reviews and confirms in the app — never fake a plan with create_task calls.
- Change tasks only by id from the snapshot; if several could match, ask which.
- After tools run, state only what the results say. If ok:false or the user declined, say so plainly. Never claim an action succeeded without ok:true.
- No tools for chit-chat. For "what's on today" answer from the snapshot.
- remember: only for durable facts the user shares.`,
studyMode?`STUDY MODE IS ON — be a tutor: one idea at a time (idea → example → one short check question). "Simplify" = everyday words + analogy; "go deeper" = why it works, edge cases. When asked to practise, ask questions one at a time in text and wait for the answer. Suggest start_focus for a timed session when it fits.`:'',
`CURRENT CONTEXT\nToday: ${td} (${now.toLocaleDateString('en',{weekday:'long'})}), local time ${now.toTimeString().slice(0,5)}, zone ${Intl.DateTimeFormat().resolvedOptions().timeZone}.\nOpen tasks:\n${open||'none'}\nCalendar (next 7 days, device only):\n${ev||'none'}\nStudy: ${mins} min today, ${wk} min this week.${facts?`\nKnown about the user:\n${facts}`:''}`].filter(Boolean).join('\n\n')}

return{get TOOLS(){return TOOLS},get createExecutor(){return createExecutor},get buildSystem(){return buildSystem}}})();
__m['chat.js']=(()=>{
const {$,chat:store,prefs,reduced,bus,ymd}=__m['state.js'];
const {stream,AIError,API,health}=__m['ai.js'];
const {TOOLS,buildSystem,createExecutor}=__m['tools.js'];
const esc=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
function inline(s){return esc(s).replace(/`([^`]+)`/g,'<code>$1</code>').replace(/\*\*([^*]+)\*\*/g,'<b>$1</b>').replace(/(^|[^*])\*([^*\s][^*]*)\*/g,'$1<i>$2</i>')}
function md(src){const out=[],L=src.replace(/\r/g,'').split('\n');let i=0,list=null;const close=()=>{if(list){out.push(`</${list}>`);list=null}};
 while(i<L.length){const l=L[i];
  if(/^```/.test(l)){close();const code=[];i++;while(i<L.length&&!/^```/.test(L[i]))code.push(L[i++]);i++;out.push(`<pre><code>${esc(code.join('\n'))}</code></pre>`);continue}
  let m;if(m=l.match(/^(#{1,3})\s+(.*)/)){close();out.push(`<h${m[1].length+2}>${inline(m[2])}</h${m[1].length+2}>`)}
  else if(m=l.match(/^\s*[-*•]\s+(.*)/)){if(list!=='ul'){close();out.push('<ul>');list='ul'}out.push(`<li>${inline(m[1])}</li>`)}
  else if(m=l.match(/^\s*\d+[.)]\s+(.*)/)){if(list!=='ol'){close();out.push('<ol>');list='ol'}out.push(`<li>${inline(m[1])}</li>`)}
  else if(!l.trim())close();else{close();out.push(`<p>${inline(l)}</p>`)}i++}
 close();return out.join('')}
const GREET={en:['Yaa?','Hmm?',"What's up?","I'm listening!",'Yes?','Right here.'],hi:['हाँ?','बोलो!','सुन रही हूँ!','क्या हुआ?'],mr:['बोल!','काय रे?','ऐकतेय!'],hinglish:['Haan?','Bolo na!','Sun rahi hoon!','Kya hua?']};
let lastG='';
function greeting(lastUser,away){const p=prefs.get().lang;let l=p==='auto'?(/[\u0900-\u097F]/.test(lastUser)?'hi':/\b(kya|hai|nahi|karo|bolo|haan|mujhe|yaar)\b/i.test(lastUser)?'hinglish':'en'):p;
 let pool=GREET[l]||GREET.en;if(away&&l==='en')pool=["Oh, you're back!",'Hey, there you are.'];if(new Date().getHours()>=23&&l==='en')pool=['Still up? Hmm?'];
 let g;do g=pool[Math.floor(Math.random()*pool.length)];while(g===lastG&&pool.length>1);lastG=g;return g}
const validStart=m=>m.role==='user'&&typeof m.content==='string';
function trim(api,max=50){let a=api.slice(-max);while(a.length&&!validStart(a[0]))a.shift();return a}
function createChat({host,hooks}){
 let api=trim(store.get().api||[],60),busy=false,ctl=null,pend=null,stick=true,study=!!store.get().study,asked=false,lastAt=Date.now();
 const back=$('button',{class:'ibtn glass',type:'button','aria-label':'Close chat',onclick:()=>hooks.close(),html:'<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M15 5l-7 7 7 7"/></svg>'});
 const pill=$('button',{class:'pill glass',type:'button','aria-pressed':String(study),onclick:()=>setStudy(!study)},'Study mode');
 const status=$('span',{class:'status'});
 const head=$('div',{class:'chat-head'},back,status,pill);
 const say=$('div',{class:'say glass','aria-live':'polite'});
 const msgs=$('div',{class:'msgs',role:'log','aria-live':'polite'});
 const jump=$('button',{class:'jump glass',type:'button',onclick:()=>toBottom(true)},'↓');
 const ta=$('textarea',{class:'ta',rows:1,placeholder:'Message DABSy…','aria-label':'Message',enterkeyhint:'send',autocapitalize:'sentences'});
 const send=$('button',{class:'send',type:'button','aria-label':'Send'},'↑');
 const comp=$('div',{class:'composer'},ta,send);
 const card=$('div',{class:'card glass strong'},msgs,jump,comp);
 host.append(head,say,card);
 function setStudy(v){study=v;store.set({study});pill.setAttribute('aria-pressed',String(v));card.classList.toggle('study',v);ta.placeholder=v?'What are we learning?':'Message DABSy…';status.textContent=v?'Study mode':'';renderChips()}
 setStudy(study);
 const near=()=>msgs.scrollHeight-msgs.scrollTop-msgs.clientHeight<90;
 msgs.addEventListener('scroll',()=>{stick=near();jump.dataset.on=stick?'0':'1'},{passive:true});
 function toBottom(smooth){msgs.scrollTo({top:msgs.scrollHeight,behavior:smooth&&!reduced()?'smooth':'auto'});stick=true}
 new ResizeObserver(()=>{if(stick)msgs.scrollTop=msgs.scrollHeight}).observe(msgs);
 new ResizeObserver(()=>{if(stick)msgs.scrollTop=msgs.scrollHeight}).observe(comp);
 const grow=()=>{ta.style.height='auto';ta.style.height=Math.min(ta.scrollHeight,Math.max(96,host.clientHeight*.3))+'px'};
 ta.addEventListener('input',()=>{grow();send.dataset.on=ta.value.trim()?'1':'0';hooks.typing?.()});
 ta.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&matchMedia('(pointer: fine)').matches){e.preventDefault();go()}});
 const go=()=>{if(busy){ctl?.abort();return}const t=ta.value;if(!t.trim())return;ta.value='';grow();send.dataset.on='0';submit(t)};
 send.addEventListener('click',go);
 const el={user:t=>$('div',{class:'msg user'},$('div',{class:'bub'},t)),bot:()=>$('div',{class:'msg bot'})};
 function addUser(t){msgs.querySelector('.empty')?.remove();msgs.querySelector('.chips')?.remove();msgs.append(el.user(t));stick=true;toBottom()}
 function newBot(){const m=el.bot();msgs.append(m);return m}
 const paint=(box,t)=>{box.innerHTML=md(t);if(stick)msgs.scrollTop=msgs.scrollHeight};
 function card_(kind,text){const c=$('div',{class:'acard '+kind},$('i',{class:'ac-i'},{task:'＋',check:'✓',cal:'◷'}[kind]||'•'),$('span',{},text));msgs.append(c);if(stick)toBottom()}
 const ui={card:card_,focus:(m,t)=>hooks.focus(m,t),
  confirmDelete:t=>new Promise(res=>{pend=res;const c=$('div',{class:'acard ask'},$('span',{},`Delete “${t.title}”?`),$('div',{class:'btns'},$('button',{class:'btn',onclick:()=>{pend=null;c.remove();res(false)}},'Keep'),$('button',{class:'btn danger',onclick:()=>{pend=null;c.remove();res(true)}},'Delete')));msgs.append(c);toBottom()}),
  confirmPlan:plan=>new Promise(res=>{pend=res;const rows=plan.items.map(it=>{const cb=$('input',{type:'checkbox',checked:true,'aria-label':'Include'}),tm=$('input',{type:'time',value:it.time,'aria-label':'Time'}),ti=$('input',{type:'text',value:it.title,maxlength:140,'aria-label':'Title'});return{it,cb,tm,ti,row:$('div',{class:'prow'},cb,tm,ti)}});
   const d=new Date(plan.date+'T12:00'),c=$('div',{class:'plan'},$('div',{class:'plan-h'},$('b',{},d.toLocaleDateString([],{weekday:'long',day:'numeric',month:'short'})),plan.mood?$('span',{},plan.mood):null),...rows.map(r=>r.row),
    $('div',{class:'btns'},$('button',{class:'btn',onclick:()=>{pend=null;c.classList.add('done');res(null)}},'Not now'),$('button',{class:'btn primary',onclick:()=>{pend=null;c.classList.add('done');res(rows.filter(r=>r.cb.checked&&r.ti.value.trim()&&r.tm.value).map(r=>({...r.it,title:r.ti.value.trim(),time:r.tm.value})))}},'Save plan')));msgs.append(c);toBottom()})};
 ui.app=k=>hooks.app?.(k);
 const run=createExecutor(ui);
 function errBox(e,text){const cfg=e.kind==='config';const box=$('div',{class:'msg bot'},$('div',{class:'err'},cfg?'I can’t reach my brain yet — this build has no AI backend address set (config.json → apiUrl). Tasks, calendar, study timer and widgets still work.':e.kind==='aborted'?'Stopped.':e.message||'Something went wrong.',
  e.kind==='aborted'||cfg?null:$('button',{class:'btn sm',onclick:()=>{box.remove();submit(text,true)}},'Try again')));msgs.append(box);toBottom()}
 async function submit(text,retry=false){if(busy)return;busy=true;asked=false;send.dataset.busy='1';send.textContent='■';send.setAttribute('aria-label','Stop');hooks.state('thinking');
  if(!retry)addUser(text);const start=api.length;api.push({role:'user',content:text});let called=0,lastText='';
  const dots=$('div',{class:'msg bot'},$('div',{class:'typing'},$('i'),$('i'),$('i')));msgs.append(dots);toBottom();ctl=new AbortController();
  try{for(let round=0;round<6;round++){const box=$('div',{class:'bubbot'});let placed=false;
    const r=await stream({system:buildSystem({studyMode:study}),messages:trim(api),tools:TOOLS,signal:ctl.signal,onText:t=>{if(!placed){placed=true;dots.remove();const m=newBot();m.append(box)}hooks.state('answering');paint(box,t)}});
    const blocks=[];if(r.text.trim())blocks.push({type:'text',text:r.text});for(const c of r.calls)blocks.push({type:'tool_use',id:c.id,name:c.name,input:c.input&&typeof c.input==='object'?c.input:{}});
    if(!blocks.length){blocks.push({type:'text',text:'…'})}
    lastText=r.text;api.push({role:'assistant',content:blocks});
    if(!r.calls.length)break;dots.parentNode||msgs.append(dots);hooks.state('thinking');
    const results=[];for(const c of blocks.filter(b=>b.type==='tool_use')){let res;try{res=await run(c.name,c.input)}catch(x){res={ok:false,error:String(x?.message||x)}}if(res.ok)called++;
     results.push({type:'tool_result',tool_use_id:c.id,content:JSON.stringify(res),...(res.ok?{}:{is_error:true})})}
    api.push({role:'user',content:results})}
   store.set({api:api.slice(-60)});hooks.state(called?'happy':'idle');
   if(!study&&!called&&lastText.length>380&&/explain|what is|what are|how does|how do|why|define|derive|समझ|क्या है|कैसे|कसे|काय आहे|samjh|kya hai|kaise/i.test(text)&&!asked){asked=true;followup(text)}}
  catch(e){api.length=start;const ae=e instanceof AIError?e:new AIError('server',e?.message||'Something went wrong.');if(ae.kind!=='aborted')hooks.state('confused');else hooks.state('idle');errBox(ae,text)}
  finally{busy=false;ctl=null;if(pend){pend(null);pend=null}dots.remove();send.dataset.busy='0';send.textContent='↑';send.setAttribute('aria-label','Send');lastAt=Date.now()}}
 function followup(t){const hi=/[\u0900-\u097F]/.test(t),line=hi?'वैसे, क्या तुम इसे अभी पढ़ रहे हो, या बस जिज्ञासा है?':'By the way — are you studying this right now, or just curious?';
  const c=$('div',{class:'follow'},$('span',{},line),$('div',{class:'btns'},$('button',{class:'btn primary sm',onclick:()=>{c.remove();setStudy(true);submit(hi?'हाँ, मैं यह पढ़ रहा हूँ। इसे सरल कदमों में सिखाओ।':'Yes, I’m studying this — teach it to me step by step.')}},'Start Study Mode'),$('button',{class:'btn sm',onclick:()=>c.remove()},'Just curious')));msgs.append(c);toBottom()}
 function renderChips(){msgs.querySelector('.chips')?.remove();if(!study||msgs.querySelector('.msg.user'))return;const c=$('div',{class:'chips'},...['Explain a topic simply','Quiz me on something','Help with homework'].map(t=>$('button',{class:'btn sm',onclick:()=>{ta.value=t+': ';ta.focus({preventScroll:true});send.dataset.on='1'}},t)));msgs.append(c)}
 function empty(){if(msgs.children.length)return;msgs.append($('div',{class:'empty'},$('b',{},'Ask me anything'),$('span',{},'Explain a topic, plan a day, add a task, or just chat — in English, हिंदी, मराठी or Hinglish.')))}
 function rebuild(){msgs.replaceChildren();for(const m of api){if(m.role==='user'&&typeof m.content==='string')msgs.append(el.user(m.content));else if(m.role==='assistant'&&Array.isArray(m.content)){const t=m.content.filter(b=>b.type==='text').map(b=>b.text).join('\n').trim();if(t&&t!=='…'){const b=newBot(),bb=$('div',{class:'bubbot'});bb.innerHTML=md(t);b.append(bb)}}}empty();renderChips()}
 rebuild();
 return{open(){const lastUser=[...api].reverse().find(validStart)?.content||'';const away=Date.now()-lastAt>10*60*1000;say.textContent=greeting(lastUser,away);say.dataset.on='1';setTimeout(()=>say.dataset.on='0',2800);rebuild();requestAnimationFrame(()=>{toBottom();status.textContent=study?'Study mode':''});
   health().then(h=>{if(!h.ok&&!study)status.textContent=h.reason==='not-configured'?'Brain not connected':'Offline'}).catch(()=>{})},
  focus:()=>ta.focus({preventScroll:true}),blur:()=>ta.blur(),get busy(){return busy},ask:t=>submit(t),clear(){api=[];store.set({api:[]});rebuild()},setStudy,get input(){return ta}}}

return{get md(){return md},get trim(){return trim},get createChat(){return createChat}}})();
__m['layers.js']=(()=>{
/* Back-button layers. Every open layer owns exactly one history entry. History ops are serialised
   (back() is async) so closing one layer and opening another in the same tick cannot corrupt history. */
const st=[],q=[];let busy=false,guard=0;
function run(){while(!busy&&q.length){const o=q.shift();if(o==='push'){try{history.pushState({d:1},'')}catch{}}else{busy=true;clearTimeout(guard);guard=setTimeout(()=>{if(busy){busy=false;run()}},700);try{history.back()}catch{busy=false}}}}
function pushLayer(close){const l={close};st.push(l);q.push('push');run();return l}
function popLayer(l){const i=st.indexOf(l);if(i<0)return;st.splice(i,1);q.push('back');run()}
addEventListener('popstate',()=>{if(busy){busy=false;clearTimeout(guard);run();return}const l=st.pop();l?.close(true)});
const hasLayer=()=>st.length>0;

return{get pushLayer(){return pushLayer},get popLayer(){return popLayer},get hasLayer(){return hasLayer}}})();
__m['spots.js']=(()=>{
/* Environment awareness: sitting-spot registry mapped onto the REAL rendered scene.
   image coords -> screen via the same "cover" transform the CSS background uses. */
const REF_Y=.72,HORIZON=.28;               // perspective: scale 1 at ny=.72, 0 at the horizon
const WEIGHTS={rest:{sleepy:6,affectionate:2,idle:1,night:3},work:{focused:5,curious:2,idle:1.5},look:{curious:4,idle:2,excited:2,day:2},open:{playful:4,excited:3,idle:1}};
let DB=null,scene='',natural={w:9,h:16},reg=[],W=0,H=0,dw=0,L={},cache={};
async function initSpots(){try{DB=await(await fetch('./spots.json')).json()}catch{DB={}}}
const persp=ny=>Math.min(1.1,Math.max(.55,(ny-HORIZON)/(REF_Y-HORIZON)));
/* read the actual pixels: strongest horizontal edge within +-3% of the declared surface line */
async function edgeOf(url,s){
  const k=url+s.id;if(k in cache)return cache[k];
  const im=await new Promise(r=>{const i=new Image();i.onload=()=>r(i);i.onerror=()=>r(null);i.src=url});if(!im)return cache[k]=null;
  const cw=160,ch=Math.round(160*im.naturalHeight/im.naturalWidth),c=document.createElement('canvas');c.width=cw;c.height=ch;const g=c.getContext('2d',{willReadFrequently:true});g.drawImage(im,0,0,cw,ch);
  const d=g.getImageData(0,0,cw,ch).data,lum=(x,y)=>d[(y*cw+x)*4]*.3+d[(y*cw+x)*4+1]*.59+d[(y*cw+x)*4+2]*.11,xa=Math.floor(s.x0*cw),xb=Math.ceil(s.x1*cw);
  const row=y=>{let a=0;for(let x=xa;x<xb;x++)a+=Math.abs(lum(x,Math.min(ch-1,y+1))-lum(x,Math.max(0,y-1)));return a/(xb-xa)};
  const y0=Math.max(2,Math.floor((s.y-.03)*ch)),y1=Math.min(ch-3,Math.ceil((s.y+.03)*ch));let best=-1,bs=0,sum=0,n=0;
  for(let y=y0;y<=y1;y++){const v=row(y);sum+=v;n++;if(v>bs){bs=v;best=y}}
  const conf=n?bs/(sum/n+1e-6):0;natural={w:im.naturalWidth,h:im.naturalHeight};return cache[k]={ny:(best+.5)/ch,conf,nat:natural}}
async function setScene(name){
  scene=name;const url=`./scene-${name}-day.webp`,out=[];
  for(const s of DB[name]||[]){const sp={...s,scene:name,snapped:false,conf:1,valid:true};
    if(!s.soft){const e=await edgeOf(url,s);if(e){natural=e.nat;if(e.conf>=1.35){sp.y=e.ny;sp.snapped=true;sp.conf=e.conf}else sp.valid=false}else sp.valid=false}
    else{await edgeOf(url,s)}
    out.push(sp)}
  reg=out;if(W)layout(W,H,L.dabsyW)}
/* map to screen with background-size:cover, centred */
function layout(w,h,dabsyW=100){W=w;H=h;L.dabsyW=dabsyW;const s=Math.max(w/natural.w,h/natural.h),iw=natural.w*s,ih=natural.h*s,ox=(w-iw)/2,oy=(h-ih)/2;dw=iw;
  for(const p of reg){const sc=persp(p.y),sx0=ox+p.x0*iw,sx1=ox+p.x1*iw,mx=8;p.scale=sc;p.sy=oy+p.y*ih;p.sx0=Math.max(sx0,mx);p.sx1=Math.min(sx1,w-mx);p.sw=p.sx1-p.sx0;p.cx=(p.sx0+p.sx1)/2;
   p.needs=dabsyW*sc*1.05;p.fits=p.valid&&p.sw>=p.needs&&p.sy>60&&p.sy<h-20;p.room=p.sw-p.needs}}
const list=()=>reg.filter(p=>p.fits);
const all=()=>reg;
const home=()=>list().find(p=>p.home)||list()[0]||null;
const byId=id=>reg.find(p=>p.id===id);
/* where can she stand at screen x,y (bottom-centre)? choose the surface just below her; else home */
function groundAt(x,y){let best=null;for(const p of list()){const m=Math.min(p.needs*.3,p.sw*.15);if(x>=p.sx0+m-4&&x<=p.sx1-m+4&&p.sy>=y-6&&(!best||p.sy<best.sy))best=p}return best}
function spotAt(x,y){return list().find(p=>Math.abs(p.sy-y)<3&&x>=p.sx0-4&&x<=p.sx1+4)||null}
/* a standing x on a spot: keep a margin so she is fully on the surface */
function standX(p,prefX){const m=p.needs/2;return Math.min(p.sx1-m,Math.max(p.sx0+m,prefX??p.cx))}
function pick({state='idle',night=false,exclude=null,avoid=[]}){
  const c=list().filter(p=>p!==exclude&&!avoid.some(r=>{const x=p.cx,hw=p.needs/2,hh=p.needs*1.05;return !(x+hw<r.x||x-hw>r.x+r.w||p.sy<r.y||p.sy-hh>r.y+r.h)}));
  if(!c.length)return null;const ws=c.map(p=>{const t=WEIGHTS[p.kind]||{};return .3+(t[state]||0)+(night?t.night||0:t.day||0)+(t.idle||0)});
  let r=Math.random()*ws.reduce((a,b)=>a+b,0);for(let i=0;i<c.length;i++){r-=ws[i];if(r<=0)return c[i]}return c[c.length-1]}
/* nearest surface she can still reach when nothing is directly beneath her (used to steer a fall) */
function catchSpot(x,y){const c=list().filter(p=>p.sy>=y-6);if(!c.length)return home();let b=null,bd=1e9;for(const p of c){const d=x<p.sx0?p.sx0-x:x>p.sx1?x-p.sx1:0,dd=d+(p.sy-y)*.15;if(dd<bd){bd=dd;b=p}}return b}

return{get initSpots(){return initSpots},get setScene(){return setScene},get layout(){return layout},get list(){return list},get all(){return all},get home(){return home},get byId(){return byId},get groundAt(){return groundAt},get spotAt(){return spotAt},get standX(){return standX},get pick(){return pick},get catchSpot(){return catchSpot}}})();
__m['panels.js']=(()=>{
const {$,prefs,tasks,events,study,memory,widgets,chat,ymd,uid,bus,reduced}=__m['state.js'];
const {pushLayer,popLayer}=__m['layers.js'];
const {resetAll}=__m['store.js'];
const {health,API}=__m['ai.js'];
const root=()=>document.querySelector('.sheet-root');
let cur=null;
function sheet(title,build){cur?.close(true);const bd=$('div',{class:'backdrop'}),sh=$('section',{class:'sheet glass strong',role:'dialog','aria-label':title}),body=$('div',{class:'sbody'});
 let layer,closed=false;const close=(fromHist)=>{if(closed)return;closed=true;sh.classList.remove('in');bd.classList.remove('in');if(!fromHist)popLayer(layer);setTimeout(()=>{sh.remove();bd.remove()},reduced()?0:300);if(cur===api)cur=null;api.onclose?.()};
 const api={close,body,onclose:null};layer=pushLayer(close);
 sh.append($('div',{class:'grab'}),$('header',{class:'shead'},$('h2',{},title),$('button',{class:'ibtn',type:'button','aria-label':'Close',onclick:()=>close(),html:'✕'})),body);
 bd.addEventListener('pointerdown',()=>close());root().append(bd,sh);const off=build(body,api);api.onclose=typeof off==="function"?off:null;requestAnimationFrame(()=>{sh.classList.add('in');bd.classList.add('in')});
 /* swipe-down to dismiss from grab/header */
 let y0=null,dy=0;const h=sh.querySelector('.shead'),g=sh.querySelector('.grab');
 for(const e of[h,g]){e.addEventListener('pointerdown',ev=>{if(ev.target.closest('button'))return;y0=ev.clientY;dy=0;sh.style.transition='none';e.setPointerCapture(ev.pointerId)});
  e.addEventListener('pointermove',ev=>{if(y0==null)return;dy=Math.max(0,ev.clientY-y0);sh.style.transform=`translateY(${dy}px)`});
  const up=()=>{if(y0==null)return;y0=null;sh.style.transition='';sh.style.transform='';if(dy>110)close()};e.addEventListener('pointerup',up);e.addEventListener('pointercancel',up)}
 cur=api;return api}
const seg=(opts,val,fn)=>{const w=$('div',{class:'seg',role:'group'});for(const[v,l]of opts){const b=$('button',{type:'button','aria-pressed':String(v===val),onclick:()=>{[...w.children].forEach(c=>c.setAttribute('aria-pressed','false'));b.setAttribute('aria-pressed','true');fn(v)}},l);w.append(b)}return w};
const sw=(v,fn,label)=>{const b=$('button',{class:'switch',type:'button',role:'switch','aria-checked':String(!!v),'aria-label':label,onclick:()=>{const n=b.getAttribute('aria-checked')!=='true';b.setAttribute('aria-checked',String(n));fn(n)}});return b};
const row=(l,c,sub)=>$('div',{class:'srow'},$('div',{},$('b',{},l),sub?$('small',{},sub):null),c);
const sec=(t,...k)=>$('section',{class:'ssec'},$('h3',{},t),...k);
/* ---------- Tasks ---------- */
function tasksPanel(){return sheet('Tasks',(b)=>{const list=$('div',{class:'tlist'}),inp=$('input',{class:'inp',type:'text',placeholder:'Add a task…',maxlength:140,enterkeyhint:'done'}),due=$('input',{class:'inp sm',type:'date','aria-label':'Due date'});
 const add=()=>{const t=inp.value.trim();if(!t)return;tasks.set({items:[...tasks.get().items,{id:uid('t_'),title:t,due:due.value,time:'',priority:'normal',done:false,notes:'',created:Date.now()}]});inp.value='';due.value=''};
 inp.addEventListener('keydown',e=>e.key==='Enter'&&add());
 const draw=()=>{const td=ymd(),it=tasks.get().items,g=(t,f)=>({t,l:it.filter(f)});const G=[g('Today',x=>!x.done&&x.due&&x.due<=td),g('Upcoming',x=>!x.done&&x.due>td),g('Anytime',x=>!x.done&&!x.due),g('Done',x=>x.done)];list.replaceChildren();
  for(const{t,l}of G){if(!l.length)continue;list.append($('h4',{},t));for(const x of l.sort((a,c)=>(a.due+a.time<c.due+c.time?-1:1)))list.append($('div',{class:'trow'+(x.done?' done':'')},
   $('button',{class:'chk',type:'button','aria-label':x.done?'Mark not done':'Mark done',onclick:()=>tasks.set({items:tasks.get().items.map(y=>y.id===x.id?{...y,done:!y.done}:y)})},x.done?'✓':''),
   $('div',{class:'tmain'},$('span',{},x.title),$('small',{},[x.due,x.time].filter(Boolean).join(' ')||'no date')),
   $('button',{class:'dot '+x.priority,type:'button','aria-label':'Priority '+x.priority,onclick:()=>tasks.set({items:tasks.get().items.map(y=>y.id===x.id?{...y,priority:{high:'low',low:'normal',normal:'high'}[y.priority]}:y)})}),
   $('button',{class:'ibtn sm',type:'button','aria-label':'Delete',onclick:()=>tasks.set({items:tasks.get().items.filter(y=>y.id!==x.id)}),html:'✕'})))}
  if(!list.children.length)list.append($('div',{class:'emptyp'},'No tasks yet. Add one above, or just tell DABSy.'))};
 b.append($('div',{class:'addrow'},inp,due,$('button',{class:'btn primary',type:'button',onclick:add},'Add')),list);draw();const off=tasks.on(draw);return off})}
/* ---------- Calendar ---------- */
function calendarPanel(){return sheet('Calendar',b=>{const list=$('div',{class:'tlist'}),t=$('input',{class:'inp',placeholder:'Event title',maxlength:100}),d=$('input',{class:'inp sm',type:'date',value:ymd()}),s=$('input',{class:'inp sm',type:'time',value:'16:00'});
 const draw=()=>{list.replaceChildren();const td=ymd();const days={};for(const e of events.get().items)if(e.date>=td)(days[e.date]??=[]).push({id:e.id,t:e.start,x:e.title,ev:1});for(const k of tasks.get().items)if(!k.done&&k.due>=td&&k.time)(days[k.due]??=[]).push({t:k.time,x:k.title});
  for(const dd of Object.keys(days).sort().slice(0,30)){list.append($('h4',{},new Date(dd+'T12:00').toLocaleDateString([],{weekday:'long',day:'numeric',month:'short'})+(dd===td?' · today':'')));for(const e of days[dd].sort((a,c)=>a.t<c.t?-1:1))list.append($('div',{class:'trow'},$('b',{class:'tm'},e.t),$('div',{class:'tmain'},$('span',{},e.x),$('small',{},e.ev?'event':'task')),e.ev?$('button',{class:'ibtn sm',type:'button','aria-label':'Delete event',onclick:()=>events.set({items:events.get().items.filter(y=>y.id!==e.id)}),html:'✕'}):null))}
  if(!list.children.length)list.append($('div',{class:'emptyp'},'Nothing scheduled. Add an event or ask DABSy to plan your day.'))};
 b.append($('div',{class:'addrow wrap'},t,d,s,$('button',{class:'btn primary',type:'button',onclick:()=>{if(!t.value.trim()||!d.value||!s.value)return;events.set({items:[...events.get().items,{id:uid('e_'),title:t.value.trim(),date:d.value,start:s.value,end:''}]});t.value=''}},'Add')),$('p',{class:'note'},'Events are stored on this device.'),list);draw();const a=events.on(draw),c=tasks.on(draw);return()=>{a();c()}})}
/* ---------- Study Space (real timer, logs minutes) ---------- */
const timer={total:0,end:0,left:0,running:false,topic:'',startedAt:0};
let tick=0;
const logMin=m=>{if(m<=0)return;const k=ymd();study.set({log:{...study.get().log,[k]:(study.get().log[k]||0)+m}})};
function finish(done){clearInterval(tick);tick=0;const el=timer.total-(timer.running?Math.max(0,Math.round((timer.end-Date.now())/1000)):timer.left);logMin(Math.round(el/60));const was=done;timer.running=false;timer.total=0;bus.emit('study-tick');if(was)bus.emit('study-done')}
function startTimer(min,topic=''){if(timer.total)finish(false);timer.total=min*60;timer.left=timer.total;timer.end=Date.now()+timer.total*1000;timer.running=true;timer.topic=topic;clearInterval(tick);tick=setInterval(()=>{if(timer.running){timer.left=Math.max(0,Math.round((timer.end-Date.now())/1000));if(timer.left<=0)finish(true)}bus.emit('study-tick')},1000);bus.emit('study-tick')}
function studyPanel(min,topic){return sheet('Study Space',b=>{const big=$('div',{class:'bigtime'}),sub=$('div',{class:'note'}),ctl=$('div',{class:'btns center'}),top=$('input',{class:'inp',placeholder:'What are you studying?',maxlength:80,value:topic||timer.topic||''}),bars=$('div',{class:'bars'});let m=min||25;
 const fmt=s=>`${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
 const draw=()=>{const run=timer.total>0;big.textContent=fmt(run?timer.left:m*60);sub.textContent=run?(timer.running?'Focus… I’ll keep you company.':'Paused'):'';ctl.replaceChildren();
  if(!run){ctl.append(seg([[15,'15'],[25,'25'],[45,'45']],m,v=>{m=v;draw()}),$('button',{class:'btn primary',type:'button',onclick:()=>startTimer(m,top.value.trim())},'Start'))}
  else ctl.append($('button',{class:'btn',type:'button',onclick:()=>{if(timer.running){timer.left=Math.max(0,Math.round((timer.end-Date.now())/1000));timer.running=false}else{timer.end=Date.now()+timer.left*1000;timer.running=true}draw()}},timer.running?'Pause':'Resume'),$('button',{class:'btn danger',type:'button',onclick:()=>{finish(false);draw()}},'Stop & log'));
  bars.replaceChildren();const L=study.get().log;let mx=30;const days=[...Array(7)].map((_,i)=>{const d=new Date(Date.now()-(6-i)*864e5);const k=ymd(d);mx=Math.max(mx,L[k]||0);return{k,d,v:L[k]||0}});for(const x of days)bars.append($('div',{class:'bcol'},$('i',{style:`height:${Math.max(4,x.v/mx*100)}%`,title:x.v+' min'}),$('small',{},x.d.toLocaleDateString([],{weekday:'narrow'}))));
  sub.textContent+=` Today: ${L[ymd()]||0} min`};
 b.append(top,big,ctl,sub,sec('Last 7 days',bars),$('p',{class:'note'},'Minutes are logged when you stop or finish a session. Ask DABSy to explain anything while you study.'));draw();const o=bus.on('study-tick',draw),p=study.on(draw);return()=>{o();p()}})}
/* ---------- Settings ---------- */
function settingsPanel({scenes,onReplay,onScene,widgetsReset,notifyPerm}){return sheet('Settings',b=>{const P=prefs.get(),set=p=>prefs.set(p);
 const st=$('small',{},'Checking…');health().then(h=>st.textContent=h.ok?`Connected${h.model?' · '+h.model:''}`:h.reason==='not-configured'?'No AI backend configured (config.json → apiUrl)':'Backend unreachable');
 const mem=$('div',{class:'mem'});const drawMem=()=>{mem.replaceChildren();const f=memory.get().facts;if(!f.length)mem.append($('small',{},'Nothing remembered yet. DABSy only remembers durable facts you share.'));f.forEach((x,i)=>mem.append($('div',{class:'trow'},$('div',{class:'tmain'},$('span',{},x)),$('button',{class:'ibtn sm',type:'button','aria-label':'Forget',onclick:()=>{memory.set({facts:f.filter((_,j)=>j!==i)});drawMem()},html:'✕'}))))};drawMem();
 const sc=$('div',{class:'scenes'},...Object.entries(scenes).map(([k,v])=>$('button',{class:'scn',type:'button','aria-pressed':String(P.scene===k),onclick:e=>{sc.querySelectorAll('.scn').forEach(c=>c.setAttribute('aria-pressed','false'));e.currentTarget.setAttribute('aria-pressed','true');onScene(k)}},$('img',{src:`./scene-${k}-day.webp`,alt:'',loading:'lazy'}),$('span',{},v))));
 const conf=$('button',{class:'btn danger',type:'button'},'Erase everything');let armed=0;conf.onclick=()=>{if(!armed){armed=1;conf.textContent='Tap again to erase everything';setTimeout(()=>{armed=0;conf.textContent='Erase everything'},4000);return}resetAll();location.reload()};
 b.append(
  sec('Appearance',sc,row('Time of day',seg([['auto','Auto'],['day','Day'],['night','Night']],P.tod,v=>set({tod:v})))),
  sec('Companion',row('Attention nudges',sw(P.nudges,v=>set({nudges:v}),'Attention nudges'),'DABSy may rarely look for you after a long quiet spell'),row('Replay the intro',$('button',{class:'btn sm',type:'button',onclick:()=>{set({onboarded:false});onReplay()}},'Replay'))),
  sec('Animations',row('Reduced motion',seg([['auto','Auto'],['reduced','On'],['full','Off']],P.motion,v=>set({motion:v})),'Auto follows your phone’s setting')),
  sec('Widgets',row('Remove all widgets',$('button',{class:'btn sm',type:'button',onclick:widgetsReset},'Clear')),$('small',{},'Add widgets from the Widgets bubble; drag one back into the tray to remove it.')),
  sec('Notifications',row('Reminders',sw(P.notif,v=>set({notif:v}),'Reminders'),'Tasks with a time and events, while the app is open'),row('Phone notifications',$('button',{class:'btn sm',type:'button',onclick:notifyPerm},'Allow'))),
  sec('Chat',row('Language',seg([['auto','Auto'],['en','EN'],['hi','हिं'],['mr','मरा'],['hinglish','Hing']],P.lang,v=>set({lang:v}))),row('Answers',seg([['concise','Short'],['balanced','Balanced'],['detailed','Deep']],P.style,v=>set({style:v})))),
  sec('Intelligence',row('AI connection',st),$('h4',{},'What DABSy remembers'),mem),
  sec('Accessibility',row('Text size',seg([[.9,'S'],[1,'M'],[1.15,'L'],[1.3,'XL']],P.text,v=>set({text:v})))),
  sec('Privacy',$('small',{},'Everything is stored on this device. Messages go to the AI backend only to answer you.'),row('Clear chat history',$('button',{class:'btn sm',type:'button',onclick:()=>{bus.emit('chat-clear')}},'Clear')),row('Forget all memories',$('button',{class:'btn sm',type:'button',onclick:()=>{memory.set({facts:[]});drawMem()}},'Forget')),conf))})}

/* ---------- Connected apps: Ghibli Calendar / Study Space / SolveCount (postMessage bridge) ---------- */
const ORIGIN='https://swagatgaikwad92-boop.github.io';
const APPS={ghibli:{name:'Ghibli Calendar',emoji:'🌿',url:ORIGIN+'/Ghibli-Calander/',note:'Synced events & tasks'},study:{name:'Study Space',emoji:'📚',url:ORIGIN+'/study-space/',note:'Minutes feed your progress'},solve:{name:'SolveCount',emoji:'🧮',url:ORIGIN+'/SolveCount/',note:'Practice & solving'}};
const DR=/^\d{4}-\d{2}-\d{2}$/,TR=/^\d{2}:\d{2}$/,cl_=v=>String(v??'').replace(/\s+/g,' ').trim().slice(0,140);
function snapshot(){const L=study.get().log,td=ymd();return{dabsy:1,type:'state',today:td,night:document.getElementById('app')?.dataset.night==='1',
 tasks:tasks.get().items.map(t=>({id:t.id,title:t.title,due:t.due||'',time:t.time||'',priority:t.priority,done:!!t.done})),
 events:events.get().items.map(e=>({id:e.id,extId:e.extId||'',title:e.title,date:e.date,start:e.start,end:e.end||''})),studyLog:L}}
function handle(m){if(!m||m.dabsy!==1)return null;let r={ok:true};
 try{switch(m.type){
 case'add_event':{if(!cl_(m.title)||!DR.test(m.date||'')||!TR.test(m.start||''))return{ok:false,error:'title, date YYYY-MM-DD, start HH:MM required'};
  const it=events.get().items,k=m.extId?it.find(e=>e.extId===m.extId):it.find(e=>e.title===cl_(m.title)&&e.date===m.date&&e.start===m.start);
  const ev={title:cl_(m.title),date:m.date,start:m.start,end:TR.test(m.end||'')?m.end:'',extId:m.extId?String(m.extId).slice(0,60):''};
  if(k)events.set({items:it.map(e=>e===k?{...e,...ev}:e)});else events.set({items:[...it,{id:uid('e_'),...ev}]});break}
 case'delete_event':{const id=String(m.extId||m.id||'');events.set({items:events.get().items.filter(e=>e.extId!==id&&e.id!==id)});break}
 case'add_task':{const t=cl_(m.title);if(!t)return{ok:false,error:'title required'};if(tasks.get().items.some(x=>!x.done&&x.title===t&&(x.due||'')===(m.due||'')))break;
  tasks.set({items:[...tasks.get().items,{id:uid('t_'),title:t,due:DR.test(m.due||'')?m.due:'',time:TR.test(m.time||'')?m.time:'',priority:['high','normal','low'].includes(m.priority)?m.priority:'normal',done:false,notes:'',created:Date.now()}]});break}
 case'complete_task':{tasks.set({items:tasks.get().items.map(t=>t.id===m.id?{...t,done:m.done!==false}:t)});break}
 case'study_minutes':{const n=Math.max(0,Math.min(600,Math.round(+m.minutes||0)));if(n){const k=ymd();study.set({log:{...study.get().log,[k]:(study.get().log[k]||0)+n}});bus.emit('study-tick')}break}
 case'hello':case'get_state':break;default:return{ok:false,error:'unknown type'}}}catch(e){return{ok:false,error:String(e.message||e)}}
 return r}
function appPanel(key){const A=APPS[key];if(!A)return;return sheet(A.name,(b,api)=>{
 const fr=$('iframe',{class:'appframe',src:A.url,title:A.name,allow:'fullscreen',referrerpolicy:'no-referrer-when-downgrade',style:'width:100%;height:68vh;border:0;border-radius:16px;background:#fff'});
 fr.setAttribute('sandbox','allow-scripts allow-same-origin allow-forms allow-popups allow-modals');
 const sync=()=>fr.contentWindow?.postMessage(snapshot(),ORIGIN);
 const onMsg=e=>{if(e.origin!==ORIGIN||e.source!==fr.contentWindow)return;const res=handle(e.data);if(!res)return;fr.contentWindow.postMessage({dabsy:1,type:'ack',for:e.data.type,reqId:e.data.reqId,...res},ORIGIN);sync()};
 let t;const push=()=>{clearTimeout(t);t=setTimeout(sync,120)};const offs=[tasks.on(push),events.on(push),study.on(push)];
 addEventListener('message',onMsg);
 b.append(fr,$('div',{class:'btns center',style:'margin-top:10px'},$('a',{class:'btn sm',href:A.url,target:'_blank',rel:'noopener'},'Open in browser ↗')),$('small',{class:'note'},A.note+'. If the page stays blank, it may not allow embedding — use “Open in browser”.'));
 return()=>{removeEventListener('message',onMsg);offs.forEach(f=>f())}})}
function appsPanel(){return sheet('Apps',b=>{b.append($('div',{class:'applist',style:'display:grid;gap:10px'},...Object.entries(APPS).map(([k,A])=>$('button',{class:'btn',type:'button',style:'display:flex;gap:12px;align-items:center;text-align:left;padding:14px',onclick:()=>appPanel(k)},$('span',{style:'font-size:1.6em'},A.emoji),$('span',{},$('b',{},A.name),$('br'),$('small',{},A.note))))),$('small',{class:'note'},'Apps embedded here share tasks, events and study minutes with DABSy through a small bridge (dabsy-bridge.js).'))})}

return{get appsPanel(){return appsPanel},get appPanel(){return appPanel},get sheet(){return sheet},get seg(){return seg},get tasksPanel(){return tasksPanel},get calendarPanel(){return calendarPanel},get timer(){return timer},get startTimer(){return startTimer},get studyPanel(){return studyPanel},get settingsPanel(){return settingsPanel}}})();
__m['main.js']=(()=>{
const {$,prefs,tasks,events,widgets:wstore,memory,chat:cstore,reduced,bus,ymd}=__m['state.js'];
const {loadConfig,health}=__m['ai.js'];
const {createBrain,S}=__m['brain.js'];
const {createDabsy}=__m['character.js'];
const {createWidgets,loadWx,icon}=__m['widgets.js'];
const {createChat}=__m['chat.js'];
const {pushLayer,popLayer,hasLayer}=__m['layers.js'];
const spots=__m['spots.js'];
const {tasksPanel,calendarPanel,studyPanel,settingsPanel,startTimer,appsPanel,appPanel}=__m['panels.js'];
const SCENES={bedroom:'Bedroom',study:'Study desk',garden:'Garden',cabin:'Cabin'},FLOOR={bedroom:.7,study:.8,garden:.74,cabin:.72},FOCAL={bedroom:[.78,.18],study:[.15,.2],garden:[.5,.3],cabin:[.85,.3]};
const app=document.getElementById('app');app.dataset.view='home';
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const baseW=()=>clamp(app.clientWidth*.25,78,116);
const world=()=>{const H=app.clientHeight,h=spots.home();return{W:app.clientWidth,H,floor:h?h.sy:H*FLOOR[prefs.get().scene],top:44,
 ground:(x,y)=>{const g=spots.groundAt(x,y)||spots.catchSpot(x,y);return g?g.sy:(h?h.sy:H*.7)},
 steer:(x,y)=>{if(spots.groundAt(x,y))return null;const p=spots.catchSpot(x,y);return p?spots.standX(p,x):null}}};
let current=null,moving=false,lastInt=Date.now();
/* ---- scene (crossfade; day/night auto) ---- */
const layers=[$('div',{class:'sl'}),$('div',{class:'sl'})];const sceneEl=$('div',{class:'scene'},...layers);let li=0,curKey='';
const isNight=()=>{const p=prefs.get();return p.tod==='night'||(p.tod==='auto'&&(new Date().getHours()<6||new Date().getHours()>=19))};
function applyScene(){const k=`${prefs.get().scene}-${isNight()?'night':'day'}`;if(k===curKey)return;const url=`url(./scene-${k}.webp)`;const im=new Image();im.onload=()=>{const n=layers[li^=1],o=layers[li^1];n.style.backgroundImage=url;n.classList.add('on');o.classList.remove('on');app.dataset.night=isNight()?'1':'0'};im.src=`./scene-${k}.webp`;curKey=k}
/* ---- DOM ---- */
const wlayer=$('div',{class:'wlayer'}),dlayer=$('div',{class:'dlayer'}),blayer=$('div',{class:'blayer'}),chatEl=$('section',{class:'chat','aria-label':'Conversation','aria-hidden':'true'}),sheetRoot=$('div',{class:'sheet-root'}),toasts=$('div',{class:'toasts','aria-live':'polite'}),coach=$('div',{class:'coach glass',hidden:true});
const speakEl=$('div',{class:'speak glass',hidden:true});
app.append(sceneEl,wlayer,dlayer,blayer,chatEl,sheetRoot,toasts,coach);dlayer.append(speakEl);
function toast(t,ms=4200){const e=$('div',{class:'toast glass'},t);toasts.append(e);while(toasts.children.length>2)toasts.firstChild.remove();setTimeout(()=>e.remove(),ms)}
/* ---- brain + character ---- */
const brain=createBrain({onChange:(s,dz)=>{dabsy.state(s,dz);if(s==='sleepy')setTimeout(()=>{if(brain.state==='sleepy'&&current&&current.kind!=='rest'&&view==='home'){const r=spots.pick({state:'sleepy',night:isNight(),exclude:current,avoid:wRects()});if(r&&r.kind==='rest')goTo(r)}},1800)}});
let speakT=0;
function speak(t,{ms=2300,action}={}){speakEl.replaceChildren(t);if(action){speakEl.append($('button',{class:'btn sm primary',type:'button',onclick:()=>{speakEl.hidden=true;action.run()}},action.label))}speakEl.hidden=false;speakEl.style.pointerEvents=action?'auto':'none';placeSpeak();clearTimeout(speakT);speakT=setTimeout(()=>speakEl.hidden=true,ms)}
function placeSpeak(){const W=world().W,w=speakEl.offsetWidth||120;speakEl.style.transform=`translate(${clamp(dabsy.x-w/2,8,W-w-8)}px,${Math.max(8,dabsy.y-dabsy.h-52)}px)`}
const dabsy=createDabsy({layer:dlayer,world,cb:{
 tap(){brain.event('tap');dabsy.nod();dabsy.lookRel(0,.9);bus.emit('tap');speak(['Hmm?','Yes?','Hi!','Oh—hello.'][Math.floor(Math.random()*4)],{ms:3200,action:{label:'Talk',run:openChat}})},
 double(){speakEl.hidden=true;brain.event('tap');bubbles.open()},
 lifted(){current=null},landed(x,y){const p=spots.spotAt(x,y);current=p;if(p){dabsy.scaleTo(p.scale);dabsy.setPose(p.pose||'sit');dabsy.lookRel(p.face==='left'?-.7:p.face==='right'?.7:0,.2)}},
 dragStart(){lastInt=Date.now();bubbles.close();speakEl.hidden=true;widgets.openTray(false)},
 pet({amount,dir}){brain.event('pet',{amount});bus.emit('pet',amount)},
 petEnd(){},drop(f){brain.event('drop',f);bus.emit('drop')},thud(){},look(px,py){dabsy.look(px,py)}}});
window.__dabsy={dabsy,brain,prefs,app,spots,get current(){return current}};
app.addEventListener('pointerdown',()=>lastInt=Date.now(),true);
/* ---- widgets ---- */
const widgets=createWidgets({layer:wlayer,trayHost:blayer,world,cb:{pickup:()=>brain.event('widget'),placed:()=>speak('Ooh, nice.',{ms:1600}),
 open:(t)=>{if(t==='tasks')tasksPanel();else if(t==='calendar')calendarPanel();else if(t==='study')studyPanel();else if(t==='weather')loadWx(true)}}});
widgets.tray.append($('button',{class:'tray-x',type:'button','aria-label':'Close widget tray',onclick:()=>widgets.openTray(false),html:'✕'}));
/* ---- bubbles (double-tap menu) ---- */
const IC={chat:'<path d="M5 6h14a2 2 0 012 2v7a2 2 0 01-2 2H11l-4 3v-3H5a2 2 0 01-2-2V8a2 2 0 012-2z"/>',study:'<path d="M4 6c3-1 6-1 8 1 2-2 5-2 8-1v12c-3-1-6-1-8 1-2-2-5-2-8-1z"/>',calendar:'<rect x="4" y="5" width="16" height="15" rx="3"/><path d="M4 10h16M9 3v4M15 3v4"/>',tasks:'<rect x="5" y="4" width="14" height="16" rx="3"/><path d="M9 10l2 2 4-4M9 16h6"/>',apps:'<circle cx="7" cy="7" r="2.5"/><circle cx="17" cy="7" r="2.5"/><circle cx="7" cy="17" r="2.5"/><circle cx="17" cy="17" r="2.5"/>',widgets:'<rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><circle cx="16.5" cy="16.5" r="3.5"/>',settings:'<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/>'};
const ITEMS=[['chat','Chat',()=>openChat()],['study','Study',()=>studyPanel()],['calendar','Calendar',()=>calendarPanel()],['tasks','Tasks',()=>tasksPanel()],['apps','Apps',()=>appsPanel()],['widgets','Widgets',()=>{widgets.openTray(true);bus.emit('widgets-open')}],['settings','Settings',()=>openSettings()]];
const bubbles={el:null,isOpen:false,
 open(){if(this.isOpen||view!=='home')return;this.isOpen=true;const W=world().W,H=world().H,cx=dabsy.x,cy=dabsy.y-dabsy.h*.5,n=ITEMS.length,R=clamp(Math.min(W*.36,112),84,120);
  const below=cy<R+90,a0=below?-20:200,a1=below?200:-20;this.el=$('div',{class:'bub-wrap'});
  ITEMS.forEach(([k,l,fn],i)=>{const a=(a0+(a1-a0)*(i/(n-1)))*Math.PI/180,rr=R+(i%2?10:0),sg=below?-1:1;let bx=clamp(cx+Math.cos(a)*rr,40,W-40),by=clamp(cy-sg*Math.sin(a)*rr,70,H-80);
   const b=$('button',{class:'bubble glass',type:'button','aria-label':l,style:`--dx:${cx-bx}px;--dy:${cy-by}px;--i:${i};--fd:${(i*.7).toFixed(1)}s`,onclick:()=>{this.close();fn()},html:`<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${IC[k]}</svg><span>${l}</span>`});
   b.style.left=bx-30+'px';b.style.top=by-30+'px';this.el.append(b)});
  this.layer=pushLayer(()=>this.close(true));blayer.append(this.el);requestAnimationFrame(()=>this.el.classList.add('in'));bus.emit('bubbles')},
 close(fromHist){if(!this.isOpen)return;this.isOpen=false;const e=this.el;e.classList.remove('in');e.classList.add('out');setTimeout(()=>e.remove(),reduced()?0:260);if(!fromHist)popLayer(this.layer);bus.emit('bubbles-closed')}};
sceneEl.addEventListener('pointerdown',()=>{if(view==='home'){bubbles.close();widgets.openTray(false);speakEl.hidden=true}});

/* ---- swipe-up glass navigation bar (separate from the orbital launcher) ---- */
const nav={el:null,open:false,
 show(){if(this.open||view!=='home')return;this.open=true;bubbles.close();const sc=Object.keys(SCENES),chip=(l,fn,on)=>$('button',{class:'btn sm',type:'button','aria-pressed':on==null?null:String(!!on),onclick:fn},l);
  this.el=$('nav',{class:'glass strong navbar','aria-label':'Quick navigation',style:'position:absolute;left:10px;right:10px;bottom:calc(10px + env(safe-area-inset-bottom,0px));z-index:30;padding:12px;border-radius:24px;display:flex;flex-wrap:wrap;gap:8px;justify-content:center;transform:translateY(120%);transition:transform .35s cubic-bezier(.2,.9,.3,1)'},
   chip('🏠 Home',()=>this.close()),chip('🌗 Room',()=>{const i=sc.indexOf(prefs.get().scene);prefs.set({scene:sc[(i+1)%sc.length]});dabsy.resize();widgets.relayout();toast(SCENES[prefs.get().scene])}),
   chip('🧩 Widgets',()=>{this.close();widgets.openTray(true)}),chip('🔔 Alerts',function(){const v=!prefs.get().notif;prefs.set({notif:v});this.setAttribute('aria-pressed',String(v));toast(v?'Reminders on':'Reminders off')},prefs.get().notif),
   chip('⚙️ Settings',()=>{this.close();openSettings()}));
  app.append(this.el);this.layer=pushLayer(()=>this.close(true));requestAnimationFrame(()=>this.el.style.transform='none')},
 close(fromHist){if(!this.open)return;this.open=false;const e=this.el;e.style.transform='translateY(120%)';setTimeout(()=>e.remove(),reduced()?0:320);if(!fromHist)popLayer(this.layer)}};
{let sy=null,sx=0;sceneEl.addEventListener('pointerdown',e=>{sy=e.clientY;sx=e.clientX});
 addEventListener('pointerup',e=>{if(sy==null)return;const dy=e.clientY-sy,dx=e.clientX-sx,fromBottom=sy>innerHeight*.6;sy=null;if(view==='home'&&fromBottom&&dy<-70&&Math.abs(dx)<70)nav.show()});
 addEventListener('pointercancel',()=>sy=null)}
/* ---- chat ---- */
let view='home',home={x:0,y:0},cl=null,stateT=0;
const chat=createChat({host:chatEl,hooks:{close:()=>closeChat(),
 state(s){clearTimeout(stateT);if(s==='thinking')dabsy.act('thinking');else if(s==='answering')dabsy.act('answering');else if(s==='happy'){dabsy.act('');dabsy.state('happy');stateT=setTimeout(()=>dabsy.state('focused'),2200)}else if(s==='confused'){dabsy.act('confused');stateT=setTimeout(()=>dabsy.act(''),1800)}else dabsy.act('')},
 typing(){clearTimeout(chat._t);dabsy.lookRel(.2,.95);if(Math.random()<.12)dabsy.nod();chat._t=setTimeout(()=>dabsy.lookRel(0,-.1),1400)},
 focus:(m,t)=>{startTimer(m,t);studyPanel(m,t)},app:k=>{bubbles.close();appPanel(k)}}});
bus.on('chat-clear',()=>{chat.clear();toast('Chat history cleared')});
async function openChat(){if(view==='chat')return;view='chat';bubbles.close();widgets.openTray(false);speakEl.hidden=true;home={x:dabsy.x,y:dabsy.y,s:dabsy.scale};app.dataset.view='chat';chatEl.setAttribute('aria-hidden','false');chatEl.inert=false;brain.lock(S.FOCUSED);
 cl=pushLayer(()=>closeChat(true));bus.emit('chat-open');await dabsy.flyTo(world().W/2,126,.62,true);if(view==='chat'){dabsy.look(world().W/2,world().H);chat.open()}}
async function closeChat(fromHist){if(view!=='chat')return;view='home';if(!fromHist)popLayer(cl);cl=null;chat.blur();app.dataset.view='home';chatEl.setAttribute('aria-hidden','true');chatEl.inert=true;brain.unlock();dabsy.act('');await dabsy.flyTo(home.x,home.y,home.s,true);if(current)dabsy.setPose(current.pose||'sit')}
chatEl.inert=true;
function openSettings(){settingsPanel({scenes:SCENES,onScene:k=>{prefs.set({scene:k});dabsy.resize();widgets.relayout()},onReplay:()=>{tour()},widgetsReset:()=>{widgets.reset();toast('Widgets cleared')},
 notifyPerm:async()=>{if(!('Notification' in window))return toast('Not supported on this device');const r=await Notification.requestPermission();toast(r==='granted'?'Phone notifications on':'Notifications are blocked')}})}
/* ---- keyboard / viewport: ONE mechanism (layout height), no transforms ---- */
const vv=window.visualViewport;
function fit(){const d=vv?innerHeight-vv.height:0;if(d>80&&matchMedia('(pointer: coarse)').matches)app.style.setProperty('--vvh',vv.height+'px');else app.style.removeProperty('--vvh');if(vv&&vv.offsetTop)scrollTo(0,0);spots.layout(app.clientWidth,app.clientHeight,baseW());dabsy.resize();if(current&&current.fits&&view==='home'){dabsy.snap(spots.standX(current,dabsy.x),current.sy,current.scale)}widgets.relayout();if(view==='chat')dabsy.flyTo(world().W/2,126,.62,true)}
let ft=0;const fitS=()=>{cancelAnimationFrame(ft);ft=requestAnimationFrame(fit)};vv?.addEventListener('resize',fitS);addEventListener('resize',fitS);addEventListener('orientationchange',fitS);
/* ---- prefs ---- */
function applyPrefs(){const p=prefs.get();app.style.setProperty('--ts',p.text);app.dataset.motion=reduced()?'reduced':'full';applyScene()}
prefs.on(applyPrefs);matchMedia('(prefers-reduced-motion: reduce)').addEventListener?.('change',applyPrefs);
/* ---- life: idle behaviour, blink, nudges, reminders ---- */
const R=()=>Math.random();
setInterval(()=>brain.tick(),1000);
setInterval(()=>{if(document.hidden||view!=='home'||dabsy.busy||reduced())return;const s=brain.state,W=world();
 if(s==='playful'||s==='excited'){dabsy.mode==='rest'?dabsy.hop(R()<.5?600:760):dabsy.nod();return}
 if(s==='sleepy'||s==='grumpy'&&R()<.6){if(s==='grumpy')dabsy.lookRel(-1,0);return}
 const r=R();if(r<.5)dabsy.lookRel((R()-.5)*2,(R()-.5)*1.2);else if(r<.7){const f=FOCAL[prefs.get().scene];dabsy.look(f[0]*W.W,f[1]*W.H)}else if(r<.8&&brain.needs.energy<.65)dabsy.stretch();else if(r<.9&&(s==='happy'||s==='affectionate'))dabsy.nod()},3600);
(function blink(){const e=dabsy.el;if(e.dataset.state!=='sleepy'&&!reduced()){e.dataset.blink='1';setTimeout(()=>e.dataset.blink='0',120)}setTimeout(blink,2200+R()*3800)})();
setInterval(()=>{if(document.hidden||view!=='home')return;if(brain.shouldNudge(prefs.get().nudges)){dabsy.hop(540);dabsy.lookRel(0,.9);speak('…hi?',{ms:2600})}},30000);
let hiddenAt=0;document.addEventListener('visibilitychange',()=>{if(document.hidden)hiddenAt=Date.now();else{if(Date.now()-hiddenAt>18e4)brain.event('return');applyScene()}});
const notified=new Set();
function remind(){if(!prefs.get().notif)return;const n=new Date(),td=ymd(n),nm=n.getHours()*60+n.getMinutes(),m=t=>+t.slice(0,2)*60+ +t.slice(3);
 const due=[...tasks.get().items.filter(t=>!t.done&&t.due===td&&t.time).map(t=>({id:t.id,at:t.time,x:t.title,w:15})),...events.get().items.filter(e=>e.date===td).map(e=>({id:e.id,at:e.start,x:e.title,w:10}))];
 for(const d of due){const dm=m(d.at)-nm;if(dm<=d.w&&dm>=0&&!notified.has(d.id+td)){notified.add(d.id+td);const msg=dm===0?`${d.x} — now`:`${d.x} in ${dm} min`;toast('⏰ '+msg,6000);brain.event('notify');if(view==='home'){dabsy.hop(520);speak(msg,{ms:3500})}
   if(document.hidden&&'Notification' in window&&Notification.permission==='granted')try{new Notification('DABSy',{body:msg,icon:'./icon-192.png'})}catch{}}}}
setInterval(remind,30000);bus.on('study-done',()=>{toast('Study session complete 🎉',6000);brain.event('return');dabsy.hop(640)});
/* ---- interactive onboarding (inside her room) ---- */
let touring=false;
async function tour(){if(touring)return;touring=true;let skip=false,wake=null;const wait=ev=>new Promise(res=>{wake=res;const off=bus.on(ev,v=>{if(ev==='pet'){tour.pet=(tour.pet||0)+v;if(tour.pet<.9)return}off();res()})});
 const steps=[['Hi, I’m DABSy. I live here. Tap me!','tap'],['Hello! Now tap me twice, quickly.','bubbles'],['These are my tools. Tap the room to close them.','bubbles-closed'],['Pick me up: hold me a moment, drag, and let go.','drop'],['Now stroke me slowly… I like that.','pet'],['Open my bubbles again, choose Widgets, and drag one into the room.','widget-placed'],['When you want to talk, open Chat from my bubbles.','chat-open']];
 coach.hidden=false;const txt=$('span',{}),sk=$('button',{class:'btn sm',type:'button',onclick:()=>{skip=true;wake?.()}},'Skip');coach.replaceChildren(txt,sk);tour.pet=0;
 for(const[t,ev]of steps){if(skip)break;txt.textContent=t;await wait(ev);await new Promise(r=>setTimeout(r,500))}
 txt.textContent=skip?'No problem — double-tap me any time.':'That’s everything. I’m here whenever you need me.';sk.remove();prefs.set({onboarded:true});setTimeout(()=>coach.hidden=true,2600);touring=false}
/* ---- smart sitting spots: choose, hop there, sit; occasionally move; go home ---- */
const wRects=()=>widgets.list.map(w=>({x:w.x,y:w.y,w:w.w,h:w.h}));
async function goTo(p){if(!p||moving||view!=='home'||!dabsy.settled)return;moving=true;const ok=await dabsy.hopTo(spots.standX(p),p.sy,p.scale,p.pose||'sit');moving=false;if(ok){current=p;dabsy.lookRel(p.face==='left'?-.7:p.face==='right'?.7:0,.2);bus.emit('perched',p.id)}}
setInterval(()=>{if(document.hidden||view!=='home'||moving||!dabsy.settled||reduced()||hasLayer()||Date.now()-lastInt<8000||brain.state==='grumpy')return;
 if(Math.random()>(brain.state==='sleepy'?.45:.2))return;const h=spots.home();{const t=Math.random()<.2&&h&&current!==h?h:spots.pick({state:brain.state,night:isNight(),exclude:current,avoid:wRects()});if(t&&(brain.state!=='sleepy'||t.kind==='rest'||t===h))goTo(t)}},9000);
let sceneNow='';async function loadSpots(){const sc=prefs.get().scene;if(sc===sceneNow)return;sceneNow=sc;await spots.setScene(sc);spots.layout(app.clientWidth,app.clientHeight,baseW());const h=spots.home();if(h){current=h;dabsy.snap(spots.standX(h),h.sy,h.scale,h.pose||'sit')}widgets.relayout()}
prefs.on(()=>loadSpots());
/* ---- boot ---- */
(async()=>{await loadConfig();await spots.initSpots();applyPrefs();sceneNow=prefs.get().scene;await spots.setScene(sceneNow);spots.layout(app.clientWidth,app.clientHeight,baseW());{const h=spots.home();if(h){current=h;dabsy.place(spots.standX(h),h.sy,h.scale,true,h.pose||'sit')}else dabsy.place(app.clientWidth*.5,world().floor,1)}widgets.restore();fitS();
 app.dataset.boot='0';if(!prefs.get().onboarded)setTimeout(tour,900);
 })();

return{}})();
})();