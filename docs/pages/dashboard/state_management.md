# 대시보드 페이지 상태 관리 설계 (Level 2)

## 1. 페이지 개요

**페이지 경로:** `/dashboard`

**주요 기능:**
- 사용자의 과거 사주 분석 내역을 리스트 형태로 표시
- 페이지네이션 (페이지당 10개 항목)
- 최신순 정렬 (created_at DESC)
- 로딩 상태 표시
- 에러 처리
- 각 항목 클릭 시 상세보기 페이지로 이동
- '새 분석하기', '구독 관리' CTA 버튼

**참조 문서:**
- `/docs/prd.md` - 3. 포함 페이지 > 대시보드
- `/docs/userflow.md` - 11. 분석 내역 조회
- `/docs/usecases/011/spec.md` - 분석 내역 조회 상세 명세
- `/docs/database.md` - analyses 테이블 스키마

---

## 2. State Data Identification

### 2.1 관리해야 할 상태 데이터

| 상태 이름 | 타입 | 초기값 | 설명 |
|----------|------|--------|------|
| `analyses` | `Analysis[]` | `[]` | 현재 페이지의 분석 내역 목록 (최대 10개) |
| `currentPage` | `number` | `1` | 현재 페이지 번호 |
| `totalPages` | `number` | `0` | 전체 페이지 수 |
| `totalCount` | `number` | `0` | 전체 분석 내역 개수 |
| `isLoading` | `boolean` | `true` | 데이터 로딩 중 여부 |
| `error` | `string \| null` | `null` | 에러 메시지 (발생 시) |

**Analysis 타입 정의:**
```typescript
interface Analysis {
  id: string;              // UUID
  name: string;            // 분석 대상 이름
  birth_date: string;      // 생년월일 (YYYY-MM-DD)
  birth_time: string | null; // 태어난 시간 (HH:MM) 또는 null
  is_lunar: boolean;       // 음력 여부
  model_type: 'flash' | 'pro'; // 사용된 모델
  created_at: string;      // 분석 수행 시각 (ISO 8601)
}
```

### 2.2 화면에 표시되지만 상태가 아닌 데이터

| 데이터 | 출처 | 설명 |
|--------|------|------|
| `userId` | Clerk 세션 | 현재 로그인한 사용자 ID (API 요청 시 사용) |
| `hasNextPage` | 계산값 | `currentPage < totalPages` |
| `hasPrevPage` | 계산값 | `currentPage > 1` |
| `isEmpty` | 계산값 | `!isLoading && totalCount === 0` |
| `pageNumbers` | 계산값 | 페이지네이션 UI에 표시할 페이지 번호 배열 |

---

## 3. State Transition Table

### 3.1 상태 변경 조건 및 화면 변화

| 현재 상태 | 이벤트 (Action) | 다음 상태 | 화면 변화 |
|----------|----------------|----------|----------|
| `isLoading: false` | 페이지 마운트 | `isLoading: true` | 로딩 스피너 표시 |
| `isLoading: true` | API 응답 성공 (0건) | `isLoading: false`<br>`analyses: []`<br>`totalCount: 0`<br>`totalPages: 0` | "아직 분석한 내역이 없습니다." 메시지 표시<br>'새 분석하기' CTA 강조 |
| `isLoading: true` | API 응답 성공 (1건 이상) | `isLoading: false`<br>`analyses: [...데이터]`<br>`totalCount: N`<br>`totalPages: Math.ceil(N/10)` | 분석 내역 목록 카드 표시<br>페이지네이션 UI 표시 (11건 이상인 경우) |
| `isLoading: true` | API 응답 실패 | `isLoading: false`<br>`error: "에러 메시지"` | 에러 메시지 표시<br>"다시 시도" 버튼 표시 |
| `currentPage: 1` | "다음" 버튼 클릭 | `currentPage: 2`<br>`isLoading: true` | 로딩 스피너 표시<br>새 페이지 데이터 로드 |
| `currentPage: 2` | "이전" 버튼 클릭 | `currentPage: 1`<br>`isLoading: true` | 로딩 스피너 표시<br>이전 페이지 데이터 로드 |
| `currentPage: N` | 페이지 번호 클릭 | `currentPage: M`<br>`isLoading: true` | 로딩 스피너 표시<br>해당 페이지 데이터 로드 |
| `error: "..."` | "다시 시도" 버튼 클릭 | `error: null`<br>`isLoading: true` | 에러 메시지 제거<br>로딩 스피너 표시<br>API 재호출 |

