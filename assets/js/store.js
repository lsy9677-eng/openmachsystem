const LEGACY_KEYS=[
  '230match-v3-stage1-state','230match-v3-stage1-last-known-good','230match-v3-stage1-recovery',
  '230match-v3-state','230match-state','230match-v5-sync-settings','230match-v3-sync-settings'
];
const META_KEY='230match-v6-local-meta';
const DB_NAME='230match-v6-recovery-db';
const DB_VERSION=1;
const RECOVERY_STORE='recoveries';
const MAX_MANUAL_RECOVERIES=12;
const MAX_AUTO_RECOVERIES=24;
const MAX_RECOVERIES=MAX_MANUAL_RECOVERIES+MAX_AUTO_RECOVERIES;
let dbPromise=null;

function clone(v){try{return structuredClone(v);}catch{return JSON.parse(JSON.stringify(v));}}
function uid(){try{return crypto.randomUUID();}catch{return `id-${Date.now()}-${Math.random().toString(36).slice(2,9)}`;}}
function emptyPortal(){return{guide:{date:'',venue:'',fee:'',detail:'',startTime:'09:00'},applications:[],posts:[],resultArchives:[],participantArchives:[],tournamentArchives:[],tournamentTemplates:[],archives:[]};}
export function initialState(){
  return normalizeState({
    schemaVersion:'230match-v6',
    tournament:{id:'',name:'',division:''},
    multiTournament:{activeTournamentId:'',tournaments:[],noActiveTournament:true},
    settings:{drawSize:64,courtCount:8,courtPrefix:'국제',venues:[{id:'venue-international',name:'국제',courtCount:8,courtPrefix:'국제'}],venueAssignmentPolicy:'round-robin',separateVenueQueues:true,autoVenuePromotion:true,matchMinutes:40,minimumMatchMinutes:30,autoTimeEnabled:true,timeRefreshSeconds:30,drawMethod:'instant',byePriority:'group-first'},
    teams:[],contacts:{},
    messaging:{settings:{autoMessageEnabled:true,senderName:'230MATCH',deliveryMode:'sms-uri',onCourtAssign:true,onQueueMove:true,compactTemplateVersion:1,templates:{playing:'{team} {court} 경기. 입장',wait1:'{team} {court} 대기1. 약{wait}분',shared:'{team} 본선대기 {queueNo}번'}},queue:[],history:[]},
    drawMeta:{locked:false,method:null,byePriority:null,createdAt:null,checksum:null,history:[]},
    prelim:{settings:{activeTeamCount:64,threeTeamGroups:0,twoTeamGroups:32,courtCount:8,courtPrefix:'국제',qualifiersPerGroup:2},activeTeams:[],reserveTeams:[],groups:[],matches:[],courts:[],qualifiers:[],linkedDraw:{active:false,drawSize:0,slots:[],createdAt:null,lastSyncedAt:null}},
    draw:{size:0,rounds:{}},courts:[],sharedQueue:[],venueQueues:{},
    audit:{lastRunAt:null,overall:'not-run',results:[],simulation:null},logs:[],portal:emptyPortal(),updatedAt:null
  });
}
export function normalizeState(source){
  const state=source&&typeof source==='object'?source:{};
  state.schemaVersion='230match-v6';
  state.tournament=state.tournament&&typeof state.tournament==='object'?state.tournament:{id:'',name:'',division:''};
  state.settings=state.settings&&typeof state.settings==='object'?state.settings:{};
  const defaults={drawSize:64,courtCount:8,courtPrefix:'국제',venues:[{id:'venue-international',name:'국제',courtCount:8,courtPrefix:'국제'}],venueAssignmentPolicy:'round-robin',separateVenueQueues:true,autoVenuePromotion:true,matchMinutes:40,minimumMatchMinutes:30,autoTimeEnabled:true,timeRefreshSeconds:30,drawMethod:'instant',byePriority:'group-first'};
  state.settings={...defaults,...state.settings};
  state.teams=Array.isArray(state.teams)?state.teams:[];
  state.contacts=state.contacts&&typeof state.contacts==='object'&&!Array.isArray(state.contacts)?state.contacts:{};
  state.messaging=state.messaging&&typeof state.messaging==='object'?state.messaging:{};
  state.messaging.settings=state.messaging.settings&&typeof state.messaging.settings==='object'?state.messaging.settings:{};
  state.messaging.queue=Array.isArray(state.messaging.queue)?state.messaging.queue:[];
  state.messaging.history=Array.isArray(state.messaging.history)?state.messaging.history:[];
  state.drawMeta=state.drawMeta&&typeof state.drawMeta==='object'?state.drawMeta:{locked:false,history:[]};
  state.drawMeta.history=Array.isArray(state.drawMeta.history)?state.drawMeta.history:[];
  state.prelim=state.prelim&&typeof state.prelim==='object'?state.prelim:{};
  state.prelim.settings=state.prelim.settings&&typeof state.prelim.settings==='object'?state.prelim.settings:{activeTeamCount:64,threeTeamGroups:0,twoTeamGroups:32,courtCount:8,courtPrefix:'국제',qualifiersPerGroup:2};
  for(const k of ['activeTeams','reserveTeams','groups','matches','courts','qualifiers'])state.prelim[k]=Array.isArray(state.prelim[k])?state.prelim[k]:[];
  state.prelim.linkedDraw=state.prelim.linkedDraw&&typeof state.prelim.linkedDraw==='object'?state.prelim.linkedDraw:{active:false,drawSize:0,slots:[],createdAt:null,lastSyncedAt:null};
  state.draw=state.draw&&typeof state.draw==='object'?state.draw:{size:0,rounds:{}};
  state.draw.rounds=state.draw.rounds&&typeof state.draw.rounds==='object'?state.draw.rounds:{};
  state.courts=Array.isArray(state.courts)?state.courts:[];
  state.sharedQueue=Array.isArray(state.sharedQueue)?state.sharedQueue:[];
  state.venueQueues=state.venueQueues&&typeof state.venueQueues==='object'&&!Array.isArray(state.venueQueues)?state.venueQueues:{};
  state.audit=state.audit&&typeof state.audit==='object'?state.audit:{lastRunAt:null,overall:'not-run',results:[],simulation:null};
  state.audit.results=Array.isArray(state.audit.results)?state.audit.results:[];
  state.logs=Array.isArray(state.logs)?state.logs:[];
  state.portal=state.portal&&typeof state.portal==='object'?state.portal:emptyPortal();
  state.portal.guide=state.portal.guide&&typeof state.portal.guide==='object'?state.portal.guide:{};
  for(const k of ['applications','posts','resultArchives','participantArchives','tournamentArchives','tournamentTemplates','archives'])state.portal[k]=Array.isArray(state.portal[k])?state.portal[k]:[];
  state.multiTournament=state.multiTournament&&typeof state.multiTournament==='object'?state.multiTournament:{activeTournamentId:'',tournaments:[],noActiveTournament:true};
  state.multiTournament.tournaments=Array.isArray(state.multiTournament.tournaments)?state.multiTournament.tournaments:[];
  if(!state.multiTournament.activeTournamentId&&!state.tournament.id){state.multiTournament.noActiveTournament=true;}
  return state;
}
function cleanupLegacy(){for(const k of LEGACY_KEYS){try{localStorage.removeItem(k);}catch{}}}
export function loadState(){cleanupLegacy();return initialState();}
export function saveState(state){
  normalizeState(state);
  state.updatedAt=new Date().toISOString();
  const activeTournamentId=state.multiTournament?.activeTournamentId||state.tournament?.id||'';
  try{localStorage.setItem(META_KEY,JSON.stringify({activeTournamentId,updatedAt:state.updatedAt}));}catch{}
  // 4.3 core: do not structuredClone the entire tournament on every save.
  // The sync engine snapshots only the active tournament after debounce/idle time.
  try{window.dispatchEvent(new CustomEvent('230match:state-saved',{detail:{activeTournamentId,updatedAt:state.updatedAt}}));}catch{}
}
export function clearState(){try{localStorage.removeItem(META_KEY);}catch{}}

