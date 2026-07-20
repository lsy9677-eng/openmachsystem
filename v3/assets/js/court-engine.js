
import{allMatches}from'./bracket-engine.js';
export function buildCourts(count,prefix){
  return Array.from({length:count},(_,i)=>({id:`court-${i+1}`,name:`${prefix}${i+1}`,playing:null,wait1:null}));
}
export function assignInitial(draw,courts){
  const ready=allMatches(draw).filter(m=>m.status==='ready');
  courts.forEach(c=>{c.playing=null;c.wait1=null;});
  const shared=[];
  let index=0;
  courts.forEach(c=>{
    if(ready[index]){c.playing=ready[index].id;ready[index].status='playing';ready[index].court=c.name;ready[index].startedAt=new Date().toISOString();index++;}
  });
  courts.forEach(c=>{
    if(ready[index]){c.wait1=ready[index].id;ready[index].status='court_wait1';ready[index].court=c.name;index++;}
  });
  while(index<ready.length){ready[index].status='shared_queue';ready[index].court=null;shared.push(ready[index].id);index++;}
  return shared;
}
export function removeFromQueues(state,matchId){
  let sourceCourt=null;
  state.courts.forEach(c=>{
    if(c.playing===matchId){c.playing=null;sourceCourt=c;}
    if(c.wait1===matchId)c.wait1=null;
  });
  state.sharedQueue=state.sharedQueue.filter(id=>id!==matchId);
  return sourceCourt;
}
export function refillCourt(state,court,findMatch){
  if(!court)return;
  if(!court.playing&&court.wait1){
    court.playing=court.wait1;court.wait1=null;
    const m=findMatch(court.playing);if(m){m.status='playing';m.court=court.name;m.startedAt=new Date().toISOString();}
  }
  if(!court.wait1&&state.sharedQueue.length){
    court.wait1=state.sharedQueue.shift();
    const m=findMatch(court.wait1);if(m){m.status='court_wait1';m.court=court.name;}
  }
}
export function queueReadyMatches(state,findMatch){
  const occupied=new Set(state.courts.flatMap(c=>[c.playing,c.wait1]).filter(Boolean));
  state.sharedQueue.forEach(id=>occupied.add(id));
  const ready=allMatches(state.draw).filter(m=>m.status==='ready'&&!occupied.has(m.id));
  ready.forEach(m=>{m.status='shared_queue';state.sharedQueue.push(m.id);});
  state.courts.forEach(c=>refillCourt(state,c,findMatch));
}
