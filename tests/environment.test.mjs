import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyEnvironment, firebaseConfig } from '../assets/js/environment.js';
import { onRequest } from '../functions/_middleware.js';
import { localProcessEnvironment } from '../tools/pages-local.mjs';

test('only the confirmed HTTPS production origin is production', () => {
  assert.equal(classifyEnvironment('https://tennis230.pages.dev/'), 'production');
  for (const host of ['http://tennis230.pages.dev', 'https://tennis230.pages.dev:444', 'https://preview.tennis230.pages.dev', 'https://tennis230.pages.dev.evil.test', 'https://unknown.test', 'file:///index.html', 'https://localhost']) {
    assert.throws(() => classifyEnvironment(host));
  }
  for (const host of ['http://localhost:8000', 'http://127.0.0.1:8000', 'http://[::1]:8000']) assert.equal(classifyEnvironment(host), 'development');
});
test('Wrangler runner strips inherited credentials and disables process-env binding',()=>{
  const names=['FIREBASE_PROJECT_ID','FIREBASE_CLIENT_EMAIL','FIREBASE_PRIVATE_KEY','GOOGLE_APPLICATION_CREDENTIALS','CLOUDFLARE_API_KEY','CLOUDFLARE_API_TOKEN','NAVER_CLIENT_ID','KAKAO_REST_API_KEY','ALIGO_API_KEY','SMS_CLIENT_KEY','DEBUG'];
  const env=localProcessEnvironment(Object.fromEntries(names.map(name=>[name,'synthetic-not-a-secret'])));
  for(const name of names)assert.equal(Object.hasOwn(env,name),false,name);
  assert.equal(env.WRANGLER_SEND_METRICS,'false');
  assert.equal(env.CLOUDFLARE_INCLUDE_PROCESS_ENV,'false');
});
test('local configuration ignores even a saved production override', () => {
  assert.equal(firebaseConfig({ projectId: 'must-not-be-used' }).projectId, 'demo-230match');
});
test('Pages middleware never reads local credentials or invokes production handlers', async () => {
  const env = new Proxy({}, { get() { throw Error('Credentials accessed'); } });
  for (const endpoint of ['/api/send-push', '/api/process-push-queue', '/naver/callback', '/kakao/login']) {
    const response = await onRequest({ request: new Request('http://127.0.0.1:8788' + endpoint), env, next() { throw Error('Production handler reached'); } });
    assert.equal((await response.json()).mock, true);
  }
  assert.equal((await onRequest({request: new Request('https://unknown.test/api/send-push'), next() { throw Error(); }})).status, 403);
  assert.equal(await onRequest({request: new Request('https://tennis230.pages.dev/api/send-push'), next: () => 'existing-production-handler'}), 'existing-production-handler');
  for (const endpoint of ['/', '/index.html', '/assets/js/bootstrap.js', '/assets/css/portal.css', '/manifest.json']) {
    assert.equal(await onRequest({request: new Request('http://localhost:8788'+endpoint), next: () => 'static-asset'}), 'static-asset');
  }
});
