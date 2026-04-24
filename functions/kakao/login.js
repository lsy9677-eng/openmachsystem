export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const clientId = env.KAKAO_REST_API_KEY;
  if (!clientId) {
    return new Response('Missing KAKAO_REST_API_KEY environment variable', { status: 500 });
  }

  const origin = url.origin;
  const redirectUri = env.KAKAO_REDIRECT_URI || `${origin}/kakao/callback`;
  const returnUrl = url.searchParams.get('returnUrl') || `${origin}/`;
  const scope = env.KAKAO_SCOPE || 'profile_nickname,account_email';
  const state = btoa(unescape(encodeURIComponent(JSON.stringify({ returnUrl }))));

  const authUrl = new URL('https://kauth.kakao.com/oauth/authorize');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('state', state);
  if (scope) authUrl.searchParams.set('scope', scope);

  return Response.redirect(authUrl.toString(), 302);
}
