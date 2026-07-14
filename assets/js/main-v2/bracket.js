import {STATUS} from './constants.js';
import {uid,nowIso} from './utils.js';

export function createTeams(size){
  return Array.from({length:size},(_,i)=>({
    id:`team_${i+1}`,
    seed:i+1,
    name:`${i+1}번팀 선수A / 선수B`
  }));
}

export function shuffle(items,rng=Math.random){
  const a=[...items];
  for(let i=a.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[a[i],a[j]]=[a[j],a[i]];}
  return a;
}

export function createBracket(size,teams){
  if(![32,64].includes(size)) throw new Error('지원 대진 규모는 32 또는 64입니다.');
  if(teams.length!==size) throw new Error(`팀 수가 ${size}팀이어야 합니다.`);
  const shuffled=shuffle(teams);
  const rounds={};
  let current=size;
  while(current>=2){
    const matchCount=current/2;
    rounds[current]=Array.from({length:matchCount},(_,i)=>({
      id:`r${current}_m${i+1}`,
      roundSize:current,
      matchNo:i+1,
      teamA:null,teamB:null,
      sourceA:null,sourceB:null,
      scoreA:null,scoreB:null,
      winnerId:null,
      status:current===size?STATUS.UNASSIGNED:STATUS.WAITING_SLOTS,
      venue:'',court:'',queueOrder:null,
      startedAt:null,completedAt:null,
      nextMatchId:current>2?`r${current/2}_m${Math.floor(i/2)+1}`:null,
      nextSlot:current>2?(i%2===0?'A':'B'):null
    }));
    current/=2;
  }
  rounds[size].forEach((m,i)=>{m.teamA=shuffled[i*2];m.teamB=shuffled[i*2+1];});
  return {id:uid('draw'),size,createdAt:nowIso(),rounds};
}

export function allMatches(draw){
  if(!draw) return [];
  return Object.keys(draw.rounds).map(Number).sort((a,b)=>b-a).flatMap(r=>draw.rounds[r]);
}

export function getMatch(draw,id){
  return allMatches(draw).find(m=>m.id===id)||null;
}

export function isReady(match){return !!(match&&match.teamA&&match.teamB);}
export function isCompleted(match){return match?.status===STATUS.COMPLETED&&!!match.winnerId;}

export function applyResult(draw,matchId,scoreA,scoreB){
  const m=getMatch(draw,matchId);
  if(!m) throw new Error('경기를 찾지 못했습니다.');
  if(!isReady(m)) throw new Error('양 팀이 확정되지 않았습니다.');
  scoreA=Number(scoreA);scoreB=Number(scoreB);
  if(!Number.isFinite(scoreA)||!Number.isFinite(scoreB)||scoreA===scoreB) throw new Error('동점이 아닌 유효한 점수를 입력하세요.');
  m.scoreA=scoreA;m.scoreB=scoreB;m.winnerId=scoreA>scoreB?m.teamA.id:m.teamB.id;
  m.status=STATUS.COMPLETED;m.completedAt=nowIso();
  const winner=scoreA>scoreB?m.teamA:m.teamB;
  if(m.nextMatchId){
    const next=getMatch(draw,m.nextMatchId);
    if(m.nextSlot==='A') next.teamA=winner; else next.teamB=winner;
    if(next.teamA&&next.teamB&&next.status===STATUS.WAITING_SLOTS) next.status=STATUS.UNASSIGNED;
  }
  return {match:m,winner};
}

export function currentRoundSize(draw){
  const sizes=Object.keys(draw?.rounds||{}).map(Number).sort((a,b)=>b-a);
  for(const size of sizes){
    const matches=draw.rounds[size];
    if(matches.some(m=>m.status!==STATUS.COMPLETED)) return size;
  }
  return 2;
}
