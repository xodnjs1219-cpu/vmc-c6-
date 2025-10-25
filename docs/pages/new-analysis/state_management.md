# 새 분석하기 페이지 상태 관리 설계

## 1. Overview

### 1.1 페이지 개요
새 분석하기 페이지(`/new-analysis`)는 사용자가 사주 정보를 입력하고 AI 기반 사주 분석을 요청하는 핵심 기능 페이지입니다.

### 1.2 주요 기능
- 사주 정보 입력 폼 (이름, 생년월일, 시간, 음력/양력)
- 모델 선택 (Pro 사용자만 Flash/Pro 선택 가능)
- 분석 요청 및 로딩 상태 관리
- 결과 모달 표시
- 횟수 소진 시 리디렉션 또는 안내

### 1.3 관련 유스케이스
- UC-002: Free 사용자의 사주 분석 (성공)
- UC-003: Free 사용자의 사주 분석 (횟수 소진)
- UC-005: Pro 사용자의 사주 분석 (성공)
- UC-006: Pro 사용자의 사주 분석 (횟수 소진)

---

## 2. State Data Identification

### 2.1 관리해야 할 상태 데이터

#### 2.1.1 폼 입력 상태 (Form State)
```typescript
interface FormState {
  name: string;              // 분석 대상 이름
  birthDate: string;         // 생년월일 (YYYY-MM-DD)
  birthTime: string | null;  // 태어난 시간 (HH:MM) or null
  isLunar: boolean;          // 음력 여부
  modelType: 'flash' | 'pro'; // 선택한 모델 (Pro 사용자만 선택 가능)
  unknownBirthTime: boolean; // '시간 모름' 체크 여부
}
```

#### 2.1.2 폼 검증 상태 (Validation State)
```typescript
interface ValidationState {
  errors: {
    name?: string;
    birthDate?: string;
    birthTime?: string;
  };
  touched: {
    name: boolean;
    birthDate: boolean;
    birthTime: boolean;
  };
}
```

#### 2.1.3 분석 요청 상태 (Request State)
```typescript
interface RequestState {
  status: 'idle' | 'loading' | 'success' | 'error';
  error: AnalysisError | null;
}

interface AnalysisError {
  code: 'QUOTA_EXCEEDED' | 'QUOTA_EXCEEDED_PRO' | 'GEMINI_API_ERROR' | 'INVALID_INPUT' | 'DB_ERROR' | 'UNAUTHORIZED';
  message: string;
  details?: {
    nextPaymentDate?: string;
    planType?: 'Free' | 'Pro';
    remainingTries?: number;
  };
}
```

#### 2.1.4 분석 결과 상태 (Result State)
```typescript
interface ResultState {
  analysisId: string | null;
  summary: string | null;
  detail: string | null;
  showModal: boolean;
}
```

#### 2.1.5 사용자 구독 상태 (Subscription State)
```typescript
interface SubscriptionState {
  planType: 'Free' | 'Pro';
  remainingTries: number;
  maxTries: number;           // Free: 3, Pro: 10
  nextPaymentDate: string | null;
  isLoading: boolean;
}
```

### 2.2 상태가 아닌 데이터 (Derived State)

#### 2.2.1 계산 가능한 값 (Computed Values)
```typescript
// 폼 유효성 여부 (상태로부터 계산 가능)
const isFormValid: boolean = computed from FormState & ValidationState

// 분석 가능 여부 (구독 상태로부터 계산 가능)
const canAnalyze: boolean = subscriptionState.remainingTries > 0

// 모델 선택 가능 여부 (구독 상태로부터 계산 가능)
const canSelectModel: boolean = subscriptionState.planType === 'Pro'

// 로딩 중 여부 (요청 상태로부터 계산 가능)
const isLoading: boolean = requestState.status === 'loading'

// 버튼 비활성화 여부 (여러 상태 조합)
const isButtonDisabled: boolean = !isFormValid || isLoading || !canAnalyze
```

