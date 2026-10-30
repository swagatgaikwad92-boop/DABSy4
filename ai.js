export class AIError extends Error{constructor(kind,msg,o={}){super(msg);this.kind=kind;this.retry=!!o.retry;this.code=o.code||''}}
export const DEFAULT_API='https://dabsy-ai.swagatdemo9292.workers.dev';
export let API=DEFAULT_API;
export async function loadConfig(){try{const r=await fetch('./config.json',{cache:'no-store'});API=String((await r.json()).apiUrl||DEFAULT_API).trim().replace(/\/+$/,'')}catch{API=DEFAULT_API}return API}
export async function health(){
  if(!API)return{ok:false,reason:'not-configured'};
  try{const c=new AbortController();setTimeout(()=>c.abort(),8000);const r=await fetch(API+'/health',{signal:c.signal,cache:'no-store'});const j=await r.json().catch(()=>({}));return j.ok===true?{ok:true,model:j.model||''}:{ok:false,reason:'bad-response'}}catch{return{ok:false,reason:'unreachable'}}}
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
export async function stream(o){
  if(!API)throw new AIError('config','not-configured');
  const state={got:false};
  for(let n=0;;n++)try{return await once(o,state)}catch(e){if(!(e instanceof AIError))throw new AIError('network',e.message,{retry:true});
    if(e.retry&&!state.got&&n<1&&!o.signal?.aborted){await new Promise(r=>setTimeout(r,800));continue}throw e}}
