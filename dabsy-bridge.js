/* dabsy-bridge.js — drop into Ghibli Calendar, Study Space and SolveCount:
   <script src="https://<your-dabsy-host>/dabsy-bridge.js"></script>   (or copy the file next to the page)
   Works only when the page is opened inside DABSy (iframe); standalone it quietly does nothing.

   DABSy.ready(()=>{...})            fires once DABSy answers
   DABSy.onState(s=>{...})           s = {today, night, tasks[], events[], studyLog{date:min}}; fires on every change
   DABSy.addEvent({title,date:'YYYY-MM-DD',start:'HH:MM',end?,extId?})   extId makes it update instead of duplicate
   DABSy.deleteEvent(extId)   DABSy.addTask({title,due?,time?,priority?})
   DABSy.completeTask(id,done)   DABSy.studyMinutes(n)                    */
(function(W){
  var inFrame=W.parent!==W,subs=[],rdy=[],last=null,pend={},n=0,host='*';
  try{if(document.referrer)host=new URL(document.referrer).origin}catch(e){}
  function post(type,d){if(!inFrame)return Promise.resolve({ok:false,error:'not in DABSy'});
    var id='r'+(++n);return new Promise(function(res){pend[id]=res;setTimeout(function(){if(pend[id]){delete pend[id];res({ok:false,error:'timeout'})}},6000);
      W.parent.postMessage(Object.assign({dabsy:1,type:type,reqId:id},d||{}),host)})}
  W.addEventListener('message',function(e){var m=e.data;if(e.source!==W.parent||!m||m.dabsy!==1)return;
    if(m.type==='state'){var first=!last;last=m;subs.forEach(function(f){try{f(m)}catch(x){}});if(first)rdy.splice(0).forEach(function(f){try{f()}catch(x){}})}
    else if(m.type==='ack'&&pend[m.reqId]){pend[m.reqId](m);delete pend[m.reqId]}});
  W.DABSy={inDabsy:inFrame,state:function(){return last},
    ready:function(f){last?f():rdy.push(f)},onState:function(f){subs.push(f);last&&f(last)},
    addEvent:function(o){return post('add_event',o)},deleteEvent:function(id){return post('delete_event',{extId:id})},
    addTask:function(o){return post('add_task',o)},completeTask:function(id,d){return post('complete_task',{id:id,done:d!==false})},
    studyMinutes:function(m){return post('study_minutes',{minutes:m})}};
  post('hello');
})(window);