#### 2.2.2 UI 표시 텍스트
```typescript
// 남은 횟수 텍스트 (구독 상태로부터 생성 가능)
const remainingTriesText: string = `${subscriptionState.remainingTries}/${subscriptionState.maxTries}`

// 모델 선택 레이블 (폼 상태로부터 생성 가능)
const modelLabel: string = formState.modelType === 'flash' ? 'Gemini 2.5 Flash' : 'Gemini 2.5 Pro'
```

---

## 3. State Transition Table

### 3.1 폼 입력 상태 전환

| 현재 상태 | 트리거 (액션) | 조건 | 다음 상태 | 화면 변화 |
|---------|-------------|-----|---------|---------|
| name: '' | 사용자 입력 | - | name: '홍길동' | 입력 필드 값 업데이트 |
| birthDate: '' | 날짜 선택 | 유효한 날짜 | birthDate: '1990-01-15' | 날짜 필드 값 업데이트 |
| unknownBirthTime: false | '시간 모름' 체크 | - | unknownBirthTime: true, birthTime: null | 시간 입력 필드 비활성화 |
| modelType: 'flash' | 모델 선택 변경 | planType === 'Pro' | modelType: 'pro' | 라디오 버튼 선택 변경 |

### 3.2 검증 상태 전환

| 현재 상태 | 트리거 | 조건 | 다음 상태 | 화면 변화 |
|---------|-------|-----|---------|---------|
| errors.name: undefined | 폼 제출 시도 | name === '' | errors.name: '이름을 입력해주세요.' | 이름 필드 하단에 빨간색 에러 메시지 표시 |
| touched.birthDate: false | 날짜 필드 포커스 이탈 | - | touched.birthDate: true | 검증 활성화 (이후 입력마다 검증) |
| errors.birthDate: '유효하지 않음' | 올바른 날짜 입력 | 날짜 형식 유효 | errors.birthDate: undefined | 에러 메시지 제거 |

### 3.3 분석 요청 상태 전환

| 현재 상태 | 트리거 | 조건 | 다음 상태 | 화면 변화 |
|---------|-------|-----|---------|---------|
| status: 'idle' | '분석하기' 버튼 클릭 | isFormValid && canAnalyze | status: 'loading' | 로딩 스피너 표시, 버튼 비활성화 |
| status: 'loading' | API 응답 성공 | 200 OK | status: 'success' | 로딩 종료, 결과 모달 표시 |
| status: 'loading' | API 응답 실패 (403) | error.code === 'QUOTA_EXCEEDED' | status: 'error' | 토스트 알림 후 /subscription 리디렉션 |
| status: 'loading' | API 응답 실패 (403) | error.code === 'QUOTA_EXCEEDED_PRO' | status: 'error' | 토스트 알림, 현재 페이지 유지 |
| status: 'loading' | API 응답 실패 (503) | error.code === 'GEMINI_API_ERROR' | status: 'error' | 에러 토스트 표시 |
| status: 'error' | '다시 시도' 클릭 | - | status: 'idle' | 에러 상태 초기화 |

### 3.4 결과 모달 상태 전환

| 현재 상태 | 트리거 | 조건 | 다음 상태 | 화면 변화 |
|---------|-------|-----|---------|---------|
| showModal: false | 분석 성공 | status === 'success' | showModal: true | 요약 내용 모달 오픈 |
| showModal: true | '상세보기' 버튼 클릭 | - | showModal: false (+ 페이지 이동) | 모달 닫기, /analysis/[id] 이동 |
| showModal: true | 모달 외부 클릭 또는 X 버튼 | - | showModal: false | 모달 닫기 |

### 3.5 구독 상태 전환

