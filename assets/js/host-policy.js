// Classic blocking script: apply network policy before any app/CDN module is loaded.
(() => {
  const production = location.origin === 'https://tennis230.pages.dev';
  if (production) return;
  const local = location.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  const policy = document.createElement('meta');
  policy.httpEquiv = 'Content-Security-Policy';
  policy.content = local
    ? "default-src 'self'; script-src 'self' 'unsafe-inline' https://www.gstatic.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: http://127.0.0.1:9199; connect-src 'self' data: blob: http://127.0.0.1:9099 http://127.0.0.1:8080 http://127.0.0.1:9199; worker-src blob:; frame-src 'none'; object-src 'none'; base-uri 'self'; form-action 'self'"
    : "default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; connect-src 'none'; worker-src 'none'; form-action 'none'";
  document.head.append(policy);
})();
