export const WS_EVENTS = {
  BOARD_JOIN: 'board:join',
  BOARD_LEAVE: 'board:leave',

  CARD_CREATED: 'card:created',
  CARD_UPDATED: 'card:updated',
  CARD_MOVED: 'card:moved',
  CARD_ARCHIVED: 'card:archived',

  COLUMN_CREATED: 'column:created',
  COLUMN_UPDATED: 'column:updated',
  COLUMN_MOVED: 'column:moved',
  COLUMN_DELETED: 'column:deleted',

  SWIMLANE_CREATED: 'swimlane:created',
  SWIMLANE_UPDATED: 'swimlane:updated',
  SWIMLANE_MOVED: 'swimlane:moved',
  SWIMLANE_DELETED: 'swimlane:deleted',

  COMMENT_CREATED: 'comment:created',
  COMMENT_UPDATED: 'comment:updated',
  COMMENT_DELETED: 'comment:deleted',

  ASSIGNEE_ADDED: 'assignee:added',
  ASSIGNEE_REMOVED: 'assignee:removed',
} as const;