| 현재 상태 | 트리거 | 조건 | 다음 상태 | 화면 변화 |
|---------|-------|-----|---------|---------|
| isLoading: false | 페이지 마운트 | - | isLoading: true | 로딩 표시 (skeleton UI) |
| isLoading: true | 구독 정보 로드 완료 | - | isLoading: false, planType/remainingTries 업데이트 | 실제 데이터 표시 |
| remainingTries: 3 | 분석 성공 | planType === 'Free' | remainingTries: 2 | 남은 횟수 배지 업데이트 (3/3 → 2/3) |
| remainingTries: 10 | 분석 성공 | planType === 'Pro' | remainingTries: 9 | 남은 횟수 배지 업데이트 (10/10 → 9/10) |

---

## 4. Flux Pattern Design

### 4.1 Flux 아키텍처 개요

```
┌──────────┐
│   User   │
│  Action  │ (사용자 입력, 버튼 클릭 등)
└────┬─────┘
     │
     ▼
┌─────────────────────────────────────────┐
│          Dispatcher (useReducer)        │
│  - 액션 타입에 따라 상태 업데이트 로직 실행 │
└────┬────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────┐
│         Store (Context State)           │
│  - FormState                            │
│  - ValidationState                      │
│  - RequestState                         │
│  - ResultState                          │
│  - SubscriptionState                    │
└────┬────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────┐
│              View (React)               │
│  - 상태 변화를 구독하고 UI 리렌더링        │
│  - 사용자 인터랙션을 액션으로 dispatch     │
└─────────────────────────────────────────┘
```

### 4.2 액션 정의 (Actions)

```typescript
type NewAnalysisAction =
  // 폼 입력 액션
  | { type: 'FORM/SET_NAME'; payload: string }
  | { type: 'FORM/SET_BIRTH_DATE'; payload: string }
  | { type: 'FORM/SET_BIRTH_TIME'; payload: string | null }
  | { type: 'FORM/SET_IS_LUNAR'; payload: boolean }
  | { type: 'FORM/SET_MODEL_TYPE'; payload: 'flash' | 'pro' }
  | { type: 'FORM/TOGGLE_UNKNOWN_TIME' }
  | { type: 'FORM/RESET' }

  // 검증 액션
  | { type: 'VALIDATION/SET_ERROR'; payload: { field: keyof FormState; message: string } }
  | { type: 'VALIDATION/CLEAR_ERROR'; payload: keyof FormState }
  | { type: 'VALIDATION/SET_TOUCHED'; payload: keyof FormState }
  | { type: 'VALIDATION/VALIDATE_ALL' }

  // 분석 요청 액션
  | { type: 'REQUEST/START' }
  | { type: 'REQUEST/SUCCESS'; payload: { analysisId: string; summary: string; detail: string; remainingTries: number } }
  | { type: 'REQUEST/FAILURE'; payload: AnalysisError }
  | { type: 'REQUEST/RESET' }

  // 모달 액션
  | { type: 'MODAL/OPEN' }
  | { type: 'MODAL/CLOSE' }

  // 구독 정보 액션
  | { type: 'SUBSCRIPTION/LOAD_START' }
  | { type: 'SUBSCRIPTION/LOAD_SUCCESS'; payload: { planType: 'Free' | 'Pro'; remainingTries: number; nextPaymentDate: string | null } }
  | { type: 'SUBSCRIPTION/LOAD_FAILURE' }
  | { type: 'SUBSCRIPTION/UPDATE_TRIES'; payload: number };
```

### 4.3 Reducer 로직

#### 4.3.1 Form Reducer
```typescript
function formReducer(state: FormState, action: NewAnalysisAction): FormState {
  switch (action.type) {
    case 'FORM/SET_NAME':
      return { ...state, name: action.payload };

    case 'FORM/SET_BIRTH_DATE':
      return { ...state, birthDate: action.payload };

    case 'FORM/SET_BIRTH_TIME':
      return { ...state, birthTime: action.payload };

    case 'FORM/SET_IS_LUNAR':
      return { ...state, isLunar: action.payload };

    case 'FORM/SET_MODEL_TYPE':
      return { ...state, modelType: action.payload };

    case 'FORM/TOGGLE_UNKNOWN_TIME':
      return {
        ...state,
        unknownBirthTime: !state.unknownBirthTime,
        birthTime: !state.unknownBirthTime ? null : state.birthTime,
      };

    case 'FORM/RESET':
      return initialFormState;

    default:
      return state;
  }
}
```

