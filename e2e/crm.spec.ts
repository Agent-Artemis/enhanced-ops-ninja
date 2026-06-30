/**
 * CRM e2e — crm.enhancedops.ninja
 *
 * Auth strategy: admin generate_link with redirect_to forced to CRM URL
 * so the session is established at crm.enhancedops.ninja's localStorage.
 *
 * Run with: npx playwright test e2e/crm.spec.ts --workers=1
 */

import { test, expect, type BrowserContext } from '@playwright/test';

// serial ensures beforeAll/afterAll run once for the group, not per test
test.describe.serial('CRM e2e', () => {

const BASE       = 'https://crm.enhancedops.ninja';
const SB_URL     = 'https://tbjynbevrhkfzpswehsj.supabase.co';
const SB_SERVICE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRianluYmV2cmhrZnpwc3dlaHNqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODI2ODU1OSwiZXhwIjoyMDkzODQ0NTU5fQ._nb8Nr46UJ5WnG55_jjq3bI5IwAbq6S0WO1AhJAexwo';

const TEST_EMAIL = `e2e-crm-${Date.now()}@enhancedops.ninja`;
let testUserId   = '';
let authedCtx: BrowserContext | null = null;

async function adminFetch(path: string, body?: object) {
  return fetch(`${SB_URL}/auth/v1/admin${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

test.beforeAll(async ({ browser }) => {
  // 1. Create test user
  const r = await adminFetch('/users', { email: TEST_EMAIL, email_confirm: true });
  const user = await r.json();
  if (!user.id) throw new Error(`Could not create test user: ${JSON.stringify(user)}`);
  testUserId = user.id;
  console.log(`Test user: ${TEST_EMAIL} (${testUserId})`);

  // 2. Get magic link from admin
  const lr = await adminFetch('/generate_link', {
    type: 'magiclink',
    email: TEST_EMAIL,
    options: { redirect_to: BASE },
  });
  const linkData = await lr.json();
  let actionLink = linkData.action_link as string;
  if (!actionLink) throw new Error(`No action_link: ${JSON.stringify(linkData)}`);

  // 3. Force redirect_to to point at CRM (admin API may override with site_url)
  // Replace whatever redirect_to is there with the CRM URL
  actionLink = actionLink.replace(
    /redirect_to=[^&]+/,
    `redirect_to=${encodeURIComponent(BASE)}`
  );
  console.log('Action link (patched):', actionLink.slice(0, 80));

  // 4. Navigate in a fresh browser context directly to the verify URL
  authedCtx = await browser.newContext();
  const page = await authedCtx.newPage();

  // Intercept console errors for debugging
  page.on('console', msg => {
    if (msg.type() === 'error') console.log('BROWSER ERR:', msg.text().slice(0, 120));
  });

  // Follow the magic link — Supabase verifies, then redirects to CRM
  await page.goto(actionLink, { waitUntil: 'commit', timeout: 30_000 });

  // Should land somewhere on crm.enhancedops.ninja (with ?code= or #access_token)
  try {
    await page.waitForURL(/crm\.enhancedops\.ninja/, { timeout: 20_000 });
    console.log('Landed on CRM after magic link');
  } catch {
    console.log('Did not land on CRM — current URL:', page.url());
    // Navigate directly
    await page.goto(BASE, { timeout: 20_000 });
  }

  // Wait for either CRM shell or login form
  await page.waitForSelector('text=EON CRM', { timeout: 20_000 });
  const onCRM = await page.locator('text=One Card').isVisible({ timeout: 3_000 }).catch(() => false);
  console.log('CRM shell visible:', onCRM, '| URL:', page.url().slice(0, 60));
  await page.screenshot({ path: 'test-results/crm-00-auth-setup.png' });
  await page.close();
});

test.afterAll(async () => {
  if (authedCtx) await authedCtx.close().catch(() => {});
  if (testUserId) {
    await fetch(`${SB_URL}/auth/v1/admin/users/${testUserId}`, {
      method: 'DELETE',
      headers: { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}` },
    });
    console.log('Test user deleted');
  }
});

// Helper: type into a React input reliably (pressSequentially triggers onChange)
async function fillReact(page: ReturnType<BrowserContext['newPage']> extends Promise<infer T> ? T : never, selector: string, value: string) {
  const el = page.locator(selector);
  await el.click();
  await el.pressSequentially(value, { delay: 30 });
}

