// Runs before every Pages Function: local development must never use service credentials.
export async function onRequest({ request, next }) {
  const url = new URL(request.url);
  if (url.origin === 'https://tennis230.pages.dev') return next();
  if (url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
    if (/^\/(?:api|naver|kakao)(?:\/|$)/.test(url.pathname)) {
      return Response.json({ ok: true, success: true, mock: true, path: url.pathname, message: '개발 모의 응답: 실제 OAuth/푸시 전송 없음' }, {
        headers: { 'Cache-Control': 'no-store', 'X-230match-Mode': 'development-mock' }
      });
    }
    let pathname;
    try { pathname = decodeURIComponent(url.pathname); } catch { return new Response('Invalid path', { status: 400 }); }
    if (pathname.split('/').some(segment => segment.startsWith('.')) ||
        /^\/(?:functions|node_modules|tools|tests|docs)(?:\/|$)/.test(pathname) ||
        /^\/(?:package(?:-lock)?\.json|wrangler[^/]*|firebase[^/]*|sw\.js)$/.test(pathname)) {
      return new Response('Not found', { status: 404 });
    }
    // Pages middleware also runs for HTML, scripts and other static assets.
    return next();
  }
  return new Response('Unapproved host', { status: 403 });
}
