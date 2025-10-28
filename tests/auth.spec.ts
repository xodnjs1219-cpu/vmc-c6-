import { test, expect } from '@playwright/test';

test('홈페이지에서 로그인 버튼 클릭 시 /login 이동 및 헤더 확인', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('login-button').click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: '로그인' })).toBeVisible();
});
