import type { TeamRole } from './user.js';

export interface Team {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  updatedAt: string;
}

export interface TeamMembership {
  id: string;
  teamId: string;
  userId: string;
  role: TeamRole;
  createdAt: string;
}

export interface TeamWithMembers extends Team {
  members: Array<{
    id: string;
    userId: string;
    role: TeamRole;
    displayName: string;
    email: string;
    avatarUrl: string | null;
  }>;
}