### 3.2 엣지케이스 상태 변화

| 엣지케이스 | 상태 | 화면 변화 |
|-----------|------|----------|
| 존재하지 않는 페이지 요청 (예: page=999) | `analyses: []`<br>`currentPage: 1` (리디렉션) | "해당 페이지에 내역이 없습니다." 토스트 메시지<br>1페이지로 자동 이동 |
| 인증 만료 | Clerk 리디렉션 | `/sign-in` 페이지로 이동<br>로그인 후 `/dashboard`로 복귀 |
| 네트워크 지연 | `isLoading: true` | 로딩 스켈레톤 UI 표시<br>타임아웃 10초 후 에러 처리 |

---

## 4. Flux Pattern Design

### 4.1 Flux 패턴 개요

```
┌─────────┐      ┌──────────┐      ┌─────────┐      ┌──────┐
│ Action  │─────>│ Reducer  │─────>│  State  │─────>│ View │
└─────────┘      └──────────┘      └─────────┘      └──────┘
     ^                                                    │
     └────────────────────────────────────────────────────┘
                    User Interaction
```

**Flux 패턴 적용 이유:**
- 상태 변경 로직을 중앙화하여 예측 가능한 상태 관리
- 복잡한 비동기 로직 (API 호출, 페이지네이션)을 체계적으로 관리
- 디버깅 및 테스트 용이성 증가

### 4.2 Actions 정의

```typescript
type DashboardAction =
  | { type: 'FETCH_START' }
  | { type: 'FETCH_SUCCESS'; payload: { analyses: Analysis[]; totalCount: number; totalPages: number } }
  | { type: 'FETCH_ERROR'; payload: { error: string } }
  | { type: 'SET_PAGE'; payload: { page: number } }
  | { type: 'RETRY' };
```

**Action 설명:**

| Action Type | Payload | 발생 시점 | 설명 |
|-------------|---------|----------|------|
| `FETCH_START` | - | API 호출 직전 | 로딩 상태 시작 |
| `FETCH_SUCCESS` | `analyses`, `totalCount`, `totalPages` | API 응답 성공 | 데이터 업데이트 및 로딩 종료 |
| `FETCH_ERROR` | `error` | API 응답 실패 | 에러 메시지 설정 및 로딩 종료 |
| `SET_PAGE` | `page` | 페이지 번호 클릭 | 페이지 변경 및 재로딩 |
| `RETRY` | - | "다시 시도" 버튼 클릭 | 에러 초기화 및 재로딩 |

### 4.3 Reducer 설계

```typescript
interface DashboardState {
  analyses: Analysis[];
  currentPage: number;
  totalPages: number;
  totalCount: number;
  isLoading: boolean;
  error: string | null;
}

const initialState: DashboardState = {
  analyses: [],
  currentPage: 1,
  totalPages: 0,
  totalCount: 0,
  isLoading: true,
  error: null,
};

function dashboardReducer(state: DashboardState, action: DashboardAction): DashboardState {
  switch (action.type) {
    case 'FETCH_START':
      return {
        ...state,
        isLoading: true,
        error: null,
      };

    case 'FETCH_SUCCESS':
      return {
        ...state,
        isLoading: false,
        analyses: action.payload.analyses,
        totalCount: action.payload.totalCount,
        totalPages: action.payload.totalPages,
        error: null,
      };

    case 'FETCH_ERROR':
      return {
        ...state,
        isLoading: false,
        error: action.payload.error,
      };

    case 'SET_PAGE':
      return {
        ...state,
        currentPage: action.payload.page,
        isLoading: true,
        error: null,
      };

    case 'RETRY':
      return {
        ...state,
        isLoading: true,
        error: null,
      };

    default:
      return state;
  }
}
```

**Reducer 로직 설명:**

1. **FETCH_START**: 로딩 상태를 `true`로 설정하고, 이전 에러를 초기화
2. **FETCH_SUCCESS**: API 응답 데이터를 상태에 반영하고, 로딩 종료
3. **FETCH_ERROR**: 에러 메시지를 설정하고, 로딩 종료
4. **SET_PAGE**: 페이지 번호를 변경하고, 재로딩 시작
5. **RETRY**: 에러를 초기화하고, 재로딩 시작

