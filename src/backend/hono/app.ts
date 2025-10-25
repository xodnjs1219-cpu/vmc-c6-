import { Hono } from 'hono';
import { errorBoundary } from '@/backend/middleware/error';
import { withAppContext } from '@/backend/middleware/context';
import { withSupabase } from '@/backend/middleware/supabase';
import { registerExampleRoutes } from '@/features/example/backend/route';
import { registerClerkWebhookRoutes } from '@/features/webhooks/clerk/backend/route';
import { registerCronRoutes } from '@/features/cron/subscriptions/backend/route';
import { registerAnalysesRoutes } from '@/features/analyses/backend/route';
import { registerSubscriptionRoutes } from '@/features/subscription/backend/route';
import { registerPaymentRoutes } from '@/features/payments/backend/route';
import type { AppEnv } from '@/backend/hono/context';

let singletonApp: Hono<AppEnv> | null = null;

export const createHonoApp = () => {
  if (singletonApp) {
    return singletonApp;
  }

  const app = new Hono<AppEnv>();

  app.use('*', errorBoundary());
  app.use('*', withAppContext());
  app.use('*', withSupabase());

  // Register routes
  registerExampleRoutes(app);
  registerClerkWebhookRoutes(app);
  registerCronRoutes(app);
  registerAnalysesRoutes(app);
  registerSubscriptionRoutes(app);
  registerPaymentRoutes(app);

  singletonApp = app;

  return app;
};


