import { useState } from 'react';
import { useNavigate, Link } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { registerSchema, type RegisterInput } from '@trello-clone/shared';
import { registerUser } from '../../api/auth.api.js';
import { useAuthStore } from '../../stores/authStore.js';
import { AuthLayout } from '../../components/layout/AuthLayout.js';
import { Button } from '../../components/ui/Button.js';
import { Input } from '../../components/ui/Input.js';
import { LanguageSelector } from '../../components/LanguageSelector.js';
import i18n from '../../i18n.js';

export function RegisterPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [error, setError] = useState('');
  const { t } = useTranslation();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({ resolver: zodResolver(registerSchema) });

  const onSubmit = async (data: RegisterInput) => {
    try {
      setError('');
      const { user, accessToken } = await registerUser({
        ...data,
        language: i18n.language as 'en' | 'de' | 'fr' | 'it',
      });
      setAuth(user, accessToken);
      navigate('/teams');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      setError(err.response?.data?.error || t('auth.registrationFailed'));
    }
  };

  return (
    <AuthLayout>
      <div className="flex justify-end mb-4">
        <LanguageSelector />
      </div>

      <h2 className="text-xl font-semibold dark:text-gray-100 mb-6">{t('auth.register')}</h2>

      {error && <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg text-sm">{error}</div>}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input label={t('auth.name')} {...register('displayName')} error={errors.displayName?.message} />
        <Input label={t('auth.email')} type="email" {...register('email')} error={errors.email?.message} />
        <Input label={t('auth.password')} type="password" {...register('password')} error={errors.password?.message} />
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? t('auth.registering') : t('auth.register')}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
        {t('auth.alreadyHaveAccount')}{' '}
        <Link to="/login" className="text-blue-600 hover:underline">
          {t('auth.signIn')}
        </Link>
      </p>
    </AuthLayout>
  );
}
