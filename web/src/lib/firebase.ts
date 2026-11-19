import { initializeApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import {
  connectFirestoreEmulator,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';

const env = import.meta.env;

/** 실제 프로젝트 설정이 없으면 로컬 에뮬레이터(demo-sayandgo)로 붙는다. */
export const usingEmulator = env.VITE_USE_EMULATOR === 'true' || !env.VITE_FIREBASE_API_KEY;

const app = initializeApp(
  usingEmulator
    ? { apiKey: 'demo-key', authDomain: 'demo-sayandgo.firebaseapp.com', projectId: 'demo-sayandgo', appId: 'demo' }
    : {
        apiKey: env.VITE_FIREBASE_API_KEY,
        authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
        projectId: env.VITE_FIREBASE_PROJECT_ID,
        appId: env.VITE_FIREBASE_APP_ID,
      },
);

// App Check: 우리 웹앱이 아닌 스크립트의 Firestore 접근을 막는다 (도움됐어요 · 질문 도배 방지).
// 배포 때 reCAPTCHA 키를 VITE_RECAPTCHA_SITE_KEY에 넣고, 콘솔에서 Firestore 강제 적용을 켠다.
if (!usingEmulator && env.VITE_RECAPTCHA_SITE_KEY) {
  initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider(env.VITE_RECAPTCHA_SITE_KEY),
    isTokenAutoRefreshEnabled: true,
  });
}

export const auth = getAuth(app);

// 기기 캐시: 다시 열면 저장된 내용을 먼저 보여 준다 (읽기 절감)
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});

if (usingEmulator) {
  // 같은 와이파이의 휴대폰에서도 접속할 수 있게 현재 호스트를 쓴다
  const host = typeof location !== 'undefined' ? location.hostname : '127.0.0.1';
  connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
  connectFirestoreEmulator(db, host, 8080);

  // 에뮬레이터 전용: ?devLogin=1 이면 샘플 사장님으로 로그인 (scripts/seed-emulator.mjs의 계정)
  if (typeof location !== 'undefined' && new URLSearchParams(location.search).has('devLogin')) {
    import('firebase/auth').then(({ signInWithEmailAndPassword }) =>
      signInWithEmailAndPassword(auth, 'demo@sayandgo.test', 'coffee2024').catch(() => undefined),
    );
  }
}
