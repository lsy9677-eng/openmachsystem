
import{allMatches,findMatch,syncLinkedDrawQualifiers}from'./bracket-engine.js';
import{buildCourts,assignInitial,refillCourt,queueReadyMatches}from'./court-engine.js';
import{submitResult}from'./result-engine.js';
import{assignPrelimCourts,submitPrelimResult}from'./prelim-engine.js';
import{earlyMainStats}from'./early-main-engine.js';

const clone=v=>typeof structuredClone==='function'?structuredClone(v):JSON.parse(JSON.stringify(v));
const result=(level,code,title,detail,meta={})=>({level,code,title,detail,meta});

export function ensureAuditState(state){
  if(!state.audit||typeof state.audit!=='object'){
    state.audit={lastRunAt:null,overall:'not-run',results:[],simulation:null,prelimSimulation:null};
  }
  if(!Array.isArray(state.audit.results))state.audit.results=[];
}
function expectedMatchCount(size){return size>0?size-1:0;}
function duplicateValues(values){
  const seen=new Set(),dupes=new Set();
  values.filter(Boolean).forEach(v=>seen.has(v)?dupes.add(v):seen.add(v));
  return [...dupes];
}
function currentQueueIds(state){
  return[
    ...state.courts.flatMap(c=>[c.playing,c.wait1,...(c.manualQueue||[])]).filter(Boolean),
    ...(state.sharedQueue||[]),
    ...Object.values(state.venueQueues||{}).flat()
  ];
}

function auditEarlyMain(state,out){
  if(!state.draw?.size){
    out.push(result('warn','EARLY_MAIN_NONE','조기 본선 대진 없음','예선 슬롯 본선 선추첨 전 상태입니다.'));
    return;
  }
  const stats=earlyMainStats(state);
  out.push(result('pass','EARLY_MAIN_STATUS','예선·본선 동시 운영 상태',
    `확정 ${stats.resolved}경기 · 미확정 ${stats.pending}경기 · 신규 배정 가능 ${stats.assignable}경기`));
}

