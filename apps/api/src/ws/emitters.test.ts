import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockEmit, mockExcept, mockTo } = vi.hoisted(() => {
  const mockEmit = vi.fn();
  const mockExcept = vi.fn().mockReturnValue({ emit: mockEmit });
  const mockTo = vi.fn().mockReturnValue({ emit: mockEmit, except: mockExcept });
  return { mockEmit, mockExcept, mockTo };
});

vi.mock('./socket.js', () => ({
  getIO: vi.fn().mockReturnValue({ to: mockTo }),
}));

import { broadcastToBoard, emitToUser } from './emitters.js';

beforeEach(() => {
  vi.clearAllMocks();
  mockTo.mockReturnValue({ emit: mockEmit, except: mockExcept });
  mockExcept.mockReturnValue({ emit: mockEmit });
});

// ---------------------------------------------------------------------------
// broadcastToBoard
// ---------------------------------------------------------------------------

describe('broadcastToBoard', () => {
  it('emits event to board room', () => {
    broadcastToBoard('board-1', 'card:created', { id: 'card-1' });

    expect(mockTo).toHaveBeenCalledWith('board:board-1');
    expect(mockEmit).toHaveBeenCalledWith('card:created', { id: 'card-1' });
  });

  it('uses except() when excludeSocketId is provided', () => {
    broadcastToBoard('board-1', 'card:updated', { id: 'card-1' }, 'socket-123');

    expect(mockTo).toHaveBeenCalledWith('board:board-1');
    expect(mockExcept).toHaveBeenCalledWith('socket-123');
    expect(mockEmit).toHaveBeenCalledWith('card:updated', { id: 'card-1' });
  });

  it('does not call except() when no excludeSocketId', () => {
    broadcastToBoard('board-1', 'card:deleted', {});

    expect(mockExcept).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// emitToUser
// ---------------------------------------------------------------------------

describe('emitToUser', () => {
  it('emits event to user room', () => {
    emitToUser('user-1', 'notification:new', { id: 'notif-1' });

    expect(mockTo).toHaveBeenCalledWith('user:user-1');
    expect(mockEmit).toHaveBeenCalledWith('notification:new', { id: 'notif-1' });
  });
});
