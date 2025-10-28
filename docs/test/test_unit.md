# 단위 테스트 구현 계획 (TDD 기반)

## 1. 개요

### 목적
본 테스트 계획은 VMC(AI 사주풀이) 프로젝트의 **핵심 비즈니스 로직**에 대한 단위 테스트 전략을 정의합니다. MVP 단계에서 가장 중요한 "**돈과 데이터 손실 방지**"에 집중하여, 빠른 iteration과 안정성을 동시에 확보합니다.

### 범위
- **집중 영역**: 결제, 횟수 차감, 사주 분석 생성 등 핵심 비즈니스 로직
- **제외 영역**: 정적 UI 컴포넌트, 단순 유틸리티 함수, React Query 훅

### TDD 방법론
Red → Green → Refactor 사이클을 준수하며, **실용주의적 접근**을 취합니다:
- **Red**: 가장 단순한 케이스부터 테스트 작성
- **Green**: 최소한의 코드로 테스트 통과
- **Refactor**: 중복 제거 및 코드 개선

---

## 2. 테스트 범위

### 2.1 테스트 대상 (우선순위 기반)

#### P0 (필수): 핵심 비즈니스 로직
> **목표**: 60% 이상 커버리지, 1주 내 완료

| 모듈 | 파일 경로 | 테스트 대상 | 이유 |
|------|----------|-----------|------|
| **분석 생성 서비스** | `src/features/analyses/backend/service.ts` | `createAnalysis()` | 횟수 차감, 트랜잭션 보장 |
| **Gemini API 클라이언트** | `src/backend/lib/external/gemini-client.ts` | `generateAnalysisWithGeminiRetry()` | 재시도 로직, 타임아웃 |
| **Clerk Webhook 핸들러** | `src/features/webhooks/clerk/backend/service.ts` | `handleUserCreated()` | 사용자 생성, 구독 초기화 |
| **결제 서비스** | `src/features/subscription/backend/service.ts` | `createSubscription()`, `cancelSubscription()` | 결제 실패, 빌링키 관리 |

#### P1 (권장): 보안 및 데이터 무결성
> **목표**: 필요 시 추가, MVP 이후

| 모듈 | 파일 경로 | 테스트 대상 | 이유 |
|------|----------|-----------|------|
| **분석 조회 서비스** | `src/features/analyses/backend/service.ts` | `getAnalysisDetail()` | 권한 검증 |
| **Zod 스키마 검증** | `src/features/analyses/backend/schema.ts` | `CreateAnalysisSchema` | 입력값 검증 |

#### P2 (제외): E2E나 수동 테스트로 대체
> MVP 단계에서는 단위 테스트 제외

- 모든 React 컴포넌트 (`src/features/*/components/**`)
- React Query 훅 (`src/features/*/hooks/**`)
- 단순 유틸리티 (`src/lib/utils.ts`)
- 정적 UI (`HeroSection`, `FeatureSection`, `PricingSection`)

### 2.2 테스트 제외 범위 및 사유

| 제외 대상 | 사유 | 대안 |
|----------|------|------|
| **UI 컴포넌트** | 렌더링 테스트는 시간 대비 가치 낮음 | E2E (Playwright) |
| **React Query 훅** | 라이브러리 자체 테스트 | 통합 테스트 |
| **유틸리티 함수** | 외부 라이브러리로 대체 가능 | 코드 리뷰 |
| **정적 페이지** | 변경 빈도 낮음 | 수동 QA |

---

## 3. 테스트 전략

### 3.1 TDD 워크플로우

```
┌─────────────┐
│ 1. RED      │ ← 가장 단순한 케이스 테스트 작성
│ (실패 확인) │    → 테스트 실행 → 실패 확인
└──────┬──────┘
       ↓
┌─────────────┐
│ 2. GREEN    │ ← 최소 코드로 테스트 통과
│ (통과 확인) │    → "Fake it till you make it"
└──────┬──────┘
       ↓
┌─────────────┐
│ 3. REFACTOR │ ← 중복 제거, 네이밍 개선
│ (개선)      │    → 테스트 여전히 통과 확인
└──────┬──────┘
       ↓
     Commit
```