function auditDraw(state,out){
  const matches=allMatches(state.draw);
  if(!state.draw?.size){
    out.push(result('warn','DRAW_NONE','본선 대진 없음','본선 추첨 전 상태입니다.'));
    return;
  }
  const expected=expectedMatchCount(state.draw.size);
  out.push(matches.length===expected
    ?result('pass','DRAW_COUNT','본선 경기 수 정상',`${state.draw.size}강 · ${matches.length}경기`)
    :result('fail','DRAW_COUNT','본선 경기 수 불일치',`예상 ${expected}경기, 실제 ${matches.length}경기`));

  const ids=matches.map(m=>m.id);
  const dupes=duplicateValues(ids);
  out.push(!dupes.length
    ?result('pass','MATCH_ID_UNIQUE','경기 ID 중복 없음','모든 경기 ID가 고유합니다.')
    :result('fail','MATCH_ID_UNIQUE','경기 ID 중복',dupes.join(', ')));

  const placeholders=matches.flatMap(m=>[m.teamA,m.teamB]).filter(t=>t?.placeholder);
  out.push(!placeholders.length
    ?result('pass','PLACEHOLDER_NONE','미확정 본선 슬롯 없음','현재 본선 팀이 모두 확정됐습니다.')
    :result('warn','PLACEHOLDER_NONE','미확정 본선 슬롯 존재',`${placeholders.length}개 슬롯이 예선 결과 대기 상태입니다.`));
}
function auditCourtStatus(state,out){
  const paused=(state.courts||[]).filter(c=>c.isPaused);
  const pausedWithPlaying=paused.filter(c=>c.playing).length;
  out.push(paused.length
    ?result('warn','COURT_PAUSED','사용중지 코트 존재',`${paused.length}면 사용중지 · 시합중 유지 ${pausedWithPlaying}면`)
    :result('pass','COURT_PAUSED','모든 코트 사용 가능','사용중지된 코트가 없습니다.'));
}
function auditQueues(state,out){
  const queueIds=currentQueueIds(state);
  const duplicates=duplicateValues(queueIds);
  out.push(!duplicates.length
    ?result('pass','QUEUE_UNIQUE','코트·대기열 중복 없음','한 경기가 여러 위치에 동시에 배정되지 않았습니다.')
    :result('fail','QUEUE_UNIQUE','코트·대기열 중복',duplicates.join(', ')));

  const missing=queueIds.filter(id=>!findMatch(state.draw,id));
  out.push(!missing.length
    ?result('pass','QUEUE_MATCH_EXISTS','큐 경기 참조 정상','모든 큐 항목이 실제 경기를 가리킵니다.')
    :result('fail','QUEUE_MATCH_EXISTS','존재하지 않는 큐 경기',missing.join(', ')));

  const playingMismatch=state.courts.flatMap(c=>{
    const m=c.playing?findMatch(state.draw,c.playing):null;
    return m&&m.status!=='playing'?[`${c.name}:${m.id}:${m.status}`]:[];
  });
  out.push(!playingMismatch.length
    ?result('pass','PLAYING_STATUS','시합중 상태 정상','코트 시합중 카드와 경기 상태가 일치합니다.')
    :result('fail','PLAYING_STATUS','시합중 상태 불일치',playingMismatch.join(', ')));

  const waitMismatch=state.courts.flatMap(c=>{
    const m=c.wait1?findMatch(state.draw,c.wait1):null;
    return m&&m.status!=='court_wait1'?[`${c.name}:${m.id}:${m.status}`]:[];
  });
  out.push(!waitMismatch.length
    ?result('pass','WAIT1_STATUS','대기1 상태 정상','코트 대기1 카드와 경기 상태가 일치합니다.')
    :result('fail','WAIT1_STATUS','대기1 상태 불일치',waitMismatch.join(', ')));
}
function auditAdvancement(state,out){
  const matches=allMatches(state.draw);
  const bad=matches.filter(m=>m.status==='completed'&&m.nextMatchId).filter(m=>{
    const next=findMatch(state.draw,m.nextMatchId);
    if(!next||!m.winner)return true;
    const slot=m.nextSlot===1?next.teamA:next.teamB;
    return !slot||slot.id!==m.winner.id;
  });
  out.push(!bad.length
    ?result('pass','WINNER_ADVANCE','완료 경기 승자 진출 정상','완료된 경기의 승자가 다음 라운드에 반영됐습니다.')
    :result('fail','WINNER_ADVANCE','승자 진출 오류',bad.map(m=>m.id).join(', ')));
}
function auditMessages(state,out){
  const pending=(state.messaging?.queue||[]).filter(x=>x.status!=='sent');
  const keys=pending.map(x=>x.identityKey||[x.type,x.matchId,x.teamId||x.teamName].join('|'));
  const dupes=duplicateValues(keys);
  out.push(!dupes.length
    ?result('pass','MESSAGE_DUPLICATE','미발송 문자 중복 없음','같은 경기·같은 팀의 미발송 문자가 하나씩 유지됩니다.')
    :result('warn','MESSAGE_DUPLICATE','미발송 문자 중복 존재',`${dupes.length}개 중복 그룹이 있습니다.`));

  const noPhone=(state.messaging?.queue||[]).filter(x=>x.status==='no-phone').length;
  out.push(noPhone===0
    ?result('pass','MESSAGE_PHONE','문자 연락처 준비 완료','전화번호 없는 문자 초안이 없습니다.')
    :result('warn','MESSAGE_PHONE','전화번호 없는 문자 존재',`${noPhone}건은 연락처 입력이 필요합니다.`));
}

