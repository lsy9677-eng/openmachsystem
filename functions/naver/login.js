export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const clientId = env.NAVER_CLIENT_ID || "vMR8P7qHK56NBDIiEpqg";
  const redirectUri = env.NAVER_REDIRECT_URI || `${url.origin}/naver/callback`;
  const requestedReturnUrl = url.searchParams.get('returnUrl') || `${url.origin}/`;

  let returnUrl;
  try {
    const parsed = new URL(requestedReturnUrl, url.origin);
    // Open redirect 방지: 현재 배포 도메인 내부 경로만 허용
    returnUrl = parsed.origin === url.origin ? parsed.toString() : `${url.origin}/`;
  } catch (_) {
    returnUrl = `${url.origin}/`;
  }

  const state = btoa(unescape(encodeURIComponent(JSON.stringify({
    returnUrl,
    nonce: crypto.randomUUID(),
    createdAt: Date.now()
  }))));

  const authUrl = new URL('https://nid.naver.com/oauth2.0/authorize');
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('state', state);

  return Response.redirect(authUrl.toString(), 302);
}

export async function onRequest(context) {
  return onRequestGet(context);
}
