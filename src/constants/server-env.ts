import { z } from 'zod';

const serverEnvSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  CLERK_SECRET_KEY: z.string().min(1),
  CLERK_WEBHOOK_SIGNING_SECRET: z.string().min(1),
  TOSS_SECRET_KEY: z.string().min(1),
  CRON_SECRET: z.string().min(1),
  GEMINI_API_KEY: z.string().min(1),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

const _serverEnv = serverEnvSchema.safeParse({
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
  CLERK_WEBHOOK_SIGNING_SECRET: process.env.CLERK_WEBHOOK_SIGNING_SECRET,
  TOSS_SECRET_KEY: process.env.TOSS_SECRET_KEY,
  CRON_SECRET: process.env.CRON_SECRET,
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
});

if (!_serverEnv.success) {
  console.error('서버 환경 변수 검증 실패:', _serverEnv.error.flatten().fieldErrors);
  throw new Error('서버 환경 변수를 확인하세요.');
}

export const serverEnv: ServerEnv = _serverEnv.data;
