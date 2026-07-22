
import{allMatches}from'./bracket-engine.js';

export function earlyMainStats(state){
  const matches=allMatches(state.draw||{});
  const firstRoundSize=state.draw?.size||0;
  const firstRound=(state.draw?.rounds?.[firstRoundSize]||[]);
  const isResolved=m=>Boolean(m?.teamA&&!m.teamA.placeholder&&m?.teamB&&!m.teamB.placeholder);
  const completed=firstRound.filter(m=>m.status==='completed').length;
  const playing=firstRound.filter(m=>m.status==='playing').length;
  const wait=firstRound.filter(m=>['court_wait1','court_manual_queue','venue_shared_queue','shared_queue'].includes(m.status)).length;
  const assignable=firstRound.filter(m=>isResolved(m)&&m.status==='ready').length;
  const resolved=firstRound.filter(isResolved).length;
  const pending=Math.max(0,firstRound.length-resolved);
  return{
    total:firstRound.length,resolved,pending,assignable,
    active:playing+wait,completed
  };
}
export function markResolvedMainMatchesReady(state){
  const matches=allMatches(state.draw||{});
  let changed=0;
  matches.forEach(m=>{
    if(m.status==='completed'||m.status==='playing'||m.bye)return;
    const resolved=Boolean(m.teamA&&!m.teamA.placeholder&&m.teamB&&!m.teamB.placeholder);
    if(resolved&&['waiting_slots','waiting_dependency','waiting_previous','placeholder'].includes(m.status)){
      m.status='ready';changed++;
    }
  });
  return changed;
}
export function canAssignEarlyMain(state){
  const stats=earlyMainStats(state);
  if(!state.draw?.size)return{ok:false,reason:'먼저 예선 슬롯으로 본선 대진을 생성하세요.',stats};
  if(stats.assignable===0)return{ok:false,reason:'현재 양쪽 참가팀이 모두 확정된 신규 본선 경기가 없습니다.',stats};
  return{ok:true,reason:'',stats};
}
