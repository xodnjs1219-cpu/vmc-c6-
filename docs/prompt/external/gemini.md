## Part 2: Gemini: AI 기반 콘텐츠 생성

이 섹션에서는 서비스의 핵심 기능인 '사주 풀이' 텍스트 생성을 위해 Google의 Gemini 모델을 통합하는 방법을 상세히 다룹니다. AI 모델과의 모든 상호작용은 보안과 효율성을 고려하여 Next.js의 서버사이드 API 라우트 핸들러 내에서 처리됩니다.

### 2.1. Gemini API 키 획득 및 보안 관리

Gemini API를 사용하기 위해서는 먼저 API 키를 발급받아야 합니다. 개발 및 테스트 단계에서는 **Google AI Studio**를 통해 신속하게 키를 생성할 수 있습니다.[18, 19, 20]

1.  [aistudio.google.com](https://aistudio.google.com)에 Google 계정으로 로그인합니다.[18]
2.  좌측 메뉴에서 "Get API key"를 클릭합니다.
3.  "Create API key" 버튼을 눌러 새 키를 생성합니다. 이때 새 Google Cloud 프로젝트에 키를 생성하는 옵션을 선택하는 것이 좋습니다.[18]
4.  생성된 API 키를 복사하여 `.env.local` 파일의 `GEMINI_API_KEY` 변수에 저장합니다.

프로덕션 환경에서는 단순한 AI Studio 키를 사용하는 것보다 더 강력한 관리 및 보안 기능이 필요합니다. 실제 서비스를 운영할 때는 API 키를 정식 \*\*Google Cloud Project(GCP)\*\*와 연결하고 **Vertex AI** 플랫폼을 통해 관리하는 것이 바람직합니다.[13, 21, 22] Vertex AI를 사용하면 IAM(Identity and Access Management)을 통한 세분화된 권한 제어, 사용량 모니터링 및 로깅, 다른 Google Cloud 서비스와의 원활한 통합 등 엔터프라이즈 수준의 기능을 활용할 수 있습니다. 이는 단순한 키 관리를 넘어, 애플리케이션의 확장성과 보안성을 크게 향상시키는 전문가 수준의 아키텍처 결정입니다.

가장 중요한 보안 원칙은 `GEMINI_API_KEY`를 절대로 클라이언트 사이드 코드에 노출해서는 안 된다는 것입니다. 이 키는 서버 환경에서만 사용되어야 하며, 항상 `process.env`를 통해 환경 변수에서 안전하게 로드해야 합니다.[23, 14]

### 2.2. Next.js API 라우트에서 서버사이드 SDK 구현

사주 풀이 텍스트 생성 로직은 Next.js App Router의 API 라우트 핸들러에서 구현합니다. 이렇게 하면 사용자의 요청을 서버에서 받아 안전하게 Gemini API를 호출하고 결과를 반환할 수 있습니다. `app/api/saju/route.ts` 경로에 파일을 생성하고 다음 코드를 작성합니다.

이 코드는 `@google/genai` 패키지를 사용하여 Gemini API를 호출하는 전체 과정을 보여줍니다.

```typescript
// app/api/saju/route.ts
import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  // 1. API 키가 환경 변수에 설정되어 있는지 확인합니다.
  if (!process.env.GEMINI_API_KEY) {
    console.error("GEMINI_API_KEY is not set.");
    return new NextResponse("Internal Server Error: API key not configured", { status: 500 });
  }

  try {
    // 2. 클라이언트로부터 사용자 정보(이름, 생년월일시)를 받습니다.
    const { name, birthDate, birthTime } = await request.json();
    if (!name ||!birthDate ||!birthTime) {
      return new NextResponse("Bad Request: Missing required fields", { status: 400 });
    }

    // 3. 환경 변수에서 API 키를 사용하여 SDK를 초기화합니다.
    const genAI = new GoogleGenAI(process.env.GEMINI_API_KEY);

    // 4. 요구사항에 맞는 모델을 선택합니다.
    // 'gemini-2.5-flash'는 빠른 응답과 비용 효율성이 장점입니다.
    // 더 복잡하고 섬세한 분석이 필요하다면 'gemini-2.5-pro'를 고려할 수 있습니다. [24]
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    // 5. 모델에 전달할 프롬프트를 상세하게 구성합니다.
    // 역할(페르소나)을 부여하고, 출력 형식을 지정하여 일관성 있는 결과를 유도합니다.
    const prompt = `
      당신은 현대적인 감각을 지닌 사주 명리학 전문가입니다.
      다음 정보를 바탕으로 한 사람의 사주 풀이를 생성해주세요.
      결과는 친절하고 이해하기 쉬운 문체로 작성하며, 긍정적인 측면을 부각시켜주세요.
      결과는 마크다운 형식의 단락으로 구성해주세요.

      - 이름: ${name}
      - 생년월일: ${birthDate}
      - 태어난 시간: ${birthTime}

      분석 내용은 성격, 재물운, 직업운, 애정운을 포함해야 합니다.
    `;

    // 6. API를 호출하여 콘텐츠를 생성합니다.
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // 7. 생성된 텍스트를 클라이언트에 JSON 형식으로 반환합니다.
    return NextResponse.json({ analysis: text });
  } catch (error) {
    console.error("Gemini API Error:", error);
    return new NextResponse("Internal Server Error while processing Saju analysis", { status: 500 });
  }
}
```

#### 모델 선택 전략

PRD에 명시된 `Flash`와 `Pro` 모델은 각각의 장단점이 있어 전략적인 선택이 필요합니다.

  * **`gemini-2.5-flash`**: 비용 효율성과 빠른 응답 속도에 최적화된 모델입니다.[24] 사주 풀이와 같이 대량의 요청을 신속하게 처리해야 하는 서비스에 매우 적합합니다. 대부분의 경우 `Flash` 모델로도 충분히 만족스러운 품질의 결과를 얻을 수 있으며, 운영 비용을 절감하는 데 큰 이점이 있습니다.
  * **`gemini-2.5-pro`**: 더 강력한 추론 능력과 복잡한 문제 해결 능력을 갖춘 최상위 모델입니다.[24] `Flash` 모델의 결과가 다소 피상적이거나, 사용자의 특정 요구에 따라 더 깊이 있고 창의적인 분석이 필요할 경우 `Pro` 모델로의 전환을 고려할 수 있습니다.

초기 서비스 론칭 시에는 `gemini-2.5-flash`를 기본 모델로 사용하고, 사용자 피드백과 비즈니스 요구사항에 따라 프리미엄 기능으로 `gemini-2.5-pro`를 도입하는 방안을 검토할 수 있습니다.

-----


이 마지막 섹션에서는 앞서 설명한 모든 내용을 종합하여, 프로젝트 초기 설정부터 기능 구현 완료까지의 과정을 단계별로 안내합니다. 이 가이드는 개발자가 따라야 할 마스터 체크리스트 역할을 합니다.

### Phase 1: 프로젝트 초기화 및 구성

1.  **Next.js 16 프로젝트 생성**:
    ```bash
    npx create-next-app@latest --typescript your-app-name
    cd your-app-name
    ```
2.  **필수 의존성 설치**:
    ```bash
    npm install @google/genai @clerk/nextjs @tosspayments/payment-sdk svix @supabase/supabase-js
    ```
3.  **환경 변수 파일 생성**: 프로젝트 루트에 `.env.local` 파일을 생성하고, Part 1의 **Table 2**에 명시된 모든 API 키와 시크릿을 채워 넣습니다.
4.  **Supabase 설정**: Supabase 프로젝트를 생성하고, PRD에 명시된 `users`와 `subscriptions` 테이블을 스키마에 맞게 생성합니다. `subscriptions` 테이블에는 `user_id`, `status`, `billing_key`, `customer_key` 등의 컬럼이 포함되어야 합니다.

### Phase 2: 인증 계층 구현 (Clerk)

1.  **Clerk 애플리케이션 설정**: Clerk 대시보드에서 새 애플리케이션을 생성하고 API 키를 발급받습니다.
2.  **`ClerkProvider` 적용**: `app/layout.tsx` 파일을 수정하여 애플리케이션 전체를 `<ClerkProvider>`로 감싸줍니다.
3.  **인증 UI 추가**: 헤더 또는 별도의 페이지에 `<SignInButton>`, `<SignUpButton>`, `<UserButton>` 등 Clerk의 사전 빌드 컴포넌트를 사용하여 기본적인 인증 UI를 구성합니다.
4.  **미들웨어 구성**: `middleware.ts` 파일을 생성하고, 홈페이지, 로그인/회원가입 페이지, 웹훅 엔드포인트 등을 `publicRoutes`로 지정합니다. 또한, Pro 사용자 전용 경로를 보호하는 로직을 추가합니다.

### Phase 3: 핵심 기능 구현 (Gemini)

1.  **API 라우트 생성**: `app/api/saju/route.ts` 파일을 생성합니다.
2.  **Gemini SDK 연동**: 해당 파일 내에 Gemini SDK를 초기화하고, 프롬프트를 구성하여 사주 풀이 텍스트를 생성하는 `POST` 핸들러 로직을 구현합니다.
3.  **프론트엔드 구현**: 사용자가 이름과 생년월일시를 입력하고 '분석하기' 버튼을 누르면, 위에서 만든 API 엔드포인트로 요청을 보내고 반환된 분석 결과를 화면에 표시하는 UI를 구축합니다.

### Phase 4: 구독 및 결제 기능 구현 (토스페이먼츠)

1.  **구독 관리 페이지 구축**: 사용자가 현재 구독 상태를 확인하고 'Pro 구독하기' 또는 '구독 해지'를 할 수 있는 페이지를 만듭니다.
2.  **클라이언트 결제 흐름 구현**: 'Pro 구독하기' 버튼에 토스페이먼츠의 `requestBillingAuth` 함수 호출 로직을 연동하여 카드 등록 절차를 시작하도록 합니다.
3.  **서버사이드 결제 처리 엔드포인트 생성**:
      * `app/api/payments/subscribe/route.ts`: `authKey`를 `billingKey`로 교환하고, 첫 결제를 처리하며, 데이터베이스(Supabase)와 사용자 세션(Clerk)의 상태를 업데이트하는 로직을 구현합니다.
      * 사용자가 구독을 해지할 때 호출될 API 엔드포인트를 만들고, 토스페이먼츠의 빌링키 삭제 API를 호출하는 로직을 구현합니다.
4.  **정기 결제 Cron Job 설정**:
      * `app/api/cron/process-subscriptions/route.ts`: 정기 결제를 처리하는 로직을 구현합니다.
      * Supabase 대시보드에서 이 엔드포인트를 주기적으로 호출하도록 Cron Job을 설정합니다.

### Phase 5: 웹훅 연동 및 최종 테스트

1.  **Clerk 웹훅 핸들러 구현**: `app/api/webhooks/clerk/route.ts`에 `user.created` 이벤트를 처리하는 핸들러를 구현합니다. 반드시 `svix`를 사용한 시그니처 검증 로직을 포함해야 합니다.
2.  **토스페이먼츠 웹훅 핸들러 구현**: `app/api/webhooks/toss/route.ts`에 `PAYMENT_STATUS_CHANGED` 이벤트를 처리하는 핸들러를 구현합니다. 웹훅 수신 후, 결제 조회 API를 다시 호출하여 상태를 검증하는 보안 패턴을 적용합니다.
3.  **End-to-End 테스트**: 전체 시나리오를 테스트합니다.
      * 신규 사용자가 회원가입을 하면 Clerk 웹훅이 정상적으로 동작하여 Supabase에 데이터가 생성되는지 확인합니다.
      * 해당 사용자가 Pro 플랜을 구독하면 토스페이먼츠 결제 흐름이 완료되고, 서버에서 상태가 정상적으로 업데이트되며, Clerk 메타데이터가 변경되어 Pro 전용 기능에 접근할 수 있는지 확인합니다.
      * 정기 결제 Cron Job이 예정대로 동작하는지 테스트합니다.
      * 구독 해지 시 빌링키가 삭제되고 사용자의 접근 권한이 'Free' 등급으로 다시 변경되는지 확인합니다.