function openDb(){if(dbPromise)return dbPromise;dbPromise=new Promise((resolve,reject)=>{const req=indexedDB.open(DB_NAME,DB_VERSION);req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains(RECOVERY_STORE)){const s=db.createObjectStore(RECOVERY_STORE,{keyPath:'id'});s.createIndex('createdAt','createdAt');}};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});return dbPromise;}
async function getAll(){const db=await openDb();return new Promise((resolve,reject)=>{const tx=db.transaction(RECOVERY_STORE,'readonly');const r=tx.objectStore(RECOVERY_STORE).getAll();r.onsuccess=()=>resolve((r.result||[]).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt))));r.onerror=()=>reject(r.error);});}
function recoveryKind(item){
  if(item?.kind==='manual')return 'manual';
  if(item?.kind==='critical-auto')return 'critical-auto';
  if(item?.kind==='auto')return 'auto';
  const label=String(item?.label||'');
  return /자동|직전|초기화 전|변경 전|수정 전|배정 전|추첨 전|복원 전|복구 전|연결 전|시작 전|점검 전/.test(label)?'auto':'manual';
}
function isCriticalRecoveryLabel(label=''){
  return /결승|경기 결과|결과 입력|결과 수정|자동배정|초기화|복구|복원|설정 변경|세부정보 수정|공통정보 변경|본선 재추첨|코트배정|대회 시작/.test(String(label||''));
}
async function trimRecoveries(){
  const all=await getAll();
  const manual=all.filter(x=>recoveryKind(x)==='manual');
  const autos=all.filter(x=>recoveryKind(x)!=='manual');
  const keep=new Set();

  manual.slice(0,MAX_MANUAL_RECOVERIES).forEach(x=>keep.add(x.id));

  // 자동 복구는 최대 24개. 중요 복구점을 먼저 보존하고 나머지는 최신순으로 채운다.
  const critical=autos.filter(x=>recoveryKind(x)==='critical-auto'||isCriticalRecoveryLabel(x.label));
  const regular=autos.filter(x=>!critical.includes(x));
  const selected=[];
  for(const x of critical){if(selected.length<MAX_AUTO_RECOVERIES)selected.push(x);}
  for(const x of regular){if(selected.length<MAX_AUTO_RECOVERIES)selected.push(x);}
  selected.forEach(x=>keep.add(x.id));

  for(const old of all){if(!keep.has(old.id))await deleteRecovery(old.id);}
  return {
    count:keep.size,
    manualCount:Math.min(manual.length,MAX_MANUAL_RECOVERIES),
    autoCount:Math.min(autos.length,MAX_AUTO_RECOVERIES),
    max:MAX_RECOVERIES
  };
}
async function put(item){
  const db=await openDb();
  await new Promise((resolve,reject)=>{
    const tx=db.transaction(RECOVERY_STORE,'readwrite');
    tx.objectStore(RECOVERY_STORE).put(item);
    tx.oncomplete=resolve;
    tx.onerror=()=>reject(tx.error);
  });
  return trimRecoveries();
}
export async function prepareRecoveryStorage(){await openDb();try{await navigator.storage?.persist?.();}catch{}return{ready:true,migrated:0};}
export function saveRecovery(state,label='수동 복구점',options={}){
  const requested=String(options?.kind||'').trim();
  const kind=requested==='manual'?'manual':requested==='critical-auto'?'critical-auto':requested==='auto'?'auto':(isCriticalRecoveryLabel(label)?'critical-auto':'auto');
  const item={id:uid(),label,kind,createdAt:new Date().toISOString(),state:clone(normalizeState(clone(state))),storage:'indexedDB-v6'};
  const ready=put(item).then(info=>({saved:true,count:info.count,manualCount:info.manualCount,autoCount:info.autoCount,max:info.max,kind,storage:'indexedDB-v6'})).catch(error=>({saved:false,count:0,manualCount:0,autoCount:0,max:MAX_RECOVERIES,kind,storage:'none',error:error?.message||String(error)}));
  return{...item,ready};
}
export async function getRecoveries(){try{return await getAll();}catch{return[];}}
export async function getRecovery(id){try{const db=await openDb();return await new Promise((resolve,reject)=>{const tx=db.transaction(RECOVERY_STORE,'readonly');const r=tx.objectStore(RECOVERY_STORE).get(id);r.onsuccess=()=>resolve(r.result||null);r.onerror=()=>reject(r.error);});}catch{return null;}}
export async function deleteRecovery(id){try{const db=await openDb();await new Promise((resolve,reject)=>{const tx=db.transaction(RECOVERY_STORE,'readwrite');tx.objectStore(RECOVERY_STORE).delete(id);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});return true;}catch{return false;}}

export const RECOVERY_LIMITS={manual:MAX_MANUAL_RECOVERIES,auto:MAX_AUTO_RECOVERIES,total:MAX_RECOVERIES};
console.info('[230MATCH] store 5.8.4 · recovery retention manual 12 + auto 24');
