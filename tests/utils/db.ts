import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface TestUser {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  image_url?: string;
}

export interface TestSubscription {
  user_id: string;
  plan_type: 'Free' | 'Pro';
  remaining_tries: number;
  billing_key?: string | null;
  customer_key?: string | null;
  next_payment_date?: string | null;
}

export interface TestAnalysis {
  user_id: string;
  name: string;
  birth_date: string;
  birth_time?: string | null;
  is_lunar: boolean;
  model_type: 'flash' | 'pro';
  summary?: string;
  detail: string;
}

// 사용자 생성 (자동으로 Free 구독 생성됨)
export async function createUser(user: TestUser) {
  const { data, error } = await supabase.from('users').insert([user]).select();
  if (error) throw new Error(`Failed to create user: ${error.message}`);
  return data?.[0];
}

// 구독 정보 업데이트
export async function updateSubscription(
  userId: string,
  subscription: Partial<TestSubscription>
) {
  const { data, error } = await supabase
    .from('subscriptions')
    .update(subscription)
    .eq('user_id', userId)
    .select();
  if (error) throw new Error(`Failed to update subscription: ${error.message}`);
  return data?.[0];
}

// 분석 생성
export async function createAnalysis(analysis: TestAnalysis) {
  const { data, error } = await supabase
    .from('analyses')
    .insert([analysis])
    .select();
  if (error) throw new Error(`Failed to create analysis: ${error.message}`);
  return data?.[0];
}

// 사용자 정보 조회
export async function getUser(userId: string) {
  const { data, error } = await supabase
    .from('users')
    .select()
    .eq('id', userId)
    .single();
  if (error && error.code !== 'PGRST116') {
    throw new Error(`Failed to get user: ${error.message}`);
  }
  return data || null;
}

// 구독 정보 조회
export async function getSubscription(userId: string) {
  const { data, error } = await supabase
    .from('subscriptions')
    .select()
    .eq('user_id', userId)
    .single();
  if (error && error.code !== 'PGRST116') {
    throw new Error(`Failed to get subscription: ${error.message}`);
  }
  return data || null;
}

// 분석 목록 조회
export async function getAnalysesByUser(userId: string) {
  const { data, error } = await supabase
    .from('analyses')
    .select()
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(`Failed to get analyses: ${error.message}`);
  return data || [];
}

// 전체 정리 (사용자 및 관련 데이터 삭제)
export async function cleanupUser(userId: string) {
  await supabase.from('analyses').delete().eq('user_id', userId);
  await supabase.from('subscriptions').delete().eq('user_id', userId);
  await supabase.from('users').delete().eq('id', userId);
}

// 테스트 데이터 팩토리: Free 사용자
export function createTestUserPayload(
  overrides: Partial<TestUser> = {}
): TestUser {
  const uniqueId = `test_user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  return {
    id: uniqueId,
    email: `${uniqueId}@test.com`,
    first_name: '테스트',
    last_name: '사용자',
    ...overrides,
  };
}

// 테스트 데이터 팩토리: 구독
export function createTestSubscriptionPayload(
  userId: string,
  overrides: Partial<TestSubscription> = {}
): TestSubscription {
  return {
    user_id: userId,
    plan_type: 'Free',
    remaining_tries: 3,
    billing_key: null,
    customer_key: null,
    next_payment_date: null,
    ...overrides,
  };
}

// 테스트 데이터 팩토리: 분석
export function createTestAnalysisPayload(
  userId: string,
  overrides: Partial<TestAnalysis> = {}
): TestAnalysis {
  return {
    user_id: userId,
    name: '테스트 분석',
    birth_date: '1990-01-01',
    birth_time: null,
    is_lunar: false,
    model_type: 'flash',
    summary: '테스트 요약',
    detail: '테스트 상세 분석 내용',
    ...overrides,
  };
}
