
export function moveQueueItem(state,{matchId,sourceVenueId,targetVenueId,targetPosition='bottom'}){
  if(!state.venueQueues?.[sourceVenueId])throw new Error('출발 구장 대기열을 찾지 못했습니다.');
  if(!state.venueQueues?.[targetVenueId])throw new Error('이동할 구장 대기열을 찾지 못했습니다.');
  const source=state.venueQueues[sourceVenueId];
  const index=source.indexOf(matchId);
  if(index<0)throw new Error('이동할 경기를 공용대기에서 찾지 못했습니다.');
  source.splice(index,1);
  const target=state.venueQueues[targetVenueId];
  if(targetPosition==='top')target.unshift(matchId);else target.push(matchId);
  return true;
}
export function reorderQueueItem(state,{venueId,matchId,direction}){
  const queue=state.venueQueues?.[venueId];
  if(!queue)throw new Error('구장 대기열을 찾지 못했습니다.');
  const index=queue.indexOf(matchId);
  if(index<0)throw new Error('공용대기 경기를 찾지 못했습니다.');
  const next=direction==='up'?index-1:index+1;
  if(next<0||next>=queue.length)return false;
  [queue[index],queue[next]]=[queue[next],queue[index]];
  return true;
}
