import { useSocketStatus } from '../../hooks/useSocketStatus.js';

export function ConnectionStatus() {
  const status = useSocketStatus();

  if (status === 'connected') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-green-600" title="Echtzeit verbunden">
        <span className="w-2 h-2 rounded-full bg-green-500" />
        Live
      </span>
    );
  }

  if (status === 'connecting') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-yellow-600" title="Verbindung wird hergestellt...">
        <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
        Verbinden...
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 text-xs text-gray-400" title="Offline – keine Echtzeit-Updates">
      <span className="w-2 h-2 rounded-full bg-gray-400" />
      Offline
    </span>
  );
}