### 4.4 View 레이어 설계

**컴포넌트 구조:**

```
DashboardPage (페이지 컴포넌트)
├── useReducer(dashboardReducer, initialState)
├── useEffect (데이터 페칭)
├── DashboardHeader (헤더)
├── AnalysisList (분석 목록)
│   ├── LoadingSpinner (로딩 중)
│   ├── EmptyState (빈 상태)
│   ├── ErrorState (에러 상태)
│   └── AnalysisCard[] (분석 카드 목록)
├── Pagination (페이지네이션)
└── CTAButtons (CTA 버튼들)
```

**View 로직 흐름:**

```typescript
// DashboardPage.tsx (Pseudo Code)

export default function DashboardPage() {
  const [state, dispatch] = useReducer(dashboardReducer, initialState);
  const { userId } = useAuth(); // Clerk 세션에서 userId 추출

  // 1. 컴포넌트 마운트 시 또는 currentPage 변경 시 데이터 페칭
  useEffect(() => {
    fetchAnalyses();
  }, [state.currentPage]);

  // 2. API 호출 함수
  async function fetchAnalyses() {
    dispatch({ type: 'FETCH_START' });

    try {
      const response = await fetch(`/api/analyses?page=${state.currentPage}&limit=10`, {
        headers: { Authorization: `Bearer ${clerkToken}` }
      });

      if (!response.ok) {
        throw new Error('내역을 불러오는 데 실패했습니다.');
      }

      const data = await response.json();

      dispatch({
        type: 'FETCH_SUCCESS',
        payload: {
          analyses: data.data.items,
          totalCount: data.data.pagination.total_count,
          totalPages: data.data.pagination.total_pages,
        }
      });
    } catch (error) {
      dispatch({
        type: 'FETCH_ERROR',
        payload: { error: error.message }
      });
    }
  }

  // 3. 페이지 변경 핸들러
  function handlePageChange(page: number) {
    dispatch({ type: 'SET_PAGE', payload: { page } });
  }

  // 4. 재시도 핸들러
  function handleRetry() {
    dispatch({ type: 'RETRY' });
  }

  // 5. 렌더링 로직
  return (
    <div className="dashboard-page">
      <DashboardHeader />

      {/* 로딩 상태 */}
      {state.isLoading && <LoadingSpinner />}

      {/* 에러 상태 */}
      {state.error && (
        <ErrorState message={state.error} onRetry={handleRetry} />
      )}

      {/* 빈 상태 */}
      {!state.isLoading && state.totalCount === 0 && (
        <EmptyState />
      )}

      {/* 분석 목록 */}
      {!state.isLoading && state.analyses.length > 0 && (
        <AnalysisList analyses={state.analyses} />
      )}

      {/* 페이지네이션 (11건 이상인 경우만) */}
      {state.totalCount > 10 && (
        <Pagination
          currentPage={state.currentPage}
          totalPages={state.totalPages}
          onPageChange={handlePageChange}
        />
      )}

      {/* CTA 버튼 */}
      <CTAButtons />
    </div>
  );
}
```

### 4.5 데이터 흐름 다이어그램

```
[사용자 행동]
    │
    ├─> 페이지 방문 ─────────────┐
    ├─> 페이지 번호 클릭 ─────────┤
    ├─> "다음" 버튼 클릭 ─────────┤
    ├─> "이전" 버튼 클릭 ─────────┤
    └─> "다시 시도" 버튼 클릭 ────┤
                                │
                                ▼
                        [Action Dispatch]
                                │
                                ▼
                           [Reducer]
                                │
                                ▼
                        [State 업데이트]
                                │
                                ▼
                        [React Re-render]
                                │
                                ▼
                         [View 업데이트]
                                │
                                ▼
                        [사용자에게 표시]
```

---

## 5. React Query 통합 (선택적 개선)

**참고:** 현재 설계는 `useReducer`만 사용하지만, React Query를 추가로 도입하면 다음과 같은 이점이 있습니다.

### 5.1 React Query 사용 시 장점

- 자동 캐싱 (5분 간 동일한 페이지 재요청 시 API 호출 생략)
- 자동 재시도 로직
- 백그라운드 데이터 갱신
- 로딩, 에러 상태 자동 관리

### 5.2 React Query 통합 예시

