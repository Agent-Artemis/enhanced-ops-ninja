/**
 * CRM e2e — crm.enhancedops.ninja
 * Uses admin generate_link to get a real session via Playwright browser navigation.
 */

import { test, expect, type BrowserContext } from '@playwright/test';

const BASE       = 'https://crm.enhancedops.ninja';
const SB_URL     = 'https://tbjynbevrhkfzpswehsj.supabase.co';
const SB_SERVICE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRianluYmV2cmhrZnpwc3dlaHNqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODI2ODU1OSwiZXhwIjoyMDkzODQ0NTU5fQ._nb8Nr46UJ5WnG55_jjq3bI5IwAbq6S0WO1AhJAexwo';

const TEST_EMAIL = `e2e-crm-${Date.now()}@enhancedops.ninja`;
let testUserId   = '';
let authedCtx: BrowserContext | null = null; // reused across tests that need auth

async function adminFetch(path: string, body?: object) {
  return fetch(`${SB_URL}/auth/v1/admin${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

test.beforeAll(async ({ browser }) => {
  // Create test user
  const r = await adminFetch('/users', { email: TEST_EMAIL, email_confirm: true });
  const user = await r.json();
  if (!user.id) throw new Error(`Could not create test user: ${JSON.stringify(user)}`);
  testUserId = user.id;
  console.log(`Test user: ${TEST_EMAIL} (${testUserId})`);

  // Get a magic link for the test user
  const lr = await adminFetch('/generate_link', {
    type: 'magiclink',
    email: TEST_EMAIL,
    options: { redirect_to: BASE },
  });
  const link = await lr.json();
  const actionLink = link.action_link as string;
  if (!actionLink) throw new Error(`No action_link: ${JSON.stringify(link)}`);
  console.log('Action link obtained');

  // Navigate in a real browser to establish a session in localStorage
  authedCtx = await browser.newContext();
  const page = await authedCtx.newPage();

  // Follow the magic link — Supabase verifies and redirects to BASE
  await page.goto(actionLink, { timeout: 30_000 });

  // Wait to land on the CRM (might go to dojo first if redirect_to isn't honoured)
  try {
    await page.waitForURL(/crm\.enhancedops\.ninja/, { timeout: 15_000 });
  } catch {
    // If redirect went elsewhere, navigate directly to CRM — session should be in context
    await page.goto(BASE, { timeout: 20_000 });
  }

  // Wait for CRM shell or login form to appear
  await page.waitForSelector('text=EON CRM', { timeout: 20_000 });
  await page.close();
  console.log('Authenticated browser context ready');
});

test.afterAll(async () => {
  if (authedCtx) await authedCtx.close();
  if (testUserId) {
    await fetch(`${SB_URL}/auth/v1/admin/users/${testUserId}`, {
      method: 'DELETE',
      headers: { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}` },
    });
    console.log('Test user deleted');
  }
});

// ── 1: Login form renders unauthenticated ─────────────────────────────────────
test('login form renders when unauthenticated', async ({ page }) => {
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30_000 });
  await expect(page.locator('h1:has-text("EON CRM")')).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('text=Sign in to continue')).toBeVisible();
  await expect(page.locator('input[type="email"]')).toBeVisible();
  await expect(page.locator('button:has-text("Send Magic Link")')).toBeVisible();
  await page.screenshot({ path: 'test-results/crm-01-login.png' });
  console.log('✅ Login form visible');
});

// ── 2: Domain restriction ─────────────────────────────────────────────────────
test('non-allowed domain shows access error', async ({ page }) => {
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30_000 });
  await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 10_000 });

  await page.locator('input[type="email"]').fill('hacker@gmail.com');
  await page.locator('input[type="email"]').press('Enter');
  await expect(page.locator('text=Access restricted')).toBeVisible({ timeout: 5_000 });
  await page.screenshot({ path: 'test-results/crm-02-rejected.png' });
  console.log('✅ Non-allowed domain rejected');
});