#### 4.3.2 Validation Reducer
```typescript
function validationReducer(state: ValidationState, action: NewAnalysisAction): ValidationState {
  switch (action.type) {
    case 'VALIDATION/SET_ERROR':
      return {
        ...state,
        errors: {
          ...state.errors,
          [action.payload.field]: action.payload.message,
        },
      };

    case 'VALIDATION/CLEAR_ERROR':
      const { [action.payload]: _, ...remainingErrors } = state.errors;
      return { ...state, errors: remainingErrors };

    case 'VALIDATION/SET_TOUCHED':
      return {
        ...state,
        touched: { ...state.touched, [action.payload]: true },
      };

    case 'VALIDATION/VALIDATE_ALL':
      // 모든 필드 검증 로직 실행
      return performFullValidation(state);

    default:
      return state;
  }
}
```

#### 4.3.3 Request Reducer
```typescript
function requestReducer(state: RequestState, action: NewAnalysisAction): RequestState {
  switch (action.type) {
    case 'REQUEST/START':
      return { status: 'loading', error: null };

    case 'REQUEST/SUCCESS':
      return { status: 'success', error: null };

    case 'REQUEST/FAILURE':
      return { status: 'error', error: action.payload };

    case 'REQUEST/RESET':
      return { status: 'idle', error: null };

    default:
      return state;
  }
}
```

#### 4.3.4 통합 Reducer (Combined Reducer)
```typescript
interface NewAnalysisState {
  form: FormState;
  validation: ValidationState;
  request: RequestState;
  result: ResultState;
  subscription: SubscriptionState;
}

function newAnalysisReducer(
  state: NewAnalysisState,
  action: NewAnalysisAction
): NewAnalysisState {
  return {
    form: formReducer(state.form, action),
    validation: validationReducer(state.validation, action),
    request: requestReducer(state.request, action),
    result: resultReducer(state.result, action),
    subscription: subscriptionReducer(state.subscription, action),
  };
}
```

### 4.4 Store (State Management)

```typescript
// 초기 상태
const initialState: NewAnalysisState = {
  form: {
    name: '',
    birthDate: '',
    birthTime: null,
    isLunar: false,
    modelType: 'flash',
    unknownBirthTime: false,
  },
  validation: {
    errors: {},
    touched: {
      name: false,
      birthDate: false,
      birthTime: false,
    },
  },
  request: {
    status: 'idle',
    error: null,
  },
  result: {
    analysisId: null,
    summary: null,
    detail: null,
    showModal: false,
  },
  subscription: {
    planType: 'Free',
    remainingTries: 0,
    maxTries: 3,
    nextPaymentDate: null,
    isLoading: true,
  },
};
```

### 4.5 View Layer (React Components)

