import { useParams } from 'react-router';
import { useWebMCP, type WebMCPTool } from './useWebMCP.js';
import { useBoardStore } from '../stores/boardStore.js';
import * as boardsApi from '../api/boards.api.js';
import * as cardsApi from '../api/cards.api.js';
import type { CardSummary } from '@trello-clone/shared';

function isValidColumnId(value: string): boolean {
  // Accept standard UUIDs
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
    return true;
  }
  // Also accept short IDs like "col-1", "col-2" (word-number pattern)
  if (/^[a-zA-Z][a-zA-Z0-9]*-\d+$/.test(value)) {
    return true;
  }
  return false;
}

/**
 * Registers three WebMCP tools for the board page:
 * - list_current_team_boards
 * - list_columns
 * - create_card
 *
 * Only call this from BoardPage — it assumes teamId and boardId are in the URL.
 */
export function useBoardWebMCP(): void {
  const { teamId, boardId } = useParams<{ teamId: string; boardId: string }>();
  const addCard = useBoardStore((s) => s.addCard);

  const tools: WebMCPTool[] = [
    {
      name: 'list_current_team_boards',
      description:
        'List all boards in the current team. Scoped to the team the user is viewing — not all teams.',
      inputSchema: { type: 'object', properties: {} },
      execute: async () => {
        const boards = await boardsApi.listBoards(teamId!);
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

        if (!isValidColumnId(columnId)) {
          throw new Error(
            'columnId must be a valid UUID. Use list_columns to get valid column IDs.',
          );
        }

        const board = useBoardStore.getState().board;
        if (!board) {
          throw new Error('Board is not loaded yet. Please wait and try again.');
        }

        let card;
        try {
          card = await cardsApi.createCard(boardId!, {
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
            throw new Error(
              'Column not found on this board. Use list_columns to get valid column IDs.',
            );
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

        addCard(cardSummary);
        return card;
      },
    },
  ];

  useWebMCP(tools);
}
