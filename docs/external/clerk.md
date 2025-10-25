## Part 3: Clerk: 포괄적인 사용자 인증 및 접근 제어

이 섹션에서는 Clerk을 사용하여 사용자 인증, 세션 관리, 그리고 PRD에서 요구하는 '무료/유료 사용자' 구분을 위한 접근 제어 시스템을 구현하는 전체 과정을 안내합니다. Clerk의 강력한 기능들을 활용하여 안전하고 차별화된 사용자 경험을 구축합니다.

### 3.1. 사전 빌드 컴포넌트를 활용한 클라이언트 사이드 설정

Clerk은 개발자가 인증 UI를 빠르고 쉽게 구축할 수 있도록 다양한 사전 빌드(pre-built) React 컴포넌트를 제공합니다. 이를 활용하면 복잡한 인증 로직을 직접 구현할 필요 없이 몇 줄의 코드로 회원가입, 로그인, 사용자 프로필 관리 기능을 완성할 수 있습니다.

1.  **설치 및 환경 변수 설정**: 먼저 `@clerk/nextjs` 패키지를 설치합니다.[25]

    ```bash
    npm install @clerk/nextjs
    ```

    그 다음, Clerk 대시보드에서 발급받은 `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`와 `CLERK_SECRET_KEY`를 `.env.local` 파일에 추가합니다.[12]

2.  **`ClerkProvider` 설정**: 애플리케이션 전체에서 Clerk의 인증 컨텍스트를 사용하기 위해, 루트 레이아웃 파일(`app/layout.tsx`)을 `<ClerkProvider>` 컴포넌트로 감싸줍니다.[12, 25]

    ```tsx
    // app/layout.tsx
    import { ClerkProvider } from '@clerk/nextjs';
    import { koKR } from "@clerk/localizations"; // 한국어 로케일 지원

    export default function RootLayout({
      children,
    }: {
      children: React.ReactNode
    }) {
      return (
        <ClerkProvider localization={koKR}>
          <html lang="ko">
            <body>{children}</body>
          </html>
        </ClerkProvider>
      )
    }
    ```

    `localization` 속성을 통해 Clerk 컴포넌트의 언어를 한국어로 설정할 수 있습니다.

3.  **인증 UI 컴포넌트 사용**: PRD에 명시된 대로, Clerk이 기본 제공하는 UI/Flow를 사용하여 `/sign-in`, `/sign-up` 페이지를 렌더링하고 사용자 버튼을 헤더에 추가합니다. `<SignedIn>`, `<SignedOut>` 컴포넌트를 사용하면 사용자의 로그인 상태에 따라 조건부로 UI를 렌더링할 수 있습니다.[25, 26]

    ```tsx
    // components/Header.tsx
    import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";

    export default function Header() {
      return (
        <header>
          <nav>
            {/* 로그인 상태일 때 UserButton 표시 */}
            <SignedIn>
              <UserButton afterSignOutUrl="/" />
            </SignedIn>
            {/* 로그아웃 상태일 때 SignInButton 표시 */}
            <SignedOut>
              <SignInButton />
            </SignedOut>
          </nav>
        </header>
      );
    }
    ```

### 3.2. Next.js 미들웨어를 통한 서버사이드 보호 ("기능 접근 가드")

Clerk의 핵심적인 서버사이드 보호 기능은 Next.js 미들웨어를 통해 구현됩니다. 미들웨어는 모든 요청 또는 특정 경로의 요청에 대해 실행되어, 페이지나 API에 도달하기 전에 사용자의 인증 상태를 확인하고 접근을 제어합니다.[27]

1.  **미들웨어 파일 생성**: 프로젝트 루트 디렉터리에 `middleware.ts` 파일을 생성합니다.[25, 28]

