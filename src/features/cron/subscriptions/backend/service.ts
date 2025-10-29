import type { SupabaseClient } from '@supabase/supabase-js';
import { tossClient } from '@/backend/lib/external/toss-client';
import { clerkClient } from '@/backend/lib/external/clerk-client';
import { getKSTToday, formatDateToYYYYMMDD, addOneMonth } from '@/features/cron/lib/date-utils';
import { SubscriptionQuery } from './schema';

interface CronResult {
  total_processed: number;
  regular_payments: number;
  scheduled_cancellations: number;
  errors: Array<{
    user_id: string;
    error: string;
    type: 'payment_failure' | 'database_error' | 'clerk_error';
  }>;
}

export async function processSubscriptions(supabase: SupabaseClient): Promise<CronResult> {
  const result: CronResult = {
    total_processed: 0,
    regular_payments: 0,
    scheduled_cancellations: 0,
    errors: [],
  };

  try {
    // Process regular payments
    await processRegularPayments(supabase, result);

    // Process scheduled cancellations
    await processScheduledCancellations(supabase, result);

    console.log('[Cron] Subscription processing completed:', result);
    return result;
  } catch (error) {
    console.error('[Cron] Fatal error during subscription processing:', error);
    result.errors.push({
      user_id: 'system',
      error: error instanceof Error ? error.message : 'Unknown error',
      type: 'database_error',
    });
    return result;
  }
}

async function processRegularPayments(supabase: SupabaseClient, result: CronResult): Promise<void> {
  const today = getKSTToday();
  const todayStr = formatDateToYYYYMMDD(today);

  console.log(`[Cron] Processing regular payments for ${todayStr}`);

  // Query subscriptions due for payment (today or earlier)
  const { data: subscriptions, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('plan_type', 'Pro')
    .lte('next_payment_date', todayStr)
    .eq('cancellation_scheduled', false);

  if (error) {
    console.error('[Cron] Failed to query subscriptions:', error);
    result.errors.push({
      user_id: 'system',
      error: `Database query failed: ${error.message}`,
      type: 'database_error',
    });
    return;
  }

  if (!subscriptions || subscriptions.length === 0) {
    console.log('[Cron] No subscriptions due for payment today');
    return;
  }

  console.log(`[Cron] Found ${subscriptions.length} subscriptions for regular payment`);

  for (const subscription of subscriptions) {
    const sub = subscription as SubscriptionQuery;

    if (!sub.billing_key || !sub.customer_key) {
      console.warn(`[Cron] Subscription ${sub.id} missing billing_key or customer_key`);
      result.errors.push({
        user_id: sub.user_id,
        error: 'Missing billing key or customer key',
        type: 'payment_failure',
      });
      continue;
    }

    try {
      const orderId = `subscription_${sub.user_id}_${todayStr}`;

      // Attempt billing
      console.log(`[Cron] Charging ${sub.user_id} for subscription (orderId: ${orderId})`);
      await tossClient.chargeBilling(sub.billing_key, {
        customerKey: sub.customer_key,
        amount: 3900,
        orderId,
      });

      // Update subscription on success
      const nextPaymentDate = addOneMonth(today);
      const nextPaymentDateStr = formatDateToYYYYMMDD(nextPaymentDate);

      const { error: updateError } = await supabase
        .from('subscriptions')
        .update({
          remaining_tries: 10,
          next_payment_date: nextPaymentDateStr,
          updated_at: new Date().toISOString(),
        })
        .eq('id', sub.id);

      if (updateError) {
        console.error(`[Cron] Failed to update subscription ${sub.id}:`, updateError);
        result.errors.push({
          user_id: sub.user_id,
          error: `Update failed: ${updateError.message}`,
          type: 'database_error',
        });
      } else {
        console.log(`[Cron] Successfully charged ${sub.user_id}`);
        result.regular_payments++;
        result.total_processed++;
      }
    } catch (err) {
      console.error(`[Cron] Payment failed for ${sub.user_id}:`, err);

      // Handle payment failure: convert to Free plan
      try {
        const { error: updateError } = await supabase
          .from('subscriptions')
          .update({
            plan_type: 'Free',
            billing_key: null,
            customer_key: null,
            next_payment_date: null,
            remaining_tries: 0,
            updated_at: new Date().toISOString(),
          })
          .eq('id', sub.id);

        if (!updateError) {
          // Update Clerk metadata
          try {
            await clerkClient.updateUserPublicMetadata(sub.user_id, {
              subscription: 'Free',
            });
          } catch (clerkErr) {
            console.error(`[Cron] Failed to update Clerk metadata for ${sub.user_id}:`, clerkErr);
          }
        }
      } catch (failureErr) {
        console.error(`[Cron] Failed to handle payment failure for ${sub.user_id}:`, failureErr);
      }

      result.errors.push({
        user_id: sub.user_id,
        error: err instanceof Error ? err.message : 'Unknown payment error',
        type: 'payment_failure',
      });
    }
  }
}

async function processScheduledCancellations(supabase: SupabaseClient, result: CronResult): Promise<void> {
  const today = getKSTToday();
  const todayStr = formatDateToYYYYMMDD(today);

  console.log(`[Cron] Processing scheduled cancellations for ${todayStr}`);

  // Query subscriptions scheduled for cancellation (today or earlier)
  const { data: subscriptions, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('plan_type', 'Pro')
    .lte('next_payment_date', todayStr)
    .eq('cancellation_scheduled', true);

  if (error) {
    console.error('[Cron] Failed to query scheduled cancellations:', error);
    result.errors.push({
      user_id: 'system',
      error: `Database query failed: ${error.message}`,
      type: 'database_error',
    });
    return;
  }

  if (!subscriptions || subscriptions.length === 0) {
    console.log('[Cron] No scheduled cancellations today');
    return;
  }

  console.log(`[Cron] Found ${subscriptions.length} scheduled cancellations`);

  for (const subscription of subscriptions) {
    const sub = subscription as SubscriptionQuery;

    try {
      // Cancel subscription
      const { error: updateError } = await supabase
        .from('subscriptions')
        .update({
          plan_type: 'Free',
          billing_key: null,
          customer_key: null,
          next_payment_date: null,
          remaining_tries: 0,
          cancellation_scheduled: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', sub.id);

      if (updateError) {
        console.error(`[Cron] Failed to cancel subscription ${sub.id}:`, updateError);
        result.errors.push({
          user_id: sub.user_id,
          error: `Cancellation failed: ${updateError.message}`,
          type: 'database_error',
        });
        continue;
      }

      // Update Clerk metadata
      try {
        await clerkClient.updateUserPublicMetadata(sub.user_id, {
          subscription: 'Free',
        });
      } catch (clerkErr) {
        console.error(`[Cron] Failed to update Clerk metadata for ${sub.user_id}:`, clerkErr);
        // Don't fail the cancellation due to Clerk metadata update failure
      }

      console.log(`[Cron] Successfully cancelled subscription for ${sub.user_id}`);
      result.scheduled_cancellations++;
      result.total_processed++;
    } catch (err) {
      console.error(`[Cron] Unexpected error processing cancellation for ${sub.user_id}:`, err);
      result.errors.push({
        user_id: sub.user_id,
        error: err instanceof Error ? err.message : 'Unknown error',
        type: 'database_error',
      });
    }
  }
}
