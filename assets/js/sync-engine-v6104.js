import { getAuthRuntime } from './auth-engine.js?v=3565';
import { normalizeState } from './store-v5000.js?v=5000';

const SETTINGS_KEY = '230match-v7-sync-settings';
const FIREBASE_APP_URL = 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
const FIRESTORE_URL = 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
const DEFAULT_FIREBASE = {
  apiKey: 'AIzaSyAbc17RiYyxCqgbMBkxkMoiRdNTmy2q65w',
  authDomain: 'open-match-manager.firebaseapp.com',
  projectId: 'open-match-manager',
  storageBucket: 'open-match-manager.firebasestorage.app',
  messagingSenderId: '195671806262',
  appId: '1:195671806262:web:89691574839266cea1a397'
};

// V7.1 원칙: 대회별 문서만 저장한다. 전체 대회 배열은 서버에 절대 저장하지 않는다.
const COLLECTION = 'matchRoomsV7';
const ROOM_ID = '230match-production';
const SAVE_DEBOUNCE = 1800;
const VIEWER_POLL_MS = 45000;
const CACHE_DB_NAME = '230match-v7-runtime-cache';
const CACHE_DB_VERSION = 1;
const CACHE_STORE = 'workspaces';

let api = null;
let db = null;
let getStateFn = () => null;
let applyRemoteFn = () => {};
let statusFn = () => {};
let canWriteFn = () => false;
let unsubscribeRoom = null;
let unsubscribeTournaments = null;
let pollTimer = null;
let saveTimer = null;
let pendingState = null;
let pushInFlight = false;
let applyingRemote = false;
let lastAppliedDigest = '';
let lastSavedDigest = '';
let lastKnownRevision = 0;

