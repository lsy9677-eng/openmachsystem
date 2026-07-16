
function clone(v){return structuredClone(v);}
export function ensurePrelimState(state){
  if(!state.prelim){
    state.prelim={settings:{threeTeamGroups:32,twoTeamGroups:2,courtCount:8,courtPrefix:'국제',qualifiersPerGroup:2},groups:[],matches:[],courts:[],qualifiers:[]};
  }
}
export function generatePrelim(state,settings){
  ensurePrelimState(state);
  const three=Math.max(0,Number(settings.threeTeamGroups)||0);
  const two=Math.max(0,Number(settings.twoTeamGroups)||0);
  const needed=three*3+two*2;
  if(needed<2)throw new Error('예선 참가팀 수가 최소 2팀 이상이어야 합니다.');
  if(state.teams.length<needed)throw new Error(`예선 조편성에 ${needed}팀이 필요하지만 현재 명단은 ${state.teams.length}팀입니다.`);
  const groups=[],matches=[];
  let cursor=0,groupNo=1;
  const createGroup=(size)=>{
    const teams=state.teams.slice(cursor,cursor+size).map((t,i)=>({...clone(t),seed:i+1}));
    cursor+=size;
    const id=`g${groupNo}`;
    groups.push({id,groupNo,size,teams,standings:[],court:null});
    const pairs=size===3?[[0,1],[1,2],[0,2]]:[[0,1]];
    pairs.forEach((pair,index)=>{
      matches.push({
        id:`${id}_m${index+1}`,groupId:id,groupNo,matchNo:index+1,
        teamA:clone(teams[pair[0]]),teamB:clone(teams[pair[1]]),
        winner:null,scoreA:null,scoreB:null,status:'ready',court:null
      });
    });
    groupNo++;
  };
  for(let i=0;i<three;i++)createGroup(3);
  for(let i=0;i<two;i++)createGroup(2);
  state.prelim.settings={...settings};
  state.prelim.groups=groups;
  state.prelim.matches=matches;
  state.prelim.courts=[];
  state.prelim.qualifiers=[];
  recalculateStandings(state);
  return {groups:groups.length,matches:matches.length,teams:needed};
}
export function assignPrelimCourts(state){
  ensurePrelimState(state);
  if(!state.prelim.groups.length)throw new Error('먼저 예선 조편성을 생성하세요.');
  const count=Math.max(1,Number(state.prelim.settings.courtCount)||1);
  const prefix=state.prelim.settings.courtPrefix||'코트';
  const courts=Array.from({length:count},(_,i)=>({id:`prelim-court-${i+1}`,name:`${prefix}${i+1}`,groups:[]}));
  state.prelim.groups.forEach((group,index)=>{
    const court=courts[index%count];
    group.court=court.name;
    court.groups.push(group.id);
    state.prelim.matches.filter(m=>m.groupId===group.id).forEach(m=>m.court=court.name);
  });
  state.prelim.courts=courts;
  return courts;
}
export function findPrelimMatch(state,id){return state.prelim?.matches?.find(m=>m.id===id)||null;}
export function submitPrelimResult(state,{matchId,winnerId,scoreA,scoreB}){
  const match=findPrelimMatch(state,matchId);
  if(!match)throw new Error('예선 경기를 찾지 못했습니다.');
  const winner=[match.teamA,match.teamB].find(t=>t.id===winnerId);
  if(!winner)throw new Error('승리팀 선택이 올바르지 않습니다.');
  match.winner=clone(winner);match.scoreA=Number(scoreA);match.scoreB=Number(scoreB);
  match.status='completed';match.completedAt=new Date().toISOString();
  recalculateStandings(state);
  return match;
}
export function recalculateStandings(state){
  ensurePrelimState(state);
  const qpg=Math.max(1,Number(state.prelim.settings.qualifiersPerGroup)||2);
  const qualifiers=[];
  state.prelim.groups.forEach(group=>{
    const stats=new Map(group.teams.map(t=>[t.id,{team:clone(t),wins:0,losses:0,pointsFor:0,pointsAgainst:0,diff:0,played:0}]));
    state.prelim.matches.filter(m=>m.groupId===group.id&&m.status==='completed').forEach(m=>{
      const a=stats.get(m.teamA.id),b=stats.get(m.teamB.id);
      a.played++;b.played++;a.pointsFor+=m.scoreA;a.pointsAgainst+=m.scoreB;b.pointsFor+=m.scoreB;b.pointsAgainst+=m.scoreA;
      if(m.winner.id===m.teamA.id){a.wins++;b.losses++;}else{b.wins++;a.losses++;}
    });
    const standings=[...stats.values()].map(s=>({...s,diff:s.pointsFor-s.pointsAgainst}))
      .sort((a,b)=>b.wins-a.wins||b.diff-a.diff||b.pointsFor-a.pointsFor||a.team.name.localeCompare(b.team.name,'ko'))
      .map((s,index)=>({...s,rank:index+1,qualified:index<qpg&&s.played>0}));
    group.standings=standings;
    const allDone=state.prelim.matches.filter(m=>m.groupId===group.id).every(m=>m.status==='completed');
    if(allDone){
      standings.slice(0,qpg).forEach(s=>qualifiers.push({...clone(s.team),groupNo:group.groupNo,groupRank:s.rank}));
    }
  });
  state.prelim.qualifiers=qualifiers;
}
export function resetPrelim(state){
  ensurePrelimState(state);
  state.prelim.groups=[];state.prelim.matches=[];state.prelim.courts=[];state.prelim.qualifiers=[];
}
