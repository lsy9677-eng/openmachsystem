import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { readFile, stat } from 'node:fs/promises';
import { Miniflare } from 'miniflare';

const stage=process.env.PAGES_TEST_STAGE;
const base=process.env.PAGES_TEST_URL;
if(!stage||!base)throw Error('Run npm run test:pages to prepare isolated Wrangler');
const routes=['/api/send-push','/api/process-push-queue','/api/notice-image-download','/naver/login','/naver/callback','/kakao/login','/kakao/callback'];

test('real wrangler pages dev HTTP routes and static assets, no production credentials',async()=>{
  for(const [route,type]of [['/','text/html'],['/assets/js/bootstrap.js','javascript'],['/assets/css/portal.css','text/css'],['/manifest.json','application/json']]){
    const response=await fetch(base+route,{redirect:'manual'});
    assert.equal(response.status,200,route);assert.match(response.headers.get('content-type'),new RegExp(type));
    assert.equal(response.headers.get('x-230match-mode'),null);await response.arrayBuffer();
  }
  for(const route of routes)for(const method of ['GET','POST','OPTIONS']){
    const response=await fetch(base+route,{method,redirect:'manual',...(method==='POST'?{body:JSON.stringify({token:'fake-token',targetPhones:['01000000000']}),headers:{'content-type':'application/json'}}:{})});
    assert.equal(response.status,200,method+' '+route);
    assert.equal(response.headers.get('location'),null);
    assert.equal(response.headers.get('x-230match-mode'),'development-mock');
    const result=await response.json();assert.equal(result.mock,true);assert.equal(result.path,route);
  }
  for(const privatePath of ['/.dev.vars','/.env','/.git/config','/functions/_lib/common.js','/node_modules/wrangler/package.json','/package.json','/firebase-messaging-sw.js','/assets/js/..%2F..%2Fpackage.json']){
    const response=await fetch(base+privatePath);assert.equal(response.status,404,privatePath);await response.arrayBuffer();
  }
  assert.equal((await stat(path.join(stage,'.dev.vars'))).size,0);
  assert.equal((await stat(path.join(stage,'.env'))).size,0);
  const config=JSON.parse(await readFile(path.join(stage,'wrangler.json'),'utf8'));
  assert.equal(config.vars,undefined);assert.equal(config.secrets,undefined);
  const spoof=await fetch(base+'/naver/login',{headers:{Host:'tennis230.pages.dev','X-Forwarded-Proto':'https','X-Forwarded-Host':'tennis230.pages.dev'},redirect:'manual'});
  // Wrangler's proxy may normalize Host back to loopback; either safe outcome is valid.
  assert.ok([200,403].includes(spoof.status));assert.equal(spoof.headers.get('location'),null);
  if(spoof.status===200){assert.equal(spoof.headers.get('x-230match-mode'),'development-mock');assert.equal((await spoof.json()).mock,true);}else await spoof.arrayBuffer();
});

test('Wrangler compiled router in workerd: intercept ALL outbound fetches; mock paths make none',async()=>{
  const outgoing=[];
  // Wrangler's outfile is a multipart module bundle, not plain JavaScript.
  const bundle=await readFile(path.join(stage,'worker.bundle'));
  const boundary=bundle.subarray(0,bundle.indexOf('\r\n')).toString().slice(2);
  const form=await new Response(bundle,{headers:{'content-type':'multipart/form-data; boundary='+boundary}}).formData();
  const metadata=JSON.parse(form.get('metadata'));
  const modules={};
  for(const [name,file]of form)if(name!=='metadata')modules[name]={type:'esm',contents:await file.text()};
  const mf=new Miniflare({
    telemetry:{enabled:false},
    workers:[{
      config:{name:'230match-functions-test',compatibilityDate:'2026-10-26',manifest:{mainModule:metadata.main_module,modules},
        env:{ASSETS:{type:'fetcher',handler:()=>new Response('static-sentinel')}}},
      dev:{outboundService:{type:'fetcher',handler:request=>{outgoing.push(new URL(request.url).origin);return new Response('TEST BLOCKED OUTBOUND',{status:502});}}}
    }]
  });
  try{
    await mf.ready;
    // Prove that the blocker works using the unchanged production image handler in-memory.
    // dispatchFetch is a virtual incoming request, never an HTTP connection to this origin.
    const probe=await mf.dispatchFetch('https://tennis230.pages.dev/api/notice-image-download?url=https%3A%2F%2Fstorage.googleapis.com%2Fsynthetic-never-contact',{redirect:'manual'});
    assert.equal(probe.status,502);await probe.text();assert.equal(outgoing.length,1);
    outgoing.length=0;
    for(const route of routes){
      const query=new URLSearchParams({code:'synthetic-code',state:btoa(JSON.stringify({returnUrl:'https://tennis230.pages.dev/'})),url:'https://storage.googleapis.com/synthetic-never-contact'});
      const response=await mf.dispatchFetch('http://localhost:8788'+route+'?'+query,{redirect:'manual',method:route.includes('push')?'POST':'GET',...(route.includes('push')?{body:'{"token":"fake-token"}'}:{})});
      assert.equal(response.status,200);assert.equal((await response.json()).mock,true,route);
    }
    assert.deepEqual(outgoing,[]);
    // Forwarded headers cannot turn a local HTTP request into an approved HTTPS origin.
    const spoof=await mf.dispatchFetch('http://localhost:8788/naver/login',{headers:{'X-Forwarded-Host':'tennis230.pages.dev','X-Forwarded-Proto':'https'},redirect:'manual'});
    assert.equal((await spoof.json()).mock,true);
    for(const origin of ['https://unapproved.test','http://tennis230.pages.dev','https://preview.tennis230.pages.dev']){
      const response=await mf.dispatchFetch(origin+'/naver/login',{redirect:'manual'});assert.equal(response.status,403);await response.text();
    }
    const asset=await mf.dispatchFetch('http://localhost:8788/index.html');assert.equal(await asset.text(),'static-sentinel');
    // Approved production host still reaches the existing handler, with no real outbound network.
    const production=await mf.dispatchFetch('https://tennis230.pages.dev/naver/login',{redirect:'manual'});
    assert.equal(production.status,302);assert.equal(new URL(production.headers.get('location')).origin,'https://nid.naver.com');
    const noSecrets=await mf.dispatchFetch('https://tennis230.pages.dev/api/send-push',{method:'POST',body:'{"token":"fake-token"}',redirect:'manual'});
    assert.equal(noSecrets.status,500);assert.equal((await noSecrets.json()).mock,undefined);
    assert.deepEqual(outgoing,[]);
  }finally{await mf.dispose();}
});
