export type ActivityAction =
  | 'card.created'
  | 'card.updated'
  | 'card.moved'
  | 'card.archived'
  | 'comment.created'
  | 'comment.deleted'
  | 'assignee.added'
  | 'assignee.removed'
  | 'label.added'
  | 'label.removed'
  | 'column.created'
  | 'column.deleted'
  | 'swimlane.created'
  | 'swimlane.deleted'
  | 'dueDate.set'
  | 'dueDate.cleared';

export interface Activity {
  id: string;
  boardId: string;
  cardId: string | null;
  userId: string;
  action: ActivityAction;
  entityType: string;
  entityId: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  user: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
  };
}

export interface Notification {
  id: string;
  activityId: string;
  isRead: boolean;
  createdAt: string;
  activity: Activity;
}