```typescript
// hooks/useAnalyses.ts
export function useAnalyses(page: number) {
  return useQuery({
    queryKey: ['analyses', page],
    queryFn: () => fetchAnalyses(page),
    staleTime: 5 * 60 * 1000, // 5분
    keepPreviousData: true,   // 페이지 전환 시 이전 데이터 유지
  });
}

// DashboardPage.tsx
export default function DashboardPage() {
  const [currentPage, setCurrentPage] = useState(1);
  const { data, isLoading, error, refetch } = useAnalyses(currentPage);

  // ... 렌더링 로직
}
```

**결정:** 현재는 Level 2 수준으로 `useReducer`만 사용하고, 추후 필요 시 React Query로 개선합니다.

---

## 6. 에러 처리 전략

### 6.1 에러 타입별 처리

| 에러 타입 | HTTP 상태 | 처리 방법 |
|----------|-----------|----------|
| 인증 만료 | 401 Unauthorized | Clerk 미들웨어가 자동으로 `/sign-in`으로 리디렉션 |
| 잘못된 요청 | 400 Bad Request | "잘못된 요청입니다." 메시지 표시 + 1페이지로 이동 |
| 서버 오류 | 500 Internal Server Error | "일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요." + "다시 시도" 버튼 |
| 네트워크 오류 | - | "인터넷 연결을 확인해주세요." + "다시 시도" 버튼 |

### 6.2 사용자 피드백

- **Toast 메시지**: 일시적인 알림 (예: "페이지를 찾을 수 없습니다.")
- **Error State 컴포넌트**: 지속적인 에러 표시 (예: 서버 오류)
- **Retry 버튼**: 사용자가 수동으로 재시도 가능

---

## 7. 성능 최적화

### 7.1 최적화 전략

| 전략 | 설명 | 구현 방법 |
|------|------|----------|
| 메모이제이션 | 불필요한 리렌더링 방지 | `React.memo()`, `useMemo()`, `useCallback()` 사용 |
| 스켈레톤 UI | 로딩 중 사용자 경험 개선 | 분석 카드 모양의 스켈레톤 표시 |
| 이미지 지연 로딩 | 페이지 로딩 속도 개선 | `loading="lazy"` 속성 사용 (해당 시) |
| Debounce | 빠른 페이지 전환 시 불필요한 API 호출 방지 | 300ms debounce 적용 |

### 7.2 컴포넌트 메모이제이션 예시

```typescript
// AnalysisCard.tsx
const AnalysisCard = React.memo(({ analysis }: { analysis: Analysis }) => {
  // ... 렌더링 로직
});

// Pagination.tsx
const Pagination = React.memo(({ currentPage, totalPages, onPageChange }) => {
  // ... 렌더링 로직
});
```

---

## 8. 테스트 전략

### 8.1 단위 테스트 (Unit Tests)

**Reducer 테스트:**
```typescript
describe('dashboardReducer', () => {
  it('FETCH_START 액션 시 isLoading이 true가 되어야 함', () => {
    const state = dashboardReducer(initialState, { type: 'FETCH_START' });
    expect(state.isLoading).toBe(true);
    expect(state.error).toBeNull();
  });

  it('FETCH_SUCCESS 액션 시 데이터가 업데이트되어야 함', () => {
    const payload = {
      analyses: [{ id: '1', name: '김철수', ... }],
      totalCount: 25,
      totalPages: 3,
    };
    const state = dashboardReducer(initialState, { type: 'FETCH_SUCCESS', payload });
    expect(state.analyses).toEqual(payload.analyses);
    expect(state.isLoading).toBe(false);
  });
});
```

### 8.2 통합 테스트 (Integration Tests)

**페이지 컴포넌트 테스트:**
```typescript
describe('DashboardPage', () => {
  it('로딩 중일 때 스피너가 표시되어야 함', () => {
    render(<DashboardPage />);
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  });

  it('분석 내역이 없을 때 빈 상태 메시지가 표시되어야 함', async () => {
    // Mock API 응답: 빈 배열
    render(<DashboardPage />);
    await waitFor(() => {
      expect(screen.getByText('아직 분석한 내역이 없습니다.')).toBeInTheDocument();
    });
  });

  it('페이지 번호 클릭 시 해당 페이지 데이터가 로드되어야 함', async () => {
    // Mock API 응답
    render(<DashboardPage />);
    const page2Button = screen.getByText('2');
    fireEvent.click(page2Button);
    await waitFor(() => {
      // 2페이지 데이터 확인
    });
  });
});
```

