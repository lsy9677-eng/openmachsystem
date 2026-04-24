export async function onRequest(context) {
  const CLIENT_ID = "vMR8P7qHK56NBDIiEpqg";
  const REDIRECT_URI = "https://tennis230.pages.dev/naver/callback";

  const state = Math.random().toString(36).substring(2);

  const url = `https://nid.naver.com/oauth2.0/authorize?response_type=code&client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}&state=${state}`;

  return Response.redirect(url, 302); 
}
