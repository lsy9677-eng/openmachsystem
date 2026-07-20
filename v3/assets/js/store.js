
const STORAGE_KEY='230match-v3-stage1-state';
const RECOVERY_KEY='230match-v3-stage1-recovery';

export function initialState(){
  return {
    schemaVersion:'230match-v3-stage1',
    tournament:{name:'230스포츠미디어배 테스트',division:'부경신인부'},
    settings:{drawSize:64,courtCount:8,courtPrefix:'국제',matchMinutes:30,autoTimeEnabled:true,timeRefreshSeconds:30,drawMethod:'instant',byePriority:'group-first'},
    teams:[],drawMeta:{locked:false,method:null,byePriority:null,createdAt:null,checksum:null,history:[]},
    prelim:{
      settings:{activeTeamCount:96,threeTeamGroups:32,twoTeamGroups:0,courtCount:8,courtPrefix:'국제',qualifiersPerGroup:2},
      activeTeams:[],reserveTeams:[],
      groups:[],matches:[],courts:[],qualifiers:[],
      linkedDraw:{active:false,drawSize:0,slots:[],createdAt:null,lastSyncedAt:null}
    },
    draw:{size:0,rounds:{}},courts:[],sharedQueue:[],
    logs:[],updatedAt:null
  };
}
export function loadState(){
  try{const raw=localStorage.getItem(STORAGE_KEY);return raw?JSON.parse(raw):initialState();}
  catch{return initialState();}
}
export function saveState(state){
  state.updatedAt=new Date().toISOString();
  localStorage.setItem(STORAGE_KEY,JSON.stringify(state));
}
export function clearState(){localStorage.removeItem(STORAGE_KEY);}
export function getRecoveries(){
  try{return JSON.parse(localStorage.getItem(RECOVERY_KEY)||'[]');}catch{return [];}
}
export function saveRecovery(state,label='수동 복구점'){
  const list=getRecoveries();
  list.unshift({id:crypto.randomUUID(),label,createdAt:new Date().toISOString(),state:structuredClone(state)});
  localStorage.setItem(RECOVERY_KEY,JSON.stringify(list.slice(0,20)));
  return list[0];
}
export function deleteRecovery(id){
  localStorage.setItem(RECOVERY_KEY,JSON.stringify(getRecoveries().filter(x=>x.id!==id)));
}
