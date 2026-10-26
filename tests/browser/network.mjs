export async function auditNetwork(context) {
  const forbidden = [];
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (['127.0.0.1', 'localhost'].includes(url.hostname) ||
        (url.origin === 'https://www.gstatic.com' && url.pathname.startsWith('/firebasejs/10.12.0/'))) return route.continue();
    // Even a failing test cannot send a request to production.
    forbidden.push(url.origin + url.pathname);
    return route.abort('blockedbyclient');
  });
  return forbidden;
}