2.  **'Free' vs 'Pro' 사용자 구분을 위한 역할 기반 접근 제어(RBAC) 구현**: PRD는 무료 사용자와 유료(Pro) 사용자를 구분하는 '기능 접근 가드'를 요구합니다. 이를 구현하는 가장 효율적이고 권장되는 방법은 Clerk의 \*\*사용자 메타데이터(metadata)\*\*를 활용하는 것입니다.[29] Clerk의 '조직(Organizations)' 기능에 포함된 역할 시스템은 이 프로젝트의 요구사항에는 과도하며, `publicMetadata`를 사용하는 것이 훨씬 간단하고 빠릅니다.

      * **구현 전략**:
        1.  사용자가 회원가입하면(Part 3.3 웹훅 처리) 또는 구독 상태가 변경되면(Part 4.2 API 처리), 해당 사용자의 `publicMetadata`에 `{ "subscription": "Free" }` 또는 `{ "subscription": "Pro" }`와 같이 구독 상태를 저장합니다.
        2.  Clerk 대시보드의 **Sessions** 설정에서 JWT 템플릿을 수정하여 이 `publicMetadata`가 세션 토큰에 포함되도록 설정합니다. 이렇게 하면 매번 데이터베이스를 조회할 필요 없이 미들웨어에서 사용자의 구독 등급을 즉시 확인할 수 있어 성능상 큰 이점을 가집니다.[29]
        3.  미들웨어 내에서 `auth()` 헬퍼의 `sessionClaims`를 통해 토큰에 포함된 메타데이터를 읽어와 접근 제어 로직을 구현합니다.

    다음은 인증 상태와 구독 등급에 따라 특정 경로를 보호하는 `middleware.ts`의 전체 코드입니다.

    ```typescript
    // middleware.ts
    import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
    import { NextResponse } from 'next/server';

    // Pro 플랜 사용자만 접근 가능한 경로를 정의합니다.
    const isProtectedRoute = createRouteMatcher([
      '/pro-feature(.*)', // 예: Pro 사용자 전용 기능 페이지
      '/api/pro-only(.*)', // 예: Pro 사용자 전용 API
    ]);

    export default clerkMiddleware((auth, req) => {
      const { userId, sessionClaims } = auth();

      // 보호된 경로에 접근하려는 경우
      if (isProtectedRoute(req)) {
        // 로그인하지 않은 사용자는 로그인 페이지로 리디렉션합니다.
        if (!userId) {
          const signInUrl = new URL('/sign-in', req.url);
          signInUrl.searchParams.set('redirect_url', req.url);
          return NextResponse.redirect(signInUrl);
        }

        // 로그인했지만 Pro 등급이 아닌 경우, 구독 페이지로 리디렉션합니다.
        const userSubscription = (sessionClaims?.metadata as any)?.subscription;
        if (userSubscription!== 'Pro') {
          const upgradeUrl = new URL('/subscribe', req.url);
          return NextResponse.redirect(upgradeUrl);
        }
      }

      // 그 외의 경우는 요청을 그대로 통과시킵니다.
      return NextResponse.next();
    });

    export const config = {
      matcher: [
        // Next.js 내부 파일 및 정적 파일을 제외한 모든 경로에서 미들웨어를 실행합니다.
        '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
        // API 및 tRPC 경로에서는 항상 미들웨어를 실행합니다.
        '/(api|trpc)(.*)',
      ],
    };
    ```

### 3.3. 웹훅 통합: Supabase에 사용자 데이터 동기화

PRD의 "Clerk Webhook 정책"에 따라, 새로운 사용자가 생성될 때마다(`user.created` 이벤트) Supabase 데이터베이스에 해당 사용자 정보를 동기화해야 합니다. 이를 위해 `/api/webhooks/clerk` 엔드포인트를 구현합니다.

1.  **웹훅 엔드포인트 생성**: `app/api/webhooks/clerk/route.ts` 경로에 API 라우트 핸들러를 생성합니다.

2.  **웹훅 라우트 공개 설정**: 웹훅 요청은 Clerk 서버로부터 직접 오기 때문에 인증 세션이 없습니다. 따라서 미들웨어 설정에서 이 경로를 공개(public)로 지정해야 합니다. `middleware.ts` 파일의 `clerkMiddleware` 설정에 `publicRoutes`를 추가합니다.[15, 30]

    ```typescript
    // middleware.ts (일부)
    export default clerkMiddleware(
      (auth, req) => { /*... */ },
      {
        publicRoutes: ["/", "/api/webhooks/clerk", "/api/webhooks/toss"],
      }
    );
    ```

