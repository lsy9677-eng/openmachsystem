import { CORS_HEADERS, jsonResponse, getGoogleAccessToken, sendFcm } from '../_lib/common.js';

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json();
    const token = String(body.token || '').trim();
    if (!token) return jsonResponse({ ok: false, error: 'token required' }, 400);

    const accessToken = await getGoogleAccessToken(env);
    const result = await sendFcm(
      env,
      accessToken,
      token,
      body.title || '230MATCH 테스트 알림',
      body.body || '푸시알림 테스트입니다.',
      body.data || { type: 'test', url: '/' }
    );

    return jsonResponse({ ok: result.ok, status: result.status, result: result.result }, result.ok ? 200 : 500);
  } catch (error) {
    return jsonResponse({ ok: false, error: String(error && error.message || error) }, 500);
  }
}
