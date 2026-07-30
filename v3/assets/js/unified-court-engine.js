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
  const now=new Date().toISOString();
  item.match.status=status;
  if(status==='playing'){
    item.match.startedAt=item.match.startedAt||now;
    item.match.waitStartedAt=null;
  }else if(status==='court_wait1'||status==='venue_shared_queue'||status==='shared_queue'||status==='queued'){
    item.match.waitStartedAt=item.match.waitStartedAt||now;
  }
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

function isPendingPrelimId(state,id){
  const item=findUnifiedMatch(state,id);
  return item?.type==='prelim'&&item.match?.status!=='completed';
}
function isRunnablePrelimId(state,id){
  const item=findUnifiedMatch(state,id);
  if(item?.type!=='prelim'||item.match?.status==='completed')return false;
  return !!(item.match?.teamA&&!item.match.teamA.placeholder&&item.match?.teamB&&!item.match.teamB.placeholder);
}
function pushMainBackToShared(state,court,id,{front=true}={}){
  if(!id)return false;
  const item=findUnifiedMatch(state,id);if(!item||item.type!=='main')return false;
  const q=venueQueue(state,court?.venueId||item.match.venueId||'venue-default');
  if(!q.includes(id)){if(front)q.unshift(id);else q.push(id);}
  setUnifiedStatus(state,id,'venue_shared_queue',null);
  item.match.venueId=court?.venueId||item.match.venueId||'venue-default';
  item.match.venueName=court?.venueName||item.match.venueName||'';
  return true;
}
function courtHasPendingPrelim(state,court){
  if(court?.playing&&isPendingPrelimId(state,court.playing))return true;
  if(court?.wait1&&isPendingPrelimId(state,court.wait1))return true;
  return (court?.queue||[]).some(id=>isPendingPrelimId(state,id));
}
function courtHasReservedPrelimAhead(state,court){
  // 현재 시합중인 예선은 본선 대기1 배정을 막지 않습니다.
  // 대기1 또는 추가대기에 남아 있는 예선 예약 카드만 본선보다 우선합니다.
  if(court?.wait1&&isPendingPrelimId(state,court.wait1))return true;
  return (court?.queue||[]).some(id=>isPendingPrelimId(state,id));
}
function takeNextRunnablePrelim(state,court){
  court.queue=Array.isArray(court.queue)?court.queue:[];
  const index=court.queue.findIndex(id=>isRunnablePrelimId(state,id));
  if(index<0)return null;
  const [id]=court.queue.splice(index,1);
  return id||null;
}
export function reconcilePrelimCourtReservations(state){
  const courts=state.prelim?.courts||[];
  if(!courts.length)return{courts:0,added:0,returnedMain:0};
  let added=0,returnedMain=0;
  for(const court of courts){
    court.queue=Array.isArray(court.queue)?court.queue:[];
    const groups=(court.groups||[]).map(groupId=>(state.prelim?.matches||[])
      .filter(m=>m.groupId===groupId&&m.status!=='completed')
      .sort((a,b)=>(a.matchNo||0)-(b.matchNo||0)));
    const planned=[];
    const max=Math.max(0,...groups.map(list=>list.length));
    for(let round=0;round<max;round++)groups.forEach(list=>{if(list[round])planned.push(list[round].id);});
    const pendingSet=new Set(planned);

    // 해당 코트에 예선 예약 카드가 있는데 본선이 먼저 올라가 있으면 공용대기로 되돌립니다.
    if(pendingSet.size&&court.playing&&findUnifiedMatch(state,court.playing)?.type==='main'){
      const id=court.playing;court.playing=null;
      if(pushMainBackToShared(state,court,id,{front:true}))returnedMain++;
    }
    if(pendingSet.size&&court.wait1&&findUnifiedMatch(state,court.wait1)?.type==='main'){
      const id=court.wait1;court.wait1=null;
      if(pushMainBackToShared(state,court,id,{front:true}))returnedMain++;
    }

    // 코트 추가대기에는 예선 예약카드를 앞쪽에 계획 순서대로 두고 본선 카드는 공용대기로 돌립니다.
    const existingPrelim=new Set([court.playing,court.wait1,...court.queue].filter(id=>pendingSet.has(id)));
    const mainInQueue=court.queue.filter(id=>findUnifiedMatch(state,id)?.type==='main');
    mainInQueue.forEach(id=>{if(pushMainBackToShared(state,court,id,{front:false}))returnedMain++;});
    const reserved=planned.filter(id=>id!==court.playing&&id!==court.wait1);
    added+=reserved.filter(id=>!existingPrelim.has(id)).length;
    court.queue=reserved;
    reserved.forEach(id=>{
      const item=findUnifiedMatch(state,id);
      if(item?.type==='prelim'&&item.match.status!=='completed'&&!isRunnablePrelimId(state,id)){
        // 의존성 대기 상태는 그대로 유지합니다.
      }else if(item?.type==='prelim'&&item.match.status!=='completed')item.match.status='queued';
    });
    promoteLocalCourt(state,court);
  }
  return{courts:courts.length,added,returnedMain};
}

