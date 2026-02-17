import { relations } from 'drizzle-orm';
import {
  users,
  teams,
  teamMemberships,
  boards,
  columns,
  swimlanes,
  cards,
  cardAssignees,
  comments,
  labels,
  cardLabels,
  activities,
  notifications,
  boardTemplates,
  refreshTokens,
} from './schema.js';

export const usersRelations = relations(users, ({ many }) => ({
  teamMemberships: many(teamMemberships),
  createdBoards: many(boards),
  cardAssignees: many(cardAssignees),
  comments: many(comments),
  activities: many(activities),
  notifications: many(notifications),
  refreshTokens: many(refreshTokens),
}));

export const teamsRelations = relations(teams, ({ many }) => ({
  memberships: many(teamMemberships),
  boards: many(boards),
  templates: many(boardTemplates),
}));

export const teamMembershipsRelations = relations(teamMemberships, ({ one }) => ({
  team: one(teams, { fields: [teamMemberships.teamId], references: [teams.id] }),
  user: one(users, { fields: [teamMemberships.userId], references: [users.id] }),
}));

export const boardsRelations = relations(boards, ({ one, many }) => ({
  team: one(teams, { fields: [boards.teamId], references: [teams.id] }),
  creator: one(users, { fields: [boards.createdBy], references: [users.id] }),
  columns: many(columns),
  swimlanes: many(swimlanes),
  cards: many(cards),
  labels: many(labels),
  activities: many(activities),
}));

export const columnsRelations = relations(columns, ({ one, many }) => ({
  board: one(boards, { fields: [columns.boardId], references: [boards.id] }),
  cards: many(cards),
}));

export const swimlanesRelations = relations(swimlanes, ({ one, many }) => ({
  board: one(boards, { fields: [swimlanes.boardId], references: [boards.id] }),
  cards: many(cards),
}));

export const cardsRelations = relations(cards, ({ one, many }) => ({
  board: one(boards, { fields: [cards.boardId], references: [boards.id] }),
  column: one(columns, { fields: [cards.columnId], references: [columns.id] }),
  swimlane: one(swimlanes, { fields: [cards.swimlaneId], references: [swimlanes.id] }),
  parentCard: one(cards, { fields: [cards.parentCardId], references: [cards.id], relationName: 'subtasks' }),
  subtasks: many(cards, { relationName: 'subtasks' }),
  creator: one(users, { fields: [cards.createdBy], references: [users.id] }),
  assignees: many(cardAssignees),
  comments: many(comments),
  cardLabels: many(cardLabels),
}));

export const cardAssigneesRelations = relations(cardAssignees, ({ one }) => ({
  card: one(cards, { fields: [cardAssignees.cardId], references: [cards.id] }),
  user: one(users, { fields: [cardAssignees.userId], references: [users.id] }),
}));

export const commentsRelations = relations(comments, ({ one }) => ({
  card: one(cards, { fields: [comments.cardId], references: [cards.id] }),
  author: one(users, { fields: [comments.authorId], references: [users.id] }),
}));

export const labelsRelations = relations(labels, ({ one, many }) => ({
  board: one(boards, { fields: [labels.boardId], references: [boards.id] }),
  cardLabels: many(cardLabels),
}));

export const cardLabelsRelations = relations(cardLabels, ({ one }) => ({
  card: one(cards, { fields: [cardLabels.cardId], references: [cards.id] }),
  label: one(labels, { fields: [cardLabels.labelId], references: [labels.id] }),
}));

export const activitiesRelations = relations(activities, ({ one }) => ({
  board: one(boards, { fields: [activities.boardId], references: [boards.id] }),
  card: one(cards, { fields: [activities.cardId], references: [cards.id] }),
  user: one(users, { fields: [activities.userId], references: [users.id] }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, { fields: [notifications.userId], references: [users.id] }),
  activity: one(activities, { fields: [notifications.activityId], references: [activities.id] }),
}));

export const boardTemplatesRelations = relations(boardTemplates, ({ one }) => ({
  team: one(teams, { fields: [boardTemplates.teamId], references: [teams.id] }),
  creator: one(users, { fields: [boardTemplates.createdBy], references: [users.id] }),
}));

export const refreshTokensRelations = relations(refreshTokens, ({ one }) => ({
  user: one(users, { fields: [refreshTokens.userId], references: [users.id] }),
}));
