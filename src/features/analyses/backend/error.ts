export const analysesErrorCodes = {
  invalidQueryParams: 'INVALID_QUERY_PARAMS',
  unauthorized: 'UNAUTHORIZED',
  databaseError: 'DATABASE_ERROR',
  validationError: 'VALIDATION_ERROR',
} as const;

type AnalysesErrorValue =
  (typeof analysesErrorCodes)[keyof typeof analysesErrorCodes];

export type AnalysesServiceError = AnalysesErrorValue;
