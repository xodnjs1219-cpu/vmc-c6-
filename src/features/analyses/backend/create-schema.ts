import { z } from 'zod';

// 분석 요청 스키마
export const CreateAnalysisRequestSchema = z.object({
  name: z.string().min(1).max(100),
  birth_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  birth_time: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  is_lunar: z.boolean(),
  model_type: z.enum(['flash', 'pro']),
});

export type CreateAnalysisRequest = z.infer<typeof CreateAnalysisRequestSchema>;

// 분석 결과 스키마
export const CreateAnalysisResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  birth_date: z.string(),
  birth_time: z.string().nullable(),
  is_lunar: z.boolean(),
  model_type: z.enum(['flash', 'pro']),
  created_at: z.string(),
  content: z.string(),
  remaining_tries: z.number().int().min(0),
});

export type CreateAnalysisResponse = z.infer<typeof CreateAnalysisResponseSchema>;
