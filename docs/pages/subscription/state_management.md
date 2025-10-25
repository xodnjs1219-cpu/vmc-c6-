# 구독 관리 페이지 상태 관리 설계 (Level 3)

## 1. State Data Identification

### 1.1 관리해야 할 상태 데이터

구독 관리 페이지에서 Context + useReducer로 관리해야 하는 상태 데이터 목록입니다.

#### A. 구독 정보 상태 (Subscription State)

| 상태 필드 | 타입 | 설명 | 초기값 |
|----------|------|------|--------|
| `planType` | `'Free' \| 'Pro'` | 현재 요금제 타입 | `'Free'` |
| `remainingTries` | `number` | 남은 분석 횟수 | `0` |
| `nextPaymentDate` | `string \| null` | 다음 결제일 (YYYY-MM-DD) | `null` |
| `subscribedAt` | `string \| null` | Pro 구독 시작일 | `null` |
| `cancellationScheduled` | `boolean` | 해지 예약 여부 | `false` |
| `billingKeyExists` | `boolean` | 빌링키 존재 여부 (UI 표시용) | `false` |

#### B. UI 상태 (UI State)

| 상태 필드 | 타입 | 설명 | 초기값 |
|----------|------|------|--------|
| `isLoading` | `boolean` | 초기 데이터 로딩 중 | `true` |
| `isSubscribing` | `boolean` | Pro 구독 진행 중 | `false` |
| `isCancelling` | `boolean` | 해지 신청 진행 중 | `false` |
| `isReactivating` | `boolean` | 해지 취소 진행 중 | `false` |
| `error` | `string \| null` | 에러 메시지 | `null` |

### 1.2 파생 데이터 (Derived Data - 상태가 아님)

화면에 표시되지만 기존 상태로부터 계산되는 데이터입니다. 별도로 상태로 관리하지 않습니다.

| 파생 데이터 | 계산 로직 | 설명 |
|-----------|---------|------|
| `remainingDays` | `Math.ceil((new Date(nextPaymentDate) - new Date()) / (1000 * 60 * 60 * 24))` | 다음 결제일까지 남은 일수 |
| `canSubscribe` | `planType === 'Free' && !isSubscribing` | Pro 구독 버튼 활성화 조건 |
| `canCancel` | `planType === 'Pro' && !cancellationScheduled && !isCancelling` | 해지 버튼 활성화 조건 |
| `canReactivate` | `planType === 'Pro' && cancellationScheduled && !isReactivating` | 해지 취소 버튼 활성화 조건 |
| `displayPlanName` | `planType === 'Pro' ? 'Pro 플랜' : 'Free 플랜'` | UI에 표시할 플랜 이름 |
| `monthlyQuota` | `planType === 'Pro' ? 10 : 3` | 월별 총 분석 횟수 |
| `formattedPaymentDate` | `format(parseISO(nextPaymentDate), 'yyyy년 MM월 dd일')` | 포맷된 결제일 문자열 |

---

## 2. State Transition Table

### 2.1 구독 정보 상태 전환

