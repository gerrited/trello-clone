import type { APIRequestContext } from '@playwright/test';

const API_BASE = 'http://localhost:3001/api/v1';

export async function createTestUser(
  request: APIRequestContext,
  email: string,
  password: string,
  displayName: string,
): Promise<void> {
  const res = await request.post(`${API_BASE}/auth/register`, {
    data: { email, password, displayName },
  });
  if (!res.ok() && res.status() !== 409) {
    throw new Error(`Failed to register user ${email}: ${res.status()} ${await res.text()}`);
  }
}

export async function loginUser(
  request: APIRequestContext,
  email: string,
  password: string,
): Promise<string> {
  const res = await request.post(`${API_BASE}/auth/login`, {
    data: { email, password },
  });
  if (!res.ok()) {
    throw new Error(`Failed to login ${email}: ${res.status()} ${await res.text()}`);
  }
  const data = await res.json();
  return data.accessToken as string;
}

export async function createTeam(
  request: APIRequestContext,
  token: string,
  name: string,
): Promise<string> {
  const res = await request.post(`${API_BASE}/teams`, {
    data: { name },
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok()) {
    throw new Error(`Failed to create team: ${res.status()} ${await res.text()}`);
  }
  const data = await res.json();
  return data.team.id as string;
}

export async function createBoard(
  request: APIRequestContext,
  token: string,
  teamId: string,
  name: string,
): Promise<string> {
  const res = await request.post(`${API_BASE}/teams/${teamId}/boards`, {
    data: { name },
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok()) {
    throw new Error(`Failed to create board: ${res.status()} ${await res.text()}`);
  }
  const data = await res.json();
  return data.board.id as string;
}

export async function getBoard(
  request: APIRequestContext,
  token: string,
  teamId: string,
  boardId: string,
): Promise<{ columns: Array<{ id: string; name: string }>; cards: Array<{ id: string; title: string; columnId: string }> }> {
  const res = await request.get(`${API_BASE}/teams/${teamId}/boards/${boardId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok()) {
    throw new Error(`Failed to get board: ${res.status()} ${await res.text()}`);
  }
  const data = await res.json();
  return data.board;
}

export async function createCard(
  request: APIRequestContext,
  token: string,
  boardId: string,
  columnId: string,
  title: string,
): Promise<string> {
  const res = await request.post(`${API_BASE}/boards/${boardId}/cards`, {
    data: { title, columnId, cardType: 'task' },
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok()) {
    throw new Error(`Failed to create card: ${res.status()} ${await res.text()}`);
  }
  const data = await res.json();
  return data.card.id as string;
}

export async function createLinkShare(
  request: APIRequestContext,
  token: string,
  boardId: string,
  permission: 'read' | 'comment' | 'edit',
): Promise<string> {
  const res = await request.post(`${API_BASE}/boards/${boardId}/shares/link`, {
    data: { permission },
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok()) {
    throw new Error(`Failed to create link share: ${res.status()} ${await res.text()}`);
  }
  const data = await res.json();
  return data.share.token as string;
}
