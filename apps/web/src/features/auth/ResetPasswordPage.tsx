import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { resetPassword } from '../../api/auth.api.js';
import { AuthLayout } from '../../components/layout/AuthLayout.js';
import { Button } from '../../components/ui/Button.js';
import { Input } from '../../components/ui/Input.js';

const resetSchema = z.object({ password: z.string().min(8) });
type ResetForm = z.infer<typeof resetSchema>;

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const { t } = useTranslation();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetForm>({ resolver: zodResolver(resetSchema) });

  const onSubmit = async (data: ResetForm) => {
    try {
      setError('');
      await resetPassword(token!, data.password);
      navigate('/login', { state: { passwordReset: true } });
    } catch {
      setError(t('auth.invalidOrExpiredToken'));
    }
  };

  if (!token) {
    return (
      <AuthLayout>
        <h2 className="text-xl font-semibold dark:text-gray-100 mb-4">{t('auth.invalidOrExpiredToken')}</h2>
        <Link to="/forgot-password" className="text-blue-600 hover:underline text-sm">
          {t('auth.requestNewLink')}
        </Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <h2 className="text-xl font-semibold dark:text-gray-100 mb-2">{t('auth.resetPasswordTitle')}</h2>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg text-sm">
          {error}
          <div className="mt-2">
            <Link to="/forgot-password" className="text-blue-600 hover:underline">
              {t('auth.requestNewLink')}
            </Link>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-4">
        <Input
          label={t('user.newPassword')}
          type="password"
          {...register('password')}
          error={errors.password?.message}
        />
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? t('auth.settingNewPassword') : t('auth.setNewPassword')}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
        <Link to="/login" className="text-blue-600 hover:underline">
          {t('auth.backToLogin')}
        </Link>
      </p>
    </AuthLayout>
  );
}
