const DB_NAME='230match-v3-record-vault';
const DB_VERSION=1;
const AUTOSAVE_STORE='autosaves';
const ARCHIVE_STORE='archives';
const META_STORE='meta';
const MAX_AUTOSAVES_PER_DIVISION=30;
const EMERGENCY_KEY='230match-v3-emergency-latest';
let dbPromise=null;
let timer=null;
let lastState=null;
let lastStatus={state:'idle',message:'기록 금고 준비',at:null};

function clone(value){try{return structuredClone(value);}catch(_e){return JSON.parse(JSON.stringify(value));}}
function uid(prefix='id'){try{return crypto.randomUUID();}catch(_e){return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,9)}`;}}
function now(){return new Date().toISOString();}
function hashText(text){let h=2166136261;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619);}return (h>>>0).toString(16).padStart(8,'0');}
function openDb(){
  if(dbPromise)return dbPromise;
  dbPromise=new Promise((resolve,reject)=>{
    if(!('indexedDB'in window)){reject(new Error('IndexedDB 미지원'));return;}
    const req=indexedDB.open(DB_NAME,DB_VERSION);
    req.onupgradeneeded=()=>{
      const db=req.result;
      if(!db.objectStoreNames.contains(AUTOSAVE_STORE)){
        const s=db.createObjectStore(AUTOSAVE_STORE,{keyPath:'id'});
        s.createIndex('scope','scope',{unique:false});s.createIndex('savedAt','savedAt',{unique:false});
      }
      if(!db.objectStoreNames.contains(ARCHIVE_STORE)){
        const s=db.createObjectStore(ARCHIVE_STORE,{keyPath:'id'});
        s.createIndex('scope','scope',{unique:false});s.createIndex('archivedAt','archivedAt',{unique:false});
      }
      if(!db.objectStoreNames.contains(META_STORE))db.createObjectStore(META_STORE,{keyPath:'id'});
    };
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error||new Error('기록 금고 열기 실패'));
  });
  return dbPromise;
}
async function put(storeName,value){const db=await openDb();return new Promise((resolve,reject)=>{const tx=db.transaction(storeName,'readwrite');tx.objectStore(storeName).put(value);tx.oncomplete=()=>resolve(value);tx.onerror=()=>reject(tx.error);});}
async function getAllByScope(storeName,scope){const db=await openDb();return new Promise((resolve,reject)=>{const tx=db.transaction(storeName,'readonly');const req=tx.objectStore(storeName).index('scope').getAll(scope);req.onsuccess=()=>resolve(req.result||[]);req.onerror=()=>reject(req.error);});}
async function removeMany(storeName,ids){if(!ids.length)return;const db=await openDb();return new Promise((resolve,reject)=>{const tx=db.transaction(storeName,'readwrite');const s=tx.objectStore(storeName);ids.forEach(id=>s.delete(id));tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});}
function activeDivision(state){const md=state?.multiDivision;return md?.divisions?.find(x=>x.id===md.activeDivisionId)||md?.divisions?.[0]||null;}
function ensureIdentity(state){
  if(!state.tournament)state.tournament={};
  if(!state.tournament.id)state.tournament.id=uid('tournament');
  if(!state.tournament.createdAt)state.tournament.createdAt=now();
  const div=activeDivision(state);
  if(div&&!div.id)div.id=uid('division');
  state.recordVault=state.recordVault||{};
  state.recordVault.version=1;
  return {tournamentId:state.tournament.id,divisionId:div?.id||'default'};
}
function completed(state){
  if(state?.completion?.completedAt||state?.operation?.tournamentCompletedAt)return true;
  const prelim=state?.prelim?.matches||[];
  const rounds=state?.draw?.rounds||{};
  const main=Object.values(rounds).flatMap(x=>Array.isArray(x)?x:[]);
  const all=[...prelim,...main];
  return all.length>0&&all.every(m=>m?.status==='completed');
}
function buildRecord(state,kind,reason){
  const copy=clone(state);const ids=ensureIdentity(copy);const savedAt=now();
  const scope=`${ids.tournamentId}:${ids.divisionId}`;
  const serialized=JSON.stringify(copy);const checksum=hashText(serialized);
  return {id:`${kind}-${scope}-${savedAt}-${checksum}`,kind,scope,...ids,tournamentName:String(copy.tournament?.name||'대회명 없음'),divisionName:String(copy.tournament?.division||activeDivision(copy)?.name||'부서 미설정'),savedAt,archivedAt:kind==='archive'?savedAt:null,reason,checksum,state:copy};
}
function publish(state,message,error=null){lastStatus={state,message,at:now(),error:error?String(error?.message||error):null};try{window.dispatchEvent(new CustomEvent('230match:record-vault-status',{detail:lastStatus}));}catch(_e){} }
async function prune(scope){const rows=(await getAllByScope(AUTOSAVE_STORE,scope)).sort((a,b)=>String(b.savedAt).localeCompare(String(a.savedAt)));await removeMany(AUTOSAVE_STORE,rows.slice(MAX_AUTOSAVES_PER_DIVISION).map(x=>x.id));}
async function persistState(state,{reason='자동 저장',forceArchive=false}={}){
  if(!state||typeof state!=='object')return null;
  const record=buildRecord(state,'autosave',reason);publish('saving','대회 기록 저장 중');
  try{
    await put(AUTOSAVE_STORE,record);await prune(record.scope);
    try{localStorage.setItem(EMERGENCY_KEY,JSON.stringify({savedAt:record.savedAt,scope:record.scope,checksum:record.checksum,state:record.state}));}catch(_e){}
    if(forceArchive||completed(record.state))await archiveState(record.state,{reason:forceArchive?reason:'대회 종료 자동 확정'});
    publish('success',`자동 저장 완료 · ${record.divisionName}`);return record;
  }catch(error){publish('error','기록 저장 실패',error);throw error;}
}
async function archiveState(state,{reason='수동 확정'}={}){
  const record=buildRecord(state,'archive',reason);
  const existing=await getAllByScope(ARCHIVE_STORE,record.scope);
  if(existing.some(x=>x.checksum===record.checksum))return existing.find(x=>x.checksum===record.checksum);
  record.revision=existing.length+1;record.immutable=true;
  await put(ARCHIVE_STORE,record);
  try{window.dispatchEvent(new CustomEvent('230match:record-archived',{detail:{id:record.id,scope:record.scope,revision:record.revision}}));}catch(_e){}
  return record;
}
export function startRecordVault(initialState){
  lastState=initialState;ensureIdentity(lastState);
  openDb().then(()=>persistState(lastState,{reason:'앱 시작 자동 저장'})).catch(error=>publish('error','기록 금고 초기화 실패',error));
  window.addEventListener('230match:state-saved',event=>{lastState=event.detail?.state||lastState;clearTimeout(timer);timer=setTimeout(()=>persistState(lastState).catch(()=>{}),700);});
  window.addEventListener('beforeunload',()=>{if(lastState)try{const ids=ensureIdentity(lastState);localStorage.setItem(EMERGENCY_KEY,JSON.stringify({savedAt:now(),scope:`${ids.tournamentId}:${ids.divisionId}`,state:lastState}));}catch(_e){};});
  window.MatchRecordVault={
    archiveNow:(state=lastState,options={})=>archiveState(state,options),
    saveNow:(state=lastState,options={})=>persistState(state,options),
    validate:(state=lastState)=>validateRecordState(state),
    listAutosaves:async(state=lastState)=>{const ids=ensureIdentity(state);return getAllByScope(AUTOSAVE_STORE,`${ids.tournamentId}:${ids.divisionId}`);},
    listArchives:async(state=lastState)=>{const ids=ensureIdentity(state);return getAllByScope(ARCHIVE_STORE,`${ids.tournamentId}:${ids.divisionId}`);},
    status:()=>({...lastStatus})
  };
  return window.MatchRecordVault;
}
export function validateRecordState(state){
  const issues=[];if(!state?.tournament?.id)issues.push('대회 ID 없음');
  if(!state?.multiDivision?.activeDivisionId)issues.push('현재 부서 ID 없음');
  if(!Array.isArray(state?.multiDivision?.divisions)||!state.multiDivision.divisions.length)issues.push('부서 데이터 없음');
  const ids=new Set();for(const d of state?.multiDivision?.divisions||[]){if(ids.has(d.id))issues.push(`중복 부서 ID: ${d.id}`);ids.add(d.id);if(!d.snapshot)issues.push(`부서 스냅샷 없음: ${d.name||d.id}`);}
  const teamIds=new Set();for(const t of state?.teams||[]){if(!t.id)issues.push('ID 없는 참가팀');else if(teamIds.has(t.id))issues.push(`중복 참가팀 ID: ${t.id}`);teamIds.add(t.id);}
  return {ok:issues.length===0,issues,checkedAt:now(),tournamentId:state?.tournament?.id||null,divisionId:state?.multiDivision?.activeDivisionId||null};
}
