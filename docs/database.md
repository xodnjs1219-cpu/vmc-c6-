# 데이터베이스 설계 문서

## 1. 개요

이 문서는 AI 사주 풀이 구독 서비스의 데이터베이스 스키마 설계를 다룹니다.
PostgreSQL 기반 Supabase를 사용하며, PRD 및 userflow에 명시된 모든 비즈니스 로직을 지원합니다.

**핵심 설계 원칙:**
- 유저플로우에 명시적으로 언급된 데이터만 포함
- 구독 상태 관리 (Free/Pro)
- 횟수 제한 (Free: 총 3회, Pro: 월 10회)
- 정기결제 및 해지 예약 처리
- 외부 서비스 연동 (Clerk, 토스페이먼츠, Gemini)

## 2. 데이터 플로우

### 2.1 신규 사용자 가입 플로우
```
[사용자] → [Clerk 인증] → [Clerk Webhook: user.created]
    ↓
[백엔드 API: /api/webhooks/clerk]
    ↓
[users 테이블: 신규 레코드 생성]
[subscriptions 테이블: plan_type='Free', remaining_tries=3 레코드 생성]
```

### 2.2 사주 분석 요청 플로우 (Free 사용자)
```
[사용자] → [프론트엔드: /new-analysis]
    ↓
[백엔드 API: 분석 요청]
    ↓
[subscriptions 테이블 조회: plan_type='Free', remaining_tries >= 1 확인]
    ↓ (횟수 확인 통과)
[Gemini API: Flash 모델로 사주 분석 요청]
    ↓ (분석 결과 수신)
[analyses 테이블: 분석 결과 저장 (model_type='flash')]
[subscriptions 테이블: remaining_tries -= 1]
    ↓
[프론트엔드: 결과 모달 표시]
```

### 2.3 Pro 구독 신청 플로우
```
[사용자] → [프론트엔드: /subscription → Pro 구독하기 클릭]
    ↓
[토스페이먼츠 SDK: requestBillingAuth]
    ↓
[사용자: 카드 정보 입력 및 인증]
    ↓ (authKey 발급)
[백엔드 API: /api/payments/subscribe]
    ↓
[토스페이먼츠 API: authKey → billingKey 교환]
[토스페이먼츠 API: billingKey로 첫 결제 (3,900원)]
    ↓ (결제 성공)
[subscriptions 테이블 업데이트]
  - plan_type: 'Pro'
  - remaining_tries: 10
  - billing_key: (암호화된 빌링키)
  - customer_key: user_id
  - next_payment_date: 오늘 + 1개월
  - subscribed_at: 현재 시각
    ↓
[Clerk publicMetadata 업데이트: subscription='Pro']
```

### 2.4 사주 분석 요청 플로우 (Pro 사용자)
```
[사용자] → [프론트엔드: /new-analysis]
    ↓
[사용자: Flash/Pro 모델 선택]
    ↓
[백엔드 API: 분석 요청 (선택한 모델 포함)]
    ↓
[subscriptions 테이블 조회: plan_type='Pro', remaining_tries >= 1 확인]
    ↓ (횟수 확인 통과)
[Gemini API: 선택한 모델(Flash 또는 Pro)로 분석 요청]
    ↓ (분석 결과 수신)
[analyses 테이블: 분석 결과 저장 (model_type='flash' or 'pro')]
[subscriptions 테이블: remaining_tries -= 1]
    ↓
[프론트엔드: 결과 모달 표시]
```

### 2.5 구독 해지 예약 플로우
```
[사용자] → [프론트엔드: /subscription → 해지하기 클릭]
    ↓
[백엔드 API: /api/payments/cancel]
    ↓
[subscriptions 테이블 업데이트]
  - cancellation_scheduled: true
    ↓
[프론트엔드: '해지 취소' 버튼으로 UI 변경]
```

### 2.6 정기 결제 플로우 (Cron Job - 매일 02:00)
```
[Supabase Cron] → [백엔드 API: /api/cron/process-subscriptions]
    ↓
[subscriptions 테이블 조회]
  - plan_type='Pro'
  - next_payment_date = 오늘
  - cancellation_scheduled = false
    ↓
[각 구독 건마다 반복]
  ↓
  [토스페이먼츠 API: billing_key로 정기 결제 (3,900원)]
    ↓
    [결제 성공 시]
      - remaining_tries: 10 (리셋)
      - next_payment_date: 오늘 + 1개월
    ↓
    [결제 실패 시]
      - plan_type: 'Free'
      - remaining_tries: 0
      - billing_key: null (삭제)
      - next_payment_date: null
      - Clerk publicMetadata: subscription='Free'
```

### 2.7 예약된 해지 자동 처리 플로우 (Cron Job - 매일 02:00)
```
[Supabase Cron] → [백엔드 API: /api/cron/process-subscriptions]
    ↓
[subscriptions 테이블 조회]
  - plan_type='Pro'
  - next_payment_date = 오늘
  - cancellation_scheduled = true
    ↓
[각 구독 건마다 처리]
  ↓
  [subscriptions 테이블 업데이트]
    - plan_type: 'Free'
    - remaining_tries: 0
    - billing_key: null (삭제)
    - next_payment_date: null
    - cancellation_scheduled: false
  ↓
  [Clerk publicMetadata: subscription='Free']
```

