export type BoardPermission = 'read' | 'comment' | 'edit';

export interface BoardShare {
  id: string;
  boardId: string;
  userId: string | null;
  token: string | null;
  permission: BoardPermission;
  createdBy: string;
  expiresAt: string | null;
  createdAt: string;
  user?: {
    id: string;
    displayName: string;
    email: string;
    avatarUrl: string | null;
  };
}

export interface CreateUserShareInput {
  email: string;
  permission: BoardPermission;
  expiresAt?: string;
}

export interface CreateLinkShareInput {
  permission: BoardPermission;
  expiresAt?: string;
}

export interface UpdateShareInput {
  permission?: BoardPermission;
  expiresAt?: string | null;
}
