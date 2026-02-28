import { useState } from 'react';
import { useNavigate, Link } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, type LoginInput } from '@trello-clone/shared';
import { loginUser } from '../../api/auth.api.js';
import { useAuthStore } from '../../stores/authStore.js';
import { AuthLayout } from '../../components/layout/AuthLayout.js';
import { Button } from '../../components/ui/Button.js';
import { Input } from '../../components/ui/Input.js';

export function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [error, setError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (data: LoginInput) => {
    try {
      setError('');
      const { user, accessToken } = await loginUser(data);
      setAuth(user, accessToken);
      navigate('/teams');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed');
    }
  };

  return (
    <AuthLayout>
      <h2 className="text-xl font-semibold dark:text-gray-100 mb-6">Anmelden</h2>

      {error && <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg text-sm">{error}</div>}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input label="E-Mail" type="email" {...register('email')} error={errors.email?.message} />
        <Input label="Passwort" type="password" {...register('password')} error={errors.password?.message} />
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? 'Anmelden...' : 'Anmelden'}
        </Button>
      </form>

      <div className="mt-6">
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300 dark:border-gray-600" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="bg-white dark:bg-gray-800 px-2 text-gray-500 dark:text-gray-400">oder</span>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <a
            href="/api/v1/auth/google"
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Login mit Google
          </a>
          <a
            href="/api/v1/auth/microsoft"
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Login mit Microsoft
          </a>
        </div>
      </div>

      <p className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
        Noch kein Konto?{' '}
        <Link to="/register" className="text-blue-600 hover:underline">
          Registrieren
        </Link>
      </p>
    </AuthLayout>
  );
}