#### 4.5.1 액션 핸들러 (Action Handlers)
```typescript
// 폼 입력 핸들러
const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  dispatch({ type: 'FORM/SET_NAME', payload: e.target.value });
  dispatch({ type: 'VALIDATION/SET_TOUCHED', payload: 'name' });
};

const handleBirthDateChange = (date: string) => {
  dispatch({ type: 'FORM/SET_BIRTH_DATE', payload: date });
  dispatch({ type: 'VALIDATION/SET_TOUCHED', payload: 'birthDate' });
};

const handleUnknownTimeToggle = () => {
  dispatch({ type: 'FORM/TOGGLE_UNKNOWN_TIME' });
};

// 분석 요청 핸들러
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();

  // 1. 전체 검증
  dispatch({ type: 'VALIDATION/VALIDATE_ALL' });

  // 2. 검증 실패 시 중단
  if (!isFormValid) return;

  // 3. 요청 시작
  dispatch({ type: 'REQUEST/START' });

  try {
    // 4. API 호출
    const response = await apiClient.post('/api/analyses', {
      name: state.form.name,
      birthDate: state.form.birthDate,
      birthTime: state.form.birthTime,
      isLunar: state.form.isLunar,
      modelType: state.form.modelType,
    });

    // 5. 성공 처리
    dispatch({
      type: 'REQUEST/SUCCESS',
      payload: {
        analysisId: response.data.analysisId,
        summary: response.data.summary,
        detail: response.data.detail,
        remainingTries: response.data.remainingTries,
      },
    });

    // 6. 모달 오픈
    dispatch({ type: 'MODAL/OPEN' });

    // 7. 구독 횟수 업데이트
    dispatch({
      type: 'SUBSCRIPTION/UPDATE_TRIES',
      payload: response.data.remainingTries,
    });
  } catch (error) {
    // 8. 에러 처리
    const apiError = parseApiError(error);
    dispatch({ type: 'REQUEST/FAILURE', payload: apiError });

    // 9. 횟수 소진 처리
    if (apiError.code === 'QUOTA_EXCEEDED') {
      // Free 플랜 횟수 소진 → 구독 페이지 리디렉션
      router.push('/subscription');
    } else if (apiError.code === 'QUOTA_EXCEEDED_PRO') {
      // Pro 플랜 횟수 소진 → 토스트 알림만 표시
      toast.warning('이번 달 분석 횟수를 모두 사용했습니다.', {
        description: `다음 결제일(${apiError.details?.nextPaymentDate})에 횟수가 갱신됩니다.`,
      });
    }
  }
};
```

#### 4.5.2 View 렌더링
```typescript
// Computed Values
const isFormValid = useMemo(() => {
  return (
    state.form.name.trim() !== '' &&
    state.form.birthDate !== '' &&
    Object.keys(state.validation.errors).length === 0
  );
}, [state.form, state.validation.errors]);

const canAnalyze = state.subscription.remainingTries > 0;
const canSelectModel = state.subscription.planType === 'Pro';
const isLoading = state.request.status === 'loading';
const isButtonDisabled = !isFormValid || isLoading || !canAnalyze;

// UI 렌더링
return (
  <form onSubmit={handleSubmit}>
    {/* 남은 횟수 배지 */}
    <Badge variant={canAnalyze ? 'default' : 'destructive'}>
      {state.subscription.remainingTries}/{state.subscription.maxTries}
    </Badge>

    {/* 폼 필드 */}
    <Input
      value={state.form.name}
      onChange={handleNameChange}
      error={state.validation.errors.name}
    />

    {/* 모델 선택 (Pro 사용자만) */}
    {canSelectModel && (
      <RadioGroup value={state.form.modelType} onChange={handleModelChange}>
        <Radio value="flash">Gemini 2.5 Flash</Radio>
        <Radio value="pro">Gemini 2.5 Pro</Radio>
      </RadioGroup>
    )}

    {/* 제출 버튼 */}
    <Button type="submit" disabled={isButtonDisabled}>
      {isLoading ? '분석 중...' : '분석하기'}
    </Button>

    {/* 결과 모달 */}
    {state.result.showModal && (
      <Modal onClose={() => dispatch({ type: 'MODAL/CLOSE' })}>
        <p>{state.result.summary}</p>
        <Button onClick={() => router.push(`/analysis/${state.result.analysisId}`)}>
          상세보기
        </Button>
      </Modal>
    )}
  </form>
);
```

---

## 5. Context Design

### 5.1 Context 구조

```typescript
interface NewAnalysisContextValue {
  // 상태
  state: NewAnalysisState;

  // Computed Values
  isFormValid: boolean;
  canAnalyze: boolean;
  canSelectModel: boolean;
  isLoading: boolean;
  isButtonDisabled: boolean;

  // 액션 함수
  actions: {
    // 폼 관련
    setName: (name: string) => void;
    setBirthDate: (date: string) => void;
    setBirthTime: (time: string | null) => void;
    setIsLunar: (isLunar: boolean) => void;
    setModelType: (modelType: 'flash' | 'pro') => void;
    toggleUnknownTime: () => void;
    resetForm: () => void;

    // 검증 관련
    setFieldTouched: (field: keyof FormState) => void;
    validateAll: () => boolean;

    // 분석 요청 관련
    submitAnalysis: () => Promise<void>;

    // 모달 관련
    openModal: () => void;
    closeModal: () => void;
  };
}
```

