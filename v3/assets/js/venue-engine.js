
export function ensureVenueSettings(state){
  if(!Array.isArray(state.settings.venues)||!state.settings.venues.length){
    state.settings.venues=[{
      id:'venue-default',
      name:state.settings.courtPrefix||'국제',
      courtCount:Math.max(1,Number(state.settings.courtCount)||8),
      courtPrefix:state.settings.courtPrefix||'국제'
    }];
  }
  state.settings.venues=state.settings.venues.map((v,i)=>({
    id:String(v.id||`venue-${i+1}`),
    name:String(v.name||v.courtPrefix||`구장${i+1}`).trim()||`구장${i+1}`,
    courtCount:Math.max(1,Number(v.courtCount)||1),
    courtPrefix:String(v.courtPrefix||v.name||`코트`).trim()||'코트'
  }));
  state.settings.courtCount=state.settings.venues.reduce((sum,v)=>sum+v.courtCount,0);
  state.settings.courtPrefix=state.settings.venues[0]?.courtPrefix||'코트';
}
export function venuePreset(){
  return[
    {id:'venue-international',name:'국제',courtCount:8,courtPrefix:'국제'},
    {id:'venue-downtown',name:'원도심',courtCount:4,courtPrefix:'원도심'}
  ];
}
export function buildVenueCourts(venues){
  const courts=[];
  venues.forEach(venue=>{
    for(let i=1;i<=venue.courtCount;i++){
      courts.push({
        id:`${venue.id}-court-${i}`,
        name:`${venue.courtPrefix}${i}`,
        venueId:venue.id,
        venueName:venue.name,
        courtNo:i,
        playing:null,
        wait1:null,
        isPaused:false,
        pauseReason:'',
        pausedAt:null,
        manualQueue:[]
      });
    }
  });
  return courts;
}
export function venueStats(state){
  ensureVenueSettings(state);
  return{
    venueCount:state.settings.venues.length,
    courtCount:state.settings.venues.reduce((sum,v)=>sum+v.courtCount,0)
  };
}

export function ensureVenueQueues(state){
  ensureVenueSettings(state);
  if(!state.venueQueues||typeof state.venueQueues!=='object')state.venueQueues={};
  state.settings.venues.forEach(v=>{if(!Array.isArray(state.venueQueues[v.id]))state.venueQueues[v.id]=[];});
  Object.keys(state.venueQueues).forEach(id=>{if(!state.settings.venues.some(v=>v.id===id))delete state.venueQueues[id];});
  if(!('venueAssignmentPolicy'in state.settings))state.settings.venueAssignmentPolicy='round-robin';
  if(!('separateVenueQueues'in state.settings))state.settings.separateVenueQueues=true;
  if(!('autoVenuePromotion'in state.settings))state.settings.autoVenuePromotion=true;
}
export function venueForCourt(state,court){
  return state.settings.venues.find(v=>v.id===court?.venueId)||state.settings.venues[0]||null;
}
export function totalVenueQueueCount(state){
  ensureVenueQueues(state);
  return Object.values(state.venueQueues).reduce((sum,q)=>sum+q.length,0);
}
