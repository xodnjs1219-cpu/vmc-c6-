import { serverEnv } from '@/constants/server-env';

export function verifyCronSecret(authHeader: string | undefined): boolean {
  if (!authHeader) return false;

  const secret = serverEnv.CRON_SECRET;
  const token = authHeader.replace('Bearer ', '');

  return token === secret;
}
