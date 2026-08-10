import { getAuthRuntime } from './auth-engine.js?v=3565';
import { normalizeState } from './store-v6200.js?v=6200';

const SETTINGS_KEY='230match-v7-sync-settings';
const FIREBASE_APP_URL='https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
const FIRESTORE_URL='https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
const DEFAULT_FIREBASE={apiKey:'AIzaSyAbc17RiYyxCqgbMBkxkMoiRdNTmy2q65w',authDomain:'open-match-manager.firebaseapp.com',projectId:'open-match-manager',storageBucket:'open-match-manager.firebasestorage.app',messagingSenderId:'195671806262',appId:'1:195671806262:web:89691574839266cea1a397'};

// 4.5 core architecture
// - Keep the proven V7 collection/rules path, but stop putting the whole workspace in one Firestore document.
// - The tournament document is now a small manifest. Compressed workspace bytes are split into sibling chunk documents.
// - Autosave is debounced and runs in an idle slot. A failed save is NEVER retried every 500ms.
// - IndexedDB cache stores only the active workspace + lightweight tournament registry, not every tournament snapshot.
const COLLECTION='matchRoomsV7';
const ROOM_ID='230match-production';
const STORAGE_MODE='chunked-workspace-v5-tournament-scoped-room';
const SAVE_DEBOUNCE=4500;
const CACHE_DEBOUNCE=60000;
const TRANSIENT_RETRY=15000;
const CHUNK_CHARS=180000;
const CACHE_DB_NAME='230match-v7-runtime-cache';
const CACHE_DB_VERSION=1;
const CACHE_STORE='workspaces';

let api=null,db=null;
let getStateFn=()=>null,applyRemoteFn=()=>{},statusFn=()=>{},canWriteFn=()=>false,accessModeFn=()=> 'viewer';
let unsubscribeRoom=null,saveTimer=null,cacheTimer=null,pushInFlight=false,applyingRemote=false;
const CLIENT_ID=sessionStorage.getItem('230match-sync-client-id')||((crypto?.randomUUID?.()||('client-'+Date.now()+'-'+Math.random().toString(36).slice(2))));
sessionStorage.setItem('230match-sync-client-id',CLIENT_ID);
let dirtyGeneration=0,dirtyBaseRevision=0,lastSavedDigest='',lastSavedPublicDigest='',lastAppliedDigest='',lastKnownRoomRevision=0,lastKnownPublicRevision=0,lastWriterUid='',lastWriterClientId='';
let syncConflict=null;
let cacheDbPromise=null,autoSaveBlockedUntil=0;
const knownChunkIds=new Map();

