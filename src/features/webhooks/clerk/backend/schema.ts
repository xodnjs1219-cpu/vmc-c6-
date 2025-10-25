import { z } from 'zod';

export const ClerkWebhookEventSchema = z.object({
  type: z.literal('user.created'),
  data: z.object({
    id: z.string(),
    email_addresses: z.array(z.object({ email_address: z.string() })),
    first_name: z.string().nullable(),
    last_name: z.string().nullable(),
    image_url: z.string().nullable(),
  }),
});

export type ClerkWebhookEvent = z.infer<typeof ClerkWebhookEventSchema>;

export const UserSyncResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  userId: z.string().optional(),
});

export type UserSyncResponse = z.infer<typeof UserSyncResponseSchema>;
