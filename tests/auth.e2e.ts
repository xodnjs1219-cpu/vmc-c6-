import { test, expect } from '@playwright/test';
import { createUser, cleanupUser } from './utils/db';

const testUser = { id: 'e2e-user', email: 'e2e@example.com' };

test.beforeEach(async () => {
  await createUser(testUser);
});

test.afterEach(async () => {
  await cleanupUser(testUser.id);
});

test('로그인 버튼 클릭 시 /login 이동 및 헤더 확인', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('login-button').click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: '로그인' })).toBeVisible();
});