### 2.8 분석 내역 조회 플로우 (페이지네이션)
```
[사용자] → [프론트엔드: /dashboard?page=1]
    ↓
[백엔드 API: 분석 목록 요청 (page, limit)]
    ↓
[analyses 테이블 조회]
  - WHERE user_id = 현재 사용자
  - ORDER BY created_at DESC
  - LIMIT 10
  - OFFSET (page - 1) * 10
    ↓
[총 개수(COUNT) 조회]
    ↓
[프론트엔드: 목록 + 페이지네이션 표시]
```

### 2.9 분석 상세보기 및 다운로드 플로우
```
[사용자] → [프론트엔드: /analysis/[analysisId]]
    ↓
[백엔드 API: 상세 조회]
    ↓
[analyses 테이블 조회]
  - WHERE id = analysisId AND user_id = 현재 사용자
    ↓ (결과 반환)
[프론트엔드: 상세 내용 표시]
    ↓
[사용자: MD 다운로드 버튼 클릭]
    ↓
[프론트엔드: 클라이언트 사이드에서 Blob 생성 및 다운로드 트리거]
```

## 3. 데이터베이스 스키마

### 3.1 users (사용자 기본 정보)

**목적:** Clerk에서 관리하는 사용자의 기본 정보를 동기화하여 저장

| 컬럼명 | 타입 | 제약 | 설명 |
|--------|------|------|------|
| id | TEXT | PRIMARY KEY | Clerk user_id (외부 ID를 PK로 사용) |
| email | TEXT | NOT NULL, UNIQUE | 사용자 이메일 |
| first_name | TEXT | | 이름 |
| last_name | TEXT | | 성 |
| image_url | TEXT | | 프로필 이미지 URL |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | 레코드 생성 시각 |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | 레코드 수정 시각 (트리거로 자동 갱신) |

**인덱스:**
- PRIMARY KEY: `id`
- UNIQUE INDEX: `email`

### 3.2 subscriptions (구독 상태 관리)

**목적:** 사용자별 구독 상태, 횟수 제한, 결제 정보 관리

| 컬럼명 | 타입 | 제약 | 설명 |
|--------|------|------|------|
| id | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | 구독 레코드 고유 ID |
| user_id | TEXT | NOT NULL, UNIQUE, FK → users.id | 사용자 ID (1:1 관계) |
| plan_type | TEXT | NOT NULL, DEFAULT 'Free' | 요금제 ('Free' 또는 'Pro') |
| remaining_tries | INTEGER | NOT NULL, DEFAULT 3 | 남은 분석 횟수 (Free: 최대 3, Pro: 최대 10) |
| billing_key | TEXT | | 토스페이먼츠 빌링키 (암호화 저장 권장) |
| customer_key | TEXT | | 토스페이먼츠 customerKey (= user_id) |
| next_payment_date | DATE | | 다음 정기 결제 예정일 |
| subscribed_at | TIMESTAMPTZ | | Pro 구독 시작 시각 |
| cancellation_scheduled | BOOLEAN | NOT NULL, DEFAULT false | 해지 예약 여부 |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | 레코드 생성 시각 |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | 레코드 수정 시각 (트리거로 자동 갱신) |

**인덱스:**
- PRIMARY KEY: `id`
- UNIQUE INDEX: `user_id`
- INDEX: `next_payment_date` (Cron Job 조회 최적화)
- INDEX: `(plan_type, next_payment_date, cancellation_scheduled)` (Cron Job 복합 조회 최적화)

**제약 조건:**
- CHECK: `plan_type IN ('Free', 'Pro')`
- CHECK: `remaining_tries >= 0`

### 3.3 analyses (사주 분석 내역)

**목적:** 사용자별 사주 분석 요청 및 결과 저장

| 컬럼명 | 타입 | 제약 | 설명 |
|--------|------|------|------|
| id | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | 분석 레코드 고유 ID |
| user_id | TEXT | NOT NULL, FK → users.id | 사용자 ID |
| name | TEXT | NOT NULL | 분석 대상 이름 |
| birth_date | TEXT | NOT NULL | 생년월일 (YYYY-MM-DD 형식) |
| birth_time | TEXT | | 태어난 시간 (HH:MM 형식, '모름' 시 NULL) |
| is_lunar | BOOLEAN | NOT NULL, DEFAULT false | 음력 여부 |
| model_type | TEXT | NOT NULL | 사용한 Gemini 모델 ('flash' 또는 'pro') |
| summary | TEXT | | AI 분석 결과 요약 (모달 표시용) |
| detail | TEXT | NOT NULL | AI 분석 결과 상세 (마크다운 형식) |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | 분석 수행 시각 |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | 레코드 수정 시각 (트리거로 자동 갱신) |

