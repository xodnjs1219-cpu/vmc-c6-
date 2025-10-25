import { z } from 'zod';

export const SubscribeRequestSchema = z.object({
  customerName: z.string().min(1),
  customerEmail: z.string().email(),
  customerPhone: z.string().regex(/^\d{10,11}$/),
});

export type SubscribeRequest = z.infer<typeof SubscribeRequestSchema>;

export const SubscribeResponseSchema = z.object({
  success: z.literal(true),
  checkoutUrl: z.string().url(),
  orderId: z.string(),
});

export type SubscribeResponse = z.infer<typeof SubscribeResponseSchema>;

// 구독 확인 응답
export const SubscribeConfirmResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  subscriptionPlan: z.enum(['Free', 'Pro']).optional(),
});

export type SubscribeConfirmResponse = z.infer<typeof SubscribeConfirmResponseSchema>;
