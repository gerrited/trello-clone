import { BrowserRouter, Routes, Route, Navigate } from 'react-router';
import { useEffect } from 'react';
import { useAuthStore } from './stores/authStore.js';
import { getMe } from './api/auth.api.js';
import { LoginPage } from './features/auth/LoginPage.js';
import { RegisterPage } from './features/auth/RegisterPage.js';
import { AuthCallbackPage } from './features/auth/AuthCallbackPage.js';
import { TeamsPage } from './features/teams/TeamsPage.js';
import { BoardListPage } from './features/boards/BoardListPage.js';
import { BoardPage } from './features/boards/BoardPage.js';
import { CalendarPage } from './features/boards/CalendarPage.js';
import { SharedBoardPage } from './features/boards/SharedBoardPage.js';

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
      <Route path="/teams" element={<AuthGuard><TeamsPage /></AuthGuard>} />
      <Route path="/teams/:teamId/boards" element={<AuthGuard><BoardListPage /></AuthGuard>} />
      <Route path="/teams/:teamId/boards/:boardId" element={<AuthGuard><BoardPage /></AuthGuard>} />
      <Route path="/teams/:teamId/boards/:boardId/calendar" element={<AuthGuard><CalendarPage /></AuthGuard>} />
      <Route path="/shared/:token" element={<SharedBoardPage />} />
      <Route path="*" element={<Navigate to="/teams" />} />
    </Routes>
  );
}

export function App() {
  useEffect(() => {
    getMe()
      .then(({ user }) => {
        useAuthStore.getState().setAuth(user, useAuthStore.getState().accessToken || '');
      })
      .catch(() => {
        useAuthStore.getState().setLoading(false);
      });
  }, []);

  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