### 5.2 Provider 구현 개요

```typescript
export function NewAnalysisProvider({ children }: { children: ReactNode }) {
  // 1. useReducer로 상태 관리
  const [state, dispatch] = useReducer(newAnalysisReducer, initialState);

  // 2. 구독 정보 로드 (페이지 마운트 시)
  useEffect(() => {
    async function loadSubscription() {
      dispatch({ type: 'SUBSCRIPTION/LOAD_START' });
      try {
        const subscription = await fetchSubscription();
        dispatch({
          type: 'SUBSCRIPTION/LOAD_SUCCESS',
          payload: subscription,
        });
      } catch (error) {
        dispatch({ type: 'SUBSCRIPTION/LOAD_FAILURE' });
      }
    }
    loadSubscription();
  }, []);

  // 3. Computed Values
  const isFormValid = useMemo(() => {
    // 검증 로직
  }, [state.form, state.validation]);

  const canAnalyze = state.subscription.remainingTries > 0;
  const canSelectModel = state.subscription.planType === 'Pro';
  const isLoading = state.request.status === 'loading';
  const isButtonDisabled = !isFormValid || isLoading || !canAnalyze;

  // 4. 액션 함수
  const actions = useMemo(
    () => ({
      setName: (name: string) =>
        dispatch({ type: 'FORM/SET_NAME', payload: name }),
      setBirthDate: (date: string) =>
        dispatch({ type: 'FORM/SET_BIRTH_DATE', payload: date }),
      // ... 나머지 액션 함수들
      submitAnalysis: async () => {
        // 분석 요청 로직
      },
    }),
    [dispatch]
  );

  // 5. Context Value
  const value: NewAnalysisContextValue = {
    state,
    isFormValid,
    canAnalyze,
    canSelectModel,
    isLoading,
    isButtonDisabled,
    actions,
  };

  return (
    <NewAnalysisContext.Provider value={value}>
      {children}
    </NewAnalysisContext.Provider>
  );
}
```

### 5.3 하위 컴포넌트에 노출할 인터페이스

#### 5.3.1 읽기 전용 상태 (Read-only State)
```typescript
// 폼 상태
state.form.name: string
state.form.birthDate: string
state.form.birthTime: string | null
state.form.isLunar: boolean
state.form.modelType: 'flash' | 'pro'
state.form.unknownBirthTime: boolean

// 검증 상태
state.validation.errors: Record<string, string>
state.validation.touched: Record<string, boolean>

// 요청 상태
state.request.status: 'idle' | 'loading' | 'success' | 'error'
state.request.error: AnalysisError | null

// 결과 상태
state.result.analysisId: string | null
state.result.summary: string | null
state.result.showModal: boolean

// 구독 상태
state.subscription.planType: 'Free' | 'Pro'
state.subscription.remainingTries: number
state.subscription.maxTries: number
state.subscription.nextPaymentDate: string | null
```

#### 5.3.2 계산된 값 (Computed Values)
```typescript
isFormValid: boolean
canAnalyze: boolean
canSelectModel: boolean
isLoading: boolean
isButtonDisabled: boolean
```

#### 5.3.3 액션 함수 (Action Functions)
```typescript
// 폼 업데이트
actions.setName(name: string): void
actions.setBirthDate(date: string): void
actions.setBirthTime(time: string | null): void
actions.setIsLunar(isLunar: boolean): void
actions.setModelType(modelType: 'flash' | 'pro'): void
actions.toggleUnknownTime(): void
actions.resetForm(): void

// 검증
actions.setFieldTouched(field: keyof FormState): void
actions.validateAll(): boolean

// 분석 요청
actions.submitAnalysis(): Promise<void>

// 모달 제어
actions.openModal(): void
actions.closeModal(): void
```

