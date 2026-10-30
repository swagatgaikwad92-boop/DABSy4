import {$,prefs,tasks,events,study,memory,widgets,chat,ymd,uid,bus,reduced} from './state.js';
import {pushLayer,popLayer} from './layers.js';
import {resetAll} from './store.js';
import {health,API} from './ai.js';
const root=()=>document.querySelector('.sheet-root');
let cur=null;
export function sheet(title,build){cur?.close(true);const bd=$('div',{class:'backdrop'}),sh=$('section',{class:'sheet glass strong',role:'dialog','aria-label':title}),body=$('div',{class:'sbody'});
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
export const seg=(opts,val,fn)=>{const w=$('div',{class:'seg',role:'group'});for(const[v,l]of opts){const b=$('button',{type:'button','aria-pressed':String(v===val),onclick:()=>{[...w.children].forEach(c=>c.setAttribute('aria-pressed','false'));b.setAttribute('aria-pressed','true');fn(v)}},l);w.append(b)}return w};
const sw=(v,fn,label)=>{const b=$('button',{class:'switch',type:'button',role:'switch','aria-checked':String(!!v),'aria-label':label,onclick:()=>{const n=b.getAttribute('aria-checked')!=='true';b.setAttribute('aria-checked',String(n));fn(n)}});return b};
const row=(l,c,sub)=>$('div',{class:'srow'},$('div',{},$('b',{},l),sub?$('small',{},sub):null),c);
const sec=(t,...k)=>$('section',{class:'ssec'},$('h3',{},t),...k);
/* ---------- Tasks ---------- */
export function tasksPanel(){return sheet('Tasks',(b)=>{const list=$('div',{class:'tlist'}),inp=$('input',{class:'inp',type:'text',placeholder:'Add a task…',maxlength:140,enterkeyhint:'done'}),due=$('input',{class:'inp sm',type:'date','aria-label':'Due date'});
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
export function calendarPanel(){return sheet('Calendar',b=>{const list=$('div',{class:'tlist'}),t=$('input',{class:'inp',placeholder:'Event title',maxlength:100}),d=$('input',{class:'inp sm',type:'date',value:ymd()}),s=$('input',{class:'inp sm',type:'time',value:'16:00'});
 const draw=()=>{list.replaceChildren();const td=ymd();const days={};for(const e of events.get().items)if(e.date>=td)(days[e.date]??=[]).push({id:e.id,t:e.start,x:e.title,ev:1});for(const k of tasks.get().items)if(!k.done&&k.due>=td&&k.time)(days[k.due]??=[]).push({t:k.time,x:k.title});
  for(const dd of Object.keys(days).sort().slice(0,30)){list.append($('h4',{},new Date(dd+'T12:00').toLocaleDateString([],{weekday:'long',day:'numeric',month:'short'})+(dd===td?' · today':'')));for(const e of days[dd].sort((a,c)=>a.t<c.t?-1:1))list.append($('div',{class:'trow'},$('b',{class:'tm'},e.t),$('div',{class:'tmain'},$('span',{},e.x),$('small',{},e.ev?'event':'task')),e.ev?$('button',{class:'ibtn sm',type:'button','aria-label':'Delete event',onclick:()=>events.set({items:events.get().items.filter(y=>y.id!==e.id)}),html:'✕'}):null))}
  if(!list.children.length)list.append($('div',{class:'emptyp'},'Nothing scheduled. Add an event or ask DABSy to plan your day.'))};
 b.append($('div',{class:'addrow wrap'},t,d,s,$('button',{class:'btn primary',type:'button',onclick:()=>{if(!t.value.trim()||!d.value||!s.value)return;events.set({items:[...events.get().items,{id:uid('e_'),title:t.value.trim(),date:d.value,start:s.value,end:''}]});t.value=''}},'Add')),$('p',{class:'note'},'Events are stored on this device.'),list);draw();const a=events.on(draw),c=tasks.on(draw);return()=>{a();c()}})}
/* ---------- Study Space (real timer, logs minutes) ---------- */
export const timer={total:0,end:0,left:0,running:false,topic:'',startedAt:0};
let tick=0;
const logMin=m=>{if(m<=0)return;const k=ymd();study.set({log:{...study.get().log,[k]:(study.get().log[k]||0)+m}})};
function finish(done){clearInterval(tick);tick=0;const el=timer.total-(timer.running?Math.max(0,Math.round((timer.end-Date.now())/1000)):timer.left);logMin(Math.round(el/60));const was=done;timer.running=false;timer.total=0;bus.emit('study-tick');if(was)bus.emit('study-done')}
export function startTimer(min,topic=''){if(timer.total)finish(false);timer.total=min*60;timer.left=timer.total;timer.end=Date.now()+timer.total*1000;timer.running=true;timer.topic=topic;clearInterval(tick);tick=setInterval(()=>{if(timer.running){timer.left=Math.max(0,Math.round((timer.end-Date.now())/1000));if(timer.left<=0)finish(true)}bus.emit('study-tick')},1000);bus.emit('study-tick')}
export function studyPanel(min,topic){return sheet('Study Space',b=>{const big=$('div',{class:'bigtime'}),sub=$('div',{class:'note'}),ctl=$('div',{class:'btns center'}),top=$('input',{class:'inp',placeholder:'What are you studying?',maxlength:80,value:topic||timer.topic||''}),bars=$('div',{class:'bars'});let m=min||25;
 const fmt=s=>`${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
 const draw=()=>{const run=timer.total>0;big.textContent=fmt(run?timer.left:m*60);sub.textContent=run?(timer.running?'Focus… I’ll keep you company.':'Paused'):'';ctl.replaceChildren();
  if(!run){ctl.append(seg([[15,'15'],[25,'25'],[45,'45']],m,v=>{m=v;draw()}),$('button',{class:'btn primary',type:'button',onclick:()=>startTimer(m,top.value.trim())},'Start'))}
  else ctl.append($('button',{class:'btn',type:'button',onclick:()=>{if(timer.running){timer.left=Math.max(0,Math.round((timer.end-Date.now())/1000));timer.running=false}else{timer.end=Date.now()+timer.left*1000;timer.running=true}draw()}},timer.running?'Pause':'Resume'),$('button',{class:'btn danger',type:'button',onclick:()=>{finish(false);draw()}},'Stop & log'));
  bars.replaceChildren();const L=study.get().log;let mx=30;const days=[...Array(7)].map((_,i)=>{const d=new Date(Date.now()-(6-i)*864e5);const k=ymd(d);mx=Math.max(mx,L[k]||0);return{k,d,v:L[k]||0}});for(const x of days)bars.append($('div',{class:'bcol'},$('i',{style:`height:${Math.max(4,x.v/mx*100)}%`,title:x.v+' min'}),$('small',{},x.d.toLocaleDateString([],{weekday:'narrow'}))));
  sub.textContent+=` Today: ${L[ymd()]||0} min`};
 b.append(top,big,ctl,sub,sec('Last 7 days',bars),$('p',{class:'note'},'Minutes are logged when you stop or finish a session. Ask DABSy to explain anything while you study.'));draw();const o=bus.on('study-tick',draw),p=study.on(draw);return()=>{o();p()}})}
/* ---------- Settings ---------- */
export function settingsPanel({scenes,onReplay,onScene,widgetsReset,notifyPerm}){return sheet('Settings',b=>{const P=prefs.get(),set=p=>prefs.set(p);
 const st=$('small',{},'Checking…');health().then(h=>st.textContent=h.ok?`Connected${h.model?' · '+h.model:''}`:h.reason==='not-configured'?'No AI backend configured (config.json → apiUrl)':'Backend unreachable');
 const mem=$('div',{class:'mem'});const drawMem=()=>{mem.replaceChildren();const f=memory.get().facts;if(!f.length)mem.append($('small',{},'Nothing remembered yet. DABSy only remembers durable facts you share.'));f.forEach((x,i)=>mem.append($('div',{class:'trow'},$('div',{class:'tmain'},$('span',{},x)),$('button',{class:'ibtn sm',type:'button','aria-label':'Forget',onclick:()=>{memory.set({facts:f.filter((_,j)=>j!==i)});drawMem()},html:'✕'}))))};drawMem();
 const sc=$('div',{class:'scenes'},...Object.entries(scenes).map(([k,v])=>$('button',{class:'scn',type:'button','aria-pressed':String(P.scene===k),onclick:e=>{sc.querySelectorAll('.scn').forEach(c=>c.setAttribute('aria-pressed','false'));e.currentTarget.setAttribute('aria-pressed','true');onScene(k)}},$('img',{src:`./assets/scene-${k}-day.webp`,alt:'',loading:'lazy'}),$('span',{},v))));
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
