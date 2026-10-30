import {$,widgets as store,tasks,events,study,uid,ymd,reduced,bus} from './state.js';
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v)),now=()=>performance.now();
export const DEFS={clock:{name:'Clock',w:132,h:88,g:0,rest:.6,min:.8,max:1.9},weather:{name:'Weather',w:132,h:96,g:0,rest:.55,min:.8,max:1.8},
 tasks:{name:'Priorities',w:160,h:140,g:1,rest:.3,min:.8,max:1.7},calendar:{name:'Agenda',w:160,h:116,g:1,rest:.35,min:.8,max:1.7},study:{name:'Study',w:128,h:100,g:.6,rest:.45,min:.8,max:1.8}};
const IC={clock:'<circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/>',weather:'<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4"/>',tasks:'<rect x="5" y="4" width="14" height="16" rx="3"/><path d="M9 10l2 2 4-4M9 16h6"/>',calendar:'<rect x="4" y="5" width="16" height="15" rx="3"/><path d="M4 10h16M9 3v4M15 3v4"/>',study:'<path d="M4 6c3-1 6-1 8 1 2-2 5-2 8-1v12c-3-1-6-1-8 1-2-2-5-2-8-1z"/>'};
export const icon=(k,s=22)=>`<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${IC[k]||''}</svg>`;
/* weather (Open-Meteo, device location; cached 30 min) */
let wx=null,wxBusy=false;
try{wx=JSON.parse(localStorage.getItem('dabsy4:wx'))}catch{}
export async function loadWx(force){if(wxBusy||(!force&&wx&&Date.now()-wx.t<18e5))return;wxBusy=true;
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
export function createWidgets({layer,trayHost,world,cb}){
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
