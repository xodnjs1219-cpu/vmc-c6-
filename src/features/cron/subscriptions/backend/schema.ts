import { z } from 'zod';

export const CronRequestSchema = z.object({
  job_type: z.enum(['all', 'regular_payments', 'scheduled_cancellations']).default('all'),
});

export const SubscriptionQuerySchema = z.object({
  id: z.string().uuid(),
  user_id: z.string(),
  plan_type: z.enum(['Free', 'Pro']),
  billing_key: z.string().nullable(),
  customer_key: z.string().nullable(),
  next_payment_date: z.string().nullable(),
  cancellation_scheduled: z.boolean(),
  remaining_tries: z.number(),
});

export type SubscriptionQuery = z.infer<typeof SubscriptionQuerySchema>;

export const CronResponseSchema = z.object({
  success: z.boolean(),
  result: z.object({
    total_processed: z.number(),
    regular_payments: z.number(),
    scheduled_cancellations: z.number(),
    errors: z.array(
      z.object({
        user_id: z.string(),
        error: z.string(),
        type: z.enum(['payment_failure', 'database_error', 'clerk_error']),
      }),
    ),
  }),
});

export type CronResponse = z.infer<typeof CronResponseSchema>;
