-- Migration: 사용자 생성 시 자동으로 Free 구독 생성
-- Date: 2025-10-25
-- Description: users 테이블에 INSERT 시 자동으로 subscriptions 레코드를 생성하는 트리거 추가

-- ============================================================
-- 1. 트리거 함수: 신규 사용자에게 Free 구독 자동 생성
-- ============================================================
CREATE OR REPLACE FUNCTION create_subscription_for_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- 신규 사용자에게 Free 플랜 구독 자동 생성
  INSERT INTO public.subscriptions (
    user_id,
    plan_type,
    remaining_tries,
    customer_key
  )
  VALUES (
    NEW.id,
    'Free',
    3,  -- Free 플랜 기본 무료 횟수
    NEW.id  -- customer_key = user_id
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION create_subscription_for_new_user() IS '신규 사용자 생성 시 Free 구독을 자동으로 생성';

-- ============================================================
-- 2. 트리거 적용: users 테이블 INSERT 후 자동 실행
-- ============================================================
DROP TRIGGER IF EXISTS trigger_create_subscription_on_user_insert ON public.users;
CREATE TRIGGER trigger_create_subscription_on_user_insert
  AFTER INSERT ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION create_subscription_for_new_user();

COMMENT ON TRIGGER trigger_create_subscription_on_user_insert ON public.users IS '사용자 생성 시 Free 구독 자동 생성';

-- ============================================================
-- 3. Migration 완료 로그
-- ============================================================
DO $$
BEGIN
  RAISE NOTICE 'Migration 0003: 사용자 생성 시 Free 구독 자동 생성 트리거 추가 완료';
  RAISE NOTICE '  - create_subscription_for_new_user() 함수 생성';
  RAISE NOTICE '  - trigger_create_subscription_on_user_insert 트리거 적용';
END $$;
