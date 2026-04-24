function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

function base64UrlEncode(input) {
  let bytes;
  if (typeof input === 'string') bytes = new TextEncoder().encode(input);
  else bytes = new Uint8Array(input);
  let binary = '';
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function decodeState(raw, fallbackReturnUrl) {
  try {
    if (!raw) return { returnUrl: fallbackReturnUrl };
    const text = decodeURIComponent(escape(atob(raw)));
    const parsed = JSON.parse(text);
    return { returnUrl: parsed.returnUrl || fallbackReturnUrl };
  } catch (_) {
    return { returnUrl: fallbackReturnUrl };
  }
}

function normalizePrivateKey(pem) {
  return String(pem || '').replace(/\\n/g, '\n');
}

async function importPrivateKey(pem) {
  const clean = normalizePrivateKey(pem)
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s+/g, '');
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return crypto.subtle.importKey(
    'pkcs8',
    bytes.buffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
}

async function createFirebaseCustomToken(env, uid, claims = {}) {
  const projectId = env.FIREBASE_PROJECT_ID;
  const clientEmail = env.FIREBASE_CLIENT_EMAIL;
  const privateKey = env.FIREBASE_PRIVATE_KEY;
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Missing Firebase service account environment variables');
  }

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: clientEmail,
    sub: clientEmail,
    aud: 'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit',
    iat: now,
    exp: now + 3600,
    uid: String(uid).slice(0, 128),
    claims,
  };

  const unsigned = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(JSON.stringify(payload))}`;
  const key = await importPrivateKey(privateKey);
  const signature = await crypto.subtle.sign(
    { name: 'RSASSA-PKCS1-v1_5' },
    key,
    new TextEncoder().encode(unsigned)
  );
  return `${unsigned}.${base64UrlEncode(signature)}`;
}

function safeRedirect(returnUrl, origin) {
  try {
    const u = new URL(returnUrl, origin);
    if (u.origin !== origin) return `${origin}/`;
    return u.toString();
  } catch (_) {
    return `${origin}/`;
  }
}

function redirectWithHash(baseUrl, params) {
  const qs = new URLSearchParams(params);
  return Response.redirect(`${baseUrl}#${qs.toString()}`, 302);
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const origin = url.origin;
  const fallbackReturnUrl = `${origin}/`;
  const { returnUrl } = decodeState(url.searchParams.get('state'), fallbackReturnUrl);
  const finalReturnUrl = safeRedirect(returnUrl, origin);

  const error = url.searchParams.get('error');
  if (error) {
    return redirectWithHash(finalReturnUrl, {
      provider: 'kakao',
      error: `${error}: ${url.searchParams.get('error_description') || ''}`,
    });
  }

  const code = url.searchParams.get('code');
  if (!code) {
    return redirectWithHash(finalReturnUrl, { provider: 'kakao', error: 'missing_code' });
  }

  try {
    const clientId = env.KAKAO_REST_API_KEY;
    if (!clientId) throw new Error('Missing KAKAO_REST_API_KEY');
    const redirectUri = env.KAKAO_REDIRECT_URI || `${origin}/kakao/callback`;

    const tokenBody = new URLSearchParams();
    tokenBody.set('grant_type', 'authorization_code');
    tokenBody.set('client_id', clientId);
    tokenBody.set('redirect_uri', redirectUri);
    tokenBody.set('code', code);
    if (env.KAKAO_CLIENT_SECRET) tokenBody.set('client_secret', env.KAKAO_CLIENT_SECRET);

    const tokenRes = await fetch('https://kauth.kakao.com/oauth/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded;charset=utf-8' },
      body: tokenBody,
    });
    const tokenJson = await tokenRes.json();
    if (!tokenRes.ok || !tokenJson.access_token) {
      return jsonResponse({ ok: false, error: 'Failed to exchange Kakao code', detail: tokenJson }, 400);
    }

    const meRes = await fetch('https://kapi.kakao.com/v2/user/me', {
      headers: { Authorization: `Bearer ${tokenJson.access_token}` },
    });
    const me = await meRes.json();
    if (!meRes.ok || !me.id) {
      return jsonResponse({ ok: false, error: 'Failed to read Kakao user profile', detail: me }, 400);
    }

    const account = me.kakao_account || {};
    const profile = account.profile || {};
    const socialId = String(me.id);
    const email = account.email || `kakao_${socialId}@kakao.local`;
    const name = profile.nickname || account.name || '';
    const phone = account.phone_number || '';
    const uid = `kakao:${socialId}`;

    const customToken = await createFirebaseCustomToken(env, uid, {
      provider: 'kakao',
      kakaoId: socialId,
      email,
      name,
      phone,
    });

    return redirectWithHash(finalReturnUrl, {
      customToken,
      provider: 'kakao',
      socialName: name,
      socialEmail: email,
      socialPhone: phone,
      socialProviderId: socialId,
    });
  } catch (err) {
    return redirectWithHash(finalReturnUrl, {
      provider: 'kakao',
      error: err?.message || String(err),
    });
  }
}
