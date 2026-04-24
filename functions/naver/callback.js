function base64UrlEncode(input) {
  let bytes;
  if (typeof input === "string") {
    bytes = new TextEncoder().encode(input);
  } else { 
    bytes = input;
  }

  let binary = "";
  const arr = new Uint8Array(bytes);
  for (let i = 0; i < arr.length; i++) {
    binary += String.fromCharCode(arr[i]);
  }

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function pemToArrayBuffer(pem) {
  const clean = String(pem || "")
    .replace(/\\n/g, "\n")
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s+/g, "");

  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes.buffer;
}

async function signJwt(payload, privateKeyPem) {
  const header = {
    alg: "RS256",
    typ: "JWT"
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const unsignedToken = `${encodedHeader}.${encodedPayload}`;

  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(privateKeyPem),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsignedToken)
  );

  return `${unsignedToken}.${base64UrlEncode(signature)}`;
}

async function createFirebaseCustomToken(env, uid, claims = {}) {
  const clientEmail = env.FIREBASE_CLIENT_EMAIL;
  const privateKey = env.FIREBASE_PRIVATE_KEY;

  if (!clientEmail || !privateKey) {
    throw new Error("Missing FIREBASE_CLIENT_EMAIL or FIREBASE_PRIVATE_KEY");
  }

  const now = Math.floor(Date.now() / 1000);

  const payload = {
    iss: clientEmail,
    sub: clientEmail,
    aud: "https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit",
    iat: now,
    exp: now + 3600,
    uid,
    claims
  };

  // 중요: 여기서 Firebase REST API로 idToken으로 바꾸면 안 됩니다.
  // 브라우저의 signInWithCustomToken()에는 이 signed custom token 자체를 넘겨야 합니다.
  return await signJwt(payload, privateKey);
}

function redirectWithHash(returnUrl, params) {
  const doneUrl = new URL(returnUrl);
  doneUrl.hash = new URLSearchParams(params).toString();
  return Response.redirect(doneUrl.toString(), 302);
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  let returnUrl = "https://tennis230.pages.dev/";

  try {
    if (!code || !state) {
      throw new Error("Missing code/state");
    }

    try {
      const decoded = JSON.parse(decodeURIComponent(escape(atob(state))));
      if (decoded && decoded.returnUrl) {
        returnUrl = decoded.returnUrl;
      }
    } catch (_) {}

    const redirectUri = "https://tennis230.pages.dev/naver/callback";

    if (!env.NAVER_CLIENT_ID || !env.NAVER_CLIENT_SECRET) {
      throw new Error("Missing NAVER_CLIENT_ID or NAVER_CLIENT_SECRET");
    }

    const tokenRes = await fetch("https://nid.naver.com/oauth2.0/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: env.NAVER_CLIENT_ID,
        client_secret: env.NAVER_CLIENT_SECRET,
        redirect_uri: redirectUri,
        code,
        state
      })
    });

    const tokenData = await tokenRes.json();

    if (!tokenRes.ok || !tokenData.access_token) {
      throw new Error(tokenData.error_description || tokenData.error || "Naver token exchange failed");
    }

    const profileRes = await fetch("https://openapi.naver.com/v1/nid/me", {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`
      }
    });

    const profile = await profileRes.json();

    if (!profileRes.ok || profile.resultcode !== "00" || !profile.response || !profile.response.id) {
      throw new Error("Naver profile request failed");
    }

    const naver = profile.response;
    const uid = `naver:${naver.id}`;

    const customToken = await createFirebaseCustomToken(env, uid, {
      provider: "naver",
      naverId: naver.id,
      email: naver.email || "",
      name: naver.name || "",
      phone: naver.mobile || ""
    });

    return redirectWithHash(returnUrl, {
      provider: "naver",
      customToken
    });
  } catch (err) {
    return redirectWithHash(returnUrl, {
      provider: "naver",
      error: err && err.message ? err.message : String(err)
    });
  }
}
