import { eq, and, or, asc } from 'drizzle-orm';
import { db, schema } from '../../db/index.js';
import { AppError } from '../../middleware/error.js';
import { getPositionAfter } from '../../utils/ordering.js';
import type { BoardTemplateConfig } from '@trello-clone/shared';

// System templates seeded at startup
const SYSTEM_TEMPLATES = [
  {
    name: 'Kanban Basic',
    description: 'Ein einfaches Kanban Board mit 4 Standard-Spalten',
    isSystem: true,
    teamId: null,
    createdBy: null,
    config: {
      columns: [
        { name: 'To Do' },
        { name: 'In Progress' },
        { name: 'Review' },
        { name: 'Done' },
      ],
      swimlanes: [],
      labels: [],
    },
  },
  {
    name: 'Scrum Board',
    description: 'Sprint-basiertes Board mit Swimlanes fuer Stories und Bugs',
    isSystem: true,
    teamId: null,
    createdBy: null,
    config: {
      columns: [
        { name: 'Backlog' },
        { name: 'Sprint Backlog' },
        { name: 'In Progress' },
        { name: 'Testing' },
        { name: 'Done' },
      ],
      swimlanes: [{ name: 'Stories' }, { name: 'Bugs' }],
      labels: [
        { name: 'High Priority', color: '#ef4444' },
        { name: 'Medium Priority', color: '#f97316' },
        { name: 'Low Priority', color: '#22c55e' },
      ],
    },
  },
  {
    name: 'Bug Tracking',
    description: 'Issue-Tracking Board optimiert fuer Bug-Management',
    isSystem: true,
    teamId: null,
    createdBy: null,
    config: {
      columns: [
        { name: 'New' },
        { name: 'Triaged' },
        { name: 'In Progress' },
        { name: 'Testing' },
        { name: 'Closed' },
      ],
      swimlanes: [],
      labels: [
        { name: 'Critical', color: '#ef4444' },
        { name: 'Major', color: '#f97316' },
        { name: 'Minor', color: '#eab308' },
        { name: 'Enhancement', color: '#3b82f6' },
      ],
    },
  },
];

async function requireTeamMember(teamId: string, userId: string) {
  const membership = await db.query.teamMemberships.findFirst({
    where: and(
      eq(schema.teamMemberships.teamId, teamId),
      eq(schema.teamMemberships.userId, userId),
    ),
  });
  if (!membership) throw new AppError(403, 'Not a member of this team');
  return membership;
}

export async function listTemplates(teamId: string, userId: string) {
  await requireTeamMember(teamId, userId);

  // Return system templates + team-specific templates
  const templates = await db.query.boardTemplates.findMany({
    where: or(
      eq(schema.boardTemplates.isSystem, true),
      eq(schema.boardTemplates.teamId, teamId),
    ),
    orderBy: [asc(schema.boardTemplates.createdAt)],
  });

  return templates.map((t) => ({
    ...t,
    config: t.config as BoardTemplateConfig,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  }));
}

export async function createTemplate(
  teamId: string,
  userId: string,
  input: { name: string; description?: string; config: BoardTemplateConfig },
) {
  await requireTeamMember(teamId, userId);

  const [template] = await db
    .insert(schema.boardTemplates)
    .values({
      teamId,
      name: input.name,
      description: input.description ?? null,
      isSystem: false,
      createdBy: userId,
      config: input.config,
    })
    .returning();

  return {
    ...template,
    config: template.config as BoardTemplateConfig,
    createdAt: template.createdAt.toISOString(),
    updatedAt: template.updatedAt.toISOString(),
  };
}

export async function updateTemplate(
  teamId: string,
  templateId: string,
  userId: string,
  input: { name?: string; description?: string | null; config?: BoardTemplateConfig },
) {
  await requireTeamMember(teamId, userId);

  const template = await db.query.boardTemplates.findFirst({
    where: and(
      eq(schema.boardTemplates.id, templateId),
      eq(schema.boardTemplates.teamId, teamId),
    ),
  });

  if (!template) throw new AppError(404, 'Template not found');
  if (template.isSystem) throw new AppError(403, 'Cannot modify system templates');

  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (input.name !== undefined) updateData.name = input.name;
  if (input.description !== undefined) updateData.description = input.description;
  if (input.config !== undefined) updateData.config = input.config;

  const [updated] = await db
    .update(schema.boardTemplates)
    .set(updateData)
    .where(eq(schema.boardTemplates.id, templateId))
    .returning();

  return {
    ...updated,
    config: updated.config as BoardTemplateConfig,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
  };
}

export async function deleteTemplate(teamId: string, templateId: string, userId: string) {
  await requireTeamMember(teamId, userId);

  const template = await db.query.boardTemplates.findFirst({
    where: and(
      eq(schema.boardTemplates.id, templateId),
      eq(schema.boardTemplates.teamId, teamId),
    ),
  });

  if (!template) throw new AppError(404, 'Template not found');
  if (template.isSystem) throw new AppError(403, 'Cannot delete system templates');

  await db.delete(schema.boardTemplates).where(eq(schema.boardTemplates.id, templateId));
}

