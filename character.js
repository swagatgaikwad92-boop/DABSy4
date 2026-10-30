import {$,reduced} from './state.js';
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v)),now=()=>performance.now();
/* world(): {W,H,floor,top}.  x,y = bottom-centre of DABSy in app px. */
export function createDabsy({layer,world,cb}){
 const img=(c,s)=>$('img',{class:c,src:'./assets/'+s,alt:'',draggable:'false',decoding:'async'});
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
