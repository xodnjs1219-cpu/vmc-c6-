export const analysesErrorCodes = {
  invalidQueryParams: 'INVALID_QUERY_PARAMS',
  unauthorized: 'UNAUTHORIZED',
  databaseError: 'DATABASE_ERROR',
  validationError: 'VALIDATION_ERROR',
  quotaExceeded: 'QUOTA_EXCEEDED',
  notFound: 'NOT_FOUND',
} as const;

type AnalysesErrorValue =
  (typeof analysesErrorCodes)[keyof typeof analysesErrorCodes];

export type AnalysesServiceError = AnalysesErrorValue;
