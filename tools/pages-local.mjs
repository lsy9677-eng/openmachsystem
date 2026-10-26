import { mkdir, mkdtemp, readdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';

export const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export function localProcessEnvironment(source = process.env) {
  const env = { ...source, WRANGLER_SEND_METRICS: 'false', WRANGLER_CHECK_VERSION: 'false', CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV: 'false', CLOUDFLARE_INCLUDE_PROCESS_ENV: 'false', CI: 'true',
    XDG_CONFIG_HOME: path.join(repository, '.tools/wrangler-config'), WRANGLER_LOG_PATH: path.join(repository, '.tools/wrangler-logs') };
  for (const key of Object.keys(env)) if (/SECRET|TOKEN|PASSWORD|PRIVATE_KEY|CREDENTIAL|^FIREBASE_|^KAKAO_|^NAVER_|^ALIGO_|^SMS_|^CLOUDFLARE_API_|^CLOUDFLARE_ACCOUNT_|^CF_API_|^DEBUG$|^FIREBASE_DEBUG$/.test(key.toUpperCase())) delete env[key];
  const portableRuntime = path.join(repository, '.tools/vclibs');
  if (process.platform === 'win32' && existsSync(path.join(portableRuntime, 'vcruntime140_1.dll'))) env.PATH = portableRuntime + path.delimiter + env.PATH;
  return env;
}
export async function preparePagesLocal() {
  await mkdir(path.join(repository, '.tools/pages-local'), { recursive: true });
  const stage = await mkdtemp(path.join(repository, '.tools/pages-local/run-'));
  const publicDirectory = path.join(stage, 'public');
  await mkdir(publicDirectory);
  async function copyTree(relative, destination, extensions) {
    for (const item of await readdir(path.join(repository, relative), { withFileTypes: true })) {
      if (item.name.startsWith('.')) continue;
      const source = path.join(relative, item.name), target = path.join(destination, item.name);
      if (item.isDirectory()) { await mkdir(target, { recursive: true }); await copyTree(source, target, extensions); }
      else if (item.isFile() && extensions.includes(path.extname(item.name))) await copyFile(path.join(repository, source), target);
    }
  }
  for (const rootFile of ['index.html', 'privacy.html', 'manifest.json', 'logo-230.png', 'icon-180.png', 'icon-192.png', 'icon-512.png', 'icon-1024.png']) await copyFile(path.join(repository, rootFile), path.join(publicDirectory, rootFile));
  for (const relative of ['assets', 'guide']) {
    const destination = path.join(publicDirectory, relative); await mkdir(destination);
    await copyTree(relative, destination, ['.js', '.css', '.html', '.png', '.jpg', '.jpeg', '.webp', '.gif', '.mp3']);
  }
  await mkdir(path.join(publicDirectory, 'data'));
  await copyFile(path.join(repository, 'data/test-teams-100.json'), path.join(publicDirectory, 'data/test-teams-100.json'));
  await mkdir(path.join(stage, 'functions'));
  await copyTree('functions', path.join(stage, 'functions'), ['.js']);
  // Empty files prevent accidental .env/.dev.vars discovery in parent directories.
  await writeFile(path.join(stage, '.env'), '');
  await writeFile(path.join(stage, '.dev.vars'), '');
  await writeFile(path.join(stage, 'wrangler.json'), JSON.stringify({ name: '230match-local', pages_build_output_dir: './public', compatibility_date: '2026-10-26', send_metrics: false }));
  await writeFile(path.join(publicDirectory, '_headers'), await readFile(path.join(repository, '_headers')));
  return { stage, publicDirectory };
}
export function runWrangler(stage, args, options = {}) {
  return spawn(process.execPath, [path.join(repository, 'node_modules/wrangler/bin/wrangler.js'), ...args], {
    cwd: stage, env: localProcessEnvironment(), stdio: 'inherit', ...options
  });
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { stage } = await preparePagesLocal();
  console.log('Wrangler local only: http://127.0.0.1:8788 (isolated public assets, no credentials)');
  const child = runWrangler(stage, ['pages', 'dev', 'public', '--ip', '127.0.0.1', '--port', '8788', '--inspector-port', '9230', '--local-protocol', 'http', '--show-interactive-dev-session=false']);
  child.on('exit', code => { process.exitCode = code ?? 1; });
  child.on('error', error => { console.error(error.message); process.exitCode = 1; });
}
