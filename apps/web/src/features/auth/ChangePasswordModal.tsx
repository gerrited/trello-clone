import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import axios from 'axios';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Modal } from '../../components/ui/Modal.js';
import { Input } from '../../components/ui/Input.js';
import { Button } from '../../components/ui/Button.js';
import { changePassword } from '../../api/users.api.js';
import { changePasswordSchema, type ChangePasswordInput } from '@trello-clone/shared';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ChangePasswordModal({ isOpen, onClose }: ChangePasswordModalProps) {
  const { t } = useTranslation();
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordInput>({ resolver: zodResolver(changePasswordSchema) });

  const handleClose = () => {
    reset();
    onClose();
  };

  const onSubmit = async (data: ChangePasswordInput) => {
    try {
      await changePassword(data);
      toast.success(t('user.passwordChanged'));
      reset();
      onClose();
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 400) {
        setError('currentPassword', { message: t('user.wrongPassword') });
      } else {
        toast.error(t('user.passwordChangeError'));
      }
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={t('user.changePassword')}>
      <div className="p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">{t('user.changePassword')}</h2>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input
            label={t('user.currentPassword')}
            type="password"
            {...register('currentPassword')}
            error={errors.currentPassword?.message}
          />
          <Input
            label={t('user.newPassword')}
            type="password"
            {...register('newPassword')}
            error={errors.newPassword?.message}
          />
          <Input
            label={t('user.confirmPassword')}
            type="password"
            {...register('confirmPassword')}
            error={errors.confirmPassword?.message}
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={handleClose} disabled={isSubmitting}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? t('common.saving') : t('common.save')}
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
