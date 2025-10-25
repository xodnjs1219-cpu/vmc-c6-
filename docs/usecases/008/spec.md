# UC-008: 구독 해지 취소

## 1. 개요

### 1.1 목적
Pro 구독을 해지 예약한 사용자가 다음 결제일 전까지 해지를 취소하고 구독을 계속 유지할 수 있도록 하는 기능입니다.

### 1.2 범위
- 해지 예약 상태인 사용자의 구독 재활성화
- 정기 결제 대상 복원
- 구독 관리 페이지 UI 상태 전환

### 1.3 참조
- PRD: [해지 정책](../prd.md#3-포함-페이지)
- Userflow: [유저플로우 8번 - 구독 해지 취소](../userflow.md#8-구독-해지-취소)
- Database: [subscriptions 테이블](../database.md#32-subscriptions-구독-상태-관리)

## 2. 사전 조건 (Preconditions)

1. **사용자 인증**: 사용자가 Clerk을 통해 인증된 상태여야 합니다.
2. **구독 상태**: 사용자의 구독이 다음 조건을 모두 만족해야 합니다.
   - `plan_type` = `'Pro'`
   - `cancellation_scheduled` = `true` (해지 예약 상태)
   - `next_payment_date` > 현재 날짜 (결제일이 아직 도래하지 않음)
3. **빌링키 존재**: `billing_key`가 NULL이 아니어야 합니다.

## 3. 사후 조건 (Postconditions)

1. **구독 상태 갱신**:
   - `subscriptions.cancellation_scheduled` = `false`
2. **정기 결제 복원**: 해당 사용자가 다음 결제일에 정기 결제 대상에 포함됩니다.
3. **UI 변경**: 구독 관리 페이지에서 '해지 취소' 버튼이 '해지하기' 버튼으로 변경됩니다.

## 4. 액터 (Actors)

- **Primary Actor**: Pro 구독자 (해지 예약 상태)
- **Secondary Actor**: Hono Backend API

## 5. 주요 플로우 (Main Flow)

### 5.1 사용자 액션
```
[사용자]
  → /subscription 페이지 접근
  → '해지 취소' 버튼 표시 확인
  → '해지 취소' 버튼 클릭
```

### 5.2 시스템 처리
```
[프론트엔드]
  → Hono API 호출: POST /api/subscriptions/reactivate
     Headers: { Authorization: Bearer {Clerk JWT} }
     Body: {}

[Hono Backend]
  1. 인증 미들웨어: Clerk JWT 검증 → userId 추출
  2. Service Layer 호출: reactivateSubscription(userId)

[Service Layer]
  3. Supabase 조회:
     SELECT * FROM subscriptions
     WHERE user_id = :userId

  4. 비즈니스 룰 검증:
     - plan_type이 'Pro'인가?
     - cancellation_scheduled이 true인가?
     - next_payment_date > 현재 날짜인가?

  5. (검증 통과) Supabase 업데이트:
     UPDATE subscriptions
     SET cancellation_scheduled = false,
         updated_at = now()
     WHERE user_id = :userId

  6. 성공 응답 반환

[Hono Backend → 프론트엔드]
  Response: 200 OK
  {
    "success": true,
    "data": {
      "subscription": {
        "planType": "Pro",
        "remainingTries": 7,
        "nextPaymentDate": "2025-11-25",
        "cancellationScheduled": false
      }
    }
  }

[프론트엔드]
  7. UI 갱신:
     - 해지 예약 안내 메시지 제거
     - '해지 취소' 버튼 → '해지하기' 버튼으로 변경
     - "구독이 다시 활성화되었습니다." 토스트 메시지 표시
```

## 6. 대체 플로우 (Alternative Flows)

### 6.1 AF-1: 해지 예약 상태가 아닌 경우
```
[Service Layer - Step 4]
  → cancellation_scheduled이 false인 경우 감지

[Hono Backend → 프론트엔드]
  Response: 409 Conflict
  {
    "success": false,
    "error": {
      "code": "NOT_SCHEDULED_FOR_CANCELLATION",
      "message": "해지 예약된 구독이 아닙니다."
    }
  }

[프론트엔드]
  → "이미 활성 상태인 구독입니다." 토스트 메시지 표시
  → 페이지 새로고침하여 최신 상태 반영
```

### 6.2 AF-2: Pro 구독이 아닌 경우
```
[Service Layer - Step 4]
  → plan_type이 'Pro'가 아닌 경우 감지

[Hono Backend → 프론트엔드]
  Response: 403 Forbidden
  {
    "success": false,
    "error": {
      "code": "NOT_PRO_SUBSCRIBER",
      "message": "Pro 구독 상태가 아닙니다."
    }
  }

[프론트엔드]
  → "/subscription" 페이지로 리디렉션
  → "구독 상태를 확인할 수 없습니다." 토스트 메시지 표시
```

### 6.3 AF-3: 구독 정보가 존재하지 않는 경우
```
[Service Layer - Step 3]
  → Supabase 조회 결과가 NULL인 경우

[Hono Backend → 프론트엔드]
  Response: 404 Not Found
  {
    "success": false,
    "error": {
      "code": "SUBSCRIPTION_NOT_FOUND",
      "message": "구독 정보를 찾을 수 없습니다."
    }
  }

[프론트엔드]
  → "구독 정보를 찾을 수 없습니다. 고객 지원팀에 문의해주세요." 모달 표시
```

### 6.4 AF-4: 데이터베이스 업데이트 실패
```
[Service Layer - Step 5]
  → Supabase UPDATE 쿼리 실행 중 오류 발생

[Service Layer]
  → 오류 로깅: logger.error("Failed to reactivate subscription", { userId, error })

[Hono Backend → 프론트엔드]
  Response: 500 Internal Server Error
  {
    "success": false,
    "error": {
      "code": "DATABASE_ERROR",
      "message": "구독 재활성화에 실패했습니다. 잠시 후 다시 시도해주세요."
    }
  }

[프론트엔드]
  → "일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요." 토스트 메시지 표시
```

### 6.5 AF-5: 인증 실패
```
[Hono Backend - Step 1]
  → Clerk JWT 검증 실패 또는 JWT 누락

[Hono Backend → 프론트엔드]
  Response: 401 Unauthorized
  {
    "success": false,
    "error": {
      "code": "UNAUTHORIZED",
      "message": "인증이 필요합니다."
    }
  }

[프론트엔드]
  → "/sign-in" 페이지로 리디렉션
```

## 7. 예외 플로우 (Exception Flows)

### 7.1 EF-1: 결제일이 이미 지난 경우
```
시나리오: 사용자가 결제일(02:00) 이후에 해지 취소를 시도하는 경우

[Service Layer - Step 4]
  → next_payment_date <= 현재 날짜 감지
  → 이미 Cron Job에 의해 해지 처리가 완료되었을 가능성

[Service Layer]
  → Supabase 재조회로 최신 상태 확인

  Case 1: 이미 Free로 전환됨
    → 404 NOT_FOUND 반환 (AF-3와 동일 처리)

  Case 2: 아직 Pro 상태 유지 (Cron 미실행)
    → 정상적으로 해지 취소 처리
    → 다만, 경고 로그 기록: "Reactivation attempted after payment date"
```

### 7.2 EF-2: 동시성 문제 (Race Condition)
```
시나리오: 사용자가 해지 취소 버튼을 연속으로 빠르게 클릭하는 경우

[Hono Backend]
  → Optimistic Locking 또는 Transaction 사용

[Service Layer - Step 5]
  → UPDATE 쿼리에 WHERE 조건 추가:
    WHERE user_id = :userId
      AND cancellation_scheduled = true
      AND updated_at = :previousUpdatedAt

  → affected_rows가 0인 경우:
    → 이미 다른 요청에 의해 처리됨
    → 최신 데이터를 재조회하여 반환
    → 200 OK 응답 (멱등성 보장)
```

## 8. 비즈니스 룰 (Business Rules)

### 8.1 BR-1: 해지 취소 가능 기간
- 해지 취소는 다음 결제일 00:00 이전까지만 가능합니다.
- 결제일 02:00에 Cron Job이 실행되므로, 사실상 결제일 당일 자정부터는 취소가 불가능합니다.

### 8.2 BR-2: 잔여 혜택 유지
- 해지 취소 시 현재 `remaining_tries`는 변경되지 않습니다.
- 다음 결제일에 정기 결제가 성공하면 `remaining_tries`가 10으로 리셋됩니다.

### 8.3 BR-3: 빌링키 유지
- 해지 예약 상태에서는 빌링키가 삭제되지 않습니다.
- 따라서 해지 취소 시 별도의 카드 재등록 절차가 필요하지 않습니다.

### 8.4 BR-4: 외부 서비스 연동 불필요
- 이 기능은 토스페이먼츠 API 호출을 필요로 하지 않습니다.
- 순수하게 내부 DB 상태만 변경합니다.

### 8.5 BR-5: 멱등성 보장
- 동일한 요청을 여러 번 실행해도 결과가 동일해야 합니다.
- 이미 활성 상태인 구독에 대한 재활성화 요청은 성공 응답을 반환합니다.

## 9. 데이터 모델

### 9.1 입력 데이터
**HTTP Request**
```http
POST /api/subscriptions/reactivate HTTP/1.1
Host: api.example.com
Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{}
```

### 9.2 출력 데이터

**성공 응답 (200 OK)**
```json
{
  "success": true,
  "data": {
    "subscription": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "userId": "user_2abc123def456",
      "planType": "Pro",
      "remainingTries": 7,
      "nextPaymentDate": "2025-11-25",
      "subscribedAt": "2025-10-25T03:00:00Z",
      "cancellationScheduled": false,
      "updatedAt": "2025-10-25T14:30:00Z"
    }
  }
}
```

**실패 응답 예시**
```json
{
  "success": false,
  "error": {
    "code": "NOT_SCHEDULED_FOR_CANCELLATION",
    "message": "해지 예약된 구독이 아닙니다.",
    "details": {
      "currentStatus": {
        "planType": "Pro",
        "cancellationScheduled": false
      }
    }
  }
}
```

### 9.3 데이터베이스 변경

**Before**
```sql
SELECT * FROM subscriptions WHERE user_id = 'user_2abc123def456';

| id   | user_id            | plan_type | remaining_tries | cancellation_scheduled | next_payment_date |
|------|--------------------|-----------|-----------------|------------------------|-------------------|
| uuid | user_2abc123def456 | Pro       | 7               | true                   | 2025-11-25        |
```

**After**
```sql
SELECT * FROM subscriptions WHERE user_id = 'user_2abc123def456';

| id   | user_id            | plan_type | remaining_tries | cancellation_scheduled | next_payment_date |
|------|--------------------|-----------|-----------------|------------------------|-------------------|
| uuid | user_2abc123def456 | Pro       | 7               | false                  | 2025-11-25        |
```

## 10. API 명세 (Hono Backend)

### 10.1 라우터 정의
**파일**: `src/features/subscription/backend/route.ts`

```typescript
import { Hono } from 'hono';
import { AppEnv } from '@/backend/hono/context';
import { reactivateSubscriptionHandler } from './handlers';
import { requireAuth } from '@/backend/middleware/auth';

export function registerSubscriptionRoutes(app: Hono<AppEnv>) {
  const subscriptionRoutes = new Hono<AppEnv>();

  // 구독 해지 취소
  subscriptionRoutes.post(
    '/reactivate',
    requireAuth, // Clerk JWT 검증 미들웨어
    reactivateSubscriptionHandler
  );

  app.route('/api/subscriptions', subscriptionRoutes);
}
```

### 10.2 핸들러 구현
**파일**: `src/features/subscription/backend/handlers.ts`

```typescript
import { Context } from 'hono';
import { AppEnv } from '@/backend/hono/context';
import { respond, success, failure } from '@/backend/http/response';
import { reactivateSubscription } from './service';
import { SubscriptionErrorCode } from './error';

export async function reactivateSubscriptionHandler(c: Context<AppEnv>) {
  const userId = c.get('userId'); // requireAuth 미들웨어에서 주입
  const logger = c.get('logger');

  try {
    const result = await reactivateSubscription(c, userId);

    if (!result.success) {
      return respond(c, failure(result.errorCode, result.message, result.details));
    }

    logger.info('Subscription reactivated', { userId });
    return respond(c, success(result.data));

  } catch (error) {
    logger.error('Reactivate subscription handler error', { userId, error });
    return respond(
      c,
      failure(SubscriptionErrorCode.INTERNAL_ERROR, '구독 재활성화에 실패했습니다.')
    );
  }
}
```

### 10.3 서비스 레이어
**파일**: `src/features/subscription/backend/service.ts`

```typescript
import { Context } from 'hono';
import { AppEnv } from '@/backend/hono/context';
import { SubscriptionErrorCode } from './error';

export async function reactivateSubscription(c: Context<AppEnv>, userId: string) {
  const supabase = c.get('supabase');

  // 1. 현재 구독 상태 조회
  const { data: subscription, error: fetchError } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (fetchError || !subscription) {
    return {
      success: false,
      errorCode: SubscriptionErrorCode.NOT_FOUND,
      message: '구독 정보를 찾을 수 없습니다.'
    };
  }

  // 2. 비즈니스 룰 검증
  if (subscription.plan_type !== 'Pro') {
    return {
      success: false,
      errorCode: SubscriptionErrorCode.NOT_PRO_SUBSCRIBER,
      message: 'Pro 구독 상태가 아닙니다.'
    };
  }

  if (!subscription.cancellation_scheduled) {
    return {
      success: false,
      errorCode: SubscriptionErrorCode.NOT_SCHEDULED_FOR_CANCELLATION,
      message: '해지 예약된 구독이 아닙니다.',
      details: {
        currentStatus: {
          planType: subscription.plan_type,
          cancellationScheduled: false
        }
      }
    };
  }

  // 3. 해지 취소 처리
  const { data: updated, error: updateError } = await supabase
    .from('subscriptions')
    .update({
      cancellation_scheduled: false,
      updated_at: new Date().toISOString()
    })
    .eq('user_id', userId)
    .eq('cancellation_scheduled', true) // Optimistic locking
    .select()
    .single();

  if (updateError) {
    return {
      success: false,
      errorCode: SubscriptionErrorCode.DATABASE_ERROR,
      message: '구독 재활성화에 실패했습니다.'
    };
  }

  // 4. 성공 응답
  return {
    success: true,
    data: {
      subscription: {
        id: updated.id,
        userId: updated.user_id,
        planType: updated.plan_type,
        remainingTries: updated.remaining_tries,
        nextPaymentDate: updated.next_payment_date,
        subscribedAt: updated.subscribed_at,
        cancellationScheduled: updated.cancellation_scheduled,
        updatedAt: updated.updated_at
      }
    }
  };
}
```

### 10.4 에러 코드 정의
**파일**: `src/features/subscription/backend/error.ts`

```typescript
export enum SubscriptionErrorCode {
  NOT_FOUND = 'SUBSCRIPTION_NOT_FOUND',
  NOT_PRO_SUBSCRIBER = 'NOT_PRO_SUBSCRIBER',
  NOT_SCHEDULED_FOR_CANCELLATION = 'NOT_SCHEDULED_FOR_CANCELLATION',
  DATABASE_ERROR = 'DATABASE_ERROR',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}
```

## 11. 시퀀스 다이어그램

```mermaid
sequenceDiagram
    actor User as 사용자
    participant FE as 프론트엔드<br/>/subscription
    participant API as Hono API<br/>/api/subscriptions/reactivate
    participant Auth as Clerk JWT<br/>미들웨어
    participant Service as Service Layer
    participant DB as Supabase<br/>subscriptions

    User->>FE: '해지 취소' 버튼 클릭
    FE->>API: POST /api/subscriptions/reactivate<br/>Authorization: Bearer {JWT}

    API->>Auth: JWT 검증
    Auth-->>API: userId 추출

    API->>Service: reactivateSubscription(userId)

    Service->>DB: SELECT * FROM subscriptions<br/>WHERE user_id = :userId
    DB-->>Service: subscription 데이터 반환

    alt 구독 정보 없음
        Service-->>API: NOT_FOUND 에러
        API-->>FE: 404 Not Found
        FE-->>User: "구독 정보를 찾을 수 없습니다."
    else Pro 구독이 아님
        Service-->>API: NOT_PRO_SUBSCRIBER 에러
        API-->>FE: 403 Forbidden
        FE-->>User: "/subscription"으로 리디렉션
    else 해지 예약 상태가 아님
        Service-->>API: NOT_SCHEDULED_FOR_CANCELLATION 에러
        API-->>FE: 409 Conflict
        FE-->>User: "이미 활성 상태인 구독입니다."
    else 정상 처리
        Service->>DB: UPDATE subscriptions<br/>SET cancellation_scheduled = false<br/>WHERE user_id = :userId
        DB-->>Service: 업데이트 완료
        Service-->>API: success + subscription 데이터
        API-->>FE: 200 OK + subscription
        FE->>FE: UI 갱신<br/>('해지 취소' → '해지하기')
        FE-->>User: "구독이 다시 활성화되었습니다."
    end
```

## 12. 테스트 시나리오

### 12.1 정상 시나리오

**TC-001: 해지 예약 상태에서 성공적으로 취소**
```
Given:
  - userId = "user_123"
  - subscriptions 테이블:
    - plan_type = 'Pro'
    - cancellation_scheduled = true
    - next_payment_date = '2025-11-25' (미래 날짜)

When:
  - POST /api/subscriptions/reactivate
  - Authorization: Bearer {valid_jwt_for_user_123}

Then:
  - HTTP Status: 200 OK
  - subscriptions.cancellation_scheduled = false
  - Response.data.subscription.cancellationScheduled = false
```

### 12.2 예외 시나리오

**TC-002: 해지 예약 상태가 아닌 경우**
```
Given:
  - subscriptions.cancellation_scheduled = false

When:
  - POST /api/subscriptions/reactivate

Then:
  - HTTP Status: 409 Conflict
  - Response.error.code = "NOT_SCHEDULED_FOR_CANCELLATION"
```

**TC-003: Free 사용자가 요청하는 경우**
```
Given:
  - subscriptions.plan_type = 'Free'

When:
  - POST /api/subscriptions/reactivate

Then:
  - HTTP Status: 403 Forbidden
  - Response.error.code = "NOT_PRO_SUBSCRIBER"
```

**TC-004: 구독 정보가 없는 경우**
```
Given:
  - subscriptions 테이블에 해당 user_id 레코드 없음

When:
  - POST /api/subscriptions/reactivate

Then:
  - HTTP Status: 404 Not Found
  - Response.error.code = "SUBSCRIPTION_NOT_FOUND"
```

**TC-005: 인증되지 않은 요청**
```
Given:
  - Authorization 헤더 없음 또는 유효하지 않은 JWT

When:
  - POST /api/subscriptions/reactivate

Then:
  - HTTP Status: 401 Unauthorized
  - Response.error.code = "UNAUTHORIZED"
```

### 12.3 동시성 테스트

**TC-006: 동시에 두 번 요청하는 경우 (멱등성)**
```
Given:
  - subscriptions.cancellation_scheduled = true

When:
  - Request 1: POST /api/subscriptions/reactivate (t=0ms)
  - Request 2: POST /api/subscriptions/reactivate (t=5ms)

Then:
  - Request 1: 200 OK, cancellation_scheduled → false
  - Request 2: 409 Conflict (이미 활성 상태) 또는 200 OK (멱등성 보장)
  - DB: 최종적으로 cancellation_scheduled = false (한 번만 업데이트)
```

## 13. 비기능적 요구사항

### 13.1 성능
- API 응답 시간: 평균 200ms 이내
- 데이터베이스 쿼리: SELECT 1회 + UPDATE 1회 (총 2회)

### 13.2 보안
- Clerk JWT 인증 필수
- 타 사용자의 구독 취소 불가 (userId 기반 접근 제어)
- SQL Injection 방지 (Supabase 파라미터 바인딩)

### 13.3 가용성
- 데이터베이스 오류 시 500 에러 반환 및 재시도 권장
- 로깅: 모든 실패 케이스에 대한 상세 로그 기록

### 13.4 모니터링
- 로그 필드:
  - `userId`: 요청한 사용자 ID
  - `action`: "reactivate_subscription"
  - `result`: "success" | "failure"
  - `errorCode`: 실패 시 에러 코드
  - `duration`: API 처리 시간 (ms)

## 14. 향후 고려사항

### 14.1 알림 기능
- 해지 취소 성공 시 사용자에게 이메일 알림 발송
- "구독이 다시 활성화되었습니다. 다음 결제일: YYYY-MM-DD" 내용 포함

### 14.2 감사 로그
- 구독 상태 변경 이력을 별도 테이블에 기록
- 해지 예약 → 활성화 전환 기록 보존

### 14.3 UX 개선
- 해지 취소 전 확인 모달 추가
- "정말 구독을 다시 활성화하시겠습니까?" 메시지 표시

## 15. 의존성

### 15.1 내부 의존성
- `@/backend/hono/context`: Hono 앱 컨텍스트
- `@/backend/middleware/auth`: Clerk JWT 인증 미들웨어
- `@/backend/http/response`: 공통 응답 포맷 헬퍼

### 15.2 외부 의존성
- **Clerk**: 사용자 인증 및 JWT 검증
- **Supabase**: subscriptions 테이블 읽기/쓰기

### 15.3 데이터베이스 스키마 의존성
```sql
-- 필수 컬럼
subscriptions.user_id (TEXT, FK)
subscriptions.plan_type (TEXT, CHECK IN ('Free', 'Pro'))
subscriptions.cancellation_scheduled (BOOLEAN, NOT NULL, DEFAULT false)
subscriptions.next_payment_date (DATE)
subscriptions.updated_at (TIMESTAMPTZ, NOT NULL)
```

## 16. 체크리스트

### 16.1 기능 구현
- [ ] Hono 라우터 등록 (`/api/subscriptions/reactivate`)
- [ ] Clerk JWT 인증 미들웨어 적용
- [ ] Service Layer 비즈니스 로직 구현
- [ ] 에러 코드 정의 및 처리
- [ ] 프론트엔드 API 클라이언트 함수 작성
- [ ] UI 상태 전환 로직 구현

### 16.2 테스트
- [ ] 단위 테스트: Service Layer 비즈니스 룰 검증
- [ ] 통합 테스트: API 엔드포인트 E2E 테스트
- [ ] 동시성 테스트: Race Condition 검증
- [ ] 수동 테스트: UI 플로우 확인

### 16.3 문서화
- [x] API 명세 작성
- [x] 시퀀스 다이어그램 작성
- [x] 에러 코드 문서화
- [ ] 프론트엔드 컴포넌트 Props 인터페이스 정의

### 16.4 배포 전 확인사항
- [ ] 환경 변수 설정 확인
- [ ] 데이터베이스 마이그레이션 적용
- [ ] 로그 모니터링 설정
- [ ] Sentry 에러 추적 연동

---

**문서 버전**: 1.0
**작성일**: 2025-10-25
**최종 수정일**: 2025-10-25
**작성자**: Claude Code (AI)