function status(label,level='info',detail='',extra={}){statusFn({label,level,detail,schemaVersion:8,roomId:ROOM_ID,storageMode:STORAGE_MODE,...extra});}
function safeId(value,fallback='tournament'){const out=String(value||'').trim().replace(/[^a-zA-Z0-9_-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,120);return out||`${fallback}-${crypto.randomUUID()}`;}
function chunkId(owner,index){return `${safeId(owner).slice(0,90)}--ws--${String(index).padStart(3,'0')}`;}
function activeIdOf(state){return String(state?.multiTournament?.activeTournamentId||state?.tournament?.id||'').trim();}
function isRealTournament(workspace){const name=String(workspace?.tournament?.name||'').trim(),id=String(workspace?.tournament?.id||'').trim();return Boolean(id&&name&&!['대회 준비 중','이름 없는 대회','등록된 운영 대회 없음'].includes(name));}
function clone(value){return structuredClone(value);}
function compactCloneWithoutRegistry(source){if(!source||typeof source!=='object')return null;const shallow={...source};delete shallow.multiTournament;return shallow;}
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
  if(!source||typeof source!=='object')return null;
  const id=activeIdOf(source);if(!id)return null;
  const shallow=compactCloneWithoutRegistry(source);if(!shallow)return null;
  shallow.tournament={...(source.tournament||{}),id};
  return isRealTournament(shallow)?shallow:null;
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
function lightweightRegistry(source,activeId,activeWorkspace){return (source?.multiTournament?.tournaments||[]).map(r=>({id:r.id,name:r.name||r.snapshot?.tournament?.name||'',division:r.division||r.snapshot?.tournament?.division||'',createdAt:r.createdAt||'',updatedAt:r.updatedAt||'',snapshot:String(r.id)===String(activeId)?activeWorkspace:undefined}));}
async function putCacheState(source){try{const ws=currentWorkspace(source);if(!ws)return false;const id=safeId(ws.tournament.id),dbx=await openCacheDb();const cached={...ws,multiTournament:{activeTournamentId:id,tournaments:lightweightRegistry(source,id,ws),noActiveTournament:false}};await new Promise((resolve,reject)=>{const tx=dbx.transaction(CACHE_STORE,'readwrite');tx.objectStore(CACHE_STORE).put({id,updatedAt:source.updatedAt||new Date().toISOString(),workspace:cached});tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});return true;}catch(error){console.warn('[230MATCH] idle cache skipped',error);return false;}}
function scheduleCache(){clearTimeout(cacheTimer);cacheTimer=setTimeout(()=>{const run=()=>putCacheState(getStateFn());if('requestIdleCallback'in window)requestIdleCallback(run,{timeout:2000});else setTimeout(run,0);},CACHE_DEBOUNCE);}
async function readCachedState(id=''){try{const dbx=await openCacheDb();return await new Promise((resolve,reject)=>{const tx=dbx.transaction(CACHE_STORE,'readonly'),store=tx.objectStore(CACHE_STORE);if(id){const req=store.get(safeId(id));req.onsuccess=()=>resolve(req.result?.workspace||null);req.onerror=()=>reject(req.error);}else{const req=store.getAll();req.onsuccess=()=>resolve((req.result||[]).sort((a,b)=>String(b.updatedAt||'').localeCompare(String(a.updatedAt||'')))[0]?.workspace||null);req.onerror=()=>reject(req.error);}});}catch{return null;}}

function bytesToBase64(bytes){let binary='';const chunk=0x8000;for(let i=0;i<bytes.length;i+=chunk)binary+=String.fromCharCode(...bytes.subarray(i,i+chunk));return btoa(binary);}
function base64ToBytes(text){const binary=atob(String(text||'')),bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);return bytes;}
async function gzipText(text){if(typeof CompressionStream!=='function')return null;const stream=new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));return new Uint8Array(await new Response(stream).arrayBuffer());}
async function gunzipText(bytes){if(typeof DecompressionStream!=='function')throw new Error('이 브라우저는 압축된 대회 데이터 읽기를 지원하지 않습니다.');const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));return await new Response(stream).text();}
let encodeWorker=null,encodeSeq=0;const encodePending=new Map();
function ensureEncodeWorker(){
  if(encodeWorker)return encodeWorker;
  const code=`
    function hashString(text){let h=2166136261;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619);}return(h>>>0).toString(36)}
    function bytesToBase64(bytes){let binary='';const chunk=0x8000;for(let i=0;i<bytes.length;i+=chunk)binary+=String.fromCharCode(...bytes.subarray(i,i+chunk));return btoa(binary)}
    function publicSlice(w){
      const portal=w?.portal||{};
      return {
        tournament:w?.tournament||{},
        settings:w?.settings||{},
        teams:w?.teams||[],
        prelim:w?.prelim||{},
        draw:w?.draw||{},
        drawMeta:{locked:Boolean(w?.drawMeta?.locked),createdAt:w?.drawMeta?.createdAt||null},
        courts:w?.courts||[],
        sharedQueue:w?.sharedQueue||[],
        venueQueues:w?.venueQueues||{},
        completion:w?.completion||{},
        mainDrawLifecycle:w?.mainDrawLifecycle||{},
        multiDivision:w?.multiDivision||{},
        portal:{guide:portal.guide||{},posts:portal.posts||[],applications:portal.applications||[]}
      };
    }
    self.onmessage=async e=>{const {id,workspace}=e.data||{};try{const digestObj={...workspace};delete digestObj.updatedAt;const digest=hashString(JSON.stringify(digestObj));const publicDigest=hashString(JSON.stringify(publicSlice(workspace)));const json=JSON.stringify(workspace);let data=json,encoding='json-v1';if(typeof CompressionStream==='function'){const stream=new Blob([json]).stream().pipeThrough(new CompressionStream('gzip'));const bytes=new Uint8Array(await new Response(stream).arrayBuffer());const base64=bytesToBase64(bytes);if(base64.length<json.length){data=base64;encoding='gzip-base64-v1';}}self.postMessage({id,ok:true,data,encoding,digest,publicDigest,originalBytes:new Blob([json]).size,storedBytes:new Blob([data]).size});}catch(error){self.postMessage({id,ok:false,error:error?.message||String(error)});}};`;
  encodeWorker=new Worker(URL.createObjectURL(new Blob([code],{type:'text/javascript'})));
  encodeWorker.onmessage=e=>{const msg=e.data||{},pending=encodePending.get(msg.id);if(!pending)return;encodePending.delete(msg.id);msg.ok?pending.resolve(msg):pending.reject(new Error(msg.error||'대회 데이터 직렬화 실패'));};
  encodeWorker.onerror=e=>{for(const [,pending] of encodePending){pending.reject(new Error(e.message||'백그라운드 저장 작업 실패'));}encodePending.clear();try{encodeWorker.terminate()}catch{}encodeWorker=null;};
  return encodeWorker;
}
async function encodeWorkspace(workspace){const id=++encodeSeq;const worker=ensureEncodeWorker();return await new Promise((resolve,reject)=>{encodePending.set(id,{resolve,reject});worker.postMessage({id,workspace});});}
async function decodePayload(data,encoding){return encoding==='gzip-base64-v1'?JSON.parse(await gunzipText(base64ToBytes(data))):JSON.parse(data);}
async function decodeWorkspace(raw){
  if(raw?.workspace&&typeof raw.workspace==='object')return clone(raw.workspace);
  if(raw?.storageMode===STORAGE_MODE&&Array.isArray(raw.workspaceChunks)&&raw.workspaceChunks.length){
    try{
      const snaps=await Promise.all(raw.workspaceChunks.map(id=>api.getDoc(tournamentRef(id))));
      const rows=snaps.map((snap,i)=>({snap,i})).filter(x=>x.snap.exists()).sort((a,b)=>a.i-b.i);
      if(rows.length!==raw.workspaceChunks.length)throw new Error(`대회 데이터 조각 ${raw.workspaceChunks.length}개 중 ${rows.length}개만 확인됩니다.`);
      const data=rows.map(x=>String(x.snap.data()?.data||'')).join('');
      return await decodePayload(data,raw.workspaceEncoding||'json-v1');
    }catch(error){console.warn('[230MATCH] chunked workspace decode failed',error);return null;}
  }
  if(typeof raw?.workspaceJson!=='string')return null;
  try{return await decodePayload(raw.workspaceJson,raw.workspaceEncoding||'json-v1');}catch(error){console.warn('[230MATCH] legacy workspace decode failed',error);return null;}
}
function metaFromRaw(id,raw,workspace=null){const guide=workspace?.portal?.guide||raw?.guide||{};return{id,name:raw?.name||workspace?.tournament?.name||'',division:raw?.division||workspace?.tournament?.division||'',createdAt:raw?.createdAt||workspace?.tournament?.createdAt||'',updatedAt:raw?.updatedAt||workspace?.updatedAt||'',date:raw?.date||guide?.date||'',venue:raw?.venue||guide?.venue||'',guide:{date:raw?.date||guide?.date||'',venue:raw?.venue||guide?.venue||''},status:raw?.status||'',completedAt:raw?.completedAt||workspace?.completion?.completedAt||workspace?.tournament?.completedAt||'',active:Number(raw?.active||0),reserve:Number(raw?.reserve||0),prelimCompleted:Number(raw?.prelimCompleted||0),prelimTotal:Number(raw?.prelimTotal||0),mainCompleted:Number(raw?.mainCompleted||0),mainTotal:Number(raw?.mainTotal||0),snapshot:workspace?clone(workspace):undefined};}
function parentRowsFromSnaps(tournamentSnaps){return tournamentSnaps.docs.map(s=>({id:s.id,raw:s.data()})).filter(x=>x.id&&x.raw?.name&&x.raw?.docType!=='workspace-chunk');}
async function loadParentRows(){
  try{
    const q=api.query(tournamentsCollection(),api.where('docType','==','tournament'));
    const snap=await api.getDocs(q);const rows=parentRowsFromSnaps(snap);if(rows.length)return rows;
  }catch(error){console.warn('[230MATCH] parent-only query fallback',error);}
  return parentRowsFromSnaps(await api.getDocs(tournamentsCollection()));
}
async function readInitialBundle(){
  const [roomSnap,rows]=await Promise.all([api.getDoc(roomRef()),loadParentRows()]);const room=roomSnap.exists()?roomSnap.data():{};if(!rows.length)return null;
  rows.sort((a,b)=>String(b.raw?.updatedAt||'').localeCompare(String(a.raw?.updatedAt||'')));const requested=String(localStorage.getItem('230match-v7-active-tournament')||room.activeTournamentId||'');const activeRow=rows.find(x=>x.id===requested)||rows[0];
  const activeDecoded=await decodeWorkspace(activeRow.raw);if(!activeDecoded)return null;activeDecoded.tournament={...(activeDecoded.tournament||{}),id:activeRow.id};if(Array.isArray(activeRow.raw.workspaceChunks))knownChunkIds.set(activeRow.id,[...activeRow.raw.workspaceChunks]);
  const meta=rows.map(row=>metaFromRaw(row.id,row.raw,null));
  const state=normalizeState(clone(activeDecoded));state.multiTournament={activeTournamentId:activeRow.id,tournaments:meta,noActiveTournament:false};localStorage.setItem('230match-v7-active-tournament',activeRow.id);lastKnownRoomRevision=Number(room.revision||0);lastKnownPublicRevision=Number(room.publicRevision||room.revision||0);lastWriterUid=String(room.lastWriterUid||'');lastWriterClientId=String(room.lastWriterClientId||'');lastSavedDigest=String(activeRow.raw.workspaceDigest||'');lastSavedPublicDigest=String(activeRow.raw.publicDigest||'');dirtyBaseRevision=lastKnownRoomRevision;return{state,room,count:meta.length};
}
async function readOneTournament(id,registry=[]){const snap=await api.getDoc(tournamentRef(id));if(!snap.exists())return null;const raw=snap.data(),decoded=await decodeWorkspace(raw);if(!decoded)return null;if(Array.isArray(raw.workspaceChunks))knownChunkIds.set(snap.id,[...raw.workspaceChunks]);decoded.tournament={...(decoded.tournament||{}),id:snap.id};const records=(registry||[]).map(r=>r.id===snap.id?{...r,...metaFromRaw(snap.id,raw,decoded)}:r);if(!records.some(r=>r.id===snap.id))records.push(metaFromRaw(snap.id,raw,decoded));const state=normalizeState(clone(decoded));state.multiTournament={activeTournamentId:snap.id,tournaments:records,noActiveTournament:false};return{state,raw};}