---

## 9. 구현 체크리스트

### 9.1 필수 구현 사항

- [ ] `DashboardPage` 컴포넌트 생성 (`src/app/dashboard/page.tsx`)
- [ ] `dashboardReducer` 구현 (`src/features/analyses/hooks/useDashboard.ts`)
- [ ] API 호출 함수 구현 (`src/features/analyses/hooks/useAnalyses.ts`)
- [ ] `AnalysisCard` 컴포넌트 생성
- [ ] `Pagination` 컴포넌트 생성 (또는 shadcn-ui 사용)
- [ ] `LoadingSpinner` 컴포넌트 생성
- [ ] `EmptyState` 컴포넌트 생성
- [ ] `ErrorState` 컴포넌트 생성
- [ ] CTA 버튼 구현 (새 분석하기, 구독 관리)
- [ ] Clerk 인증 미들웨어 적용
- [ ] 에러 처리 로직 구현
- [ ] 페이지네이션 로직 구현
- [ ] 스켈레톤 UI 구현
- [ ] 반응형 디자인 적용
- [ ] 단위 테스트 작성
- [ ] 통합 테스트 작성

### 9.2 선택 구현 사항

- [ ] React Query 통합 (캐싱 개선)
- [ ] 무한 스크롤 (대체 UI 패턴)
- [ ] 검색 기능 (이름, 날짜 필터링)
- [ ] 정렬 옵션 (최신순 외 추가)
- [ ] 분석 내역 삭제 기능
- [ ] 즐겨찾기 기능
- [ ] 내보내기 기능 (CSV, PDF)

---

## 10. 관련 문서

- `/docs/prd.md` - 제품 요구사항 정의서
- `/docs/userflow.md` - 사용자 플로우 11번
- `/docs/usecases/011/spec.md` - 분석 내역 조회 유스케이스
- `/docs/database.md` - analyses 테이블 스키마
- `src/features/analyses/backend/route.ts` - API 엔드포인트 구현
- `src/features/analyses/backend/schema.ts` - Zod 스키마 정의

---

## 11. 변경 이력

| 날짜 | 버전 | 변경 내용 | 작성자 |
|------|------|----------|--------|
| 2025-10-25 | 1.0.0 | 초기 문서 작성 (Level 2 - useReducer only) | Claude |

---

## 부록 A: 전체 상태 인터페이스

```typescript
// src/features/analyses/types.ts

export interface Analysis {
  id: string;
  name: string;
  birth_date: string;
  birth_time: string | null;
  is_lunar: boolean;
  model_type: 'flash' | 'pro';
  created_at: string;
}

export interface DashboardState {
  analyses: Analysis[];
  currentPage: number;
  totalPages: number;
  totalCount: number;
  isLoading: boolean;
  error: string | null;
}

export type DashboardAction =
  | { type: 'FETCH_START' }
  | { type: 'FETCH_SUCCESS'; payload: { analyses: Analysis[]; totalCount: number; totalPages: number } }
  | { type: 'FETCH_ERROR'; payload: { error: string } }
  | { type: 'SET_PAGE'; payload: { page: number } }
  | { type: 'RETRY' };

export interface PaginationInfo {
  total_count: number;
  total_pages: number;
  current_page: number;
  per_page: number;
  has_next: boolean;
  has_prev: boolean;
}
```

---

## 부록 B: API 응답 예시

**Success (데이터 있음):**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "name": "김철수",
        "birth_date": "1990-05-15",
        "birth_time": "14:30",
        "is_lunar": false,
        "model_type": "flash",
        "created_at": "2025-10-24T15:30:00Z"
      }
    ],
    "pagination": {
      "total_count": 25,
      "total_pages": 3,
      "current_page": 1,
      "per_page": 10,
      "has_next": true,
      "has_prev": false
    }
  }
}
```

**Success (데이터 없음):**
```json
{
  "success": true,
  "data": {
    "items": [],
    "pagination": {
      "total_count": 0,
      "total_pages": 0,
      "current_page": 1,
      "per_page": 10,
      "has_next": false,
      "has_prev": false
    }
  }
}
```

**Error:**
```json
{
  "success": false,
  "error": {
    "code": "DATABASE_ERROR",
    "message": "분석 내역을 조회하는 중 오류가 발생했습니다."
  }
}
```
