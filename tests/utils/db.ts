import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function createUser(user: { id: string; email: string }) {
  const { data, error } = await supabase.from('users').insert([user]);
  if (error) throw error;
  return data;
}

export async function createAnalysisForUser(analysis: any) {
  const { data, error } = await supabase.from('analyses').insert([analysis]);
  if (error) throw error;
  return data;
}

export async function cleanupUser(userId: string) {
  await supabase.from('analyses').delete().eq('user_id', userId);
  await supabase.from('users').delete().eq('id', userId);
}