**인덱스:**
- PRIMARY KEY: `id`
- INDEX: `user_id` (사용자별 분석 목록 조회 최적화)
- INDEX: `(user_id, created_at DESC)` (최신순 조회 최적화)

**제약 조건:**
- CHECK: `model_type IN ('flash', 'pro')`

## 4. 관계 다이어그램

```
users (1) ──────< (1) subscriptions
  │
  │
  └──────< (N) analyses
```

**관계 설명:**
- 1명의 사용자는 1개의 구독 상태를 가짐 (1:1)
- 1명의 사용자는 N개의 분석 내역을 가질 수 있음 (1:N)

## 5. 트리거 및 함수

### 5.1 updated_at 자동 갱신 트리거

모든 테이블에 `updated_at` 컬럼이 있으며, 레코드가 수정될 때마다 자동으로 현재 시각으로 갱신됩니다.

```sql
-- 공통 트리거 함수
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 각 테이블에 트리거 적용
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_analyses_updated_at
  BEFORE UPDATE ON analyses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

## 6. 보안 고려사항

### 6.1 RLS (Row Level Security) 비활성화
- 본 프로젝트는 RLS를 사용하지 않음 (CLAUDE.md 가이드라인 준수)
- 모든 접근 제어는 백엔드 API 레이어에서 처리

### 6.2 빌링키 암호화
- `subscriptions.billing_key`는 민감한 결제 정보이므로 암호화 저장 권장
- 백엔드에서 암호화/복호화 처리 (예: AES-256)
- 환경 변수로 암호화 키 관리

### 6.3 외래 키 제약 조건
- `ON DELETE CASCADE`: 사용자 삭제 시 관련 데이터도 함께 삭제
- `subscriptions.user_id` → `users.id` (CASCADE)
- `analyses.user_id` → `users.id` (CASCADE)

## 7. 데이터 정합성 보장

### 7.1 Clerk 웹훅 처리
- `user.created` 이벤트 수신 시 트랜잭션 처리
- `users` 및 `subscriptions` 테이블 동시 생성
- 실패 시 롤백

### 7.2 토스페이먼츠 웹훅 처리
- 웹훅 페이로드를 신뢰하지 않음
- 항상 결제 조회 API로 재검증 ("Source of Truth" 패턴)
- 상태 불일치 방지

### 7.3 정기 결제 Cron Job
- 멱등성(Idempotent) 보장
- 동일한 날짜에 중복 결제 방지
- 결제 실패 시 즉시 구독 해지 처리

## 8. 성능 최적화

### 8.1 인덱스 전략
- 복합 인덱스: Cron Job 조회 최적화
- 단일 인덱스: 단순 조회 최적화
- 정렬 인덱스: 페이지네이션 최적화

### 8.2 파티셔닝 고려사항
- 초기에는 불필요
- `analyses` 테이블이 수백만 건 이상 시 월별 파티셔닝 고려

### 8.3 캐싱 전략
- Clerk의 JWT에 구독 상태 포함 (매번 DB 조회 불필요)
- 분석 목록은 React Query로 클라이언트 캐싱

## 9. 마이그레이션 전략

### 9.1 순서
1. Extension 활성화 (`pgcrypto`)
2. 공통 트리거 함수 생성
3. 테이블 생성 (의존성 순서: users → subscriptions, analyses)
4. 인덱스 생성
5. 트리거 적용
6. RLS 비활성화

### 9.2 롤백 계획
- 각 migration은 idempotent하게 작성 (`IF NOT EXISTS`)
- 롤백 스크립트 별도 관리 불필요 (재실행 가능)

## 10. 체크리스트

### 10.1 PRD 요구사항 충족 여부
- [x] 사용자 인증 (Clerk) 연동
- [x] 구독 상태 관리 (Free/Pro)
- [x] 횟수 제한 (Free: 3회, Pro: 월 10회)
- [x] 빌링키 저장 및 관리
- [x] 정기 결제 처리
- [x] 해지 예약 및 자동 처리
- [x] 사주 분석 내역 저장
- [x] 모델 타입 구분 (Flash/Pro)

### 10.2 Userflow 충족 여부
- [x] 신규 사용자 가입 (플로우 1)
- [x] Free 사용자 분석 (플로우 2, 3)
- [x] Pro 구독 신청 (플로우 4)
- [x] Pro 사용자 분석 (플로우 5, 6)
- [x] 구독 해지 예약 (플로우 7)
- [x] 해지 취소 (플로우 8)
- [x] 정기 결제 (플로우 9)
- [x] 예약 해지 처리 (플로우 10)
- [x] 분석 내역 조회 (플로우 11)
- [x] 상세보기 및 다운로드 (플로우 12)

### 10.3 외부 서비스 연동 데이터
- [x] Clerk: user_id (PK), email, metadata
- [x] 토스페이먼츠: billing_key, customer_key, 결제 이력
- [x] Gemini: model_type (flash/pro), 분석 결과 (summary, detail)
