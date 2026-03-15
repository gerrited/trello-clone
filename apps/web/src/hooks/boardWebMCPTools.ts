import type { WebMCPTool } from './useWebMCP.js';
import { useBoardStore } from '../stores/boardStore.js';
import * as boardsApi from '../api/boards.api.js';
import * as cardsApi from '../api/cards.api.js';
import * as teamsApi from '../api/teams.api.js';
import * as assigneesApi from '../api/assignees.api.js';
import type { CardSummary } from '@trello-clone/shared';

function isUUID(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

/**
 * Returns all 10 WebMCP tool definitions for the board page.
 * Plain function — no React hooks. boardId and teamId are closed over.
 */
export function createBoardWebMCPTools(params: {
  boardId: string;
  teamId: string;
}): WebMCPTool[] {
  const { boardId, teamId } = params;

  return [
    // ── Phase 1 tools ──────────────────────────────────────────────────────
    {
      name: 'list_current_team_boards',
      description:
        'List all boards in the current team. Scoped to the team the user is viewing — not all teams.',
      inputSchema: { type: 'object', properties: {} },
      execute: async () => {
        const boards = await boardsApi.listBoards(teamId);
        return boards.map((b) => ({ id: b.id, name: b.name }));
      },
    },
    {
      name: 'list_columns',
      description:
        'List all columns on the current board with their id, name, and WIP limit. Returns [] if the board is not yet loaded.',
      inputSchema: { type: 'object', properties: {} },
      execute: async () => {
        const board = useBoardStore.getState().board;
        if (!board) return [];
        return board.columns.map((c) => ({
          id: c.id,
          name: c.name,
          wipLimit: c.wipLimit ?? null,
        }));
      },
    },
    {
      name: 'create_card',
      description:
        'Create a new card on the current board. Use list_columns first to get valid column IDs.',
      inputSchema: {
        type: 'object',
        required: ['title', 'columnId'],
        properties: {
          title: { type: 'string', minLength: 1, maxLength: 500 },
          columnId: { type: 'string', format: 'uuid', description: 'Use list_columns to get a valid ID.' },
          description: { type: 'string', maxLength: 5000 },
          cardType: { type: 'string', enum: ['story', 'bug', 'task'] },
          swimlaneId: { type: 'string', format: 'uuid' },
        },
      },
      execute: async (input: unknown) => {
        const { title, columnId, description, cardType, swimlaneId } = input as {
          title: string;
          columnId: string;
          description?: string;
          cardType?: 'story' | 'bug' | 'task';
          swimlaneId?: string;
        };

        if (!isUUID(columnId)) {
          throw new Error('columnId must be a valid UUID. Use list_columns to get valid column IDs.');
        }

        const board = useBoardStore.getState().board;
        if (!board) {
          throw new Error('Board is not loaded yet. Please wait and try again.');
        }

        let card;
        try {
          card = await cardsApi.createCard(boardId, {
            title,
            columnId,
            ...(description !== undefined ? { description } : {}),
            ...(cardType !== undefined ? { cardType } : {}),
            ...(swimlaneId !== undefined ? { swimlaneId } : {}),
          });
        } catch (err) {
          const apiErr = err as { response?: { status?: number; data?: { message?: string } } };
          if (
            apiErr.response?.status === 404 &&
            apiErr.response?.data?.message === 'Column not found on this board'
          ) {
            throw new Error('Column not found on this board. Use list_columns to get valid column IDs.');
          }
          throw err;
        }

        const cardSummary: CardSummary = {
          id: card.id,
          columnId: card.columnId,
          swimlaneId: card.swimlaneId,
          parentCardId: card.parentCardId,
          cardType: card.cardType,
          title: card.title,
          position: card.position,
          dueDate: card.dueDate ?? null,
          assignees: [],
          labels: [],
          commentCount: 0,
          subtaskCount: 0,
          subtaskDoneCount: 0,
          attachmentCount: 0,
        };

        useBoardStore.getState().addCard(cardSummary);
        return card;
      },
    },

    // ── Phase 2 read tools ─────────────────────────────────────────────────
    {
      name: 'list_cards',
      description:
        'List cards on the current board. Optional: filter by columnId and/or search text in title.',
      inputSchema: {
        type: 'object',
        properties: {
          columnId: {
            type: 'string',
            format: 'uuid',
            description: 'Filter to this column only. Use list_columns to get valid IDs.',
          },
          search: {
            type: 'string',
            maxLength: 200,
            description: 'Case-insensitive substring match on card title.',
          },
        },
      },
      execute: async (input: unknown) => {
        const { columnId, search } = ((input ?? {}) as { columnId?: string; search?: string });

        if (columnId !== undefined && !isUUID(columnId)) {
          throw new Error('columnId must be a valid UUID. Use list_columns to get valid column IDs.');
        }

        const board = useBoardStore.getState().board;
        if (!board) return [];

        let cards = board.cards;
        if (columnId !== undefined) {
          cards = cards.filter((c) => c.columnId === columnId);
        }
        if (search !== undefined && search.length > 0) {
          const q = search.toLowerCase();
          cards = cards.filter((c) => c.title.toLowerCase().includes(q));
        }

        return cards.map((c) => ({
          id: c.id,
          title: c.title,
          columnId: c.columnId,
          swimlaneId: c.swimlaneId,
          cardType: c.cardType,
          dueDate: c.dueDate,
          assignees: c.assignees,
          labels: c.labels,
          commentCount: c.commentCount,
        }));
      },
    },
    {
      name: 'list_current_team_members',
      description:
        'List members of the current team. Use the returned user IDs with assign_user.',
      inputSchema: { type: 'object', properties: {} },
      execute: async () => {
        const team = await teamsApi.getTeam(teamId);
        return team.members.map((m) => ({
          id: m.userId,
          displayName: m.displayName,
          email: m.email,
        }));
      },
    },

    // ── Phase 2 write tools ────────────────────────────────────────────────
    {
      name: 'update_card',
      description:
        'Update fields on a card. Provide at least one of: title, description, cardType, dueDate.',
      inputSchema: {
        type: 'object',
        required: ['cardId'],
        properties: {
          cardId: { type: 'string', format: 'uuid', description: 'Use list_cards to get valid card IDs.' },
          title: { type: 'string', minLength: 1, maxLength: 500 },
          description: { type: 'string', maxLength: 5000, nullable: true },
          cardType: { type: 'string', enum: ['story', 'bug', 'task'] },
          dueDate: { type: 'string', nullable: true, description: 'ISO 8601 datetime or null to clear.' },
        },
      },
      execute: async (input: unknown) => {
        const { cardId, title, description, cardType, dueDate } = input as {
          cardId: string;
          title?: string;
          description?: string | null;
          cardType?: 'story' | 'bug' | 'task';
          dueDate?: string | null;
        };

        if (!isUUID(cardId)) {
          throw new Error('cardId must be a valid UUID. Use list_cards to get valid card IDs.');
        }

        const board = useBoardStore.getState().board;
        if (!board) {
          throw new Error('Board is not loaded yet. Please wait and try again.');
        }

        let card;
        try {
          card = await cardsApi.updateCard(boardId, cardId, {
            ...(title !== undefined ? { title } : {}),
            ...(description !== undefined ? { description } : {}),
            ...(cardType !== undefined ? { cardType } : {}),
            ...(dueDate !== undefined ? { dueDate } : {}),
          });
        } catch (err) {
          const apiErr = err as { response?: { status?: number } };
          if (apiErr.response?.status === 404) {
            throw new Error('Card not found. Use list_cards to get valid card IDs.');
          }
          throw err;
        }

        useBoardStore.getState().updateCard(cardId, {
          title: card.title,
          cardType: card.cardType,
          dueDate: card.dueDate ?? null,
        });

        return card;
      },
    },
    {
      name: 'move_card',
      description:
        'Move a card to a different column. Use "top" or "bottom" for position.',
      inputSchema: {
        type: 'object',
        required: ['cardId', 'columnId', 'position'],
        properties: {
          cardId: { type: 'string', format: 'uuid' },
          columnId: { type: 'string', format: 'uuid', description: 'Use list_columns to get valid IDs.' },
          position: { type: 'string', enum: ['top', 'bottom'] },
          swimlaneId: { type: 'string', format: 'uuid' },
        },
      },
      execute: async (input: unknown) => {
        const { cardId, columnId, position, swimlaneId } = input as {
          cardId: string;
          columnId: string;
          position: 'top' | 'bottom';
          swimlaneId?: string;
        };

        if (!isUUID(cardId)) {
          throw new Error('cardId must be a valid UUID. Use list_cards to get valid card IDs.');
        }
        if (!isUUID(columnId)) {
          throw new Error('columnId must be a valid UUID. Use list_columns to get valid column IDs.');
        }
        if (swimlaneId !== undefined && !isUUID(swimlaneId)) {
          throw new Error('swimlaneId must be a valid UUID.');
        }

        const board = useBoardStore.getState().board;
        if (!board) {
          throw new Error('Board is not loaded yet. Please wait and try again.');
        }

        let afterId: string | null = null;
        if (position === 'bottom') {
          const movingCard = board.cards.find((c) => c.id === cardId);
          const targetSwimlaneId = swimlaneId ?? movingCard?.swimlaneId;
          const colCards = board.cards
            .filter(
              (c) =>
                c.columnId === columnId &&
                (targetSwimlaneId === undefined || c.swimlaneId === targetSwimlaneId) &&
                c.id !== cardId,
            )
            .sort((a, b) => a.position.localeCompare(b.position));
          afterId = colCards.length > 0 ? colCards[colCards.length - 1].id : null;
        }

        const card = await cardsApi.moveCard(boardId, cardId, {
          columnId,
          afterId,
          ...(swimlaneId !== undefined ? { swimlaneId } : {}),
        });

        useBoardStore.getState().moveCard(card.id, card.columnId, card.swimlaneId, card.position);
        return card;
      },
    },
    {
      name: 'delete_card',
      description: 'Delete a card permanently from the board.',
      inputSchema: {
        type: 'object',
        required: ['cardId'],
        properties: {
          cardId: { type: 'string', format: 'uuid', description: 'Use list_cards to get valid card IDs.' },
        },
      },
      execute: async (input: unknown) => {
        const { cardId } = input as { cardId: string };

        if (!isUUID(cardId)) {
          throw new Error('cardId must be a valid UUID. Use list_cards to get valid card IDs.');
        }

        const board = useBoardStore.getState().board;
        if (!board) {
          throw new Error('Board is not loaded yet. Please wait and try again.');
        }

        try {
          await cardsApi.deleteCard(boardId, cardId);
        } catch (err) {
          const apiErr = err as { response?: { status?: number } };
          if (apiErr.response?.status === 404) {
            throw new Error('Card not found. Use list_cards to get valid card IDs.');
          }
          throw err;
        }

        useBoardStore.getState().removeCard(cardId);
        return { success: true };
      },
    },
    {
      name: 'assign_user',
      description:
        'Assign a team member to a card. Use list_current_team_members to get valid user IDs.',
      inputSchema: {
        type: 'object',
        required: ['cardId', 'userId'],
        properties: {
          cardId: { type: 'string', format: 'uuid' },
          userId: { type: 'string', format: 'uuid' },
        },
      },
      execute: async (input: unknown) => {
        const { cardId, userId } = input as { cardId: string; userId: string };

        if (!isUUID(cardId)) {
          throw new Error('cardId must be a valid UUID. Use list_cards to get valid card IDs.');
        }
        if (!isUUID(userId)) {
          throw new Error('userId must be a valid UUID. Use list_current_team_members to get valid user IDs.');
        }

        let assignee;
        try {
          assignee = await assigneesApi.addAssignee(boardId, cardId, userId);
        } catch (err) {
          const apiErr = err as { response?: { status?: number } };
          if (apiErr.response?.status === 409) {
            // Already assigned — silently succeed, return existing from store (idempotent).
            // In normal operation the assignee is always present in the store on 409.
            const card = useBoardStore.getState().board?.cards.find((c) => c.id === cardId);
            const existing = card?.assignees.find((a) => a.id === userId);
            if (existing) return existing;
          }
          throw err;
        }

        const board = useBoardStore.getState().board;
        if (board) {
          const card = board.cards.find((c) => c.id === cardId);
          if (card && !card.assignees.some((a) => a.id === assignee.id)) {
            useBoardStore.getState().updateCard(cardId, {
              assignees: [...card.assignees, assignee],
            });
          }
        }

        return assignee;
      },
    },
    {
      name: 'unassign_user',
      description: 'Remove a team member from a card.',
      inputSchema: {
        type: 'object',
        required: ['cardId', 'userId'],
        properties: {
          cardId: { type: 'string', format: 'uuid' },
          userId: { type: 'string', format: 'uuid' },
        },
      },
      execute: async (input: unknown) => {
        const { cardId, userId } = input as { cardId: string; userId: string };

        if (!isUUID(cardId)) {
          throw new Error('cardId must be a valid UUID. Use list_cards to get valid card IDs.');
        }
        if (!isUUID(userId)) {
          throw new Error('userId must be a valid UUID. Use list_current_team_members to get valid user IDs.');
        }

        await assigneesApi.removeAssignee(boardId, cardId, userId);

        const board = useBoardStore.getState().board;
        if (board) {
          const card = board.cards.find((c) => c.id === cardId);
          if (card) {
            useBoardStore.getState().updateCard(cardId, {
              assignees: card.assignees.filter((a) => a.id !== userId),
            });
          }
        }

        return { success: true };
      },
    },
  ];
}
