import { Hono } from 'hono';
import type { AppEnv } from '@/backend/hono/context';
import { respond, failure, success } from '@/backend/http/response';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { SubscribeRequestSchema } from './schema';
import { initiateSubscription, scheduleSubscriptionCancellation } from './service';

export function registerSubscriptionRoutes(app: Hono<AppEnv>) {
  // POST /api/subscription/upgrade - Pro 구독 시작
  app.post('/api/subscription/upgrade', async (c) => {
    try {
      const userId = c.req.header('x-clerk-user-id');
      if (!userId) {
        return respond(
          c,
          failure(401 as ContentfulStatusCode, 'UNAUTHORIZED', '인증이 필요합니다.')
        );
      }

      // 요청 본문 파싱
      let requestBody;
      try {
        requestBody = await c.req.json();
      } catch {
        return respond(
          c,
          failure(400 as ContentfulStatusCode, 'INVALID_JSON', 'JSON 형식이 올바르지 않습니다.')
        );
      }

      const parseResult = SubscribeRequestSchema.safeParse(requestBody);
      if (!parseResult.success) {
        return respond(
          c,
          failure(400 as ContentfulStatusCode, 'INVALID_INPUT', '입력값이 올바르지 않습니다.')
        );
      }

      const supabase = c.get('supabase');
      const result = await initiateSubscription(
        supabase,
        userId,
        parseResult.data.customerName,
        parseResult.data.customerEmail,
        parseResult.data.customerPhone
      );

      if (result.status === 'error') {
        return respond(
          c,
          failure(400 as ContentfulStatusCode, 'SUBSCRIPTION_ERROR', result.message)
        );
      }

      return respond(
        c,
        success(
          {
            checkoutUrl: result.checkoutUrl,
            orderId: result.orderId,
          },
          200 as ContentfulStatusCode
        )
      );
    } catch (error) {
      console.error('Subscription upgrade error:', error);
      return respond(
        c,
        failure(
          500 as ContentfulStatusCode,
          'INTERNAL_ERROR',
          '예기치 않은 오류가 발생했습니다.'
        )
      );
    }
  });

  // POST /api/subscription/cancel - 구독 취소 (다음 결제에 적용)
  app.post('/api/subscription/cancel', async (c) => {
    try {
      const userId = c.req.header('x-clerk-user-id');
      if (!userId) {
        return respond(
          c,
          failure(401 as ContentfulStatusCode, 'UNAUTHORIZED', '인증이 필요합니다.')
        );
      }

      const supabase = c.get('supabase');
      const result = await scheduleSubscriptionCancellation(supabase, userId);

      if (result.status === 'error') {
        return respond(
          c,
          failure(400 as ContentfulStatusCode, 'SUBSCRIPTION_ERROR', result.message)
        );
      }

      return respond(
        c,
        success(
          { message: result.message },
          200 as ContentfulStatusCode
        )
      );
    } catch (error) {
      console.error('Subscription cancellation error:', error);
      return respond(
        c,
        failure(
          500 as ContentfulStatusCode,
          'INTERNAL_ERROR',
          '예기치 않은 오류가 발생했습니다.'
        )
      );
    }
  });
}
