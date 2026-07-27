
function ensureCourtQueue(court){
  if(!Array.isArray(court.manualQueue))court.manualQueue=[];
}
export function ensureCourtManualQueues(state){
  (state.courts||[]).forEach(ensureCourtQueue);
}
function removeEverywhere(state,matchId){
  state.sharedQueue=(state.sharedQueue||[]).filter(id=>id!==matchId);
  Object.keys(state.venueQueues||{}).forEach(id=>state.venueQueues[id]=state.venueQueues[id].filter(x=>x!==matchId));
  (state.courts||[]).forEach(c=>{
    ensureCourtQueue(c);
    c.manualQueue=c.manualQueue.filter(x=>x!==matchId);
    if(c.playing===matchId)c.playing=null;
    if(c.wait1===matchId)c.wait1=null;
  });
}
function setMatchPlacement(match,court,status){
  if(!match)return;
  match.status=status;
  match.court=court.name;
  match.venueId=court.venueId;
  match.manualAssigned=true;
}
function pushDisplacedToReserve(court,matchId,front=true){
  if(!matchId)return;
  ensureCourtQueue(court);
  court.manualQueue=court.manualQueue.filter(id=>id!==matchId);
  if(front)court.manualQueue.unshift(matchId);else court.manualQueue.push(matchId);
}
function refreshCourtMatchStatuses(court,findMatch){
  if(court.playing){const m=findMatch(court.playing);setMatchPlacement(m,court,'playing');m.startedAt=m.startedAt||new Date().toISOString();}
  if(court.wait1){const m=findMatch(court.wait1);setMatchPlacement(m,court,'court_wait1');}
  (court.manualQueue||[]).forEach(id=>setMatchPlacement(findMatch(id),court,'court_manual_queue'));
}
export function assignToCourtManualQueue(state,{matchId,courtId,position='bottom'},findMatch){
  const court=state.courts.find(c=>c.id===courtId);if(!court)throw new Error('코트를 찾지 못했습니다.');
  ensureCourtQueue(court);removeEverywhere(state,matchId);
  if(position==='top')court.manualQueue.unshift(matchId);else court.manualQueue.push(matchId);
  const match=findMatch(matchId);setMatchPlacement(match,court,'court_manual_queue');
  return{court,match};
}
export function moveCourtMatchFlexible(state,{matchId,targetCourtId,mode='auto'},findMatch){
  const court=state.courts.find(c=>c.id===targetCourtId);if(!court)throw new Error('대상 코트를 찾지 못했습니다.');
  ensureCourtQueue(court);
  const match=findMatch(matchId);if(!match)throw new Error('경기를 찾지 못했습니다.');
  const originalStartedAt=match.startedAt||null;
  removeEverywhere(state,matchId);

  if(mode==='insert-playing'){
    const oldPlaying=court.playing;
    const oldWait1=court.wait1;
    if(oldWait1)pushDisplacedToReserve(court,oldWait1,true);
    court.wait1=oldPlaying||null;
    court.playing=matchId;
    match.startedAt=originalStartedAt||new Date().toISOString();
    refreshCourtMatchStatuses(court,findMatch);
    return{court,match,slot:'playing',shifted:[oldPlaying,oldWait1].filter(Boolean)};
  }
  if(mode==='insert-wait1'){
    const oldWait1=court.wait1;
    if(oldWait1)pushDisplacedToReserve(court,oldWait1,true);
    court.wait1=matchId;
    refreshCourtMatchStatuses(court,findMatch);
    return{court,match,slot:'wait1',shifted:[oldWait1].filter(Boolean)};
  }
  if(mode.startsWith('insert-reserve-')){
    const raw=mode.replace('insert-reserve-','');
    const index=Math.max(0,Math.min(court.manualQueue.length,Number(raw)||0));
    court.manualQueue.splice(index,0,matchId);
    refreshCourtMatchStatuses(court,findMatch);
    return{court,match,slot:'manual',reserveIndex:index};
  }
  if(mode==='auto'&&!court.playing&&!court.isPaused){
    court.playing=matchId;match.startedAt=originalStartedAt||new Date().toISOString();refreshCourtMatchStatuses(court,findMatch);
    return{court,match,slot:'playing'};
  }
  if(mode==='auto'&&!court.wait1&&!court.isPaused){
    court.wait1=matchId;refreshCourtMatchStatuses(court,findMatch);
    return{court,match,slot:'wait1'};
  }
  if(mode==='manual-top')court.manualQueue.unshift(matchId);else court.manualQueue.push(matchId);
  refreshCourtMatchStatuses(court,findMatch);
  return{court,match,slot:'manual'};
}
export function promoteCourtManualQueue(state,court,findMatch){
  ensureCourtQueue(court);
  if(court.isPaused)return false;
  let changed=false;
  if(!court.playing&&court.wait1){
    court.playing=court.wait1;court.wait1=null;
    changed=true;
  }
  if(!court.wait1&&court.manualQueue.length){
    court.wait1=court.manualQueue.shift();changed=true;
  }
  refreshCourtMatchStatuses(court,findMatch);
  return changed;
}
export function returnManualQueueItemToVenue(state,{courtId,matchId,position='top'},findMatch){
  const court=state.courts.find(c=>c.id===courtId);if(!court)throw new Error('코트를 찾지 못했습니다.');
  ensureCourtQueue(court);
  const index=court.manualQueue.indexOf(matchId);if(index<0)throw new Error('수동 대기 경기에서 찾지 못했습니다.');
  court.manualQueue.splice(index,1);
  const venueId=court.venueId||'venue-default';
  if(!state.venueQueues[venueId])state.venueQueues[venueId]=[];
  if(position==='top')state.venueQueues[venueId].unshift(matchId);else state.venueQueues[venueId].push(matchId);
  const m=findMatch(matchId);if(m){m.status='venue_shared_queue';m.court=null;m.venueId=venueId;m.manualAssigned=false;}
  return true;
}
export function reorderCourtManualQueue(state,{courtId,matchId,direction}){
  const court=state.courts.find(c=>c.id===courtId);if(!court)throw new Error('코트를 찾지 못했습니다.');
  ensureCourtQueue(court);const index=court.manualQueue.indexOf(matchId);if(index<0)return false;
  const next=direction==='up'?index-1:index+1;if(next<0||next>=court.manualQueue.length)return false;
  [court.manualQueue[index],court.manualQueue[next]]=[court.manualQueue[next],court.manualQueue[index]];
  return true;
}
