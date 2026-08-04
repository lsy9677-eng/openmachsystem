import{findMatch}from'./bracket-engine.js';

function allMainMatches(state){return Object.values(state.draw?.rounds||{}).flat();}
function sameTeam(a,b){return Boolean(a&&b&&a.id&&b.id&&a.id===b.id);}

export function verifyAndRepairMainFlow(state,{sourceMatchId=null}={}){
  const matches=allMainMatches(state);
  const byId=new Map(matches.map(m=>[m.id,m]));
  const report={checked:matches.length,propagated:0,statusFixed:0,conflicts:0,missingNext:0};
  for(const match of matches){
    if(match.status==='completed'&&match.winner&&match.nextMatchId){
      const next=byId.get(match.nextMatchId);
      if(!next){report.missingNext++;continue;}
      const key=match.nextSlot===1?'teamA':'teamB';
      const current=next[key];
      if(!current||current.placeholder){next[key]=match.winner;report.propagated++;}
      else if(!sameTeam(current,match.winner)){report.conflicts++;}
    }
  }
  for(const match of matches){
    if(match.status==='completed'||match.status==='playing')continue;
    const realA=Boolean(match.teamA&&!match.teamA.placeholder);
    const realB=Boolean(match.teamB&&!match.teamB.placeholder);
    const expected=realA&&realB?'ready':'waiting_slots';
    if(match.status!==expected){match.status=expected;report.statusFixed++;}
  }
  if(sourceMatchId){
    const source=findMatch(state.draw,sourceMatchId);
    report.nextMatchId=source?.nextMatchId||null;
    report.nextReady=Boolean(source?.nextMatchId&&findMatch(state.draw,source.nextMatchId)?.status==='ready');
  }
  state.operation=state.operation||{};
  state.operation.lastMainFlowCheck={...report,checkedAt:new Date().toISOString(),sourceMatchId};
  return report;
}
