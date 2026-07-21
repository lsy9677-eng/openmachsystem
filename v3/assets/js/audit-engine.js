
import{allMatches,findMatch}from'./bracket-engine.js';
import{buildCourts,assignInitial,refillCourt,queueReadyMatches}from'./court-engine.js';
import{submitResult}from'./result-engine.js';

const clone=v=>typeof structuredClone==='function'?structuredClone(v):JSON.parse(JSON.stringify(v));
const result=(level,code,title,detail,meta={})=>({level,code,title,detail,meta});

export function ensureAuditState(state){
  if(!state.audit||typeof state.audit!=='object'){
    state.audit={lastRunAt:null,overall:'not-run',results:[],simulation:null};
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
    ...state.courts.flatMap(c=>[c.playing,c.wait1]).filter(Boolean),
    ...(state.sharedQueue||[])
  ];
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
export function runStateAudit(state){
  ensureAuditState(state);
  const out=[];
  auditDraw(state,out);auditQueues(state,out);auditAdvancement(state,out);auditMessages(state,out);
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

export function runFullSimulation(state){
  if(!state.draw?.size)throw new Error('모의대회를 실행할 본선 대진이 없습니다.');
  const sim=clone(state);
  sim.messaging={settings:{autoMessageEnabled:false},queue:[],metrics:{updatedCount:0}};
  if(!Array.isArray(sim.courts)||!sim.courts.length){
    sim.courts=buildCourts(Math.max(1,Number(sim.settings.courtCount)||8),sim.settings.courtPrefix||'코트');
    sim.sharedQueue=assignInitial(sim.draw,sim.courts);
  }
  let iterations=0,completed=allMatches(sim.draw).filter(m=>m.status==='completed').length;
  const maxIterations=Math.max(1000,sim.draw.size*20);
  while(iterations<maxIterations){
    settleSimulationCourts(sim);
    const playing=sim.courts.map(c=>c.playing).filter(Boolean);
    if(!playing.length){
      const remainingReady=allMatches(sim.draw).some(m=>['ready','court_wait1','shared_queue'].includes(m.status));
      if(remainingReady){
        settleSimulationCourts(sim);
      }
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
  completed=matches.filter(m=>m.status==='completed').length;
  const final=(sim.draw.rounds?.[2]||[])[0]||null;
  const queueIds=currentQueueIds(sim);
  const queueDupes=duplicateValues(queueIds);
  const unfinished=matches.filter(m=>!['completed','bye'].includes(m.status));
  const success=completed===matches.length&&!queueDupes.length&&unfinished.length===0&&Boolean(final?.winner);
  return{
    at:new Date().toISOString(),
    success,
    iterations,
    totalMatches:matches.length,
    completedMatches:completed,
    winner:final?.winner||null,
    queueDuplicates:queueDupes,
    unfinished:unfinished.map(m=>({id:m.id,status:m.status,teamA:m.teamA?.name||null,teamB:m.teamB?.name||null}))
  };
}
export function applyAuditResult(state,audit,simulation=null){
  ensureAuditState(state);
  state.audit={
    lastRunAt:new Date().toISOString(),
    overall:simulation&&simulation.success===false?'fail':audit.overall,
    results:[
      ...audit.results,
      ...(simulation?[simulation.success
        ?result('pass','SIMULATION_COMPLETE','복제 모의대회 완주',`${simulation.completedMatches}/${simulation.totalMatches}경기 완료 · 우승 ${simulation.winner?.name||'-'}`)
        :result('fail','SIMULATION_COMPLETE','복제 모의대회 실패',`미완료 ${simulation.unfinished.length}경기 · 큐 중복 ${simulation.queueDuplicates.length}건`)
      ]:[])
    ],
    simulation
  };
  return state.audit;
}
