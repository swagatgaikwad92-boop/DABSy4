import {tasks,events,study,memory,prefs,uid,ymd,bus} from './state.js';
const D=/^\d{4}-\d{2}-\d{2}$/,T=/^\d{2}:\d{2}$/,PR=['high','normal','low'];
const S=(p,r=[])=>({type:'object',properties:p,required:r});
const str=d=>({type:'string',description:d}),pr={type:'string',enum:PR};
export const TOOLS=[
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
 {name:'remember',description:'Save a short durable fact about the user (preferences, exam dates, name). Only when it will help later.',input_schema:S({fact:str('one short sentence')},['fact'])}];
const bad=e=>({ok:false,error:e}),good=o=>({ok:true,...o});
const clean=s=>String(s??'').replace(/\s+/g,' ').trim().slice(0,140);
const find=id=>tasks.get().items.find(t=>t.id===id);
const upd=(id,p)=>tasks.set({items:tasks.get().items.map(t=>t.id===id?{...t,...p}:t)});
const pub=t=>({id:t.id,title:t.title,due:t.due||null,time:t.time||null,priority:t.priority,done:t.done});
export function createExecutor(ui){
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
  case'remember':{const f=clean(i.fact);if(!f)return bad('empty fact');const m=memory.get().facts;if(!m.includes(f))memory.set({facts:[...m,f].slice(-25)});return good({saved:true})}
  default:return bad('unknown tool '+name)}}}
const LEN={concise:'Default to 1–3 sentences; expand only if asked.',balanced:'Simple questions: 1–3 sentences. "Explain/how/why": a clear explanation, usually 1–4 short paragraphs. Never pad.',detailed:'Thorough, well-structured explanations with examples; stay skimmable (short headings, lists).'};
const LANG={auto:'Mirror the user’s language and script each turn (English, Hindi, Marathi, Hinglish in Roman script). Do not switch language on your own.',en:'Reply in English.',hi:'Reply in Hindi (Devanagari) unless the user writes otherwise.',mr:'Reply in Marathi (Devanagari) unless the user writes otherwise.',hinglish:'Reply in Hinglish (Hindi in Roman script mixed with English).'};
export function buildSystem({studyMode}){
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
