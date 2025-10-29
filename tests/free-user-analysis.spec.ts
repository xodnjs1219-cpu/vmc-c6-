import { test, expect } from '@playwright/test';
import {
  createUser,
  updateSubscription,
  getSubscription,
  cleanupUser,
  createTestUserPayload,
} from './utils/db';

/**
 * Test Case 2: 무료 사용자의 마지막 분석 시도 및 구독 유도
 *
 * 시나리오: 남은 횟수가 1회인 무료 사용자로 로그인한다.
 *         '/new-analysis' 페이지에서 사주 분석을 1회 성공적으로 수행한다.
 *         이후 다시 분석을 시도한다.
 *
 * 기대 결과: 첫 분석은 성공하고 DB의 remaining_tries는 0으로 감소한다.
 *           두 번째 분석 시도 시, API는 'QUOTA_EXCEEDED' 에러를 반환하며
 *           사용자는 '/subscription' 페이지로 리디렉션된다.
 */

test.describe('무료 사용자 - 마지막 분석 시도 및 구독 유도', () => {
  test('남은 횟수가 1회인 무료 사용자의 분석 성공 및 할당량 차감', async ({
    page,
    request,
  }) => {
    // AAA 패턴: Arrange
    const testUserPayload = createTestUserPayload();
    const testUser = await createUser(testUserPayload);

    // 남은 횟수를 1회로 설정
    await updateSubscription(testUser.id, { remaining_tries: 1 });

    // Gemini API 모킹
    await page.route('**/generativelanguage.googleapis.com/**', (route) => {
      route.abort();
    });

    // 백엔드 분석 생성 엔드포인트 모킹 (성공 케이스)
    await page.route('/api/analyses', async (route) => {
      if (route.request().method() === 'POST') {
        // 성공 응답
        route.fulfill({
          status: 200,
          body: JSON.stringify({
            success: true,
            data: {
              id: 'analysis_123',
              user_id: testUser.id,
              name: '테스트 분석',
              birth_date: '1990-01-01',
              summary: '테스트 요약',
              detail: '테스트 상세 내용',
              created_at: new Date().toISOString(),
            },
          }),
        });
      }
    });

    try {
      // Act 1: 로그인된 상태로 분석 생성 페이지 방문
      await page.goto('/new-analysis');

      // 분석 폼 채우기
      await page.fill('input[name="name"]', '테스트 분석');
      await page.fill('input[name="birth_date"]', '1990-01-01');

      // 분석 생성 버튼 클릭
      await page.click('button:has-text("분석 생성")');

      // 분석 완료 대기
      await page.waitForURL(/\/analysis\//, { timeout: 10000 });

      // Assert: 첫 번째 분석 성공
      expect(page.url()).toMatch(/\/analysis\//);

      // DB에서 remaining_tries 확인 (0으로 감소)
      const subscription = await getSubscription(testUser.id);
      expect(subscription?.remaining_tries).toBe(0);
    } finally {
      // Cleanup
      await cleanupUser(testUser.id);
    }
  });

  test('할당량을 모두 소진한 사용자의 분석 차단 및 구독 페이지 유도', async ({
    page,
    request,
  }) => {
    // AAA 패턴: Arrange
    const testUserPayload = createTestUserPayload();
    const testUser = await createUser(testUserPayload);

    // 남은 횟수를 0으로 설정 (할당량 소진)
    await updateSubscription(testUser.id, { remaining_tries: 0 });

    // 백엔드 분석 생성 엔드포인트 모킹 (할당량 초과 에러)
    await page.route('/api/analyses', async (route) => {
      if (route.request().method() === 'POST') {
        route.fulfill({
          status: 402,
          body: JSON.stringify({
            success: false,
            error: {
              code: 'QUOTA_EXCEEDED',
              message: '분석 할당량을 모두 사용했습니다. Pro 플랜으로 업그레이드하세요.',
            },
          }),
        });
      }
    });

    try {
      // Act: 로그인된 상태로 분석 생성 페이지 방문
      await page.goto('/new-analysis');

      // 분석 폼 채우기
      await page.fill('input[name="name"]', '테스트 분석');
      await page.fill('input[name="birth_date"]', '1990-01-01');

      // 분석 생성 버튼 클릭
      await page.click('button:has-text("분석 생성")');

      // Assert: 구독 페이지로 리디렉션 또는 에러 메시지 표시
      // 옵션 1: 페이지 리디렉션
      await page.waitForURL(/\/subscription/, { timeout: 5000 }).catch(() => {
        // 옵션 2: 에러 토스트 메시지 표시
      });

      // 구독 페이지에 도달했거나 에러 메시지가 표시됨
      const subscriptionPageVisible =
        page.url().includes('/subscription') ||
        (await page
          .getByText(/Pro 플랜|구독하기|업그레이드/i)
          .isVisible()
          .catch(() => false));

      expect(subscriptionPageVisible).toBe(true);
    } finally {
      // Cleanup
      await cleanupUser(testUser.id);
    }
  });

  test('분석 API 직접 호출 - 할당량 초과 시 에러 반환', async ({ request }) => {
    // AAA 패턴: Arrange
    const testUserPayload = createTestUserPayload();
    const testUser = await createUser(testUserPayload);

    // 남은 횟수를 0으로 설정
    await updateSubscription(testUser.id, { remaining_tries: 0 });

    try {
      // Act: 분석 생성 API 직접 호출
      const response = await request.post('/api/analyses', {
        headers: {
          'x-clerk-user-id': testUser.id,
          'content-type': 'application/json',
        },
        data: {
          name: '테스트 분석',
          birth_date: '1990-01-01',
          birth_time: null,
          is_lunar: false,
          model_type: 'flash',
        },
      });

      // Assert: 할당량 초과 에러 반환
      expect(response.status()).toBe(402);

      const responseBody = await response.json();
      expect(responseBody.success).toBe(false);
      expect(responseBody.error?.code).toBe('QUOTA_EXCEEDED');
    } finally {
      // Cleanup
      await cleanupUser(testUser.id);
    }
  });
});