| 트리거 (Action) | 변경 전 상태 | 변경 후 상태 | UI 변화 |
|---------------|------------|------------|--------|
| **초기 로드 성공** | `isLoading: true` | `isLoading: false`<br/>`planType: 'Free' or 'Pro'`<br/>`remainingTries: n` | - 로딩 스피너 → 구독 정보 카드 표시<br/>- 플랜 배지, 남은 횟수 표시<br/>- 적절한 버튼 노출 |
| **초기 로드 실패** | `isLoading: true` | `isLoading: false`<br/>`error: "..."` | - 에러 메시지 표시<br/>- 재시도 버튼 표시 |
| **Pro 구독 시작** | `planType: 'Free'` | `isSubscribing: true` | - 'Pro 구독하기' 버튼 로딩 상태<br/>- 토스페이먼츠 SDK 모달 표시 |
| **Pro 구독 성공** | `isSubscribing: true`<br/>`planType: 'Free'` | `isSubscribing: false`<br/>`planType: 'Pro'`<br/>`remainingTries: 10`<br/>`nextPaymentDate: "YYYY-MM-DD"`<br/>`billingKeyExists: true` | - 플랜 배지: Free → Pro<br/>- 남은 횟수: 0 → 10<br/>- 다음 결제일 정보 표시<br/>- 'Pro 구독하기' → '해지하기' 버튼 변경<br/>- 성공 토스트 메시지 |
| **Pro 구독 실패** | `isSubscribing: true` | `isSubscribing: false`<br/>`error: "결제 실패 사유"` | - 에러 토스트 메시지 표시<br/>- 'Pro 구독하기' 버튼 재활성화 |
| **해지 신청 시작** | `planType: 'Pro'`<br/>`cancellationScheduled: false` | `isCancelling: true` | - '해지하기' 버튼 로딩 상태 |
| **해지 신청 성공** | `isCancelling: true`<br/>`cancellationScheduled: false` | `isCancelling: false`<br/>`cancellationScheduled: true` | - '해지하기' → '해지 취소' 버튼 변경<br/>- 안내 메시지 표시: "다음 결제일({date})까지 구독 유지됩니다"<br/>- 성공 토스트 메시지 |
| **해지 신청 실패** | `isCancelling: true` | `isCancelling: false`<br/>`error: "..."` | - 에러 토스트 메시지 표시<br/>- '해지하기' 버튼 재활성화 |
| **해지 취소 시작** | `planType: 'Pro'`<br/>`cancellationScheduled: true` | `isReactivating: true` | - '해지 취소' 버튼 로딩 상태 |
| **해지 취소 성공** | `isReactivating: true`<br/>`cancellationScheduled: true` | `isReactivating: false`<br/>`cancellationScheduled: false` | - '해지 취소' → '해지하기' 버튼 변경<br/>- 해지 예약 안내 메시지 제거<br/>- 성공 토스트 메시지 |
| **해지 취소 실패** | `isReactivating: true` | `isReactivating: false`<br/>`error: "..."` | - 에러 토스트 메시지 표시<br/>- '해지 취소' 버튼 재활성화 |

### 2.2 UI 버튼 상태 매트릭스

| 상태 조합 | 표시되는 버튼 | 버튼 활성화 여부 | 버튼 텍스트 |
|---------|-------------|----------------|-----------|
| `Free` + 로딩 중 | 'Pro 구독하기' | 비활성 (스피너) | "처리 중..." |
| `Free` + 정상 | 'Pro 구독하기' | 활성 | "Pro 구독하기 (월 3,900원)" |
| `Pro` + 정상 + 해지 예약 안 함 | '해지하기' | 활성 | "해지하기" |
| `Pro` + 해지 중 | '해지하기' | 비활성 (스피너) | "처리 중..." |
| `Pro` + 해지 예약됨 | '해지 취소' | 활성 | "해지 취소" |
| `Pro` + 해지 취소 중 | '해지 취소' | 비활성 (스피너) | "처리 중..." |

---

## 3. Flux Pattern Design

### 3.1 Actions (사용자 액션)

구독 관리 페이지에서 사용자가 수행할 수 있는 모든 액션을 정의합니다.

```typescript
type SubscriptionAction =
  // 초기 데이터 로드
  | { type: 'LOAD_SUBSCRIPTION_START' }
  | { type: 'LOAD_SUBSCRIPTION_SUCCESS'; payload: SubscriptionData }
  | { type: 'LOAD_SUBSCRIPTION_FAILURE'; payload: { error: string } }

  // Pro 구독 신청
  | { type: 'SUBSCRIBE_PRO_START' }
  | { type: 'SUBSCRIBE_PRO_SUCCESS'; payload: SubscriptionData }
  | { type: 'SUBSCRIBE_PRO_FAILURE'; payload: { error: string } }

  // 구독 해지 신청
  | { type: 'CANCEL_SUBSCRIPTION_START' }
  | { type: 'CANCEL_SUBSCRIPTION_SUCCESS'; payload: { nextPaymentDate: string } }
  | { type: 'CANCEL_SUBSCRIPTION_FAILURE'; payload: { error: string } }

  // 해지 취소
  | { type: 'REACTIVATE_SUBSCRIPTION_START' }
  | { type: 'REACTIVATE_SUBSCRIPTION_SUCCESS' }
  | { type: 'REACTIVATE_SUBSCRIPTION_FAILURE'; payload: { error: string } }

  // 에러 초기화
  | { type: 'CLEAR_ERROR' };

interface SubscriptionData {
  planType: 'Free' | 'Pro';
  remainingTries: number;
  nextPaymentDate: string | null;
  subscribedAt: string | null;
  cancellationScheduled: boolean;
  billingKeyExists: boolean;
}
```

