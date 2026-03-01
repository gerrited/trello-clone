import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../stores/authStore.js';
import { updateProfile } from '../api/users.api.js';

const LANGUAGES = [
  { code: 'de', label: 'DE' },
  { code: 'en', label: 'EN' },
  { code: 'fr', label: 'FR' },
  { code: 'it', label: 'IT' },
  { code: 'nl', label: 'NL' },
] as const;

interface LanguageSelectorProps {
  className?: string;
}

export function LanguageSelector({ className }: LanguageSelectorProps) {
  const { i18n } = useTranslation();
  const { user, setUser } = useAuthStore();

  const handleChange = async (code: string) => {
    await i18n.changeLanguage(code);
    if (user) {
      try {
        const { user: updated } = await updateProfile({
          displayName: user.displayName,
          email: user.email,
          language: code as 'en' | 'de' | 'fr' | 'it' | 'nl',
        });
        setUser(updated);
      } catch {
        // language change still applied locally even if save fails
      }
    }
  };

  return (
    <div className={`flex items-center gap-1 ${className ?? ''}`}>
      {LANGUAGES.map(({ code, label }) => (
        <button
          key={code}
          onClick={() => handleChange(code)}
          className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
            i18n.language === code
              ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
              : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
