import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import axios from 'axios';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Modal } from '../../components/ui/Modal.js';
import { Input } from '../../components/ui/Input.js';
import { Button } from '../../components/ui/Button.js';
import { useAuthStore } from '../../stores/authStore.js';
import { updateProfile } from '../../api/users.api.js';
import { updateProfileSchema, type UpdateProfileInput } from '@trello-clone/shared';

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function EditProfileModal({ isOpen, onClose }: EditProfileModalProps) {
  const { user, setUser } = useAuthStore();
  const { t } = useTranslation();
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<UpdateProfileInput>({ resolver: zodResolver(updateProfileSchema) });

  useEffect(() => {
    if (isOpen) {
      reset({ displayName: user?.displayName ?? '', email: user?.email ?? '' });
    }
  }, [isOpen, user, reset]);

  const onSubmit = async (data: UpdateProfileInput) => {
    try {
      const { user: updated } = await updateProfile(data);
      setUser(updated);
      toast.success(t('user.profileUpdated'));
      onClose();
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 409) {
        setError('email', { message: t('user.emailInUse') });
      } else {
        toast.error(t('user.profileUpdateError'));
      }
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('user.editProfile')}>
      <div className="p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">{t('user.editProfile')}</h2>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input label={t('user.displayName')} {...register('displayName')} error={errors.displayName?.message} />
          <Input label={t('user.email')} type="email" {...register('email')} error={errors.email?.message} />
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>
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
