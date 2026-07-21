
export function availableCourtSlots(state,venueId){
  const rows=[];
  state.courts.filter(c=>(c.venueId||'venue-default')===venueId).forEach(c=>{
    if(!c.playing)rows.push({courtId:c.id,slot:'playing',label:`${c.name} · 빈코트`});
    if(!c.wait1)rows.push({courtId:c.id,slot:'wait1',label:`${c.name} · 대기1 비어있음`});
  });
  return rows;
}
export function assignQueueMatchToCourt(state,{venueId,matchId,courtId,slot},findMatch){
  const queue=state.venueQueues?.[venueId];
  if(!queue)throw new Error('구장 공용대기열을 찾지 못했습니다.');
  const index=queue.indexOf(matchId);
  if(index<0)throw new Error('공용대기에서 경기를 찾지 못했습니다.');
  const court=state.courts.find(c=>c.id===courtId);
  if(!court)throw new Error('코트를 찾지 못했습니다.');
  if((court.venueId||'venue-default')!==venueId)throw new Error('다른 구장 코트에는 직접 배정할 수 없습니다.');
  const match=findMatch(matchId);if(!match)throw new Error('경기를 찾지 못했습니다.');
  if(slot==='playing'){
    if(court.playing)throw new Error('이미 시합중 경기가 있습니다.');
    court.playing=matchId;match.status='playing';match.court=court.name;match.venueId=venueId;match.startedAt=new Date().toISOString();
  }else{
    if(court.wait1)throw new Error('이미 대기1 경기가 있습니다.');
    court.wait1=matchId;match.status='court_wait1';match.court=court.name;match.venueId=venueId;
  }
  queue.splice(index,1);
  return{court,match,slot};
}
export function returnWait1ToVenueQueue(state,{courtId},findMatch){
  const court=state.courts.find(c=>c.id===courtId);
  if(!court?.wait1)throw new Error('되돌릴 대기1 경기가 없습니다.');
  const matchId=court.wait1,match=findMatch(matchId);
  court.wait1=null;
  const venueId=court.venueId||'venue-default';
  if(!state.venueQueues[venueId])state.venueQueues[venueId]=[];
  state.venueQueues[venueId].unshift(matchId);
  if(match){match.status='venue_shared_queue';match.court=null;match.venueId=venueId;}
  return{matchId,venueId};
}