function takeSharedMain(state,court){
  if(state.operation?.autoAssignmentEnabled===false)return null;
  const q=venueQueue(state,court.venueId||'venue-default');
  const id=q.shift()||null;
  if(id)setUnifiedStatus(state,id,'court_wait1',court);
  return id;
}
function promoteLocalCourt(state,court){
  court.queue=Array.isArray(court.queue)?court.queue:[];
  if(court.isPaused)return court;

  // 현재 코트에 예약된 예선 카드는 본선보다 항상 우선합니다.
  // 의존성이 풀린 예선 카드만 시합중/대기1로 올리고, 아직 팀이 미확정인 카드는
  // 코트 추가대기열의 제자리에 남겨 다음 결과를 기다립니다.
  if(!court.playing){
    if(court.wait1&&isPendingPrelimId(state,court.wait1)){
      court.playing=court.wait1;court.wait1=null;
      setUnifiedStatus(state,court.playing,'playing',court);
    }else{
      const prelimId=takeNextRunnablePrelim(state,court);
      if(prelimId){court.playing=prelimId;setUnifiedStatus(state,prelimId,'playing',court);}
      else if(court.wait1){
        court.playing=court.wait1;court.wait1=null;
        setUnifiedStatus(state,court.playing,'playing',court);
      }
    }
  }

  if(!court.wait1){
    const prelimId=takeNextRunnablePrelim(state,court);
    if(prelimId){court.wait1=prelimId;setUnifiedStatus(state,prelimId,'court_wait1',court);}
  }
  return court;
}
function rebalanceUnifiedMainSlots(state,venueId=null){
  const courts=(state.prelim?.courts||[]).filter(c=>!c.isPaused&&(!venueId||(c.venueId||'venue-default')===venueId));
  courts.forEach(c=>promoteLocalCourt(state,c));

  // 빈 시합중 자리는 그 코트에 대기 중인 예선 예약 카드가 없을 때 본선을 받을 수 있습니다.
  // 현재 시합중인 예선만 남아 있고 대기1·추가대기가 비었다면 본선을 대기1에 배정합니다.
  const playingEligible=courts.filter(c=>!courtHasReservedPrelimAhead(state,c));

  // 1순위: 예선 예약 대기열이 없는 빈 코트의 시합중 자리를 먼저 채웁니다.
  playingEligible.filter(c=>!c.playing).forEach(empty=>{
    const donor=playingEligible.find(c=>c.id!==empty.id&&c.wait1&&findUnifiedMatch(state,c.wait1)?.type==='main');
    if(donor){
      empty.playing=donor.wait1;donor.wait1=null;
      setUnifiedStatus(state,empty.playing,'playing',empty);
      return;
    }
    const id=takeSharedMain(state,empty);
    if(id){empty.playing=id;empty.wait1=null;setUnifiedStatus(state,id,'playing',empty);}
  });

  // 2순위: 현재 경기 뒤에 이어질 예선 카드가 없으면 본선을 대기1까지 채웁니다.
  // 현재 시합중 경기가 예선이어도 추가 예선 예약 카드가 없다면 본선 대기1 배정이 가능합니다.
  courts.filter(c=>c.playing&&!c.wait1&&!courtHasReservedPrelimAhead(state,c)).forEach(c=>{c.wait1=takeSharedMain(state,c);});
  return courts;
}
export function promoteUnifiedCourt(state,court){
  promoteLocalCourt(state,court);
  rebalanceUnifiedMainSlots(state,court.venueId||'venue-default');
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
export function prelimPriorityActive(state){return (state.prelim?.courts||[]).some(c=>courtHasPendingPrelim(state,c));}
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

export function reconcileUnifiedMainQueues(state){
  const courts=state.prelim?.courts||[];
  ensureVenueQueues(state);
  const all=Object.values(state.draw?.rounds||{}).flat();
  const byId=new Map(all.map(m=>[m.id,m]));
  const seen=new Set();
  const removed={duplicate:0,invalid:0,completed:0,blocked:0};
  const pendingPlayIns=all.filter(m=>m.isPlayIn&&m.status!=='completed').length;
  function validMainId(id){
    const m=byId.get(id);
    if(!m){removed.invalid++;return false;}
    if(m.status==='completed'){removed.completed++;return false;}
    if(seen.has(id)){removed.duplicate++;return false;}
    seen.add(id);return true;
  }
  courts.forEach(c=>{
    if(c.playing&&byId.has(c.playing))seen.add(c.playing);
    if(c.wait1){
      if(validMainId(c.wait1)){}else if(byId.has(c.wait1))c.wait1=null;
    }
    c.queue=Array.isArray(c.queue)?c.queue:[];
    c.queue=c.queue.filter(id=>!byId.has(id)||validMainId(id));
  });
  Object.keys(state.venueQueues).forEach(venueId=>{
    const q=Array.isArray(state.venueQueues[venueId])?state.venueQueues[venueId]:[];
    state.venueQueues[venueId]=q.filter(validMainId);
  });
  state.sharedQueue=Array.isArray(state.sharedQueue)?state.sharedQueue.filter(validMainId):[];
  return{...removed,pendingPlayIns,totalRemoved:Object.values(removed).reduce((a,b)=>a+b,0)};
}

export function enqueueReadyMainToUnifiedCourts(state,{priorityMatchIds=[]}={}){
  if(state.operation?.autoAssignmentEnabled===false)return{assigned:0,reason:'auto-paused',repair:{totalRemoved:0}};
  const prelimRepair=reconcilePrelimCourtReservations(state);
  const repair=reconcileUnifiedMainQueues(state);
  const courts=state.prelim?.courts||[];
  if(!courts.length)return{assigned:0,reason:'no-prelim-courts',repair:{totalRemoved:0}};
  ensureVenueQueues(state);
  const occupied=new Set(courts.flatMap(c=>[c.playing,c.wait1,...(c.queue||[])].filter(Boolean)));
  Object.values(state.venueQueues).flat().forEach(id=>occupied.add(id));
  (state.sharedQueue||[]).forEach(id=>occupied.add(id));
  const all=Object.values(state.draw?.rounds||{}).flat();
  const playIns=all.filter(m=>m.isPlayIn);
  const incompletePlayIns=playIns.filter(m=>m.status!=='completed');
  const prioritySet=new Set(priorityMatchIds||[]);
  const ready=all.filter(m=>
    m.status==='ready'&&!state.operation?.heldMatches?.some(x=>x.matchId===m.id)&&m.teamA&&!m.teamA.placeholder&&m.teamB&&!m.teamB.placeholder&&!occupied.has(m.id)
  ).sort((a,b)=>{
    const ax=prioritySet.has(a.id)?0:a.isPlayIn?1:2;
    const bx=prioritySet.has(b.id)?0:b.isPlayIn?1:2;
    return ax-bx||(Number(b.roundSize)||0)-(Number(a.roundSize)||0)||(Number(a.matchNo)||0)-(Number(b.matchNo)||0);
  });
  const groups=activeVenueGroups(courts);
  const venueIds=[...groups.keys()];
  if(!venueIds.length)return{assigned:0,reason:'no-active-courts',repair};
  let assigned=0;
  ready.forEach(m=>{
    const preferred=m.venueId&&groups.has(m.venueId)?m.venueId:null;
    const venueId=preferred||venueIds.reduce((best,id)=>{
      const normalized=venueQueue(state,id).length/Math.max(1,groups.get(id).length);
      if(!best||normalized<best.normalized)return{id,normalized};
      return best;
    },null).id;
    if(m.isPlayIn||prioritySet.has(m.id))venueQueue(state,venueId).unshift(m.id);
    else venueQueue(state,venueId).push(m.id);
    m.venueId=venueId;m.venueName=groups.get(venueId)?.[0]?.venueName||m.venueName||'';
    setUnifiedStatus(state,m.id,'venue_shared_queue',null);
    assigned++;
  });
  // 각 코트는 시합중 1개와 대기1 1개까지만 유지하고, 나머지는 공용대기에 둡니다.
  // 빈 코트 시합중을 전체적으로 먼저 채운 뒤 대기1을 배분합니다.
  [...new Set(courts.filter(c=>!c.isPaused).map(c=>c.venueId||'venue-default'))].forEach(id=>rebalanceUnifiedMainSlots(state,id));
  state.sharedQueue=[];
  return{assigned,prelimRepair,prioritizedPlayIns:ready.filter(m=>m.isPlayIn).length,pendingPlayIns:incompletePlayIns.filter(m=>!ready.some(r=>r.id===m.id)).length,repair,reason:assigned?'assigned':ready.length?'no-active-courts':'no-ready'};
}

function removeUnifiedEverywhere(state,matchId){
  Object.keys(state.venueQueues||{}).forEach(v=>state.venueQueues[v]=(state.venueQueues[v]||[]).filter(id=>id!==matchId));
  (state.prelim?.courts||[]).forEach(c=>{
    c.queue=Array.isArray(c.queue)?c.queue:[];
    if(c.playing===matchId)c.playing=null;
    if(c.wait1===matchId)c.wait1=null;
    c.queue=c.queue.filter(id=>id!==matchId);
  });
  (state.courts||[]).forEach(c=>{
    if(c.playing===matchId)c.playing=null;
    if(c.wait1===matchId)c.wait1=null;
    if(Array.isArray(c.manualQueue))c.manualQueue=c.manualQueue.filter(id=>id!==matchId);
  });
}
function refreshUnifiedCourtStatuses(state,court){
  court.queue=Array.isArray(court.queue)?court.queue:[];
  if(court.playing)setUnifiedStatus(state,court.playing,'playing',court);
  if(court.wait1)setUnifiedStatus(state,court.wait1,'court_wait1',court);
  court.queue.forEach(id=>setUnifiedStatus(state,id,'queued',court));
}
export function moveUnifiedCourtMatchFlexible(state,{matchId,targetCourtId,mode='auto'}){
  const court=(state.prelim?.courts||[]).find(c=>c.id===targetCourtId);
  if(!court)throw new Error('대상 통합 코트를 찾지 못했습니다.');
  const item=findUnifiedMatch(state,matchId);if(!item)throw new Error('이동할 경기를 찾지 못했습니다.');
  court.queue=Array.isArray(court.queue)?court.queue:[];
  const originalStartedAt=item.match.startedAt||null;
  removeUnifiedEverywhere(state,matchId);
  const shifted=[];
  if(mode==='insert-playing'){
    if(court.wait1){court.queue.unshift(court.wait1);shifted.push(court.wait1);}
    if(court.playing){court.wait1=court.playing;shifted.push(court.playing);}else court.wait1=null;
    court.playing=matchId;item.match.startedAt=originalStartedAt||new Date().toISOString();
  }else if(mode==='insert-wait1'){
    if(court.wait1){court.queue.unshift(court.wait1);shifted.push(court.wait1);}
    court.wait1=matchId;
  }else if(mode.startsWith('insert-reserve-')){
    const idx=Math.max(0,Math.min(court.queue.length,Number(mode.replace('insert-reserve-',''))||0));
    court.queue.splice(idx,0,matchId);
  }else if(mode==='manual-bottom')court.queue.push(matchId);
  else if(!court.playing&&!court.isPaused){court.playing=matchId;item.match.startedAt=originalStartedAt||new Date().toISOString();}
  else if(!court.wait1&&!court.isPaused)court.wait1=matchId;
  else court.queue.push(matchId);
  refreshUnifiedCourtStatuses(state,court);
  return{court,item,shifted};
}
