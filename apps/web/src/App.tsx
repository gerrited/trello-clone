import { BrowserRouter, Routes, Route, Navigate } from 'react-router';
import { useEffect } from 'react';
import { useAuthStore } from './stores/authStore.js';
import { getMe } from './api/auth.api.js';
import { LoginPage } from './features/auth/LoginPage.js';
import { RegisterPage } from './features/auth/RegisterPage.js';
import { AuthCallbackPage } from './features/auth/AuthCallbackPage.js';

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Laden...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/auth/callback" element={<AuthCallbackPage />} />
      <Route
        path="/teams"
        element={
          <AuthGuard>
            <div className="p-8">
              <h1 className="text-2xl font-bold">Teams</h1>
              <p className="text-gray-500 mt-2">Team-Übersicht kommt in Layer 1.</p>
            </div>
          </AuthGuard>
        }
      />
      <Route path="*" element={<Navigate to="/teams" />} />
    </Routes>
  );
}

export function App() {
  const setAuth = useAuthStore((s) => s.setAuth);
  const setLoading = useAuthStore((s) => s.setLoading);

  useEffect(() => {
    getMe()
      .then(({ user }) => {
        setAuth(user, useAuthStore.getState().accessToken || '');
      })
      .catch(() => {
        setLoading(false);
      });
  }, [setAuth, setLoading]);

  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