### 3.2 테스트 환경

#### 단위 테스트 프레임워크
- **Vitest**: 빠른 실행 속도, Vite 네이티브 지원
- **설정 파일**: `vitest.config.ts`
  ```typescript
  export default defineConfig({
    plugins: [react()],
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: './vitest.setup.ts',
      testTimeout: 500, // 개별 테스트 500ms 제한
    },
  });
  ```

#### 모킹 라이브러리
- **vi.mock**: Vitest 내장 모킹 함수
- **모킹 대상**:
  - Supabase 클라이언트 (`@/backend/supabase/client`)
  - Gemini API (`@/backend/lib/external/gemini-client`)
  - Clerk 클라이언트 (`@clerk/nextjs`)
  - 토스페이먼츠 API (`axios` 모킹)

### 3.3 데이터 관리

#### 테스트 격리 전략
```typescript
describe('createAnalysis', () => {
  beforeEach(() => {
    // 각 테스트마다 모킹 초기화
    vi.clearAllMocks();
  });

  afterEach(() => {
    // 테스트 후 정리 (필요 시)
    // cleanup();
  });
});
```

#### 테스트 데이터 준비
- **Fixture 사용**: `tests/fixtures/` 디렉토리에 공통 데이터 정의
  ```typescript
  // tests/fixtures/user.ts
  export const mockFreeUser = {
    userId: 'user_123',
    planType: 'Free',
    remainingTries: 3,
  };

  export const mockProUser = {
    userId: 'user_456',
    planType: 'Pro',
    remainingTries: 10,
  };
  ```

---

## 4. 주요 테스트 케이스

### 4.1 분석 생성 서비스 (`createAnalysis`)

**파일**: `src/features/analyses/backend/service.test.ts`

#### Happy Path
| Test Case | 시나리오 | 기대 결과 |
|-----------|---------|----------|
| **TC-001** | Free 사용자 정상 분석 생성 | `remaining_tries: 3 → 2`, `analyses` 테이블 INSERT, 200 OK |
| **TC-002** | Pro 사용자 정상 분석 생성 | `remaining_tries: 10 → 9`, `model_type: 'pro'`, 200 OK |

#### Edge Cases
| Test Case | 시나리오 | 기대 결과 | 전제 조건 |
|-----------|---------|----------|----------|
| **TC-003** | 횟수 소진 (Free) | `403 Forbidden`, `QUOTA_EXCEEDED` 에러, 횟수 차감 없음 | `remaining_tries = 0` |
| **TC-004** | Gemini API 타임아웃 | `503 Service Unavailable`, 횟수 차감 없음, 재시도 로그 기록 | Gemini 응답 30초 초과 |
| **TC-005** | Gemini API 실패 후 횟수 차감 방지 | `remaining_tries` 변동 없음, 트랜잭션 롤백 | Gemini 5xx 에러 |
| **TC-006** | DB 저장 실패 | `500 Internal Server Error`, 횟수 차감 없음 | Supabase INSERT 실패 |

**구현 예시 (AAA 패턴)**:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAnalysis } from './service';
import { createSupabaseServerClient } from '@/backend/supabase/client';
import { generateAnalysisWithGeminiRetry } from '@/backend/lib/external/gemini-client';

// Mock dependencies
vi.mock('@/backend/supabase/client');
vi.mock('@/backend/lib/external/gemini-client');

