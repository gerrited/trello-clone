import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import React from 'react';
import { useBoardWebMCP } from './useBoardWebMCP.js';
import { useBoardStore } from '../stores/boardStore.js';
import type { BoardDetail } from '../api/boards.api.js';
import type { Board } from '@trello-clone/shared';
import type { WebMCPTool } from './useWebMCP.js';

// --- Mocks ---
vi.mock('../api/boards.api.js', () => ({
  listBoards: vi.fn(),
}));
vi.mock('../api/cards.api.js', () => ({
  createCard: vi.fn(),
}));

import * as boardsApi from '../api/boards.api.js';
import * as cardsApi from '../api/cards.api.js';

// --- Helpers ---
const TEAM_ID = 'team-abc';
const BOARD_ID = 'board-xyz';

const makeBoard = (): BoardDetail => ({
  id: BOARD_ID,
  teamId: TEAM_ID,
  name: 'Test Board',
  description: null,
  createdBy: 'user-1',
  isArchived: false,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  columns: [
    { id: '11111111-1111-1111-1111-111111111111', boardId: BOARD_ID, name: 'To Do', position: 'a0', wipLimit: null, color: null, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' },
    { id: '22222222-2222-2222-2222-222222222222', boardId: BOARD_ID, name: 'Done', position: 'b0', wipLimit: 5, color: null, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' },
  ],
  swimlanes: [
    { id: '33333333-3333-3333-3333-333333333333', boardId: BOARD_ID, name: 'Default', position: 'a0', isDefault: true, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' },
  ],
  cards: [],
  labels: [],
});

// Wrapper that provides React Router params
const wrapper = ({ children }: { children: React.ReactNode }) => (
  React.createElement(
    MemoryRouter,
    { initialEntries: [`/teams/${TEAM_ID}/boards/${BOARD_ID}`] },
    React.createElement(
      Routes,
      null,
      React.createElement(Route, {
        path: '/teams/:teamId/boards/:boardId',
        element: React.createElement(React.Fragment, null, children),
      })
    )
  )
);

// Capture registered tools via mocked navigator.modelContext
let registeredTools: WebMCPTool[] = [];
const registerTool = vi.fn((tool: WebMCPTool) => { registeredTools.push(tool); });
const unregisterTool = vi.fn();

beforeEach(() => {
  registeredTools = [];
  registerTool.mockClear();
  unregisterTool.mockClear();
  Object.defineProperty(navigator, 'modelContext', {
    value: { registerTool, unregisterTool },
    writable: true,
    configurable: true,
  });
  useBoardStore.setState({ board: makeBoard(), isLoading: false, selectedCardId: null });
  vi.mocked(boardsApi.listBoards).mockReset();
  vi.mocked(cardsApi.createCard).mockReset();
});

afterEach(() => {
  Object.defineProperty(navigator, 'modelContext', {
    value: undefined,
    writable: true,
    configurable: true,
  });
});

// --- Tests ---
describe('list_current_team_boards', () => {
  it('returns projected board list', async () => {
    const boards: Board[] = [
      { id: 'b-1', teamId: TEAM_ID, name: 'Alpha', description: null, createdBy: 'u', isArchived: false, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' },
      { id: 'b-2', teamId: TEAM_ID, name: 'Beta', description: null, createdBy: 'u', isArchived: false, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' },
    ];
    vi.mocked(boardsApi.listBoards).mockResolvedValue(boards);

    renderHook(() => useBoardWebMCP(), { wrapper });

    const tool = registeredTools.find((t) => t.name === 'list_current_team_boards')!;
    const result = await tool.execute({});

    expect(boardsApi.listBoards).toHaveBeenCalledWith(TEAM_ID);
    expect(result).toEqual([{ id: 'b-1', name: 'Alpha' }, { id: 'b-2', name: 'Beta' }]);
  });
});

describe('list_columns', () => {
  it('returns columns from the board store', async () => {
    renderHook(() => useBoardWebMCP(), { wrapper });

    const tool = registeredTools.find((t) => t.name === 'list_columns')!;
    const result = await tool.execute({});

    expect(result).toEqual([
      { id: '11111111-1111-1111-1111-111111111111', name: 'To Do', wipLimit: null },
      { id: '22222222-2222-2222-2222-222222222222', name: 'Done', wipLimit: 5 },
    ]);
  });

  it('returns empty array when board is not loaded', async () => {
    useBoardStore.setState({ board: null, isLoading: true, selectedCardId: null });
    renderHook(() => useBoardWebMCP(), { wrapper });

    const tool = registeredTools.find((t) => t.name === 'list_columns')!;
    const result = await tool.execute({});

    expect(result).toEqual([]);
  });
});

describe('create_card', () => {
  // description: null is required — Card.description is `string | null`
  const validCard = {
    id: 'new-card-1',
    boardId: BOARD_ID,
    columnId: '11111111-1111-1111-1111-111111111111',
    swimlaneId: '33333333-3333-3333-3333-333333333333',
    parentCardId: null,
    cardType: 'task' as const,
    title: 'My new card',
    description: null,
    position: 'a0',
    dueDate: null,
    isArchived: false,
    createdBy: 'user-1',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };

  it('creates a card and returns it', async () => {
    vi.mocked(cardsApi.createCard).mockResolvedValue(validCard);
    renderHook(() => useBoardWebMCP(), { wrapper });

    const tool = registeredTools.find((t) => t.name === 'create_card')!;
    const result = await tool.execute({ title: 'My new card', columnId: '11111111-1111-1111-1111-111111111111' });

    expect(cardsApi.createCard).toHaveBeenCalledWith(BOARD_ID, {
      title: 'My new card',
      columnId: '11111111-1111-1111-1111-111111111111',
    });
    expect(result).toEqual(validCard);
  });

  it('adds the card to the board store', async () => {
    vi.mocked(cardsApi.createCard).mockResolvedValue(validCard);
    renderHook(() => useBoardWebMCP(), { wrapper });

    const tool = registeredTools.find((t) => t.name === 'create_card')!;
    await tool.execute({ title: 'My new card', columnId: '11111111-1111-1111-1111-111111111111' });

    const cards = useBoardStore.getState().board?.cards ?? [];
    expect(cards).toHaveLength(1);
    expect(cards[0].id).toBe('new-card-1');
    expect(cards[0].assignees).toEqual([]);
    expect(cards[0].commentCount).toBe(0);
  });

  it('passes optional fields when provided', async () => {
    vi.mocked(cardsApi.createCard).mockResolvedValue(validCard);
    renderHook(() => useBoardWebMCP(), { wrapper });

    const tool = registeredTools.find((t) => t.name === 'create_card')!;
    await tool.execute({
      title: 'Bug fix',
      columnId: '11111111-1111-1111-1111-111111111111',
      description: 'Some details',
      cardType: 'bug',
      swimlaneId: '33333333-3333-3333-3333-333333333333',
    });

    expect(cardsApi.createCard).toHaveBeenCalledWith(BOARD_ID, {
      title: 'Bug fix',
      columnId: '11111111-1111-1111-1111-111111111111',
      description: 'Some details',
      cardType: 'bug',
      swimlaneId: '33333333-3333-3333-3333-333333333333',
    });
  });

  it('throws a descriptive error for a malformed columnId (not a UUID)', async () => {
    renderHook(() => useBoardWebMCP(), { wrapper });

    const tool = registeredTools.find((t) => t.name === 'create_card')!;
    await expect(tool.execute({ title: 'Test', columnId: 'not-a-uuid' }))
      .rejects.toThrow('columnId must be a valid UUID. Use list_columns to get valid column IDs.');
  });

  it('throws when board is not loaded', async () => {
    useBoardStore.setState({ board: null, isLoading: true, selectedCardId: null });
    renderHook(() => useBoardWebMCP(), { wrapper });

    const tool = registeredTools.find((t) => t.name === 'create_card')!;
    await expect(tool.execute({ title: 'Test', columnId: '11111111-1111-1111-1111-111111111111' }))
      .rejects.toThrow('Board is not loaded yet. Please wait and try again.');
  });

  it('re-throws a descriptive error when API returns 404 with "Column not found" message', async () => {
    const axiosError = { response: { status: 404, data: { message: 'Column not found on this board' } } };
    vi.mocked(cardsApi.createCard).mockRejectedValue(axiosError);
    renderHook(() => useBoardWebMCP(), { wrapper });

    const tool = registeredTools.find((t) => t.name === 'create_card')!;
    await expect(
      tool.execute({ title: 'Test', columnId: '11111111-1111-1111-1111-111111111111' }),
    ).rejects.toThrow('Column not found on this board. Use list_columns to get valid column IDs.');
  });

  it('re-throws the original error when API returns 404 for an invalid swimlaneId', async () => {
    // The swimlaneId 404 is NOT wrapped — it re-throws as-is (original message)
    const axiosError = { response: { status: 404, data: { message: 'Swimlane not found on this board' } }, message: 'Swimlane not found on this board' };
    vi.mocked(cardsApi.createCard).mockRejectedValue(axiosError);
    renderHook(() => useBoardWebMCP(), { wrapper });

    const tool = registeredTools.find((t) => t.name === 'create_card')!;
    await expect(
      tool.execute({ title: 'Test', columnId: '11111111-1111-1111-1111-111111111111', swimlaneId: '22222222-2222-2222-2222-222222222222' }),
    ).rejects.toMatchObject({ message: 'Swimlane not found on this board' });
  });

  it('re-throws other API errors with their original message', async () => {
    const axiosError = { response: { status: 403, data: { message: 'Forbidden' } }, message: 'Forbidden' };
    vi.mocked(cardsApi.createCard).mockRejectedValue(axiosError);
    renderHook(() => useBoardWebMCP(), { wrapper });

    const tool = registeredTools.find((t) => t.name === 'create_card')!;
    await expect(
      tool.execute({ title: 'Test', columnId: '11111111-1111-1111-1111-111111111111' }),
    ).rejects.toMatchObject({ message: 'Forbidden' });
  });
});
