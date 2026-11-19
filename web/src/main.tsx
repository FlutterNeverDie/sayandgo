import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import './i18n';
import './styles/app.css';
import { AuthProvider } from './app/auth';
import { ErrorBoundary } from './app/Recovery';
import { UpdateWatcher } from './app/UpdateWatcher';
import { ToastProvider } from './components/ui/Overlay';
import { Loading } from './components/ui/States';
import { StorePage } from './pages/StorePage';
import { ComposePage } from './pages/ComposePage';

// 손님 화면은 바로, 사장님 · 문서 화면은 필요할 때 불러온다 (전송량 절감)
const LandingPage = lazy(() => import('./pages/LandingPage').then((m) => ({ default: m.LandingPage })));
const auth = () => import('./pages/AuthPages');
const SignupPage = lazy(() => auth().then((m) => ({ default: m.SignupPage })));
const LoginPage = lazy(() => auth().then((m) => ({ default: m.LoginPage })));
const VerifyPage = lazy(() => auth().then((m) => ({ default: m.VerifyPage })));
const ResetPage = lazy(() => auth().then((m) => ({ default: m.ResetPage })));
const InboxPage = lazy(() => import('./pages/InboxPage').then((m) => ({ default: m.InboxPage })));
const SharePage = lazy(() => import('./pages/SharePage').then((m) => ({ default: m.SharePage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage })));
const misc = () => import('./pages/MiscPages');
const LegalPage = lazy(() => misc().then((m) => ({ default: m.LegalPage })));
const NotFoundPage = lazy(() => misc().then((m) => ({ default: m.NotFoundPage })));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false, gcTime: 30 * 60_000 },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ToastProvider>
          <BrowserRouter>
            <UpdateWatcher />
            <Suspense fallback={<Loading />}>
              <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/q/:code" element={<StorePage />} />
                <Route path="/q/:code/write" element={<ComposePage />} />
                <Route path="/signup" element={<SignupPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/verify" element={<VerifyPage />} />
                <Route path="/reset" element={<ResetPage />} />
                <Route path="/inbox" element={<InboxPage />} />
                <Route path="/share" element={<SharePage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/settings/:section" element={<SettingsPage />} />
                <Route path="/terms" element={<LegalPage kind="terms" />} />
                <Route path="/privacy" element={<LegalPage kind="privacy" />} />
                <Route path="/policy" element={<LegalPage kind="policy" />} />
                <Route path="/rights" element={<LegalPage kind="rights" />} />
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
);
