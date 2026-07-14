import {STATUS} from './constants.js';
import {allMatches,isReady} from './bracket.js';
import {balancedOrder,nowIso} from './utils.js';

export function makeCourts(count,prefix='국제'){
  return Array.from({length:count},(_,i)=>({id:`court_${i+1}`,name:`${prefix}${i+1}`,venue:prefix,playing:null,wait1:null}));
}

function clearAssignment(match){
  match.venue='';match.court='';match.queueOrder=null;match.startedAt=null;
  if(match.status!==STATUS.COMPLETED) match.status=isReady(match)?STATUS.UNASSIGNED:STATUS.WAITING_SLOTS;
}

export function clearAllAssignments(state){
  allMatches(state.draw).forEach(clearAssignment);
  state.courts.forEach(c=>{c.playing=null;c.wait1=null;});
  state.sharedQueue=[];
}

export function initialAssign(state){
  clearAllAssignments(state);
  const firstRound=state.draw.rounds[state.draw.size].filter(isReady);
  const order=balancedOrder(firstRound.length).map(n=>firstRound[n-1]).filter(Boolean);
  const courts=state.courts;
  let idx=0;
  for(const court of courts){
    const match=order[idx++]; if(!match) break;
    placePlaying(state,court,match);
  }
  for(const court of courts){
    const match=order[idx++]; if(!match) break;
    placeWait1(state,court,match);
  }
  while(idx<order.length){placeShared(state,order[idx++]);}
  normalizeQueueOrders(state);
}

export function placePlaying(state,court,match){
  court.playing=match.id;match.status=STATUS.PLAYING;match.court=court.name;match.venue=court.venue;match.startedAt=match.startedAt||nowIso();match.queueOrder=null;
}
export function placeWait1(state,court,match){
  court.wait1=match.id;match.status=STATUS.WAIT1;match.court=court.name;match.venue=court.venue;match.queueOrder=1;
}
export function placeShared(state,match){
  if(!state.sharedQueue.includes(match.id)) state.sharedQueue.push(match.id);
  match.status=STATUS.SHARED;match.court='';match.venue=state.courts[0]?.venue||'';match.queueOrder=state.sharedQueue.length;
}

export function normalizeQueueOrders(state){
  state.sharedQueue=state.sharedQueue.filter(id=>{
    const m=allMatches(state.draw).find(x=>x.id===id);
    return m&&m.status===STATUS.SHARED;
  });
  state.sharedQueue.forEach((id,i)=>{const m=allMatches(state.draw).find(x=>x.id===id);if(m)m.queueOrder=i+1;});
}

export function refreshQueue(state){
  // Strict rule: wait1 -> playing, shared -> wait1. Shared never jumps directly to playing.
  for(const court of state.courts){
    const playing=allMatches(state.draw).find(m=>m.id===court.playing);
    if(playing?.status===STATUS.COMPLETED) court.playing=null;

    if(!court.playing && court.wait1){
      const wait=allMatches(state.draw).find(m=>m.id===court.wait1);
      court.wait1=null;
      if(wait&&wait.status!==STATUS.COMPLETED) placePlaying(state,court,wait);
    }

    if(!court.wait1 && state.sharedQueue.length){
      const nextId=state.sharedQueue.shift();
      const next=allMatches(state.draw).find(m=>m.id===nextId);
      if(next&&next.status!==STATUS.COMPLETED) placeWait1(state,court,next);
    }
  }
  normalizeQueueOrders(state);
}

export function enqueueNewReadyMatches(state){
  const assigned=new Set([
    ...state.sharedQueue,
    ...state.courts.flatMap(c=>[c.playing,c.wait1]).filter(Boolean)
  ]);
  allMatches(state.draw).filter(m=>isReady(m)&&m.status===STATUS.UNASSIGNED&&!assigned.has(m.id))
    .sort((a,b)=>b.roundSize-a.roundSize||a.matchNo-b.matchNo)
    .forEach(m=>placeShared(state,m));
  normalizeQueueOrders(state);
}

export function completeAndAdvanceQueue(state,matchId){
  const court=state.courts.find(c=>c.playing===matchId||c.wait1===matchId);
  if(court&&court.playing===matchId) court.playing=null;
  if(court&&court.wait1===matchId) court.wait1=null;
  enqueueNewReadyMatches(state);
  if(state.autoAssign) refreshQueue(state);
}
