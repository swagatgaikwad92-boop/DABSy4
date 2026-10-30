/* Back-button layers. Every open layer owns exactly one history entry. History ops are serialised
   (back() is async) so closing one layer and opening another in the same tick cannot corrupt history. */
const st=[],q=[];let busy=false,guard=0;
function run(){while(!busy&&q.length){const o=q.shift();if(o==='push'){try{history.pushState({d:1},'')}catch{}}else{busy=true;clearTimeout(guard);guard=setTimeout(()=>{if(busy){busy=false;run()}},700);try{history.back()}catch{busy=false}}}}
export function pushLayer(close){const l={close};st.push(l);q.push('push');run();return l}
export function popLayer(l){const i=st.indexOf(l);if(i<0)return;st.splice(i,1);q.push('back');run()}
addEventListener('popstate',()=>{if(busy){busy=false;clearTimeout(guard);run();return}const l=st.pop();l?.close(true)});
export const hasLayer=()=>st.length>0;
