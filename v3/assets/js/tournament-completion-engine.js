import{findMatch,allMatches}from'./bracket-engine.js';

function removeIds(list,completed){return Array.isArray(list)?list.filter(id=>!completed.has(id)):[];}
export function finalizeTournamentCompletion(state){
  const matches=allMatches(state.draw||{rounds:{}});
  const completedIds=new Set(matches.filter(m=>m.status==='completed').map(m=>m.id));
  let removed=0;
  for(const court of [...(state.prelim?.courts||[]),...(state.courts||[])]){
    if(court.playing&&completedIds.has(court.playing)){court.playing=null;removed++;}
    if(court.wait1&&completedIds.has(court.wait1)){court.wait1=null;removed++;}
    const beforeQ=(court.queue||[]).length;court.queue=removeIds(court.queue,completedIds);removed+=beforeQ-court.queue.length;
    const beforeM=(court.manualQueue||[]).length;court.manualQueue=removeIds(court.manualQueue,completedIds);removed+=beforeM-court.manualQueue.length;
  }
  for(const key of Object.keys(state.venueQueues||{})){const before=(state.venueQueues[key]||[]).length;state.venueQueues[key]=removeIds(state.venueQueues[key],completedIds);removed+=before-state.venueQueues[key].length;}
  const beforeShared=(state.sharedQueue||[]).length;state.sharedQueue=removeIds(state.sharedQueue,completedIds);removed+=beforeShared-state.sharedQueue.length;
  const final=findMatch(state.draw,'r2_m1');
  const completed=Boolean(final?.status==='completed'&&final.winner);
  state.operation=state.operation||{};
  if(completed){
    state.operation.tournamentCompletedAt=state.operation.tournamentCompletedAt||final.completedAt||new Date().toISOString();
    state.operation.champion=final.winner;
    state.operation.autoAssignmentEnabled=false;
  }
  state.operation.lastCompletionCheck={checkedAt:new Date().toISOString(),completed,removed};
  return{completed,champion:final?.winner||null,completedAt:state.operation.tournamentCompletedAt||null,removed};
}
