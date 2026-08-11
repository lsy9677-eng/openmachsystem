import { getAuthRuntime } from './auth-engine.js?v=3565';
import { normalizeState } from './store-v6200.js?v=6200';

const SETTINGS_KEY='230match-v7-sync-settings';
const FIREBASE_APP_URL='https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
const FIRESTORE_URL='https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
const DEFAULT_FIREBASE={apiKey:'AIzaSyAbc17RiYyxCqgbMBkxkMoiRdNTmy2q65w',authDomain:'open-match-manager.firebaseapp.com',projectId:'open-match-manager',storageBucket:'open-match-manager.firebasestorage.app',messagingSenderId:'195671806262',appId:'1:195671806262:web:89691574839266cea1a397'};

// 4.3 core principles:
// 1) one Firestore room listener only; never listen to the whole tournament collection.
// 2) decode all tournament workspaces only once at initial connection for backward-compatible switching.
// 3) on every local edit, do not clone/stringify/cache the full state on the UI event.
// 4) debounce cloud writes and snapshot only the active tournament.
// 5) ignore our own room-listener echo; remote writes fetch/decode only the active tournament doc.
const COLLECTION='matchRoomsV7';
const ROOM_ID='230match-production';
const SAVE_DEBOUNCE=1400;
const CACHE_DEBOUNCE=3500;
const CACHE_DB_NAME='230match-v7-runtime-cache';
const CACHE_DB_VERSION=1;
const CACHE_STORE='workspaces';
const ACTIVE_TOURNAMENT_KEY='230match-v7-active-tournament';
const activeDivisionKey=id=>`230match-v7-active-division:${safeId(id)}`;

let api=null,db=null;
let getStateFn=()=>null,applyRemoteFn=()=>{},statusFn=()=>{},canWriteFn=()=>false;
let unsubscribeRoom=null,saveTimer=null,cacheTimer=null,pushInFlight=false,applyingRemote=false;
let dirtyGeneration=0,lastSavedDigest='',lastAppliedDigest='',lastKnownRoomRevision=0,lastWriterUid='';
let cacheDbPromise=null;

