import { test as base, Page } from '@playwright/test';
import {
  createUser,
  updateSubscription,
  cleanupUser,
  createTestUserPayload,
  TestUser,
} from '../utils/db';

// 로그인된 Page를 제공하는 fixture
export const test = base.extend<{ loggedInPage: Page }>({
  loggedInPage: async ({ page }, use) => {
    // 테스트 사용자 생성
    const testUserPayload = createTestUserPayload();
    const testUserData = await createUser(testUserPayload);

    if (!testUserData) {
      throw new Error('Failed to create test user');
    }

    // 테스트 사용자로 로그인하도록 세션 쿠키 설정
    // 실제 Clerk 인증 대신, 우리의 미들웨어가 user_id를 읽도록 설정
    await page.context().addCookies([
      {
        name: 'test_user_id',
        value: testUserData.id,
        domain: 'localhost',
        path: '/',
      },
    ]);

    // 테스트 실행
    await use(page);

    // 정리
    await cleanupUser(testUserData.id);
  },
});

export { expect } from '@playwright/test';
