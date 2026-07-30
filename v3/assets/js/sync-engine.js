import{getAuthRuntime}from'./auth-engine.js?v=3510';
const SETTINGS_KEY='230match-v3-sync-settings';
const FIREBASE_APP_URL='https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
const FIRESTORE_URL='https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
const DEFAULT_FIREBASE={apiKey:'AIzaSyAbc17RiYyxCqgbMBkxkMoiRdNTmy2q65w',authDomain:'open-match-manager.firebaseapp.com',projectId:'open-match-manager',storageBucket:'open-match-manager.firebasestorage.app',messagingSenderId:'195671806262',appId:'1:195671806262:web:89691574839266cea1a397'};
const DEFAULT_COLLECTION='v3TournamentRooms';
const CLIENT_ID=sessionStorage.getItem('230match-v3-sync-client')||crypto.randomUUID();
sessionStorage.setItem('230match-v3-sync-client',CLIENT_ID);
let getStateFn=()=>null,applyRemoteFn=()=>{},statusFn=()=>{},canWriteFn=()=>false;
let unsubscribe=null,db=null,firestoreApi=null,saveTimer=null,retryTimer=null,applyingRemote=false,lastRemoteUpdatedAt='',connectedRoom='';
let pendingCloudState=null,pushInFlight=false,lastPushedDigest='',lastScheduledDigest='',lastPushCompletedAt=0,retryCount=0;
const channel=typeof BroadcastChannel!=='undefined'?new BroadcastChannel('230match-v3-live-state'):null;
const MIN_PUSH_INTERVAL=1200;
const SAVE_DEBOUNCE=900;
const MAX_BACKOFF=30000;
export function getSyncSettings(){try{return JSON.parse(localStorage.getItem(SETTINGS_KEY)||'{}');}catch{return{};}}
export function saveSyncSettings(settings){const next={collection:DEFAULT_COLLECTION,...(settings||{})};localStorage.setItem(SETTINGS_KEY,JSON.stringify(next));return next;}
function status(label,level='info',detail='',extra={}){statusFn({label,level,detail,...extra});}
function safeRoomId(value){const id=String(value||'').trim();if(!/^[a-zA-Z0-9_-]{3,80}$/.test(id))throw new Error('대회방 ID는 영문·숫자·하이픈·밑줄로 3자 이상 입력하세요.');return id;}
function parseConfig(text){if(!String(text||'').trim())return DEFAULT_FIREBASE;let cfg;try{cfg=JSON.parse(text);}catch{throw new Error('Firebase 설정 JSON 형식이 올바르지 않습니다.');}cfg={...DEFAULT_FIREBASE,...cfg};for(const k of ['apiKey','projectId','appId'])if(!cfg[k])throw new Error(`Firebase 설정에 ${k} 값이 없습니다.`);return cfg;}
async function loadFirebase(){if(firestoreApi)return firestoreApi;const appApi=await import(FIREBASE_APP_URL);const fsApi=await import(FIRESTORE_URL);firestoreApi={...appApi,...fsApi};return firestoreApi;}
function collectionName(){return String(getSyncSettings().collection||DEFAULT_COLLECTION).trim()||DEFAULT_COLLECTION;}
function broadcastLocal(state){try{channel?.postMessage({type:'state',clientId:CLIENT_ID,state,updatedAt:state?.updatedAt||new Date().toISOString()});}catch(_){} }
async function authContext(){const rt=await getAuthRuntime();if(!rt?.user)throw new Error('Firebase 실시간 동기화는 간편로그인 후 사용할 수 있습니다.');return rt;}
function hashString(text){let h=2166136261;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619);}return (h>>>0).toString(36);}
function stateDigest(state){try{const copy=structuredClone(state);delete copy.updatedAt;if(copy.multiDivision?.divisions){for(const d of copy.multiDivision.divisions||[])delete d.updatedAt;}return hashString(JSON.stringify(copy));}catch(_e){return String(state?.updatedAt||Date.now());}}
function isResourceExhausted(error){return String(error?.code||'').includes('resource-exhausted')||String(error?.message||'').toLowerCase().includes('resource-exhausted')||String(error?.message||'').toLowerCase().includes('maximum allowed queued writes');}
async function pushCloud(state,digest){if(!db||!firestoreApi)return;const cfg=getSyncSettings();if(!cfg.enabled||!canWriteFn())return;const roomId=safeRoomId(cfg.roomId);const rt=await authContext();const {doc,setDoc,serverTimestamp}=firestoreApi;const ref=doc(db,collectionName(),roomId);await setDoc(ref,{schemaVersion:3,state:structuredClone(state),clientId:CLIENT_ID,ownerUid:rt.user.uid,lastWriterUid:rt.user.uid,lastWriterEmail:rt.user.email||'',updatedAt:serverTimestamp(),stateUpdatedAt:state?.updatedAt||new Date().toISOString(),stateDigest:digest,roomId},{merge:true});}
function clearRetry(){if(retryTimer){clearTimeout(retryTimer);retryTimer=null;}}
async function drainCloudQueue(){
  if(pushInFlight||!pendingCloudState||!canWriteFn())return;
  const cfg=getSyncSettings();if(!cfg.enabled)return;
  const item=pendingCloudState;pendingCloudState=null;
  if(item.digest===lastPushedDigest){status('클라우드 저장 완료','success','동일한 상태의 중복 저장을 생략했습니다.',{roomId:connectedRoom,deduplicated:true});return;}
  const wait=Math.max(0,MIN_PUSH_INTERVAL-(Date.now()-lastPushCompletedAt));
  if(wait>0){pendingCloudState=item;clearRetry();retryTimer=setTimeout(()=>{retryTimer=null;drainCloudQueue();},wait);return;}
  pushInFlight=true;status('클라우드 저장 중','info','변경 내용을 한 번으로 합쳐 Firebase에 저장하고 있습니다.',{roomId:connectedRoom});
  try{
    if(!db)await connectCloudSync();
    await pushCloud(item.state,item.digest);
    lastPushedDigest=item.digest;lastPushCompletedAt=Date.now();retryCount=0;
    status('클라우드 저장 완료','success',`최신 상태를 저장했습니다 · ${new Date().toLocaleTimeString('ko-KR')}`,{roomId:connectedRoom});
  }catch(error){
    pendingCloudState=item;
    retryCount=Math.min(retryCount+1,8);
    const delay=Math.min(MAX_BACKOFF,Math.max(2000,2**retryCount*1000));
    if(isResourceExhausted(error))status('저장 지연·재시도','warning',`Firebase 요청이 몰려 ${Math.round(delay/1000)}초 후 자동 재시도합니다. 로컬 저장은 완료되었습니다.`,{roomId:connectedRoom,retryIn:delay});
    else status('동기화 오류','error',`${error?.code||''} ${error?.message||error}`.trim(),{roomId:connectedRoom,retryIn:delay});
    clearRetry();retryTimer=setTimeout(()=>{retryTimer=null;drainCloudQueue();},delay);
  }finally{
    pushInFlight=false;
    if(pendingCloudState&&!retryTimer)setTimeout(drainCloudQueue,0);
  }
}
function scheduleCloud(state){
  if(!canWriteFn())return;
  const digest=stateDigest(state);
  if(digest===lastPushedDigest||digest===lastScheduledDigest)return;
  lastScheduledDigest=digest;
  pendingCloudState={state:structuredClone(state),digest,queuedAt:Date.now()};
  clearTimeout(saveTimer);
  saveTimer=setTimeout(()=>{saveTimer=null;lastScheduledDigest='';drainCloudQueue();},SAVE_DEBOUNCE);
  status('클라우드 저장 대기','info','연속 변경을 한 번의 저장으로 합치고 있습니다.',{roomId:connectedRoom});
}
function onLocalSaved(event){if(applyingRemote)return;const state=event?.detail?.state||getStateFn();if(!state)return;broadcastLocal(state);scheduleCloud(state);}
function incomingTime(payload){return String(payload?.stateUpdatedAt||payload?.updatedAt?.toDate?.()?.toISOString?.()||payload?.state?.updatedAt||'');}
function acceptRemote(payload,source){
  if(!payload?.state||payload.clientId===CLIENT_ID)return;
  const incoming=incomingTime(payload),current=String(getStateFn()?.updatedAt||'');
  if((pushInFlight||pendingCloudState)&&incoming&&current&&incoming<=current)return;
  if(incoming&&current&&incoming<=current)return;
  if(incoming&&incoming===lastRemoteUpdatedAt)return;
  lastRemoteUpdatedAt=incoming;applyingRemote=true;
  try{applyRemoteFn(payload.state);status(source==='firebase'?'다른 기기 반영':'기기 내 동기화','success',source==='firebase'?'다른 기기의 최신 상태를 반영했습니다.':'같은 브라우저의 다른 탭 상태를 반영했습니다.',{roomId:connectedRoom});}
  finally{applyingRemote=false;}
}
export function startStateSync({getState,applyRemoteState,onStatus,canWrite}={}){getStateFn=getState||getStateFn;applyRemoteFn=applyRemoteState||applyRemoteFn;statusFn=onStatus||statusFn;canWriteFn=canWrite||canWriteFn;window.addEventListener('230match:state-saved',onLocalSaved);channel&&(channel.onmessage=e=>acceptRemote(e.data,'tab'));window.addEventListener('online',()=>{status('온라인','success','인터넷 연결이 복구되었습니다.');drainCloudQueue();});window.addEventListener('offline',()=>status('오프라인','error','인터넷 연결이 끊겼습니다. 로컬 저장은 계속됩니다.'));const cfg=getSyncSettings();if(cfg.enabled)connectCloudSync().catch(error=>status('로컬 저장','error',`Firebase 자동 연결 실패: ${error.message}`));else status('로컬 저장','info','브라우저 자동 저장과 같은 브라우저 탭 동기화가 활성화되어 있습니다.');}
export async function connectCloudSync(){disconnectCloudSync(false);if(!navigator.onLine)throw new Error('인터넷 연결을 확인하세요.');const cfg=getSyncSettings();if(!cfg.enabled)throw new Error('Firebase 동기화 사용을 먼저 켜세요.');const roomId=safeRoomId(cfg.roomId),firebaseConfig=parseConfig(cfg.firebaseConfigText);status('연결 중','info','Firebase 인증과 대회방 연결을 확인하고 있습니다.');const rt=await authContext();const api=await loadFirebase();let app=rt?.auth?.app;if(!app){const appName=`230match-${firebaseConfig.projectId}`;try{app=api.getApp(appName);}catch{app=api.initializeApp(firebaseConfig,appName);}}db=rt?.db||api.getFirestore(app);connectedRoom=roomId;unsubscribe=api.onSnapshot(api.doc(db,collectionName(),roomId),snapshot=>{if(!snapshot.exists()){status('실시간 연결','success',`대회방 ${roomId}에 연결되었습니다. 아직 클라우드 상태가 없습니다.`,{roomId,empty:true});return;}const data=snapshot.data();acceptRemote(data,'firebase');status('실시간 연결','success',`대회방 ${roomId} · ${canWriteFn()?'읽기/쓰기':'읽기 전용'} 연결`,{roomId,lastWriterEmail:data.lastWriterEmail||''});},error=>status('동기화 오류','error',`${error.code||''} ${error.message}`.trim()));status('실시간 연결','success',`대회방 ${roomId} · ${canWriteFn()?'읽기/쓰기':'읽기 전용'} 연결`,{roomId,user:rt.user.email||rt.user.uid});return true;}
export function disconnectCloudSync(showStatus=true){clearTimeout(saveTimer);saveTimer=null;clearRetry();pendingCloudState=null;lastScheduledDigest='';if(unsubscribe){unsubscribe();unsubscribe=null;}db=null;connectedRoom='';if(showStatus)status('로컬 저장','info','Firebase 연결을 해제했습니다. 브라우저 저장은 계속됩니다.');}
export async function pushStateNow(state=getStateFn()){if(!canWriteFn())throw new Error('관리자 또는 진행자만 클라우드에 저장할 수 있습니다.');if(!db)await connectCloudSync();const digest=stateDigest(state);pendingCloudState=null;clearTimeout(saveTimer);saveTimer=null;await pushCloud(state,digest);lastPushedDigest=digest;lastPushCompletedAt=Date.now();retryCount=0;status('클라우드 저장 완료','success','현재 상태를 V3 전용 대회방에 저장했습니다.',{roomId:connectedRoom});}
export async function pullStateNow(){if(!db)await connectCloudSync();const cfg=getSyncSettings(),roomId=safeRoomId(cfg.roomId);const snapshot=await firestoreApi.getDoc(firestoreApi.doc(db,collectionName(),roomId));return snapshot.exists()?snapshot.data().state:null;}
export async function testCloudConnection(){if(!db)await connectCloudSync();const cfg=getSyncSettings(),roomId=safeRoomId(cfg.roomId);const rt=await authContext();const ref=firestoreApi.doc(db,collectionName(),roomId);const snap=await firestoreApi.getDoc(ref);return{ok:true,roomId,collection:collectionName(),exists:snap.exists(),mode:canWriteFn()?'read-write':'read-only',user:rt.user.email||rt.user.uid,online:navigator.onLine,pending:Boolean(pendingCloudState),writing:pushInFlight,retryCount};}
