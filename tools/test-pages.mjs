import { spawn } from 'node:child_process';
import path from 'node:path';
import { preparePagesLocal, runWrangler, localProcessEnvironment, repository } from './pages-local.mjs';

const {stage}=await preparePagesLocal();
const env={...localProcessEnvironment(),PAGES_TEST_STAGE:stage,PAGES_TEST_URL:'http://127.0.0.1:8790'};
function finished(child) { return new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',code=>resolve(code??1));}); }
const build=runWrangler(stage,['pages','functions','build','functions','--outfile',path.join(stage,'worker.bundle'),'--compatibility-date','2026-10-26']);
if(await finished(build)!==0)throw new Error('Pages Functions build failed');
const server=runWrangler(stage,['pages','dev','public','--ip','127.0.0.1','--port','8790','--inspector-port','9232','--local-protocol','http','--show-interactive-dev-session=false']);
let exit;
server.once('exit',code=>{exit=code;});
try{
  const deadline=Date.now()+30000;
  let ready=false;
  while(Date.now()<deadline){
    if(exit!==undefined)throw new Error('Wrangler exited before ready: '+exit);
    try{const response=await fetch(env.PAGES_TEST_URL,{signal:AbortSignal.timeout(750)});await response.text();ready=true;break;}catch{}
    await new Promise(resolve=>setTimeout(resolve,250));
  }
  if(!ready)throw new Error('Wrangler readiness timeout');
  const child=spawn(process.execPath,['--test','tests/pages-runtime.test.mjs'],{cwd:repository,env,stdio:'inherit'});
  process.exitCode=await finished(child);
}finally{
  // Terminate only the child tree created by this script, including workerd.
  if(exit===undefined){
    if(process.platform==='win32'){
      const stop=spawn('taskkill',['/pid',String(server.pid),'/T','/F'],{stdio:'ignore'});await finished(stop);
    }else server.kill('SIGTERM');
  }
}