### 5.4 Context 데이터 흐름도

```
┌────────────────────────────────────────────────────────┐
│           NewAnalysisProvider (Root)                   │
│                                                        │
│  1. useReducer(newAnalysisReducer, initialState)      │
│  2. useEffect(() => loadSubscription(), [])           │
│  3. useMemo(() => computeValues(), [state])           │
│  4. useMemo(() => createActions(), [dispatch])        │
│                                                        │
│  ┌──────────────────────────────────────────────┐     │
│  │      NewAnalysisContext.Provider             │     │
│  │  value = { state, computed, actions }        │     │
│  └───────────────┬──────────────────────────────┘     │
└──────────────────┼─────────────────────────────────────┘
                   │
                   ├─────────────────────────────────────┐
                   │                                     │
         ┌─────────▼──────────┐              ┌──────────▼─────────┐
         │  FormSection       │              │  SubscriptionInfo  │
         │                    │              │                    │
         │ - state.form.*     │              │ - state.subscription │
         │ - actions.setName  │              │ - canAnalyze       │
         │ - actions.setBirth*│              │ - remainingTries   │
         └────────────────────┘              └────────────────────┘
                   │
         ┌─────────▼──────────┐
         │  ModelSelector     │
         │                    │
         │ - canSelectModel   │
         │ - state.form.model │
         │ - actions.setModel │
         └────────────────────┘
                   │
         ┌─────────▼──────────┐
         │  SubmitButton      │
         │                    │
         │ - isButtonDisabled │
         │ - isLoading        │
         │ - actions.submit   │
         └────────────────────┘
                   │
         ┌─────────▼──────────┐
         │  ResultModal       │
         │                    │
         │ - state.result.*   │
         │ - actions.closeModal│
         └────────────────────┘
```

---

## 6. Implementation Guidelines

### 6.1 파일 구조
```
src/features/new-analysis/
├── context/
│   ├── NewAnalysisContext.tsx        # Context 및 Provider
│   ├── newAnalysisReducer.ts         # Reducer 로직
│   ├── actions.ts                    # 액션 타입 정의
│   └── initialState.ts               # 초기 상태
├── components/
│   ├── NewAnalysisForm.tsx           # 메인 폼 컴포넌트
│   ├── FormSection.tsx               # 입력 필드 섹션
│   ├── ModelSelector.tsx             # 모델 선택 UI (Pro 전용)
│   ├── SubmitButton.tsx              # 분석하기 버튼
│   ├── ResultModal.tsx               # 결과 모달
│   └── SubscriptionBadge.tsx         # 남은 횟수 배지
├── hooks/
│   ├── useNewAnalysis.ts             # Context 훅
│   ├── useFormValidation.ts          # 검증 로직 훅
│   └── useAnalysisSubmit.ts          # 분석 요청 훅
└── lib/
    ├── validation.ts                 # 검증 함수
    └── apiClient.ts                  # API 호출 함수
```

### 6.2 성능 최적화

#### 6.2.1 메모이제이션
```typescript
// Computed Values는 useMemo로 메모이제이션
const isFormValid = useMemo(() => {
  // 검증 로직
}, [state.form, state.validation.errors]);

// 액션 함수는 useCallback 또는 actions 객체를 useMemo로 메모이제이션
const actions = useMemo(() => ({
  setName: (name: string) => dispatch({ type: 'FORM/SET_NAME', payload: name }),
  // ...
}), [dispatch]);
```

#### 6.2.2 컴포넌트 분리
- 각 폼 필드를 독립된 컴포넌트로 분리하여 불필요한 리렌더링 방지
- React.memo로 순수 컴포넌트 최적화

### 6.3 에러 처리