### 3.2 State (Store)

useReducer로 관리되는 전체 상태 구조입니다.

```typescript
interface SubscriptionState {
  // 구독 정보
  subscription: {
    planType: 'Free' | 'Pro';
    remainingTries: number;
    nextPaymentDate: string | null;
    subscribedAt: string | null;
    cancellationScheduled: boolean;
    billingKeyExists: boolean;
  };

  // UI 상태
  ui: {
    isLoading: boolean;
    isSubscribing: boolean;
    isCancelling: boolean;
    isReactivating: boolean;
    error: string | null;
  };
}

const initialState: SubscriptionState = {
  subscription: {
    planType: 'Free',
    remainingTries: 0,
    nextPaymentDate: null,
    subscribedAt: null,
    cancellationScheduled: false,
    billingKeyExists: false,
  },
  ui: {
    isLoading: true,
    isSubscribing: false,
    isCancelling: false,
    isReactivating: false,
    error: null,
  },
};
```

### 3.3 Reducer (상태 업데이트 로직)

각 Action에 대한 상태 변경 로직을 정의합니다.

```typescript
function subscriptionReducer(
  state: SubscriptionState,
  action: SubscriptionAction
): SubscriptionState {
  switch (action.type) {
    // === 초기 로드 ===
    case 'LOAD_SUBSCRIPTION_START':
      return {
        ...state,
        ui: { ...state.ui, isLoading: true, error: null },
      };

    case 'LOAD_SUBSCRIPTION_SUCCESS':
      return {
        subscription: action.payload,
        ui: { ...state.ui, isLoading: false, error: null },
      };

    case 'LOAD_SUBSCRIPTION_FAILURE':
      return {
        ...state,
        ui: { ...state.ui, isLoading: false, error: action.payload.error },
      };

    // === Pro 구독 ===
    case 'SUBSCRIBE_PRO_START':
      return {
        ...state,
        ui: { ...state.ui, isSubscribing: true, error: null },
      };

    case 'SUBSCRIBE_PRO_SUCCESS':
      return {
        subscription: action.payload,
        ui: { ...state.ui, isSubscribing: false, error: null },
      };

    case 'SUBSCRIBE_PRO_FAILURE':
      return {
        ...state,
        ui: { ...state.ui, isSubscribing: false, error: action.payload.error },
      };

    // === 구독 해지 ===
    case 'CANCEL_SUBSCRIPTION_START':
      return {
        ...state,
        ui: { ...state.ui, isCancelling: true, error: null },
      };

    case 'CANCEL_SUBSCRIPTION_SUCCESS':
      return {
        subscription: {
          ...state.subscription,
          cancellationScheduled: true,
          nextPaymentDate: action.payload.nextPaymentDate,
        },
        ui: { ...state.ui, isCancelling: false, error: null },
      };

    case 'CANCEL_SUBSCRIPTION_FAILURE':
      return {
        ...state,
        ui: { ...state.ui, isCancelling: false, error: action.payload.error },
      };

    // === 해지 취소 ===
    case 'REACTIVATE_SUBSCRIPTION_START':
      return {
        ...state,
        ui: { ...state.ui, isReactivating: true, error: null },
      };

    case 'REACTIVATE_SUBSCRIPTION_SUCCESS':
      return {
        subscription: {
          ...state.subscription,
          cancellationScheduled: false,
        },
        ui: { ...state.ui, isReactivating: false, error: null },
      };

    case 'REACTIVATE_SUBSCRIPTION_FAILURE':
      return {
        ...state,
        ui: { ...state.ui, isReactivating: false, error: action.payload.error },
      };

    // === 에러 초기화 ===
    case 'CLEAR_ERROR':
      return {
        ...state,
        ui: { ...state.ui, error: null },
      };

    default:
      return state;
  }
}
```

### 3.4 View (UI 컴포넌트)

Reducer에서 관리되는 상태를 기반으로 UI를 렌더링합니다.

