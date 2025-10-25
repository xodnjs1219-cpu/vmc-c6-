import { z } from 'zod';

// Query Parameters Schema
export const AnalysesQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
});

export type AnalysesQuery = z.infer<typeof AnalysesQuerySchema>;

// Database Row Schema (analyses 테이블)
export const AnalysisRowSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string(),
  name: z.string(),
  birth_date: z.string(),
  birth_time: z.string().nullable(),
  is_lunar: z.boolean(),
  model_type: z.enum(['flash', 'pro']),
  created_at: z.string(),
});

export type AnalysisRow = z.infer<typeof AnalysisRowSchema>;

// Response Schema
export const AnalysisItemSchema = AnalysisRowSchema.omit({ user_id: true });
export type AnalysisItem = z.infer<typeof AnalysisItemSchema>;

export const PaginationInfoSchema = z.object({
  total_count: z.number().int().nonnegative(),
  total_pages: z.number().int().nonnegative(),
  current_page: z.number().int().positive(),
  per_page: z.number().int().positive(),
  has_next: z.boolean(),
  has_prev: z.boolean(),
});

export type PaginationInfo = z.infer<typeof PaginationInfoSchema>;

export const AnalysesListResponseSchema = z.object({
  items: z.array(AnalysisItemSchema),
  pagination: PaginationInfoSchema,
});

export type AnalysesListResponse = z.infer<typeof AnalysesListResponseSchema>;