function status(label,level='info',detail='',extra={}){statusFn({label,level,detail,schemaVersion:7,roomId:ROOM_ID,...extra});}
function safeId(value,fallback='tournament'){const out=String(value||'').trim().replace(/[^a-zA-Z0-9_-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,120);return out||`${fallback}-${crypto.randomUUID()}`;}
function activeIdOf(state){return String(state?.multiTournament?.activeTournamentId||state?.tournament?.id||'').trim();}
function isRealTournament(workspace){const name=String(workspace?.tournament?.name||'').trim(),id=String(workspace?.tournament?.id||'').trim();return Boolean(id&&name&&!['대회 준비 중','이름 없는 대회','등록된 운영 대회 없음'].includes(name));}
function clone(value){return structuredClone(value);}
function compactCloneWithoutRegistry(source){
  if(!source||typeof source!=='object')return null;
  const shallow={...source};delete shallow.multiTournament;
  return clone(shallow);
}
const DIVISION_GLOBAL_KEYS=new Set(['schemaVersion','tournament','multiDivision','updatedAt','legacyBridge','multiTournament']);
const DIVISION_GLOBAL_PORTAL_KEYS=new Set(['tournamentArchives','participantArchives','resultArchives','tournamentTemplates','archives','legacyTournamentSummaries']);
function countCompleted(rows){return Array.isArray(rows)?rows.filter(x=>x?.status==='completed'||x?.winnerId||x?.winner).length:0;}
function stateProgressScore(s){if(!s||typeof s!=='object')return 0;const prelim=s.prelim||{};let main=[];try{main=Object.values(s.draw?.rounds||{}).flat().filter(Boolean);}catch{}return (s.teams?.length||0)*5+(s.portal?.applications?.length||0)*3+(prelim.groups?.length||0)*8+(prelim.matches?.length||0)*10+countCompleted(prelim.matches)*60+main.length*10+countCompleted(main)*80;}
function restoreRootFromActiveDivision(source){
  if(!source?.multiDivision?.divisions?.length)return {state:source,repaired:false};
  const next=clone(source);const record=next.multiDivision.divisions.find(d=>String(d.id)===String(next.multiDivision.activeDivisionId))||next.multiDivision.divisions[0];
  if(!record?.snapshot)return {state:source,repaired:false};
  if(stateProgressScore(record.snapshot)<=stateProgressScore(next))return {state:source,repaired:false};
  const preservedTournament={...(next.tournament||{})},preservedMultiTournament=next.multiTournament,globalPortal={};
  Object.entries(next.portal||{}).forEach(([k,v])=>{if(DIVISION_GLOBAL_PORTAL_KEYS.has(k))globalPortal[k]=clone(v);});
  Object.keys(record.snapshot).forEach(key=>{if(key!=='portal'&&!DIVISION_GLOBAL_KEYS.has(key))next[key]=clone(record.snapshot[key]);});
  next.portal={...globalPortal,...clone(record.snapshot.portal||{})};next.tournament={...preservedTournament,division:record.name||preservedTournament.division||''};next.multiTournament=preservedMultiTournament;next.multiDivision.activeDivisionId=record.id;next.updatedAt=new Date().toISOString();return {state:next,repaired:true};
}
function currentWorkspace(source){
  const compact=compactCloneWithoutRegistry(source);if(!compact)return null;
  const repaired=restoreRootFromActiveDivision(compact);const normalized=normalizeState(repaired.state);const id=activeIdOf(source)||String(normalized.tournament?.id||'');if(!id)return null;
  normalized.tournament={...(normalized.tournament||{}),id};delete normalized.multiTournament;return isRealTournament(normalized)?normalized:null;
}
function hashString(text){let h=2166136261;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619);}return(h>>>0).toString(36);}
function digestWorkspace(workspace){try{const shallow={...workspace};delete shallow.updatedAt;return hashString(JSON.stringify(shallow));}catch{return'';}}
function defaultSettings(){return{enabled:true,roomId:ROOM_ID,collection:COLLECTION,firebaseConfigText:''};}
export function getSyncSettings(){try{return{...defaultSettings(),...(JSON.parse(localStorage.getItem(SETTINGS_KEY)||'null')||{})};}catch{return defaultSettings();}}
export function saveSyncSettings(settings){const next={...defaultSettings(),...(settings||{}),roomId:ROOM_ID,collection:COLLECTION};localStorage.setItem(SETTINGS_KEY,JSON.stringify(next));return next;}
function parseConfig(text){if(!String(text||'').trim())return DEFAULT_FIREBASE;return{...DEFAULT_FIREBASE,...JSON.parse(text)};}
async function loadFirebase(){if(!api)api={...(await import(FIREBASE_APP_URL)),...(await import(FIRESTORE_URL))};return api;}
async function runtime({requireUser=false}={}){const rt=await getAuthRuntime();if(requireUser&&!rt?.user)throw new Error('클라우드 저장은 로그인 후 사용할 수 있습니다.');return rt||{};}
async function ensureDb(){if(db)return;const cfg=parseConfig(getSyncSettings().firebaseConfigText),rt=await runtime(),f=await loadFirebase();let app=rt?.auth?.app;if(!app){const name=`230match-v7-${cfg.projectId}`;try{app=f.getApp(name);}catch{app=f.initializeApp(cfg,name);}}db=rt?.db||f.getFirestore(app);}
function roomRef(){return api.doc(db,COLLECTION,ROOM_ID);}
function tournamentsCollection(){return api.collection(db,COLLECTION,ROOM_ID,'tournaments');}
function tournamentRef(id){return api.doc(db,COLLECTION,ROOM_ID,'tournaments',safeId(id));}

