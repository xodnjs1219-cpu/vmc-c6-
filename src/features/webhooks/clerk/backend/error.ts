export const clerkWebhookErrorCodes = {
  invalidWebhook: 'INVALID_WEBHOOK',
  unauthorizedWebhook: 'UNAUTHORIZED_WEBHOOK',
  databaseError: 'DATABASE_ERROR',
  clerkApiError: 'CLERK_API_ERROR',
  duplicateUser: 'DUPLICATE_USER',
} as const;

export type ClerkWebhookErrorCode = (typeof clerkWebhookErrorCodes)[keyof typeof clerkWebhookErrorCodes];
