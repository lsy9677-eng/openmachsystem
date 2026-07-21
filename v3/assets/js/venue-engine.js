
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
        wait1:null
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
