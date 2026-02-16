import { useEffect, useState } from 'react';
import { getSocket } from '../api/ws.js';

export type SocketStatus = 'connected' | 'connecting' | 'disconnected';

/**
 * Hook that tracks the current Socket.IO connection status.
 */
export function useSocketStatus(): SocketStatus {
  const [status, setStatus] = useState<SocketStatus>('disconnected');

  useEffect(() => {
    const socket = getSocket();

    const updateStatus = () => {
      if (socket.connected) {
        setStatus('connected');
      } else if (socket.active) {
        // socket.active means it's trying to reconnect
        setStatus('connecting');
      } else {
        setStatus('disconnected');
      }
    };

    updateStatus();

    socket.on('connect', updateStatus);
    socket.on('disconnect', updateStatus);
    socket.on('connect_error', updateStatus);
    socket.io.on('reconnect_attempt', () => setStatus('connecting'));
    socket.io.on('reconnect', updateStatus);

    return () => {
      socket.off('connect', updateStatus);
      socket.off('disconnect', updateStatus);
      socket.off('connect_error', updateStatus);
    };
  }, []);

  return status;
}
