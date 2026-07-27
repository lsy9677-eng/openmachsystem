const AUTH_APP_URL='https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
const AUTH_URL='https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
const AUTH_CONFIG_KEY='230match-v3-auth-config';
let auth=null,api=null,unsubscribe=null;
export function getAuthConfig(){try{return JSON.parse(localStorage.getItem(AUTH_CONFIG_KEY)||'{}')}catch{return{}}}
export function saveAuthConfig(config){localStorage.setItem(AUTH_CONFIG_KEY,JSON.stringify(config||{}));return getAuthConfig()}
async function loadApi(){if(api)return api;const[a,b]=await Promise.all([import(AUTH_APP_URL),import(AUTH_URL)]);api={...a,...b};return api}
function parseFirebase(text){if(!text)return null;if(typeof text==='object')return text;try{return JSON.parse(text)}catch{throw new Error('Firebase 설정 JSON 형식이 올바르지 않습니다.')}}
async function ensureAuth(){const cfg=getAuthConfig();const firebase=parseFirebase(cfg.firebaseConfigText);if(!firebase?.apiKey||!firebase?.authDomain||!firebase?.projectId)throw new Error('관리자가 Firebase 인증 설정을 먼저 저장해야 합니다.');const a=await loadApi();let app;const name=`230match-auth-${firebase.projectId}`;try{app=a.getApp(name)}catch{app=a.initializeApp(firebase,name)}auth=a.getAuth(app);a.setPersistence(auth,a.browserLocalPersistence);return auth}
export function roleForUser(user){const cfg=getAuthConfig(),email=String(user?.email||'').toLowerCase();const admins=(cfg.adminEmails||'').toLowerCase().split(/[\s,;]+/).filter(Boolean);const operators=(cfg.operatorEmails||'').toLowerCase().split(/[\s,;]+/).filter(Boolean);if(admins.includes(email))return'admin';if(operators.includes(email))return'operator';return'viewer'}
export async function startAuth(onChange){try{const a=await loadApi();await ensureAuth();if(unsubscribe)unsubscribe();unsubscribe=a.onAuthStateChanged(auth,user=>onChange?.(user,user?roleForUser(user):'viewer'));return true}catch(error){onChange?.(null,'viewer',error);return false}}
export async function signInGoogle(){const a=await loadApi();await ensureAuth();const provider=new a.GoogleAuthProvider();provider.setCustomParameters({prompt:'select_account'});return a.signInWithPopup(auth,provider)}
export async function signOutSocial(){const a=await loadApi();await ensureAuth();return a.signOut(auth)}
export function beginExternalLogin(provider){const cfg=getAuthConfig();const key=provider==='kakao'?'kakaoLoginUrl':'naverLoginUrl';const url=String(cfg[key]||'').trim();if(!url)throw new Error(`${provider==='kakao'?'카카오':'네이버'} 로그인 연결 주소가 설정되지 않았습니다.`);const sep=url.includes('?')?'&':'?';location.href=`${url}${sep}returnUrl=${encodeURIComponent(location.href)}`}
