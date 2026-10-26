// Single host policy. Never infer production from a missing development flag.
export function classifyEnvironment(url) {
  const u = new URL(url);
  if (u.origin === 'https://tennis230.pages.dev') return 'production';
  if (u.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(u.hostname)) return 'development';
  throw new Error('230MATCH: 허용되지 않은 호스트입니다. Firebase 초기화를 중단했습니다.');
}
export const mode = classifyEnvironment(globalThis.location?.href || 'http://127.0.0.1/');
export const isDevelopment = mode === 'development';
export const projectId = 'demo-230match';
export const developmentFirebase = Object.freeze({
  apiKey: 'demo-230match-not-a-real-key', authDomain: 'localhost', projectId,
  storageBucket: 'demo-230match.appspot.com', appId: 'demo-230match-local', messagingSenderId: '000000000000'
});
export function firebaseConfig(production) { return isDevelopment ? developmentFirebase : production; }
export function mockAction(kind, detail = {}) {
  const item = { id: `mock-${Date.now()}-${Math.random().toString(36).slice(2)}`, kind, mock: true, status: 'mock', detail };
  if (typeof window !== 'undefined') {
    window.__230matchMocks ||= [];
    window.__230matchMocks.push(item);
    window.dispatchEvent(new CustomEvent('230match:mock', { detail: item }));
    const badge = document.getElementById('development-status');
    if (badge) badge.textContent = `개발 · ${projectId} Emulator · ${kind} 모의 처리 (실제 전송 없음)`;
  }
  return item;
}
export function openSmsComposer(uri) {
  if (isDevelopment) return mockAction('문자앱', { uri });
  location.href = uri;
}
export async function requireEmulators() {
  if (!isDevelopment) return;
  // Probe only loopback. Failure stops initialization; there is no cloud fallback.
  await Promise.all([9099, 8080, 9199].map(async port => {
    try {
      await fetch(`http://127.0.0.1:${port}/`, { mode: 'no-cors', signal: AbortSignal.timeout(2500) });
    } catch { throw new Error(`개발 Emulator 연결 실패 (${port}). 운영 연결은 차단되어 있습니다.`); }
  }));
}
