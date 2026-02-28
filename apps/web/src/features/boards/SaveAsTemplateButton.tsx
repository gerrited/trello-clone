import { useState } from 'react';
import { BookmarkPlus } from 'lucide-react';
import { saveAsTemplate } from '../../api/templates.api.js';

interface SaveAsTemplateButtonProps {
  boardId: string;
}

export function SaveAsTemplateButton({ boardId }: SaveAsTemplateButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await saveAsTemplate(boardId, { name: name.trim() });
      setSaved(true);
      setIsOpen(false);
      setName('');
      setTimeout(() => setSaved(false), 3000);
    } catch {
      // TODO: show error toast
    } finally {
      setSaving(false);
    }
  };

  if (isOpen) {
    return (
      <div className="hidden sm:flex items-center gap-1">
        <input
          type="text"
          placeholder="Vorlagenname..."
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSave();
            if (e.key === 'Escape') setIsOpen(false);
          }}
          autoFocus
          className="text-xs px-2 py-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 w-36"
        />
        <button
          onClick={handleSave}
          disabled={saving || !name.trim()}
          className="text-xs px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
        >
          {saving ? '...' : 'Speichern'}
        </button>
        <button
          onClick={() => setIsOpen(false)}
          className="text-xs px-1.5 py-1 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
        >
          ✕
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setIsOpen(true)}
      className={`hidden sm:flex items-center gap-1 text-xs px-2 py-1 rounded-full border transition-colors ${
        saved
          ? 'border-green-300 bg-green-50 text-green-700'
          : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
      }`}
      title="Als Vorlage speichern"
    >
      <BookmarkPlus size={12} />
      {saved ? 'Gespeichert!' : 'Vorlage'}
    </button>
  );
}
