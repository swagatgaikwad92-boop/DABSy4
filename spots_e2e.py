import json
from playwright.sync_api import sync_playwright
R=[]
def ok(n,c,d=''):R.append(bool(c));print(('PASS ' if c else 'FAIL ')+n+(' — '+str(d) if d and not c else ''))
with sync_playwright() as p:
  b=p.chromium.launch()
  for vw,vh in [(390,800),(360,740),(412,915)]:
    ctx=b.new_context(viewport={'width':vw,'height':vh},has_touch=True,is_mobile=True,service_workers='block');pg=ctx.new_page();pg.set_default_timeout(8000);err=[]
    pg.on('pageerror',lambda e:err.append(str(e)));pg.on('console',lambda m:err.append(m.text) if m.type=='error' else None)
    pg.route('**/config.json',lambda r:r.fulfill(json={'apiUrl':'http://127.0.0.1:8787'},headers={'access-control-allow-origin':'*'}))
    pg.add_init_script("localStorage.setItem('dabsy4:prefs',JSON.stringify({d:{onboarded:true,motion:'full'}}))")
    pg.goto('http://127.0.0.1:8080/');pg.wait_for_selector('.dabsy[data-ready="1"]');pg.wait_for_timeout(900)
    print(f'--- viewport {vw}x{vh}')
    for sc in ['bedroom','study','garden','cabin']:
      pg.evaluate(f"__dabsy.prefs.set({{scene:'{sc}'}})");pg.wait_for_timeout(1200)
      info=pg.evaluate("""(()=>{const s=__dabsy.spots,d=__dabsy.dabsy;return{fit:s.list().map(p=>p.id),rej:s.all().filter(p=>!p.fits).map(p=>p.id+(p.valid?'(too narrow)':'(no edge)')),snapped:s.all().filter(p=>p.snapped).map(p=>p.id),home:s.home()&&s.home().id,y:d.y,hy:s.home()&&s.home().sy,mode:d.mode,H:innerHeight}})()""")
      print(sc,info)
      ok(f'{sc}: has home spot & she stands exactly on it (bottom==surface)',info['home'] and abs(info['y']-info['hy'])<1.5,info)
      # no teleport: sample positions while hopping to another spot
      if len(info['fit'])>1:
        r=pg.evaluate("""(async()=>{const s=__dabsy.spots,d=__dabsy.dabsy,tgt=s.list().find(p=>p!==__dabsy.current);const xs=[];const t0=performance.now();
          const timer=setInterval(()=>xs.push([d.x,d.y]),50);const ok=await d.hopTo(s.standX(tgt),tgt.sy,tgt.scale,tgt.pose);clearInterval(timer);
          let maxJump=0;for(let i=1;i<xs.length;i++)maxJump=Math.max(maxJump,Math.hypot(xs[i][0]-xs[i-1][0],xs[i][1]-xs[i-1][1]));
          return{ok,maxJump,n:xs.length,dy:d.y-tgt.sy,id:tgt.id,pose:d.pose,onSurface:d.x>=tgt.sx0-2&&d.x<=tgt.sx1+2}})()""")
        ok(f'{sc}: hop to {r["id"]} is continuous (no teleport), lands on surface',r['ok'] and r['maxJump']<75 and abs(r['dy'])<1 and r['onSurface'],r)
        # drop from above this surface -> must land on it
      r=pg.evaluate("""(async()=>{const s=__dabsy.spots,d=__dabsy.dabsy,tgt=s.list().find(p=>p.kind!=='x'&&p!==s.home())||s.home();d.place(s.standX(tgt),tgt.sy-140,tgt.scale,false);
          for(let i=0;i<120&&d.mode!=='rest';i++)await new Promise(r=>setTimeout(r,50));return{mode:d.mode,dy:d.y-tgt.sy,id:tgt.id,cur:__dabsy.current&&__dabsy.current.id}})()""")
      ok(f'{sc}: dropped above {r["id"]} lands on it (no float/sink)',r['mode']=='rest' and abs(r['dy'])<1.5,r)
      # fall from empty air (x far from surfaces) -> steered onto a real surface
      r=pg.evaluate("""(async()=>{const s=__dabsy.spots,d=__dabsy.dabsy,W=innerWidth;d.place(W-30,80,1,false);
          for(let i=0;i<160&&d.mode!=='rest';i++)await new Promise(r=>setTimeout(r,50));const c=s.spotAt(d.x,d.y);return{mode:d.mode,on:c&&c.id,x:d.x,y:d.y}})()""")
      ok(f'{sc}: falling from empty air ends on a real surface',r['mode']=='rest' and r['on'],r)
    ok('no console/page errors',not err,err[:3]);ctx.close()
  b.close()
print(sum(R),'/',len(R))
