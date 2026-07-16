
import{findMatch}from'./bracket-engine.js';
import{removeFromQueues,refillCourt,queueReadyMatches}from'./court-engine.js';
export function submitResult(state,{matchId,winnerId,scoreA,scoreB}){
  const match=findMatch(state.draw,matchId);
  if(!match)throw new Error('경기를 찾지 못했습니다.');
  if(!match.teamA||!match.teamB)throw new Error('양 팀이 확정되지 않았습니다.');
  const winner=[match.teamA,match.teamB].find(t=>t.id===winnerId);
  if(!winner)throw new Error('승리팀 선택이 올바르지 않습니다.');
  match.winner=winner;match.scoreA=Number(scoreA);match.scoreB=Number(scoreB);
  match.status='completed';match.completedAt=new Date().toISOString();
  const sourceCourt=removeFromQueues(state,matchId);
  if(match.nextMatchId){
    const next=findMatch(state.draw,match.nextMatchId);
    if(match.nextSlot===1)next.teamA=winner;else next.teamB=winner;
    if(next.teamA&&next.teamB&&next.status!=='completed')next.status='ready';
  }
  refillCourt(state,sourceCourt,id=>findMatch(state.draw,id));
  queueReadyMatches(state,id=>findMatch(state.draw,id));
  return match;
}
