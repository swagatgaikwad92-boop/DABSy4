/* Environment awareness: sitting-spot registry mapped onto the REAL rendered scene.
   image coords -> screen via the same "cover" transform the CSS background uses. */
const REF_Y=.72,HORIZON=.28;               // perspective: scale 1 at ny=.72, 0 at the horizon
const WEIGHTS={rest:{sleepy:6,affectionate:2,idle:1,night:3},work:{focused:5,curious:2,idle:1.5},look:{curious:4,idle:2,excited:2,day:2},open:{playful:4,excited:3,idle:1}};
let DB=null,scene='',natural={w:9,h:16},reg=[],W=0,H=0,dw=0,L={},cache={};
export async function initSpots(){try{DB=await(await fetch('./src/spots.json')).json()}catch{DB={}}}
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
export async function setScene(name){
  scene=name;const url=`./assets/scene-${name}-day.webp`,out=[];
  for(const s of DB[name]||[]){const sp={...s,scene:name,snapped:false,conf:1,valid:true};
    if(!s.soft){const e=await edgeOf(url,s);if(e){natural=e.nat;if(e.conf>=1.35){sp.y=e.ny;sp.snapped=true;sp.conf=e.conf}else sp.valid=false}else sp.valid=false}
    else{await edgeOf(url,s)}
    out.push(sp)}
  reg=out;if(W)layout(W,H,L.dabsyW)}
/* map to screen with background-size:cover, centred */
export function layout(w,h,dabsyW=100){W=w;H=h;L.dabsyW=dabsyW;const s=Math.max(w/natural.w,h/natural.h),iw=natural.w*s,ih=natural.h*s,ox=(w-iw)/2,oy=(h-ih)/2;dw=iw;
  for(const p of reg){const sc=persp(p.y),sx0=ox+p.x0*iw,sx1=ox+p.x1*iw,mx=8;p.scale=sc;p.sy=oy+p.y*ih;p.sx0=Math.max(sx0,mx);p.sx1=Math.min(sx1,w-mx);p.sw=p.sx1-p.sx0;p.cx=(p.sx0+p.sx1)/2;
   p.needs=dabsyW*sc*1.05;p.fits=p.valid&&p.sw>=p.needs&&p.sy>60&&p.sy<h-20;p.room=p.sw-p.needs}}
export const list=()=>reg.filter(p=>p.fits);
export const all=()=>reg;
export const home=()=>list().find(p=>p.home)||list()[0]||null;
export const byId=id=>reg.find(p=>p.id===id);
/* where can she stand at screen x,y (bottom-centre)? choose the surface just below her; else home */
export function groundAt(x,y){let best=null;for(const p of list()){const m=Math.min(p.needs*.3,p.sw*.15);if(x>=p.sx0+m-4&&x<=p.sx1-m+4&&p.sy>=y-6&&(!best||p.sy<best.sy))best=p}return best}
export function spotAt(x,y){return list().find(p=>Math.abs(p.sy-y)<3&&x>=p.sx0-4&&x<=p.sx1+4)||null}
/* a standing x on a spot: keep a margin so she is fully on the surface */
export function standX(p,prefX){const m=p.needs/2;return Math.min(p.sx1-m,Math.max(p.sx0+m,prefX??p.cx))}
export function pick({state='idle',night=false,exclude=null,avoid=[]}){
  const c=list().filter(p=>p!==exclude&&!avoid.some(r=>{const x=p.cx,hw=p.needs/2,hh=p.needs*1.05;return !(x+hw<r.x||x-hw>r.x+r.w||p.sy<r.y||p.sy-hh>r.y+r.h)}));
  if(!c.length)return null;const ws=c.map(p=>{const t=WEIGHTS[p.kind]||{};return .3+(t[state]||0)+(night?t.night||0:t.day||0)+(t.idle||0)});
  let r=Math.random()*ws.reduce((a,b)=>a+b,0);for(let i=0;i<c.length;i++){r-=ws[i];if(r<=0)return c[i]}return c[c.length-1]}
/* nearest surface she can still reach when nothing is directly beneath her (used to steer a fall) */
export function catchSpot(x,y){const c=list().filter(p=>p.sy>=y-6);if(!c.length)return home();let b=null,bd=1e9;for(const p of c){const d=x<p.sx0?p.sx0-x:x>p.sx1?x-p.sx1:0,dd=d+(p.sy-y)*.15;if(dd<bd){bd=dd;b=p}}return b}
