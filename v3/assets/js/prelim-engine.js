import{prelimVenues}from'./venue-engine.js';

function clone(v){return structuredClone(v);}
export function ensurePrelimState(state){
  if(!state.prelim){
    state.prelim={settings:{activeTeamCount:96,threeTeamGroups:32,twoTeamGroups:0,courtCount:8,courtPrefix:'국제',qualifiersPerGroup:2},activeTeams:[],reserveTeams:[],groups:[],matches:[],courts:[],qualifiers:[],linkedDraw:{active:false,drawSize:0,slots:[],createdAt:null,lastSyncedAt:null}};
  }
  if(!state.prelim.linkedDraw){
    state.prelim.linkedDraw={active:false,drawSize:0,slots:[],createdAt:null,lastSyncedAt:null};
  }
  if(!Array.isArray(state.prelim.activeTeams))state.prelim.activeTeams=[];
  if(!Array.isArray(state.prelim.reserveTeams))state.prelim.reserveTeams=[];
  if(!('activeTeamCount' in state.prelim.settings))state.prelim.settings.activeTeamCount=96;
}
export function generatePrelim(state,settings){
  ensurePrelimState(state);
  const activeCount=Math.max(2,Number(settings.activeTeamCount)||state.teams.length);
  const three=Math.max(0,Number(settings.threeTeamGroups)||0);
  const two=Math.max(0,Number(settings.twoTeamGroups)||0);
  const needed=three*3+two*2;
  if(activeCount>state.teams.length)throw new Error(`예선 사용팀 ${activeCount}팀이 현재 명단 ${state.teams.length}팀보다 많습니다.`);
  if(needed!==activeCount)throw new Error(`조편성 합계 ${needed}팀과 예선 사용팀 ${activeCount}팀이 일치하지 않습니다.`);
  state.prelim.activeTeams=state.teams.slice(0,activeCount).map(clone);
  state.prelim.reserveTeams=state.teams.slice(activeCount).map(clone);
  const groups=[],matches=[];
  let cursor=0,groupNo=1;
  const pending=(label,key)=>({id:key,name:label,placeholder:true});
  const createGroup=(size)=>{
    const teams=state.prelim.activeTeams.slice(cursor,cursor+size).map((t,i)=>({...clone(t),seed:i+1}));
    cursor+=size;
    const id=`g${groupNo}`;
    groups.push({id,groupNo,size,teams,standings:[],court:null,nextMatchNo:1});
    if(size===3){
      matches.push({
        id:`${id}_m1`,groupId:id,groupNo,matchNo:1,
        teamA:clone(teams[0]),teamB:clone(teams[1]),
        winner:null,loser:null,scoreA:null,scoreB:null,status:'ready',court:null,
        dependency:null,sequenceLabel:'1번팀 vs 2번팀'
      });
      matches.push({
        id:`${id}_m2`,groupId:id,groupNo,matchNo:2,
        teamA:pending('첫 경기 승자',`${id}-winner-m1`),teamB:clone(teams[2]),
        winner:null,loser:null,scoreA:null,scoreB:null,status:'waiting_dependency',court:null,
        dependency:{afterMatchId:`${id}_m1`,teamAFrom:'winner'},sequenceLabel:'첫 경기 승자 vs 3번팀'
      });
      matches.push({
        id:`${id}_m3`,groupId:id,groupNo,matchNo:3,
        teamA:pending('첫 경기 패자',`${id}-loser-m1`),teamB:clone(teams[2]),
        winner:null,loser:null,scoreA:null,scoreB:null,status:'waiting_previous',court:null,
        dependency:{afterMatchId:`${id}_m2`,teamAFromMatchId:`${id}_m1`,teamAFrom:'loser'},sequenceLabel:'첫 경기 패자 vs 3번팀'
      });
    }else{
      matches.push({
        id:`${id}_m1`,groupId:id,groupNo,matchNo:1,
        teamA:clone(teams[0]),teamB:clone(teams[1]),
        winner:null,loser:null,scoreA:null,scoreB:null,status:'ready',court:null,
        dependency:null,sequenceLabel:'1번팀 vs 2번팀'
      });
    }
    groupNo++;
  };
  for(let i=0;i<three;i++)createGroup(3);
  for(let i=0;i<two;i++)createGroup(2);
  state.prelim.settings={...settings};
  state.prelim.groups=groups;
  state.prelim.matches=matches;
  state.prelim.courts=[];
  state.prelim.qualifiers=[];
  state.prelim.linkedDraw={active:false,drawSize:0,slots:[],createdAt:null,lastSyncedAt:null};
  recalculateStandings(state);
  return {groups:groups.length,matches:matches.length,teams:needed};
}
/* 예선은 조 번호 순서대로 선택된 예선 구장의 전체 코트에 순환 배정합니다. */
export function assignPrelimCourts(state){
  ensurePrelimState(state);
  if(!state.prelim.groups.length)throw new Error('먼저 예선 조편성을 생성하세요.');
  const venues=prelimVenues(state);
  const courts=[];
  venues.forEach(venue=>{
    for(let i=1;i<=venue.courtCount;i++){
      courts.push({
        id:`prelim-${venue.id}-court-${i}`,
        name:`${venue.courtPrefix}${i}`,
        venueId:venue.id,venueName:venue.name,
        groups:[],playing:null,wait1:null,queue:[]
      });
    }
  });
  if(!courts.length)throw new Error('예선 사용 구장이 없습니다.');

  state.prelim.matches.forEach(m=>{
    m.court=null;m.prelimCourtId=null;m.venueId=null;m.venueName=null;
    if(m.matchNo===1)m.status='ready';
    else if(m.matchNo===2)m.status='waiting_dependency';
    else m.status='waiting_previous';
  });

  state.prelim.groups.slice().sort((a,b)=>a.groupNo-b.groupNo).forEach((group,index)=>{
    const court=courts[index%courts.length];
    group.court=court.name;group.prelimCourtId=court.id;group.venueId=court.venueId;group.venueName=court.venueName;
    court.groups.push(group.id);
    state.prelim.matches.filter(m=>m.groupId===group.id).forEach(m=>{
      m.court=court.name;m.prelimCourtId=court.id;m.venueId=court.venueId;m.venueName=court.venueName;
    });
  });

  // 한 코트에 여러 조가 있으면 각 조의 첫 경기부터 번갈아 배치
  courts.forEach(court=>{
    court.groups
      .map(groupId=>state.prelim.matches.find(m=>m.groupId===groupId&&m.matchNo===1))
      .filter(Boolean)
      .forEach(m=>{m.status='queued';court.queue.push(m.id);});
    promotePrelimCourt(state,court);
  });

  state.prelim.courts=courts;
  return courts;
}
function enqueuePrelimMatch(state,match){
  const court=state.prelim?.courts?.find(c=>c.id===match.prelimCourtId);
  if(!court)return;
  court.queue=court.queue||[];
  if(court.playing!==match.id&&court.wait1!==match.id&&!court.queue.includes(match.id)){
    match.status='queued';
    court.queue.push(match.id);
  }
}
function resolveNextPrelimMatch(state,completedMatch){
  const groupMatches=state.prelim.matches.filter(m=>m.groupId===completedMatch.groupId).sort((a,b)=>a.matchNo-b.matchNo);
  if(completedMatch.matchNo===1&&groupMatches.length===3){
    const second=groupMatches.find(m=>m.matchNo===2);
    const third=groupMatches.find(m=>m.matchNo===3);
    second.teamA=clone(completedMatch.winner);
    third.teamA=clone(completedMatch.loser);
    enqueuePrelimMatch(state,second);
  }else if(completedMatch.matchNo===2&&groupMatches.length===3){
    const third=groupMatches.find(m=>m.matchNo===3);
    enqueuePrelimMatch(state,third);
  }
}
function promotePrelimCourt(state,court){
  court.queue=court.queue||[];
  if(!court.playing&&court.wait1){
    court.playing=court.wait1;court.wait1=null;
    const m=state.prelim.matches.find(x=>x.id===court.playing);if(m)m.status='playing';
  }
  if(!court.playing&&court.queue.length){
    court.playing=court.queue.shift();
    const m=state.prelim.matches.find(x=>x.id===court.playing);if(m)m.status='playing';
  }
  if(!court.wait1&&court.queue.length){
    court.wait1=court.queue.shift();
    const m=state.prelim.matches.find(x=>x.id===court.wait1);if(m)m.status='court_wait1';
  }
  return court;
}
export function advancePrelimCourt(state,courtId,completedMatch=null){
  const court=state.prelim?.courts?.find(c=>c.id===courtId);
  if(!court)return null;
  if(completedMatch)resolveNextPrelimMatch(state,completedMatch);
  if(court.playing===completedMatch?.id)court.playing=null;
  promotePrelimCourt(state,court);
  return court;
}
export function findPrelimMatch(state,id){return state.prelim?.matches?.find(m=>m.id===id)||null;}
export function submitPrelimResult(state,{matchId,winnerId,scoreA,scoreB}){
  const match=findPrelimMatch(state,matchId);
  if(!match)throw new Error('예선 경기를 찾지 못했습니다.');
  const winner=[match.teamA,match.teamB].find(t=>t.id===winnerId);
  if(!winner)throw new Error('승리팀 선택이 올바르지 않습니다.');
  const loser=match.teamA.id===winner.id?match.teamB:match.teamA;
  const wasCompleted=match.status==='completed';
  match.winner=clone(winner);match.loser=clone(loser);match.scoreA=Number(scoreA);match.scoreB=Number(scoreB);
  match.status='completed';match.completedAt=new Date().toISOString();
  if(!wasCompleted&&match.prelimCourtId)advancePrelimCourt(state,match.prelimCourtId,match);
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

export function autoFitPrelimGroups(activeTeamCount){
  const total=Math.max(2,Number(activeTeamCount)||0);
  const two=total%3===0?0:(total%3===1?2:1);
  const three=(total-two*2)/3;
  if(three<0||!Number.isInteger(three))throw new Error('해당 팀 수로 2팀조·3팀조 조합을 만들 수 없습니다.');
  return {threeTeamGroups:three,twoTeamGroups:two};
}
export function swapActiveReserveTeam(state,activeTeamId,reserveTeamId){
  ensurePrelimState(state);
  const ai=state.prelim.activeTeams.findIndex(t=>t.id===activeTeamId);
  const ri=state.prelim.reserveTeams.findIndex(t=>t.id===reserveTeamId);
  if(ai<0||ri<0)throw new Error('교체할 참가팀 또는 후보팀을 찾지 못했습니다.');
  const active=state.prelim.activeTeams[ai];
  const reserve=state.prelim.reserveTeams[ri];
  state.prelim.activeTeams[ai]=reserve;
  state.prelim.reserveTeams[ri]=active;
  return {activeOut:active,reserveIn:reserve};
}

export function resetPrelim(state){
  ensurePrelimState(state);
  state.prelim.activeTeams=[];state.prelim.reserveTeams=[];
  state.prelim.groups=[];state.prelim.matches=[];state.prelim.courts=[];state.prelim.qualifiers=[];
  state.prelim.linkedDraw={active:false,drawSize:0,slots:[],createdAt:null,lastSyncedAt:null};
}