function openCacheDb(){if(cacheDbPromise)return cacheDbPromise;cacheDbPromise=new Promise((resolve,reject)=>{const req=indexedDB.open(CACHE_DB_NAME,CACHE_DB_VERSION);req.onupgradeneeded=()=>{const x=req.result;if(!x.objectStoreNames.contains(CACHE_STORE)){const s=x.createObjectStore(CACHE_STORE,{keyPath:'id'});s.createIndex('updatedAt','updatedAt');}};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});return cacheDbPromise;}
async function putCacheState(source){try{const ws=currentWorkspace(source);if(!ws)return false;const id=safeId(ws.tournament.id),dbx=await openCacheDb();const registry=(source.multiTournament?.tournaments||[]).map(r=>({id:r.id,name:r.name||r.snapshot?.tournament?.name||'',division:r.division||r.snapshot?.tournament?.division||'',createdAt:r.createdAt||'',updatedAt:r.updatedAt||''}));const cached={...clone(ws),multiTournament:{activeTournamentId:id,tournaments:registry,noActiveTournament:false}};await new Promise((resolve,reject)=>{const tx=dbx.transaction(CACHE_STORE,'readwrite');tx.objectStore(CACHE_STORE).put({id,updatedAt:source.updatedAt||new Date().toISOString(),workspace:cached});tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});return true;}catch(error){console.warn('[230MATCH] idle cache skipped',error);return false;}}
function scheduleCache(){clearTimeout(cacheTimer);cacheTimer=setTimeout(()=>{const run=()=>putCacheState(getStateFn());if('requestIdleCallback'in window)requestIdleCallback(run,{timeout:1200});else setTimeout(run,0);},CACHE_DEBOUNCE);}
async function readCachedState(id=''){try{const dbx=await openCacheDb();return await new Promise((resolve,reject)=>{const tx=dbx.transaction(CACHE_STORE,'readonly'),store=tx.objectStore(CACHE_STORE);if(id){const req=store.get(safeId(id));req.onsuccess=()=>resolve(req.result?.workspace||null);req.onerror=()=>reject(req.error);}else{const req=store.getAll();req.onsuccess=()=>resolve((req.result||[]).sort((a,b)=>String(b.updatedAt||'').localeCompare(String(a.updatedAt||'')))[0]?.workspace||null);req.onerror=()=>reject(req.error);}});}catch{return null;}}

