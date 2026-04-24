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

  // 기본값을 profile_nickname만 요청하도록 변경.
  // account_email 권한이 없는 앱에서 account_email을 요청하면 KOE205가 발생할 수 있음.
  // 나중에 이메일 권한을 승인받으면 Cloudflare 환경변수 KAKAO_SCOPE에
  // profile_nickname,account_email 형태로 직접 넣으면 됨.
  const scope = env.KAKAO_SCOPE || 'profile_nickname';

  const state = btoa(unescape(encodeURIComponent(JSON.stringify({ returnUrl }))));

  const authUrl = new URL('https://kauth.kakao.com/oauth/authorize');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('state', state);
  if (scope) authUrl.searchParams.set('scope', scope);

  return Response.redirect(authUrl.toString(), 302);
}