#### A. 초기 로딩 상태
```typescript
if (state.ui.isLoading) {
  return <SubscriptionSkeleton />;
}
```

#### B. 에러 상태
```typescript
if (state.ui.error) {
  return (
    <ErrorAlert
      message={state.ui.error}
      onRetry={() => dispatch({ type: 'LOAD_SUBSCRIPTION_START' })}
    />
  );
}
```

#### C. Free 플랜 UI
```typescript
if (state.subscription.planType === 'Free') {
  return (
    <SubscriptionCard>
      <PlanBadge variant="free">Free 플랜</PlanBadge>
      <RemainingTriesDisplay value={state.subscription.remainingTries} max={3} />
      <SubscribeButton
        onClick={handleSubscribePro}
        loading={state.ui.isSubscribing}
        disabled={state.ui.isSubscribing}
      >
        {state.ui.isSubscribing ? '처리 중...' : 'Pro 구독하기 (월 3,900원)'}
      </SubscribeButton>
    </SubscriptionCard>
  );
}
```

#### D. Pro 플랜 UI (정상 상태)
```typescript
if (state.subscription.planType === 'Pro' && !state.subscription.cancellationScheduled) {
  return (
    <SubscriptionCard>
      <PlanBadge variant="pro">Pro 플랜</PlanBadge>
      <RemainingTriesDisplay value={state.subscription.remainingTries} max={10} />
      <NextPaymentDate date={state.subscription.nextPaymentDate} />
      <CancelButton
        onClick={handleCancelSubscription}
        loading={state.ui.isCancelling}
        disabled={state.ui.isCancelling}
      >
        {state.ui.isCancelling ? '처리 중...' : '해지하기'}
      </CancelButton>
    </SubscriptionCard>
  );
}
```

#### E. Pro 플랜 UI (해지 예약 상태)
```typescript
if (state.subscription.planType === 'Pro' && state.subscription.cancellationScheduled) {
  return (
    <SubscriptionCard>
      <PlanBadge variant="pro">Pro 플랜</PlanBadge>
      <CancellationNotice>
        다음 결제일({formatDate(state.subscription.nextPaymentDate)})까지 구독이 유지됩니다.
      </CancellationNotice>
      <RemainingTriesDisplay value={state.subscription.remainingTries} max={10} />
      <ReactivateButton
        onClick={handleReactivateSubscription}
        loading={state.ui.isReactivating}
        disabled={state.ui.isReactivating}
      >
        {state.ui.isReactivating ? '처리 중...' : '해지 취소'}
      </ReactivateButton>
    </SubscriptionCard>
  );
}
```

---

## 4. Context Design

### 4.1 데이터 로딩 플로우

```
┌─────────────────────────────────────────────────────────────┐
│ SubscriptionProvider (Context)                              │
│                                                              │
│  1. Mount 시                                                 │
│     └─> useEffect(() => loadSubscription(), [])             │
│                                                              │
│  2. loadSubscription()                                       │
│     ├─> dispatch({ type: 'LOAD_SUBSCRIPTION_START' })       │
│     ├─> API: GET /api/subscriptions/me                      │
│     ├─> Success: dispatch({ type: 'SUCCESS', payload })     │
│     └─> Failure: dispatch({ type: 'FAILURE', payload })     │
│                                                              │
│  3. handleSubscribePro()                                     │
│     ├─> dispatch({ type: 'SUBSCRIBE_PRO_START' })           │
│     ├─> 토스페이먼츠 SDK: requestBillingAuth()               │
│     ├─> 사용자 카드 입력                                      │
│     ├─> successUrl로 리디렉션                                 │
│     ├─> API: POST /api/payments/subscribe                   │
│     ├─> Success: dispatch({ type: 'SUCCESS', payload })     │
│     └─> Failure: dispatch({ type: 'FAILURE', payload })     │
│                                                              │
│  4. handleCancelSubscription()                               │
│     ├─> dispatch({ type: 'CANCEL_SUBSCRIPTION_START' })     │
│     ├─> API: POST /api/subscriptions/cancel                 │
│     ├─> Success: dispatch({ type: 'SUCCESS', payload })     │
│     └─> Failure: dispatch({ type: 'FAILURE', payload })     │
│                                                              │
│  5. handleReactivateSubscription()                           │
│     ├─> dispatch({ type: 'REACTIVATE_SUBSCRIPTION_START' }) │
│     ├─> API: POST /api/subscriptions/reactivate             │
│     ├─> Success: dispatch({ type: 'SUCCESS' })              │
│     └─> Failure: dispatch({ type: 'FAILURE', payload })     │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                           │
                           │ provides via Context
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ 하위 컴포넌트 (useSubscription hook 사용)                     │
│                                                              │
│  - SubscriptionCard                                          │
│  - PlanBadge                                                 │
│  - RemainingTriesDisplay                                     │
│  - SubscribeButton                                           │
│  - CancelButton                                              │
│  - ReactivateButton                                          │
│  - CancellationNotice                                        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 Context 인터페이스

#### A. 노출할 상태 (읽기 전용)

```typescript
interface SubscriptionContextValue {
  // === 구독 정보 ===
  subscription: {
    planType: 'Free' | 'Pro';
    remainingTries: number;
    nextPaymentDate: string | null;
    subscribedAt: string | null;
    cancellationScheduled: boolean;
    billingKeyExists: boolean;
  };

