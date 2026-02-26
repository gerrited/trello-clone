import { useState } from 'react';
import { useNavigate, Link } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { registerSchema, type RegisterInput } from '@trello-clone/shared';
import { registerUser } from '../../api/auth.api.js';
import { useAuthStore } from '../../stores/authStore.js';
import { AuthLayout } from '../../components/layout/AuthLayout.js';
import { Button } from '../../components/ui/Button.js';
import { Input } from '../../components/ui/Input.js';

export function RegisterPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [error, setError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({ resolver: zodResolver(registerSchema) });

  const onSubmit = async (data: RegisterInput) => {
    try {
      setError('');
      const { user, accessToken } = await registerUser(data);
      setAuth(user, accessToken);
      navigate('/teams');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      setError(err.response?.data?.error || 'Registration failed');
    }
  };

  return (
    <AuthLayout>
      <h2 className="text-xl font-semibold mb-6">Registrieren</h2>

      {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input label="Name" {...register('displayName')} error={errors.displayName?.message} />
        <Input label="E-Mail" type="email" {...register('email')} error={errors.email?.message} />
        <Input label="Passwort" type="password" {...register('password')} error={errors.password?.message} />
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? 'Registrieren...' : 'Registrieren'}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-600">
        Bereits ein Konto?{' '}
        <Link to="/login" className="text-blue-600 hover:underline">
          Anmelden
        </Link>
      </p>
    </AuthLayout>
  );
}