function chooseInitial(local,remote){if(!local)return remote;if(!remote)return local;const lid=activeIdOf(local),rid=activeIdOf(remote);if(lid!==rid)return remote;const lt=Date.parse(local.updatedAt||'')||0,rt=Date.parse(remote.updatedAt||'')||0;if(lt>rt+500)return local;return remote;}
function mergeRemoteRegistry(local,remote){if(!local||!remote)return local;const next=local;const remoteRows=remote.multiTournament?.tournaments||[];const byId=new Map(remoteRows.map(r=>[String(r.id),r]));next.multiTournament=next.multiTournament||{activeTournamentId:activeIdOf(next),tournaments:[],noActiveTournament:false};next.multiTournament.tournaments=(next.multiTournament.tournaments||[]).map(r=>byId.get(String(r.id))||r);for(const r of remoteRows)if(!next.multiTournament.tournaments.some(x=>String(x.id)===String(r.id)))next.multiTournament.tournaments.push(r);return next;}
function applyState(next,source='firebase'){if(!next)return;const ws=currentWorkspace(next),d=ws?digestWorkspace(ws):'';if(d&&d===lastAppliedDigest)return;applyingRemote=true;try{applyRemoteFn(next);lastAppliedDigest=d;scheduleCache();status(source==='remote'?'다른 기기 반영':'클라우드 불러오기','success',source==='remote'?'다른 기기의 현재 대회 변경만 반영했습니다.':'대회별 분할 저장소에 연결되었습니다.');}finally{applyingRemote=false;}}