function auditPrelim(state,out){
  const prelim=state.prelim;
  if(!prelim?.groups?.length){
    out.push(result('warn','PRELIM_NONE','예선 조편성 없음','예선 조편성 전 상태입니다.'));
    return;
  }
  const expected=prelim.groups.reduce((sum,g)=>sum+(g.size===3?3:1),0);
  out.push(prelim.matches.length===expected
    ?result('pass','PRELIM_MATCH_COUNT','예선 경기 수 정상',`${prelim.groups.length}조 · ${prelim.matches.length}경기`)
    :result('fail','PRELIM_MATCH_COUNT','예선 경기 수 불일치',`예상 ${expected}경기, 실제 ${prelim.matches.length}경기`));

  const ids=prelim.matches.map(m=>m.id);
  const dupes=duplicateValues(ids);
  out.push(!dupes.length
    ?result('pass','PRELIM_ID_UNIQUE','예선 경기 ID 중복 없음','모든 예선 경기 ID가 고유합니다.')
    :result('fail','PRELIM_ID_UNIQUE','예선 경기 ID 중복',dupes.join(', ')));

  const badOrder=prelim.groups.filter(g=>g.size===3).filter(g=>{
    const ms=prelim.matches.filter(m=>m.groupId===g.id).sort((x,y)=>x.matchNo-y.matchNo);
    return ms.length!==3||
      ms[0].dependency||
      ms[1].dependency?.teamAFrom!=='winner'||
      ms[2].dependency?.teamAFrom!=='loser';
  });
  out.push(!badOrder.length
    ?result('pass','PRELIM_THREE_TEAM_ORDER','3팀조 경기순서 정상','1·2번 경기 후 승자-3번, 패자-3번 순서입니다.')
    :result('fail','PRELIM_THREE_TEAM_ORDER','3팀조 경기순서 오류',badOrder.map(g=>`${g.groupNo}조`).join(', ')));

  const queueIds=(prelim.courts||[]).flatMap(c=>[c.playing,c.wait1,...(c.queue||[])].filter(Boolean));
  const queueDupes=duplicateValues(queueIds);
  out.push(!queueDupes.length
    ?result('pass','PRELIM_QUEUE_UNIQUE','예선 코트 큐 중복 없음','한 예선 경기가 여러 코트 위치에 동시에 존재하지 않습니다.')
    :result('fail','PRELIM_QUEUE_UNIQUE','예선 코트 큐 중복',queueDupes.join(', ')));

  const missing=queueIds.filter(id=>!prelim.matches.some(m=>m.id===id));
  out.push(!missing.length
    ?result('pass','PRELIM_QUEUE_MATCH_EXISTS','예선 큐 경기 참조 정상','모든 예선 큐 항목이 실제 경기를 가리킵니다.')
    :result('fail','PRELIM_QUEUE_MATCH_EXISTS','존재하지 않는 예선 큐 경기',missing.join(', ')));

  const locked=state.prelim?.lock?.locked===true;
  const allCompleted=state.prelim.matches.every(m=>m.status==='completed');
  out.push(!locked||allCompleted
    ?result(locked?'pass':'warn','PRELIM_LOCK','예선 잠금 상태',locked?'예선 결과가 최종확정되어 잠겨 있습니다.':'예선이 아직 잠기지 않았습니다.')
    :result('fail','PRELIM_LOCK','예선 잠금 오류','미완료 경기가 있는데 예선이 잠겨 있습니다.'));
}