3.  **Clerk 대시보드 설정**:

      * Clerk 대시보드의 **Webhooks** 메뉴로 이동하여 "Add Endpoint"를 클릭합니다.
      * Endpoint URL에 배포된 애플리케이션의 웹훅 주소(예: `https://your-domain.com/api/webhooks/clerk`)를 입력합니다. 로컬 테스트 시에는 `ngrok`과 같은 터널링 도구를 사용해야 합니다.[15, 31]
      * "Filter events"에서 `user.created` 이벤트를 구독합니다.
      * 엔드포인트를 생성한 후, **Signing Secret**을 복사하여 `.env.local` 파일의 `CLERK_WEBHOOK_SIGNING_SECRET` 변수에 저장합니다.[15]

4.  **시그니처 검증 및 데이터 처리**: 웹훅 핸들러는 수신된 요청이 실제로 Clerk에서 보낸 것인지 확인하기 위해 반드시 시그니처를 검증해야 합니다. Clerk은 내부적으로 Svix 라이브러리를 사용하므로, 동일한 라이브러리를 사용하여 검증을 수행합니다.[32]

    다음은 시그니처 검증과 Supabase 데이터 동기화 로직을 포함한 웹훅 핸들러의 전체 코드입니다.

    ```typescript
    // app/api/webhooks/clerk/route.ts
    import { Webhook } from 'svix';
    import { headers } from 'next/headers';
    import { WebhookEvent } from '@clerk/nextjs/server';
    import { supabase } from '@/lib/supabaseClient'; // Supabase 클라이언트 인스턴스

    export async function POST(req: Request) {
      const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SIGNING_SECRET;

      if (!WEBHOOK_SECRET) {
        throw new Error('Please add CLERK_WEBHOOK_SIGNING_SECRET from Clerk Dashboard to.env');
      }

      // 요청 헤더를 가져옵니다.
      const headerPayload = headers();
      const svix_id = headerPayload.get("svix-id");
      const svix_timestamp = headerPayload.get("svix-timestamp");
      const svix_signature = headerPayload.get("svix-signature");

      if (!svix_id ||!svix_timestamp ||!svix_signature) {
        return new Response('Error occurred -- no svix headers', {
          status: 400
        });
      }

      // 요청 본문을 가져옵니다.
      const payload = await req.json();
      const body = JSON.stringify(payload);

      // Svix 웹훅 인스턴스를 생성합니다.
      const wh = new Webhook(WEBHOOK_SECRET);

      let evt: WebhookEvent;

      // 시그니처를 검증합니다.
      try {
        evt = wh.verify(body, {
          "svix-id": svix_id,
          "svix-timestamp": svix_timestamp,
          "svix-signature": svix_signature,
        }) as WebhookEvent;
      } catch (err) {
        console.error('Error verifying webhook:', err);
        return new Response('Error occurred', {
          status: 400
        });
      }

      const eventType = evt.type;

      // 'user.created' 이벤트를 처리합니다.
      if (eventType === 'user.created') {
        const { id, email_addresses, first_name, last_name, image_url } = evt.data;
        
        const email = email_addresses?.email_address;

        // Supabase 'users' 테이블에 사용자 정보를 삽입합니다.
        const { error: userError } = await supabase
        .from('users')
        .insert({
            id: id,
            email: email,
            first_name: first_name,
            last_name: last_name,
            image_url: image_url,
          });

        if (userError) {
          console.error('Error inserting user to Supabase:', userError);
          return new Response('Error occurred during user sync', { status: 500 });
        }

        // Supabase 'subscriptions' 테이블에 기본 'Free' 상태를 삽입합니다.
        const { error: subError } = await supabase
        .from('subscriptions')
        .insert({
            user_id: id,
            status: 'Free', // 기본 구독 상태
            // billing_key 등은 결제 시 업데이트됩니다.
          });

        if (subError) {
          console.error('Error inserting subscription to Supabase:', subError);
          return new Response('Error occurred during subscription sync', { status: 500 });
        }
      }

      return new Response('', { status: 200 });
    }
    ```
