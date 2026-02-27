import { useEffect, useState } from 'react';
import { X, Link2, Trash2, Copy, Check, UserPlus } from 'lucide-react';
import { Modal } from '../../components/ui/Modal.js';
import * as sharesApi from '../../api/shares.api.js';
import type { BoardShare, BoardPermission } from '@trello-clone/shared';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  boardId: string;
}

const PERMISSION_LABELS: Record<BoardPermission, string> = {
  read: 'Lesen',
  comment: 'Kommentieren',
  edit: 'Bearbeiten',
};

export function ShareBoardModal({ isOpen, onClose, boardId }: Props) {
  const [shares, setShares] = useState<BoardShare[]>([]);
  const [loading, setLoading] = useState(false);

  // Invite by email
  const [email, setEmail] = useState('');
  const [invitePermission, setInvitePermission] = useState<BoardPermission>('read');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState('');

  // Link sharing
  const [linkPermission, setLinkPermission] = useState<BoardPermission>('read');
  const [linkLoading, setLinkLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    sharesApi.listShares(boardId).then(setShares).finally(() => setLoading(false));
  }, [isOpen, boardId]);

  const handleInvite = async () => {
    if (!email.trim()) return;
    setInviteLoading(true);
    setInviteError('');
    try {
      const share = await sharesApi.createUserShare(boardId, { email: email.trim(), permission: invitePermission });
      setShares((prev) => [...prev, share]);
      setEmail('');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      setInviteError(err.response?.data?.message || 'Einladung fehlgeschlagen');
    } finally {
      setInviteLoading(false);
    }
  };

  const handleCreateLink = async () => {
    setLinkLoading(true);
    try {
      const share = await sharesApi.createLinkShare(boardId, { permission: linkPermission });
      setShares((prev) => [...prev, share]);
    } catch {
      // ignore
    } finally {
      setLinkLoading(false);
    }
  };

  const handleDelete = async (shareId: string) => {
    try {
      await sharesApi.deleteShare(boardId, shareId);
      setShares((prev) => prev.filter((s) => s.id !== shareId));
    } catch {
      // ignore
    }
  };

  const handleCopyLink = (token: string, shareId: string) => {
    const url = `${window.location.origin}/shared/${token}`;
    navigator.clipboard.writeText(url);
    setCopiedId(shareId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const userShares = shares.filter((s) => s.userId !== null);
  const linkShares = shares.filter((s) => s.token !== null);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Board teilen">
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900">Board teilen</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        {/* Invite by email */}
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1.5">
            <UserPlus size={14} />
            Per Email einladen
          </h3>
          <div className="flex gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@example.com"
              className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
            />
            <select
              value={invitePermission}
              onChange={(e) => setInvitePermission(e.target.value as BoardPermission)}
              className="px-2 py-2 text-sm border border-gray-300 rounded-lg bg-white"
            >
              <option value="read">Lesen</option>
              <option value="comment">Kommentieren</option>
              <option value="edit">Bearbeiten</option>
            </select>
            <button
              onClick={handleInvite}
              disabled={inviteLoading || !email.trim()}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              Einladen
            </button>
          </div>
          {inviteError && <p className="text-xs text-red-600 mt-1">{inviteError}</p>}
        </div>

        {/* Link sharing */}
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1.5">
            <Link2 size={14} />
            Link erstellen
          </h3>
          <div className="flex gap-2">
            <select
              value={linkPermission}
              onChange={(e) => setLinkPermission(e.target.value as BoardPermission)}
              className="px-2 py-2 text-sm border border-gray-300 rounded-lg bg-white"
            >
              <option value="read">Lesen</option>
              <option value="comment">Kommentieren</option>
              <option value="edit">Bearbeiten</option>
            </select>
            <button
              onClick={handleCreateLink}
              disabled={linkLoading}
              className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              Link erstellen
            </button>
          </div>
        </div>

        {/* Existing shares list */}
        {loading ? (
          <p className="text-sm text-gray-400">Laden...</p>
        ) : (
          <div className="space-y-4">
            {/* User shares */}
            {userShares.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">Eingeladene Benutzer</h4>
                <div className="space-y-2">
                  {userShares.map((share) => (
                    <div key={share.id} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        {share.user?.avatarUrl ? (
                          <img src={share.user.avatarUrl} alt="" className="w-6 h-6 rounded-full" />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs flex items-center justify-center font-medium">
                            {share.user?.displayName?.charAt(0) ?? '?'}
                          </div>
                        )}
                        <div>
                          <span className="text-sm text-gray-800">{share.user?.displayName ?? share.user?.email ?? 'Unbekannt'}</span>
                          {share.user?.email && (
                            <span className="text-xs text-gray-400 ml-2">{share.user.email}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 text-gray-600">
                          {PERMISSION_LABELS[share.permission]}
                        </span>
                        <button
                          onClick={() => handleDelete(share.id)}
                          className="text-gray-400 hover:text-red-600 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Link shares */}
            {linkShares.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">Geteilte Links</h4>
                <div className="space-y-2">
                  {linkShares.map((share) => (
                    <div key={share.id} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Link2 size={14} className="text-gray-400" />
                        <span className="text-sm text-gray-600 font-mono">
                          ...{share.token?.slice(-8)}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 text-gray-600">
                          {PERMISSION_LABELS[share.permission]}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleCopyLink(share.token!, share.id)}
                          className="text-gray-400 hover:text-blue-600 transition-colors"
                          title="Link kopieren"
                        >
                          {copiedId === share.id ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
                        </button>
                        <button
                          onClick={() => handleDelete(share.id)}
                          className="text-gray-400 hover:text-red-600 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {userShares.length === 0 && linkShares.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">
                Noch keine Freigaben. Laden Sie Benutzer ein oder erstellen Sie einen Link.
              </p>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
