const STORAGE_KEY='230match-v3-stage1-state';
const LEGACY_RECOVERY_KEY='230match-v3-stage1-recovery';
const DB_NAME='230match-v3-local-db';
const DB_VERSION=1;
const RECOVERY_STORE='recoveries';
const MAX_RECOVERIES=10;
let dbPromise=null;
let migrationPromise=null;

export function initialState(){
  return {
    schemaVersion:'230match-v3-stage1',
    tournament:{name:'230스포츠미디어배 테스트',division:'부경신인부'},
    settings:{drawSize:64,courtCount:8,courtPrefix:'국제',venues:[{id:'venue-international',name:'국제',courtCount:8,courtPrefix:'국제'}],venueAssignmentPolicy:'round-robin',separateVenueQueues:true,autoVenuePromotion:true,matchMinutes:40,minimumMatchMinutes:30,autoTimeEnabled:true,timeRefreshSeconds:30,drawMethod:'instant',byePriority:'group-first'},
    teams:[],contacts:{},
    messaging:{settings:{autoMessageEnabled:true,senderName:'230MATCH',deliveryMode:'sms-uri',onCourtAssign:true,onQueueMove:true,templates:{playing:'[{sender}] {team}님, 현재 {court} 코트 경기입니다. 상대팀: {opponent}. 즉시 코트로 이동해 주세요.',wait1:'[{sender}] {team}님, {court} 코트 대기 1번입니다. 상대팀: {opponent}. 예상 대기 {wait}분, 예상 시작 {start}.',shared:'[{sender}] {team}님, 본선 공용대기 {queueNo}번입니다. 상대팀: {opponent}. 코트 배정 전까지 대기해 주세요.'}},queue:[]},
    drawMeta:{locked:false,method:null,byePriority:null,createdAt:null,checksum:null,history:[]},
    prelim:{settings:{activeTeamCount:96,threeTeamGroups:32,twoTeamGroups:0,courtCount:8,courtPrefix:'국제',qualifiersPerGroup:2},activeTeams:[],reserveTeams:[],groups:[],matches:[],courts:[],qualifiers:[],linkedDraw:{active:false,drawSize:0,slots:[],createdAt:null,lastSyncedAt:null}},
    draw:{size:0,rounds:{}},courts:[],sharedQueue:[],venueQueues:{},
    audit:{lastRunAt:null,overall:'not-run',results:[],simulation:null},logs:[],updatedAt:null
  };
}

function compactRecoveryState(source){
  const state=structuredClone(source);
  if(state.audit)state.audit={lastRunAt:state.audit.lastRunAt||null,overall:state.audit.overall||'not-run',results:[],simulation:null};
  if(Array.isArray(state.logs))state.logs=state.logs.slice(-120);
  if(state.messaging){
    if(Array.isArray(state.messaging.queue))state.messaging.queue=state.messaging.queue.slice(-120);
    if(Array.isArray(state.messaging.history))state.messaging.history=state.messaging.history.slice(-120);
  }
  if(state.drawMeta?.history&&Array.isArray(state.drawMeta.history))state.drawMeta.history=state.drawMeta.history.slice(-20);
  delete state.__ui;delete state.__runtime;delete state.__simulation;
  return state;
}

function openRecoveryDb(){
  if(dbPromise)return dbPromise;
  dbPromise=new Promise((resolve,reject)=>{
    if(!('indexedDB' in window)){reject(new Error('IndexedDB를 지원하지 않는 브라우저입니다.'));return;}
    const request=indexedDB.open(DB_NAME,DB_VERSION);
    request.onupgradeneeded=()=>{
      const db=request.result;
      if(!db.objectStoreNames.contains(RECOVERY_STORE)){
        const store=db.createObjectStore(RECOVERY_STORE,{keyPath:'id'});
        store.createIndex('createdAt','createdAt',{unique:false});
      }
    };
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error||new Error('IndexedDB 열기 실패'));
    request.onblocked=()=>reject(new Error('다른 탭이 로컬 저장소 업그레이드를 막고 있습니다.'));
  });
  return dbPromise;
}

function transaction(mode,handler){
  return openRecoveryDb().then(db=>new Promise((resolve,reject)=>{
    const tx=db.transaction(RECOVERY_STORE,mode);
    const store=tx.objectStore(RECOVERY_STORE);
    let value;
    try{value=handler(store,tx);}catch(error){reject(error);return;}
    tx.oncomplete=()=>resolve(value);
    tx.onerror=()=>reject(tx.error||new Error('IndexedDB 작업 실패'));
    tx.onabort=()=>reject(tx.error||new Error('IndexedDB 작업 취소'));
  }));
}

async function listRaw(){
  const db=await openRecoveryDb();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(RECOVERY_STORE,'readonly');
    const req=tx.objectStore(RECOVERY_STORE).getAll();
    req.onsuccess=()=>resolve((req.result||[]).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt))));
    req.onerror=()=>reject(req.error||new Error('복구점 목록 읽기 실패'));
  });
}

async function pruneRecoveries(){
  const list=await listRaw();
  const excess=list.slice(MAX_RECOVERIES);
  if(!excess.length)return list.length;
  await transaction('readwrite',store=>{excess.forEach(item=>store.delete(item.id));});
  return Math.min(list.length,MAX_RECOVERIES);
}

