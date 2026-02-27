import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../config/env.js', () => ({
  env: {
    JWT_SECRET: 'test-jwt-secret-min-10-chars',
    JWT_REFRESH_SECRET: 'test-refresh-secret-min-10-chars',
    DATABASE_URL: 'postgresql://localhost:5432/test_db',
  },
}));

vi.mock('../../db/index.js', async () => ({
  db: {
    query: {
      teamMemberships: { findFirst: vi.fn(), findMany: vi.fn() },
      teams: { findFirst: vi.fn() },
      users: { findFirst: vi.fn() },
    },
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  schema: await import('../../db/schema.js'),
}));

import { db } from '../../db/index.js';
import {
  createTeam,
  getUserTeams,
  getTeam,
  updateTeam,
  deleteTeam,
  inviteMember,
  removeMember,
  updateMemberRole,
} from './teams.service.js';

type MockedDb = {
  query: {
    teamMemberships: { findFirst: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn> };
    teams: { findFirst: ReturnType<typeof vi.fn> };
    users: { findFirst: ReturnType<typeof vi.fn> };
  };
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

const dbMock = db as unknown as MockedDb;

// ---------------------------------------------------------------------------
// Fixture data
// ---------------------------------------------------------------------------

const mockTeam = {
  id: 'team-123',
  name: 'Test Team',
  slug: 'test-team-abc123',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockInvitee = {
  id: 'user-456',
  email: 'invitee@example.com',
  displayName: 'Invitee User',
  avatarUrl: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockOwnerMembership = {
  id: 'membership-1',
  teamId: 'team-123',
  userId: 'user-123',
  role: 'owner',
  createdAt: new Date(),
};

const mockAdminMembership = {
  id: 'membership-1',
  teamId: 'team-123',
  userId: 'user-123',
  role: 'admin',
  createdAt: new Date(),
};

const mockMemberMembership = {
  id: 'membership-1',
  teamId: 'team-123',
  userId: 'user-123',
  role: 'member',
  createdAt: new Date(),
};

// ---------------------------------------------------------------------------
// Helpers for building mock chains
// ---------------------------------------------------------------------------

function makeInsertReturning(data: unknown[]) {
  const returning = vi.fn().mockResolvedValue(data);
  const values = vi.fn().mockReturnValue({ returning });
  return { values };
}

function makeInsertNoReturning() {
  const values = vi.fn().mockResolvedValue(undefined);
  return { values };
}

function makeUpdateReturning(data: unknown[]) {
  const returning = vi.fn().mockResolvedValue(data);
  const where = vi.fn().mockReturnValue({ returning });
  const set = vi.fn().mockReturnValue({ where });
  return { set };
}

function makeDelete() {
  const where = vi.fn().mockResolvedValue(undefined);
  return { where };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// createTeam
// ---------------------------------------------------------------------------

describe('createTeam', () => {
  it('creates team and inserts owner membership, returns team object', async () => {
    dbMock.insert
      .mockReturnValueOnce(makeInsertReturning([mockTeam]))
      .mockReturnValueOnce(makeInsertNoReturning());

    const result = await createTeam('user-123', { name: 'Test Team' });

    expect(result).toEqual(mockTeam);
    expect(dbMock.insert).toHaveBeenCalledTimes(2);
  });

  it('generates a non-empty slug based on the team name', async () => {
    dbMock.insert
      .mockReturnValueOnce(makeInsertReturning([mockTeam]))
      .mockReturnValueOnce(makeInsertNoReturning());

    await createTeam('user-123', { name: 'My Team' });

    const firstInsertValues = dbMock.insert.mock.results[0]?.value?.values;
    const insertedData = firstInsertValues?.mock?.calls[0]?.[0] as Record<string, unknown>;

    expect(typeof insertedData.slug).toBe('string');
    expect((insertedData.slug as string).length).toBeGreaterThan(0);
    expect(insertedData.slug as string).toMatch(/^my-team-/);
  });
});

// ---------------------------------------------------------------------------
// getUserTeams
// ---------------------------------------------------------------------------

describe('getUserTeams', () => {
  it('returns array of teams with role attached', async () => {
    const memberships = [
      { team: mockTeam, role: 'owner' },
      { team: { ...mockTeam, id: 'team-456', name: 'Another Team' }, role: 'member' },
    ];
    dbMock.query.teamMemberships.findMany.mockResolvedValue(memberships);

    const result = await getUserTeams('user-123');

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ ...mockTeam, role: 'owner' });
    expect(result[1]).toEqual({ ...memberships[1].team, role: 'member' });
  });
});

// ---------------------------------------------------------------------------
// getTeam
// ---------------------------------------------------------------------------

describe('getTeam', () => {
  it('throws 403 when user has no membership', async () => {
    dbMock.query.teamMemberships.findFirst.mockResolvedValue(null);

    await expect(getTeam('team-123', 'user-123')).rejects.toMatchObject({
      statusCode: 403,
      message: 'Not a member of this team',
    });
  });

  it('throws 404 when membership exists but team not found', async () => {
    dbMock.query.teamMemberships.findFirst.mockResolvedValue(mockOwnerMembership);
    dbMock.query.teams.findFirst.mockResolvedValue(null);
    dbMock.query.teamMemberships.findMany.mockResolvedValue([]);

    await expect(getTeam('team-123', 'user-123')).rejects.toMatchObject({
      statusCode: 404,
      message: 'Team not found',
    });
  });

  it('returns team with members array', async () => {
    const memberWithUser = {
      id: 'membership-1',
      teamId: 'team-123',
      userId: 'user-123',
      role: 'owner',
      createdAt: new Date(),
      user: {
        id: 'user-123',
        email: 'owner@example.com',
        displayName: 'Owner User',
        avatarUrl: null,
      },
    };

    dbMock.query.teamMemberships.findFirst.mockResolvedValue(mockOwnerMembership);
    dbMock.query.teams.findFirst.mockResolvedValue(mockTeam);
    dbMock.query.teamMemberships.findMany.mockResolvedValue([memberWithUser]);

    const result = await getTeam('team-123', 'user-123');

    expect(result.id).toBe('team-123');
    expect(result.members).toHaveLength(1);
    expect(result.members[0]).toMatchObject({
      userId: 'user-123',
      role: 'owner',
      displayName: 'Owner User',
      email: 'owner@example.com',
    });
  });
});

// ---------------------------------------------------------------------------
// updateTeam
// ---------------------------------------------------------------------------

describe('updateTeam', () => {
  it('throws 403 when user role is "member"', async () => {
    dbMock.query.teamMemberships.findFirst.mockResolvedValue(mockMemberMembership);

    await expect(updateTeam('team-123', 'user-123', { name: 'New Name' })).rejects.toMatchObject({
      statusCode: 403,
      message: 'Insufficient permissions',
    });
  });

  it('updates and returns team when user is "admin"', async () => {
    dbMock.query.teamMemberships.findFirst.mockResolvedValue(mockAdminMembership);

    const updatedTeam = { ...mockTeam, name: 'Updated Team' };
    dbMock.update.mockReturnValue(makeUpdateReturning([updatedTeam]));

    const result = await updateTeam('team-123', 'user-123', { name: 'Updated Team' });

    expect(result).toEqual(updatedTeam);
  });
});

// ---------------------------------------------------------------------------
// deleteTeam
// ---------------------------------------------------------------------------

describe('deleteTeam', () => {
  it('throws 403 when user role is "admin" (only owner allowed)', async () => {
    dbMock.query.teamMemberships.findFirst.mockResolvedValue(mockAdminMembership);

    await expect(deleteTeam('team-123', 'user-123')).rejects.toMatchObject({
      statusCode: 403,
      message: 'Insufficient permissions',
    });
  });

  it('deletes team when user is "owner"', async () => {
    dbMock.query.teamMemberships.findFirst.mockResolvedValue(mockOwnerMembership);
    dbMock.delete.mockReturnValue(makeDelete());

    await expect(deleteTeam('team-123', 'user-123')).resolves.toBeUndefined();

    expect(dbMock.delete).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// inviteMember
// ---------------------------------------------------------------------------

describe('inviteMember', () => {
  it('throws 403 when caller is "member"', async () => {
    dbMock.query.teamMemberships.findFirst.mockResolvedValue(mockMemberMembership);

    await expect(
      inviteMember('team-123', 'user-123', { email: 'invitee@example.com', role: 'member' }),
    ).rejects.toMatchObject({
      statusCode: 403,
      message: 'Insufficient permissions',
    });
  });

  it('throws 404 when invitee email not found', async () => {
    dbMock.query.teamMemberships.findFirst.mockResolvedValue(mockOwnerMembership);
    dbMock.query.users.findFirst.mockResolvedValue(null);

    await expect(
      inviteMember('team-123', 'user-123', { email: 'nobody@example.com', role: 'member' }),
    ).rejects.toMatchObject({
      statusCode: 404,
      message: 'User not found with this email',
    });
  });

  it('throws 409 when invitee is already a team member', async () => {
    dbMock.query.teamMemberships.findFirst
      .mockResolvedValueOnce(mockOwnerMembership)
      .mockResolvedValueOnce({ id: 'existing-membership', role: 'member' });
    dbMock.query.users.findFirst.mockResolvedValue(mockInvitee);

    await expect(
      inviteMember('team-123', 'user-123', { email: 'invitee@example.com', role: 'member' }),
    ).rejects.toMatchObject({
      statusCode: 409,
      message: 'User is already a team member',
    });
  });

  it('creates and returns membership on success', async () => {
    const newMembership = {
      id: 'membership-new',
      teamId: 'team-123',
      userId: mockInvitee.id,
      role: 'member',
      createdAt: new Date(),
    };

    dbMock.query.teamMemberships.findFirst
      .mockResolvedValueOnce(mockOwnerMembership)
      .mockResolvedValueOnce(null);
    dbMock.query.users.findFirst.mockResolvedValue(mockInvitee);
    dbMock.insert.mockReturnValue(makeInsertReturning([newMembership]));

    const result = await inviteMember('team-123', 'user-123', {
      email: 'invitee@example.com',
      role: 'member',
    });

    expect(result).toEqual(newMembership);
  });
});

// ---------------------------------------------------------------------------
// removeMember
// ---------------------------------------------------------------------------

describe('removeMember', () => {
  it('throws 403 when caller is "member"', async () => {
    dbMock.query.teamMemberships.findFirst.mockResolvedValue(mockMemberMembership);

    await expect(removeMember('team-123', 'user-123', 'user-456')).rejects.toMatchObject({
      statusCode: 403,
      message: 'Insufficient permissions',
    });
  });

  it('throws 400 when userId equals targetUserId', async () => {
    dbMock.query.teamMemberships.findFirst.mockResolvedValue(mockOwnerMembership);

    await expect(removeMember('team-123', 'user-123', 'user-123')).rejects.toMatchObject({
      statusCode: 400,
      message: 'Cannot remove yourself',
    });
  });

  it('deletes membership on success', async () => {
    dbMock.query.teamMemberships.findFirst.mockResolvedValue(mockOwnerMembership);
    dbMock.delete.mockReturnValue(makeDelete());

    await expect(removeMember('team-123', 'user-123', 'user-456')).resolves.toBeUndefined();

    expect(dbMock.delete).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// updateMemberRole
// ---------------------------------------------------------------------------

describe('updateMemberRole', () => {
  it('throws 403 when caller is "admin" (only owner allowed)', async () => {
    dbMock.query.teamMemberships.findFirst.mockResolvedValue(mockAdminMembership);

    await expect(
      updateMemberRole('team-123', 'user-123', 'user-456', { role: 'member' }),
    ).rejects.toMatchObject({
      statusCode: 403,
      message: 'Insufficient permissions',
    });
  });

  it('updates and returns membership when caller is "owner"', async () => {
    const updatedMembership = {
      id: 'membership-456',
      teamId: 'team-123',
      userId: 'user-456',
      role: 'admin',
      createdAt: new Date(),
    };

    dbMock.query.teamMemberships.findFirst.mockResolvedValue(mockOwnerMembership);
    dbMock.update.mockReturnValue(makeUpdateReturning([updatedMembership]));

    const result = await updateMemberRole('team-123', 'user-123', 'user-456', { role: 'admin' });

    expect(result).toEqual(updatedMembership);
  });
});
