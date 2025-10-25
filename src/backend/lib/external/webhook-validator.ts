'use server';

import { Webhook } from 'svix';
import { serverEnv } from '@/constants/server-env';

export async function validateClerkWebhook(
  headers: Record<string, string | string[] | undefined>,
  body: string,
): Promise<void> {
  const secret = serverEnv.CLERK_WEBHOOK_SIGNING_SECRET;
  const wh = new Webhook(secret);

  try {
    wh.verify(body, {
      'svix-id': String(headers['svix-id'] || ''),
      'svix-timestamp': String(headers['svix-timestamp'] || ''),
      'svix-signature': String(headers['svix-signature'] || ''),
    });
  } catch (err) {
    throw new Error(`Webhook verification failed: ${err}`);
  }
}
