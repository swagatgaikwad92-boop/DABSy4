# Mock of the /chat SSE contract for local testing only. NOT the production backend.
import json,sys
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
class H(BaseHTTPRequestHandler):
  def log_message(self,*a):pass
  def _c(self,code=200,ct='application/json'):
    self.send_response(code);self.send_header('content-type',ct);self.send_header('access-control-allow-origin','*');self.send_header('access-control-allow-headers','*');self.end_headers()
  def do_OPTIONS(self):self._c(204)
  def do_GET(self):
    self._c();self.wfile.write(json.dumps({'ok':True,'model':'mock'}).encode())
  def ev(self,e,d):self.wfile.write(f'event: {e}\ndata: {json.dumps(d)}\n\n'.encode());self.wfile.flush()
  def do_POST(self):
    b=json.loads(self.rfile.read(int(self.headers['content-length'])));m=b['messages'];last=m[-1]
    self._c(200,'text/event-stream')
    if last['role']=='user' and isinstance(last['content'],list):  # tool results came back
      res=json.loads(last['content'][0]['content']);txt='Done — saved.' if res.get('ok') else 'That did not work: '+str(res.get('error'))
      self.ev('text',{'t':txt});self.ev('done',{'stop':'end_turn'});return
    t=last['content'].lower()
    if 'chemistry' in t: self.ev('text',{'t':'On it. '});self.ev('tool',{'id':'tu1','name':'create_task','input':{'title':'🧪 Chemistry homework','due':'2026-10-31'}});self.ev('done',{'stop':'tool_use'});return
    if 'plan my day' in t: self.ev('tool',{'id':'tu2','name':'plan_day','input':{'date':'2026-10-30','mood':'Ghibli','items':[{'title':'🍵 Slow morning tea','time':'08:30'},{'title':'📚 Focus block','time':'10:00'},{'title':'🌿 Walk','time':'16:30'}]}});self.ev('done',{'stop':'tool_use'});return
    if 'photosynthesis' in t:
      for p in ['## Photosynthesis\n\nPlants turn **light, water and CO₂** into sugar and oxygen. ','It happens in chloroplasts in two stages: the light reactions and the Calvin cycle. '*6]: self.ev('text',{'t':p})
      self.ev('done',{'stop':'end_turn'});return
    self.ev('text',{'t':'Hello there!'});self.ev('done',{'stop':'end_turn'})
ThreadingHTTPServer(('127.0.0.1',8787),H).serve_forever()
