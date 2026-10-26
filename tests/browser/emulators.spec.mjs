import { test, expect } from '@playwright/test';
import { auditNetwork } from './network.mjs';

test('synthetic login, persistent session, tournament/result roundtrip, Storage and mock delivery', async ({page, context}) => {
  const forbidden = await auditNetwork(context);
  const errors=[];
  page.on('pageerror', error=>errors.push(error.message));
  await page.addInitScript(() => {
    window.__nativeLocalStorage=window.localStorage;
    window.localStorage.setItem('production-sentinel','preserve');
    window.localStorage.setItem('230match-v3-auth-config',JSON.stringify({firebaseConfigText:JSON.stringify({projectId:'must-never-initialize'})}));
  });
  await page.goto('/');
  await page.evaluate(() => import('/assets/js/bootstrap.js'));
  await expect(page.locator('#development-status')).toBeVisible();
  await expect(page.locator('#environment-error')).toHaveCount(0);
  const login = await page.evaluate(async () => {
    const auth = await import('/assets/js/auth-engine.js?v=3565');
    const result = await auth.signInGoogle();
    return { uid: result.user.uid, project: (await auth.getAuthRuntime()).auth.app.options.projectId };
  });
  expect(login.project).toBe('demo-230match');
  await page.reload();
  await page.evaluate(() => import('/assets/js/bootstrap.js'));
  await expect(page.locator('body')).toHaveAttribute('data-role','admin');
  const restored = await page.evaluate(async () => {
    const a = await import('/assets/js/auth-engine.js?v=3565');
    const rt = await a.getAuthRuntime();
    return { uid: rt.user?.uid, role: await a.roleForUser(rt.user) };
  });
  expect(restored).toEqual({uid:login.uid,role:'admin'});

  const result = await page.evaluate(async () => {
    const {initialState} = await import('/assets/js/store.js?v=5804');
    const sync = await import('/assets/js/sync-engine.js?v=7215');
    const {generateDraw, allMatches} = await import('/assets/js/bracket-engine-v5000.js?v=5000');
    const {submitResult} = await import('/assets/js/result-engine.js?v=5800');
    const state = initialState();
    const id = 'synthetic-' + crypto.randomUUID();
    state.tournament = {id,name:'[LOCAL] Synthetic tournament',division:'Synthetic doubles'};
    state.multiTournament = {activeTournamentId:id,tournaments:[{id,name:state.tournament.name}],noActiveTournament:false};
    state.teams = Array.from({length:32},(_,i)=>({id:`fake-team-${i}`,name:`Fake player ${i*2+1} / Fake player ${i*2+2}`,affiliation:'Synthetic club'}));
    state.operation = {autoAssignmentEnabled:false};
    state.draw = generateDraw(state.teams,32);
    const match = allMatches(state.draw).find(m=>m.teamA&&m.teamB);
    submitResult(state,{matchId:match.id,winnerId:match.teamA.id,scoreA:6,scoreB:2});
    sync.startStateSync({getState:()=>state,applyRemoteState:()=>{},canWrite:()=>true,accessMode:()=> 'operator'});
    await sync.connectCloudSync();
    await sync.pushStateNow(state);
    // Check the manifest and chunks via SDK; clear local cache before the roundtrip.
    const rt = await (await import('/assets/js/auth-engine.js?v=3565')).getAuthRuntime();
    const manifest = await rt.api.getDoc(rt.api.doc(rt.db,'matchRoomsV7','230match-development','tournaments',id));
    const loaded = await sync.loadTournamentNow(id);
    const saved = allMatches(loaded.state.draw).find(m=>m.id===match.id);
    sync.disconnectCloudSync(false);
    return {id,exists:manifest.exists(),chunks:manifest.data().workspaceChunks.length,name:loaded.state.tournament.name,status:saved.status,score:saved.scoreA,source:loaded.source};
  });
  expect(result.exists).toBe(true);
  expect(result.chunks).toBeGreaterThan(0);
  expect(result.status).toBe('completed');
  expect(result.score).toBe(6);
  expect(result.name).toBe('[LOCAL] Synthetic tournament');
  expect(result.source).not.toBe('cache');

  const image = await page.evaluate(async () => {
    const {uploadManagedImage} = await import('/assets/js/storage-image-engine.js?v=7133');
    const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a2ioAAAAASUVORK5CYII=';
    const uploaded = await uploadManagedImage({folder:'synthetic',ownerId:'local-test',dataUrl:png,fileName:'pixel.png',contentType:'image/png'});
    const downloaded = await fetch(uploaded.url);
    const link=document.createElement('a');link.id='synthetic-notice-download';link.setAttribute('data-notice-native-download','');
    link.href='/api/notice-image-download?url='+encodeURIComponent(uploaded.url)+'&name=pixel.png';link.textContent='Synthetic image download';document.body.append(link);
    return {host:new URL(uploaded.url).host,size:(await downloaded.blob()).size,uploadedSize:uploaded.size,ok:downloaded.ok};
  });
  expect(image.host).toBe('127.0.0.1:9199');
  expect(image.ok).toBe(true);
  expect(image.size).toBe(image.uploadedSize);
  const downloadPromise=page.waitForEvent('download');
  await page.locator('#synthetic-notice-download').evaluate(link=>link.click());
  const download=await downloadPromise;
  expect(download.suggestedFilename()).toBe('pixel.png');
  expect(await download.failure()).toBeNull();

  const mocks = await page.evaluate(async () => {
    const push = await import('/assets/js/notification-engine.js?v=332012');
    const {createAligoSender} = await import('/assets/js/modules/aligo-client.js?v=5104');
    await push.enableMyPush({});
    await push.queuePush({}, {title:'Synthetic notification'});
    const sender=createAligoSender({proxyUrl:'https://must-never-be-called.invalid',clientKey:'fake',normalizePhone:x=>x,prepareBody:x=>x,fetchImpl:()=>{throw Error('Real SMS called');}});
    const sms=await sender([{phone:'01000000000'}],'Synthetic text');
    await (await import('/assets/js/auth-engine.js?v=3565')).mockOAuth('naver');
    await (await import('/assets/js/auth-engine.js?v=3565')).mockOAuth('kakao');
    const registrations=await navigator.serviceWorker.getRegistrations();
    return {sms:sms.mock,events:window.__230matchMocks.map(x=>x.kind),sw:registrations.length};
  });
  expect(mocks.sms).toBe(true);
  expect(mocks.sw).toBe(0);
  expect(mocks.events.filter(x=>x==='OAuth')).toHaveLength(2);
  const isolation=await page.evaluate(async()=>{
    localStorage.setItem('isolation-check','development');
    await (await caches.open('test-cache')).put('/test-cache',new Response('demo'));
    return { sentinel:window.__nativeLocalStorage.getItem('production-sentinel'), native:window.__nativeLocalStorage.getItem('isolation-check'), local:localStorage.getItem('isolation-check'), dbs:(await indexedDB.databases()).map(x=>x.name), caches:await caches.keys() };
  });
  expect(isolation.sentinel).toBe('preserve');
  expect(isolation.native).toBeNull();
  expect(isolation.local).toBe('development');
  expect(isolation.dbs.length).toBeGreaterThan(0);
  expect(isolation.dbs.every(name=>name.startsWith('230match:dev:demo-230match:'))).toBe(true);
  expect(isolation.caches.every(name=>name.startsWith('230match:dev:demo-230match:'))).toBe(true);
  expect(errors).toEqual([]);
  expect(forbidden).toEqual([]);
});

test('connection lost after login stays local; mock delivery still makes no external request',async({page,context})=>{
  const forbidden=await auditNetwork(context);
  await page.goto('/');
  await page.evaluate(()=>import('/assets/js/bootstrap.js'));
  await page.evaluate(async()=>{await(await import('/assets/js/auth-engine.js?v=3565')).signInGoogle();});
  await page.route(/http:\/\/127\.0\.0\.1:(9099|8080|9199)\//,route=>route.abort());
  const result=await page.evaluate(async()=>{
    let code;
    try{await(await import('/assets/js/auth-engine.js?v=3565')).signInEmail('offline@example.test','Fake-password-230');}
    catch(error){code=error.code;}
    const push=await(await import('/assets/js/notification-engine.js?v=332012')).queuePush({}, {title:'Offline mock'});
    let blocked=false;
    try{await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword');}catch{blocked=true;}
    return {code,push,blocked};
  });
  expect(result.code).toBe('auth/network-request-failed');
  expect(result.push).toMatch(/^mock-/);
  expect(result.blocked).toBe(true);
  expect(forbidden).toEqual([]);
});
