import{hasAuthorizedMainDraw}from'./main-draw-lifecycle-engine.js?v=3500';
import{findMatch}from'./bracket-engine.js';

/*
 * 230MATCH unified court engine · stable-placement core
 *
 * 원칙
 * 1. 공용대기 -> 특정 코트로 자동 배정된 경기는 그 코트에 고정한다.
 * 2. 자동 로직은 다른 코트의 playing / wait1 / queue 항목을 가져오지 않는다.
 * 3. 코트 내부에서는 경기 완료에 따른 정상 승격(대기 -> 시합중)만 허용한다.
 * 4. 코트 간 이동은 moveUnifiedCourtMatchFlexible()을 통한 관리자 수동 이동에서만 허용한다.
 */

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
  courts.forEach(c=>{
    const venueId=c.venueId||'venue-default';
    if(!Array.isArray(state.venueQueues[venueId]))state.venueQueues[venueId]=[];
  });
}
function venueQueue(state,venueId){
  ensureVenueQueues(state);
  return state.venueQueues[venueId]||(state.venueQueues[venueId]=[]);
}
function setUnifiedStatus(state,id,status,court=null){
  const item=findUnifiedMatch(state,id);if(!item)return;
  const now=new Date().toISOString();
  const previousStatus=String(item.match.status||'');
  item.match.status=status;
  if(status==='playing'){
    // 5.9.9: 대기/대기1에서 새로 시합중으로 승격되는 경기는 반드시 0분부터 시작.
    // 이미 playing 상태인 경기를 코트만 이동하는 경우에는 기존 startedAt을 유지한다.
    if(previousStatus!=='playing'){
      item.match.startedAt=now;
      item.match.elapsedMinutes=0;
      item.match.estimatedRemainingMinutes=0;
      item.match.effectiveStartedAt=null;
      item.match.estimatedEndAt=null;
      item.match.timeClockPending=false;
    }else if(!item.match.startedAt){
      item.match.startedAt=now;
    }
    item.match.waitStartedAt=null;
    item.match.waitElapsedMinutes=0;
    item.match.estimatedWaitMinutes=0;
  }else if(['court_wait1','venue_shared_queue','shared_queue','queued'].includes(status)){
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
function queueItemRunnable(state,id){
  const item=findUnifiedMatch(state,id);
  if(!item)return false;
  if(item.match?.status==='completed')return false;
  if(item.type==='prelim')return isRunnablePrelimId(state,id);
  return !!(item.match?.teamA&&!item.match.teamA.placeholder&&item.match?.teamB&&!item.match.teamB.placeholder);
}
function courtHasReservedPrelimAhead(state,court){
  if(court?.wait1&&isPendingPrelimId(state,court.wait1))return true;
  return (court?.queue||[]).some(id=>isPendingPrelimId(state,id));
}
function courtContains(court,id){
  return court?.playing===id||court?.wait1===id||(court?.queue||[]).includes(id);
}
function placementOf(state,id){
  for(const court of state.prelim?.courts||[]){
    if(court.playing===id)return{court,slot:'playing',index:0};
    if(court.wait1===id)return{court,slot:'wait1',index:1};
    const qi=(court.queue||[]).indexOf(id);
    if(qi>=0)return{court,slot:'queue',index:qi+2};
  }
  return null;
}

/*
 * 예선 예약열 복구도 기존 코트 배치를 바꾸지 않는다.
 * 이전 엔진은 예선 예약이 다시 계산될 때 이미 코트에 올라온 본선 경기를
 * 공용대기로 되돌린 뒤 재배정했다. 이 과정에서 다른 코트로 이동할 수 있었다.
 * 새 엔진은 현재 배치를 그대로 두고, 누락된 예선 예약만 같은 코트 맨 뒤에 추가한다.
 */
export function reconcilePrelimCourtReservations(state){
  const courts=state.prelim?.courts||[];
  if(!courts.length)return{courts:0,added:0,returnedMain:0,preserved:0};
  let added=0,preserved=0;
  for(const court of courts){
    court.queue=Array.isArray(court.queue)?court.queue:[];
    // 완료/존재하지 않는 예선 항목만 정리. 본선 항목은 절대 제거하지 않는다.
    court.queue=court.queue.filter(id=>{
      const item=findUnifiedMatch(state,id);
      return item&&(item.type==='main'||item.match?.status!=='completed');
    });

    const groups=(court.groups||[]).map(groupId=>(state.prelim?.matches||[])
      .filter(m=>m.groupId===groupId&&m.status!=='completed')
      .sort((a,b)=>(a.matchNo||0)-(b.matchNo||0)));
    const planned=[];
    const max=Math.max(0,...groups.map(list=>list.length));
    for(let round=0;round<max;round++)groups.forEach(list=>{if(list[round])planned.push(list[round].id);});

    for(const id of planned){
      if(courtContains(court,id)){preserved++;continue;}
      // 다른 코트에 이미 올라간 경기는 자동으로 빼앗아 오지 않는다.
      const existing=placementOf(state,id);
      if(existing){preserved++;continue;}
      court.queue.push(id);
      const item=findUnifiedMatch(state,id);
      if(item?.type==='prelim'&&item.match.status!=='completed'&&isRunnablePrelimId(state,id)){
        setUnifiedStatus(state,id,'queued',court);
      }
      added++;
    }
    promoteLocalCourt(state,court);
  }
  return{courts:courts.length,added,returnedMain:0,preserved};
}

/* 코트 내부 FIFO 승격. 다른 코트에서 항목을 가져오지 않는다. */
function promoteLocalCourt(state,court){
  court.queue=Array.isArray(court.queue)?court.queue:[];
  if(court.isPaused)return court;

  if(!court.playing&&court.wait1){
    court.playing=court.wait1;
    court.wait1=null;
    setUnifiedStatus(state,court.playing,'playing',court);
  }

  if(!court.playing&&!court.wait1&&court.queue.length&&queueItemRunnable(state,court.queue[0])){
    const id=court.queue.shift();
    court.playing=id;
    setUnifiedStatus(state,id,'playing',court);
  }

  if(court.playing&&!court.wait1&&court.queue.length&&queueItemRunnable(state,court.queue[0])){
    const id=court.queue.shift();
    court.wait1=id;
    setUnifiedStatus(state,id,'court_wait1',court);
  }
  return court;
}

function takeSharedMain(state,court,status='court_wait1'){
  if(!hasAuthorizedMainDraw(state))return null;
  if(state.operation?.autoAssignmentEnabled===false)return null;
  const q=venueQueue(state,court.venueId||'venue-default');
  while(q.length){
    const id=q.shift();
    const item=findUnifiedMatch(state,id);
    if(!item||item.type!=='main'||item.match?.status==='completed')continue;
    // 혹시 이미 어느 코트에 올라가 있으면 위치를 건드리지 않고 건너뜀.
    if(placementOf(state,id))continue;
    setUnifiedStatus(state,id,status,court);
    return id;
  }
  return null;
}

/*
 * 자동 채움은 빈 자리에 공용대기에서 새 경기만 가져온다.
 * 다른 코트의 대기경기를 donor로 이동시키는 로직은 완전히 제거했다.
 */
function fillUnifiedMainSlotsStable(state,venueId=null){
  if(!hasAuthorizedMainDraw(state))return[];
  const courts=(state.prelim?.courts||[]).filter(c=>!c.isPaused&&(!venueId||(c.venueId||'venue-default')===venueId));

  // 먼저 각 코트 내부에서만 정상 승격.
  courts.forEach(c=>promoteLocalCourt(state,c));

  // 빈 시합중: 해당 코트 앞에 예선 예약이 없을 때만 공용대기 새 경기를 받는다.
  for(const court of courts){
    if(court.playing)continue;
    if(court.wait1||(court.queue||[]).length)continue;
    if(courtHasReservedPrelimAhead(state,court))continue;
    const id=takeSharedMain(state,court,'playing');
    if(id){
      court.playing=id;
      const item=findUnifiedMatch(state,id);
      if(item?.match&&item.match.status==='playing'&&!item.match.startedAt)item.match.startedAt=new Date().toISOString();
    }
  }

  // 시합중이 있고 대기1이 비어 있으며 코트 추가대기도 없을 때만 새 경기 1개를 배정.
  for(const court of courts){
    if(!court.playing||court.wait1||(court.queue||[]).length)continue;
    if(courtHasReservedPrelimAhead(state,court))continue;
    const id=takeSharedMain(state,court,'court_wait1');
    if(id)court.wait1=id;
  }
  return courts;
}

export function promoteUnifiedCourt(state,court){
  promoteLocalCourt(state,court);
  // 완료된 바로 그 코트만 보충. 다른 코트 배치는 절대 변경하지 않는다.
  fillUnifiedMainSlotsStable(state,court?.venueId||'venue-default');
  return court;
}
export function advanceUnifiedCourt(state,courtId,completedId){
  const court=(state.prelim?.courts||[]).find(c=>c.id===courtId);
  if(!court)return null;
  if(court.playing===completedId)court.playing=null;
  if(court.wait1===completedId)court.wait1=null;
  court.queue=Array.isArray(court.queue)?court.queue:[];
  court.queue=court.queue.filter(id=>id!==completedId);
  promoteLocalCourt(state,court);

  // 여기서는 다른 코트를 스캔해 donor를 찾지 않는다.
  if(!court.playing&&!court.wait1&&!court.queue.length&&!courtHasReservedPrelimAhead(state,court)){
    const id=takeSharedMain(state,court,'playing');
    if(id)court.playing=id;
  }
  if(court.playing&&!court.wait1&&!court.queue.length&&!courtHasReservedPrelimAhead(state,court)){
    const id=takeSharedMain(state,court,'court_wait1');
    if(id)court.wait1=id;
  }
  return court;
}

export function prelimPriorityActive(state){
  return (state.prelim?.courts||[]).some(c=>{
    if(c?.playing&&isPendingPrelimId(state,c.playing))return true;
    if(c?.wait1&&isPendingPrelimId(state,c.wait1))return true;
    return (c?.queue||[]).some(id=>isPendingPrelimId(state,id));
  });
}
export function useUnifiedCourts(state){
  return Array.isArray(state.prelim?.courts)&&state.prelim.courts.length>0;
}

function edgeMiddleBalancedOrder(matches){
  const source=[...(matches||[])].sort((a,b)=>(Number(a.matchNo)||0)-(Number(b.matchNo)||0));
  const result=[],used=new Set();
  const n=source.length;
  let top=0,bottom=n-1,lowerCenter=Math.floor(n/2)-1,upperCenter=Math.floor(n/2),centerStep=0;
  const take=index=>{if(index>=0&&index<n&&!used.has(index)){used.add(index);result.push(source[index]);}};
  while(result.length<n){
    take(top++);
    take(bottom--);
    if(result.length>=n)break;
    if(centerStep%2===0)take(lowerCenter--);else take(upperCenter++);
    centerStep++;
  }
  return result;
}
function balancedReadyOrder(matches){
  const byRound=new Map();
  (matches||[]).forEach(match=>{
    const round=Number(match.roundSize)||0;
    if(!byRound.has(round))byRound.set(round,[]);
    byRound.get(round).push(match);
  });
  const ordered=[];
  [...byRound.keys()].sort((a,b)=>b-a).forEach(round=>ordered.push(...edgeMiddleBalancedOrder(byRound.get(round))));
  return ordered;
}
function teamPrelimVenueId(state,team){
  if(!team)return null;
  if(team.venueId)return team.venueId;
  const groupNo=Number(team.groupNo||0);
  if(!groupNo)return null;
  const group=(state.prelim?.groups||[]).find(item=>Number(item.groupNo||0)===groupNo);
  return group?.venueId||null;
}
function preferredMatchVenueId(state,match,groups){
  if(match?.venueId&&groups.has(match.venueId))return match.venueId;
  const a=teamPrelimVenueId(state,match?.teamA),b=teamPrelimVenueId(state,match?.teamB);
  if(a&&b&&a===b&&groups.has(a))return a;
  if(a&&groups.has(a)&&!b)return a;
  if(b&&groups.has(b)&&!a)return b;
  return null;
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

/*
 * 중복/완료 항목만 정리한다.
 * 이미 특정 코트에 존재하는 경기를 다른 코트나 공용대기로 재배치하지 않는다.
 */
export function reconcileUnifiedMainQueues(state){
  if(!hasAuthorizedMainDraw(state))return{duplicate:0,invalid:0,completed:0,blocked:0,pendingPlayIns:0,totalRemoved:0,reason:'main-not-drawn'};
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

  // 코트 배치를 최우선으로 보존.
  for(const c of courts){
    if(c.playing&&byId.has(c.playing)){
      if(!seen.has(c.playing))seen.add(c.playing);
      else{removed.duplicate++;c.playing=null;}
    }
    if(c.wait1&&byId.has(c.wait1)){
      if(!seen.has(c.wait1))seen.add(c.wait1);
      else{removed.duplicate++;c.wait1=null;}
    }
    c.queue=Array.isArray(c.queue)?c.queue:[];
    c.queue=c.queue.filter(id=>{
      if(!byId.has(id))return true; // 예선은 그대로 유지
      return validMainId(id);
    });
  }

  // 공용대기에서 코트에 이미 올라간 중복만 제거.
  Object.keys(state.venueQueues).forEach(venueId=>{
    const q=Array.isArray(state.venueQueues[venueId])?state.venueQueues[venueId]:[];
    state.venueQueues[venueId]=q.filter(validMainId);
  });
  state.sharedQueue=Array.isArray(state.sharedQueue)?state.sharedQueue.filter(validMainId):[];
  return{...removed,pendingPlayIns,totalRemoved:Object.values(removed).reduce((a,b)=>a+b,0)};
}

export function enqueueReadyMainToUnifiedCourts(state,{priorityMatchIds=[]}={}){
  if(!hasAuthorizedMainDraw(state))return{assigned:0,reason:'main-not-drawn',repair:{totalRemoved:0}};
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
    m.status==='ready'&&!state.operation?.heldMatches?.some(x=>x.matchId===m.id)&&
    m.teamA&&!m.teamA.placeholder&&m.teamB&&!m.teamB.placeholder&&!occupied.has(m.id)
  );

  const groups=activeVenueGroups(courts);
  const venueIds=[...groups.keys()];
  if(!venueIds.length)return{assigned:0,reason:'no-active-courts',repair};

  const buckets=new Map(venueIds.map(id=>[id,[]]));
  const loads=new Map(venueIds.map(id=>[id,venueQueue(state,id).length]));
  ready.forEach(match=>{
    const preferred=preferredMatchVenueId(state,match,groups);
    const venueId=preferred||venueIds.reduce((best,id)=>{
      const normalized=loads.get(id)/Math.max(1,groups.get(id).length);
      if(!best||normalized<best.normalized-1e-9)return{id,normalized};
      return best;
    },null).id;
    buckets.get(venueId).push(match);
    loads.set(venueId,loads.get(venueId)+1);
  });

  let assigned=0;
  venueIds.forEach(venueId=>{
    const queue=venueQueue(state,venueId);
    const ordered=balancedReadyOrder(buckets.get(venueId));
    ordered.forEach(match=>{
      queue.push(match.id);
      match.venueId=venueId;
      match.venueName=groups.get(venueId)?.[0]?.venueName||match.venueName||'';
      setUnifiedStatus(state,match.id,'venue_shared_queue',null);
      assigned++;
    });
  });

  // 최초/추가 자동배정 모두 빈 슬롯만 채운다. 기존 코트 항목은 움직이지 않는다.
  venueIds.forEach(id=>fillUnifiedMainSlotsStable(state,id));
  state.sharedQueue=[];

  return{
    assigned,
    prelimRepair,
    prioritizedPlayIns:ready.filter(m=>m.isPlayIn||prioritySet.has(m.id)).length,
    pendingPlayIns:incompletePlayIns.filter(m=>!ready.some(r=>r.id===m.id)).length,
    repair,
    reason:assigned?'assigned':ready.length?'no-active-courts':'no-ready'
  };
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
function assertMainPlacementAllowed(state,court,mode){
  const wait1Prelim=!!(court.wait1&&isPendingPrelimId(state,court.wait1));
  const queuedPrelim=(court.queue||[]).some(id=>isPendingPrelimId(state,id));
  const pendingAhead=wait1Prelim||queuedPrelim;
  if(mode==='insert-playing'&&pendingAhead)throw new Error('예선 대기 경기가 남아 있어 본선을 시합중으로 앞당길 수 없습니다.');
  if((mode==='insert-wait1'||mode==='auto')&&queuedPrelim)throw new Error('예선 추가대기가 남아 있어 본선을 대기1로 넣을 수 없습니다.');
  if(mode==='auto'&&!court.playing&&wait1Prelim)throw new Error('예선 대기1을 먼저 시합중으로 승격해야 합니다.');
}

/* 코트 간 이동이 가능한 유일한 경로: 관리자 수동 이동 */
export function moveUnifiedCourtMatchFlexible(state,{matchId,targetCourtId,mode='auto'}){
  const court=(state.prelim?.courts||[]).find(c=>c.id===targetCourtId);
  if(!court)throw new Error('대상 통합 코트를 찾지 못했습니다.');
  const item=findUnifiedMatch(state,matchId);if(!item)throw new Error('이동할 경기를 찾지 못했습니다.');
  court.queue=Array.isArray(court.queue)?court.queue:[];
  if(item.type==='main')assertMainPlacementAllowed(state,court,mode);

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
  }else if(mode==='manual-bottom'){
    court.queue.push(matchId);
  }else if(!court.playing&&!court.isPaused){
    court.playing=matchId;item.match.startedAt=originalStartedAt||new Date().toISOString();
  }else if(!court.wait1&&!court.isPaused){
    court.wait1=matchId;
  }else{
    court.queue.push(matchId);
  }

  refreshUnifiedCourtStatuses(state,court);
  return{court,item,shifted};
}

console.info('[230MATCH] unified-court-engine 5.9.9 · new playing transition resets match clock');