export async function createBoardFromTemplate(
  teamId: string,
  userId: string,
  input: { name: string; description?: string; templateId: string },
) {
  await requireTeamMember(teamId, userId);

  // Fetch template - allow system templates or team templates
  const template = await db.query.boardTemplates.findFirst({
    where: and(
      eq(schema.boardTemplates.id, input.templateId),
      or(
        eq(schema.boardTemplates.isSystem, true),
        eq(schema.boardTemplates.teamId, teamId),
      ),
    ),
  });

  if (!template) throw new AppError(404, 'Template not found');

  const config = template.config as BoardTemplateConfig;

  return await db.transaction(async (tx) => {
    // Create the board
    const [board] = await tx
      .insert(schema.boards)
      .values({
        teamId,
        name: input.name,
        description: input.description ?? null,
        createdBy: userId,
      })
      .returning();

    // Create columns from template config
    let colPos: string | null = null;
    if (config.columns.length > 0) {
      for (const colConfig of config.columns) {
        colPos = getPositionAfter(colPos);
        await tx.insert(schema.columns).values({
          boardId: board.id,
          name: colConfig.name,
          position: colPos,
          color: colConfig.color ?? null,
          wipLimit: colConfig.wipLimit ?? null,
        });
      }
    } else {
      // Fall back to defaults if no columns defined
      for (const name of ['To Do', 'In Progress', 'Done']) {
        colPos = getPositionAfter(colPos);
        await tx.insert(schema.columns).values({ boardId: board.id, name, position: colPos });
      }
    }

    // Create swimlanes from template config (or default if none)
    if (config.swimlanes.length > 0) {
      let slPos: string | null = null;
      for (let i = 0; i < config.swimlanes.length; i++) {
        slPos = getPositionAfter(slPos);
        await tx.insert(schema.swimlanes).values({
          boardId: board.id,
          name: config.swimlanes[i].name,
          position: slPos,
          isDefault: i === 0,
        });
      }
    } else {
      await tx.insert(schema.swimlanes).values({
        boardId: board.id,
        name: 'Default',
        position: getPositionAfter(null),
        isDefault: true,
      });
    }

    // Create labels from template config
    for (const labelConfig of config.labels) {
      await tx.insert(schema.labels).values({
        boardId: board.id,
        name: labelConfig.name,
        color: labelConfig.color,
      });
    }

    return board;
  });
}

export async function saveAsTemplate(
  boardId: string,
  userId: string,
  input: { name: string; description?: string },
) {
  // Fetch board and verify access
  const board = await db.query.boards.findFirst({
    where: eq(schema.boards.id, boardId),
  });
  if (!board) throw new AppError(404, 'Board not found');

  await requireTeamMember(board.teamId, userId);

  // Fetch current board structure
  const [boardColumns, boardSwimlanes, boardLabels] = await Promise.all([
    db.query.columns.findMany({
      where: eq(schema.columns.boardId, boardId),
      orderBy: [asc(schema.columns.position)],
    }),
    db.query.swimlanes.findMany({
      where: eq(schema.swimlanes.boardId, boardId),
      orderBy: [asc(schema.swimlanes.position)],
    }),
    db.query.labels.findMany({
      where: eq(schema.labels.boardId, boardId),
    }),
  ]);

  const config: BoardTemplateConfig = {
    columns: boardColumns.map((c) => ({
      name: c.name,
      ...(c.color ? { color: c.color } : {}),
      ...(c.wipLimit !== null ? { wipLimit: c.wipLimit } : {}),
    })),
    swimlanes: boardSwimlanes
      .filter((s) => !s.isDefault || boardSwimlanes.length > 1)
      .map((s) => ({ name: s.name })),
    labels: boardLabels.map((l) => ({ name: l.name, color: l.color })),
  };

  const [template] = await db
    .insert(schema.boardTemplates)
    .values({
      teamId: board.teamId,
      name: input.name,
      description: input.description ?? null,
      isSystem: false,
      createdBy: userId,
      config,
    })
    .returning();

  return {
    ...template,
    config: template.config as BoardTemplateConfig,
    createdAt: template.createdAt.toISOString(),
    updatedAt: template.updatedAt.toISOString(),
  };
}

export async function ensureSystemTemplates() {
  // Called once at startup to seed system templates if not present
  const existing = await db.query.boardTemplates.findMany({
    where: eq(schema.boardTemplates.isSystem, true),
    columns: { name: true },
  });

  const existingNames = new Set(existing.map((t) => t.name));

  for (const tmpl of SYSTEM_TEMPLATES) {
    if (!existingNames.has(tmpl.name)) {
      await db.insert(schema.boardTemplates).values(tmpl);
    }
  }
}