function auditOperationalContinuity(state,out){
  const unified=Array.isArray(state.prelim?.courts)&&state.prelim.courts.length?state.prelim.courts:[];
  const activeCourts=unified.filter(c=>!c.isPaused);
  const idle=activeCourts.filter(c=>!c.playing);
  const occupied=new Set(unified.flatMap(c=>[c.playing,c.wait1,...(c.queue||[])].filter(Boolean)));

  const prelimReady=(state.prelim?.matches||[]).filter(m=>
    ['ready','queued'].includes(m.status)&&m.teamA&&m.teamB&&!m.teamA.placeholder&&!m.teamB.placeholder&&!occupied.has(m.id)
  );
  const mainReady=state.draw?.size?allMatches(state.draw).filter(m=>
    m.status==='ready'&&m.teamA&&m.teamB&&!m.teamA.placeholder&&!m.teamB.placeholder&&!occupied.has(m.id)
  ):[];
  const assignable=prelimReady.length+mainReady.length;
  out.push(!(idle.length&&assignable)
    ?result('pass','COURT_CONTINUITY','빈 코트 운영 연속성 정상',idle.length?`빈 코트 ${idle.length}면 · 즉시 배정 가능 경기 없음`:'사용 가능한 코트가 모두 운영 중입니다.')
    :result('fail','COURT_CONTINUITY','빈 코트에 배정 가능한 경기 존재',`빈 코트 ${idle.length}면인데 즉시 배정 가능한 예선 ${prelimReady.length}경기·본선 ${mainReady.length}경기가 남아 있습니다. 자동배정 또는 운영 상태 점검이 필요합니다.`,{idleCourts:idle.map(c=>c.name),prelimReady:prelimReady.map(m=>m.id),mainReady:mainReady.map(m=>m.id)}));

  const queueIds=unified.flatMap(c=>[c.playing,c.wait1,...(c.queue||[])].filter(Boolean));
  const completedInQueue=queueIds.filter(id=>{
    const pm=(state.prelim?.matches||[]).find(m=>m.id===id);
    const mm=state.draw?.size?findMatch(state.draw,id):null;
    return pm?.status==='completed'||mm?.status==='completed';
  });
  out.push(!completedInQueue.length
    ?result('pass','COMPLETED_QUEUE_CLEAN','완료 경기 큐 잔존 없음','결과 입력이 끝난 경기가 코트·대기열에서 제거됐습니다.')
    :result('fail','COMPLETED_QUEUE_CLEAN','완료 경기가 큐에 남아 있음',completedInQueue.join(', ')));

  const duplicateUnified=duplicateValues(queueIds);
  out.push(!duplicateUnified.length
    ?result('pass','UNIFIED_QUEUE_UNIQUE','통합 코트 중복 배정 없음','예선·본선 통합 코트에서 동일 경기가 한 위치에만 존재합니다.')
    :result('fail','UNIFIED_QUEUE_UNIQUE','통합 코트 중복 배정',duplicateUnified.join(', ')));
}

function auditTournamentReadiness(state,out){
  const prelimTotal=state.prelim?.matches?.length||0;
  const prelimDone=(state.prelim?.matches||[]).filter(m=>m.status==='completed').length;
  const mainMatches=state.draw?.size?allMatches(state.draw):[];
  const mainDone=mainMatches.filter(m=>m.status==='completed').length;
  const invalidCompleted=mainMatches.filter(m=>m.status==='completed'&&(!m.winner||!m.teamA||!m.teamB));
  out.push(!invalidCompleted.length
    ?result('pass','COMPLETED_RESULT_VALID','완료 경기 결과 데이터 정상',`예선 ${prelimDone}/${prelimTotal} · 본선 ${mainDone}/${mainMatches.length} 완료`)
    :result('fail','COMPLETED_RESULT_VALID','완료 경기 결과 데이터 누락',invalidCompleted.map(m=>m.id).join(', ')));

  const finalMatch=mainMatches.find(m=>m.round===1)||mainMatches.find(m=>!m.nextMatchId);
  if(state.tournamentCompletion?.completedAt){
    out.push(finalMatch?.status==='completed'&&finalMatch?.winner
      ?result('pass','TOURNAMENT_FINISH_VALID','대회 종료 상태 정상',`우승 ${finalMatch.winner.name||'-'} · 결승 결과와 완료 상태가 일치합니다.`)
      :result('fail','TOURNAMENT_FINISH_VALID','대회 종료 상태 불일치','대회 완료로 저장됐지만 결승 결과 또는 우승팀 데이터가 없습니다.'));
  }else{
    out.push(result('pass','TOURNAMENT_FINISH_VALID','대회 진행 상태','아직 대회 완료 처리 전입니다.'));
  }
}

