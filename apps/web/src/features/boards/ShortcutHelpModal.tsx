import { Modal } from '../../components/ui/Modal.js';
import { SHORTCUT_LIST } from '../../hooks/useKeyboardShortcuts.js';

interface ShortcutHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ShortcutHelpModal({ isOpen, onClose }: ShortcutHelpModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Tastaturkürzel">
      <div className="p-6">
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">Tastaturkürzel</h2>
        <div className="space-y-2">
          {SHORTCUT_LIST.map(({ keys, description }) => (
            <div key={keys} className="flex items-center justify-between py-1.5">
              <span className="text-sm text-gray-600 dark:text-gray-400">{description}</span>
              <kbd className="px-2 py-1 text-xs font-mono bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded text-gray-700 dark:text-gray-300">
                {keys}
              </kbd>
            </div>
          ))}
        </div>
        <div className="mt-6 text-xs text-gray-400 dark:text-gray-500 text-center">
          Drücke <kbd className="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded text-gray-500 dark:text-gray-400">?</kbd> auf dem Board um diesen Dialog zu öffnen
        </div>
      </div>
    </Modal>
  );
}
