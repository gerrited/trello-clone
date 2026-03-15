import { useParams } from 'react-router';
import { createBoardWebMCPTools } from './boardWebMCPTools.js';
import { useWebMCP } from './useWebMCP.js';

/**
 * Registers all WebMCP tools for the board page.
 * Only call this from BoardPage — it assumes teamId and boardId are in the URL.
 */
export function useBoardWebMCP(): void {
  const { teamId, boardId } = useParams<{ teamId: string; boardId: string }>();
  const tools = createBoardWebMCPTools({ boardId: boardId!, teamId: teamId! });
  useWebMCP(tools);
}