export function runStateAudit(state){
  ensureAuditState(state);
  const out=[];
  auditPrelim(state,out);auditEarlyMain(state,out);auditDraw(state,out);auditCourtStatus(state,out);auditQueues(state,out);auditAdvancement(state,out);auditOperationalContinuity(state,out);auditTournamentReadiness(state,out);auditMessages(state,out);
  const fails=out.filter(x=>x.level==='fail').length,warns=out.filter(x=>x.level==='warn').length;
  return{
    at:new Date().toISOString(),
    overall:fails?'fail':warns?'warn':'pass',
    results:out,
    counts:{pass:out.filter(x=>x.level==='pass').length,warn:warns,fail:fails}
  };
}

function settleSimulationCourts(sim){
  let changed=true,guard=0;
  while(changed&&guard<20){
    changed=false;guard++;
    queueReadyMatches(sim,id=>findMatch(sim.draw,id));
    sim.courts.forEach(court=>{
      const before=`${court.playing||''}|${court.wait1||''}|${sim.sharedQueue.length}`;
      refillCourt(sim,court,id=>findMatch(sim.draw,id));
      const after=`${court.playing||''}|${court.wait1||''}|${sim.sharedQueue.length}`;
      if(before!==after)changed=true;
    });
  }
}


function recoverPrelimGroups(prelim){
  const matches=Array.isArray(prelim?.matches)?prelim.matches:[];
  if(!matches.length)return[];
  const byGroup=new Map();
  matches.forEach(match=>{
    const groupNo=Number(match.groupNo)||Number(String(match.groupId||'').replace(/\D/g,''));
    if(!groupNo)return;
    if(!byGroup.has(groupNo))byGroup.set(groupNo,[]);
    byGroup.get(groupNo).push(match);
  });
  return[...byGroup.entries()].sort((a,b)=>a[0]-b[0]).map(([groupNo,groupMatches])=>{
    const teams=[];const seen=new Set();
    groupMatches.forEach(match=>[match.teamA,match.teamB].forEach(team=>{
      if(!team||team.placeholder||!team.id||seen.has(team.id))return;
      seen.add(team.id);teams.push(clone(team));
    }));
    const size=groupMatches.length>=3?3:Math.max(2,teams.length);
    return{
      id:groupMatches[0]?.groupId||`g${groupNo}`,
      groupNo,size,teams:teams.slice(0,size),standings:[],
      court:groupMatches.find(m=>m.court)?.court||null,nextMatchNo:1
    };
  }).filter(group=>group.teams.length>=2);
}
function resolveSimulationState(input){
  const candidates=[input,input?.state,input?.snapshot,input?.data].filter(Boolean);
  const source=candidates.find(candidate=>candidate?.prelim&&(
    Array.isArray(candidate.prelim.groups)||Array.isArray(candidate.prelim.matches)
  ));
  const sim=clone(source||input||{});
  if(!sim.prelim)sim.prelim={groups:[],matches:[],courts:[],qualifiers:[],settings:{}};
  if(!Array.isArray(sim.prelim.groups))sim.prelim.groups=[];
  if(!sim.prelim.groups.length)sim.prelim.groups=recoverPrelimGroups(sim.prelim);
  return sim;
}
function simulatePrelimState(state){
  const sim=resolveSimulationState(state);
  if(!sim.prelim?.groups?.length){
    return{sim,iterations:0,completed:0,unfinished:[],rankedGroups:0,queueDupes:[],success:false,reason:'NO_PRELIM_GROUPS'};
  }
  if(!Array.isArray(sim.prelim.courts)||!sim.prelim.courts.length)assignPrelimCourts(sim);
  let iterations=0;
  const maxIterations=Math.max(1000,sim.prelim.matches.length*10);
  while(iterations<maxIterations){
    const playing=sim.prelim.courts.map(c=>c.playing).filter(Boolean);
    if(!playing.length)break;
    playing.forEach(id=>{
      const m=sim.prelim.matches.find(x=>x.id===id);
      if(m&&m.status==='playing'&&m.teamA&&!m.teamA.placeholder&&m.teamB&&!m.teamB.placeholder){
        submitPrelimResult(sim,{matchId:m.id,winnerId:m.teamA.id,scoreA:6,scoreB:3});
      }
    });
    iterations++;
  }
  const completed=sim.prelim.matches.filter(m=>m.status==='completed').length;
  const unfinished=sim.prelim.matches.filter(m=>m.status!=='completed');
  const rankedGroups=sim.prelim.groups.filter(g=>
    Array.isArray(g.standings)&&g.standings.length===g.size&&
    g.standings.every((x,i)=>x.rank===i+1)
  ).length;
  const queueIds=(sim.prelim.courts||[]).flatMap(c=>[c.playing,c.wait1,...(c.queue||[])].filter(Boolean));
  const queueDupes=duplicateValues(queueIds);
  const success=completed===sim.prelim.matches.length&&unfinished.length===0&&rankedGroups===sim.prelim.groups.length&&!queueDupes.length;
  return{sim,iterations,completed,unfinished,rankedGroups,queueDupes,success};
}

