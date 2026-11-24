import { onAuthStateChanged, type User } from 'firebase/auth';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useLocation } from 'react-router-dom';
import { auth } from '../lib/firebase';
import { activateStore, getMyStoreCode, getStore } from '../lib/stores';
import type { Store } from '../lib/types';
import { Loading } from '../components/ui/States';

interface AuthState {
  /** 사장님 계정만. 익명 손님 계정은 null로 본다. */
  user: User | null;
  ready: boolean;
}

const AuthContext = createContext<AuthState>({ user: null, ready: false });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, ready: false });
  useEffect(
    () => onAuthStateChanged(auth, (u) => setState({ user: u && !u.isAnonymous ? u : null, ready: true })),
    [],
  );
  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

/** 로그인한 사장님의 가게. 가게 정보는 10분 캐시. */
export function useMyStore() {
  const { user } = useAuth();
  const codeQuery = useQuery({
    queryKey: ['myStoreCode', user?.uid],
    queryFn: () => getMyStoreCode(user!.uid),
    enabled: !!user,
    staleTime: Infinity,
  });
  const code = codeQuery.data ?? null;
  const storeQuery = useQuery({
    queryKey: ['store', code],
    queryFn: () => getStore(code!),
    enabled: !!code,
    staleTime: 10 * 60_000,
  });
  return {
    code,
    store: storeQuery.data ?? null,
    isLoading: codeQuery.isLoading || storeQuery.isLoading,
    /** 로그인은 됐는데 가게 정보가 없는 계정 */
    missing: !!user && codeQuery.isSuccess && (!code || (storeQuery.isSuccess && !storeQuery.data)),
    isError: codeQuery.isError || storeQuery.isError,
    refetch: () => {
      codeQuery.refetch();
      storeQuery.refetch();
    },
  };
}

/** 인증까지 마친 사장님만 통과. 인증 직후 pending 가게는 여기서 active로 바꾼다. */
export function RequireOwner({ children }: { children: (store: Store) => ReactNode }) {
  const { t } = useTranslation();
  const { user, ready } = useAuth();
  const location = useLocation();
  const { store, code, isLoading, isError, missing, refetch } = useMyStore();
  const qc = useQueryClient();
  const [activating, setActivating] = useState(false);

  const needsActivation = !!user?.emailVerified && store?.status === 'pending';
  useEffect(() => {
    if (!needsActivation || activating || !user || !code) return;
    setActivating(true);
    activateStore(user, code)
      .then(() => qc.invalidateQueries({ queryKey: ['store', code] }))
      // 실패하면 잠깐 쉬었다가 다시 (바로 다시 부르면 같은 오류로 계속 돈다)
      .catch(() => new Promise((r) => setTimeout(r, 1500)))
      .finally(() => setActivating(false));
  }, [needsActivation, activating, user, code, qc]);

  if (!ready) return <Loading />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (!user.emailVerified) return <Navigate to="/verify" replace />;
  if (isError) return <Loading error onRetry={refetch} />;
  if (missing) return <Loading error onRetry={refetch} />;
  if (needsActivation) return <Loading label={t('common.opening')} />;
  if (isLoading || !store) return <Loading />;
  return <>{children(store)}</>;
}