async function previousChunksFor(id){if(knownChunkIds.has(id))return knownChunkIds.get(id);try{const snap=await api.getDoc(tournamentRef(id));const rows=Array.isArray(snap.data()?.workspaceChunks)?snap.data().workspaceChunks:[];knownChunkIds.set(id,[...rows]);return rows;}catch{return[];}}
function splitPayload(data){const out=[];for(let i=0;i<data.length;i+=CHUNK_CHARS)out.push(data.slice(i,i+CHUNK_CHARS));return out.length?out:[''];}
async function writeCurrentTournament(source,{force=false}={}){
  if(!canWriteFn())return false;
  const workspace=currentWorkspace(source);if(!workspace){status('서버 데이터 보호','warning','유효한 현재 대회가 없어 자동 저장을 건너뛰었습니다.');return false;}
  const rt=await runtime({requireUser:true}),id=safeId(workspace.tournament.id);
  // 동시 운영자 보호: 로컬 편집이 시작된 뒤 다른 브라우저/기기가 먼저 저장했다면
  // 전체 workspace를 덮어쓰지 않고 저장을 중단한다.
  if(!force){
    const roomSnap=await api.getDoc(roomRef());
    const room=roomSnap.exists()?(roomSnap.data()||{}):{};
    const remoteRevision=Number(room.revision||0);
    const remoteClientId=String(room.lastWriterClientId||'');
    const remoteTournamentId=String(room.lastTournamentId||room.activeTournamentId||'');
    if(dirtyBaseRevision>0 && remoteRevision>dirtyBaseRevision && remoteClientId && remoteClientId!==CLIENT_ID && (!remoteTournamentId||remoteTournamentId===id)){
      syncConflict={
        active:true,
        localBaseRevision:dirtyBaseRevision,
        remoteRevision,
        remoteWriterUid:String(room.lastWriterUid||''),
        remoteWriterEmail:String(room.lastWriterEmail||''),
        remoteClientId,
        detectedAt:new Date().toISOString()
      };
      throw new Error('다른 진행자가 먼저 저장한 변경이 감지되어 자동 저장을 중단했습니다. 최신 서버 데이터를 확인한 뒤 다시 저장해 주세요.');
    }
  }
  const encoded=await encodeWorkspace(workspace),d=encoded.digest||'',publicDigest=encoded.publicDigest||'';if(d&&d===lastSavedDigest)return true;const publicChanged=!lastSavedPublicDigest||publicDigest!==lastSavedPublicDigest;
  const parts=splitPayload(encoded.data),newIds=parts.map((_,i)=>chunkId(id,i)),oldIds=await previousChunksFor(id);
  if(parts.length>450)throw new Error('대회 데이터 조각 수가 비정상적으로 많아 안전을 위해 저장을 중단했습니다.');
  const batch=api.writeBatch(db),stamp=new Date().toISOString();
  parts.forEach((data,index)=>batch.set(tournamentRef(newIds[index]),{docType:'workspace-chunk',schemaVersion:8,storageMode:STORAGE_MODE,ownerTournamentId:id,index,count:parts.length,data,updatedAt:stamp,serverUpdatedAt:api.serverTimestamp()}));
  oldIds.filter(old=>!newIds.includes(old)).forEach(old=>batch.delete(tournamentRef(old)));
  batch.set(tournamentRef(id),{
    schemaVersion:8,docType:'tournament',storageMode:STORAGE_MODE,id,name:workspace.tournament.name,division:workspace.tournament.division||'',createdAt:workspace.tournament.createdAt||stamp,updatedAt:stamp,revision:api.increment(1),
    date:workspace.portal?.guide?.date||'',venue:workspace.portal?.guide?.venue||'',completedAt:workspace.completion?.completedAt||workspace.tournament?.completedAt||'',status:(workspace.completion?.completedAt||workspace.tournament?.completedAt)?'completed':((workspace.prelim?.matches||[]).some(x=>x?.status&&x.status!=='waiting')||Object.values(workspace.draw?.rounds||{}).flat().some(x=>x?.status&&x.status!=='waiting'))?'ongoing':'recruiting',active:(workspace.teams||[]).filter(x=>x?.status!=='reserve').length,reserve:(workspace.teams||[]).filter(x=>x?.status==='reserve').length,prelimCompleted:(workspace.prelim?.matches||[]).filter(x=>x?.status==='completed').length,prelimTotal:(workspace.prelim?.matches||[]).length,mainCompleted:Object.values(workspace.draw?.rounds||{}).flat().filter(x=>x?.status==='completed').length,mainTotal:Object.values(workspace.draw?.rounds||{}).flat().filter(Boolean).length,
    workspaceChunks:newIds,workspaceEncoding:encoded.encoding,workspaceOriginalBytes:encoded.originalBytes,workspaceStoredBytes:encoded.storedBytes,workspaceDigest:d,publicDigest,
    workspaceJson:api.deleteField(),workspace:api.deleteField(),lastWriterUid:rt.user.uid,lastWriterEmail:rt.user.email||'',lastWriterClientId:CLIENT_ID,serverUpdatedAt:api.serverTimestamp()
  },{merge:true});
  const roomUpdate={schemaVersion:8,roomId:ROOM_ID,activeTournamentId:id,lastTournamentId:id,revision:api.increment(1),lastWriterUid:rt.user.uid,lastWriterEmail:rt.user.email||'',lastWriterClientId:CLIENT_ID,serverUpdatedAt:api.serverTimestamp()};
  if(publicChanged)roomUpdate.publicRevision=api.increment(1);
  batch.set(roomRef(),roomUpdate,{merge:true});
  await batch.commit();knownChunkIds.set(id,newIds);lastSavedDigest=d;lastKnownRoomRevision++;dirtyBaseRevision=lastKnownRoomRevision;syncConflict=null;if(publicChanged){lastSavedPublicDigest=publicDigest;lastKnownPublicRevision++;}lastWriterUid=rt.user.uid;lastWriterClientId=CLIENT_ID;localStorage.setItem('230match-v7-active-tournament',id);scheduleCache();return true;
}
function transientError(error){const text=String(error?.code||'')+' '+String(error?.message||'');return /unavailable|network|offline|deadline|aborted|internal/i.test(text);}
function idleCall(fn,timeout=1600){if('requestIdleCallback'in window)return requestIdleCallback(()=>fn(),{timeout});return setTimeout(fn,0);}
function queueFlush(delay=SAVE_DEBOUNCE){clearTimeout(saveTimer);saveTimer=setTimeout(()=>idleCall(()=>void flush(),1800),delay);}
async function flush(){
  if(pushInFlight||!dirtyGeneration||!canWriteFn())return;if(Date.now()<autoSaveBlockedUntil){queueFlush(Math.max(1000,autoSaveBlockedUntil-Date.now()));return;}
  const generation=dirtyGeneration;dirtyGeneration=0;pushInFlight=true;
  try{await ensureDb();const saved=await writeCurrentTournament(getStateFn());if(saved)status('클라우드 저장 완료','success','현재 대회를 백그라운드 직렬화 후 안전 조각으로 저장했습니다.');}
  catch(error){dirtyGeneration=Math.max(dirtyGeneration,generation);status('클라우드 저장 실패','error',error?.message||String(error));if(transientError(error)){autoSaveBlockedUntil=Date.now()+TRANSIENT_RETRY;queueFlush(TRANSIENT_RETRY);}else{autoSaveBlockedUntil=Date.now()+30000;/* permanent errors wait for a new edit/manual save; never tight-loop */}}
  finally{pushInFlight=false;}
}
function schedule(){if(applyingRemote)return;const state=getStateFn();if(!activeIdOf(state)||!isRealTournament(state))return;if(!dirtyGeneration)dirtyBaseRevision=lastKnownRoomRevision;dirtyGeneration++;queueFlush(SAVE_DEBOUNCE);status('저장 대기','info','입력이 끝난 뒤 유휴 시간에 현재 대회만 저장합니다.');}
function onSaved(){schedule();}
async function handleRoomSnapshot(snap){
  if(!snap.exists())return;
  const room=snap.data()||{};
  const rt=await runtime();
  const viewer=accessModeFn()==='viewer';
  const revision=Number(room.revision||0);
  const publicRevision=Number(room.publicRevision||revision||0);
  const relevantRevision=viewer?publicRevision:revision;
  const knownRevision=viewer?lastKnownPublicRevision:lastKnownRoomRevision;
  if(relevantRevision&&relevantRevision<=knownRevision)return;

  const current=getStateFn();
  const selectedId=String(activeIdOf(current)||localStorage.getItem('230match-v7-active-tournament')||'');
  const changedTournamentId=String(room.lastTournamentId||room.activeTournamentId||'');
  const remoteClientId=String(room.lastWriterClientId||'');
  const writer=String(room.lastWriterUid||'');

  // 다른 대회의 저장은 현재 사용자가 선택한 대회를 바꾸거나 다시 불러오게 하지 않는다.
  if(selectedId&&changedTournamentId&&selectedId!==changedTournamentId){
    if(viewer)lastKnownPublicRevision=Math.max(lastKnownPublicRevision,relevantRevision);
    else lastKnownRoomRevision=Math.max(lastKnownRoomRevision,relevantRevision);
    return;
  }

  // 같은 대회에서 로컬 미저장 편집과 다른 운영자의 저장이 겹치면 자동 덮어쓰기를 막는다.
  if(!viewer&&dirtyGeneration>0&&remoteClientId&&remoteClientId!==CLIENT_ID){
    syncConflict={
      active:true,
      localBaseRevision:dirtyBaseRevision,
      remoteRevision:revision,
      remoteWriterUid:writer,
      remoteWriterEmail:String(room.lastWriterEmail||''),
      remoteClientId,
      detectedAt:new Date().toISOString()
    };
    status('동시 편집 감지','warning','같은 대회에서 다른 진행자의 저장이 감지되었습니다. 현재 입력을 자동으로 덮어쓰지 않았습니다.');
    return;
  }

  if(viewer)lastKnownPublicRevision=Math.max(lastKnownPublicRevision,relevantRevision);
  else lastKnownRoomRevision=Math.max(lastKnownRoomRevision,relevantRevision);

  if(remoteClientId===CLIENT_ID&&!viewer)return;
  if(!selectedId)return;

  try{
    const registry=current?.multiTournament?.tournaments||[];
    const bundle=await readOneTournament(selectedId,registry);
    if(bundle)applyState(bundle.state,'remote');
  }catch(error){
    status('다른 기기 반영 실패','warning',error?.message||String(error));
  }
}