  // === UI 상태 ===
  ui: {
    isLoading: boolean;
    isSubscribing: boolean;
    isCancelling: boolean;
    isReactivating: boolean;
    error: string | null;
  };

  // === 파생 데이터 (Computed Values) ===
  computed: {
    remainingDays: number | null; // 다음 결제일까지 남은 일수
    canSubscribe: boolean;         // Pro 구독 가능 여부
    canCancel: boolean;            // 해지 신청 가능 여부
    canReactivate: boolean;        // 해지 취소 가능 여부
    displayPlanName: string;       // UI 표시용 플랜 이름
    monthlyQuota: number;          // 월별 총 분석 횟수
    formattedPaymentDate: string | null; // 포맷된 결제일
  };

  // === 액션 함수 ===
  actions: {
    loadSubscription: () => Promise<void>;       // 구독 정보 새로고침
    subscribePro: () => Promise<void>;            // Pro 구독 신청
    cancelSubscription: () => Promise<void>;      // 구독 해지 신청
    reactivateSubscription: () => Promise<void>;  // 해지 취소
    clearError: () => void;                       // 에러 메시지 초기화
  };
}
```

#### B. Custom Hook

```typescript
/**
 * 구독 관리 페이지의 상태와 액션을 제공하는 훅
 * @throws {Error} SubscriptionProvider 외부에서 사용 시 에러 발생
 */
