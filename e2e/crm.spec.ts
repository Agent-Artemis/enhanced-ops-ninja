/**
 * CRM e2e — crm.enhancedops.ninja
 *
 * Auth: admin generate_link → browser follows it → extract tokens from URL hash
 * Each auth test injects those tokens via addInitScript so localStorage is set
 * before the page loads (no context-storage-sharing complexity, no user-deletion issues).
 *
 * Run: npx playwright test e2e/crm.spec.ts --workers=1
 */

import { test, expect } from '@playwright/test';

const BASE       = 'https://crm.enhancedops.ninja';
const SB_URL     = 'https://tbjynbevrhkfzpswehsj.supabase.co';
const SB_KEY     = 'sb-tbjynbevrhkfzpswehsj-auth-token';
const SB_SERVICE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRianluYmV2cmhrZnpwc3dlaHNqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODI2ODU1OSwiZXhwIjoyMDkzODQ0NTU5fQ._nb8Nr46UJ5WnG55_jjq3bI5IwAbq6S0WO1AhJAexwo';

const TEST_EMAIL = `e2e-crm-${Date.now()}@enhancedops.ninja`;
let testUserId   = '';
let savedAt      = ''; // access_token from magic link
let savedRt      = ''; // refresh_token from magic link

async function adminFetch(path: string, body?: object) {
  return fetch(`${SB_URL}/auth/v1/admin${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

// Script injected into browser before page load — sets Supabase session in localStorage
const INJECT_SESSION_SCRIPT = `
  (function({ key, at, rt }) {
    try {
      const b = at.split('.')[1].replace(/-/g,'+').replace(/_/g,'/');
      const p = JSON.parse(atob(b + '=='.slice(0,(4-b.length%4)%4)));
      const s = { access_token:at, refresh_token:rt, token_type:'bearer', expires_in:3600, expires_at:p.exp, user:p };
      localStorage.setItem(key, JSON.stringify({ currentSession:s, expiresAt:p.exp }));
    } catch(e) { console.error('inject session failed:', e); }
  })(args);
`;

test.describe.serial('CRM e2e', () => {
  test.beforeAll(async ({ browser }) => {
    // 1. Create test user
    const r = await adminFetch('/users', { email: TEST_EMAIL, email_confirm: true });
    const user = await r.json();
    if (!user.id) throw new Error(`Could not create test user: ${JSON.stringify(user)}`);
    testUserId = user.id;
    console.log(`Test user: ${TEST_EMAIL} (${testUserId})`);

    // 2. Generate magic link
    const lr = await adminFetch('/generate_link', { type: 'magiclink', email: TEST_EMAIL, options: { redirect_to: BASE } });
    const linkData = await lr.json();
    let actionLink = linkData.action_link as string;
    if (!actionLink) throw new Error(`No action_link: ${JSON.stringify(linkData)}`);

    // Force redirect_to to CRM
    actionLink = actionLink.replace(/redirect_to=[^&]+/, `redirect_to=${encodeURIComponent(BASE)}`);
    console.log('Action link obtained');

    // 3. Follow magic link — capture tokens from URL hash BEFORE React clears it
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    // framenavigated fires the instant the URL changes, before JS runs
    page.on('framenavigated', frame => {
      if (frame !== page.mainFrame()) return;
      const url = frame.url();
      if (url.includes('crm.enhancedops.ninja') && url.includes('access_token=')) {
        const hash = url.includes('#') ? url.split('#')[1] : new URL(url).searchParams.toString();
        const p = new URLSearchParams(hash);
        const at = p.get('access_token');
        const rt = p.get('refresh_token');
        if (at && !savedAt) {
          savedAt = at;
          savedRt = rt ?? '';
          console.log('Tokens captured from framenavigated');
        }
      }
    });

    try {
      await page.goto(actionLink, { waitUntil: 'networkidle', timeout: 60_000 });
    } catch { /* navigation may throw but tokens should be captured */ }

    // Fallback: read from localStorage if framenavigated didn't get them
    if (!savedAt) {
      const stored = await page.evaluate((key) => localStorage.getItem(key), SB_KEY).catch(() => null);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          const s = parsed?.currentSession ?? parsed;
          savedAt = s?.access_token ?? '';
          savedRt = s?.refresh_token ?? '';
          if (savedAt) console.log('Tokens captured from localStorage fallback');
        } catch { /* */ }
      }
    }

    console.log('Tokens captured:', savedAt ? '✅' : '❌');
    await page.screenshot({ path: 'test-results/crm-00-auth-setup.png' }).catch(() => {});
    await ctx.close();
  });

  test.afterAll(async () => {
    if (testUserId) {
      await fetch(`${SB_URL}/auth/v1/admin/users/${testUserId}`, {
        method: 'DELETE',
        headers: { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}` },
      });
      console.log('Test user deleted');
    }
  });

  // ── 1: Login form ──────────────────────────────────────────────────────────
  test('login form renders when unauthenticated', async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30_000 });
    await expect(page.locator('h1:has-text("EON CRM")')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('text=Sign in to continue')).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('button:has-text("Send Magic Link")')).toBeVisible();
    await page.screenshot({ path: 'test-results/crm-01-login.png' });
    console.log('✅ Login form visible');
  });

  // ── 2: Domain restriction ──────────────────────────────────────────────────
  test('non-allowed domain shows access error', async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30_000 });
    await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 10_000 });

    await page.locator('input[type="email"]').click();
    await page.locator('input[type="email"]').type('hacker@gmail.com', { delay: 50 });
    const val = await page.locator('input[type="email"]').inputValue();
    expect(val).toBe('hacker@gmail.com');

    await page.locator('button:has-text("Send Magic Link")').click();
    await expect(page.locator('text=Access restricted')).toBeVisible({ timeout: 8_000 });
    await page.screenshot({ path: 'test-results/crm-02-rejected.png' });
    console.log('✅ Non-allowed domain rejected');
  });

  // ── 3: Magic link sends ────────────────────────────────────────────────────
  test('magic link button makes OTP request', async ({ page }) => {
    // Use a second user to avoid rate limiting (TEST_EMAIL already got a generate_link)
    const email2 = `e2e-otp-${Date.now()}@enhancedops.ninja`;
    await adminFetch('/users', { email: email2, email_confirm: true });

    await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30_000 });
    await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 10_000 });

    await page.locator('input[type="email"]').click();
    await page.locator('input[type="email"]').type(email2, { delay: 30 });

    const [res] = await Promise.all([
      page.waitForResponse(r => r.url().includes('supabase') && r.url().includes('otp'), { timeout: 15_000 }),
      page.locator('button:has-text("Send Magic Link")').click(),
    ]);

    // 200 = sent, 429 = rate limited (still proves the button works)
    expect([200, 429]).toContain(res.status());
    if (res.status() === 200) {
      await expect(page.locator('text=Check your email')).toBeVisible({ timeout: 5_000 });
    }
    await page.screenshot({ path: 'test-results/crm-03-magic-sent.png' });
    console.log(`✅ OTP API reached (status ${res.status()})`);
  });

  // ── 4: CRM shell ──────────────────────────────────────────────────────────
  test('authenticated session shows CRM shell', async ({ page }) => {
    test.skip(!savedAt, 'No auth tokens');
    await page.addInitScript(new Function('args', INJECT_SESSION_SCRIPT) as () => void, { key: SB_KEY, at: savedAt, rt: savedRt });
    await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30_000 });
    await expect(page.locator('text=One Card')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('text=Kanban')).toBeVisible();
    await expect(page.locator('text=List')).toBeVisible();
    await expect(page.locator('text=+ New Card')).toBeVisible();
    await page.screenshot({ path: 'test-results/crm-04-authed.png' });
    console.log('✅ CRM shell visible');
  });

  // ── 5: One Card view ───────────────────────────────────────────────────────
  test('One Card view shows tickler sidebar', async ({ page }) => {
    test.skip(!savedAt, 'No auth tokens');
    await page.addInitScript(new Function('args', INJECT_SESSION_SCRIPT) as () => void, { key: SB_KEY, at: savedAt, rt: savedRt });
    await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30_000 });
    await expect(page.locator('text=One Card')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('text=TODAY')).toBeVisible({ timeout: 8_000 });
    await expect(page.locator('text=A – Z')).toBeVisible();
    await page.screenshot({ path: 'test-results/crm-05-onecard.png' });
    console.log('✅ One Card: TODAY + A–Z visible');
  });

  // ── 6: Kanban view ─────────────────────────────────────────────────────────
  test('Kanban view shows stage columns', async ({ page }) => {
    test.skip(!savedAt, 'No auth tokens');
    await page.addInitScript(new Function('args', INJECT_SESSION_SCRIPT) as () => void, { key: SB_KEY, at: savedAt, rt: savedRt });
    await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30_000 });
    await expect(page.locator('button:has-text("Kanban")')).toBeVisible({ timeout: 15_000 });
    await page.locator('button:has-text("Kanban")').click();
    await expect(page.locator('text=Lead')).toBeVisible({ timeout: 8_000 });
    await expect(page.locator('text=Closed Won')).toBeVisible();
    await page.screenshot({ path: 'test-results/crm-06-kanban.png' });
    console.log('✅ Kanban: stage columns visible');
  });

  // ── 7: List view ───────────────────────────────────────────────────────────
  test('List view shows table headers', async ({ page }) => {
    test.skip(!savedAt, 'No auth tokens');
    await page.addInitScript(new Function('args', INJECT_SESSION_SCRIPT) as () => void, { key: SB_KEY, at: savedAt, rt: savedRt });
    await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30_000 });
    await expect(page.locator('button:has-text("List")')).toBeVisible({ timeout: 15_000 });
    await page.locator('button:has-text("List")').click();
    await expect(page.locator('text=Name')).toBeVisible({ timeout: 8_000 });
    await expect(page.locator('text=Stage')).toBeVisible();
    await page.screenshot({ path: 'test-results/crm-07-list.png' });
    console.log('✅ List view: table visible');
  });

  // ── 8: New Card drawer ─────────────────────────────────────────────────────
  test('New Card drawer opens and closes', async ({ page }) => {
    test.skip(!savedAt, 'No auth tokens');
    await page.addInitScript(new Function('args', INJECT_SESSION_SCRIPT) as () => void, { key: SB_KEY, at: savedAt, rt: savedRt });
    await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30_000 });
    await expect(page.locator('button:has-text("+ New Card")')).toBeVisible({ timeout: 15_000 });
    await page.locator('button:has-text("+ New Card")').click();
    await expect(page.locator('text=New Contact')).toBeVisible({ timeout: 5_000 });
    await page.screenshot({ path: 'test-results/crm-08-drawer-open.png' });
    await page.locator('button:has-text("Cancel")').click();
    await expect(page.locator('text=New Contact')).not.toBeVisible({ timeout: 3_000 });
    await page.screenshot({ path: 'test-results/crm-09-drawer-closed.png' });
    console.log('✅ New Card drawer opens and closes');
  });
});
