import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { verifyCronSecret } from '@/backend/lib/cron/scheduler';
import { processSubscriptions } from './service';
import { CronResponse } from './schema';
import type { AppEnv } from '@/backend/hono/context';

export async function registerCronRoutes(baseApp: Hono<AppEnv>): Promise<void> {
  baseApp.post('/api/cron/process-subscriptions', async (c) => {
    try {
      // Verify Cron Secret
      const authHeader = c.req.header('authorization');

      if (!verifyCronSecret(authHeader)) {
        console.error('[Cron] Invalid or missing CRON_SECRET');
        throw new HTTPException(401, { message: 'Unauthorized' });
      }

      // Get supabase from context
      const supabase = c.get('supabase') as any;
      if (!supabase) {
        throw new HTTPException(500, { message: 'Database client not available' });
      }

      // Process subscriptions
      const result = await processSubscriptions(supabase);

      const response: CronResponse = {
        success: true,
        result,
      };

      return c.json(response, 200);
    } catch (error) {
      if (error instanceof HTTPException) {
        throw error;
      }

      console.error('[Cron] Unexpected error:', error);
      throw new HTTPException(500, { message: 'Internal server error' });
    }
  });
}
