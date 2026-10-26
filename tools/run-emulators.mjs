import { spawn } from 'node:child_process';
import { readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
const env = { ...process.env, CI: 'true', FIREBASE_CLI_DISABLE_UPDATE_CHECK: 'true', FIREBASE_EMULATORS_PATH: path.resolve('.tools/emulators') };
// No production credential is necessary for demo- projects. Do not pass one to the CLI.
for (const key of ['GOOGLE_APPLICATION_CREDENTIALS', 'FIREBASE_TOKEN', 'FIREBASE_PRIVATE_KEY', 'FIREBASE_CLIENT_EMAIL', 'FIREBASE_PROJECT_ID', 'KAKAO_CLIENT_SECRET', 'NAVER_CLIENT_SECRET']) delete env[key];
// firebase-tools debug logging can dump the inherited environment during emulators:exec.
delete env.DEBUG;
delete env.FIREBASE_DEBUG;
for (const key of Object.keys(env)) if (/SECRET|TOKEN|PASSWORD|PRIVATE_KEY|CREDENTIAL/i.test(key)) delete env[key];
const portable = path.resolve('.tools/java21');
if (existsSync(portable)) {
  const directory = readdirSync(portable).find(name => existsSync(path.join(portable, name, 'bin', 'java.exe')));
  if (directory) env.PATH = path.join(portable, directory, 'bin') + path.delimiter + env.PATH;
}
const args = ['--project', 'demo-230match', '--only', 'auth,firestore,storage', '--config', 'firebase.local.json'];
const exec = process.argv.includes('--test');
const browserCommand = process.argv.includes('--pages') ? 'npm run test:e2e:pages' : 'npm run test:e2e';
const child = spawn(process.execPath, [path.resolve('node_modules/firebase-tools/lib/bin/firebase.js'), exec ? 'emulators:exec' : 'emulators:start', ...args, ...(exec ? [browserCommand] : [])], { env, stdio: 'inherit' });
child.on('exit', code => { process.exitCode = code ?? 1; });
child.on('error', error => { console.error(error.message); process.exitCode = 1; });
