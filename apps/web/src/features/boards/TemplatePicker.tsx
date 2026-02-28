import { useState, useEffect } from 'react';
import { Modal } from '../../components/ui/Modal.js';
import { Button } from '../../components/ui/Button.js';
import { Input } from '../../components/ui/Input.js';
import { listTemplates } from '../../api/templates.api.js';
import type { BoardTemplate, BoardTemplateConfig } from '@trello-clone/shared';

interface TemplatePickerProps {
  isOpen: boolean;
  onClose: () => void;
  teamId: string;
  onSelectTemplate: (templateId: string | null, boardName: string) => void;
}

function TemplateCard({
  template,
  isSelected,
  onSelect,
}: {
  template: BoardTemplate;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const config = template.config as BoardTemplateConfig;
  return (
    <button
      onClick={onSelect}
      className={`text-left p-3 rounded-lg border-2 transition-colors ${
        isSelected
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
          : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 bg-white dark:bg-gray-800'
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{template.name}</h3>
        {template.isSystem && (
          <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded font-medium flex-shrink-0">
            System
          </span>
        )}
      </div>
      {template.description && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 line-clamp-2">{template.description}</p>
      )}
      {/* Column preview */}
      <div className="flex gap-1 flex-wrap">
        {config.columns.slice(0, 5).map((col, i) => (
          <span key={i} className="text-[10px] px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded">
            {col.name}
          </span>
        ))}
        {config.columns.length > 5 && (
          <span className="text-[10px] text-gray-400 dark:text-gray-500">+{config.columns.length - 5}</span>
        )}
      </div>
      {config.swimlanes.length > 0 && (
        <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">
          {config.swimlanes.length} Swimlane{config.swimlanes.length > 1 ? 's' : ''}
        </p>
      )}
      {config.labels.length > 0 && (
        <div className="flex gap-1 mt-1">
          {config.labels.slice(0, 6).map((label, i) => (
            <span
              key={i}
              className="inline-block w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: label.color }}
              title={label.name}
            />
          ))}
        </div>
      )}
    </button>
  );
}

export function TemplatePicker({
  isOpen,
  onClose,
  teamId,
  onSelectTemplate,
}: TemplatePickerProps) {
  const [templates, setTemplates] = useState<BoardTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [boardName, setBoardName] = useState('');

  useEffect(() => {
    if (!isOpen || !teamId) return;
    setLoading(true);
    setSelectedId(null);
    setBoardName('');
    listTemplates(teamId)
      .then(setTemplates)
      .catch(() => setTemplates([]))
      .finally(() => setLoading(false));
  }, [isOpen, teamId]);

  const handleConfirm = () => {
    if (!boardName.trim()) return;
    onSelectTemplate(selectedId, boardName.trim());
    onClose();
  };

  // Group: system first, then team templates
  const systemTemplates = templates.filter((t) => t.isSystem);
  const teamTemplates = templates.filter((t) => !t.isSystem);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Board erstellen">
      <div className="p-4 sm:p-6">
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Waehle eine Vorlage oder erstelle ein leeres Board.
        </p>

        {/* Board name input */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Board-Name</label>
          <Input
            placeholder="Mein Board"
            value={boardName}
            onChange={(e) => setBoardName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
            autoFocus
          />
        </div>

        {/* Blank board option */}
        <div className="mb-4">
          <button
            onClick={() => setSelectedId(null)}
            className={`w-full text-left p-3 rounded-lg border-2 transition-colors ${
              selectedId === null
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 bg-white dark:bg-gray-800'
            }`}
          >
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Leeres Board</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Beginne mit einem leeren Board (To Do, In Progress, Done)
            </p>
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-gray-400 dark:text-gray-500">Vorlagen laden...</p>
        ) : (
          <>
            {systemTemplates.length > 0 && (
              <>
                <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                  System-Vorlagen
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                  {systemTemplates.map((t) => (
                    <TemplateCard
                      key={t.id}
                      template={t}
                      isSelected={selectedId === t.id}
                      onSelect={() => setSelectedId(selectedId === t.id ? null : t.id)}
                    />
                  ))}
                </div>
              </>
            )}
            {teamTemplates.length > 0 && (
              <>
                <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                  Team-Vorlagen
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                  {teamTemplates.map((t) => (
                    <TemplateCard
                      key={t.id}
                      template={t}
                      isSelected={selectedId === t.id}
                      onSelect={() => setSelectedId(selectedId === t.id ? null : t.id)}
                    />
                  ))}
                </div>
              </>
            )}
          </>
        )}

        <div className="flex gap-2 justify-end mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
          <Button variant="ghost" onClick={onClose}>
            Abbrechen
          </Button>
          <Button onClick={handleConfirm} disabled={!boardName.trim()}>
            Board erstellen
          </Button>
        </div>
      </div>
    </Modal>
  );
}