function bytesToBase64(bytes){let binary='';const chunk=0x8000;for(let i=0;i<bytes.length;i+=chunk)binary+=String.fromCharCode(...bytes.subarray(i,i+chunk));return btoa(binary);}
function base64ToBytes(text){const binary=atob(String(text||'')),bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);return bytes;}
async function gzipText(text){if(typeof CompressionStream!=='function')return null;const stream=new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));return new Uint8Array(await new Response(stream).arrayBuffer());}
async function gunzipText(bytes){if(typeof DecompressionStream!=='function')throw new Error('이 브라우저는 압축된 대회 데이터 읽기를 지원하지 않습니다.');const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));return await new Response(stream).text();}
async function encodeWorkspace(workspace){const json=JSON.stringify(workspace),compressed=await gzipText(json);if(compressed){const base64=bytesToBase64(compressed);if(base64.length<json.length)return{data:base64,encoding:'gzip-base64-v1',originalBytes:new Blob([json]).size,storedBytes:new Blob([base64]).size};}return{data:json,encoding:'json-v1',originalBytes:new Blob([json]).size,storedBytes:new Blob([json]).size};}
async function decodeWorkspace(raw){if(raw?.workspace&&typeof raw.workspace==='object')return clone(raw.workspace);if(typeof raw?.workspaceJson!=='string')return null;try{return raw.workspaceEncoding==='gzip-base64-v1'?JSON.parse(await gunzipText(base64ToBytes(raw.workspaceJson))):JSON.parse(raw.workspaceJson);}catch(error){console.warn('[230MATCH] workspace decode failed',error);return null;}}
function metaFromRaw(id,raw,workspace=null){return{id,name:raw?.name||workspace?.tournament?.name||'',division:raw?.division||workspace?.tournament?.division||'',createdAt:raw?.createdAt||workspace?.tournament?.createdAt||'',updatedAt:raw?.updatedAt||workspace?.updatedAt||'',snapshot:workspace?clone(workspace):undefined};}
function applyClientDivisionSelection(source,tournamentId=''){
  if(!source?.multiDivision?.divisions?.length)return source;
  const tid=safeId(tournamentId||source?.tournament?.id||activeIdOf(source));
  let preferred='';try{preferred=String(localStorage.getItem(activeDivisionKey(tid))||'');}catch{}
  if(!preferred)return source;
  const record=source.multiDivision.divisions.find(d=>String(d.id)===preferred);if(!record?.snapshot)return source;
  const next=clone(source),preservedTournament={...(next.tournament||{})},preservedMultiTournament=next.multiTournament,globalPortal={};
  Object.entries(next.portal||{}).forEach(([k,v])=>{if(DIVISION_GLOBAL_PORTAL_KEYS.has(k))globalPortal[k]=clone(v);});
  const managed=new Set();next.multiDivision.divisions.forEach(d=>Object.keys(d.snapshot||{}).forEach(k=>{if(k!=='portal'&&!DIVISION_GLOBAL_KEYS.has(k))managed.add(k);}));
  managed.forEach(k=>delete next[k]);Object.entries(record.snapshot||{}).forEach(([k,v])=>{if(k!=='portal'&&!DIVISION_GLOBAL_KEYS.has(k))next[k]=clone(v);});
  next.portal={...globalPortal,...clone(record.snapshot.portal||{})};next.tournament={...preservedTournament,division:record.name||preservedTournament.division||''};next.multiTournament=preservedMultiTournament;next.multiDivision.activeDivisionId=record.id;return next;
}
async function readInitialBundle(){
  const [roomSnap,tournamentSnaps]=await Promise.all([api.getDoc(roomRef()),api.getDocs(tournamentsCollection())]);const room=roomSnap.exists()?roomSnap.data():{};const rows=tournamentSnaps.docs.map(s=>({id:s.id,raw:s.data()})).filter(x=>x.id&&x.raw?.name);if(!rows.length)return null;
  rows.sort((a,b)=>String(b.raw?.updatedAt||'').localeCompare(String(a.raw?.updatedAt||'')));
  let localRequested='';try{localRequested=String(localStorage.getItem(ACTIVE_TOURNAMENT_KEY)||'');}catch{}
  const requested=String(localRequested||room.activeTournamentId||'');const activeRow=rows.find(x=>x.id===requested)||rows[0];
  const activeDecoded=await decodeWorkspace(activeRow.raw);if(!activeDecoded)return null;activeDecoded.tournament={...(activeDecoded.tournament||{}),id:activeRow.id};
  // Inactive tournaments stay metadata-only. Their workspace is loaded only when the user selects them.
  const meta=rows.map(row=>metaFromRaw(row.id,row.raw,row.id===activeRow.id?activeDecoded:null));
  let state=normalizeState(clone(activeDecoded));state.multiTournament={activeTournamentId:activeRow.id,tournaments:meta,noActiveTournament:false};state=normalizeState(applyClientDivisionSelection(state,activeRow.id));
  try{localStorage.setItem(ACTIVE_TOURNAMENT_KEY,activeRow.id);}catch{}lastKnownRoomRevision=Number(room.revision||0);lastWriterUid=String(room.lastWriterUid||'');return{state,room,count:meta.length};
}
async function readOneTournament(id,registry=[]){const snap=await api.getDoc(tournamentRef(id));if(!snap.exists())return null;const raw=snap.data(),decoded=await decodeWorkspace(raw);if(!decoded)return null;decoded.tournament={...(decoded.tournament||{}),id:snap.id};const records=(registry||[]).map(r=>String(r.id)===String(snap.id)?{...r,...metaFromRaw(snap.id,raw,null)}:{id:r.id,name:r.name||r.snapshot?.tournament?.name||'',division:r.division||r.snapshot?.tournament?.division||'',createdAt:r.createdAt||'',updatedAt:r.updatedAt||''});if(!records.some(r=>String(r.id)===String(snap.id)))records.push(metaFromRaw(snap.id,raw,null));let state=normalizeState(clone(decoded));state.multiTournament={activeTournamentId:snap.id,tournaments:records,noActiveTournament:false};state=normalizeState(applyClientDivisionSelection(state,snap.id));return{state,raw};}

function chooseInitial(local,remote){if(!local)return remote;if(!remote)return local;const lid=activeIdOf(local),rid=activeIdOf(remote);if(lid!==rid)return remote;const lt=Date.parse(local.updatedAt||'')||0,rt=Date.parse(remote.updatedAt||'')||0;if(lt>rt+500)return local;return remote;}
function applyState(next,source='firebase'){if(!next)return;const ws=currentWorkspace(next),d=ws?digestWorkspace(ws):'';if(d&&d===lastAppliedDigest)return;applyingRemote=true;try{applyRemoteFn(next);lastAppliedDigest=d;scheduleCache();status(source==='remote'?'다른 기기 반영':'클라우드 불러오기','success',source==='remote'?'다른 기기의 현재 대회 변경만 반영했습니다.':'V7 대회별 저장소에 연결되었습니다.');}finally{applyingRemote=false;}}

