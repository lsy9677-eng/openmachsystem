import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync, execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

test('production runtime retains configuration, retry behavior and has no development side effects (fake SDK only)',()=>{
  const result=spawnSync(process.execPath,['--input-type=module','-e',`
    import assert from 'node:assert/strict';
    globalThis.location={href:'https://tennis230.pages.dev/',origin:'https://tennis230.pages.dev'};
    globalThis.fetch=()=>{throw Error('Network is forbidden in this test');};
    const marker={};globalThis.window={localStorage:marker};
    await import('./assets/js/development-guard.js');
    assert.equal(window.localStorage,marker);
    const env=await import('./assets/js/environment.js');
    assert.equal(env.isDevelopment,false);
    const config={projectId:'synthetic-production-config',storageBucket:'synthetic-bucket'};
    assert.equal(env.firebaseConfig(config),config);
    const {getFirebaseRuntime,connectLocalStorage}=await import('./assets/js/firebase-runtime.js');
    const apps=new Map();let fail=true,persistenceCalls=0;
    const api={getApp:name=>{if(!apps.has(name))throw Error('not found');return apps.get(name)},initializeApp:(options,name)=>{const app={options};apps.set(name,app);return app;},getAuth:app=>({app}),getFirestore:app=>({app}),browserLocalPersistence:'fake-persistence',setPersistence:async()=>{persistenceCalls++;if(fail){fail=false;throw Error('synthetic failure');}},connectAuthEmulator:()=>{throw Error('Production Emulator connection');},connectFirestoreEmulator:()=>{throw Error('Production Emulator connection');},connectStorageEmulator:()=>{throw Error('Production Emulator connection');}};
    await assert.rejects(getFirebaseRuntime(api,config),/synthetic failure/);
    assert.equal((await getFirebaseRuntime(api,config)).app.options,config);
    const other={projectId:'synthetic-other-config'};
    assert.equal((await getFirebaseRuntime(api,other)).app.options,other);
    assert.equal(persistenceCalls,3);
    assert.equal(connectLocalStorage(api,marker),marker);
    let assigned='';globalThis.document={head:{append(){throw Error('Production CSP injected');}},createElement(){throw Error('Production DOM changed');}};
    await import('./assets/js/host-policy.js');
    globalThis.location={set href(value){assigned=value;}};
    env.openSmsComposer('sms:01000000000?body=synthetic');
    assert.equal(assigned,'sms:01000000000?body=synthetic');
  `],{encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);
});

test('existing production Functions, headers and public Firebase defaults remain unchanged from base commit',()=>{
  const files=execFileSync('git',['ls-tree','-r','--name-only','ff91192','functions'],{encoding:'utf8'}).trim().split(/\r?\n/);
  for(const file of [...files,'_headers']) {
    assert.equal(readFileSync(file,'utf8').replace(/\r\n/g,'\n'),execFileSync('git',['show',`ff91192:${file}`],{encoding:'utf8'}).replace(/\r\n/g,'\n'),file);
  }
  for(const file of ['assets/js/auth-engine.js','firebase-messaging-sw.js']) {
    const before=execFileSync('git',['show',`ff91192:${file}`],{encoding:'utf8'});
    const after=readFileSync(file,'utf8');
    const pattern=file.endsWith('auth-engine.js') ? /const DEFAULT_FIREBASE=([^;]+);/ : /firebase\.initializeApp\((\{[\s\S]*?\})\);/;
    assert.ok(after.match(pattern)?.[1]?.replace(/\r\n/g,'\n')===before.match(pattern)?.[1]?.replace(/\r\n/g,'\n'),file+' Firebase configuration changed');
  }
});
