import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useAuthStore } from '../../stores/authStore.js';
import { getMe } from '../../api/auth.api.js';

export function AuthCallbackPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const setAuth = useAuthStore((s) => s.setAuth);

  useEffect(() => {
    const token = searchParams.get('token');
    if (token) {
      useAuthStore.getState().setAccessToken(token);
      getMe().then(({ user }) => {
        setAuth(user, token);
        navigate('/teams');
      });
    } else {
      navigate('/login');
    }
  }, [searchParams, setAuth, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-500">Authentifizierung...</p>
    </div>
  );
}
