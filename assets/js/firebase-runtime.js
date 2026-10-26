import { isDevelopment, firebaseConfig, requireEmulators } from './environment.js';
let ready;
const connectedStorage = new WeakSet();
// Several legacy import URLs load auth-engine more than once. Connect once, before any I/O.
export function getFirebaseRuntime(api, productionConfig) {
  const initialize = async () => {
    await requireEmulators();
    const config = firebaseConfig(productionConfig);
    const name = `230match-auth-${config.projectId}`;
    let app;
    try { app = api.getApp(name); } catch { app = api.initializeApp(config, name); }
    const auth = api.getAuth(app), db = api.getFirestore(app);
    if (isDevelopment) {
      api.connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
      api.connectFirestoreEmulator(db, '127.0.0.1', 8080);
    }
    await api.setPersistence(auth, api.browserLocalPersistence);
    if (isDevelopment) await auth.authStateReady();
    return { auth, db, app };
  };
  // Production previously re-read settings and retried failed initialization on each call.
  // Only development needs a sticky Promise to prevent duplicate Emulator connections.
  if (!isDevelopment) return initialize();
  ready ||= initialize();
  return ready;
}
export function connectLocalStorage(api, storage) {
  if (isDevelopment && !connectedStorage.has(storage)) {
    api.connectStorageEmulator(storage, '127.0.0.1', 9199);
    connectedStorage.add(storage);
  }
  return storage;
}
