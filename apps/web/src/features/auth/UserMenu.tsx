import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Sun, Moon, Monitor, Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../stores/authStore.js';
import { useThemeStore } from '../../stores/themeStore.js';
import { logoutUser } from '../../api/auth.api.js';
import { EditProfileModal } from './EditProfileModal.js';
import { ChangePasswordModal } from './ChangePasswordModal.js';
import { LanguageSelector } from '../../components/LanguageSelector.js';

export function UserMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { preference, setPreference } = useThemeStore();
  const { t } = useTranslation();

  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleLogout = async () => {
    setIsOpen(false);
    await logoutUser();
    logout();
    navigate('/login');
  };

  const initials =
    user?.displayName
      .split(' ')
      .map((n: string) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) ?? '?';

  return (
    <>
      <div className="relative" ref={popoverRef}>
        <button
          onClick={() => setIsOpen((v) => !v)}
          className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          aria-label={t('user.userProfile')}
          aria-expanded={isOpen}
        >
          <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
            {initials}
          </div>
          <span className="text-sm text-gray-700 dark:text-gray-300 hidden sm:inline">{user?.displayName}</span>
        </button>

        {isOpen && (
          <div className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50">
            <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">{user?.displayName}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user?.email}</p>
            </div>
            <div className="py-1">
              <button
                onClick={() => {
                  setIsOpen(false);
                  setShowEditProfile(true);
                }}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                {t('user.editProfile')}
              </button>
              {user?.hasPassword && (
                <button
                  onClick={() => {
                    setIsOpen(false);
                    setShowChangePassword(true);
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  {t('user.changePassword')}
                </button>
              )}
            </div>
            {/* Appearance section */}
            <div className="py-2 border-t border-gray-100 dark:border-gray-700">
              <p className="px-4 pb-1 text-xs font-medium text-gray-500 dark:text-gray-400">{t('user.appearance')}</p>
              <div className="flex items-center gap-1 px-3">
                {([
                  { value: 'light', icon: Sun, labelKey: 'theme.light' },
                  { value: 'system', icon: Monitor, labelKey: 'theme.system' },
                  { value: 'dark', icon: Moon, labelKey: 'theme.dark' },
                ] as const).map(({ value, icon: Icon, labelKey }) => (
                  <button
                    key={value}
                    onClick={() => setPreference(value)}
                    className={`flex-1 flex flex-col items-center gap-0.5 px-1 py-1.5 rounded-lg text-xs transition-colors ${
                      preference === value
                        ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                        : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                    title={t(labelKey)}
                  >
                    <Icon size={14} />
                    {t(labelKey)}
                  </button>
                ))}
              </div>
            </div>
            {/* Language section */}
            <div className="py-2 border-t border-gray-100 dark:border-gray-700">
              <p className="px-4 pb-1 text-xs font-medium text-gray-500 dark:text-gray-400 flex items-center gap-1">
                <Globe size={12} />
                {t('user.language')}
              </p>
              <div className="px-3">
                <LanguageSelector />
              </div>
            </div>
            <div className="py-1 border-t border-gray-100 dark:border-gray-700">
              <button
                onClick={handleLogout}
                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                {t('user.logout')}
              </button>
            </div>
          </div>
        )}
      </div>

      <EditProfileModal isOpen={showEditProfile} onClose={() => setShowEditProfile(false)} />
      <ChangePasswordModal isOpen={showChangePassword} onClose={() => setShowChangePassword(false)} />
    </>
  );
}