async function writeCurrentTournament(source){if(!canWriteFn())return false;const workspace=currentWorkspace(source);if(!workspace){status('서버 데이터 보호','warning','유효한 현재 대회가 없어 자동 저장을 건너뛰었습니다.');return false;}const rt=await runtime({requireUser:true}),id=safeId(workspace.tournament.id),d=digestWorkspace(workspace);if(d&&d===lastSavedDigest)return true;const encoded=await encodeWorkspace(workspace);if(encoded.storedBytes>900000)throw new Error(`클라우드 저장 데이터가 너무 큽니다(압축 후 ${Math.round(encoded.storedBytes/1024)}KB).`);const payload={schemaVersion:7,id,name:workspace.tournament.name,division:workspace.tournament.division||'',createdAt:workspace.tournament.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString(),revision:api.increment(1),workspaceJson:encoded.data,workspaceEncoding:encoded.encoding,workspaceOriginalBytes:encoded.originalBytes,workspaceStoredBytes:encoded.storedBytes,workspaceDigest:d,lastWriterUid:rt.user.uid,lastWriterEmail:rt.user.email||'',serverUpdatedAt:api.serverTimestamp()};const batch=api.writeBatch(db);batch.set(tournamentRef(id),payload,{merge:true});batch.set(roomRef(),{schemaVersion:7,roomId:ROOM_ID,revision:api.increment(1),lastWriterUid:rt.user.uid,lastWriterEmail:rt.user.email||'',serverUpdatedAt:api.serverTimestamp()},{merge:true});await batch.commit();lastSavedDigest=d;lastWriterUid=rt.user.uid;try{localStorage.setItem(ACTIVE_TOURNAMENT_KEY,id);}catch{}scheduleCache();return true;}
async function flush(){if(pushInFlight||!dirtyGeneration||!canWriteFn())return;const generation=dirtyGeneration;dirtyGeneration=0;pushInFlight=true;try{await ensureDb();const saved=await writeCurrentTournament(getStateFn());if(saved)status('클라우드 저장 완료','success','변경된 현재 대회 문서만 저장했습니다.');}catch(error){dirtyGeneration=Math.max(dirtyGeneration,generation);status('클라우드 저장 실패','error',error?.message||String(error));}finally{pushInFlight=false;if(dirtyGeneration){clearTimeout(saveTimer);saveTimer=setTimeout(flush,500);}}}
function schedule(){if(applyingRemote)return;const state=getStateFn();if(!activeIdOf(state)||!isRealTournament(state))return;dirtyGeneration++;clearTimeout(saveTimer);saveTimer=setTimeout(flush,SAVE_DEBOUNCE);scheduleCache();status('저장 대기','info','입력이 끝난 뒤 현재 대회만 백그라운드 저장합니다.');}
function onSaved(){schedule();}
async function handleRoomSnapshot(snap){if(!snap.exists())return;const room=snap.data()||{},rt=await runtime(),writer=String(room.lastWriterUid||''),revision=Number(room.revision||0);if(writer&&rt?.user?.uid&&writer===rt.user.uid){lastKnownRoomRevision=Math.max(lastKnownRoomRevision,revision);return;}if(revision&&revision<=lastKnownRoomRevision)return;lastKnownRoomRevision=Math.max(lastKnownRoomRevision,revision);const current=getStateFn(),targetId=activeIdOf(current);if(!targetId)return;try{const registry=current?.multiTournament?.tournaments||[],bundle=await readOneTournament(targetId,registry);if(bundle)applyState(bundle.state,'remote');}catch(error){status('다른 기기 반영 실패','warning',error?.message||String(error));}}