// ── 3: Magic link button sends request ────────────────────────────────────────
test('magic link send button makes OTP request', async ({ page }) => {
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30_000 });
  await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 10_000 });

  await page.locator('input[type="email"]').fill(TEST_EMAIL);
  // Wait for React to register the value, then click
  await page.locator('input[type="email"]').press('Enter');

  // Either we see "Check your email" or a Supabase request is made
  await expect(page.locator('text=Check your email')).toBeVisible({ timeout: 15_000 });
  await page.screenshot({ path: 'test-results/crm-03-magic-sent.png' });
  console.log('✅ Magic link sent — success state shown');
});

// ── 4: Authenticated — CRM shell shows ───────────────────────────────────────
test('authenticated session shows CRM shell', async () => {
  if (!authedCtx) { test.skip(); return; }
  const page = await authedCtx.newPage();
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30_000 });

  await expect(page.locator('text=One Card')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('text=Kanban')).toBeVisible();
  await expect(page.locator('text=List')).toBeVisible();
  await expect(page.locator('text=Sign in to continue')).not.toBeVisible();
  await page.screenshot({ path: 'test-results/crm-04-authed.png' });
  await page.close();
  console.log('✅ CRM shell visible when authenticated');
});

// ── 5: One Card view ──────────────────────────────────────────────────────────
test('One Card view shows tickler file', async () => {
  if (!authedCtx) { test.skip(); return; }
  const page = await authedCtx.newPage();
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30_000 });
  await expect(page.locator('text=One Card')).toBeVisible({ timeout: 15_000 });

  await expect(page.locator('text=TODAY')).toBeVisible({ timeout: 8_000 });
  await expect(page.locator('text=A – Z')).toBeVisible();
  await page.screenshot({ path: 'test-results/crm-05-onecard.png' });
  await page.close();
  console.log('✅ One Card: TODAY + A–Z visible');
});

// ── 6: Kanban view ────────────────────────────────────────────────────────────
test('Kanban view shows stage columns', async () => {
  if (!authedCtx) { test.skip(); return; }
  const page = await authedCtx.newPage();
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30_000 });
  await expect(page.locator('text=Kanban')).toBeVisible({ timeout: 15_000 });

  await page.locator('button:has-text("Kanban")').click();
  await expect(page.locator('text=Lead')).toBeVisible({ timeout: 8_000 });
  await expect(page.locator('text=Contacted')).toBeVisible();
  await expect(page.locator('text=Closed Won')).toBeVisible();
  await page.screenshot({ path: 'test-results/crm-06-kanban.png' });
  await page.close();
  console.log('✅ Kanban: stage columns visible');
});

// ── 7: List view ──────────────────────────────────────────────────────────────
test('List view shows table headers', async () => {
  if (!authedCtx) { test.skip(); return; }
  const page = await authedCtx.newPage();
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30_000 });
  await expect(page.locator('text=List')).toBeVisible({ timeout: 15_000 });

  await page.locator('button:has-text("List")').click();
  await expect(page.locator('text=Name')).toBeVisible({ timeout: 8_000 });
  await expect(page.locator('text=Stage')).toBeVisible();
  await page.screenshot({ path: 'test-results/crm-07-list.png' });
  await page.close();
  console.log('✅ List view: table headers visible');
});

// ── 8: New Card drawer ────────────────────────────────────────────────────────
test('New Card drawer opens and closes', async () => {
  if (!authedCtx) { test.skip(); return; }
  const page = await authedCtx.newPage();
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30_000 });
  await expect(page.locator('text=+ New Card')).toBeVisible({ timeout: 15_000 });

  await page.locator('button:has-text("+ New Card")').click();
  await expect(page.locator('text=New Contact')).toBeVisible({ timeout: 5_000 });
  await page.screenshot({ path: 'test-results/crm-08-drawer-open.png' });

  await page.locator('button:has-text("Cancel")').click();
  await expect(page.locator('text=New Contact')).not.toBeVisible({ timeout: 3_000 });
  await page.screenshot({ path: 'test-results/crm-09-drawer-closed.png' });
  await page.close();
  console.log('✅ New Card drawer opens and closes');
});
