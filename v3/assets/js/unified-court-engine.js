import{findMatch}from'./bracket-engine.js';

export function findUnifiedMatch(state,id){
  const prelim=state.prelim?.matches?.find(m=>m.id===id);
  if(prelim)return{type:'prelim',match:prelim};
  const main=findMatch(state.draw,id);
  if(main)return{type:'main',match:main};
  return null;
}
function ensureVenueQueues(state){
  if(!state.venueQueues||typeof state.venueQueues!=='object')state.venueQueues={};
  const courts=state.prelim?.courts||[];
  courts.forEach(c=>{const venueId=c.venueId||'venue-default';if(!Array.isArray(state.venueQueues[venueId]))state.venueQueues[venueId]=[];});
}
function venueQueue(state,venueId){
  ensureVenueQueues(state);
  return state.venueQueues[venueId]||(state.venueQueues[venueId]=[]);
}
function setUnifiedStatus(state,id,status,court=null){
  const item=findUnifiedMatch(state,id);if(!item)return;
  item.match.status=status;
  if(court){
    if(item.type==='prelim')item.match.prelimCourtId=court.id;
    else item.match.courtId=court.id;
    item.match.court=court.name;
    item.match.venueId=court.venueId;
    item.match.venueName=court.venueName;
  }else if(item.type==='main'){
    item.match.court=null;
    item.match.courtId=null;
  }
}
function takeSharedMain(state,court){
  const q=venueQueue(state,court.venueId||'venue-default');
  const id=q.shift()||null;
  if(id)setUnifiedStatus(state,id,'court_wait1',court);
  return id;
}
export function promoteUnifiedCourt(state,court){
  court.queue=Array.isArray(court.queue)?court.queue:[];
  if(court.isPaused)return court;
  if(!court.playing&&court.wait1){
    court.playing=court.wait1;court.wait1=null;
    setUnifiedStatus(state,court.playing,'playing',court);
  }
  // 예선에서 이미 코트별로 편성된 추가경기는 기존 순서를 우선 유지합니다.
  if(!court.playing&&court.queue.length){
    court.playing=court.queue.shift();
    setUnifiedStatus(state,court.playing,'playing',court);
  }
  if(!court.wait1&&court.queue.length){
    court.wait1=court.queue.shift();
    setUnifiedStatus(state,court.wait1,'court_wait1',court);
  }
  // 코트별 추가대기가 소진된 뒤에는 구장 공용대기 첫 경기를 대기1로 자동 보충합니다.
  if(!court.wait1){
    court.wait1=takeSharedMain(state,court);
  }
  // 완전히 빈 코트라면 공용대기에서 하나를 시합중으로 올리고 다음 하나를 대기1로 채웁니다.
  if(!court.playing&&court.wait1){
    court.playing=court.wait1;court.wait1=null;
    setUnifiedStatus(state,court.playing,'playing',court);
    court.wait1=takeSharedMain(state,court);
  }
  return court;
}
export function advanceUnifiedCourt(state,courtId,completedId){
  const court=(state.prelim?.courts||[]).find(c=>c.id===courtId);
  if(!court)return null;
  if(court.playing===completedId)court.playing=null;
  if(court.wait1===completedId)court.wait1=null;
  promoteUnifiedCourt(state,court);
  return court;
}
export function useUnifiedCourts(state){
  return Array.isArray(state.prelim?.courts)&&state.prelim.courts.length>0;
}
function activeVenueGroups(courts){
  const groups=new Map();
  courts.filter(c=>!c.isPaused).forEach(c=>{
    const venueId=c.venueId||'venue-default';
    if(!groups.has(venueId))groups.set(venueId,[]);
    groups.get(venueId).push(c);
  });
  return groups;
}
export function enqueueReadyMainToUnifiedCourts(state){
  const courts=state.prelim?.courts||[];
  if(!courts.length)return{assigned:0,reason:'no-prelim-courts'};
  ensureVenueQueues(state);
  const occupied=new Set(courts.flatMap(c=>[c.playing,c.wait1,...(c.queue||[])].filter(Boolean)));
  Object.values(state.venueQueues).flat().forEach(id=>occupied.add(id));
  (state.sharedQueue||[]).forEach(id=>occupied.add(id));
  const ready=Object.values(state.draw?.rounds||{}).flat().filter(m=>
    m.status==='ready'&&m.teamA&&!m.teamA.placeholder&&m.teamB&&!m.teamB.placeholder&&!occupied.has(m.id)
  ).sort((a,b)=>(Number(b.roundSize)||0)-(Number(a.roundSize)||0)||(Number(a.matchNo)||0)-(Number(b.matchNo)||0));
  const groups=activeVenueGroups(courts);
  const venueIds=[...groups.keys()];
  if(!venueIds.length)return{assigned:0,reason:'no-active-courts'};
  let assigned=0;
  ready.forEach(m=>{
    const preferred=m.venueId&&groups.has(m.venueId)?m.venueId:null;
    const venueId=preferred||venueIds.reduce((best,id)=>{
      const normalized=venueQueue(state,id).length/Math.max(1,groups.get(id).length);
      if(!best||normalized<best.normalized)return{id,normalized};
      return best;
    },null).id;
    venueQueue(state,venueId).push(m.id);
    m.venueId=venueId;m.venueName=groups.get(venueId)?.[0]?.venueName||m.venueName||'';
    setUnifiedStatus(state,m.id,'venue_shared_queue',null);
    assigned++;
  });
  // 각 코트는 시합중 1개와 대기1 1개까지만 유지하고, 나머지는 공용대기에 둡니다.
  courts.filter(c=>!c.isPaused).forEach(c=>promoteUnifiedCourt(state,c));
  state.sharedQueue=[];
  return{assigned,reason:assigned?'assigned':ready.length?'no-active-courts':'no-ready'};
}