export function startStateSync({getState,applyRemoteState,onStatus,canWrite,accessMode}={}){getStateFn=getState||getStateFn;applyRemoteFn=applyRemoteState||applyRemoteFn;statusFn=onStatus||statusFn;canWriteFn=canWrite||canWriteFn;accessModeFn=accessMode||accessModeFn;window.addEventListener('230match:state-saved',onSaved);const cfg=saveSyncSettings(getSyncSettings());if(cfg.enabled)connectCloudSync().catch(e=>status('클라우드 연결 실패','warning',e?.message||String(e)));}
export async function connectCloudSync(){disconnectCloudSync(false);await ensureDb();const remoteBundle=await readInitialBundle(),requested=String(localStorage.getItem('230match-v7-active-tournament')||remoteBundle?.state?.multiTournament?.activeTournamentId||''),cached=await readCachedState(requested);let chosen=chooseInitial(cached,remoteBundle?.state||null);if(cached&&chosen===cached&&remoteBundle?.state)chosen=mergeRemoteRegistry(chosen,remoteBundle.state);if(chosen){applyState(chosen,cached&&chosen===cached?'cache':'firebase');if(cached&&chosen===cached&&canWriteFn())schedule();}unsubscribeRoom=api.onSnapshot(roomRef(),snap=>{void handleRoomSnapshot(snap);},e=>status('실시간 연결 오류','warning',e?.message||String(e)));status('실시간 연결','success',accessModeFn()==='viewer'?'일반 회원 경량 모드: 현재 대회의 공개 변화만 실시간 반영하고 관리자 전용 변경·과거 대회는 다시 읽지 않습니다.':'운영자 모드: 현재 대회 운영 변경을 실시간 반영하고 과거 대회는 지연 로딩합니다.');return true;}
export function disconnectCloudSync(show=true){clearTimeout(saveTimer);clearTimeout(cacheTimer);saveTimer=cacheTimer=null;dirtyGeneration=0;dirtyBaseRevision=lastKnownRoomRevision;if(unsubscribeRoom)unsubscribeRoom();unsubscribeRoom=null;db=null;if(show)status('클라우드 연결 해제','info','로컬 화면은 유지됩니다.');}
export async function prepareCriticalCloudWrite(){clearTimeout(saveTimer);saveTimer=null;autoSaveBlockedUntil=0;const started=Date.now();while(pushInFlight&&Date.now()-started<12000)await new Promise(r=>setTimeout(r,80));if(pushInFlight)throw new Error('이전 서버 저장이 아직 끝나지 않았습니다.');return true;}
export async function pushStateNow(state=getStateFn()){if(!canWriteFn())throw new Error('관리자 또는 진행자만 클라우드에 저장할 수 있습니다.');await prepareCriticalCloudWrite();await ensureDb();pushInFlight=true;try{const saved=await writeCurrentTournament(state);if(!saved)throw new Error('유효한 현재 대회가 없어 저장하지 않았습니다.');dirtyGeneration=0;status('클라우드 저장 완료','success','현재 대회를 Firestore 안전 조각으로 저장했습니다.');return true;}finally{pushInFlight=false;}}
export async function loadTournamentNow(tournamentId,registry=[]){await ensureDb();const bundle=await readOneTournament(tournamentId,registry);return bundle;}
export async function pullStateNow(){await ensureDb();return (await readInitialBundle())?.state||null;}
export async function resolveConflictWithRemote(){
  const state=await pullStateNow();
  if(state){dirtyGeneration=0;syncConflict=null;applyState(state,'remote');dirtyBaseRevision=lastKnownRoomRevision;}
  return Boolean(state);
}
export async function forcePushLocal(state=getStateFn()){
  if(!canWriteFn())throw new Error('관리자 또는 진행자만 클라우드에 저장할 수 있습니다.');
  await prepareCriticalCloudWrite();await ensureDb();pushInFlight=true;
  try{const saved=await writeCurrentTournament(state,{force:true});if(!saved)throw new Error('유효한 현재 대회가 없어 저장하지 않았습니다.');dirtyGeneration=0;syncConflict=null;return true;}
  finally{pushInFlight=false;}
}
export function getSyncConflict(){return syncConflict?{...syncConflict}:{active:false,revision:lastKnownRoomRevision,remote:null};}
export async function testCloudConnection(){await ensureDb();const room=await api.getDoc(roomRef()),parents=await loadParentRows();return{ok:true,roomId:ROOM_ID,collection:COLLECTION,exists:room.exists(),mode:canWriteFn()?'read-write':'read-only',online:navigator.onLine,pending:Boolean(dirtyGeneration),writing:pushInFlight,revision:Number(room.data()?.revision||0),conflict:Boolean(syncConflict?.active),clientId:CLIENT_ID,schemaVersion:8,tournamentCount:parents.length,listenerMode:accessModeFn()==='viewer'?'public-revision-filter':'operator-revision',storageMode:STORAGE_MODE};}
export async function deleteTournamentNow(tournamentId){if(!canWriteFn())throw new Error('관리자만 대회를 삭제할 수 있습니다.');await prepareCriticalCloudWrite();await ensureDb();const id=safeId(tournamentId),snap=await api.getDoc(tournamentRef(id)),chunks=Array.isArray(snap.data()?.workspaceChunks)?snap.data().workspaceChunks:[];const batch=api.writeBatch(db);chunks.forEach(cid=>batch.delete(tournamentRef(cid)));batch.delete(tournamentRef(id));await batch.commit();knownChunkIds.delete(id);const remaining=await api.getDocs(tournamentsCollection()),parents=parentRowsFromSnaps(remaining),nextId=parents.find(r=>r.id!==id)?.id||'';await api.setDoc(roomRef(),{activeTournamentId:nextId,revision:api.increment(1),lastWriterUid:(await runtime({requireUser:true})).user.uid,serverUpdatedAt:api.serverTimestamp()},{merge:true});return true;}
