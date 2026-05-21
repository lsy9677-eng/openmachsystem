const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'content-type, authorization'
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { ...CORS_HEADERS, 'content-type': 'application/json; charset=utf-8' }
  });
}

function base64Url(input) {
  let bytes = input instanceof Uint8Array ? input : new TextEncoder().encode(input);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function pemToArrayBuffer(pem) {
  const clean = String(pem || '')
    .replace(/\\n/g, '\n')
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s+/g, '');
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function getGoogleAccessToken(env) {
  const projectId = env.FIREBASE_PROJECT_ID;
  const clientEmail = env.FIREBASE_CLIENT_EMAIL;
  const privateKey = env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Cloudflare Secret 누락: FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY');
  }

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claim = {
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600
  };

  const unsigned = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(claim))}`;
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(privateKey),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned));
  const jwt = `${unsigned}.${base64Url(new Uint8Array(signature))}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt
    })
  });

  const data = await res.json();
  if (!res.ok || !data.access_token) {
    throw new Error(`Google access token 발급 실패: ${JSON.stringify(data)}`);
  }
  return data.access_token;
}

function fromFirestoreValue(v) {
  if (!v || typeof v !== 'object') return undefined;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue || 0);
  if ('doubleValue' in v) return Number(v.doubleValue || 0);
  if ('booleanValue' in v) return !!v.booleanValue;
  if ('timestampValue' in v) return v.timestampValue;
  if ('nullValue' in v) return null;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(fromFirestoreValue);
  if ('mapValue' in v) {
    const out = {};
    const fields = v.mapValue.fields || {};
    for (const [k, val] of Object.entries(fields)) out[k] = fromFirestoreValue(val);
    return out;
  }
  return undefined;
}

function docToObject(doc) {
  const out = { __name: doc.name, __id: String(doc.name || '').split('/').pop() };
  const fields = doc.fields || {};
  for (const [k, v] of Object.entries(fields)) out[k] = fromFirestoreValue(v);
  return out;
}

function toFirestoreValue(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toFirestoreValue) } };
  if (typeof v === 'object') {
    const fields = {};
    for (const [k, val] of Object.entries(v)) fields[k] = toFirestoreValue(val);
    return { mapValue: { fields } };
  }
  return { stringValue: String(v) };
}

function toFirestoreFields(obj) {
  const fields = {};
  for (const [k, v] of Object.entries(obj || {})) fields[k] = toFirestoreValue(v);
  return fields;
}

async function listCollection(env, accessToken, collectionName, pageSize = 100) {
  const projectId = env.FIREBASE_PROJECT_ID;
  let url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collectionName}?pageSize=${pageSize}`;
  const out = [];
  for (let guard = 0; guard < 20 && url; guard++) {
    const res = await fetch(url, { headers: { authorization: `Bearer ${accessToken}` } });
    const data = await res.json();
    if (!res.ok) throw new Error(`${collectionName} 읽기 실패: ${JSON.stringify(data)}`);
    (data.documents || []).forEach(doc => out.push(docToObject(doc)));
    url = data.nextPageToken
      ? `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collectionName}?pageSize=${pageSize}&pageToken=${encodeURIComponent(data.nextPageToken)}`
      : '';
  }
  return out;
}

async function patchDocument(env, accessToken, docName, fields) {
  const masks = Object.keys(fields || {}).map(k => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join('&');
  const res = await fetch(`https://firestore.googleapis.com/v1/${docName}${masks ? '?' + masks : ''}`, {
    method: 'PATCH',
    headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ fields: toFirestoreFields(fields) })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Firestore 업데이트 실패: ${JSON.stringify(data)}`);
  return data;
}

async function sendFcm(env, accessToken, token, title, body, data = {}) {
  const projectId = env.FIREBASE_PROJECT_ID;
  const stringData = {};
  for (const [k, v] of Object.entries(data || {})) stringData[k] = String(v ?? '');

  const res = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
    method: 'POST',
    headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      message: {
        token,
        notification: { title, body },
        data: stringData,
        webpush: {
          fcm_options: { link: stringData.url || '/' },
          notification: {
            icon: '/icon-192.png',
            badge: '/icon-192.png',
            tag: stringData.tag || `230match-${stringData.matchId || Date.now()}`,
            renotify: true
          }
        }
      }
    })
  });
  const result = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, result };
}

function normalizeDigits(v) { return String(v || '').replace(/[^0-9]/g, ''); }
function normalizeText(v) { return String(v || '').trim().toLowerCase(); }
function intersects(a = [], b = []) {
  const set = new Set((a || []).map(normalizeText).filter(Boolean));
  return (b || []).some(x => set.has(normalizeText(x)));
}
function phoneIntersects(a = [], b = []) {
  const set = new Set((a || []).map(normalizeDigits).filter(Boolean));
  return (b || []).some(x => set.has(normalizeDigits(x)));
}

export { CORS_HEADERS, jsonResponse, getGoogleAccessToken, listCollection, patchDocument, sendFcm, phoneIntersects, intersects, normalizeText };
