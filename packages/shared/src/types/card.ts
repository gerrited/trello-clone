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
  assignees: Array<{ id: string; displayName: string; avatarUrl: string | null }>;
  commentCount: number;
  subtaskCount: number;
  subtaskDoneCount: number;
}
