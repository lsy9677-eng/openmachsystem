
function ensureCourtStatus(court){
  if(!('isPaused'in court))court.isPaused=false;
  if(!('pauseReason'in court))court.pauseReason='';
  if(!('pausedAt'in court))court.pausedAt=null;
}
export function ensureCourtStatuses(state){
  (state.courts||[]).forEach(ensureCourtStatus);
}
function queueFront(state,venueId,matchId,findMatch){
  if(!matchId)return;
  if(!state.venueQueues[venueId])state.venueQueues[venueId]=[];
  if(!state.venueQueues[venueId].includes(matchId))state.venueQueues[venueId].unshift(matchId);
  const match=findMatch(matchId);
  if(match){match.status='venue_shared_queue';match.court=null;match.venueId=venueId;match.startedAt=null;}
}
export function pauseCourt(state,{courtId,reason='',returnWait1=false,returnPlaying=false},findMatch){
  const court=state.courts.find(c=>c.id===courtId);if(!court)throw new Error('코트를 찾지 못했습니다.');
  ensureCourtStatus(court);
  const venueId=court.venueId||'venue-default';
  if(returnWait1&&court.wait1){queueFront(state,venueId,court.wait1,findMatch);court.wait1=null;}
  if(returnPlaying&&court.playing){queueFront(state,venueId,court.playing,findMatch);court.playing=null;}
  if(returnPlaying&&Array.isArray(court.manualQueue)){[...court.manualQueue].reverse().forEach(id=>queueFront(state,venueId,id,findMatch));court.manualQueue=[];}
  court.isPaused=true;court.pauseReason=String(reason||'').trim();court.pausedAt=new Date().toISOString();
  return court;
}
export function resumeCourt(state,courtId){
  const court=state.courts.find(c=>c.id===courtId);if(!court)throw new Error('코트를 찾지 못했습니다.');
  ensureCourtStatus(court);court.isPaused=false;court.pauseReason='';court.pausedAt=null;return court;
}
export function activeCourts(state){return(state.courts||[]).filter(c=>!c.isPaused);}
