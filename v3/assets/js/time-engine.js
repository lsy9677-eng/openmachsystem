
import{allMatches,findMatch}from'./bracket-engine.js';
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const fmt=iso=>iso?new Date(iso).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'}):'-';
export function ensureTimeState(state){
  if(!('autoTimeEnabled'in state.settings))state.settings.autoTimeEnabled=true;
  if(!('timeRefreshSeconds'in state.settings))state.settings.timeRefreshSeconds=30;
  if(!('minimumMatchMinutes'in state.settings))state.settings.minimumMatchMinutes=30;
  // 이전 단계의 기본값 30분은 새 기준 40분으로 자동 이전합니다.
  if(!state.settings.matchMinutes || Number(state.settings.matchMinutes)===30)state.settings.matchMinutes=40;
  if(Number(state.settings.minimumMatchMinutes)<20)state.settings.minimumMatchMinutes=30;
  if(!state.timeMetrics)state.timeMetrics={lastCalculatedAt:null,averageMinutes:0,longestWaitMinutes:0};
}
export function calculateTimeMetrics(state){
  ensureTimeState(state);
  const minimum=Math.max(20,Number(state.settings.minimumMatchMinutes)||30);
  const base=Math.max(minimum,Number(state.settings.matchMinutes)||40);
  const matches=allMatches(state.draw);
  // 테스트 중 몇 초 만에 결과를 입력한 경기는 실제 경기 평균에서 제외합니다.
  const durations=matches.filter(m=>m.startedAt&&m.completedAt)
    .map(m=>(new Date(m.completedAt)-new Date(m.startedAt))/60000)
    .filter(v=>v>=minimum&&v<300);
  // 실제 완료 경기와 기준시간을 함께 반영해 급격한 시간 변동을 막습니다.
  const measured=durations.length?durations.reduce((a,b)=>a+b,0)/durations.length:base;
  const avg=clamp(durations.length?((measured*durations.length+base*2)/(durations.length+2)):base,minimum,180);
  const now=Date.now();let longest=0;
  state.courts.forEach(c=>{
    let cursor=now;
    const p=c.playing?findMatch(state.draw,c.playing):null;
    if(p){
      if(!p.startedAt)p.startedAt=new Date().toISOString();
      const elapsed=Math.max(0,(now-new Date(p.startedAt))/60000),remaining=Math.max(0,avg-elapsed);
      p.elapsedMinutes=Math.round(elapsed);p.estimatedRemainingMinutes=Math.round(remaining);
      p.estimatedEndAt=new Date(now+remaining*60000).toISOString();cursor=now+remaining*60000;
    }
    const w=c.wait1?findMatch(state.draw,c.wait1):null;
    if(w){
      w.estimatedWaitMinutes=Math.round((cursor-now)/60000);w.estimatedStartAt=new Date(cursor).toISOString();
      w.estimatedEndAt=new Date(cursor+avg*60000).toISOString();longest=Math.max(longest,w.estimatedWaitMinutes);
    }
  });
  const venueQueues=state.venueQueues&&Object.keys(state.venueQueues).length?state.venueQueues:null;
  if(venueQueues){
    Object.entries(venueQueues).forEach(([venueId,queue])=>{
      const courtCount=Math.max(1,state.courts.filter(c=>(c.venueId||'venue-default')===venueId).length);
      queue.forEach((id,index)=>{
        const m=findMatch(state.draw,id);if(!m)return;
        const wave=Math.floor(index/courtCount)+2,wait=Math.round(avg*wave);
        m.estimatedWaitMinutes=wait;m.estimatedStartAt=new Date(now+wait*60000).toISOString();m.estimatedEndAt=new Date(now+(wait+avg)*60000).toISOString();
        longest=Math.max(longest,wait);
      });
    });
  }else{
    state.sharedQueue.forEach((id,index)=>{
      const m=findMatch(state.draw,id);if(!m)return;
      const wave=Math.floor(index/Math.max(1,state.courts.length))+2,wait=Math.round(avg*wave);
      m.estimatedWaitMinutes=wait;m.estimatedStartAt=new Date(now+wait*60000).toISOString();m.estimatedEndAt=new Date(now+(wait+avg)*60000).toISOString();
      longest=Math.max(longest,wait);
    });
  }
  state.timeMetrics={lastCalculatedAt:new Date(now).toISOString(),averageMinutes:Math.round(avg),longestWaitMinutes:Math.round(longest)};
  return state.timeMetrics;
}
export function timeInfo(match){
  if(!match)return{label:'-',className:''};
  if(match.status==='playing'){
    const e=match.elapsedMinutes||0,r=match.estimatedRemainingMinutes||0;
    return{label:`진행 ${e}분 · 약 ${r}분 남음`,className:e>60?'danger':e>40?'warn':''};
  }
  const w=Number(match.estimatedWaitMinutes||0);
  return{label:`예상 ${w}분 대기 · ${fmt(match.estimatedStartAt)} 시작`,className:w>=60?'danger':w>=30?'warn':''};
}
