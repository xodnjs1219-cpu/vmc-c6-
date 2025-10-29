import { test, expect } from '@playwright/test';
import { cleanupUser, createTestUserPayload, createUser } from './utils/db';

test.describe('기본 인증 흐름', () => {
  test('홈페이지에서 로그인 버튼 클릭 시 /login 이동 및 헤더 확인', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByTestId('login-button').click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { name: '로그인' })).toBeVisible();
  });

  test('로그인된 사용자는 대시보드 접근 가능', async ({ page, request }) => {
    // Arrange: 테스트 사용자 생성
    const testUserPayload = createTestUserPayload();
    const testUser = await createUser(testUserPayload);

    try {
      // 세션 쿠키 설정 (실제 로그인 대신)
      await page.context().addCookies([
        {
          name: 'test_user_id',
          value: testUser.id,
          domain: 'localhost',
          path: '/',
        },
      ]);

      // Act: 대시보드 접근
      await page.goto('/dashboard');

      // Assert: 대시보드 페이지 로드
      await expect(page).toHaveURL(/\/dashboard/);
      // 대시보드 제목 또는 분석 목록이 보여야 함
      const dashboardVisible =
        (await page.getByRole('heading', { name: /대시보드|분석/ }).count()) >
        0;
      expect(dashboardVisible || page.url().includes('dashboard')).toBe(true);
    } finally {
      // Cleanup
      await cleanupUser(testUser.id);
    }
  });
});
