import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { validateClerkWebhook } from '@/backend/lib/external/webhook-validator';
import { processUserCreated } from './service';
import { ClerkWebhookEventSchema } from './schema';
import type { AppEnv } from '@/backend/hono/context';

export async function registerClerkWebhookRoutes(baseApp: Hono<AppEnv>): Promise<void> {
  baseApp.post('/api/webhooks/clerk', async (c) => {
    try {
      // Get raw body for signature verification
      const rawBody = await c.req.text();
      const headers: Record<string, string> = {};

      // Convert headers to record (Hono headers interface)
      for (const [key, value] of Object.entries(c.req.header() || {})) {
        headers[key] = value || '';
      }

      // Verify webhook signature (테스트 환경에서는 스킵)
      const skipWebhookValidation =
        process.env.SKIP_WEBHOOK_VALIDATION === 'true';

      if (!skipWebhookValidation) {
        try {
          await validateClerkWebhook(headers, rawBody);
        } catch (err) {
          console.error('[Clerk Webhook] Signature verification failed:', err);
          throw new HTTPException(401, { message: 'Webhook verification failed' });
        }
      }

      // Parse and validate payload
      const payload = JSON.parse(rawBody);
      const result = ClerkWebhookEventSchema.safeParse(payload);

      if (!result.success) {
        console.error('[Clerk Webhook] Invalid payload:', result.error);
        throw new HTTPException(400, { message: 'Invalid webhook payload' });
      }

      // Process the event
      const response = await processUserCreated(result.data);

      if (!response.success) {
        console.error('[Clerk Webhook] Processing failed:', response.message);
        throw new HTTPException(500, { message: response.message });
      }

      return c.json(response, 200);
    } catch (error) {
      if (error instanceof HTTPException) {
        throw error;
      }
      console.error('[Clerk Webhook] Unexpected error:', error);
      throw new HTTPException(500, { message: 'Internal server error' });
    }
  });
}
