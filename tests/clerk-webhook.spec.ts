import { test, expect } from '@playwright/test';
import {
  getUser,
  getSubscription,
  cleanupUser,
  createTestUserPayload,
} from './utils/db';
import crypto from 'crypto';

/**
 * Test Case 1: 신규 사용자 가입 및 온보딩 (Clerk 웹훅)
 *
 * 시나리오: Clerk의 user.created 웹훅 이벤트를 시뮬레이션하는 API 요청을 백엔드 엔드포인트로 전송한다.
 * 기대 결과: 요청 처리 후, 데이터베이스의 users 테이블에 해당 사용자 정보가,
 *          subscriptions 테이블에는 plan_type: 'Free', remaining_tries: 3인 레코드가 생성된다.
 */

test.describe('Clerk 웹훅 - 신규 사용자 가입 및 온보딩', () => {
  test('새로운 사용자 가입 시 users 및 subscriptions 테이블에 레코드 생성', async ({
    request,
  }) => {
    // AAA 패턴: Arrange
    const userId = `clerk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const email = `${userId}@example.com`;
    const firstName = '홍';
    const lastName = '길동';

    const clerkWebhookPayload = {
      type: 'user.created',
      data: {
        id: userId,
        email_addresses: [
          {
            email_address: email,
            verification: {
              status: 'verified',
            },
          },
        ],
        first_name: firstName,
        last_name: lastName,
        image_url: `https://picsum.photos/300/300?random=${userId}`,
        public_metadata: {},
        created_at: Date.now(),
      },
    };

    try {
      // Act: 웹훅 엔드포인트 호출
      const response = await request.post('/api/webhooks/clerk', {
        headers: {
          'content-type': 'application/json',
        },
        data: clerkWebhookPayload,
      });

      // Assert: 응답 상태 코드
      expect(response.status()).toBe(200);

      // 데이터베이스에서 사용자 조회
      const user = await getUser(userId);
      expect(user).not.toBeNull();
      expect(user?.id).toBe(userId);
      expect(user?.email).toBe(email);
      expect(user?.first_name).toBe(firstName);
      expect(user?.last_name).toBe(lastName);

      // 데이터베이스에서 구독 정보 조회
      const subscription = await getSubscription(userId);
      expect(subscription).not.toBeNull();
      expect(subscription?.user_id).toBe(userId);
      expect(subscription?.plan_type).toBe('Free');
      expect(subscription?.remaining_tries).toBe(3);
      expect(subscription?.billing_key).toBeNull();
      expect(subscription?.next_payment_date).toBeNull();
    } finally {
      // Cleanup
      await cleanupUser(userId);
    }
  });

  test('이미 존재하는 사용자의 웹훅 처리 시 정보 업데이트', async ({ request }) => {
    // AAA 패턴: Arrange
    const userId = `clerk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const email = `${userId}@example.com`;

    // 첫 번째 웹훅: 초기 가입
    const firstWebhookPayload = {
      type: 'user.created',
      data: {
        id: userId,
        email_addresses: [{ email_address: email }],
        first_name: '홍',
        last_name: '길동',
        image_url: 'https://picsum.photos/300/300?random=1',
        public_metadata: {},
        created_at: Date.now(),
      },
    };

    const clerkSecret = process.env.CLERK_WEBHOOK_SECRET || 'test-secret';
    const timestamp = Math.floor(Date.now() / 1000);

    try {
      // Act 1: 첫 번째 웹훅 (사용자 생성)
      const firstPayload = JSON.stringify(firstWebhookPayload);
      const firstSignature = crypto
        .createHmac('sha256', clerkSecret)
        .update(`${timestamp}.${firstPayload}`)
        .digest('base64');

      const firstResponse = await request.post('/api/webhooks/clerk', {
        headers: {
          'svix-id': `msg_${Date.now()}_1`,
          'svix-timestamp': timestamp.toString(),
          'svix-signature': `v1,${firstSignature}`,
          'content-type': 'application/json',
        },
        data: firstWebhookPayload,
      });

      expect(firstResponse.status()).toBe(200);

      const userAfterFirst = await getUser(userId);
      expect(userAfterFirst?.first_name).toBe('홍');

      // Act 2: 두 번째 웹훅 (프로필 업데이트)
      const secondWebhookPayload = {
        type: 'user.updated',
        data: {
          id: userId,
          email_addresses: [{ email_address: email }],
          first_name: '김',
          last_name: '철수',
          image_url: 'https://picsum.photos/300/300?random=2',
          public_metadata: {},
          updated_at: Date.now(),
        },
      };

      const timestamp2 = Math.floor(Date.now() / 1000) + 1;
      const secondPayload = JSON.stringify(secondWebhookPayload);
      const secondSignature = crypto
        .createHmac('sha256', clerkSecret)
        .update(`${timestamp2}.${secondPayload}`)
        .digest('base64');

      const secondResponse = await request.post('/api/webhooks/clerk', {
        headers: {
          'svix-id': `msg_${Date.now()}_2`,
          'svix-timestamp': timestamp2.toString(),
          'svix-signature': `v1,${secondSignature}`,
          'content-type': 'application/json',
        },
        data: secondWebhookPayload,
      });

      expect(secondResponse.status()).toBe(200);

      // Assert: 사용자 정보가 업데이트됨
      const userAfterSecond = await getUser(userId);
      expect(userAfterSecond?.first_name).toBe('김');
      expect(userAfterSecond?.last_name).toBe('철수');

      // Assert: 구독 정보는 변경되지 않음 (이미 존재함)
      const subscription = await getSubscription(userId);
      expect(subscription?.plan_type).toBe('Free');
      expect(subscription?.remaining_tries).toBe(3);
    } finally {
      // Cleanup
      await cleanupUser(userId);
    }
  });
});
