import { eq, and } from 'drizzle-orm';
import { db, schema } from '../../db/index.js';
import { AppError } from '../../middleware/error.js';
import { slugify } from '../../utils/slug.js';
import type { CreateTeamInput, UpdateTeamInput, InviteMemberInput, UpdateMemberRoleInput } from '@trello-clone/shared';

export async function createTeam(userId: string, input: CreateTeamInput) {
  const slug = slugify(input.name) + '-' + Date.now().toString(36);

  const [team] = await db.insert(schema.teams).values({ name: input.name, slug }).returning();

  await db.insert(schema.teamMemberships).values({
    teamId: team.id,
    userId,
    role: 'owner',
  });

  return team;
}

export async function getUserTeams(userId: string) {
  const memberships = await db.query.teamMemberships.findMany({
    where: eq(schema.teamMemberships.userId, userId),
    with: { team: true },
  });

  return memberships.map((m) => ({ ...m.team, role: m.role }));
}

export async function getTeam(teamId: string, userId: string) {
  const membership = await db.query.teamMemberships.findFirst({
    where: and(eq(schema.teamMemberships.teamId, teamId), eq(schema.teamMemberships.userId, userId)),
  });

  if (!membership) {
    throw new AppError(403, 'Not a member of this team');
  }

  const team = await db.query.teams.findFirst({
    where: eq(schema.teams.id, teamId),
  });

  if (!team) {
    throw new AppError(404, 'Team not found');
  }

  const members = await db.query.teamMemberships.findMany({
    where: eq(schema.teamMemberships.teamId, teamId),
    with: {
      user: { columns: { id: true, email: true, displayName: true, avatarUrl: true } },
    },
  });

  return {
    ...team,
    members: members.map((m) => ({
      id: m.id,
      userId: m.user.id,
      role: m.role,
      displayName: m.user.displayName,
      email: m.user.email,
      avatarUrl: m.user.avatarUrl,
    })),
  };
}

export async function updateTeam(teamId: string, userId: string, input: UpdateTeamInput) {
  await requireRole(teamId, userId, ['owner', 'admin']);

  const [team] = await db
    .update(schema.teams)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(schema.teams.id, teamId))
    .returning();

  return team;
}

export async function deleteTeam(teamId: string, userId: string) {
  await requireRole(teamId, userId, ['owner']);
  await db.delete(schema.teams).where(eq(schema.teams.id, teamId));
}

export async function inviteMember(teamId: string, userId: string, input: InviteMemberInput) {
  await requireRole(teamId, userId, ['owner', 'admin']);

  const invitee = await db.query.users.findFirst({
    where: eq(schema.users.email, input.email),
  });

  if (!invitee) {
    throw new AppError(404, 'User not found with this email');
  }

  const existing = await db.query.teamMemberships.findFirst({
    where: and(eq(schema.teamMemberships.teamId, teamId), eq(schema.teamMemberships.userId, invitee.id)),
  });

  if (existing) {
    throw new AppError(409, 'User is already a team member');
  }

  const [membership] = await db
    .insert(schema.teamMemberships)
    .values({ teamId, userId: invitee.id, role: input.role })
    .returning();

  return membership;
}

export async function removeMember(teamId: string, userId: string, targetUserId: string) {
  await requireRole(teamId, userId, ['owner', 'admin']);

  if (userId === targetUserId) {
    throw new AppError(400, 'Cannot remove yourself');
  }

  await db
    .delete(schema.teamMemberships)
    .where(and(eq(schema.teamMemberships.teamId, teamId), eq(schema.teamMemberships.userId, targetUserId)));
}

export async function updateMemberRole(teamId: string, userId: string, targetUserId: string, input: UpdateMemberRoleInput) {
  await requireRole(teamId, userId, ['owner']);

  const [membership] = await db
    .update(schema.teamMemberships)
    .set({ role: input.role })
    .where(and(eq(schema.teamMemberships.teamId, teamId), eq(schema.teamMemberships.userId, targetUserId)))
    .returning();

  return membership;
}

async function requireRole(teamId: string, userId: string, roles: string[]) {
  const membership = await db.query.teamMemberships.findFirst({
    where: and(eq(schema.teamMemberships.teamId, teamId), eq(schema.teamMemberships.userId, userId)),
  });

  if (!membership || !roles.includes(membership.role)) {
    throw new AppError(403, 'Insufficient permissions');
  }
}
