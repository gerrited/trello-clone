import { useState, useRef, useEffect } from 'react';
import { Tag, Plus, Check, Pencil, Trash2 } from 'lucide-react';
import { LABEL_COLORS } from '@trello-clone/shared';
import type { Label } from '@trello-clone/shared';
import { useBoardStore } from '../../stores/boardStore.js';
import * as labelsApi from '../../api/labels.api.js';
import { toast } from 'sonner';

interface LabelPickerProps {
  boardId: string;
  cardId: string;
  cardLabels: Array<{ id: string; name: string; color: string }>;
  onToggle: (label: { id: string; name: string; color: string }, action: 'add' | 'remove') => void;
}

export function LabelPicker({ boardId, cardId, cardLabels, onToggle }: LabelPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [editingLabel, setEditingLabel] = useState<Label | null>(null);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState<string>(LABEL_COLORS[0]);
  const popoverRef = useRef<HTMLDivElement>(null);

  const boardLabels = useBoardStore((s) => s.board?.labels ?? []);
  const addLabelToStore = useBoardStore((s) => s.addLabel);
  const updateLabelInStore = useBoardStore((s) => s.updateLabel);
  const removeLabelFromStore = useBoardStore((s) => s.removeLabel);

  // Close popover on outside click
  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setShowCreate(false);
        setEditingLabel(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleToggleLabel = async (label: Label) => {
    const isAssigned = cardLabels.some((l) => l.id === label.id);
    try {
      if (isAssigned) {
        await labelsApi.removeCardLabel(boardId, cardId, label.id);
        onToggle({ id: label.id, name: label.name, color: label.color }, 'remove');
      } else {
        await labelsApi.addCardLabel(boardId, cardId, label.id);
        onToggle({ id: label.id, name: label.name, color: label.color }, 'add');
      }
    } catch {
      toast.error('Label konnte nicht aktualisiert werden');
    }
  };

  const handleCreateLabel = async () => {
    if (!newName.trim()) return;
    try {
      const label = await labelsApi.createLabel(boardId, { name: newName.trim(), color: newColor });
      addLabelToStore(label);
      setNewName('');
      setNewColor(LABEL_COLORS[0]);
      setShowCreate(false);
    } catch {
      toast.error('Label konnte nicht erstellt werden');
    }
  };

  const handleUpdateLabel = async () => {
    if (!editingLabel || !newName.trim()) return;
    try {
      const updated = await labelsApi.updateLabel(boardId, editingLabel.id, {
        name: newName.trim(),
        color: newColor,
      });
      updateLabelInStore(updated.id, updated);
      setEditingLabel(null);
      setNewName('');
      setNewColor(LABEL_COLORS[0]);
    } catch {
      toast.error('Label konnte nicht aktualisiert werden');
    }
  };

  const handleDeleteLabel = async (labelId: string) => {
    if (!window.confirm('Label wirklich löschen? Es wird von allen Karten entfernt.')) return;
    try {
      await labelsApi.deleteLabel(boardId, labelId);
      removeLabelFromStore(labelId);
      setEditingLabel(null);
    } catch {
      toast.error('Label konnte nicht gelöscht werden');
    }
  };

  const startEdit = (label: Label, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingLabel(label);
    setNewName(label.name);
    setNewColor(label.color);
    setShowCreate(false);
  };

  return (
    <div className="relative" ref={popoverRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
      >
        <Tag size={14} />
        Labels
      </button>

      {isOpen && (
        <div className="absolute z-50 top-full left-0 mt-1 w-72 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="p-3 border-b border-gray-100 dark:border-gray-700">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Labels</h4>
          </div>

          {/* Edit / Create form */}
          {(showCreate || editingLabel) ? (
            <div className="p-3 space-y-3">
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { if (editingLabel) { handleUpdateLabel(); } else { handleCreateLabel(); } }
                  if (e.key === 'Escape') { setShowCreate(false); setEditingLabel(null); }
                }}
                placeholder="Label-Name..."
                className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="grid grid-cols-6 gap-1.5">
                {LABEL_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => setNewColor(color)}
                    className={`w-8 h-8 rounded-md transition-all flex items-center justify-center ${
                      newColor === color ? 'ring-2 ring-offset-1 ring-blue-500 scale-110' : 'hover:scale-105'
                    }`}
                    style={{ backgroundColor: color }}
                  >
                    {newColor === color && <Check size={14} className="text-white" />}
                  </button>
                ))}
              </div>
              {/* Preview */}
              {newName.trim() && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 dark:text-gray-500">Vorschau:</span>
                  <span
                    className="text-xs px-2 py-0.5 rounded-full text-white font-medium"
                    style={{ backgroundColor: newColor }}
                  >
                    {newName.trim()}
                  </span>
                </div>
              )}
              <div className="flex gap-2">
                <button
                  onClick={editingLabel ? handleUpdateLabel : handleCreateLabel}
                  disabled={!newName.trim()}
                  className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {editingLabel ? 'Speichern' : 'Erstellen'}
                </button>
                {editingLabel && (
                  <button
                    onClick={() => handleDeleteLabel(editingLabel.id)}
                    className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
                <button
                  onClick={() => { setShowCreate(false); setEditingLabel(null); setNewName(''); }}
                  className="px-3 py-1.5 text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  Abbrechen
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Board labels list */}
              <div className="max-h-56 overflow-y-auto p-2">
                {boardLabels.length === 0 ? (
                  <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-3">Noch keine Labels vorhanden</p>
                ) : (
                  boardLabels.map((label) => {
                    const isAssigned = cardLabels.some((l) => l.id === label.id);
                    return (
                      <div
                        key={label.id}
                        className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 group cursor-pointer"
                        onClick={() => handleToggleLabel(label)}
                      >
                        <div
                          className="flex-1 flex items-center gap-2 min-w-0"
                        >
                          <span
                            className="flex-1 text-sm px-2.5 py-1 rounded text-white font-medium truncate"
                            style={{ backgroundColor: label.color }}
                          >
                            {label.name}
                          </span>
                        </div>
                        {isAssigned && <Check size={16} className="text-blue-600 flex-shrink-0" />}
                        <button
                          onClick={(e) => startEdit(label, e)}
                          className="p-1 text-gray-300 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                        >
                          <Pencil size={12} />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Create new label button */}
              <div className="p-2 border-t border-gray-100 dark:border-gray-700">
                <button
                  onClick={() => { setShowCreate(true); setNewName(''); setNewColor(LABEL_COLORS[0]); }}
                  className="w-full flex items-center justify-center gap-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md px-3 py-2 transition-colors"
                >
                  <Plus size={14} />
                  Neues Label erstellen
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
