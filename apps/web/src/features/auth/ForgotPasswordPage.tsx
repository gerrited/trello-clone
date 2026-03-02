import { useState } from 'react';
import { Link } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { requestPasswordReset } from '../../api/auth.api.js';
import { AuthLayout } from '../../components/layout/AuthLayout.js';
import { Button } from '../../components/ui/Button.js';
import { Input } from '../../components/ui/Input.js';

const emailSchema = z.object({ email: z.string().email() });
type EmailForm = z.infer<typeof emailSchema>;

export function ForgotPasswordPage() {
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const { t } = useTranslation();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<EmailForm>({ resolver: zodResolver(emailSchema) });

  const onSubmit = async (data: EmailForm) => {
    try {
      setError('');
      await requestPasswordReset(data.email);
      setSubmitted(true);
    } catch {
      setError(t('auth.forgotPasswordError'));
    }
  };

  if (submitted) {
    return (
      <AuthLayout>
        <h2 className="text-xl font-semibold dark:text-gray-100 mb-4">{t('auth.resetEmailSent')}</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">{t('auth.resetEmailSentDescription')}</p>
        <Link to="/login" className="text-blue-600 hover:underline text-sm">
          {t('auth.backToLogin')}
        </Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <h2 className="text-xl font-semibold dark:text-gray-100 mb-2">{t('auth.forgotPasswordTitle')}</h2>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">{t('auth.forgotPasswordDescription')}</p>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input label={t('auth.email')} type="email" {...register('email')} error={errors.email?.message} />
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? t('auth.sendingResetLink') : t('auth.sendResetLink')}
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
