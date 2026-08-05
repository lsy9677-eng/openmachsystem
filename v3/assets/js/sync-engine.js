import{getAuthRuntime}from'./auth-engine.js?v=3510';
const SETTINGS_KEY='230match-v3-sync-settings';
const CANONICAL_ROOM_ID='230match-production';
const FIREBASE_APP_URL='https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
const FIRESTORE_URL='https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
const DEFAULT_FIREBASE={apiKey:'AIzaSyAbc17RiYyxCqgbMBkxkMoiRdNTmy2q65w',authDomain:'open-match-manager.firebaseapp.com',projectId:'open-match-manager',storageBucket:'open-match-manager.firebasestorage.app',messagingSenderId:'195671806262',appId:'1:195671806262:web:89691574839266cea1a397'};
const DEFAULT_COLLECTION='v3TournamentRooms';
const CLIENT_ID=sessionStorage.getItem('230match-v3-sync-client')||crypto.randomUUID();
sessionStorage.setItem('230match-v3-sync-client',CLIENT_ID);
let getStateFn=()=>null,applyRemoteFn=()=>{},statusFn=()=>{},canWriteFn=()=>false;
let unsubscribe=null,readPollTimer=null,visibilityHandler=null,db=null,firestoreApi=null,saveTimer=null,retryTimer=null,applyingRemote=false,lastRemoteUpdatedAt='',connectedRoom='';
let pendingCloudState=null,pushInFlight=false,lastPushedDigest='',lastScheduledDigest='',lastPushCompletedAt=0,retryCount=0;
let knownRevision=0,knownRemoteDigest='',knownRemotePayload=null,conflictActive=false,conflictDialog=null;
let circuitOpenUntil=0,circuitReason='',consecutiveCloudFailures=0;
const channel=typeof BroadcastChannel!=='undefined'?new BroadcastChannel('230match-v3-live-state'):null;
const MIN_PUSH_INTERVAL=6000,SAVE_DEBOUNCE=2500,MAX_BACKOFF=120000,MAX_AUTO_RETRIES=4,CIRCUIT_BREAK_MS=120000,READ_ONLY_POLL_MS=45000;
class SyncConflictError extends Error{constructor(message,payload){super(message);this.name='SyncConflictError';this.code='sync-conflict';this.payload=payload;}}
export function getSyncSettings(){
  let saved={};try{saved=JSON.parse(localStorage.getItem(SETTINGS_KEY)||'{}')||{};}catch(_e){}
  const legacyRoomId=String(saved.legacyRoomId||saved.roomId||'').trim();
  const next={collection:DEFAULT_COLLECTION,...saved,enabled:true,roomId:CANONICAL_ROOM_ID,legacyRoomId:legacyRoomId&&legacyRoomId!==CANONICAL_ROOM_ID?legacyRoomId:''};
  try{localStorage.setItem(SETTINGS_KEY,JSON.stringify(next));}catch(_e){}
  return next;
}
export function saveSyncSettings(settings){
  const current=getSyncSettings(),requested=String(settings?.roomId||'').trim();
  const next={...current,...(settings||{}),collection:DEFAULT_COLLECTION,enabled:true,roomId:CANONICAL_ROOM_ID,legacyRoomId:requested&&requested!==CANONICAL_ROOM_ID?requested:(current.legacyRoomId||'')};
  localStorage.setItem(SETTINGS_KEY,JSON.stringify(next));return next;
}
function status(label,level='info',detail='',extra={}){statusFn({label,level,detail,...extra});}
function safeRoomId(value){const id=String(value||'').trim();if(!/^[a-zA-Z0-9_-]{3,80}$/.test(id))throw new Error('대회방 ID는 영문·숫자·하이픈·밑줄로 3자 이상 입력하세요.');return id;}
function parseConfig(text){if(!String(text||'').trim())return DEFAULT_FIREBASE;let cfg;try{cfg=JSON.parse(text);}catch{throw new Error('Firebase 설정 JSON 형식이 올바르지 않습니다.');}cfg={...DEFAULT_FIREBASE,...cfg};for(const k of ['apiKey','projectId','appId'])if(!cfg[k])throw new Error(`Firebase 설정에 ${k} 값이 없습니다.`);return cfg;}
async function loadFirebase(){if(firestoreApi)return firestoreApi;const appApi=await import(FIREBASE_APP_URL);const fsApi=await import(FIRESTORE_URL);firestoreApi={...appApi,...fsApi};return firestoreApi;}
function collectionName(){return String(getSyncSettings().collection||DEFAULT_COLLECTION).trim()||DEFAULT_COLLECTION;}
function broadcastLocal(state){try{channel?.postMessage({type:'state',clientId:CLIENT_ID,state,updatedAt:state?.updatedAt||new Date().toISOString()});}catch(_){} }
async function authContext(){const rt=await getAuthRuntime();if(!rt?.user)throw new Error('Firebase 실시간 동기화는 간편로그인 후 사용할 수 있습니다.');return rt;}
function stateTime(state){const t=Date.parse(String(state?.updatedAt||''));return Number.isFinite(t)?t:0;}
async function migrateLegacyRoomIfNeeded(api,rt){
  const cfg=getSyncSettings(),legacy=String(cfg.legacyRoomId||'').trim();if(!legacy||legacy===CANONICAL_ROOM_ID||!db)return;
  try{
    const canonicalRef=api.doc(db,collectionName(),CANONICAL_ROOM_ID),legacyRef=api.doc(db,collectionName(),legacy);
    const [canonicalSnap,legacySnap]=await Promise.all([api.getDoc(canonicalRef),api.getDoc(legacyRef)]);
    const canonicalData=canonicalSnap.exists()?canonicalSnap.data():null,legacyData=legacySnap.exists()?legacySnap.data():null;
    const localState=getStateFn(),candidates=[
      {source:'공용방',state:canonicalData?.state,payload:canonicalData},
      {source:'기존방',state:legacyData?.state,payload:legacyData},
      {source:'현재기기',state:localState,payload:null}
    ].filter(x=>x.state).sort((a,b)=>stateTime(b.state)-stateTime(a.state));
    const newest=candidates[0];
    if(canWriteFn()&&newest?.state&&newest.source!=='공용방'){
      const digest=stateDigest(newest.state),currentRevision=Number(canonicalData?.revision||0)+1;
      await api.setDoc(canonicalRef,{schemaVersion:5,state:structuredClone(newest.state),clientId:CLIENT_ID,ownerUid:rt.user.uid,lastWriterUid:rt.user.uid,lastWriterEmail:rt.user.email||'',updatedAt:api.serverTimestamp(),stateUpdatedAt:newest.state?.updatedAt||new Date().toISOString(),stateDigest:digest,roomId:CANONICAL_ROOM_ID,revision:currentRevision,migratedFrom:legacy,migratedSource:newest.source},{merge:true});
      status('공용 대회방 이전 완료','success',`${legacy}의 최신 상태를 ${CANONICAL_ROOM_ID}로 이전했습니다.`,{roomId:CANONICAL_ROOM_ID,legacyRoomId:legacy});
    }
    const next={...cfg,legacyRoomId:''};localStorage.setItem(SETTINGS_KEY,JSON.stringify(next));
  }catch(error){status('대회방 이전 보류','warning',`기존 대회방 확인을 건너뜁니다. ${error?.message||error}`,{roomId:CANONICAL_ROOM_ID,legacyRoomId:legacy});}
}
function hashString(text){let h=2166136261;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619);}return(h>>>0).toString(36);}
function stateDigest(state){try{const copy=structuredClone(state);delete copy.updatedAt;if(copy.multiDivision?.divisions)for(const d of copy.multiDivision.divisions||[])delete d.updatedAt;return hashString(JSON.stringify(copy));}catch(_e){return String(state?.updatedAt||Date.now());}}
function isResourceExhausted(error){const t=`${error?.code||''} ${error?.message||''}`.toLowerCase();return t.includes('resource-exhausted')||t.includes('maximum allowed queued writes');}
function writerLabel(payload){return payload?.lastWriterEmail||payload?.lastWriterUid||'다른 진행자';}
function ensureConflictDialog(){
  if(conflictDialog?.isConnected)return conflictDialog;
  const d=document.createElement('dialog');d.id='syncConflictDialog';d.style.cssText='border:0;border-radius:18px;padding:0;width:min(620px,94vw);box-shadow:0 24px 80px rgba(0,0,0,.35);z-index:20000';
  d.innerHTML=`<section style="padding:22px;background:#fff"><div style="display:flex;justify-content:space-between;gap:14px"><div><small style="font-weight:900;color:#b45309">SYNC CONFLICT</small><h2 style="margin:5px 0 8px">다른 진행자의 변경이 먼저 저장됐습니다</h2></div></div><p id="syncConflictDetail" style="line-height:1.6;color:#475569"></p><div style="padding:12px;border-radius:12px;background:#fff7ed;color:#9a3412;font-weight:800">자동 덮어쓰기를 중지했습니다. 두 상태 중 하나를 직접 선택해야 합니다.</div><div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;margin-top:18px"><button type="button" data-sync-choice="remote" class="btn btn-primary">클라우드 상태 받기</button><button type="button" data-sync-choice="local" class="btn btn-danger-outline">내 상태로 덮어쓰기</button><button type="button" data-sync-choice="later" class="btn btn-light">나중에 결정</button></div></section>`;
  d.addEventListener('click',async e=>{const choice=e.target?.dataset?.syncChoice;if(!choice)return;if(choice==='later'){d.close();return;}try{if(choice==='remote')await resolveConflictWithRemote();else await forcePushLocal();d.close();}catch(error){status('충돌 처리 실패','error',error?.message||String(error));}});
  document.body.appendChild(d);conflictDialog=d;return d;
}
function showConflict(payload,reason='동시 수정 감지'){
  conflictActive=true;knownRemotePayload=payload||knownRemotePayload;pendingCloudState=null;clearTimeout(saveTimer);saveTimer=null;clearRetry();
  const writer=writerLabel(knownRemotePayload),at=incomingTime(knownRemotePayload);status('동시 수정 충돌','error',`${writer}의 변경과 현재 기기의 변경이 겹쳤습니다. 자동 저장을 멈췄습니다.`,{roomId:connectedRoom,conflict:true,writer,revision:Number(knownRemotePayload?.revision||0)});
  const d=ensureConflictDialog(),detail=d.querySelector('#syncConflictDetail');if(detail)detail.textContent=`${reason} · 클라우드 최종 수정: ${writer}${at?` · ${new Date(at).toLocaleString('ko-KR')}`:''}. 클라우드 상태를 받으면 현재 화면의 미저장 변경은 사라지고, 내 상태로 덮어쓰면 다른 진행자의 변경이 사라질 수 있습니다.`;
  try{if(!d.open)d.showModal();}catch(_e){}
}
async function transactionalPush(state,digest,{force=false}={}){
  if(!db||!firestoreApi)return;const cfg=getSyncSettings();if(!cfg.enabled||!canWriteFn())return;const roomId=safeRoomId(cfg.roomId),rt=await authContext();const{doc,runTransaction,serverTimestamp}=firestoreApi,ref=doc(db,collectionName(),roomId);
  const result=await runTransaction(db,async tx=>{const snap=await tx.get(ref),current=snap.exists()?snap.data():null,currentRevision=Number(current?.revision||0),currentDigest=String(current?.stateDigest||'');
    if(!force&&current&&current.clientId!==CLIENT_ID&&currentRevision!==knownRevision&&currentDigest&&currentDigest!==knownRemoteDigest&&currentDigest!==digest)throw new SyncConflictError('다른 진행자가 먼저 저장했습니다.',current);
    const nextRevision=currentRevision+1;tx.set(ref,{schemaVersion:4,state:structuredClone(state),clientId:CLIENT_ID,ownerUid:rt.user.uid,lastWriterUid:rt.user.uid,lastWriterEmail:rt.user.email||'',updatedAt:serverTimestamp(),stateUpdatedAt:state?.updatedAt||new Date().toISOString(),stateDigest:digest,roomId,revision:nextRevision,baseRevision:currentRevision},{merge:true});return nextRevision;});
  knownRevision=result;knownRemoteDigest=digest;return result;
}
function clearRetry(){if(retryTimer){clearTimeout(retryTimer);retryTimer=null;}}
function circuitRemaining(){return Math.max(0,circuitOpenUntil-Date.now());}
function openCircuit(reason='Firebase 요청 지연'){
  circuitReason=reason;circuitOpenUntil=Date.now()+CIRCUIT_BREAK_MS;clearRetry();
  status('로컬 운영 모드','warning',`${reason}. ${Math.round(CIRCUIT_BREAK_MS/60000)}분 동안 Firebase 자동 재시도를 멈춥니다. 경기 운영과 브라우저 저장은 계속됩니다.`,{roomId:connectedRoom,localFirst:true,resumeAt:new Date(circuitOpenUntil).toISOString()});
  retryTimer=setTimeout(()=>{retryTimer=null;circuitOpenUntil=0;circuitReason='';consecutiveCloudFailures=0;status('클라우드 재연결 대기','info','Firebase 자동 동기화를 다시 시도합니다. 로컬 최신 상태 1건만 전송합니다.',{roomId:connectedRoom});drainCloudQueue();},CIRCUIT_BREAK_MS);
}
function circuitBlocked(){return circuitRemaining()>0;}
async function drainCloudQueue(){
  if(pushInFlight||!pendingCloudState||!canWriteFn()||conflictActive)return;const cfg=getSyncSettings();if(!cfg.enabled)return;
  if(!navigator.onLine){status('오프라인 로컬 운영','warning','인터넷 연결이 없어 Firebase 전송을 보류했습니다. 브라우저 저장과 경기 운영은 계속됩니다.',{roomId:connectedRoom,localFirst:true});return;}
  if(circuitBlocked()){status('로컬 운영 모드','warning',`${circuitReason||'Firebase 요청 지연'} · 약 ${Math.ceil(circuitRemaining()/1000)}초 후 최신 상태 1건을 재시도합니다.`,{roomId:connectedRoom,localFirst:true});return;}
  const item=pendingCloudState;pendingCloudState=null;
  if(item.digest===lastPushedDigest){status('클라우드 저장 완료','success','동일한 상태의 중복 저장을 생략했습니다.',{roomId:connectedRoom,deduplicated:true});return;}
  const wait=Math.max(0,MIN_PUSH_INTERVAL-(Date.now()-lastPushCompletedAt));if(wait>0){pendingCloudState=item;clearRetry();retryTimer=setTimeout(()=>{retryTimer=null;drainCloudQueue();},wait);return;}
  pushInFlight=true;status('클라우드 저장 중','info','변경 내용을 한 번으로 합쳐 Firebase에 저장하고 있습니다.',{roomId:connectedRoom});
  try{if(!db)await connectCloudSync();await transactionalPush(item.state,item.digest);lastPushedDigest=item.digest;lastPushCompletedAt=Date.now();retryCount=0;consecutiveCloudFailures=0;circuitOpenUntil=0;circuitReason='';status('클라우드 저장 완료','success',`최신 상태를 저장했습니다 · ${new Date().toLocaleTimeString('ko-KR')}`,{roomId:connectedRoom,revision:knownRevision});}
  catch(error){if(error?.code==='sync-conflict'||error instanceof SyncConflictError){showConflict(error.payload,'저장 직전 서버 버전이 변경됨');return;}pendingCloudState=item;retryCount=Math.min(retryCount+1,8);consecutiveCloudFailures+=1;const overloaded=isResourceExhausted(error);if(overloaded||consecutiveCloudFailures>=MAX_AUTO_RETRIES){openCircuit(overloaded?'Firebase 요청량 초과 감지':'Firebase 연속 오류 감지');return;}const delay=Math.min(MAX_BACKOFF,Math.max(3000,2**retryCount*1000));status('저장 지연·재시도','warning',`Firebase 저장이 지연되어 ${Math.round(delay/1000)}초 후 재시도합니다. 로컬 저장과 경기 운영은 정상입니다.`,{roomId:connectedRoom,retryIn:delay,localFirst:true});clearRetry();retryTimer=setTimeout(()=>{retryTimer=null;drainCloudQueue();},delay);}
  finally{pushInFlight=false;if(pendingCloudState&&!retryTimer&&!conflictActive)setTimeout(drainCloudQueue,0);}
}
function scheduleCloud(state){if(!canWriteFn()||conflictActive)return;const digest=stateDigest(state);if(digest===lastPushedDigest||digest===lastScheduledDigest)return;lastScheduledDigest=digest;pendingCloudState={state:structuredClone(state),digest,queuedAt:Date.now(),baseRevision:knownRevision};clearTimeout(saveTimer);saveTimer=setTimeout(()=>{saveTimer=null;lastScheduledDigest='';drainCloudQueue();},SAVE_DEBOUNCE);status(circuitBlocked()?'로컬 운영 모드':'클라우드 저장 대기',circuitBlocked()?'warning':'info',circuitBlocked()?'Firebase 자동 전송을 잠시 쉬고 있습니다. 최신 변경은 로컬에 저장되며 회복 후 1건으로 전송됩니다.':'연속 변경을 2.5초 동안 모아 한 번만 저장합니다.',{roomId:connectedRoom,revision:knownRevision});}
function onLocalSaved(event){if(applyingRemote)return;const state=event?.detail?.state||getStateFn();if(!state)return;broadcastLocal(state);scheduleCloud(state);}
function incomingTime(payload){return String(payload?.stateUpdatedAt||payload?.updatedAt?.toDate?.()?.toISOString?.()||payload?.state?.updatedAt||'');}
function acceptRemote(payload,source){
  if(!payload?.state)return;const revision=Number(payload.revision||0),digest=String(payload.stateDigest||stateDigest(payload.state));
  if(payload.clientId===CLIENT_ID){knownRevision=Math.max(knownRevision,revision);knownRemoteDigest=digest;return;}
  const localDigest=stateDigest(getStateFn()),hasLocalChange=Boolean(pendingCloudState||pushInFlight||(lastPushedDigest&&localDigest!==lastPushedDigest));
  knownRemotePayload=payload;
  if(source==='firebase'&&hasLocalChange&&revision>knownRevision&&digest!==localDigest){showConflict(payload,'실시간으로 다른 진행자의 변경 감지');return;}
  const incoming=incomingTime(payload),current=String(getStateFn()?.updatedAt||'');if(incoming&&incoming===lastRemoteUpdatedAt)return;if(!revision&&incoming&&current&&incoming<=current)return;
  knownRevision=Math.max(knownRevision,revision);knownRemoteDigest=digest;lastRemoteUpdatedAt=incoming;applyingRemote=true;
  try{applyRemoteFn(payload.state);lastPushedDigest=digest;status(source==='firebase'?'다른 기기 반영':'기기 내 동기화','success',source==='firebase'?`${writerLabel(payload)}의 최신 상태를 반영했습니다.`:'같은 브라우저의 다른 탭 상태를 반영했습니다.',{roomId:connectedRoom,revision:knownRevision,lastWriterEmail:payload.lastWriterEmail||''});}finally{applyingRemote=false;}
}
export function startStateSync({getState,applyRemoteState,onStatus,canWrite}={}){getStateFn=getState||getStateFn;applyRemoteFn=applyRemoteState||applyRemoteFn;statusFn=onStatus||statusFn;canWriteFn=canWrite||canWriteFn;window.addEventListener('230match:state-saved',onLocalSaved);channel&&(channel.onmessage=e=>acceptRemote(e.data,'tab'));window.addEventListener('online',()=>{status('온라인','success','인터넷 연결이 복구되었습니다. 로컬 최신 상태만 Firebase에 동기화합니다.');if(!circuitBlocked())drainCloudQueue();});window.addEventListener('offline',()=>status('오프라인 로컬 운영','warning','인터넷 연결이 끊겼습니다. Firebase 재시도는 멈추고 브라우저 저장과 경기 운영은 계속됩니다.',{localFirst:true}));const cfg=getSyncSettings();if(cfg.enabled)connectCloudSync().catch(error=>status('로컬 저장','error',`Firebase 자동 연결 실패: ${error.message}`));else status('로컬 저장','info','브라우저 자동 저장과 같은 브라우저 탭 동기화가 활성화되어 있습니다.');}
async function fetchReadOnlySnapshot({quiet=false}={}){if(!db||!firestoreApi||!connectedRoom||!navigator.onLine||document.hidden)return;try{const ref=firestoreApi.doc(db,collectionName(),connectedRoom),snapshot=await firestoreApi.getDoc(ref);if(!snapshot.exists()){if(!quiet)status('저부하 조회','success',`대회방 ${connectedRoom}에 연결되었습니다. 아직 클라우드 상태가 없습니다.`,{roomId:connectedRoom,empty:true,lowLoad:true});return;}const data=snapshot.data();acceptRemote(data,'firebase');if(!conflictActive)status('저부하 조회','success',`읽기 전용 · 45초 간격 · r${Number(data.revision||0)}`,{roomId:connectedRoom,revision:Number(data.revision||0),lowLoad:true});}catch(error){status('조회 지연','warning',`Firebase 조회를 잠시 건너뜁니다. ${error?.message||error}`,{roomId:connectedRoom,lowLoad:true});}}
function startReadOnlyPolling(){clearInterval(readPollTimer);readPollTimer=null;if(visibilityHandler)document.removeEventListener('visibilitychange',visibilityHandler);visibilityHandler=()=>{if(document.hidden){clearInterval(readPollTimer);readPollTimer=null;status('조회 일시정지','info','화면이 보이지 않는 동안 Firebase 조회를 중지합니다.',{roomId:connectedRoom,lowLoad:true});}else{fetchReadOnlySnapshot();clearInterval(readPollTimer);readPollTimer=setInterval(()=>fetchReadOnlySnapshot({quiet:true}),READ_ONLY_POLL_MS);}};document.addEventListener('visibilitychange',visibilityHandler);fetchReadOnlySnapshot();readPollTimer=setInterval(()=>fetchReadOnlySnapshot({quiet:true}),READ_ONLY_POLL_MS);}
export async function connectCloudSync(){disconnectCloudSync(false);if(!navigator.onLine)throw new Error('인터넷 연결을 확인하세요.');const cfg=getSyncSettings();if(!cfg.enabled)throw new Error('Firebase 동기화 사용을 먼저 켜세요.');const roomId=safeRoomId(cfg.roomId),firebaseConfig=parseConfig(cfg.firebaseConfigText);status('연결 중','info','Firebase 인증과 대회방 연결을 확인하고 있습니다.');const rt=await authContext(),api=await loadFirebase();let app=rt?.auth?.app;if(!app){const appName=`230match-${firebaseConfig.projectId}`;try{app=api.getApp(appName);}catch{app=api.initializeApp(firebaseConfig,appName);}}db=rt?.db||api.getFirestore(app);connectedRoom=roomId;await migrateLegacyRoomIfNeeded(api,rt);if(canWriteFn()){unsubscribe=api.onSnapshot(api.doc(db,collectionName(),roomId),snapshot=>{if(!snapshot.exists()){knownRevision=0;knownRemoteDigest='';status('실시간 연결','success',`대회방 ${roomId}에 연결되었습니다. 아직 클라우드 상태가 없습니다.`,{roomId,empty:true});return;}const data=snapshot.data();if(!knownRevision){knownRevision=Number(data.revision||0);knownRemoteDigest=String(data.stateDigest||'');}acceptRemote(data,'firebase');if(!conflictActive)status('실시간 연결','success',`진행자 실시간 · 읽기/쓰기 · r${Number(data.revision||0)}`,{roomId,lastWriterEmail:data.lastWriterEmail||'',revision:Number(data.revision||0)});},error=>status('동기화 오류','error',`${error.code||''} ${error.message}`.trim()));status('실시간 연결','success',`대회방 ${roomId} · 진행자 실시간 연결`,{roomId,user:rt.user.email||rt.user.uid});}else{startReadOnlyPolling();status('저부하 조회','success',`대회방 ${roomId} · 읽기 전용 45초 간격`,{roomId,user:rt.user.email||rt.user.uid,lowLoad:true});}return true;}
export function disconnectCloudSync(showStatus=true){clearTimeout(saveTimer);saveTimer=null;clearRetry();pendingCloudState=null;lastScheduledDigest='';conflictActive=false;knownRevision=0;knownRemoteDigest='';knownRemotePayload=null;circuitOpenUntil=0;circuitReason='';consecutiveCloudFailures=0;if(unsubscribe){unsubscribe();unsubscribe=null;}if(readPollTimer){clearInterval(readPollTimer);readPollTimer=null;}if(visibilityHandler){document.removeEventListener('visibilitychange',visibilityHandler);visibilityHandler=null;}db=null;connectedRoom='';if(showStatus)status('로컬 저장','info','Firebase 연결을 해제했습니다. 브라우저 저장은 계속됩니다.');}
export async function pushStateNow(state=getStateFn()){if(!canWriteFn())throw new Error('관리자 또는 진행자만 클라우드에 저장할 수 있습니다.');if(conflictActive)throw new Error('동시 수정 충돌을 먼저 처리해 주세요.');if(!db)await connectCloudSync();const digest=stateDigest(state);pendingCloudState=null;clearTimeout(saveTimer);saveTimer=null;await transactionalPush(state,digest);lastPushedDigest=digest;lastPushCompletedAt=Date.now();retryCount=0;consecutiveCloudFailures=0;circuitOpenUntil=0;circuitReason='';status('클라우드 저장 완료','success',`현재 상태를 저장했습니다 · r${knownRevision}`,{roomId:connectedRoom,revision:knownRevision});}
export async function pullStateNow(){if(!db)await connectCloudSync();const cfg=getSyncSettings(),roomId=safeRoomId(cfg.roomId),snapshot=await firestoreApi.getDoc(firestoreApi.doc(db,collectionName(),roomId));if(!snapshot.exists())return null;const data=snapshot.data();knownRevision=Number(data.revision||0);knownRemoteDigest=String(data.stateDigest||'');knownRemotePayload=data;return data.state;}
export async function resolveConflictWithRemote(){const remote=knownRemotePayload?.state||await pullStateNow();if(!remote)throw new Error('클라우드 상태가 없습니다.');applyingRemote=true;try{applyRemoteFn(remote);lastPushedDigest=knownRemoteDigest||stateDigest(remote);conflictActive=false;pendingCloudState=null;status('충돌 해결 완료','success',`클라우드 상태를 적용했습니다 · r${knownRevision}`,{roomId:connectedRoom,revision:knownRevision});}finally{applyingRemote=false;}return true;}
export async function forcePushLocal(state=getStateFn()){if(!canWriteFn())throw new Error('관리자 또는 진행자만 강제 저장할 수 있습니다.');if(!db)await connectCloudSync();const digest=stateDigest(state);await transactionalPush(state,digest,{force:true});lastPushedDigest=digest;lastPushCompletedAt=Date.now();conflictActive=false;pendingCloudState=null;status('충돌 해결 완료','warning',`현재 기기 상태로 클라우드를 덮어썼습니다 · r${knownRevision}`,{roomId:connectedRoom,revision:knownRevision,forced:true});return true;}
export function getSyncConflict(){return{active:conflictActive,revision:knownRevision,remote:knownRemotePayload?{revision:Number(knownRemotePayload.revision||0),lastWriterEmail:knownRemotePayload.lastWriterEmail||'',stateUpdatedAt:incomingTime(knownRemotePayload)}:null};}
export async function testCloudConnection(){if(!db)await connectCloudSync();const cfg=getSyncSettings(),roomId=safeRoomId(cfg.roomId),rt=await authContext(),ref=firestoreApi.doc(db,collectionName(),roomId),snap=await firestoreApi.getDoc(ref),data=snap.exists()?snap.data():{};return{ok:true,roomId,collection:collectionName(),exists:snap.exists(),mode:canWriteFn()?'read-write':'read-only',user:rt.user.email||rt.user.uid,online:navigator.onLine,pending:Boolean(pendingCloudState),writing:pushInFlight,retryCount,circuitOpen:circuitBlocked(),circuitRemainingMs:circuitRemaining(),revision:Number(data.revision||0),conflict:conflictActive,lastWriterEmail:data.lastWriterEmail||''};}