let cacheDbPromise = null;
function openCacheDb() {
  if (cacheDbPromise) return cacheDbPromise;
  cacheDbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(CACHE_DB_NAME, CACHE_DB_VERSION);
    req.onupgradeneeded = () => {
      const dbx = req.result;
      if (!dbx.objectStoreNames.contains(CACHE_STORE)) {
        const store = dbx.createObjectStore(CACHE_STORE, { keyPath: 'id' });
        store.createIndex('updatedAt', 'updatedAt');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return cacheDbPromise;
}
async function cacheWorkspaceState(source) {
  try {
    const workspace = currentWorkspace(source);
    if (!workspace) return false;
    const id = safeId(workspace.tournament.id);
    const dbx = await openCacheDb();
    await new Promise((resolve, reject) => {
      const tx = dbx.transaction(CACHE_STORE, 'readwrite');
      tx.objectStore(CACHE_STORE).put({ id, updatedAt: source?.updatedAt || new Date().toISOString(), workspace: clone(source) });
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    return true;
  } catch (error) {
    console.warn('[230MATCH] local runtime cache write skipped', error);
    return false;
  }
}
async function readCachedState(id = '') {
  try {
    const dbx = await openCacheDb();
    if (id) {
      return await new Promise((resolve, reject) => {
        const tx = dbx.transaction(CACHE_STORE, 'readonly');
        const req = tx.objectStore(CACHE_STORE).get(safeId(id));
        req.onsuccess = () => resolve(req.result?.workspace || null);
        req.onerror = () => reject(req.error);
      });
    }
    return await new Promise((resolve, reject) => {
      const tx = dbx.transaction(CACHE_STORE, 'readonly');
      const req = tx.objectStore(CACHE_STORE).getAll();
      req.onsuccess = () => {
        const rows = (req.result || []).sort((a,b) => String(b.updatedAt||'').localeCompare(String(a.updatedAt||'')));
        resolve(rows[0]?.workspace || null);
      };
      req.onerror = () => reject(req.error);
    });
  } catch { return null; }
}
const DIVISION_GLOBAL_KEYS_V6104 = new Set(['schemaVersion','tournament','multiDivision','updatedAt','legacyBridge','multiTournament']);
const DIVISION_GLOBAL_PORTAL_KEYS_V6104 = new Set(['tournamentArchives','participantArchives','resultArchives','tournamentTemplates','archives','legacyTournamentSummaries']);
function countCompleted(rows) { return Array.isArray(rows) ? rows.filter(x => x?.status === 'completed' || x?.winnerId || x?.winner).length : 0; }
function stateProgressScore(s) {
  if (!s || typeof s !== 'object') return 0;
  const prelim = s.prelim || {};
  let main = [];
  try { main = Object.values(s.draw?.rounds || {}).flat().filter(Boolean); } catch {}
  const queueCount = (s.sharedQueue?.length || 0) + Object.values(s.venueQueues || {}).reduce((n,v)=>n+(Array.isArray(v)?v.length:0),0);
  return (s.teams?.length || 0) * 5
    + (s.portal?.applications?.length || 0) * 3
    + (prelim.groups?.length || 0) * 8
    + (prelim.matches?.length || 0) * 10
    + countCompleted(prelim.matches) * 60
    + main.length * 10
    + countCompleted(main) * 80
    + (prelim.courts?.length || 0) * 2
    + (s.courts?.length || 0) * 2
    + queueCount * 4;
}
function restoreRootFromActiveDivision(source) {
  if (!source?.multiDivision?.divisions?.length) return { state: source, repaired: false };
  const next = clone(source);
  const record = next.multiDivision.divisions.find(d => String(d.id) === String(next.multiDivision.activeDivisionId)) || next.multiDivision.divisions[0];
  if (!record?.snapshot) return { state: source, repaired: false };
  const rootScore = stateProgressScore(next);
  const snapshotScore = stateProgressScore(record.snapshot);
  if (snapshotScore <= rootScore) return { state: source, repaired: false };
  const preservedTournament = { ...(next.tournament || {}) };
  const preservedMultiTournament = next.multiTournament;
  const globalPortal = {};
  Object.entries(next.portal || {}).forEach(([k,v]) => { if (DIVISION_GLOBAL_PORTAL_KEYS_V6104.has(k)) globalPortal[k] = clone(v); });
  Object.keys(record.snapshot).forEach(key => {
    if (key !== 'portal' && !DIVISION_GLOBAL_KEYS_V6104.has(key)) next[key] = clone(record.snapshot[key]);
  });
  next.portal = { ...globalPortal, ...clone(record.snapshot.portal || {}) };
  next.tournament = { ...preservedTournament, division: record.name || preservedTournament.division || '' };
  next.multiTournament = preservedMultiTournament;
  next.multiDivision.activeDivisionId = record.id;
  next.updatedAt = new Date().toISOString();
  return { state: next, repaired: true };
}
function sameActiveTournament(a,b) { return Boolean(activeIdOf(a) && activeIdOf(a) === activeIdOf(b)); }
function chooseSaferState(localState, remoteState) {
  const localFixed = restoreRootFromActiveDivision(localState || {}).state;
  const remoteFixed = restoreRootFromActiveDivision(remoteState || {}).state;
  if (!sameActiveTournament(localFixed, remoteFixed)) return { state: remoteFixed, source: 'remote' };
  const ls = stateProgressScore(localFixed), rs = stateProgressScore(remoteFixed);
  const localTime = Date.parse(localFixed?.updatedAt || '') || 0;
  const remoteTime = Date.parse(remoteFixed?.updatedAt || '') || 0;
  if (ls > rs || (ls === rs && ls > 0 && localTime > remoteTime)) return { state: localFixed, source: 'local', localScore: ls, remoteScore: rs };
  return { state: remoteFixed, source: 'remote', localScore: ls, remoteScore: rs };
}

function status(label, level = 'info', detail = '', extra = {}) {
  statusFn({ label, level, detail, schemaVersion: 7, roomId: ROOM_ID, ...extra });
}
function clone(value) { return structuredClone(value); }
function hashString(text) { let h = 2166136261; for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); }
function digest(value) { try { const c = clone(value); delete c.updatedAt; return hashString(JSON.stringify(c)); } catch { return ''; } }
function safeId(value, fallback = 'tournament') { const out = String(value || '').trim().replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 120); return out || `${fallback}-${crypto.randomUUID()}`; }
function isRealTournament(workspace) {
  const name = String(workspace?.tournament?.name || '').trim();
  const id = String(workspace?.tournament?.id || '').trim();
  return Boolean(id && name && !['대회 준비 중', '이름 없는 대회'].includes(name));
}
function defaultSettings() { return { enabled: true, roomId: ROOM_ID, collection: COLLECTION, firebaseConfigText: '' }; }
export function getSyncSettings() { try { return { ...defaultSettings(), ...(JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null') || {}) }; } catch { return defaultSettings(); } }
export function saveSyncSettings(settings) { const next = { ...defaultSettings(), ...(settings || {}), roomId: ROOM_ID, collection: COLLECTION }; localStorage.setItem(SETTINGS_KEY, JSON.stringify(next)); return next; }
function parseConfig(text) { if (!String(text || '').trim()) return DEFAULT_FIREBASE; const parsed = JSON.parse(text); return { ...DEFAULT_FIREBASE, ...parsed }; }
async function loadFirebase() { if (!api) api = { ...(await import(FIREBASE_APP_URL)), ...(await import(FIRESTORE_URL)) }; return api; }
async function runtime({ requireUser = false } = {}) { const rt = await getAuthRuntime(); if (requireUser && !rt?.user) throw new Error('클라우드 저장은 로그인 후 사용할 수 있습니다.'); return rt || {}; }
async function ensureDb() {
  if (db) return;
  const settings = getSyncSettings();
  const cfg = parseConfig(settings.firebaseConfigText);
  const rt = await runtime();
  const f = await loadFirebase();
  let app = rt?.auth?.app;
  if (!app) { const name = `230match-v7-${cfg.projectId}`; try { app = f.getApp(name); } catch { app = f.initializeApp(cfg, name); } }
  db = rt?.db || f.getFirestore(app);
}
function roomRef() { return api.doc(db, COLLECTION, ROOM_ID); }
function tournamentsCollection() { return api.collection(db, COLLECTION, ROOM_ID, 'tournaments'); }
function tournamentRef(id) { return api.doc(db, COLLECTION, ROOM_ID, 'tournaments', safeId(id)); }
function activeIdOf(state) { return String(state?.multiTournament?.activeTournamentId || state?.tournament?.id || '').trim(); }
function currentWorkspace(state) {
  if (!state || typeof state !== 'object') return null;
  const repaired = restoreRootFromActiveDivision(clone(state));
  const normalized = normalizeState(repaired.state);
  const id = activeIdOf(normalized);
  if (!id) return null;
  normalized.tournament = normalized.tournament || {};
  normalized.tournament.id = id;
  if (!isRealTournament(normalized)) return null;
  delete normalized.multiTournament;
  return normalized;
}
function decodeWorkspace(raw) {
  if (raw?.workspace && typeof raw.workspace === 'object') return clone(raw.workspace);
  if (typeof raw?.workspaceJson === 'string') { try { return JSON.parse(raw.workspaceJson); } catch { return null; } }
  return null;
}
async function readAllTournaments() {
  const [roomSnap, tournamentSnaps] = await Promise.all([api.getDoc(roomRef()), api.getDocs(tournamentsCollection())]);
  const room = roomSnap.exists() ? roomSnap.data() : {};
  const docs = [];
  tournamentSnaps.forEach(snap => {
    const raw = snap.data();
    const decoded = decodeWorkspace(raw);
    if (!decoded) return;
    const repaired = restoreRootFromActiveDivision(decoded);
    const workspace = repaired.state;
    workspace.tournament = workspace.tournament || {};
    workspace.tournament.id = snap.id;
    if (!isRealTournament(workspace)) return;
    docs.push({ id: snap.id, raw, workspace });
  });
  docs.sort((a, b) => String(b.raw?.updatedAt || '').localeCompare(String(a.raw?.updatedAt || '')));
  if (!docs.length) return null;
  const requested = String(room.activeTournamentId || localStorage.getItem('230match-v7-active-tournament') || '');
  const active = docs.find(x => x.id === requested) || docs[0];
  localStorage.setItem('230match-v7-active-tournament', active.id);
  const state = normalizeState(clone(active.workspace));
  state.tournament.id = active.id;
  state.multiTournament = {
    activeTournamentId: active.id,
    tournaments: docs.map(d => ({
      id: d.id,
      name: d.raw?.name || d.workspace?.tournament?.name || '',
      division: d.raw?.division || d.workspace?.tournament?.division || '',
      createdAt: d.raw?.createdAt || d.workspace?.tournament?.createdAt || '',
      updatedAt: d.raw?.updatedAt || d.workspace?.updatedAt || '',
      snapshot: clone(d.workspace)
    }))
  };
  lastKnownRevision = Number(room.revision || 0);
  return { state, room, count: docs.length };
}
async function writeCurrentTournament(state) {
  if (!canWriteFn()) return false;
  const workspace = currentWorkspace(state);
  if (!workspace) {
    // 핵심 보호: 빈 상태, 로딩 실패 상태, 대회 0개 상태는 서버에 쓰지 않는다.
    status('서버 데이터 보호', 'warning', '유효한 현재 대회가 없어 자동 저장을 건너뛰었습니다. 서버 대회는 변경되지 않습니다.');
    return false;
  }
  const rt = await runtime({ requireUser: true });
  const id = safeId(workspace.tournament.id);
  const workspaceJson = JSON.stringify(workspace);
  if (workspaceJson.length > 900000) throw new Error(`대회 데이터가 너무 큽니다(${Math.round(workspaceJson.length / 1024)}KB). 사진과 대형 기록을 분리해 주세요.`);
  const oldSnap = await api.getDoc(tournamentRef(id));
  const oldRevision = Number(oldSnap.data()?.revision || 0);
  const payload = {
    schemaVersion: 7,
    id,
    name: workspace.tournament.name,
    division: workspace.tournament.division || '',
    createdAt: oldSnap.data()?.createdAt || workspace.tournament.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    revision: oldRevision + 1,
    workspaceJson,
    workspaceEncoding: 'json-v1',
    workspaceDigest: digest(workspace),
    lastWriterUid: rt.user.uid,
    lastWriterEmail: rt.user.email || '',
    serverUpdatedAt: api.serverTimestamp()
  };
  // 한 번의 저장은 현재 대회 문서 하나와 현재 선택 메타만 수정한다. 다른 대회 문서는 절대 건드리지 않는다.
  const batch = api.writeBatch(db);
  batch.set(tournamentRef(id), payload, { merge: false });
  batch.set(roomRef(), {
    schemaVersion: 7,
    roomId: ROOM_ID,
    activeTournamentId: id,
    revision: lastKnownRevision + 1,
    lastWriterUid: rt.user.uid,
    lastWriterEmail: rt.user.email || '',
    serverUpdatedAt: api.serverTimestamp()
  }, { merge: true });
  await batch.commit();
  lastKnownRevision += 1;
  localStorage.setItem('230match-v7-active-tournament', id);
  lastSavedDigest = digest(state);
  await cacheWorkspaceState(state);
  return true;
}
function applyBundle(bundle, source = 'firebase') {
  if (!bundle?.state) return;
  const current = getStateFn();
  const chosen = chooseSaferState(current, bundle.state);
  const d = digest(chosen.state);
  if (d && d === lastAppliedDigest) return;
  applyingRemote = true;
  try {
    applyRemoteFn(chosen.state);
    lastAppliedDigest = d;
    cacheWorkspaceState(chosen.state);
    if (chosen.source === 'local') {
      status('로컬 기록 보호', 'warning', '클라우드보다 진행 기록이 많은 이 브라우저 상태를 유지했습니다. 자동으로 서버에 다시 저장합니다.');
      if (canWriteFn()) { pendingState = clone(chosen.state); clearTimeout(saveTimer); saveTimer = setTimeout(flush, 800); }
    } else {
      status(source === 'firebase' ? '다른 기기 반영' : '클라우드 불러오기', 'success', `운영 대회 ${bundle.count}개를 불러왔습니다.`);
    }
  } finally { applyingRemote = false; }
}
async function fetchRemote({ quiet = false } = {}) {
  try { await ensureDb(); const bundle = await readAllTournaments(); if (bundle) applyBundle(bundle); else if (!quiet) status('자동 저장 정상', 'success', '등록된 운영 대회가 없습니다. 새 대회를 만들어 시작하세요.'); }
  catch (error) { status('클라우드 조회 실패', 'warning', error?.message || String(error)); }
}
async function flush() {
  if (pushInFlight || !pendingState || !canWriteFn()) return;
  const state = pendingState; pendingState = null; pushInFlight = true;
  try { await ensureDb(); const saved = await writeCurrentTournament(state); if (saved) status('클라우드 저장 완료', 'success', '현재 대회 문서만 안전하게 저장했습니다.'); }
  catch (error) { status('클라우드 저장 실패', 'error', error?.message || String(error)); }
  finally { pushInFlight = false; if (pendingState) setTimeout(flush, 300); }
}
function schedule(state) {
  if (!currentWorkspace(state)) return; // 빈 상태는 예약조차 하지 않는다.
  const d = digest(state); if (d && (d === lastSavedDigest || d === lastAppliedDigest)) return;
  pendingState = clone(state); clearTimeout(saveTimer); saveTimer = setTimeout(flush, SAVE_DEBOUNCE);
  status('저장 대기', 'info', '현재 대회의 변경사항만 저장합니다.');
}
function onSaved(event) { if (applyingRemote) return; const state = event?.detail?.state || getStateFn(); if (state) { cacheWorkspaceState(state); schedule(state); } }

export function startStateSync({ getState, applyRemoteState, onStatus, canWrite } = {}) {
  getStateFn = getState || getStateFn; applyRemoteFn = applyRemoteState || applyRemoteFn; statusFn = onStatus || statusFn; canWriteFn = canWrite || canWriteFn;
  window.addEventListener('230match:state-saved', onSaved);
  const cfg = saveSyncSettings(getSyncSettings());
  if (cfg.enabled) connectCloudSync().catch(e => status('클라우드 연결 실패', 'warning', e?.message || String(e)));
}
export async function connectCloudSync() {
  disconnectCloudSync(false);
  const cached = await readCachedState(localStorage.getItem('230match-v7-active-tournament') || '');
  if (cached && stateProgressScore(cached) > stateProgressScore(getStateFn())) {
    applyingRemote = true;
    try { applyRemoteFn(restoreRootFromActiveDivision(cached).state); status('로컬 기록 복구', 'success', '업데이트 전 이 브라우저에 저장된 진행 기록을 먼저 복구했습니다.'); }
    finally { applyingRemote = false; }
  }
  await ensureDb();
  if (canWriteFn()) {
    unsubscribeRoom = api.onSnapshot(roomRef(), () => fetchRemote({ quiet: true }), e => status('실시간 연결 오류', 'warning', e?.message || String(e)));
    unsubscribeTournaments = api.onSnapshot(tournamentsCollection(), () => fetchRemote({ quiet: true }), e => status('대회 목록 연결 오류', 'warning', e?.message || String(e)));
    await fetchRemote(); status('실시간 연결', 'success', 'V7 대회별 독립 저장소에 연결되었습니다.');
  } else {
    await fetchRemote(); pollTimer = setInterval(() => { if (!document.hidden) fetchRemote({ quiet: true }); }, VIEWER_POLL_MS);
    status('저부하 조회', 'success', '운영 대회를 45초 간격으로 조회합니다.');
  }
  return true;
}
export function disconnectCloudSync(show = true) {
  clearTimeout(saveTimer); saveTimer = null; pendingState = null;
  if (unsubscribeRoom) unsubscribeRoom(); if (unsubscribeTournaments) unsubscribeTournaments();
  unsubscribeRoom = null; unsubscribeTournaments = null;
  if (pollTimer) clearInterval(pollTimer); pollTimer = null; db = null;
  if (show) status('클라우드 연결 해제', 'info', '로컬 화면은 유지됩니다.');
}
export async function prepareCriticalCloudWrite() {
  clearTimeout(saveTimer); saveTimer = null; pendingState = null;
  const started = Date.now(); while (pushInFlight && Date.now() - started < 12000) await new Promise(r => setTimeout(r, 80));
  if (pushInFlight) throw new Error('이전 서버 저장이 아직 끝나지 않았습니다.');
  return true;
}
export async function pushStateNow(state = getStateFn()) {
  if (!canWriteFn()) throw new Error('관리자 또는 진행자만 클라우드에 저장할 수 있습니다.');
  await prepareCriticalCloudWrite(); await ensureDb(); pushInFlight = true;
  try { const saved = await writeCurrentTournament(state); if (!saved) throw new Error('유효한 현재 대회가 없어 저장하지 않았습니다.'); status('클라우드 저장 완료', 'success', '현재 대회 문서 하나만 저장했습니다.'); return true; }
  finally { pushInFlight = false; }
}
export async function pullStateNow() { await ensureDb(); return (await readAllTournaments())?.state || null; }
export async function resolveConflictWithRemote() { const state = await pullStateNow(); if (state) { applyingRemote = true; try { applyRemoteFn(state); } finally { applyingRemote = false; } } return Boolean(state); }
export async function forcePushLocal(state = getStateFn()) { return pushStateNow(state); }
export function getSyncConflict() { return { active: false, revision: lastKnownRevision, remote: null }; }
export async function testCloudConnection() { await ensureDb(); const [room, docs] = await Promise.all([api.getDoc(roomRef()), api.getDocs(tournamentsCollection())]); return { ok: true, roomId: ROOM_ID, collection: COLLECTION, exists: room.exists(), mode: canWriteFn() ? 'read-write' : 'read-only', online: navigator.onLine, pending: Boolean(pendingState), writing: pushInFlight, revision: Number(room.data()?.revision || 0), conflict: false, schemaVersion: 7, tournamentCount: docs.size }; }
export async function deleteTournamentNow(tournamentId) {
  if (!canWriteFn()) throw new Error('관리자만 대회를 삭제할 수 있습니다.');
  await prepareCriticalCloudWrite(); await ensureDb();
  const id = safeId(tournamentId);
  // 삭제는 이 함수의 명시적 호출에서만 발생한다. 자동 저장은 delete를 절대 호출하지 않는다.
  await api.deleteDoc(tournamentRef(id));
  const remaining = await api.getDocs(tournamentsCollection());
  const nextId = remaining.docs.find(d => d.id !== id)?.id || '';
  await api.setDoc(roomRef(), { activeTournamentId: nextId, revision: lastKnownRevision + 1, schemaVersion: 7, serverUpdatedAt: api.serverTimestamp() }, { merge: true });
  lastKnownRevision += 1;
  localStorage.setItem('230match-v7-active-tournament', nextId);
  status('대회 삭제 완료', 'success', `선택한 대회 문서 ${id}만 삭제했습니다.`);
  return true;
}
window.addEventListener('online', () => { if (!unsubscribeRoom && !pollTimer) connectCloudSync().catch(() => {}); });
