import {$,prefs,tasks,events,widgets as wstore,memory,chat as cstore,reduced,bus,ymd} from './state.js';
import {loadConfig,health} from './ai.js';
import {createBrain,S} from './brain.js';
import {createDabsy} from './character.js';
import {createWidgets,loadWx,icon} from './widgets.js';
import {createChat} from './chat.js';
import {pushLayer,popLayer,hasLayer} from './layers.js';
import * as spots from './spots.js';
import {tasksPanel,calendarPanel,studyPanel,settingsPanel,startTimer} from './panels.js';
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
function applyScene(){const k=`${prefs.get().scene}-${isNight()?'night':'day'}`;if(k===curKey)return;const url=`url(./assets/scene-${k}.webp)`;const im=new Image();im.onload=()=>{const n=layers[li^=1],o=layers[li^1];n.style.backgroundImage=url;n.classList.add('on');o.classList.remove('on');app.dataset.night=isNight()?'1':'0'};im.src=`./assets/scene-${k}.webp`;curKey=k}
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
const IC={chat:'<path d="M5 6h14a2 2 0 012 2v7a2 2 0 01-2 2H11l-4 3v-3H5a2 2 0 01-2-2V8a2 2 0 012-2z"/>',study:'<path d="M4 6c3-1 6-1 8 1 2-2 5-2 8-1v12c-3-1-6-1-8 1-2-2-5-2-8-1z"/>',calendar:'<rect x="4" y="5" width="16" height="15" rx="3"/><path d="M4 10h16M9 3v4M15 3v4"/>',tasks:'<rect x="5" y="4" width="14" height="16" rx="3"/><path d="M9 10l2 2 4-4M9 16h6"/>',widgets:'<rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><circle cx="16.5" cy="16.5" r="3.5"/>',settings:'<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/>'};
const ITEMS=[['chat','Chat',()=>openChat()],['study','Study',()=>studyPanel()],['calendar','Calendar',()=>calendarPanel()],['tasks','Tasks',()=>tasksPanel()],['widgets','Widgets',()=>{widgets.openTray(true);bus.emit('widgets-open')}],['settings','Settings',()=>openSettings()]];
const bubbles={el:null,isOpen:false,
 open(){if(this.isOpen||view!=='home')return;this.isOpen=true;const W=world().W,H=world().H,cx=dabsy.x,cy=dabsy.y-dabsy.h*.5,n=ITEMS.length,R=clamp(Math.min(W*.36,112),84,120);
  const below=cy<R+90,a0=below?-20:200,a1=below?200:-20;this.el=$('div',{class:'bub-wrap'});
  ITEMS.forEach(([k,l,fn],i)=>{const a=(a0+(a1-a0)*(i/(n-1)))*Math.PI/180,rr=R+(i%2?10:0),sg=below?-1:1;let bx=clamp(cx+Math.cos(a)*rr,40,W-40),by=clamp(cy-sg*Math.sin(a)*rr,70,H-80);
   const b=$('button',{class:'bubble glass',type:'button','aria-label':l,style:`--dx:${cx-bx}px;--dy:${cy-by}px;--i:${i};--fd:${(i*.7).toFixed(1)}s`,onclick:()=>{this.close();fn()},html:`<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${IC[k]}</svg><span>${l}</span>`});
   b.style.left=bx-30+'px';b.style.top=by-30+'px';this.el.append(b)});
  this.layer=pushLayer(()=>this.close(true));blayer.append(this.el);requestAnimationFrame(()=>this.el.classList.add('in'));bus.emit('bubbles')},
 close(fromHist){if(!this.isOpen)return;this.isOpen=false;const e=this.el;e.classList.remove('in');e.classList.add('out');setTimeout(()=>e.remove(),reduced()?0:260);if(!fromHist)popLayer(this.layer);bus.emit('bubbles-closed')}};
sceneEl.addEventListener('pointerdown',()=>{if(view==='home'){bubbles.close();widgets.openTray(false);speakEl.hidden=true}});
/* ---- chat ---- */
let view='home',home={x:0,y:0},cl=null,stateT=0;
const chat=createChat({host:chatEl,hooks:{close:()=>closeChat(),
 state(s){clearTimeout(stateT);if(s==='thinking')dabsy.act('thinking');else if(s==='answering')dabsy.act('answering');else if(s==='happy'){dabsy.act('');dabsy.state('happy');stateT=setTimeout(()=>dabsy.state('focused'),2200)}else if(s==='confused'){dabsy.act('confused');stateT=setTimeout(()=>dabsy.act(''),1800)}else dabsy.act('')},
 typing(){clearTimeout(chat._t);dabsy.lookRel(.2,.95);if(Math.random()<.12)dabsy.nod();chat._t=setTimeout(()=>dabsy.lookRel(0,-.1),1400)},
 focus:(m,t)=>{startTimer(m,t);studyPanel(m,t)}}});
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
   if(document.hidden&&'Notification' in window&&Notification.permission==='granted')try{new Notification('DABSy',{body:msg,icon:'./assets/icon-192.png'})}catch{}}}}
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
 if('serviceWorker' in navigator&&location.protocol.startsWith('http'))navigator.serviceWorker.register('./sw.js').catch(()=>{})})();
