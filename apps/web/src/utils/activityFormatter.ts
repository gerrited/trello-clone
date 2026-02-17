import type { Activity, ActivityAction } from '@trello-clone/shared';

const ACTION_MESSAGES: Record<ActivityAction, (meta: Record<string, unknown>) => string> = {
  'card.created': (meta) => `hat Karte "${meta.title || '?'}" erstellt`,
  'card.updated': (meta) => `hat Karte "${meta.title || '?'}" bearbeitet`,
  'card.moved': (meta) => `hat Karte "${meta.title || '?'}" verschoben`,
  'card.archived': () => `hat eine Karte archiviert`,
  'comment.created': () => `hat einen Kommentar hinzugefuegt`,
  'comment.deleted': () => `hat einen Kommentar geloescht`,
  'assignee.added': (meta) => meta.assigneeDisplayName
    ? `hat ${meta.assigneeDisplayName} zugewiesen`
    : `hat jemanden zugewiesen`,
  'assignee.removed': () => `hat eine Zuweisung entfernt`,
  'label.added': (meta) => meta.labelName
    ? `hat Label "${meta.labelName}" hinzugefuegt`
    : `hat ein Label hinzugefuegt`,
  'label.removed': () => `hat ein Label entfernt`,
  'column.created': (meta) => `hat Spalte "${meta.name || '?'}" erstellt`,
  'column.deleted': () => `hat eine Spalte geloescht`,
  'swimlane.created': (meta) => `hat Swimlane "${meta.name || '?'}" erstellt`,
  'swimlane.deleted': () => `hat eine Swimlane geloescht`,
  'dueDate.set': (meta) => `hat ein Faelligkeitsdatum gesetzt`,
  'dueDate.cleared': () => `hat das Faelligkeitsdatum entfernt`,
};

export function formatActivityMessage(activity: Activity): string {
  const formatter = ACTION_MESSAGES[activity.action as ActivityAction];
  if (formatter) {
    return formatter(activity.metadata);
  }
  return `hat eine Aktion ausgefuehrt (${activity.action})`;
}
