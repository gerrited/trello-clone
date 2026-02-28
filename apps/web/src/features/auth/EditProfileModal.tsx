import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import axios from 'axios';
import { toast } from 'sonner';
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
      toast.success('Profil aktualisiert');
      onClose();
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 409) {
        setError('email', { message: 'Diese E-Mail-Adresse wird bereits verwendet' });
      } else {
        toast.error('Fehler beim Aktualisieren des Profils');
      }
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Profil bearbeiten">
      <div className="p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Profil bearbeiten</h2>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input label="Name" {...register('displayName')} error={errors.displayName?.message} />
          <Input label="E-Mail" type="email" {...register('email')} error={errors.email?.message} />
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Speichern...' : 'Speichern'}
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
