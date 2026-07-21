
import{allMatches}from'./bracket-engine.js';

function venueIds(courts){return[...new Set(courts.map(c=>c.venueId||'venue-default'))];}
function ensureQueues(state){
  if(!state.venueQueues||typeof state.venueQueues!=='object')state.venueQueues={};
  venueIds(state.courts||[]).forEach(id=>{if(!Array.isArray(state.venueQueues[id]))state.venueQueues[id]=[];});
}
function queueFor(state,venueId){
  ensureQueues(state);
  return state.venueQueues[venueId]||(state.venueQueues[venueId]=[]);
}
export function buildCourts(count,prefix){
  return Array.from({length:count},(_,i)=>({id:`court-${i+1}`,name:`${prefix}${i+1}`,venueId:'venue-default',venueName:prefix,playing:null,wait1:null}));
}
export function assignInitial(draw,courts,state=null){
  const ready=allMatches(draw).filter(m=>m.status==='ready');
  courts.forEach(c=>{c.playing=null;c.wait1=null;if(!('isPaused'in c))c.isPaused=false;});
  let index=0;
  courts.filter(c=>!c.isPaused).forEach(c=>{
    if(ready[index]){
      c.playing=ready[index].id;ready[index].status='playing';ready[index].court=c.name;ready[index].venueId=c.venueId;ready[index].startedAt=new Date().toISOString();index++;
    }
  });
  courts.filter(c=>!c.isPaused).forEach(c=>{
    if(ready[index]){
      c.wait1=ready[index].id;ready[index].status='court_wait1';ready[index].court=c.name;ready[index].venueId=c.venueId;index++;
    }
  });
  if(!state){
    const shared=[];
    while(index<ready.length){ready[index].status='shared_queue';ready[index].court=null;shared.push(ready[index].id);index++;}
    return shared;
  }
  ensureQueues(state);
  Object.keys(state.venueQueues).forEach(id=>state.venueQueues[id]=[]);
  const ids=venueIds(courts);
  let venueIndex=0;
  while(index<ready.length){
    const venueId=ids[venueIndex%ids.length];
    ready[index].status='venue_shared_queue';ready[index].court=null;ready[index].venueId=venueId;
    queueFor(state,venueId).push(ready[index].id);
    venueIndex++;index++;
  }
  state.sharedQueue=[];
  return [];
}
export function removeFromQueues(state,matchId){
  let sourceCourt=null;
  state.courts.forEach(c=>{
    if(c.playing===matchId){c.playing=null;sourceCourt=c;}
    if(c.wait1===matchId)c.wait1=null;
  });
  state.sharedQueue=(state.sharedQueue||[]).filter(id=>id!==matchId);
  ensureQueues(state);
  Object.keys(state.venueQueues).forEach(id=>state.venueQueues[id]=state.venueQueues[id].filter(x=>x!==matchId));
  return sourceCourt;
}
export function refillCourt(state,court,findMatch){
  if(!court||court.isPaused)return;
  if(!court.playing&&court.wait1){
    court.playing=court.wait1;court.wait1=null;
    const m=findMatch(court.playing);if(m){m.status='playing';m.court=court.name;m.venueId=court.venueId;m.startedAt=new Date().toISOString();}
  }
  if(!court.wait1){
    ensureQueues(state);
    const q=queueFor(state,court.venueId||'venue-default');
    if(q.length){
      court.wait1=q.shift();
      const m=findMatch(court.wait1);if(m){m.status='court_wait1';m.court=court.name;m.venueId=court.venueId;}
    }else if((state.sharedQueue||[]).length){
      court.wait1=state.sharedQueue.shift();
      const m=findMatch(court.wait1);if(m){m.status='court_wait1';m.court=court.name;m.venueId=court.venueId;}
    }
  }
}
export function queueReadyMatches(state,findMatch){
  ensureQueues(state);
  const occupied=new Set(state.courts.flatMap(c=>[c.playing,c.wait1]).filter(Boolean));
  (state.sharedQueue||[]).forEach(id=>occupied.add(id));
  Object.values(state.venueQueues).flat().forEach(id=>occupied.add(id));
  const ready=allMatches(state.draw).filter(m=>m.status==='ready'&&!occupied.has(m.id));
  const ids=venueIds(state.courts);
  let cursor=0;
  ready.forEach(m=>{
    const venueId=m.venueId&&ids.includes(m.venueId)?m.venueId:ids[cursor%ids.length];
    m.status='venue_shared_queue';m.venueId=venueId;queueFor(state,venueId).push(m.id);cursor++;
  });
  state.courts.filter(c=>!c.isPaused).forEach(c=>refillCourt(state,c,findMatch));
}
export function venueQueueSnapshot(state){
  ensureQueues(state);
  return Object.fromEntries(Object.entries(state.venueQueues).map(([id,q])=>[id,[...q]]));
}