// ── 1: Login form renders ─────────────────────────────────────────────────────
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

  await fillReact(page, 'input[type="email"]', 'hacker@gmail.com');
  await page.locator('button:has-text("Send Magic Link")').click();
  await expect(page.locator('text=Access restricted')).toBeVisible({ timeout: 8_000 });
  await page.screenshot({ path: 'test-results/crm-02-rejected.png' });
  console.log('✅ Non-allowed domain rejected');
});

// ── 3: Magic link button sends ────────────────────────────────────────────────
test('magic link button shows sent confirmation', async ({ page }) => {
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30_000 });
  await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 10_000 });

  await fillReact(page, 'input[type="email"]', TEST_EMAIL);
  await page.locator('button:has-text("Send Magic Link")').click();
  await expect(page.locator('text=Check your email')).toBeVisible({ timeout: 15_000 });
  await page.screenshot({ path: 'test-results/crm-03-magic-sent.png' });
  console.log('✅ Magic link confirmation shown');
});

// ── 4: Authenticated — CRM shell ─────────────────────────────────────────────
test('authenticated session shows CRM shell', async () => {
  test.skip(!authedCtx, 'Auth context not available');
  const page = await authedCtx!.newPage();
  try {
    await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30_000 });
    await expect(page.locator('text=One Card')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('text=Kanban')).toBeVisible();
    await expect(page.locator('text=List')).toBeVisible();
    await expect(page.locator('text=Sign in to continue')).not.toBeVisible();
    await page.screenshot({ path: 'test-results/crm-04-authed.png' });
    console.log('✅ CRM shell visible');
  } finally { await page.close(); }
});

// ── 5: One Card view ──────────────────────────────────────────────────────────
test('One Card view shows tickler sidebar', async () => {
  test.skip(!authedCtx, 'Auth context not available');
  const page = await authedCtx!.newPage();
  try {
    await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30_000 });
    await expect(page.locator('text=One Card')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('text=TODAY')).toBeVisible({ timeout: 8_000 });
    await expect(page.locator('text=A – Z')).toBeVisible();
    await page.screenshot({ path: 'test-results/crm-05-onecard.png' });
    console.log('✅ One Card: TODAY + A–Z visible');
  } finally { await page.close(); }
});

// ── 6: Kanban view ────────────────────────────────────────────────────────────
test('Kanban view shows stage columns', async () => {
  test.skip(!authedCtx, 'Auth context not available');
  const page = await authedCtx!.newPage();
  try {
    await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30_000 });
    await expect(page.locator('button:has-text("Kanban")')).toBeVisible({ timeout: 20_000 });
    await page.locator('button:has-text("Kanban")').click();
    await expect(page.locator('text=Lead')).toBeVisible({ timeout: 8_000 });
    await expect(page.locator('text=Closed Won')).toBeVisible();
    await page.screenshot({ path: 'test-results/crm-06-kanban.png' });
    console.log('✅ Kanban: stage columns visible');
  } finally { await page.close(); }
});

// ── 7: List view ──────────────────────────────────────────────────────────────
test('List view shows table', async () => {
  test.skip(!authedCtx, 'Auth context not available');
  const page = await authedCtx!.newPage();
  try {
    await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30_000 });
    await expect(page.locator('button:has-text("List")')).toBeVisible({ timeout: 20_000 });
    await page.locator('button:has-text("List")').click();
    await expect(page.locator('text=Name')).toBeVisible({ timeout: 8_000 });
    await expect(page.locator('text=Stage')).toBeVisible();
    await page.screenshot({ path: 'test-results/crm-07-list.png' });
    console.log('✅ List view: table visible');
  } finally { await page.close(); }
});

// ── 8: New Card drawer ────────────────────────────────────────────────────────
test('New Card drawer opens and closes', async () => {
  test.skip(!authedCtx, 'Auth context not available');
  const page = await authedCtx!.newPage();
  try {
    await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30_000 });
    await expect(page.locator('button:has-text("+ New Card")')).toBeVisible({ timeout: 20_000 });
    await page.locator('button:has-text("+ New Card")').click();
    await expect(page.locator('text=New Contact')).toBeVisible({ timeout: 5_000 });
    await page.screenshot({ path: 'test-results/crm-08-drawer-open.png' });
    await page.locator('button:has-text("Cancel")').click();
    await expect(page.locator('text=New Contact')).not.toBeVisible({ timeout: 3_000 });
    await page.screenshot({ path: 'test-results/crm-09-drawer-closed.png' });
    console.log('✅ New Card drawer opens and closes');
  } finally { await page.close(); }
});
})