describe('createAnalysis', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('TC-003: Free 사용자 횟수 소진 시 QUOTA_EXCEEDED 에러 반환', async () => {
    // Arrange: 횟수 0인 Free 사용자
    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { plan_type: 'Free', remaining_tries: 0 },
            }),
          }),
        }),
      }),
    };
    vi.mocked(createSupabaseServerClient).mockReturnValue(mockSupabase as any);

    // Act: 분석 생성 시도
    const result = await createAnalysis({
      userId: 'user_123',
      name: '홍길동',
      birthDate: '1990-01-01',
      isLunar: false,
    });

    // Assert: QUOTA_EXCEEDED 에러 확인
    expect(result.ok).toBe(false);
    expect(result.error.code).toBe('QUOTA_EXCEEDED');
    expect(result.statusCode).toBe(403);

    // Gemini API 호출되지 않음 확인
    expect(generateAnalysisWithGeminiRetry).not.toHaveBeenCalled();
  });

  it('TC-004: Gemini API 타임아웃 시 503 에러 및 횟수 차감 없음', async () => {
    // Arrange: 정상 사용자, Gemini 타임아웃
    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { plan_type: 'Free', remaining_tries: 3 },
            }),
          }),
        }),
        update: vi.fn(), // UPDATE 호출되지 않아야 함
      }),
    };
    vi.mocked(createSupabaseServerClient).mockReturnValue(mockSupabase as any);
    vi.mocked(generateAnalysisWithGeminiRetry).mockRejectedValue(
      new Error('TIMEOUT')
    );

    // Act: 분석 생성 시도
    const result = await createAnalysis({
      userId: 'user_123',
      name: '홍길동',
      birthDate: '1990-01-01',
      isLunar: false,
    });

    // Assert: 503 에러, 횟수 차감 없음
    expect(result.ok).toBe(false);
    expect(result.error.code).toBe('EXTERNAL_SERVICE_ERROR');
    expect(result.statusCode).toBe(503);
    expect(mockSupabase.from).toHaveBeenCalledWith('subscriptions'); // 조회만
    expect(mockSupabase.from).not.toHaveBeenCalledWith('analyses'); // INSERT 안됨
  });
});
```

---

### 4.2 Gemini API 클라이언트 (`generateAnalysisWithGeminiRetry`)

**파일**: `src/backend/lib/external/gemini-client.test.ts`

| Test Case | 시나리오 | 기대 결과 | 전제 조건 |
|-----------|---------|----------|----------|
| **TC-007** | Flash 모델 정상 응답 | 요약 + 상세 텍스트 반환 | 정상 API 응답 |
| **TC-008** | 타임아웃 후 재시도 성공 | 첫 번째 실패, 두 번째 성공, 총 2회 호출 | 첫 번째 30초 초과 |
| **TC-009** | 최대 재시도 초과 | `GEMINI_TIMEOUT` 에러 발생 | 3회 모두 실패 |
| **TC-010** | 지수 백오프 확인 | 재시도 간 1초, 2초, 4초 지연 확인 | - |

**구현 예시**:
```typescript
it('TC-008: 타임아웃 후 재시도하여 성공', async () => {
  // Arrange: 첫 번째 실패, 두 번째 성공
  const mockGemini = {
    generateContent: vi
      .fn()
      .mockRejectedValueOnce(new Error('TIMEOUT')) // 첫 번째 호출
      .mockResolvedValueOnce({ text: '분석 결과' }), // 두 번째 호출
  };
  vi.mocked(GoogleGenerativeAI).mockReturnValue({ getGenerativeModel: () => mockGemini } as any);

  // Act: 재시도 포함 호출
  const result = await generateAnalysisWithGeminiRetry({
    name: '홍길동',
    birthDate: '1990-01-01',
    modelType: 'flash',
  });

  // Assert: 성공 결과 반환, 총 2회 호출
  expect(result).toBe('분석 결과');
  expect(mockGemini.generateContent).toHaveBeenCalledTimes(2);
});
```

---

### 4.3 Clerk Webhook 핸들러 (`handleUserCreated`)

**파일**: `src/features/webhooks/clerk/backend/service.test.ts`

| Test Case | 시나리오 | 기대 결과 | 전제 조건 |
|-----------|---------|----------|----------|
| **TC-011** | user.created 이벤트 정상 처리 | `users` INSERT, `subscriptions` INSERT (Free, 3회), 200 OK | 유효한 Webhook |
| **TC-012** | 중복 이벤트 멱등성 보장 | 두 번째 요청 시 409 Conflict, DB 변경 없음 | 동일한 `userId` 재전송 |
| **TC-013** | Webhook 시그니처 검증 실패 | `401 Unauthorized`, DB 변경 없음 | 잘못된 시그니처 |
| **TC-014** | DB 트랜잭션 실패 | `500 Server Error`, 부분 저장 방지 (롤백) | Supabase 오류 |

---

### 4.4 결제 서비스 (`createSubscription`)

**파일**: `src/features/subscription/backend/service.test.ts`

| Test Case | 시나리오 | 기대 결과 | 전제 조건 |
|-----------|---------|----------|----------|
| **TC-015** | Pro 구독 신청 성공 | 빌링키 저장, `plan_type: 'Pro'`, `remaining_tries: 10`, 200 OK | 토스 결제 성공 |
| **TC-016** | 첫 결제 실패 시 빌링키 미저장 | `402 Payment Required`, 빌링키 DB 저장 안됨 | 토스 결제 실패 |
| **TC-017** | 결제 성공, DB 실패 (Critical) | `500 Server Error`, 관리자 알림 로그 기록 | DB UPDATE 실패 |
| **TC-018** | 구독 해지 시 빌링키 삭제 | `billing_key: null`, `plan_type: 'Free'` | 해지 예약 상태 |

---

## 5. 테스트 커버리지 목표

### 5.1 측정 방법
- **도구**: Vitest Coverage (`vitest --coverage`)
- **기준**: Line Coverage (라인 커버리지)
- **실행 명령어**: `npm run test:unit -- --coverage`

### 5.2 목표 달성 전략

| 우선순위 | 모듈 | 목표 커버리지 | 달성 방법 |
|---------|------|-------------|----------|
| **P0** | `analyses/backend/service.ts` | 70% | Happy Path + 핵심 Edge Cases (횟수 소진, API 실패) |
| **P0** | `gemini-client.ts` | 65% | 재시도 로직, 타임아웃, 에러 처리 |
| **P0** | `webhooks/clerk/backend/service.ts` | 65% | 멱등성, 시그니처 검증, 트랜잭션 |
| **P1** | `subscription/backend/service.ts` | 60% | 결제 실패, DB 실패 시나리오 |

### 5.3 커버리지 검증 자동화
```json
// package.json
{
  "scripts": {
    "test:unit": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:threshold": "vitest run --coverage --coverage.lines=60"
  }
}
```

---

## 6. 일정 및 리소스

### 6.1 실행 계획 (1주 완료)

| 단계 | 일정 | 작업 내용 | 산출물 |
|------|------|----------|--------|
| **Day 1-2** | Mon-Tue | Gemini API 클라이언트 테스트 (TC-007 ~ TC-010) | `gemini-client.test.ts` |
| **Day 3-4** | Wed-Thu | 분석 생성 서비스 테스트 (TC-001 ~ TC-006) | `service.test.ts` |
| **Day 5** | Fri | Webhook 핸들러 테스트 (TC-011 ~ TC-014) | `webhooks/service.test.ts` |
| **Day 6** | Sat | 결제 서비스 테스트 (TC-015 ~ TC-018) | `subscription/service.test.ts` |
| **Day 7** | Sun | 커버리지 확인 및 문서화 | 커버리지 리포트 |

### 6.2 리소스 계획
- **담당자**: 시니어 개발자 1명
- **리뷰어**: CTO (최종 승인)
- **도구**: Vitest, VS Code, GitHub Actions

---

## 7. 리스크 및 완화 방안

### 7.1 리스크 식별

| 리스크 ID | 리스크 내용 | 영향도 | 발생 가능성 |
|----------|-----------|-------|-----------|
| **R-001** | Supabase 모킹 복잡도 증가 | 중 | 높음 |
| **R-002** | Gemini API 실제 환경과 괴리 | 중 | 중 |
| **R-003** | 테스트 작성 시간 부족 | 높음 | 중 |
| **R-004** | 테스트 유지보수 비용 증가 | 중 | 높음 |

### 7.2 완화 전략

| 리스크 ID | 완화 방안 |
|----------|----------|
| **R-001** | Supabase 클라이언트를 얇은 래퍼로 분리, 순수 비즈니스 로직만 테스트 |
| **R-002** | 통합 테스트는 Supabase Local 환경 활용, 단위 테스트는 모킹 최소화 |
| **R-003** | P0만 1주 내 완료, P1은 MVP 이후로 연기, P2는 E2E로 대체 |
| **R-004** | 핵심 로직만 테스트, UI 컴포넌트 제외, 리팩토링 시 테스트도 함께 업데이트 |

### 7.3 비상 계획
- **1주 내 미완료 시**: P0 중 가장 중요한 TC-003 (횟수 소진), TC-004 (API 타임아웃)만 완료 후 베타 출시
- **테스트 실패 누적 시**: 해당 기능 롤백 또는 수동 QA로 대체

---

## 8. 성공 지표

### 8.1 정량적 지표
- [ ] P0 모듈 60% 이상 커버리지 달성
- [ ] 모든 테스트 500ms 이내 완료
- [ ] 테스트 실패율 0% 유지

### 8.2 정성적 지표
- [ ] 각 테스트가 하나의 시나리오만 검증 (Single Responsibility)
- [ ] 테스트 이름이 명확 (Given-When-Then 형식)
- [ ] 모킹이 최소화되고 적절하게 사용됨
- [ ] TDD 사이클(Red-Green-Refactor)이 핵심 기능에 적용됨

---

## 9. 참고 자료

### 9.1 내부 문서
- [테스트 환경 설정](./../test/test_plan.md)
- [사용자 플로우](./../userflow.md)
- [TDD 프로세스 가이드라인](./../../.ruler/tdd.md)
- [Usecase 002: Free 사용자 분석](./../usecases/002/spec.md)
- [Usecase 003: 횟수 소진](./../usecases/003/spec.md)
- [Usecase 004: Pro 구독](./../usecases/004/spec.md)

### 9.2 외부 참고
- [Vitest 공식 문서](https://vitest.dev/)
- [Testing Trophy (Kent C. Dodds)](https://kentcdodds.com/blog/the-testing-trophy-and-testing-classifications)
- [Test Pyramid (Martin Fowler)](https://martinfowler.com/articles/practical-test-pyramid.html)

---

## 10. 부록: 테스트 템플릿

### 10.1 서비스 함수 테스트 템플릿
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { functionName } from './service';

// Mock dependencies
vi.mock('./dependency', () => ({
  dependencyFunction: vi.fn(),
}));

describe('functionName', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('TC-XXX: [시나리오 설명]', async () => {
    // Arrange: 테스트 데이터 및 모킹 설정
    const input = { /* ... */ };
    const expected = { /* ... */ };
    vi.mocked(dependencyFunction).mockResolvedValue(/* ... */);

    // Act: 테스트 대상 실행
    const result = await functionName(input);

    // Assert: 결과 검증
    expect(result).toEqual(expected);
    expect(dependencyFunction).toHaveBeenCalledWith(/* ... */);
  });

  it('TC-XXX: [에러 케이스 설명]', async () => {
    // Arrange: 에러 상황 모킹
    const input = { /* ... */ };
    vi.mocked(dependencyFunction).mockRejectedValue(new Error('Test error'));

    // Act: 테스트 대상 실행
    const result = await functionName(input);

    // Assert: 에러 처리 확인
    expect(result.ok).toBe(false);
    expect(result.error.code).toBe('ERROR_CODE');
  });
});
```

### 10.2 Fixture 정의 템플릿
```typescript
// tests/fixtures/user.ts
export const mockFreeUser = {
  userId: 'user_free_123',
  planType: 'Free' as const,
  remainingTries: 3,
  billingKey: null,
  nextPaymentDate: null,
};

export const mockProUser = {
  userId: 'user_pro_456',
  planType: 'Pro' as const,
  remainingTries: 10,
  billingKey: 'encrypted_key_789',
  nextPaymentDate: '2025-11-25',
};

export const mockAnalysisRequest = {
  name: '홍길동',
  birthDate: '1990-01-01',
  birthTime: null,
  isLunar: false,
};
```

---

## 변경 이력

| 날짜 | 버전 | 변경 내용 |
|------|------|-----------|
| 2025-01-28 | 1.0.0 | 초안 작성 |
| 2025-01-28 | 2.0.0 | CTO 리뷰 반영: MVP 중심 단순화, UI 테스트 제외, 1주 완료 목표 |
