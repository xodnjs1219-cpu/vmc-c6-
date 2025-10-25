-- Migration: AI 사주 풀이 구독 서비스 테이블 생성
-- Date: 2025-10-25
-- Description: users, subscriptions, analyses 테이블 및 관련 트리거 생성

-- ============================================================
-- 1. Extension 활성화
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 2. 공통 트리거 함수: updated_at 자동 갱신
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 3. 테이블 생성
-- ============================================================

-- 3.1 users: 사용자 기본 정보 (Clerk 동기화)
CREATE TABLE IF NOT EXISTS public.users (
  id TEXT PRIMARY KEY,  -- Clerk user_id를 PK로 사용
  email TEXT NOT NULL UNIQUE,
  first_name TEXT,
  last_name TEXT,
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.users IS '사용자 기본 정보 (Clerk 웹훅으로 동기화)';
COMMENT ON COLUMN public.users.id IS 'Clerk user_id (외부 ID를 PK로 사용)';
COMMENT ON COLUMN public.users.email IS '사용자 이메일';
COMMENT ON COLUMN public.users.first_name IS '이름';
COMMENT ON COLUMN public.users.last_name IS '성';
COMMENT ON COLUMN public.users.image_url IS '프로필 이미지 URL';

-- 3.2 subscriptions: 구독 상태 및 결제 정보
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  plan_type TEXT NOT NULL DEFAULT 'Free' CHECK (plan_type IN ('Free', 'Pro')),
  remaining_tries INTEGER NOT NULL DEFAULT 3 CHECK (remaining_tries >= 0),
  billing_key TEXT,  -- 토스페이먼츠 빌링키 (암호화 저장 권장)
  customer_key TEXT,  -- 토스페이먼츠 customerKey (= user_id)
  next_payment_date DATE,  -- 다음 정기 결제 예정일
  subscribed_at TIMESTAMPTZ,  -- Pro 구독 시작 시각
  cancellation_scheduled BOOLEAN NOT NULL DEFAULT false,  -- 해지 예약 여부
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.subscriptions IS '사용자별 구독 상태 및 결제 정보';
COMMENT ON COLUMN public.subscriptions.id IS '구독 레코드 고유 ID';
COMMENT ON COLUMN public.subscriptions.user_id IS '사용자 ID (1:1 관계)';
COMMENT ON COLUMN public.subscriptions.plan_type IS '요금제 (Free 또는 Pro)';
COMMENT ON COLUMN public.subscriptions.remaining_tries IS '남은 분석 횟수 (Free: 최대 3, Pro: 최대 10)';
COMMENT ON COLUMN public.subscriptions.billing_key IS '토스페이먼츠 빌링키 (암호화 저장 권장)';
COMMENT ON COLUMN public.subscriptions.customer_key IS '토스페이먼츠 customerKey (= user_id)';
COMMENT ON COLUMN public.subscriptions.next_payment_date IS '다음 정기 결제 예정일';
COMMENT ON COLUMN public.subscriptions.subscribed_at IS 'Pro 구독 시작 시각';
COMMENT ON COLUMN public.subscriptions.cancellation_scheduled IS '해지 예약 여부';

-- 3.3 analyses: 사주 분석 내역
CREATE TABLE IF NOT EXISTS public.analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,  -- 분석 대상 이름
  birth_date TEXT NOT NULL,  -- 생년월일 (YYYY-MM-DD 형식)
  birth_time TEXT,  -- 태어난 시간 (HH:MM 형식, '모름' 시 NULL)
  is_lunar BOOLEAN NOT NULL DEFAULT false,  -- 음력 여부
  model_type TEXT NOT NULL CHECK (model_type IN ('flash', 'pro')),  -- 사용한 Gemini 모델
  summary TEXT,  -- AI 분석 결과 요약 (모달 표시용)
  detail TEXT NOT NULL,  -- AI 분석 결과 상세 (마크다운 형식)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.analyses IS '사용자별 사주 분석 요청 및 결과';
COMMENT ON COLUMN public.analyses.id IS '분석 레코드 고유 ID';
COMMENT ON COLUMN public.analyses.user_id IS '사용자 ID';
COMMENT ON COLUMN public.analyses.name IS '분석 대상 이름';
COMMENT ON COLUMN public.analyses.birth_date IS '생년월일 (YYYY-MM-DD 형식)';
COMMENT ON COLUMN public.analyses.birth_time IS '태어난 시간 (HH:MM 형식, 모름 시 NULL)';
COMMENT ON COLUMN public.analyses.is_lunar IS '음력 여부';
COMMENT ON COLUMN public.analyses.model_type IS '사용한 Gemini 모델 (flash 또는 pro)';
COMMENT ON COLUMN public.analyses.summary IS 'AI 분석 결과 요약 (모달 표시용)';
COMMENT ON COLUMN public.analyses.detail IS 'AI 분석 결과 상세 (마크다운 형식)';

-- ============================================================
-- 4. 인덱스 생성
-- ============================================================

-- users 테이블 인덱스
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON public.users(email);

-- subscriptions 테이블 인덱스
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_next_payment_date ON public.subscriptions(next_payment_date);
CREATE INDEX IF NOT EXISTS idx_subscriptions_cron_query ON public.subscriptions(plan_type, next_payment_date, cancellation_scheduled);

-- analyses 테이블 인덱스
CREATE INDEX IF NOT EXISTS idx_analyses_user_id ON public.analyses(user_id);
CREATE INDEX IF NOT EXISTS idx_analyses_user_created ON public.analyses(user_id, created_at DESC);

-- ============================================================
-- 5. 트리거 적용: updated_at 자동 갱신
-- ============================================================

-- users 테이블 트리거
DROP TRIGGER IF EXISTS update_users_updated_at ON public.users;
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- subscriptions 테이블 트리거
DROP TRIGGER IF EXISTS update_subscriptions_updated_at ON public.subscriptions;
CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- analyses 테이블 트리거
DROP TRIGGER IF EXISTS update_analyses_updated_at ON public.analyses;
CREATE TRIGGER update_analyses_updated_at
  BEFORE UPDATE ON public.analyses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 6. RLS (Row Level Security) 비활성화
-- ============================================================
ALTER TABLE IF EXISTS public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.subscriptions DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.analyses DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- 7. Migration 완료 로그
-- ============================================================
DO $$
BEGIN
  RAISE NOTICE 'Migration 0002: AI 사주 풀이 구독 서비스 테이블 생성 완료';
  RAISE NOTICE '  - users 테이블 생성 및 인덱스 적용';
  RAISE NOTICE '  - subscriptions 테이블 생성 및 인덱스 적용';
  RAISE NOTICE '  - analyses 테이블 생성 및 인덱스 적용';
  RAISE NOTICE '  - updated_at 자동 갱신 트리거 적용';
  RAISE NOTICE '  - RLS 비활성화';
END $$;
