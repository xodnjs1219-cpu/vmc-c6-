import { Hono } from 'hono';
import type { AppEnv } from '@/backend/hono/context';
import { respond, failure, success } from '@/backend/http/response';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { processSubscriptionPayment } from './service';

export function registerPaymentRoutes(app: Hono<AppEnv>) {
  // GET /api/payments/subscribe - 토스페이먼츠 카드 등록 성공 후 처리
  app.get('/api/payments/subscribe', async (c) => {
    try {
      const authKey = c.req.query('authKey');
      const customerKey = c.req.query('customerKey');
      const customerName = c.req.query('customerName');
      const customerEmail = c.req.query('customerEmail');
      const customerPhone = c.req.query('customerPhone');

      if (!authKey || !customerKey) {
        return c.redirect('/subscription?error=missing_auth_key');
      }

      const supabase = c.get('supabase');
      const result = await processSubscriptionPayment(
        supabase,
        customerKey,
        authKey,
        customerName || '',
        customerEmail || '',
        customerPhone || ''
      );

      if (result.status === 'error') {
        return c.redirect(`/subscription?error=${encodeURIComponent(result.message)}`);
      }

      // 성공 시 구독 페이지로 리디렉션
      return c.redirect('/subscription?success=true');
    } catch (error) {
      console.error('Payment processing error:', error);
      return c.redirect('/subscription?error=internal_error');
    }
  });
}