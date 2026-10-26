import { isDevelopment, mode, mockAction } from './environment.js';

// This module executes before the application graph and its top-level storage reads.
if (isDevelopment && typeof window !== 'undefined') {
  const prefix = '230match:dev:demo-230match:';
  function isolatedStorage(native) {
    const methods = {
      getItem: key => native.getItem(prefix + key),
      setItem: (key, value) => native.setItem(prefix + key, value),
      removeItem: key => native.removeItem(prefix + key),
      clear: () => keys().forEach(key => native.removeItem(prefix + key)),
      key: index => keys()[index] ?? null
    };
    function keys() { return Array.from({ length: native.length }, (_, i) => native.key(i)).filter(k => k?.startsWith(prefix)).map(k => k.slice(prefix.length)); }
    return new Proxy(methods, {
      get: (target, key) => key === 'length' ? keys().length : key in target ? target[key] : native.getItem(prefix + String(key)),
      set: (_, key, value) => { native.setItem(prefix + String(key), value); return true; },
      ownKeys: () => keys(), getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true })
    });
  }
  for (const name of ['localStorage', 'sessionStorage']) Object.defineProperty(window, name, { value: isolatedStorage(window[name]), configurable: true });
  for (const method of ['open', 'deleteDatabase']) {
    const original = indexedDB[method].bind(indexedDB);
    indexedDB[method] = (name, ...args) => original(prefix + name, ...args);
  }
  // Any development Cache Storage writes also receive the project namespace.
  if ('caches' in window) {
    const open = caches.open.bind(caches);
    caches.open = name => open(prefix + name);
  }
  const originalFetch = window.fetch.bind(window);
  window.fetch = (input, options) => {
    const url = new URL(input instanceof Request ? input.url : input, location.href);
    if (url.origin === location.origin && /^\/(?:api|naver|kakao)\//.test(url.pathname)) {
      return Promise.resolve(Response.json({ ok: true, success: true, mock: true, ...mockAction('로컬 API', { path: url.pathname }) }));
    }
    if (url.protocol === 'data:' || url.protocol === 'blob:' || url.origin === location.origin ||
        (url.protocol === 'http:' && url.hostname === '127.0.0.1' && ['9099', '8080', '9199'].includes(url.port))) return originalFetch(input, options);
    return Promise.reject(new Error('개발 환경 외부 요청 차단: ' + url.origin));
  };
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register = () => Promise.reject(new Error('개발 모드에서는 서비스 워커를 등록하지 않습니다.'));
    // Old local registrations must not control this session's network.
    await Promise.all((await navigator.serviceWorker.getRegistrations()).map(reg => reg.unregister()));
    if (navigator.serviceWorker.controller) throw new Error('기존 로컬 서비스 워커를 해제했습니다. 창을 닫고 다시 접속하세요.');
  }
  document.addEventListener('click', event => {
    const link = event.target.closest?.('a[href]');
    if (link && /^(sms:|intent:)/i.test(link.getAttribute('href'))) { event.preventDefault(); event.stopImmediatePropagation(); mockAction('문자앱'); }
    if (link?.hasAttribute('data-notice-native-download')) {
      event.preventDefault(); event.stopImmediatePropagation();
      const url = new URL(link.href, location.href);
      const source = url.pathname === '/api/notice-image-download' ? url.searchParams.get('url') : link.href;
      // Fetch is guarded above: only Emulator images/data/blob are downloadable locally.
      void (async () => {
        const response = await fetch(source);
        if (!response.ok) throw new Error('개발 이미지 다운로드 실패');
        const blob = URL.createObjectURL(await response.blob());
        const save = document.createElement('a');
        save.href = blob; save.download = url.searchParams.get('name') || link.download || 'local-image.png';
        document.body.append(save); save.click(); save.remove();
        setTimeout(() => URL.revokeObjectURL(blob), 2500);
      })().catch(error => mockAction('이미지 다운로드 실패', { message: error.message }));
    }
  }, true);
  const badge = document.createElement('div');
  badge.id = 'development-status';
  badge.setAttribute('role', 'status');
  badge.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:2147483647;background:#713f12;color:white;padding:8px;text-align:center;font:14px sans-serif';
  badge.textContent = '개발 · demo-230match Emulator · OAuth/푸시/문자는 모의 처리 · 실제 전송 없음';
  document.body.append(badge);
}
export { mode };