#### 6.3.1 클라이언트 검증
```typescript
// 실시간 검증 (필드 포커스 이탈 시)
const validateField = (field: keyof FormState, value: any) => {
  if (field === 'name' && value.trim() === '') {
    dispatch({
      type: 'VALIDATION/SET_ERROR',
      payload: { field: 'name', message: '이름을 입력해주세요.' },
    });
  } else {
    dispatch({ type: 'VALIDATION/CLEAR_ERROR', payload: field });
  }
};
```

#### 6.3.2 API 에러 처리
```typescript
// 에러 코드별 분기 처리
const handleApiError = (error: AnalysisError) => {
  switch (error.code) {
    case 'QUOTA_EXCEEDED':
      // Free 플랜 횟수 소진 → 리디렉션
      router.push('/subscription');
      break;

    case 'QUOTA_EXCEEDED_PRO':
      // Pro 플랜 횟수 소진 → 토스트 알림
      toast.warning('횟수 소진', {
        description: `다음 결제일(${error.details?.nextPaymentDate})에 갱신됩니다.`,
      });
      break;

    case 'GEMINI_API_ERROR':
      // Gemini API 오류 → 재시도 안내
      toast.error('분석 실패', {
        description: '잠시 후 다시 시도해주세요.',
      });
      break;

    default:
      toast.error('오류 발생', {
        description: error.message,
      });
  }
};
```

### 6.4 테스트 고려사항

#### 6.4.1 Reducer 단위 테스트
```typescript
describe('newAnalysisReducer', () => {
  it('should update name on FORM/SET_NAME action', () => {
    const state = initialState;
    const action = { type: 'FORM/SET_NAME', payload: '홍길동' };
    const nextState = newAnalysisReducer(state, action);
    expect(nextState.form.name).toBe('홍길동');
  });

  // ... 나머지 액션 테스트
});
```

#### 6.4.2 통합 테스트
```typescript
describe('NewAnalysisProvider', () => {
  it('should load subscription on mount', async () => {
    render(
      <NewAnalysisProvider>
        <TestComponent />
      </NewAnalysisProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/3\/3/)).toBeInTheDocument();
    });
  });
});
```

---

## 7. Summary

### 7.1 핵심 설계 원칙
1. **단방향 데이터 흐름**: Flux 패턴을 통한 예측 가능한 상태 관리
2. **단일 책임 원칙**: 각 Reducer는 하나의 상태 도메인만 관리
3. **불변성 보장**: 모든 상태 업데이트는 새로운 객체 생성
4. **계층적 구조**: Context → Provider → Components 계층 분리
5. **성능 최적화**: useMemo, useCallback, React.memo 활용

### 7.2 주요 상태 흐름
1. 사용자 인터랙션 → 액션 dispatch
2. Reducer가 액션 처리 → 새로운 상태 생성
3. Context가 상태 변경 감지 → 하위 컴포넌트 리렌더링
4. 컴포넌트가 최신 상태로 UI 업데이트

### 7.3 확장 가능성
- 추가 모델 선택 옵션 지원 (향후 Gemini 2.0 Ultra 등)
- 분석 히스토리 임시 저장 (localStorage 연동)
- 분석 결과 공유 기능 추가 시 ResultState 확장

---

## 8. References

### 8.1 내부 문서
- PRD: `/docs/prd.md`
- Userflow: `/docs/userflow.md` (Flow 2, 3, 5, 6)
- Database: `/docs/database.md`
- UC-002: `/docs/usecases/002/spec.md`
- UC-003: `/docs/usecases/003/spec.md`
- UC-005: `/docs/usecases/005/spec.md`
- UC-006: `/docs/usecases/006/spec.md`

### 8.2 기술 스택
- React 18+ (useReducer, Context API)
- TypeScript 5+
- Zod (스키마 검증)
- React Query (서버 상태 관리)
- Sonner (Toast 알림)

---

**Document Version**: 1.0
**Last Updated**: 2025-10-25
**Author**: Claude Code
**Status**: ✅ Ready for Implementation
