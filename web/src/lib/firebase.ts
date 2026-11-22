import { deleteApp, initializeApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { connectFirestoreEmulator, initializeFirestore, memoryLocalCache } from 'firebase/firestore';

const env = import.meta.env;

/** 실제 프로젝트 설정이 없으면 로컬 에뮬레이터(demo-sayandgo)로 붙는다. */
export const usingEmulator = env.VITE_USE_EMULATOR === 'true' || !env.VITE_FIREBASE_API_KEY;

const config = usingEmulator
  ? { apiKey: 'demo-key', authDomain: 'demo-sayandgo.firebaseapp.com', projectId: 'demo-sayandgo', appId: 'demo' }
  : {
      apiKey: env.VITE_FIREBASE_API_KEY,
      authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: env.VITE_FIREBASE_PROJECT_ID,
      appId: env.VITE_FIREBASE_APP_ID,
    };

const app = initializeApp(config);
const emulatorHost = () => (typeof location !== 'undefined' ? location.hostname : '127.0.0.1');

// App Check: 우리 웹앱이 아닌 스크립트의 Firestore 접근을 막는다 (도움됐어요 · 질문 도배 방지).
// 배포 때 reCAPTCHA 키를 VITE_RECAPTCHA_SITE_KEY에 넣고, 콘솔에서 Firestore 강제 적용을 켠다.
if (!usingEmulator && env.VITE_RECAPTCHA_SITE_KEY) {
  import('firebase/app-check').then(({ initializeAppCheck, ReCaptchaEnterpriseProvider }) =>
    initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(env.VITE_RECAPTCHA_SITE_KEY),
      isTokenAutoRefreshEnabled: true,
    }),
  );
}

export const auth = getAuth(app);

// 메모리 캐시: 기기 저장소(IndexedDB)는 일부 휴대폰 · 앱 내 브라우저에서 열리는 데 오래 걸리거나 멈춰
// 첫 화면이 늦게 뜬다. 같은 방문 안의 캐시는 TanStack Query가 맡는다.
export const db = initializeFirestore(app, { localCache: memoryLocalCache() });

if (usingEmulator) {
  // 같은 와이파이의 휴대폰에서도 접속할 수 있게 현재 호스트를 쓴다
  const host = emulatorHost();
  connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
  connectFirestoreEmulator(db, host, 8080);

  // 에뮬레이터 전용: ?devLogin=1 이면 샘플 사장님으로 로그인 (scripts/seed-emulator.mjs의 계정)
  // ?devLogin=admin 이면 운영자 계정 (현장 세팅 시험용)
  const devLogin = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('devLogin') : null;
  if (devLogin !== null) {
    const [email, pw] = devLogin === 'admin' ? ['oasa741@gmail.com', 'admin1234a'] : ['demo@sayandgo.test', 'coffee2024'];
    import('firebase/auth').then(({ signInWithEmailAndPassword }) => signInWithEmailAndPassword(auth, email, pw).catch(() => undefined));
  }
}

/**
 * 두 번째 연결: 운영자가 현장에서 사장님 계정을 만들 때 쓴다.
 * 같은 연결로 새 계정을 만들면 운영자가 로그아웃되므로, 따로 열었다가 끝나면 닫는다.
 */
export function openSecondary() {
  const second: FirebaseApp = initializeApp(config, `setup-${Date.now()}`);
  const sAuth = getAuth(second);
  const sDb = initializeFirestore(second, { localCache: memoryLocalCache() });
  if (usingEmulator) {
    connectAuthEmulator(sAuth, `http://${emulatorHost()}:9099`, { disableWarnings: true });
    connectFirestoreEmulator(sDb, emulatorHost(), 8080);
  }
  return { auth: sAuth, db: sDb, close: () => deleteApp(second) };
}
