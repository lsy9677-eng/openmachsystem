
import{allMatches,findMatch}from'./bracket-engine.js';
import{findUnifiedMatch}from'./unified-court-engine.js?v=3511';
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const fmt=iso=>iso?new Date(iso).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'}):'-';
export function ensureTimeState(state){
  if(!state||typeof state!=='object')return false;
  if(!state.settings||typeof state.settings!=='object'||Array.isArray(state.settings))state.settings={};
  if(!('autoTimeEnabled'in state.settings))state.settings.autoTimeEnabled=true;
  if(!('timeRefreshSeconds'in state.settings))state.settings.timeRefreshSeconds=30;
  if(!('minimumMatchMinutes'in state.settings))state.settings.minimumMatchMinutes=30;
  // 이전 단계의 기본값 30분은 새 기준 40분으로 자동 이전합니다.
  if(!state.settings.matchMinutes || Number(state.settings.matchMinutes)===30)state.settings.matchMinutes=40;
  if(Number(state.settings.minimumMatchMinutes)<20)state.settings.minimumMatchMinutes=30;
  if(!state.timeMetrics||typeof state.timeMetrics!=='object')state.timeMetrics={lastCalculatedAt:null,averageMinutes:0,measuredAverageMinutes:0,measuredSampleCount:0,longestWaitMinutes:0};
  return true;
}
export function calculateTimeMetrics(state){
  if(!ensureTimeState(state))return{lastCalculatedAt:null,averageMinutes:0,measuredAverageMinutes:0,measuredSampleCount:0,longestWaitMinutes:0};
  const minimum=Math.max(20,Number(state.settings.minimumMatchMinutes)||30);
  const base=Math.max(minimum,Number(state.settings.matchMinutes)||40);
  const mainMatches=allMatches(state.draw);
  const prelimMatches=state.prelim?.matches||[];
  const matches=[...mainMatches,...prelimMatches];
  const durations=matches.filter(m=>m.startedAt&&m.completedAt)
    .map(m=>(new Date(m.completedAt)-new Date(m.startedAt))/60000)
    .filter(v=>v>=minimum&&v<300);
  const measured=durations.length?durations.reduce((a,b)=>a+b,0)/durations.length:0;
  // 테스트·초기 운영에서는 실측 평균을 참고값으로만 보존하고, 자동 예상시간 계산은 설정값을 사용합니다.
  const avg=base;
  const now=Date.now();let longest=0;
  const activeCourts=(state.prelim?.courts?.length?state.prelim.courts:state.courts)||[];
  const getMatch=id=>{
    if(!id)return null;
    const unified=findUnifiedMatch(state,id);
    return unified?.match||findMatch(state.draw,id);
  };
  const markPlaying=(m)=>{
    if(!m)return 0;
    if(!m.startedAt)m.startedAt=new Date(now).toISOString();
    const elapsed=Math.max(0,(now-new Date(m.startedAt))/60000),remaining=Math.max(0,avg-elapsed);
    m.elapsedMinutes=Math.floor(elapsed);m.estimatedRemainingMinutes=Math.round(remaining);
    m.estimatedEndAt=new Date(now+remaining*60000).toISOString();
    m.waitStartedAt=null;
    return now+remaining*60000;
  };
  const markWaiting=(m,cursor)=>{
    if(!m)return;
    if(!m.waitStartedAt)m.waitStartedAt=new Date(now).toISOString();
    m.waitElapsedMinutes=Math.max(0,Math.floor((now-new Date(m.waitStartedAt))/60000));
    m.estimatedWaitMinutes=Math.max(0,Math.round((cursor-now)/60000));
    m.estimatedStartAt=new Date(cursor).toISOString();
    m.estimatedEndAt=new Date(cursor+avg*60000).toISOString();
    longest=Math.max(longest,m.estimatedWaitMinutes);
  };
  activeCourts.forEach(c=>{
    let cursor=now;
    const playing=getMatch(c.playing);
    if(playing)cursor=markPlaying(playing);
    const wait1=getMatch(c.wait1);
    if(wait1){markWaiting(wait1,cursor);cursor+=avg*60000;}
    (c.queue||[]).forEach(id=>{const m=getMatch(id);if(m){markWaiting(m,cursor);cursor+=avg*60000;}});
  });
  const venueQueues=state.venueQueues&&Object.keys(state.venueQueues).length?state.venueQueues:null;
  if(venueQueues){
    Object.entries(venueQueues).forEach(([venueId,queue])=>{
      const courtCount=Math.max(1,activeCourts.filter(c=>(c.venueId||'venue-default')===venueId&&!c.isPaused).length);
      queue.forEach((id,index)=>{
        const m=getMatch(id);if(!m)return;
        if(!m.waitStartedAt)m.waitStartedAt=new Date(now).toISOString();
        m.waitElapsedMinutes=Math.max(0,Math.floor((now-new Date(m.waitStartedAt))/60000));
        const wave=Math.floor(index/courtCount)+2,wait=Math.round(avg*wave);
        m.estimatedWaitMinutes=wait;m.estimatedStartAt=new Date(now+wait*60000).toISOString();m.estimatedEndAt=new Date(now+(wait+avg)*60000).toISOString();
        longest=Math.max(longest,wait);
      });
    });
  }else{
    (state.sharedQueue||[]).forEach((id,index)=>{
      const m=getMatch(id);if(!m)return;
      if(!m.waitStartedAt)m.waitStartedAt=new Date(now).toISOString();
      m.waitElapsedMinutes=Math.max(0,Math.floor((now-new Date(m.waitStartedAt))/60000));
      const wave=Math.floor(index/Math.max(1,activeCourts.length))+2,wait=Math.round(avg*wave);
      m.estimatedWaitMinutes=wait;m.estimatedStartAt=new Date(now+wait*60000).toISOString();m.estimatedEndAt=new Date(now+(wait+avg)*60000).toISOString();
      longest=Math.max(longest,wait);
    });
  }
  state.timeMetrics={lastCalculatedAt:new Date(now).toISOString(),averageMinutes:Math.round(base),measuredAverageMinutes:durations.length?Math.round(measured):0,measuredSampleCount:durations.length,longestWaitMinutes:Math.round(longest)};
  return state.timeMetrics;
}
export function timeInfo(match){
  if(!match)return{label:'-',className:''};
  if(match.status==='playing'){
    const e=match.elapsedMinutes||0,r=match.estimatedRemainingMinutes||0;
    return{label:`진행 ${e}분 · 약 ${r}분 남음`,className:e>60?'danger':e>40?'warn':''};
  }
  const w=Number(match.estimatedWaitMinutes||0),elapsed=Number(match.waitElapsedMinutes||0);
  return{label:`대기 ${elapsed}분 경과 · 예상 ${w}분 · ${fmt(match.estimatedStartAt)} 시작`,className:w>=60?'danger':w>=30?'warn':''};
}
