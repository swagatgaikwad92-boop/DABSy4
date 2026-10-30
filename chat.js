import {$,chat as store,prefs,reduced,bus,ymd} from './state.js';
import {stream,AIError,API,health} from './ai.js';
import {TOOLS,buildSystem,createExecutor} from './tools.js';
const esc=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
function inline(s){return esc(s).replace(/`([^`]+)`/g,'<code>$1</code>').replace(/\*\*([^*]+)\*\*/g,'<b>$1</b>').replace(/(^|[^*])\*([^*\s][^*]*)\*/g,'$1<i>$2</i>')}
export function md(src){const out=[],L=src.replace(/\r/g,'').split('\n');let i=0,list=null;const close=()=>{if(list){out.push(`</${list}>`);list=null}};
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
export function trim(api,max=50){let a=api.slice(-max);while(a.length&&!validStart(a[0]))a.shift();return a}
export function createChat({host,hooks}){
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