async function migrateLegacyRecoveries(){
  if(migrationPromise)return migrationPromise;
  migrationPromise=(async()=>{
    let legacy=[];
    try{legacy=JSON.parse(localStorage.getItem(LEGACY_RECOVERY_KEY)||'[]');}catch(_error){legacy=[];}
    if(Array.isArray(legacy)&&legacy.length){
      await transaction('readwrite',store=>{
        legacy.slice(0,MAX_RECOVERIES).forEach(raw=>{
          if(!raw?.state)return;
          store.put({id:raw.id||crypto.randomUUID(),label:raw.label||'이전 로컬 복구점',createdAt:raw.createdAt||new Date().toISOString(),state:compactRecoveryState(raw.state),source:'localStorage-migrated'});
        });
      });
      await pruneRecoveries();
    }
    try{localStorage.removeItem(LEGACY_RECOVERY_KEY);}catch(_error){}
    return legacy.length;
  })().catch(error=>{migrationPromise=null;throw error;});
  return migrationPromise;
}

export async function prepareRecoveryStorage(){
  await openRecoveryDb();
  const migrated=await migrateLegacyRecoveries();
  try{if(navigator.storage?.persist)await navigator.storage.persist();}catch(_error){}
  return{ready:true,migrated};
}

const MULTI_DIVISION_GLOBAL_KEYS=new Set(['schemaVersion','tournament','multiDivision','updatedAt','legacyBridge']);
const MULTI_DIVISION_GLOBAL_PORTAL_KEYS=new Set(['tournamentArchives','participantArchives','resultArchives','tournamentTemplates']);
function divisionId(){try{return crypto.randomUUID();}catch(_e){return `division-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;}}
function cloneValue(value){try{return structuredClone(value);}catch(_e){return JSON.parse(JSON.stringify(value));}}
function captureDivisionSnapshot(source){
  const snapshot={};
  Object.keys(source||{}).forEach(key=>{if(!MULTI_DIVISION_GLOBAL_KEYS.has(key)&&key!=='portal')snapshot[key]=cloneValue(source[key]);});
  const portal={};
  Object.entries(source?.portal||{}).forEach(([key,value])=>{if(!MULTI_DIVISION_GLOBAL_PORTAL_KEYS.has(key))portal[key]=cloneValue(value);});
  snapshot.portal=portal;
  return snapshot;
}
function normalizeMultiDivisionState(source){
  const state=source&&typeof source==='object'?source:initialState();
  if(!state.tournament||typeof state.tournament!=='object')state.tournament={name:'대회명 없음',division:'부서 미설정'};
  if(!state.tournament.id)state.tournament.id=divisionId();
  if(!state.tournament.createdAt)state.tournament.createdAt=new Date().toISOString();
  if(!state.multiDivision||!Array.isArray(state.multiDivision.divisions)||!state.multiDivision.divisions.length){
    const id=divisionId();
    state.multiDivision={version:1,activeDivisionId:id,divisions:[{id,name:String(state.tournament.division||'기본 부서'),createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),snapshot:captureDivisionSnapshot(state)}]};
  }
  let active=state.multiDivision.divisions.find(x=>x.id===state.multiDivision.activeDivisionId);
  if(!active){active=state.multiDivision.divisions[0];state.multiDivision.activeDivisionId=active.id;}
  active.name=String(active.name||state.tournament.division||'부서 미설정');
  state.tournament.division=active.name;
  return state;
}
function syncActiveDivisionSnapshot(state){
  normalizeMultiDivisionState(state);
  const active=state.multiDivision.divisions.find(x=>x.id===state.multiDivision.activeDivisionId);
  if(!active)return state;
  active.name=String(state.tournament?.division||active.name||'부서 미설정');
  active.updatedAt=new Date().toISOString();
  active.snapshot=captureDivisionSnapshot(state);
  return state;
}
export function loadState(){try{const raw=localStorage.getItem(STORAGE_KEY);return normalizeMultiDivisionState(raw?JSON.parse(raw):initialState());}catch{return normalizeMultiDivisionState(initialState());}}
export function saveState(state){syncActiveDivisionSnapshot(state);state.updatedAt=new Date().toISOString();localStorage.setItem(STORAGE_KEY,JSON.stringify(state));try{window.dispatchEvent(new CustomEvent('230match:state-saved',{detail:{state:structuredClone(state)}}));}catch(_error){}}
export function clearState(){localStorage.removeItem(STORAGE_KEY);}

export function saveRecovery(state,label='수동 복구점'){
  const item={id:crypto.randomUUID(),label,createdAt:new Date().toISOString(),state:compactRecoveryState(state),compact:true,storage:'indexedDB'};
  const ready=(async()=>{
    try{
      await prepareRecoveryStorage();
      await transaction('readwrite',store=>store.put(item));
      const count=await pruneRecoveries();
      try{window.dispatchEvent(new CustomEvent('230match:recovery-saved',{detail:{id:item.id,count,storage:'indexedDB'}}));}catch(_error){}
      return{saved:true,count,storage:'indexedDB'};
    }catch(error){
      console.warn('IndexedDB 로컬 복구점 저장 실패',error);
      return{saved:false,count:0,storage:'none',error:error?.message||String(error)};
    }
  })();
  return{...item,ready};
}

export async function getRecoveries(){
  try{await prepareRecoveryStorage();return await listRaw();}
  catch(error){console.warn('로컬 복구점 목록 읽기 실패',error);return[];}
}

export async function getRecovery(id){
  try{
    await prepareRecoveryStorage();
    const db=await openRecoveryDb();
    return await new Promise((resolve,reject)=>{const tx=db.transaction(RECOVERY_STORE,'readonly');const req=tx.objectStore(RECOVERY_STORE).get(id);req.onsuccess=()=>resolve(req.result||null);req.onerror=()=>reject(req.error);});
  }catch(error){console.warn('로컬 복구점 읽기 실패',error);return null;}
}

export async function deleteRecovery(id){
  try{await prepareRecoveryStorage();await transaction('readwrite',store=>store.delete(id));return true;}
  catch(error){console.warn('로컬 복구점 삭제 실패',error);return false;}
}
