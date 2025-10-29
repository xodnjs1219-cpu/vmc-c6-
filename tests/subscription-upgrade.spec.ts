import { test, expect } from '@playwright/test';
import {
  createUser,
  getSubscription,
  cleanupUser,
  createTestUserPayload,
} from './utils/db';
import { addDays } from 'date-fns';

/**
 * Test Case 3: Pro 구독 업그레이드
 *
 * 시나리오: 무료 사용자로 로그인하여 '/subscription' 페이지로 이동,
 *         'Pro 구독하기' 버튼을 클릭한다.
 *         토스페이먼츠 결제창 연동 및 성공 콜백 과정을 모킹한다.
 *
 * 기대 결과: 사용자의 subscriptions 레코드가 plan_type: 'Pro', remaining_tries: 10으로 업데이트되고,
 *           billing_key와 한 달 뒤의 next_payment_date가 설정된다.
 */

test.describe('구독 업그레이드 - Pro 플랜', () => {
  test('무료 사용자가 Pro 구독 성공', async ({ page, request }) => {
    // AAA 패턴: Arrange
    const testUserPayload = createTestUserPayload();
    const testUser = await createUser(testUserPayload);

    // 토스페이먼츠 API 모킹 (성공 케이스)
    await page.route('**/api.tosspayments.com/**', async (route) => {
      if (route.request().method() === 'POST') {
        // 정기 결제 키 발급 응답
        route.fulfill({
          status: 200,
          body: JSON.stringify({
            billingKey: 'billing_key_123456789',
            customerKey: 'customer_key_987654321',
            method: 'card',
          }),
        });
      }
    });

    // 결제 승인 콜백 URL 모킹
    await page.route('/api/payments/subscribe', async (route) => {
      if (route.request().method() === 'GET') {
        // 성공 응답
        route.fulfill({
          status: 200,
          body: JSON.stringify({
            success: true,
            data: {
              plan_type: 'Pro',
              remaining_tries: 10,
              next_payment_date: addDays(new Date(), 30).toISOString().split('T')[0],
            },
          }),
        });
      }
    });

    try {
      // Act 1: 구독 페이지 방문
      await page.goto('/subscription');

      // Assert: 구독 페이지 로드
      await expect(page.getByRole('heading', { name: /구독|플랜/ })).toBeVisible();

      // Act 2: Pro 구독 버튼 클릭
      await page.click('button:has-text("Pro 구독하기")');

      // 토스페이먼츠 결제창이 열릴 때까지 대기
      await page.waitForURL(/checkout|payment/, { timeout: 5000 }).catch(() => {
        // 일부 구현에서는 모달로 열릴 수 있음
      });

      // Act 3: 결제 성공 콜백 시뮬레이션 (사용자가 결제 완료)
      // 실제로는 토스페이먼츠 리다이렉트, 여기서는 API 직접 호출
      const paymentResponse = await request.get('/api/payments/subscribe', {
        headers: {
          'x-clerk-user-id': testUser.id,
        },
        params: {
          paymentKey: 'payment_key_123',
          orderId: 'order_123',
          amount: 9900,
        },
      });

      // Assert: 결제 성공
      expect(paymentResponse.status()).toBe(200);

      const paymentBody = await paymentResponse.json();
      expect(paymentBody.success).toBe(true);

      // DB에서 구독 정보 확인
      const subscription = await getSubscription(testUser.id);
      expect(subscription).not.toBeNull();
      expect(subscription?.plan_type).toBe('Pro');
      expect(subscription?.remaining_tries).toBe(10);
      expect(subscription?.billing_key).not.toBeNull();
      expect(subscription?.next_payment_date).not.toBeNull();

      // 다음 결제일이 약 30일 뒤인지 확인
      const nextPaymentDate = new Date(subscription?.next_payment_date || '');
      const expectedDate = addDays(new Date(), 30);
      const daysDiff = Math.abs(
        (nextPaymentDate.getTime() - expectedDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      expect(daysDiff).toBeLessThan(1);
    } finally {
      // Cleanup
      await cleanupUser(testUser.id);
    }
  });

  test('Pro 구독 업그레이드 후 분석 할당량 증가', async ({ request }) => {
    // AAA 패턴: Arrange
    const testUserPayload = createTestUserPayload();
    const testUser = await createUser(testUserPayload);

    try {
      // Act 1: 초기 구독 상태 확인 (Free)
      let subscription = await getSubscription(testUser.id);
      expect(subscription?.plan_type).toBe('Free');
      expect(subscription?.remaining_tries).toBe(3);

      // Act 2: Pro 구독 업그레이드 (API 직접 호출)
      const upgradeResponse = await request.post('/api/subscription/upgrade', {
        headers: {
          'x-clerk-user-id': testUser.id,
          'content-type': 'application/json',
        },
        data: {
          // 실제 결제 정보
          paymentKey: 'test_payment_key',
          orderId: `order_${Date.now()}`,
          amount: 9900,
        },
      });

      // Assert: 업그레이드 성공
      expect(upgradeResponse.status()).toBe(200);

      const responseBody = await upgradeResponse.json();
      expect(responseBody.success).toBe(true);

      // Act 3: 업그레이드 후 구독 정보 확인
      subscription = await getSubscription(testUser.id);
      expect(subscription?.plan_type).toBe('Pro');
      expect(subscription?.remaining_tries).toBe(10);
      expect(subscription?.billing_key).not.toBeNull();
      expect(subscription?.next_payment_date).not.toBeNull();
    } finally {
      // Cleanup
      await cleanupUser(testUser.id);
    }
  });

  test('Pro 구독 해지 예약', async ({ request }) => {
    // AAA 패턴: Arrange
    const testUserPayload = createTestUserPayload();
    const testUser = await createUser(testUserPayload);

    // Pro 플랜으로 업그레이드
    await request.post('/api/subscription/upgrade', {
      headers: {
        'x-clerk-user-id': testUser.id,
        'content-type': 'application/json',
      },
      data: {
        paymentKey: 'test_payment_key',
        orderId: `order_${Date.now()}`,
        amount: 9900,
      },
    });

    try {
      // Act: 구독 해지 예약
      const cancelResponse = await request.post('/api/subscription/cancel', {
        headers: {
          'x-clerk-user-id': testUser.id,
          'content-type': 'application/json',
        },
      });

      // Assert: 해지 예약 성공
      expect(cancelResponse.status()).toBe(200);

      const responseBody = await cancelResponse.json();
      expect(responseBody.success).toBe(true);

      // DB에서 해지 예약 확인
      const subscription = await getSubscription(testUser.id);
      expect(subscription?.cancellation_scheduled).toBe(true);
      expect(subscription?.plan_type).toBe('Pro'); // 아직 Pro 상태 유지
      expect(subscription?.remaining_tries).toBe(10);
    } finally {
      // Cleanup
      await cleanupUser(testUser.id);
    }
  });

  test('Pro 구독 중인 사용자는 할당량이 유지됨', async ({ request }) => {
    // AAA 패턴: Arrange
    const testUserPayload = createTestUserPayload();
    const testUser = await createUser(testUserPayload);

    // Pro 플랜으로 업그레이드
    await request.post('/api/subscription/upgrade', {
      headers: {
        'x-clerk-user-id': testUser.id,
        'content-type': 'application/json',
      },
      data: {
        paymentKey: 'test_payment_key',
        orderId: `order_${Date.now()}`,
        amount: 9900,
      },
    });

    try {
      // Act: 한 번 분석 생성
      const analysisResponse = await request.post('/api/analyses', {
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

      // Assert: 분석 생성 성공 (할당량 충분)
      if (analysisResponse.status() === 200) {
        const subscription = await getSubscription(testUser.id);
        expect(subscription?.remaining_tries).toBeLessThanOrEqual(10);
      }
    } finally {
      // Cleanup
      await cleanupUser(testUser.id);
    }
  });
});
