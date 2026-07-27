
function ensureCourtQueue(court){
  if(!Array.isArray(court.queue))court.queue=[];
}
function findCourt(state,courtId){
  const court=state.prelim?.courts?.find(c=>c.id===courtId);
  if(!court)throw new Error('예선 코트를 찾지 못했습니다.');
  ensureCourtQueue(court);
  return court;
}
function removeMatchFromCourt(court,matchId){
  ensureCourtQueue(court);
  let source='queue';
  if(court.wait1===matchId){court.wait1=null;source='wait1';}
  else court.queue=court.queue.filter(id=>id!==matchId);
  return source;
}
function promoteCourt(state,court){
  ensureCourtQueue(court);
  if(!court.wait1&&court.queue.length){
    court.wait1=court.queue.shift();
    const m=state.prelim.matches.find(x=>x.id===court.wait1);
    if(m)m.status='court_wait1';
  }
}
export function reorderPrelimQueue(state,{courtId,matchId,direction}){
  const court=findCourt(state,courtId);
  const index=court.queue.indexOf(matchId);
  if(index<0)return false;
  const next=direction==='up'?index-1:index+1;
  if(next<0||next>=court.queue.length)return false;
  [court.queue[index],court.queue[next]]=[court.queue[next],court.queue[index]];
  return true;
}
export function movePrelimQueuedMatch(state,{sourceCourtId,targetCourtId,matchId,position='wait1-first'}){
  const source=findCourt(state,sourceCourtId);
  const target=findCourt(state,targetCourtId);
  if(source.playing===matchId)throw new Error('시합중 경기는 직접 이동할 수 없습니다.');
  const match=state.prelim.matches.find(m=>m.id===matchId);
  if(!match)throw new Error('예선 경기를 찾지 못했습니다.');
  removeMatchFromCourt(source,matchId);
  promoteCourt(state,source);

  if(position==='wait1-first'&&!target.wait1){
    target.wait1=matchId;
    match.status='court_wait1';
  }else if(position==='queue-top'||position==='wait1-first'){
    target.queue.unshift(matchId);
    match.status='queued';
  }else{
    target.queue.push(matchId);
    match.status='queued';
  }
  match.prelimCourtId=target.id;
  match.court=target.name;
  match.venueId=target.venueId;
  match.venueName=target.venueName;
  return{source,target,match};
}
export function returnPrelimWait1ToQueue(state,{courtId}){
  const court=findCourt(state,courtId);
  if(!court.wait1)throw new Error('대기1 경기가 없습니다.');
  const matchId=court.wait1;
  court.wait1=null;
  court.queue.unshift(matchId);
  const match=state.prelim.matches.find(m=>m.id===matchId);
  if(match)match.status='queued';
  promoteCourt(state,court);
  return matchId;
}
