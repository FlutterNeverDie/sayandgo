import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import {
  connectFirestoreEmulator,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';

const env = import.meta.env;

/** 실제 프로젝트 설정이 없으면 로컬 에뮬레이터(demo-qplace)로 붙는다. */
export const usingEmulator = env.VITE_USE_EMULATOR === 'true' || !env.VITE_FIREBASE_API_KEY;

const app = initializeApp(
  usingEmulator
    ? { apiKey: 'demo-key', authDomain: 'demo-qplace.firebaseapp.com', projectId: 'demo-qplace', appId: 'demo' }
    : {
        apiKey: env.VITE_FIREBASE_API_KEY,
        authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
        projectId: env.VITE_FIREBASE_PROJECT_ID,
        appId: env.VITE_FIREBASE_APP_ID,
      },
);

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
      signInWithEmailAndPassword(auth, 'demo@qplace.test', 'coffee2024').catch(() => undefined),
    );
  }
}