export function useSubscription(): SubscriptionContextValue {
  const context = useContext(SubscriptionContext);

  if (!context) {
    throw new Error('useSubscription must be used within SubscriptionProvider');
  }

  return context;
}
```

### 4.3 Provider 구조

```typescript
export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(subscriptionReducer, initialState);
  const { userId } = useAuth(); // Clerk 인증 정보

  // === 초기 데이터 로드 ===
  useEffect(() => {
    loadSubscription();
  }, [userId]);

  // === 액션 함수 ===
  const loadSubscription = async () => {
    dispatch({ type: 'LOAD_SUBSCRIPTION_START' });
    try {
      const data = await apiClient.get<SubscriptionData>('/api/subscriptions/me');
      dispatch({ type: 'LOAD_SUBSCRIPTION_SUCCESS', payload: data });
    } catch (error) {
      dispatch({ type: 'LOAD_SUBSCRIPTION_FAILURE', payload: { error: error.message } });
    }
  };

  const subscribePro = async () => {
    dispatch({ type: 'SUBSCRIBE_PRO_START' });
    try {
      // 토스페이먼츠 SDK 호출
      const tossPayments = await loadTossPayments(TOSS_CLIENT_KEY);
      await tossPayments.requestBillingAuth('카드', {
        customerKey: userId,
        successUrl: `${window.location.origin}/api/payments/subscribe`,
        failUrl: `${window.location.origin}/subscription/fail`,
      });
      // successUrl에서 백엔드가 처리하고 리디렉션하므로 여기서는 대기
    } catch (error) {
      dispatch({ type: 'SUBSCRIBE_PRO_FAILURE', payload: { error: error.message } });
    }
  };

  const cancelSubscription = async () => {
    dispatch({ type: 'CANCEL_SUBSCRIPTION_START' });
    try {
      const data = await apiClient.post<{ nextPaymentDate: string }>(
        '/api/subscriptions/cancel',
        { userId }
      );
      dispatch({ type: 'CANCEL_SUBSCRIPTION_SUCCESS', payload: data });
    } catch (error) {
      dispatch({ type: 'CANCEL_SUBSCRIPTION_FAILURE', payload: { error: error.message } });
    }
  };

  const reactivateSubscription = async () => {
    dispatch({ type: 'REACTIVATE_SUBSCRIPTION_START' });
    try {
      await apiClient.post('/api/subscriptions/reactivate', { userId });
      dispatch({ type: 'REACTIVATE_SUBSCRIPTION_SUCCESS' });
    } catch (error) {
      dispatch({ type: 'REACTIVATE_SUBSCRIPTION_FAILURE', payload: { error: error.message } });
    }
  };

  const clearError = () => {
    dispatch({ type: 'CLEAR_ERROR' });
  };

  // === 파생 데이터 계산 ===
  const computed = useMemo(() => {
    const { subscription, ui } = state;

    return {
      remainingDays: subscription.nextPaymentDate
        ? Math.ceil((new Date(subscription.nextPaymentDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        : null,
      canSubscribe: subscription.planType === 'Free' && !ui.isSubscribing,
      canCancel: subscription.planType === 'Pro' && !subscription.cancellationScheduled && !ui.isCancelling,
      canReactivate: subscription.planType === 'Pro' && subscription.cancellationScheduled && !ui.isReactivating,
      displayPlanName: subscription.planType === 'Pro' ? 'Pro 플랜' : 'Free 플랜',
      monthlyQuota: subscription.planType === 'Pro' ? 10 : 3,
      formattedPaymentDate: subscription.nextPaymentDate
        ? format(parseISO(subscription.nextPaymentDate), 'yyyy년 MM월 dd일', { locale: ko })
        : null,
    };
  }, [state]);

  // === Context Value ===
  const value: SubscriptionContextValue = {
    subscription: state.subscription,
    ui: state.ui,
    computed,
    actions: {
      loadSubscription,
      subscribePro,
      cancelSubscription,
      reactivateSubscription,
      clearError,
    },
  };

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
}
```

### 4.4 컴포넌트 사용 예시

```typescript
// app/subscription/page.tsx
export default function SubscriptionPage() {
  return (
    <SubscriptionProvider>
      <SubscriptionPageContent />
    </SubscriptionProvider>
  );
}

// 하위 컴포넌트
function SubscriptionPageContent() {
  const { subscription, ui, computed, actions } = useSubscription();

  if (ui.isLoading) {
    return <SubscriptionSkeleton />;
  }

  if (ui.error) {
    return (
      <ErrorAlert
        message={ui.error}
        onRetry={actions.loadSubscription}
        onDismiss={actions.clearError}
      />
    );
  }

  return (
    <div className="container mx-auto py-8">
      <SubscriptionCard>
        {/* 플랜 배지 */}
        <PlanBadge variant={subscription.planType === 'Pro' ? 'pro' : 'free'}>
          {computed.displayPlanName}
        </PlanBadge>

        {/* 남은 횟수 표시 */}
        <RemainingTriesDisplay
          value={subscription.remainingTries}
          max={computed.monthlyQuota}
        />

        {/* 다음 결제일 (Pro 플랜만) */}
        {subscription.planType === 'Pro' && subscription.nextPaymentDate && (
          <NextPaymentInfo
            date={computed.formattedPaymentDate}
            remainingDays={computed.remainingDays}
          />
        )}

        {/* 해지 예약 안내 (해지 예약 시) */}
        {subscription.cancellationScheduled && (
          <CancellationNotice>
            다음 결제일({computed.formattedPaymentDate})까지 구독이 유지됩니다.
          </CancellationNotice>
        )}

        {/* 액션 버튼 */}
        <SubscriptionActions
          planType={subscription.planType}
          cancellationScheduled={subscription.cancellationScheduled}
          isSubscribing={ui.isSubscribing}
          isCancelling={ui.isCancelling}
          isReactivating={ui.isReactivating}
          onSubscribe={actions.subscribePro}
          onCancel={actions.cancelSubscription}
          onReactivate={actions.reactivateSubscription}
        />
      </SubscriptionCard>
    </div>
  );
}
```

---

## 5. External Service Integration

### 5.1 토스페이먼츠 연동 플로우

```
[사용자] 'Pro 구독하기' 클릭
    ↓
[Context] dispatch(SUBSCRIBE_PRO_START)
    ↓
[Context] 토스페이먼츠 SDK 로드 및 호출
    ↓
[Toss SDK] requestBillingAuth('카드', { customerKey, successUrl, failUrl })
    ↓
[Toss UI] 사용자 카드 입력 및 인증
    ↓ (성공)
[Toss] successUrl로 리디렉션 (authKey 포함)
    ↓
[Backend] /api/payments/subscribe 엔드포인트
    ├─> 빌링키 발급 (POST /v1/billing/authorizations/{authKey})
    ├─> 첫 결제 (POST /v1/billing/{billingKey})
    └─> DB 업데이트 (subscriptions 테이블)
    ↓
[Backend] /subscription으로 리디렉션
    ↓
[Context] loadSubscription() 자동 호출 (페이지 마운트 시)
    ↓
[Context] dispatch(LOAD_SUBSCRIPTION_SUCCESS)
    ↓
[UI] Pro 플랜 상태로 UI 갱신
```

### 5.2 API 엔드포인트 매핑

| Context 액션 | HTTP 요청 | 엔드포인트 | 참조 문서 |
|-------------|----------|----------|---------|
| `loadSubscription()` | GET | `/api/subscriptions/me` | - |
| `subscribePro()` | SDK | 토스페이먼츠 `requestBillingAuth()` | UC-004 |
| `cancelSubscription()` | POST | `/api/subscriptions/cancel` | UC-007 |
| `reactivateSubscription()` | POST | `/api/subscriptions/reactivate` | UC-008 |

---

## 6. Error Handling Strategy

### 6.1 에러 타입별 처리

| 에러 시나리오 | HTTP 상태 | 에러 코드 | UI 처리 |
|-------------|----------|---------|--------|
| 인증 실패 | 401 | `UNAUTHORIZED` | `/sign-in`으로 리디렉션 |
| 구독 정보 없음 | 404 | `SUBSCRIPTION_NOT_FOUND` | 고객센터 안내 모달 |
| 이미 Pro 구독 중 | 409 | `ALREADY_PRO_SUBSCRIBER` | 페이지 새로고침 |
| 이미 해지 예약됨 | 409 | `ALREADY_SCHEDULED` | 페이지 새로고침 |
| 결제 실패 | 402 | `PAYMENT_FAILED` | "다른 카드로 다시 시도해주세요" 토스트 |
| DB 오류 | 500 | `DATABASE_ERROR` | "일시적인 오류. 다시 시도해주세요" 토스트 + 재시도 버튼 |
| 토스 API 오류 | 503 | `TOSS_API_ERROR` | "결제 서비스 오류. 잠시 후 다시 시도해주세요" |

### 6.2 에러 복구 전략

```typescript
// 자동 재시도 로직 (옵션)
const loadSubscription = async (retryCount = 0) => {
  dispatch({ type: 'LOAD_SUBSCRIPTION_START' });
  try {
    const data = await apiClient.get<SubscriptionData>('/api/subscriptions/me');
    dispatch({ type: 'LOAD_SUBSCRIPTION_SUCCESS', payload: data });
  } catch (error) {
    if (retryCount < 2 && error.status >= 500) {
      // 500번대 에러는 2회까지 자동 재시도
      await new Promise((resolve) => setTimeout(resolve, 1000 * (retryCount + 1)));
      return loadSubscription(retryCount + 1);
    }
    dispatch({ type: 'LOAD_SUBSCRIPTION_FAILURE', payload: { error: error.message } });
  }
};
```

---

## 7. Performance Considerations

### 7.1 최적화 전략

1. **useMemo로 파생 데이터 캐싱**: `computed` 객체는 `state`가 변경될 때만 재계산
2. **useCallback으로 액션 함수 메모이제이션**: 불필요한 리렌더링 방지
3. **React Query 통합 고려**: 서버 상태 캐싱 및 자동 재검증

### 7.2 번들 사이즈 최적화

- 토스페이먼츠 SDK: Dynamic Import로 필요할 때만 로드
  ```typescript
  const loadTossPayments = () => import('@tosspayments/payment-sdk');
  ```

---

## 8. Testing Strategy

### 8.1 Reducer 단위 테스트

```typescript
describe('subscriptionReducer', () => {
  it('LOAD_SUBSCRIPTION_SUCCESS: 구독 정보를 올바르게 로드해야 함', () => {
    const initialState = { ... };
    const action = { type: 'LOAD_SUBSCRIPTION_SUCCESS', payload: mockSubscription };
    const newState = subscriptionReducer(initialState, action);

    expect(newState.subscription.planType).toBe('Pro');
    expect(newState.ui.isLoading).toBe(false);
  });

  it('CANCEL_SUBSCRIPTION_SUCCESS: 해지 예약 상태로 변경해야 함', () => {
    const state = { subscription: { cancellationScheduled: false }, ... };
    const action = { type: 'CANCEL_SUBSCRIPTION_SUCCESS', payload: { nextPaymentDate: '2025-11-25' } };
    const newState = subscriptionReducer(state, action);

    expect(newState.subscription.cancellationScheduled).toBe(true);
  });
});
```

### 8.2 통합 테스트

```typescript
describe('SubscriptionProvider', () => {
  it('초기 마운트 시 구독 정보를 로드해야 함', async () => {
    const { result, waitForNextUpdate } = renderHook(() => useSubscription(), {
      wrapper: SubscriptionProvider,
    });

    expect(result.current.ui.isLoading).toBe(true);
    await waitForNextUpdate();
    expect(result.current.ui.isLoading).toBe(false);
    expect(result.current.subscription.planType).toBeDefined();
  });
});
```

---

## 9. 참조 문서

- **PRD**: `/docs/prd.md` - 3. 포함 페이지 > 6. 구독 관리
- **Userflow**: `/docs/userflow.md`
  - 유저플로우 4: 신규 Pro 플랜 구독 신청
  - 유저플로우 7: Pro 구독 해지 신청
  - 유저플로우 8: 구독 해지 취소
- **Database**: `/docs/database.md` - 3.2 subscriptions 테이블
- **Use Cases**:
  - UC-004: 신규 Pro 플랜 구독 신청
  - UC-007: Pro 구독 해지 신청
  - UC-008: 구독 해지 취소

---

## 10. 체크리스트

### 10.1 상태 관리 구현
- [ ] `SubscriptionState` 인터페이스 정의
- [ ] `SubscriptionAction` 타입 정의
- [ ] `subscriptionReducer` 함수 구현
- [ ] `SubscriptionContext` 생성
- [ ] `SubscriptionProvider` 컴포넌트 구현
- [ ] `useSubscription` 커스텀 훅 구현

### 10.2 액션 함수 구현
- [ ] `loadSubscription()` - 구독 정보 조회
- [ ] `subscribePro()` - 토스페이먼츠 SDK 연동
- [ ] `cancelSubscription()` - 해지 신청 API 호출
- [ ] `reactivateSubscription()` - 해지 취소 API 호출
- [ ] `clearError()` - 에러 상태 초기화

### 10.3 파생 데이터 계산
- [ ] `remainingDays` 계산 로직
- [ ] `canSubscribe` 조건 로직
- [ ] `canCancel` 조건 로직
- [ ] `canReactivate` 조건 로직
- [ ] `formattedPaymentDate` 포맷 로직

### 10.4 UI 컴포넌트
- [ ] `SubscriptionCard` - 메인 카드
- [ ] `PlanBadge` - 플랜 배지
- [ ] `RemainingTriesDisplay` - 남은 횟수 표시
- [ ] `SubscriptionActions` - 버튼 컴포넌트
- [ ] `CancellationNotice` - 해지 예약 안내

### 10.5 테스트
- [ ] Reducer 단위 테스트
- [ ] Context Provider 통합 테스트
- [ ] 에러 핸들링 테스트
- [ ] 동시성 테스트 (Race Condition)

---

**문서 버전**: 1.0
**작성일**: 2025-10-25
**Level**: 3 (구체적 설계 + 인터페이스 정의)
**상태 관리 방식**: Context + useReducer (Flux Pattern)