export function runPrelimSimulation(state){
  const r=simulatePrelimState(state);
  return{
    at:new Date().toISOString(),success:r.success,iterations:r.iterations,
    totalMatches:r.sim.prelim.matches.length,completedMatches:r.completed,
    totalGroups:r.sim.prelim.groups.length,rankedGroups:r.rankedGroups,
    queueDuplicates:r.queueDupes,reason:r.reason||null,
    unfinished:r.unfinished.map(m=>({id:m.id,groupNo:m.groupNo,matchNo:m.matchNo,status:m.status}))
  };
}

export function runFullSimulation(state){
  if(!state.draw?.size)throw new Error('모의대회를 실행할 본선 대진이 없습니다.');
  let sim=clone(state);
  sim.messaging={settings:{autoMessageEnabled:false},queue:[],metrics:{updatedCount:0}};

  // 예선 슬롯이 남아 있으면 복제된 예선을 먼저 끝까지 진행한 뒤
  // 그 순위를 복제 본선 슬롯에 반영한다. 실제 운영 데이터는 변경하지 않는다.
  let prelimSimulation=null;
  const unresolvedBefore=allMatches(sim.draw).flatMap(m=>[m.teamA,m.teamB]).filter(t=>t?.placeholder).length;
  if(unresolvedBefore>0&&sim.prelim?.groups?.length){
    const pr=simulatePrelimState(sim);
    prelimSimulation={
      success:pr.success,completedMatches:pr.completed,totalMatches:pr.sim.prelim.matches.length,
      rankedGroups:pr.rankedGroups,totalGroups:pr.sim.prelim.groups.length
    };
    sim=pr.sim;
    if(pr.success){
      syncLinkedDrawQualifiers(sim.draw,sim.prelim.qualifiers||[],{protectStarted:false});
    }else{
      return{
        at:new Date().toISOString(),success:false,iterations:0,totalMatches:0,completedMatches:0,
        winner:null,queueDuplicates:[],prelimSimulation,unresolvedSlots:unresolvedBefore,
        reason:pr.reason||'PRELIM_SIMULATION_FAILED',unfinished:[]
      };
    }
  }

  const unresolvedAfter=allMatches(sim.draw).flatMap(m=>[m.teamA,m.teamB]).filter(t=>t?.placeholder).length;
  if(unresolvedAfter>0){
    const matches=allMatches(sim.draw);
    const playable=matches.filter(m=>!m.bye);
    return{
      at:new Date().toISOString(),success:false,iterations:0,
      totalMatches:playable.length,completedMatches:playable.filter(m=>m.status==='completed').length,
      winner:null,queueDuplicates:[],prelimSimulation,
      unresolvedSlots:unresolvedAfter,
      unfinished:matches.filter(m=>m.teamA?.placeholder||m.teamB?.placeholder).map(m=>({id:m.id,status:'예선 결과 대기',teamA:m.teamA?.name||null,teamB:m.teamB?.name||null}))
    };
  }

  if(!Array.isArray(sim.courts)||!sim.courts.length){
    sim.courts=buildCourts(Math.max(1,Number(sim.settings.courtCount)||8),sim.settings.courtPrefix||'코트');
    sim.sharedQueue=assignInitial(sim.draw,sim.courts);
  }
  let iterations=0;
  const maxIterations=Math.max(1000,sim.draw.size*20);
  while(iterations<maxIterations){
    settleSimulationCourts(sim);
    const playing=sim.courts.map(c=>c.playing).filter(Boolean);
    if(!playing.length){
      const remainingReady=allMatches(sim.draw).some(m=>['ready','court_wait1','shared_queue'].includes(m.status));
      if(remainingReady)settleSimulationCourts(sim);
    }
    const active=sim.courts.map(c=>c.playing).filter(Boolean);
    if(!active.length)break;
    active.forEach(id=>{
      const m=findMatch(sim.draw,id);
      if(m&&m.teamA&&m.teamB&&m.status==='playing'){
        submitResult(sim,{matchId:id,winnerId:m.teamA.id,scoreA:6,scoreB:3});
      }
    });
    iterations++;
  }
  const matches=allMatches(sim.draw);
  const playable=matches.filter(m=>!m.bye);
  const completedPlayable=playable.filter(m=>m.status==='completed').length;
  const final=(sim.draw.rounds?.[2]||[])[0]||null;
  const queueIds=currentQueueIds(sim);
  const queueDupes=duplicateValues(queueIds);
  const unfinished=matches.filter(m=>!m.bye&&m.status!=='completed');
  const success=unfinished.length===0&&!queueDupes.length&&Boolean(final?.winner);
  return{
    at:new Date().toISOString(),success,iterations,
    totalMatches:playable.length,
    completedMatches:completedPlayable,
    autoByeCount:matches.filter(m=>m.bye).length,
    winner:final?.winner||null,
    queueDuplicates:queueDupes,
    prelimSimulation,
    unresolvedSlots:0,
    unfinished:unfinished.map(m=>({id:m.id,status:m.status,teamA:m.teamA?.name||null,teamB:m.teamB?.name||null}))
  };
}
export function applyAuditResult(state,audit,simulation=null,prelimSimulation=null){
  ensureAuditState(state);
  state.audit={
    lastRunAt:new Date().toISOString(),
    overall:(simulation&&simulation.success===false)||(prelimSimulation&&prelimSimulation.success===false)?'fail':audit.overall,
    results:[
      ...audit.results,
      ...(prelimSimulation?[prelimSimulation.success
        ?result('pass','PRELIM_SIMULATION_COMPLETE','예선 복제 모의운영 완주',`${prelimSimulation.completedMatches}/${prelimSimulation.totalMatches}경기 완료 · ${prelimSimulation.rankedGroups}/${prelimSimulation.totalGroups}조 순위 확정`)
        :result('fail','PRELIM_SIMULATION_COMPLETE','예선 복제 모의운영 실패',prelimSimulation.reason==='NO_PRELIM_GROUPS'?'저장된 경기 데이터에서도 예선 조편성을 복원하지 못했습니다.':`미완료 ${prelimSimulation.unfinished.length}경기 · 큐 중복 ${prelimSimulation.queueDuplicates.length}건`)
      ]:[]),
      ...(simulation?[simulation.success
        ?result('pass','SIMULATION_COMPLETE','복제 모의대회 완주',`${simulation.completedMatches}/${simulation.totalMatches}경기 완료 · 우승 ${simulation.winner?.name||'-'}`)
        :result('fail','SIMULATION_COMPLETE','복제 모의대회 실패',simulation.unresolvedSlots?`예선 결과 대기 슬롯 ${simulation.unresolvedSlots}개 · 복제 예선 순위 반영 필요`:`미완료 ${simulation.unfinished.length}경기 · 큐 중복 ${simulation.queueDuplicates.length}건`)
      ]:[])
    ],
    simulation,
    prelimSimulation
  };
  return state.audit;
}
