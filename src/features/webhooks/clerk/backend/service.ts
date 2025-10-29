import { createClient } from '@supabase/supabase-js';
import { clerkClient } from '@/backend/lib/external/clerk-client';
import { ClerkWebhookEvent, UserSyncResponse } from './schema';
import { SUBSCRIPTION_PLANS } from '@/backend/config/subscription-plans';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

export async function processUserCreated(payload: ClerkWebhookEvent): Promise<UserSyncResponse> {
  const { id: userId, email_addresses, first_name, last_name, image_url } = payload.data;
  const primaryEmail = email_addresses[0]?.email_address;

  if (!primaryEmail) {
    return {
      success: false,
      message: 'No email address found in Clerk user data',
    };
  }

  try {
    const freePlan = SUBSCRIPTION_PLANS.Free;

    // Start transaction
    const { error: userError } = await supabase.from('users').upsert(
      {
        id: userId,
        email: primaryEmail,
        first_name: first_name || null,
        last_name: last_name || null,
        image_url: image_url || null,
        created_at: new Date().toISOString(),
      },
      { onConflict: 'id' },
    );

    if (userError) {
      console.error('[Clerk Webhook] User insert failed:', userError);
      return {
        success: false,
        message: `Database error: ${userError.message}`,
      };
    }

    // Create default subscription
    const { error: subscriptionError } = await supabase.from('subscriptions').upsert(
      {
        user_id: userId,
        plan_type: freePlan.name,
        remaining_tries: freePlan.monthlyQuota,
        billing_key: null,
        customer_key: null,
        next_payment_date: null,
        subscribed_at: null,
        cancellation_scheduled: false,
      },
      { onConflict: 'user_id' },
    );

    if (subscriptionError) {
      console.error('[Clerk Webhook] Subscription insert failed:', subscriptionError);
      return {
        success: false,
        message: `Database error: ${subscriptionError.message}`,
      };
    }

    // Update Clerk metadata
    try {
      await clerkClient.updateUserPublicMetadata(userId, {
        subscription: freePlan.name,
      });
    } catch (err) {
      console.error('[Clerk Webhook] Failed to update Clerk metadata:', err);
      // Don't fail the webhook if metadata update fails
    }

    console.log(`[Clerk Webhook] User ${userId} created successfully`);

    return {
      success: true,
      message: 'User created successfully',
      userId,
    };
  } catch (error) {
    console.error('[Clerk Webhook] Unexpected error:', error);
    return {
      success: false,
      message: `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}