export function startStateSync({getState,applyRemoteState,onStatus,canWrite}={}){getStateFn=getState||getStateFn;applyRemoteFn=applyRemoteState||applyRemoteFn;statusFn=onStatus||statusFn;canWriteFn=canWrite||canWriteFn;window.addEventListener('230match:state-saved',onSaved);const cfg=saveSyncSettings(getSyncSettings());if(cfg.enabled)connectCloudSync().catch(e=>status('클라우드 연결 실패','warning',e?.message||String(e)));}
export async function connectCloudSync(){disconnectCloudSync(false);await ensureDb();const remoteBundle=await readInitialBundle();let requested='';try{requested=String(localStorage.getItem(ACTIVE_TOURNAMENT_KEY)||remoteBundle?.state?.multiTournament?.activeTournamentId||'');}catch{requested=String(remoteBundle?.state?.multiTournament?.activeTournamentId||'');}const cached=await readCachedState(requested),chosen=chooseInitial(cached,remoteBundle?.state||null);if(chosen){applyState(chosen,cached&&chosen===cached?'cache':'firebase');if(cached&&chosen===cached&&canWriteFn())schedule();}unsubscribeRoom=api.onSnapshot(roomRef(),snap=>{void handleRoomSnapshot(snap);},e=>status('실시간 연결 오류','warning',e?.message||String(e)));status('실시간 연결','success','대회 선택은 이 기기에만 유지되고 현재 대회 데이터만 실시간 반영됩니다.');return true;}
export async function loadTournamentNow(tournamentId,registry=[]){await ensureDb();const bundle=await readOneTournament(tournamentId,registry);if(bundle?.state){try{localStorage.setItem(ACTIVE_TOURNAMENT_KEY,String(tournamentId));}catch{}}return bundle;}
export function disconnectCloudSync(show=true){clearTimeout(saveTimer);clearTimeout(cacheTimer);saveTimer=cacheTimer=null;dirtyGeneration=0;if(unsubscribeRoom)unsubscribeRoom();unsubscribeRoom=null;db=null;if(show)status('클라우드 연결 해제','info','로컬 화면은 유지됩니다.');}
export async function prepareCriticalCloudWrite(){clearTimeout(saveTimer);saveTimer=null;const started=Date.now();while(pushInFlight&&Date.now()-started<12000)await new Promise(r=>setTimeout(r,80));if(pushInFlight)throw new Error('이전 서버 저장이 아직 끝나지 않았습니다.');return true;}
export async function pushStateNow(state=getStateFn()){if(!canWriteFn())throw new Error('관리자 또는 진행자만 클라우드에 저장할 수 있습니다.');await prepareCriticalCloudWrite();await ensureDb();pushInFlight=true;try{const saved=await writeCurrentTournament(state);if(!saved)throw new Error('유효한 현재 대회가 없어 저장하지 않았습니다.');dirtyGeneration=0;status('클라우드 저장 완료','success','현재 대회 문서 하나만 저장했습니다.');return true;}finally{pushInFlight=false;}}
export async function pullStateNow(){await ensureDb();return (await readInitialBundle())?.state||null;}
export async function resolveConflictWithRemote(){const state=await pullStateNow();if(state)applyState(state,'remote');return Boolean(state);}
export async function forcePushLocal(state=getStateFn()){return pushStateNow(state);}
export function getSyncConflict(){return{active:false,revision:lastKnownRoomRevision,remote:null};}
export async function testCloudConnection(){await ensureDb();const room=await api.getDoc(roomRef()),docs=await api.getDocs(tournamentsCollection());return{ok:true,roomId:ROOM_ID,collection:COLLECTION,exists:room.exists(),mode:canWriteFn()?'read-write':'read-only',online:navigator.onLine,pending:Boolean(dirtyGeneration),writing:pushInFlight,revision:Number(room.data()?.revision||0),conflict:false,schemaVersion:7,tournamentCount:docs.size,listenerMode:'single-room-listener-local-selection'};}
export async function deleteTournamentNow(tournamentId){if(!canWriteFn())throw new Error('관리자만 대회를 삭제할 수 있습니다.');await prepareCriticalCloudWrite();await ensureDb();const id=safeId(tournamentId);await api.deleteDoc(tournamentRef(id));const remaining=await api.getDocs(tournamentsCollection());const nextId=remaining.docs.find(d=>d.id!==id)?.id||'';await api.setDoc(roomRef(),{revision:api.increment(1),lastWriterUid:(await runtime({requireUser:true})).user.uid,serverUpdatedAt:api.serverTimestamp()},{merge:true});try{if(String(localStorage.getItem(ACTIVE_TOURNAMENT_KEY)||'')===id){if(nextId)localStorage.setItem(ACTIVE_TOURNAMENT_KEY,nextId);else localStorage.removeItem(ACTIVE_TOURNAMENT_KEY);}}catch{}return true;}
