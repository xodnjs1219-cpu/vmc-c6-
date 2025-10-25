import { z } from 'zod';

export const AnalysisDetailSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string(),
  name: z.string(),
  birth_date: z.string(),
  birth_time: z.string().nullable(),
  is_lunar: z.boolean(),
  model_type: z.enum(['flash', 'pro']),
  content: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type AnalysisDetail = z.infer<typeof AnalysisDetailSchema>;
