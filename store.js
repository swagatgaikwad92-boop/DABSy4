const P='dabsy4:',all=new Set();
export function store(key,init){
  let d;try{d={...init,...JSON.parse(localStorage.getItem(P+key)).d}}catch{d=structuredClone(init)}
  const subs=new Set();let t;
  const save=()=>{clearTimeout(t);try{localStorage.setItem(P+key,JSON.stringify({d}))}catch{}};
  const s={get:()=>d,set(p){d=typeof p==='function'?p(d):{...d,...p};clearTimeout(t);t=setTimeout(save,150);subs.forEach(f=>f(d));return d},
    on(f){subs.add(f);return()=>subs.delete(f)},flush:save,reset(){d=structuredClone(init);save();subs.forEach(f=>f(d))}};
  all.add(s);return s}
addEventListener('pagehide',()=>all.forEach(s=>s.flush()));
document.addEventListener('visibilitychange',()=>document.hidden&&all.forEach(s=>s.flush()));
export const resetAll=()=>all.forEach(s=>s.reset());
