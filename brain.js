export const S={IDLE:'idle',CURIOUS:'curious',HAPPY:'happy',SLEEPY:'sleepy',PLAYFUL:'playful',FOCUSED:'focused',AFFECTIONATE:'affectionate',GRUMPY:'grumpy',EXCITED:'excited'};
/* Needs-driven state machine. Every state has a hard expiry, so nothing (esp. GRUMPY) can persist. */
export function createBrain({onChange,hour=()=>new Date().getHours()}){
 const n={energy:.8,affection:.5,boredom:.2};let state=S.IDLE,until=0,dizzyUntil=0,drops=[],lastInt=Date.now(),lastNudge=0,locked=false,grump=0,sleepSince=0;
 const now=()=>performance.now();
 function set(s,ms){const ch=s!==state;state=s;until=now()+ms;if(ch)onChange(s,now()<dizzyUntil)}
 function touch(){lastInt=Date.now();if(state===S.SLEEPY){n.energy=Math.max(n.energy,.55);return true}return false}
 function event(type,d={}){const woke=touch();if(locked&&type!=='pet'&&type!=='drop')return;
  switch(type){
   case'tap':set(woke?S.CURIOUS:S.CURIOUS,3000);n.affection=Math.min(1,n.affection+.02);n.boredom=Math.max(0,n.boredom-.1);break;
   case'pet':n.affection=Math.min(1,n.affection+(d.amount||.05));n.boredom=Math.max(0,n.boredom-.05);if(locked)break;
     if(state===S.GRUMPY){grump+=d.amount||.05;if(grump>.18){grump=0;set(S.HAPPY,5000)}else set(S.GRUMPY,Math.min(12000,until-now()+500))}
     else set(n.affection>.75?S.AFFECTIONATE:S.HAPPY,5000);break;
   case'drop':{const t=now();drops=drops.filter(x=>t-x<25000);drops.push(t);
     if(drops.length>=3){dizzyUntil=t+3500;grump=0;n.affection=Math.max(0,n.affection-.1);locked=false;set(S.GRUMPY,12000);onChange(S.GRUMPY,true);setTimeout(()=>onChange(state,false),3500)}
     else if(!locked)set(drops.length===2?S.CURIOUS:S.PLAYFUL,2500);break}
   case'widget':set(S.CURIOUS,2500);break;
   case'return':if(!locked)set(S.EXCITED,4500);break;
   case'notify':if(!locked)set(S.CURIOUS,3500);break;
  }}
 function tick(){const t=now();
  if(state===S.SLEEPY)n.energy=Math.min(1,n.energy+.012);else n.energy=Math.max(0,n.energy-.0012);
  n.boredom=Math.min(1,n.boredom+.006);n.affection=Math.max(0,n.affection-.0007);
  if(locked||t<until)return;
  const h=hour(),night=h>=23||h<6;
  if(state===S.SLEEPY&&n.energy<.8&&Date.now()-lastInt>8000)return set(S.SLEEPY,15000);
  if(night||n.energy<.22)return set(S.SLEEPY,30000);
  if(n.boredom>.65){n.boredom=.15;return set(S.PLAYFUL,9000)}
  if(n.affection>.8&&Math.random()<.3)return set(S.AFFECTIONATE,6000);
  set(Math.random()<.3?S.CURIOUS:S.IDLE,8000)}
 return{event,tick,needs:n,get state(){return state},get dizzy(){return now()<dizzyUntil},
  lock(s){locked=true;set(s,1e9)},unlock(){locked=false;set(S.IDLE,1500)},
  shouldNudge(enabled){const t=Date.now();if(!enabled||locked||state===S.SLEEPY||t-lastInt<24e4||t-lastNudge<36e4)return false;lastNudge=t;return true},
  set};}
