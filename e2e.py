import json,sys
from playwright.sync_api import sync_playwright
URL='http://127.0.0.1:8080/';API=sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:8787'
R=[];err=[]
def ok(n,c,d=''):R.append((n,bool(c),d));print(('PASS ' if c else 'FAIL ')+n+(' — '+str(d) if d and not c else ''))
with sync_playwright() as p:
  b=p.chromium.launch();ctx=b.new_context(viewport={'width':390,'height':800},has_touch=True,is_mobile=True,device_scale_factor=2,service_workers='block')
  pg=ctx.new_page();pg.set_default_timeout(8000);pg.on('console',lambda m:err.append(m.text) if m.type=='error' else None);pg.on('pageerror',lambda e:err.append(str(e)))
  pg.route('**/config.json',lambda r:r.fulfill(json=({'apiUrl':API} if API!='none' else {'apiUrl':''}),headers={'access-control-allow-origin':'*'}))
  pg.add_init_script("localStorage.setItem('dabsy4:prefs',JSON.stringify({d:{onboarded:true,motion:'full'}}))")
  pg.goto(URL);pg.wait_for_selector('.dabsy[data-ready="1"]');pg.wait_for_timeout(600)
  ok('home renders, DABSy small',pg.evaluate("document.querySelector('.dabsy').getBoundingClientRect().width")<130)
  ok('scene image loaded',pg.evaluate("!!document.querySelector('.sl.on')"))
  box=pg.evaluate("(()=>{const r=document.querySelector('.dabsy').getBoundingClientRect();return[r.x+r.width/2,r.y+r.height/2]})()")
  # single tap
  pg.mouse.click(*box);pg.wait_for_timeout(500)
  ok('single tap -> speech + curious',pg.evaluate("!document.querySelector('.speak').hidden && document.querySelector('.dabsy').dataset.state==='curious'"))
  # double tap -> bubbles
  pg.wait_for_timeout(300);pg.mouse.dblclick(*box);pg.wait_for_timeout(900)
  nb=pg.evaluate("document.querySelectorAll('.bubble').length");ok('double tap opens 6 bubbles',nb==6,nb)
  inside=pg.evaluate("[...document.querySelectorAll('.bubble')].every(b=>{const r=b.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight})");ok('bubbles inside viewport',inside)
  pg.screenshot(path='/tmp/s_bubbles.png')
  # widgets via bubble -> tray -> drag chip
  pg.evaluate("document.querySelector('.bubble[aria-label=Widgets]').click()");pg.wait_for_timeout(700)
  ok('tray opens',pg.evaluate("document.querySelector('.tray').dataset.open==='1'"))
  chip=pg.evaluate("(()=>{const r=document.querySelector('.chip-w').getBoundingClientRect();return[r.x+r.width/2,r.y+r.height/2]})()")
  for typ,tx in [(0,110),(2,290)]:
    c=pg.evaluate(f"(()=>{{const r=document.querySelectorAll('.chip-w')[{typ}].getBoundingClientRect();return[r.x+r.width/2,r.y+r.height/2]}})()")
    pg.mouse.move(*c);pg.mouse.down();pg.mouse.move(c[0],c[1]-120,steps=4);pg.mouse.move(tx,200,steps=10);pg.wait_for_timeout(250);pg.mouse.up();pg.wait_for_timeout(1200)
  ok('2 widgets placed',pg.evaluate("document.querySelectorAll('.widget').length")==2)
  inb=pg.evaluate("[...document.querySelectorAll('.widget')].every(w=>{const r=w.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1&&r.top>=0&&r.bottom<=innerHeight+1})");ok('widgets inside screen',inb)
  # throw widget
  w0=pg.evaluate("(()=>{const r=document.querySelector('.w-clock').getBoundingClientRect();return[r.x+r.width/2,r.y+r.height/2,r.x]})()")
  pg.mouse.move(w0[0],w0[1]);pg.mouse.down();pg.wait_for_timeout(450);pg.mouse.move(w0[0]+30,w0[1],steps=2);pg.mouse.move(w0[0]+90,w0[1]+5,steps=4)
  xr=pg.evaluate("document.querySelector('.w-clock').getBoundingClientRect().x");pg.mouse.up();mx=0
  for _ in range(12):
    pg.wait_for_timeout(100);mx=max(mx,abs(pg.evaluate("document.querySelector('.w-clock').getBoundingClientRect().x")-xr))
  pg.wait_for_timeout(2500)
  ok('long-press pick-up + throw carries momentum after release',mx>40,mx)
  pg.wait_for_timeout(1500)
  # pinch via CDP touch
  before=pg.evaluate("document.querySelector('.w-clock').getBoundingClientRect().width")
  cdp=ctx.new_cdp_session(pg);r=pg.evaluate("(()=>{const r=document.querySelector('.w-clock').getBoundingClientRect();return[r.x+r.width/2,r.y+r.height/2]})()");cx,cy=r
  cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':cx-20,'y':cy,'id':1},{'x':cx+20,'y':cy,'id':2}]})
  for i in range(1,9):cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':cx-20-i*8,'y':cy,'id':1},{'x':cx+20+i*8,'y':cy,'id':2}]})
  cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});pg.wait_for_timeout(500)
  after=pg.evaluate("document.querySelector('.w-clock').getBoundingClientRect().width");ok('pinch enlarges widget',after>before*1.3,(before,after))
  pg.wait_for_timeout(600);saved=pg.evaluate("JSON.parse(localStorage.getItem('dabsy4:widgets')).d.items.length");ok('widgets persisted',saved==2,saved)
  # remove by dragging into tray
  c=pg.evaluate("(()=>{const r=document.querySelector('.w-tasks').getBoundingClientRect();return[r.x+r.width/2,r.y+r.height/2]})()");pg.mouse.move(*c);pg.mouse.down();pg.wait_for_timeout(450)
  tr=pg.evaluate("(()=>{const r=document.querySelector('.tray').getBoundingClientRect();return[r.x+r.width/2,r.y+r.height/2]})()");pg.mouse.move(c[0],c[1]+30,steps=3);pg.mouse.move(*tr,steps=8);pg.mouse.up();pg.wait_for_timeout(700)
  ok('drag back into tray removes widget',pg.evaluate("document.querySelectorAll('.widget').length")==1)
  pg.reload();pg.wait_for_selector('.dabsy[data-ready="1"]');pg.wait_for_timeout(700)
  ok('widget restored after reload',pg.evaluate("document.querySelectorAll('.widget').length")==1)
  pg.screenshot(path='/tmp/s_home.png')
  # drag + drop physics
  box=pg.evaluate("(()=>{const r=document.querySelector('.dabsy').getBoundingClientRect();return[r.x+r.width/2,r.y+r.height/2]})()")
  floor=pg.evaluate("__dabsy.dabsy.y")
  pg.mouse.move(*box);pg.mouse.down();pg.mouse.move(box[0]+5,box[1]-30,steps=2);pg.mouse.move(200,200,steps=6);pg.wait_for_timeout(250)
  ok('drag lifts her',pg.evaluate("__dabsy.dabsy.y")<floor-80,pg.evaluate("__dabsy.dabsy.y"))
  pg.mouse.up();
  try:pg.wait_for_function("__dabsy.dabsy.mode==='rest'",timeout=7000)
  except Exception:pass
  ok('drop: lands ON a registered surface',pg.evaluate("(()=>{const c=__dabsy.current;return !!c&&Math.abs(__dabsy.dabsy.y-c.sy)<1.5&&__dabsy.dabsy.mode==='rest'})()"),pg.evaluate("[__dabsy.dabsy.y,__dabsy.dabsy.mode,__dabsy.current?.id]"))
  # repeated drops -> grumpy -> recovers
  for i in range(3):
    b2=pg.evaluate("(()=>{const r=document.querySelector('.dabsy').getBoundingClientRect();return[r.x+r.width/2,r.y+r.height/2]})()")
    pg.mouse.move(*b2);pg.mouse.down();pg.mouse.move(b2[0]+4,b2[1]-30,steps=2);pg.mouse.move(180+i*30,220,steps=5);pg.mouse.up();pg.wait_for_timeout(1700)
  ok('3 drops -> grumpy',pg.evaluate("__dabsy.brain.state")=='grumpy',pg.evaluate("__dabsy.brain.state"))
  # petting while grumpy
  b2=pg.evaluate("(()=>{const r=document.querySelector('.dabsy').getBoundingClientRect();return[r.x+r.width/2,r.y+r.height*.35]})()")
  pg.mouse.move(b2[0]-25,b2[1]);pg.mouse.down()
  for k in range(30):pg.mouse.move(b2[0]-25+(k%10)*5,b2[1]+k*1.2);pg.wait_for_timeout(45)
  act=pg.evaluate("document.querySelector('.dabsy').dataset.act");pg.mouse.up();pg.wait_for_timeout(300)
  ok('slow stroke = petting (not drag)',act=='petting',act);ok('petting soothes grumpiness',pg.evaluate("__dabsy.brain.state") in('happy','affectionate'),pg.evaluate("__dabsy.brain.state"))
  # chat
  pg.evaluate("document.querySelector('.dabsy').dispatchEvent(new Event('x'))")
  b2=pg.evaluate("(()=>{const r=document.querySelector('.dabsy').getBoundingClientRect();return[r.x+r.width/2,r.y+r.height/2]})()");pg.mouse.dblclick(*b2);pg.wait_for_timeout(900);pg.evaluate("document.querySelector('.bubble[aria-label=Chat]').click()");pg.wait_for_timeout(1800)
  ok('chat opened, DABSy anchored top, small',pg.evaluate("document.querySelector('#app').dataset.view")=='chat' and pg.evaluate("document.querySelector('.dabsy').getBoundingClientRect().top")<150)
  ta=pg.locator('.ta');ta.click();pg.wait_for_timeout(300)
  def send(t):ta.fill(t);pg.click('.send');pg.wait_for_timeout(1800)
  send('add chemistry homework for tomorrow')
  ok('task created via tool call',pg.evaluate("JSON.parse(localStorage.getItem('dabsy4:tasks')||'{}').d?.items?.some(t=>t.title.includes('Chemistry'))") if pg.evaluate("1") else False)
  ok('confirmation text from real tool result',pg.locator('.msgs').inner_text().count('saved')>0 or 'Done' in pg.locator('.msgs').inner_text())
  send('plan my day, ghibli');ok('plan card shown',pg.locator('.plan').count()==1)
  pg.click('.plan .btn.primary');pg.wait_for_timeout(1500)
  n=pg.evaluate("JSON.parse(localStorage.getItem('dabsy4:tasks')).d.items.length");ok('plan saved only after confirm (1+3 tasks)',n==4,n)
  send('Hey, explain photosynthesis');pg.wait_for_timeout(500);ok('study follow-up chips offered',pg.locator('.follow').count()==1)
  ok('markdown rendered (h3)',pg.locator('.bubbot h4').count()>=1)
  pg.screenshot(path='/tmp/s_chat.png')
  # composer grows, stays above bottom
  ta.fill('line\n'*8);pg.wait_for_timeout(200);r=pg.evaluate("(()=>{const a=document.querySelector('.ta').getBoundingClientRect();return[a.height,a.bottom,innerHeight]})()");ok('composer grows & stays on screen',r[0]>60 and r[1]<=r[2],r)
  # simulate keyboard (layout height shrink) - chat must refit w/o transforms
  pg.set_viewport_size({'width':390,'height':480});pg.wait_for_timeout(600)
  r=pg.evaluate("(()=>{const a=document.querySelector('.composer').getBoundingClientRect();return[a.bottom,innerHeight,document.querySelector('#app').style.transform,document.querySelector('.dabsy').getBoundingClientRect().top]})()")
  ok('keyboard-height viewport: composer visible, no transform hack',r[0]<=r[1]+1 and r[2]=='' ,r)
  pg.set_viewport_size({'width':390,'height':800});pg.wait_for_timeout(500)
  pg.go_back();pg.wait_for_timeout(1800)
  ok('back button closes chat -> home',pg.evaluate("document.querySelector('#app').dataset.view")=='home')
  ok('DABSy back on her surface after chat',abs(pg.evaluate("__dabsy.dabsy.y")-pg.evaluate("__dabsy.current.sy"))<2,pg.evaluate("[__dabsy.dabsy.y,__dabsy.current?.sy]"))
  ok('no console errors',not err,err[:3])
  b.close()
print(sum(1 for r in R if r[1]),'/',len(R),'passed')
