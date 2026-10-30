// Zero-dependency build: copies the app to dist/ and generates a versioned service worker.
import {cpSync,rmSync,mkdirSync,readdirSync,statSync,writeFileSync,readFileSync} from 'node:fs';
import {join,relative} from 'node:path';import {createHash} from 'node:crypto';
rmSync('dist',{recursive:true,force:true});mkdirSync('dist');
for(const f of ['index.html','config.json','manifest.webmanifest','src','assets'])cpSync(f,join('dist',f),{recursive:true});
const files=[];(function w(d){for(const n of readdirSync(d)){const p=join(d,n);statSync(p).isDirectory()?w(p):files.push('./'+relative('dist',p).replaceAll('\\','/'))}})('dist');
const h=createHash('sha1');files.sort().forEach(f=>h.update(readFileSync(join('dist',f))));const v=h.digest('hex').slice(0,10);
const pre=files.filter(f=>f!=='./config.json');
writeFileSync('dist/sw.js',`const V='${v}',C='dabsy4-'+V,PRE=${JSON.stringify(pre)};
self.addEventListener('install',e=>e.waitUntil(caches.open(C).then(c=>c.addAll(PRE)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil((async()=>{for(const k of await caches.keys())if(k!==C)await caches.delete(k);await self.clients.claim()})()));
self.addEventListener('fetch',e=>{const r=e.request,u=new URL(r.url);if(r.method!=='GET'||u.origin!==location.origin)return;
 if(u.pathname.endsWith('/config.json')||r.mode==='navigate'){e.respondWith(fetch(r).catch(()=>caches.match(r).then(x=>x||caches.match('./index.html'))));return}
 e.respondWith(caches.match(r).then(x=>x||fetch(r).then(res=>{if(res.ok){const c=res.clone();caches.open(C).then(k=>k.put(r,c))}return res})))});
`);
console.log('built dist/ ·',files.length,'files · version',v);
