import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import React from 'react';
import { useBoardWebMCP } from './useBoardWebMCP.js';
import { useBoardStore } from '../stores/boardStore.js';
import type { BoardDetail } from '../api/boards.api.js';

vi.mock('../api/boards.api.js', () => ({ listBoards: vi.fn() }));
vi.mock('../api/cards.api.js', () => ({
  createCard: vi.fn(),
  updateCard: vi.fn(),
  moveCard: vi.fn(),
  deleteCard: vi.fn(),
}));
vi.mock('../api/assignees.api.js', () => ({
  addAssignee: vi.fn(),
  removeAssignee: vi.fn(),
}));
vi.mock('../api/teams.api.js', () => ({ getTeam: vi.fn() }));

const TEAM_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const BOARD_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

const makeBoard = (): BoardDetail => ({
  id: BOARD_ID, teamId: TEAM_ID, name: 'Board', description: null,
  createdBy: 'u', isArchived: false,
  createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
  columns: [], swimlanes: [], cards: [], labels: [],
});

const wrapper = ({ children }: { children: React.ReactNode }) =>
  React.createElement(
    MemoryRouter, { initialEntries: [`/teams/${TEAM_ID}/boards/${BOARD_ID}`] },
    React.createElement(Routes, null,
      React.createElement(Route, {
        path: '/teams/:teamId/boards/:boardId',
        element: React.createElement(React.Fragment, null, children),
      }),
    ),
  );

const registerTool = vi.fn();
const unregisterTool = vi.fn();

beforeEach(() => {
  registerTool.mockClear();
  unregisterTool.mockClear();
  Object.defineProperty(navigator, 'modelContext', {
    value: { registerTool, unregisterTool },
    writable: true,
    configurable: true,
  });
  useBoardStore.setState({ board: makeBoard(), isLoading: false, selectedCardId: null });
});

afterEach(() => {
  Object.defineProperty(navigator, 'modelContext', {
    value: undefined,
    writable: true,
    configurable: true,
  });
});

describe('useBoardWebMCP', () => {
  it('registers exactly 10 tools via navigator.modelContext', () => {
    renderHook(() => useBoardWebMCP(), { wrapper });
    expect(registerTool).toHaveBeenCalledTimes(10);
    const names = (registerTool.mock.calls as [{ name: string }][]).map((c) => c[0].name);
    expect(names).toEqual(
      expect.arrayContaining([
        'list_current_team_boards',
        'list_columns',
        'create_card',
        'list_cards',
        'list_current_team_members',
        'update_card',
        'move_card',
        'delete_card',
        'assign_user',
        'unassign_user',
      ]),
    );
  });
});
