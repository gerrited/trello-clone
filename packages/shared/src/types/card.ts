export type CardType = 'story' | 'bug' | 'task';

export interface Card {
  id: string;
  boardId: string;
  columnId: string;
  swimlaneId: string;
  parentCardId: string | null;
  cardType: CardType;
  title: string;
  description: string | null;
  position: string;
  dueDate: string | null;
  isArchived: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CardSummary {
  id: string;
  columnId: string;
  swimlaneId: string;
  parentCardId: string | null;
  cardType: CardType;
  title: string;
  position: string;
  dueDate: string | null;
  assignees: Array<{ id: string; displayName: string; avatarUrl: string | null }>;
  labels: Array<{ id: string; name: string; color: string }>;
  commentCount: number;
  subtaskCount: number;
  subtaskDoneCount: number;
}

export interface CardDetail extends Card {
  assignees: Array<{ id: string; displayName: string; avatarUrl: string | null }>;
  labels: Array<{ id: string; name: string; color: string }>;
  comments: import('./comment.js').Comment[];
  subtasks: CardSummary[];
  parentCard: { id: string; title: string; cardType: CardType } | null;
}
