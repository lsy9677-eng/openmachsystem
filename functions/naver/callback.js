export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const CLIENT_ID = "vMR8P7qHK56NBDIiEpqg";
  const CLIENT_SECRET = "QHCMiQsekX";
  const REDIRECT_URI = "https://tennis230.pages.dev/naver/callback";

  const tokenRes = await fetch("https://nid.naver.com/oauth2.0/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code: code,
      state: state
    })
  });

  const tokenData = await tokenRes.json();

  const profileRes = await fetch("https://openapi.naver.com/v1/nid/me", {
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`
    }
  });

  const profile = await profileRes.json();

  return new Response(`
    <script>
      window.opener.postMessage(${JSON.stringify(profile)}, "*");
      window.close();
    </script>
  `, {
    headers: { "Content-Type": "text/html" }
  });
}
