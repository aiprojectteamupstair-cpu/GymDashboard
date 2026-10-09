import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { createEmptyData } from '../src/prototype/dataLifecycle.js';
import { PAGE_PATHS } from '../src/routes.js';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const origin = new URL(process.env.UI_URL || 'http://127.0.0.1:3000/').origin;
const data = createEmptyData();
const staff = { id: 'route-owner', email: 'synthetic@example.test', role_code: 'super_admin', enabled: true, display_name: 'Admin' };
data.members = [{ id: 'route-member', member_code: 'E001', category_id: 'staff', full_name: 'Calendar Boundary Test', previous_codes: [] }];
data.attendance = ['2026-08-25', '2026-08-31', '2026-09-01', '2026-09-25', '2026-09-30'].map(date => ({
  id: `visit-${date}`, member_id: 'route-member', attendance_date: date,
  time_source: 'import_date_only', member_category_snapshot: 'Staff/Employee',
}));
let signedIn = false, accountReads = 0;
const errors = [];
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
page.on('pageerror', error => errors.push(error.message));
await mkdir('.local-db/ui-checks', { recursive: true });
await page.route('**/api/local/**', async route => {
  const path = new URL(route.request().url()).pathname.split('/').at(-1);
  let body;
  if (path === 'session') body = { user: signedIn ? staff : null };
  else if (path === 'login') { signedIn = true; body = { user: staff }; }
  else if (path === 'logout') { signedIn = false; body = {}; }
  else if (path === 'workspace') { assert.ok(signedIn); body = { data, staff }; }
  else if (path === 'admin-accounts') { assert.equal(staff.role_code, 'super_admin'); accountReads++; body = { accounts: [staff] }; }
  else throw new Error(`Unexpected fixture request: ${path}`);
  await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
});
const at = path => assert.equal(new URL(page.url()).pathname, path);
const heading = name => page.getByRole('heading', { name, exact: true }).waitFor();
async function login() {
  await heading('Sign in');
  await page.getByLabel('Email', { exact: true }).fill(staff.email);
  await page.getByLabel('Password', { exact: true }).fill('Synthetic-test-only');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
}
try {
  await page.goto(`${origin}/check-in`);
  await login();
  await heading('Check-in'); at('/check-in');
  const tabs = [['Dashboard', 'dashboard'], ['Members', 'members'], ['Check-in', 'checkin'], ['Analytics', 'analytics'], ['Packages & Discounts', 'catalogue'], ['Staff accounts', 'accounts']];
  for (const [label, key] of tabs) {
    const link = page.getByRole('link', { name: label, exact: true });
    assert.equal(await link.getAttribute('href'), PAGE_PATHS[key]);
    await link.click();
    await heading(label); at(PAGE_PATHS[key]);
    await page.reload();
    await heading(label); at(PAGE_PATHS[key]);
    assert.equal(await page.getByRole('link', { name: label, exact: true }).getAttribute('aria-current'), 'page');
  }
  await page.getByRole('link', { name: 'Members', exact: true }).click();
  await page.getByRole('button', { name: 'Open profile for Calendar Boundary Test' }).click();
  await heading('Calendar Boundary Test'); at('/members/route-member');
  await page.reload();
  await heading('Calendar Boundary Test'); at('/members/route-member');
  await page.getByRole('link', { name: 'Analytics', exact: true }).click();
  await heading('Analytics');
  await page.goBack();
  await heading('Calendar Boundary Test'); at('/members/route-member');
  await page.goForward();
  await heading('Analytics'); at('/analytics');
  await page.goBack();
  await heading('Calendar Boundary Test');
  const month = page.getByLabel('Profile attendance month', { exact: true });
  assert.equal(await month.inputValue(), '2026-09');
  assert.equal(await page.locator('.calendar-day').count(), 30);
  await page.getByText('3 visits', { exact: false }).waitFor();
  assert.equal(await page.locator('.calendar-day').first().getAttribute('aria-label'), '2026-09-01: Checked in');
  assert.equal(await page.locator('.calendar-day').last().getAttribute('aria-label'), '2026-09-30: Checked in');
  assert.equal(await page.getByText(/shared 25th|Staff attendance cycle/).count(), 0);
  await page.screenshot({ path: '.local-db/ui-checks/staff-month-desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'Previous attendance period' }).click();
  assert.equal(await month.inputValue(), '2026-08');
  assert.equal(await page.locator('.calendar-day').count(), 31);
  await page.getByText('2 visits', { exact: false }).waitFor();
  await page.getByRole('button', { name: 'Edit attendance', exact: true }).click();
  const dialog = page.getByRole('dialog');
  assert.equal(await dialog.getByLabel('Attendance month', { exact: true }).inputValue(), '2026-08');
  assert.equal(await dialog.locator('.calendar-day').count(), 31);
  assert.equal(await dialog.locator('.calendar-day').first().getAttribute('aria-label'), '2026-08-01: No recorded visit');
  assert.equal(await dialog.locator('.calendar-day').last().getAttribute('aria-label'), '2026-08-31: Present');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Back to members' }).click();
  await heading('Members'); at('/members');
  await page.goto(`${origin}/members/missing`); await heading('Member not found');
  await page.goto(`${origin}/not-a-page`); await heading('Page not found');
  await page.getByRole('button', { name: 'Back to dashboard' }).click();
  await heading('Dashboard'); at('/');
  await page.goto(`${origin}/members/?source=test#main-content`);
  await heading('Members'); at('/members');
  assert.equal(new URL(page.url()).search, '?source=test');
  const readsBeforeDenial = accountReads;
  staff.role_code = 'admin';
  await page.goto(`${origin}/staff-accounts`); await heading('Access denied');
  assert.equal(accountReads, readsBeforeDenial);
  assert.equal(await page.getByRole('link', { name: 'Staff accounts', exact: true }).count(), 0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${origin}/members/route-member`); await heading('Calendar Boundary Test');
  await page.screenshot({ path: '.local-db/ui-checks/staff-month-mobile.png', fullPage: true });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.getByRole('button', { name: 'Edit attendance', exact: true }).click();
  assert.equal(await dialog.locator('.calendar-day').count(), 30);
  await page.screenshot({ path: '.local-db/ui-checks/staff-month-editor-mobile.png' });
  assert.ok(await dialog.evaluate(node => node.scrollWidth <= node.clientWidth));
  // History navigation closes dialogs and does not mutate fixture attendance.
  await page.goBack(); await heading('Access denied');
  assert.equal(await page.getByRole('dialog').count(), 0);
  await page.goForward(); await heading('Calendar Boundary Test');
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await heading('Sign in'); at('/');
  await page.goBack(); await heading('Sign in');
  assert.equal(await page.getByRole('navigation').count(), 0);
  await page.goto(`${origin}/members/route-member`);
  await login(); await heading('Calendar Boundary Test'); at('/members/route-member');
  assert.equal(data.attendance.length, 5);
  assert.deepEqual(errors, []);
  console.log('All tab/profile deep links, reload, history, sign-in/out, route denial/not-found, and Staff normal-month desktop/mobile checks passed (synthetic API; no real data changed).');
} finally { await browser.close(); }
