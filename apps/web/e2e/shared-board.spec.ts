import { test, expect, type BrowserContext } from '@playwright/test';
import {
  createTestUser,
  loginUser,
  createTeam,
  createBoard,
  getBoard,
  createCard,
  createLinkShare,
} from './helpers/api.js';

// Unique suffix per run to avoid collisions between test runs
const RUN_ID = Date.now().toString(36);

async function setupBoard(request: Parameters<typeof createTestUser>[0]) {
  const email = `owner-${RUN_ID}@test.local`;
  const password = 'Test1234!';

  await createTestUser(request, email, password, `Owner ${RUN_ID}`);
  const token = await loginUser(request, email, password);
  const teamId = await createTeam(request, token, `Team ${RUN_ID}`);
  const boardId = await createBoard(request, token, teamId, `Board ${RUN_ID}`);

  const boardData = await getBoard(request, token, teamId, boardId);
  const firstColumn = boardData.columns[0];
  if (!firstColumn) throw new Error('Board has no columns');

  const cardId = await createCard(request, token, boardId, firstColumn.id, `Testkarte ${RUN_ID}`);

  return { token, teamId, boardId, cardId, cardTitle: `Testkarte ${RUN_ID}`, boardName: `Board ${RUN_ID}`, firstColumn };
}

/**
 * Navigate to /shared/:token as an unauthenticated user (no localStorage auth).
 */
async function openShareLinkUnauthenticated(context: BrowserContext, shareToken: string) {
  // Clear all storage to ensure unauthenticated state
  await context.clearCookies();
  const page = await context.newPage();
  await page.goto(`/shared/${shareToken}`);
  return page;
}

// ──────────────────────────────────────────────────────────────
// Test 1: Read-only share — unauthenticated user sees board but no edit controls
// ──────────────────────────────────────────────────────────────
test('read share: unauthenticated user sees board and card modal without edit controls', async ({ request, context }) => {
  const { token, boardId, cardTitle, boardName } = await setupBoard(request);
  const shareToken = await createLinkShare(request, token, boardId, 'read');

  const page = await openShareLinkUnauthenticated(context, shareToken);

  // Board name should be visible
  await expect(page.getByRole('heading', { name: boardName })).toBeVisible();

  // Card should be visible
  await expect(page.getByText(cardTitle)).toBeVisible();

  // Banner shows read-only label
  await expect(page.getByText('Nur lesen')).toBeVisible();

  // Click the card to open modal
  await page.getByText(cardTitle).click();

  // Modal opens — card title visible
  await expect(page.getByRole('dialog', { name: 'Kartendetails' })).toBeVisible();
  await expect(page.getByText(cardTitle)).toBeVisible();

  // No "Karte löschen" button (canEdit = false)
  await expect(page.getByText('Karte löschen')).not.toBeVisible();

  // No "Speichern" button in description (canEdit = false)
  await expect(page.getByRole('button', { name: 'Speichern' })).not.toBeVisible();

  // No comment textarea (canComment = false because not authenticated)
  await expect(page.getByPlaceholder('Kommentar schreiben...')).not.toBeVisible();

  // No login hint (permission is 'read', so showLoginHint = false)
  await expect(page.getByText('um zu kommentieren')).not.toBeVisible();

  await page.close();
});

// ──────────────────────────────────────────────────────────────
// Test 2: Comment share — unauthenticated user sees login hint
// ──────────────────────────────────────────────────────────────
test('comment share: unauthenticated user sees login hint in card modal', async ({ request, context }) => {
  const { token, boardId, cardTitle } = await setupBoard(request);
  const shareToken = await createLinkShare(request, token, boardId, 'comment');

  const page = await openShareLinkUnauthenticated(context, shareToken);

  // Banner shows comment label
  await expect(page.getByText('Kommentieren')).toBeVisible();

  // Click the card to open modal
  await page.getByText(cardTitle).click();
  await expect(page.getByRole('dialog', { name: 'Kartendetails' })).toBeVisible();

  // No comment textarea (not authenticated)
  await expect(page.getByPlaceholder('Kommentar schreiben...')).not.toBeVisible();

  // Login hint IS visible (permission is 'comment' but no user)
  await expect(page.getByText('um zu kommentieren')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Anmelden' })).toBeVisible();

  // No delete button (canEdit = false)
  await expect(page.getByText('Karte löschen')).not.toBeVisible();

  await page.close();
});

// ──────────────────────────────────────────────────────────────
// Test 3: Edit share — authenticated non-member user has full edit access
// ──────────────────────────────────────────────────────────────
test('edit share: authenticated non-member can comment via link', async ({ request, context }) => {
  const { token, boardId, cardTitle } = await setupBoard(request);
  const shareToken = await createLinkShare(request, token, boardId, 'edit');

  // Create a second user (not a team member)
  const guestEmail = `guest-${RUN_ID}@test.local`;
  const guestPassword = 'GuestPass1234';
  await createTestUser(request, guestEmail, guestPassword, `Guest ${RUN_ID}`);

  // Log in through the UI to properly set auth state (access token in memory + refresh cookie)
  const page = await context.newPage();
  await page.goto('/login');
  await page.locator('input[type="email"]').fill(guestEmail);
  await page.locator('input[type="password"]').fill(guestPassword);
  await page.getByRole('button', { name: 'Anmelden' }).click();

  // Wait for redirect after login (should go to /teams or similar)
  await page.waitForURL('**/teams**', { timeout: 10000 });

  // Now navigate to the shared board
  await page.goto(`/shared/${shareToken}`);

  // Banner shows edit label
  await expect(page.getByText('Bearbeiten')).toBeVisible();

  // Click the card
  await page.getByText(cardTitle).click();
  await expect(page.getByRole('dialog', { name: 'Kartendetails' })).toBeVisible();

  // Comment textarea IS visible (authenticated + edit permission)
  await expect(page.getByPlaceholder('Kommentar schreiben...')).toBeVisible();

  // No login hint
  await expect(page.getByText('um zu kommentieren')).not.toBeVisible();

  await page.close();
});

// ──────────────────────────────────────────────────────────────
// Test 4: Banner shows correct permission label per share type
// ──────────────────────────────────────────────────────────────
test('banner shows correct permission label for each share type', async ({ request, context }) => {
  const { token, boardId } = await setupBoard(request);

  const readToken = await createLinkShare(request, token, boardId, 'read');
  const commentToken = await createLinkShare(request, token, boardId, 'comment');
  const editToken = await createLinkShare(request, token, boardId, 'edit');

  // read
  {
    const page = await openShareLinkUnauthenticated(context, readToken);
    await expect(page.getByText('Nur lesen')).toBeVisible();
    await page.close();
  }

  // comment
  {
    const page = await context.newPage();
    await page.goto(`/shared/${commentToken}`);
    await expect(page.getByText('Kommentieren')).toBeVisible();
    await page.close();
  }

  // edit
  {
    const page = await context.newPage();
    await page.goto(`/shared/${editToken}`);
    await expect(page.getByText('Bearbeiten')).toBeVisible();
    await page.close();
  }
});
