export const cronErrorCodes = {
  unauthorized: 'UNAUTHORIZED',
  databaseError: 'DATABASE_ERROR',
  paymentFailure: 'PAYMENT_FAILURE',
  tossApiError: 'TOSS_API_ERROR',
  clerkApiError: 'CLERK_API_ERROR',
} as const;

export type CronErrorCode = (typeof cronErrorCodes)[keyof typeof cronErrorCodes];
