import{getAuthRuntime}from'./auth-engine.js?v=3565';
import{normalizeState}from'./store-v5000.js?v=5000';
const SETTINGS_KEY='230match-v6-sync-settings';
const LEGACY_SETTINGS_KEYS=[];
const FIREBASE_APP_URL='https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
const FIRESTORE_URL='https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
const DEFAULT_FIREBASE={apiKey:'AIzaSyAbc17RiYyxCqgbMBkxkMoiRdNTmy2q65w',authDomain:'open-match-manager.firebaseapp.com',projectId:'open-match-manager',storageBucket:'open-match-manager.firebasestorage.app',messagingSenderId:'195671806262',appId:'1:195671806262:web:89691574839266cea1a397'};
const MANIFEST_COLLECTION='matchRoomsV6';
const DEFAULT_ROOM='230match-production';
const CLIENT_ID=sessionStorage.getItem('230match-v6-client')||crypto.randomUUID();
sessionStorage.setItem('230match-v6-client',CLIENT_ID);
let getStateFn=()=>null,applyRemoteFn=()=>{},statusFn=()=>{},canWriteFn=()=>false;
let db=null,api=null,unsubscribe=null,pollTimer=null,visibilityHandler=null,saveTimer=null,pushInFlight=false,pendingState=null,connectedRoom='',applyingRemote=false,lastDigest='',lastManifestRevision=0,lastRemoteToken='';
const SAVE_DEBOUNCE=2200,READ_ONLY_POLL_MS=45000;
function status(label,level='info',detail='',extra={}){statusFn({label,level,detail,...extra});}
function clone(v){return structuredClone(v);}
function hashString(text){let h=2166136261;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619);}return(h>>>0).toString(36);}
function digest(v){try{const c=clone(v);delete c.updatedAt;return hashString(JSON.stringify(c));}catch{return String(Date.now());}}
function safeId(value,fallback='item'){const raw=String(value||fallback).trim().replace(/[^a-zA-Z0-9_-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,120);return raw||`${fallback}-${Date.now()}`;}
function defaultSettings(){return{enabled:true,roomId:DEFAULT_ROOM,collection:MANIFEST_COLLECTION,firebaseConfigText:''};}
export function getSyncSettings(){
  try{const own=JSON.parse(localStorage.getItem(SETTINGS_KEY)||'null');if(own)return{...defaultSettings(),...own,roomId:DEFAULT_ROOM,collection:MANIFEST_COLLECTION};}catch{}
  for(const key of LEGACY_SETTINGS_KEYS){try{const old=JSON.parse(localStorage.getItem(key)||'null');if(old)return{...defaultSettings(),enabled:old.enabled!==false,firebaseConfigText:old.firebaseConfigText||''};}catch{}}
  return defaultSettings();
}
export function saveSyncSettings(settings){const next={...defaultSettings(),...(settings||{}),roomId:DEFAULT_ROOM,collection:MANIFEST_COLLECTION};localStorage.setItem(SETTINGS_KEY,JSON.stringify(next));return next;}
function parseConfig(text){if(!String(text||'').trim())return DEFAULT_FIREBASE;let cfg;try{cfg=JSON.parse(text);}catch{throw new Error('Firebase 설정 JSON 형식이 올바르지 않습니다.');}cfg={...DEFAULT_FIREBASE,...cfg};for(const k of ['apiKey','projectId','appId'])if(!cfg[k])throw new Error(`Firebase 설정에 ${k} 값이 없습니다.`);return cfg;}
async function loadFirebase(){if(api)return api;api={...(await import(FIREBASE_APP_URL)),...(await import(FIRESTORE_URL))};return api;}
async function runtime({requireUser=false}={}){const rt=await getAuthRuntime();if(requireUser&&!rt?.user)throw new Error('클라우드 저장은 로그인 후 사용할 수 있습니다.');return rt||{};}
function activeTournamentId(state){const raw=state?.multiTournament?.activeTournamentId||state?.tournament?.id||'';return raw?safeId(raw,'tournament'):'';}
function normalizeRecords(input){
  const state=normalizeState(clone(input||{}));
  const registry=Array.isArray(state.multiTournament?.tournaments)?state.multiTournament.tournaments:[];
  const activeId=activeTournamentId(state);
  const rows=[];const found=new Set();
  const validWorkspace=w=>Boolean(w&&typeof w==='object'&&String(w.tournament?.id||'').trim()&&String(w.tournament?.name||'').trim());
  for(const r of registry){
    const id=safeId(r?.id,'tournament');if(found.has(id))continue;
    let workspace=id===activeId?clone(state):(r?.snapshot?clone(r.snapshot):null);
    if(!workspace)continue;normalizeState(workspace);delete workspace.multiTournament;workspace.tournament.id=id;
    if(!validWorkspace(workspace))continue;
    rows.push({id,name:workspace.tournament.name,division:workspace.tournament.division||'',updatedAt:r?.updatedAt||workspace.updatedAt||new Date().toISOString(),createdAt:r?.createdAt||workspace.tournament.createdAt||new Date().toISOString(),workspace});found.add(id);
  }
  if(activeId&&!found.has(activeId)){const workspace=clone(state);delete workspace.multiTournament;workspace.tournament.id=activeId;if(validWorkspace(workspace))rows.push({id:activeId,name:workspace.tournament.name,division:workspace.tournament.division||'',updatedAt:workspace.updatedAt||new Date().toISOString(),createdAt:workspace.tournament.createdAt||new Date().toISOString(),workspace});}
  return{activeId:rows.some(r=>r.id===activeId)?activeId:(rows[0]?.id||''),rows};
}
function summary(row){const s=row.workspace||{};return{id:row.id,name:row.name||s.tournament?.name||'대회 준비 중',division:row.division||s.tournament?.division||'',updatedAt:row.updatedAt||s.updatedAt||'',createdAt:row.createdAt||'',status:s.completion?.completedAt||s.tournament?.completedAt?'completed':'active'};}
function buildBundle(state){const{activeId,rows}=normalizeRecords(state);return{activeId,rows,manifest:{schemaVersion:6,roomId:DEFAULT_ROOM,activeTournamentId:activeId||'',tournaments:rows.map(summary),clientId:CLIENT_ID,stateUpdatedAt:state?.updatedAt||new Date().toISOString()}};}
function manifestRef(){return api.doc(db,MANIFEST_COLLECTION,DEFAULT_ROOM);}
function tournamentRef(id){return api.doc(db,MANIFEST_COLLECTION,DEFAULT_ROOM,'tournaments',safeId(id,'tournament'));}
async function readBundle(){
  const mSnap=await api.getDoc(manifestRef());if(!mSnap.exists())return null;const m=mSnap.data();const ids=(m.tournaments||[]).map(x=>safeId(x.id,'tournament'));const snaps=await Promise.all(ids.map(id=>api.getDoc(tournamentRef(id))));const docs=[];for(let i=0;i<snaps.length;i++){if(!snaps[i].exists())continue;const raw=snaps[i].data();let workspace=raw.workspace||null;if(!workspace&&typeof raw.workspaceJson==='string'){try{workspace=JSON.parse(raw.workspaceJson);}catch{workspace=null;}}if(workspace)docs.push({id:ids[i],...raw,workspace});}
  if(!docs.length)return null;const activeId=ids.includes(m.activeTournamentId)?m.activeTournamentId:docs[0].id;const active=docs.find(x=>x.id===activeId)||docs[0];const state=normalizeState(clone(active.workspace||{}));state.tournament=state.tournament||{};state.tournament.id=activeId;state.multiTournament={activeTournamentId:activeId,tournaments:docs.map(d=>({id:d.id,name:d.name||d.workspace?.tournament?.name||'대회 준비 중',division:d.division||d.workspace?.tournament?.division||'',createdAt:d.createdAt||'',updatedAt:d.updatedAt||'',snapshot:clone(d.workspace||{})}))};state.updatedAt=m.stateUpdatedAt||state.updatedAt||new Date().toISOString();return{state,manifest:m};
}
async function writeBundle(state,{migration=false}={}){
  if(!canWriteFn())return;const rt=await runtime({requireUser:true});const bundle=buildBundle(state);const batch=api.writeBatch(db);const now=api.serverTimestamp();
  for(const row of bundle.rows){const workspaceJson=JSON.stringify(row.workspace);const payload={schemaVersion:6,id:row.id,name:row.name,division:row.division,createdAt:row.createdAt,updatedAt:row.updatedAt,workspaceJson,workspaceEncoding:'json-v2',workspaceDigest:digest(row.workspace),lastWriterUid:rt.user.uid,lastWriterEmail:rt.user.email||'',serverUpdatedAt:now};const approx=JSON.stringify(payload).length;if(approx>900000)throw new Error(`${row.name} 대회 데이터가 너무 큽니다(${Math.round(approx/1024)}KB). 사진·대형 기록을 별도 보관한 뒤 다시 저장하세요.`);batch.set(tournamentRef(row.id),payload,{merge:false});}
  const revision=lastManifestRevision+1;batch.set(manifestRef(),{...bundle.manifest,revision,lastWriterUid:rt.user.uid,lastWriterEmail:rt.user.email||'',serverUpdatedAt:now,migration:Boolean(migration)},{merge:false});await batch.commit();lastManifestRevision=revision;lastDigest=digest(state);window.__230matchLocalMutationUntil=0;return bundle;
}
async function ensureDb(){if(db)return;const cfg=getSyncSettings(),fb=parseConfig(cfg.firebaseConfigText),rt=await runtime();const f=await loadFirebase();let app=rt?.auth?.app; if(!app){const name=`230match-v5-${fb.projectId}`;try{app=f.getApp(name);}catch{app=f.initializeApp(fb,name);}}db=rt?.db||f.getFirestore(app);connectedRoom=DEFAULT_ROOM;}
function acceptRemote(bundle,source='firebase'){
  if(!bundle?.state)return;
  // 새 대회 생성·전환 직후에는 아직 이전 revision인 원격 상태가 로컬을 덮어쓰지 않게 합니다.
  const guardUntil=Number(window.__230matchLocalMutationUntil||0);
  if(Date.now()<guardUntil){
    const local=getStateFn?.();
    const localId=activeTournamentId(local);
    const remoteId=activeTournamentId(bundle.state);
    const remoteRevision=Number(bundle.manifest?.revision||0);
    if(localId!==remoteId || remoteRevision<=lastManifestRevision)return;
  }
  const token=`${bundle.manifest?.revision||0}:${bundle.manifest?.stateUpdatedAt||bundle.state.updatedAt||''}`;if(token===lastRemoteToken)return;lastRemoteToken=token;lastManifestRevision=Number(bundle.manifest?.revision||0);const d=digest(bundle.state);if(d===lastDigest)return;applyingRemote=true;try{applyRemoteFn(bundle.state);lastDigest=d;status(source==='firebase'?'다른 기기 반영':'클라우드 불러오기','success',`대회 ${bundle.state.multiTournament?.tournaments?.length||1}개의 최신 상태를 반영했습니다.`,{roomId:DEFAULT_ROOM,revision:lastManifestRevision,schemaVersion:6});}finally{applyingRemote=false;}}
async function fetchRemote({quiet=false}={}){try{await ensureDb();const bundle=await readBundle();if(bundle)acceptRemote(bundle,'firebase');else if(!quiet)status('클라우드 연결','success','새 저장구조에 아직 대회가 없습니다.',{roomId:DEFAULT_ROOM,schemaVersion:6});}catch(e){status('클라우드 조회 실패','warning',e?.message||String(e),{roomId:DEFAULT_ROOM});}}
async function flush(){if(pushInFlight||!pendingState||!canWriteFn())return;const state=pendingState;pendingState=null;pushInFlight=true;try{await ensureDb();status('대회별 저장 중','info','대회별 문서로 나누어 저장하고 있습니다.',{roomId:DEFAULT_ROOM,schemaVersion:6});await writeBundle(state);status('클라우드 저장 완료','success',`대회 ${normalizeRecords(state).rows.length}개를 분리 저장했습니다.`,{roomId:DEFAULT_ROOM,revision:lastManifestRevision,schemaVersion:6});}catch(e){status('클라우드 저장 실패','error',e?.message||String(e),{roomId:DEFAULT_ROOM,schemaVersion:6});}finally{pushInFlight=false;if(pendingState)setTimeout(flush,500);}}
function schedule(state){const d=digest(state);if(d===lastDigest)return;pendingState=clone(state);clearTimeout(saveTimer);saveTimer=setTimeout(flush,SAVE_DEBOUNCE);status('저장 대기','info','변경을 모아 현재 대회 문서와 대회 목록을 저장합니다.',{roomId:DEFAULT_ROOM,schemaVersion:6});}
function onSaved(e){if(applyingRemote)return;const state=e?.detail?.state||getStateFn();if(state)schedule(state);}
function startPolling(){clearInterval(pollTimer);pollTimer=setInterval(()=>{if(!document.hidden)fetchRemote({quiet:true});},READ_ONLY_POLL_MS);visibilityHandler=()=>{if(!document.hidden)fetchRemote({quiet:true});};document.addEventListener('visibilitychange',visibilityHandler);}
export function startStateSync({getState,applyRemoteState,onStatus,canWrite}={}){getStateFn=getState||getStateFn;applyRemoteFn=applyRemoteState||applyRemoteFn;statusFn=onStatus||statusFn;canWriteFn=canWrite||canWriteFn;window.addEventListener('230match:state-saved',onSaved);const cfg=getSyncSettings();saveSyncSettings(cfg);if(cfg.enabled)connectCloudSync().catch(e=>status('로컬 저장','warning',e?.message||String(e)));else status('로컬 저장','info','클라우드 동기화가 꺼져 있습니다.');}
export async function connectCloudSync(){disconnectCloudSync(false);await ensureDb();if(canWriteFn()){unsubscribe=api.onSnapshot(manifestRef(),async snap=>{if(!snap.exists()){status('실시간 연결','success','새 저장구조에 연결되었습니다.',{roomId:DEFAULT_ROOM,schemaVersion:6});return;}const m=snap.data();lastManifestRevision=Math.max(lastManifestRevision,Number(m.revision||0));const bundle=await readBundle();acceptRemote(bundle,'firebase');},e=>status('동기화 오류','error',e?.message||String(e)));status('실시간 연결','success','대회별 분리 저장 구조로 연결되었습니다.',{roomId:DEFAULT_ROOM,schemaVersion:6});}else{await fetchRemote();startPolling();status('저부하 조회','success','대회별 문서를 45초 간격으로 조회합니다.',{roomId:DEFAULT_ROOM,schemaVersion:6});}return true;}
export function disconnectCloudSync(show=true){clearTimeout(saveTimer);saveTimer=null;pendingState=null;if(unsubscribe){unsubscribe();unsubscribe=null;}if(pollTimer){clearInterval(pollTimer);pollTimer=null;}if(visibilityHandler){document.removeEventListener('visibilitychange',visibilityHandler);visibilityHandler=null;}db=null;connectedRoom='';if(show)status('로컬 저장','info','클라우드 연결을 해제했습니다.');}
export async function prepareCriticalCloudWrite(){clearTimeout(saveTimer);saveTimer=null;pendingState=null;const started=Date.now();while(pushInFlight&&Date.now()-started<12000)await new Promise(r=>setTimeout(r,80));if(pushInFlight)throw new Error('이전 서버 저장이 아직 끝나지 않았습니다. 잠시 후 다시 시도하세요.');return true;}
export async function pushStateNow(state=getStateFn()){if(!canWriteFn())throw new Error('관리자 또는 진행자만 클라우드에 저장할 수 있습니다.');await prepareCriticalCloudWrite();pushInFlight=true;try{await ensureDb();await writeBundle(state);pendingState=null;clearTimeout(saveTimer);saveTimer=null;status('클라우드 저장 완료','success','전체 대회를 대회별 문서로 저장했습니다.',{roomId:DEFAULT_ROOM,schemaVersion:6});return true;}finally{pushInFlight=false;}}
export async function pullStateNow(){await ensureDb();return(await readBundle())?.state||null;}
export async function resolveConflictWithRemote(){const state=await pullStateNow();if(state){applyingRemote=true;try{applyRemoteFn(state);}finally{applyingRemote=false;}}return Boolean(state);}
export async function forcePushLocal(state=getStateFn()){return pushStateNow(state);}
export function getSyncConflict(){return{active:false,revision:lastManifestRevision,remote:null};}
export async function testCloudConnection(){await ensureDb();const m=await api.getDoc(manifestRef());return{ok:true,roomId:DEFAULT_ROOM,collection:MANIFEST_COLLECTION,exists:m.exists(),mode:canWriteFn()?'read-write':'read-only',online:navigator.onLine,pending:Boolean(pendingState),writing:pushInFlight,retryCount:0,circuitOpen:false,revision:Number(m.data()?.revision||0),conflict:false,schemaVersion:6,tournamentCount:Number(m.data()?.tournaments?.length||0)};}

export async function deleteTournamentNow(tournamentId,nextState=getStateFn()){if(!canWriteFn())throw new Error('관리자만 대회를 삭제할 수 있습니다.');await prepareCriticalCloudWrite();await ensureDb();const id=safeId(tournamentId,'tournament');await api.deleteDoc(tournamentRef(id));await writeBundle(nextState);status('대회 삭제 완료','success',`대회 문서 ${id}를 삭제하고 목록을 갱신했습니다.`,{roomId:DEFAULT_ROOM,schemaVersion:6});return true;}
