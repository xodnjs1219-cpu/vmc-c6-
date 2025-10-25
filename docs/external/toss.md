## Part 4: 토스페이먼츠: 견고한 구독 결제 시스템 구현

이 섹션에서는 토스페이먼츠를 사용하여 구독 결제 시스템을 구축하는 전체 과정을 상세히 다룹니다. 최초 카드 등록(빌링키 발급)부터 정기 결제 처리, 그리고 웹훅을 통한 데이터 일관성 유지까지, 구독 생명주기 전반을 다루는 포괄적인 가이드를 제공합니다.

### 4.1. 클라이언트 사이드 SDK: 빌링키 등록

구독 결제를 위해서는 먼저 사용자의 결제 수단(카드)을 등록하고, 이를 식별할 수 있는 \*\*빌링키(Billing Key)\*\*를 발급받아야 합니다. 이 과정은 토스페이먼츠의 클라이언트 사이드 SDK를 통해 안전하게 처리됩니다.

1.  **SDK 설치 및 초기화**: `@tosspayments/payment-sdk` 패키지를 설치하고, 결제 버튼이 위치할 클라이언트 컴포넌트(예: `SubscriptionButton.tsx`)에서 SDK를 초기화합니다.[11]

    ```tsx
    // components/SubscriptionButton.tsx
    "use client";

    import { useEffect, useState } from "react";
    import { loadTossPayments } from "@tosspayments/payment-sdk";
    import { useUser } from "@clerk/nextjs";

    const TOSS_CLIENT_KEY = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY;

    export default function SubscriptionButton() {
      const { user } = useUser();

      const handlePayment = async () => {
        if (!user) {
          alert("로그인이 필요합니다.");
          return;
        }

        const tossPayments = await loadTossPayments(TOSS_CLIENT_KEY!);
        
        // requestBillingAuth 호출하여 카드 등록창 열기
        tossPayments.requestBillingAuth('카드', {
          customerKey: user.id, // 사용자를 식별하는 고유한 키 (Clerk User ID 사용)
          successUrl: `${window.location.origin}/api/payments/subscribe`, // 성공 시 리디렉션될 서버 API 경로
          failUrl: `${window.location.origin}/subscribe/fail`, // 실패 시 리디렉션될 경로
        });
      };

      return <button onClick={handlePayment}>Pro 구독하기</button>;
    }
    ```

2.  **`requestBillingAuth()` 호출**: 'Pro 구독하기' 버튼 클릭 시 `requestBillingAuth` 함수를 호출합니다.[16, 33] 이 함수는 토스페이먼츠가 제공하는 안전한 Iframe 환경에서 사용자에게 카드 정보 입력을 요청합니다.

      * `customerKey`: 각 사용자를 식별하는 고유한 값입니다. 여기서는 Clerk의 `user.id`를 사용하여 우리 시스템의 사용자와 토스페이먼츠의 고객을 일대일로 매핑합니다.
      * `successUrl`: 카드 정보가 성공적으로 인증되면, 토스페이먼츠는 이 URL로 사용자를 리디렉션시키면서 임시 인증 키인 `authKey`를 쿼리 파라미터로 전달합니다.

3.  **인증 키(Auth Key)에서 빌링키(Billing Key)로의 전환 흐름**: 클라이언트 SDK는 영구적인 빌링키를 직접 반환하지 않습니다. 대신, 일회성 `authKey`를 발급합니다. 서버는 이 `authKey`를 받아 토스페이먼츠 API와 통신하여 영구적인 `billingKey`로 교환해야 합니다. 이 2단계 프로세스는 민감한 결제 정보를 클라이언트에 노출시키지 않기 위한 중요한 보안 절차입니다.[34]

### 4.2. 서버사이드 API 오케스트레이션

서버는 빌링키 발급, 최초 결제, 정기 결제, 구독 해지 등 구독 생명주기의 핵심 로직을 담당합니다.

#### 인증 헤더 생성

토스페이먼츠의 모든 서버사이드 API 요청은 **Basic 인증**을 사용합니다. `TOSS_SECRET_KEY` 뒤에 콜론(`:`)을 붙인 문자열을 Base64로 인코딩하여 `Authorization` 헤더에 담아 보내야 합니다.[34, 35]

```typescript
// lib/toss.ts
const secretKey = process.env.TOSS_SECRET_KEY;
const encodedSecretKey = Buffer.from(`${secretKey}:`).toString('base64');

export const TOSS_API_HEADERS = {
  'Authorization': `Basic ${encodedSecretKey}`,
  'Content-Type': 'application/json',
};
```

#### 빌링키 발급 및 최초 결제 (`/api/payments/subscribe`)

이 엔드포인트는 사용자가 카드 등록을 마친 후 리디렉션되는 `successUrl`입니다. 빌링키를 발급하고 첫 구독료를 결제하는 역할을 합니다.

1.  클라이언트로부터 `authKey`와 `customerKey`를 쿼리 파라미터로 받습니다.
2.  `POST /v1/billing/authorizations/{authKey}` API를 호출하여 영구적인 `billingKey`를 발급받습니다.[36]
3.  발급받은 `billingKey`를 Supabase `subscriptions` 테이블에 해당 사용자와 연결하여 저장합니다.
4.  즉시 `POST /v1/billing/{billingKey}` API를 호출하여 첫 구독료를 결제합니다.[36]
5.  결제가 성공하면 Supabase `subscriptions` 테이블의 상태를 'Pro'로 업데이트하고, Clerk의 사용자 `publicMetadata`도 `{ "subscription": "Pro" }`로 갱신하여 접근 제어 가드가 즉시 반영되도록 합니다.

#### 정기 결제 처리 (`/api/cron/process-subscriptions`)

이 엔드포인트는 Supabase Cron과 같은 스케줄러에 의해 주기적으로(예: 매일 자정) 호출됩니다.

1.  데이터베이스에서 결제일이 도래한 모든 활성 구독(`status = 'Pro'`)을 조회합니다.
2.  각 구독에 대해 저장된 `billingKey`를 사용하여 `POST /v1/billing/{billingKey}` API를 호출해 정기 결제를 시도합니다.[36]
3.  결제 성공 시, 다음 결제일을 갱신합니다.
4.  결제 실패 시(예: 한도 초과, 정지 카드), 데이터베이스에 실패 상태를 기록하고, 사용자에게 결제 실패를 알리는 로직(예: 이메일 발송)을 트리거합니다. 정해진 횟수 이상 실패 시 구독을 비활성화 처리합니다.

#### 구독 해지 처리

사용자가 구독을 해지하면, 저장된 빌링키를 무효화하여 더 이상 자동 결제가 발생하지 않도록 해야 합니다.

1.  데이터베이스에서 해당 사용자의 `billingKey`를 조회합니다.
2.  `DELETE /v1/billing/authorizations/{billingKey}` API를 호출하여 토스페이먼츠 서버에서 빌링키를 삭제합니다.[36]
3.  Supabase `subscriptions` 테이블의 상태를 'Canceled'로 변경하고, Clerk `publicMetadata`를 `{ "subscription": "Free" }`로 업데이트합니다.

다음 표는 구독 결제 생명주기 관리에 필요한 핵심 API 엔드포인트를 요약한 것입니다.

**Table 3: 토스페이먼츠 API 엔드포인트 요약 (자동결제)**

| 기능 | HTTP 메서드 | 엔드포인트 경로 | 주요 파라미터 |
| :--- | :--- | :--- | :--- |
| 빌링키 발급 | `POST` | `/v1/billing/authorizations/{authKey}` | `customerKey` |
| 결제 실행 (최초/정기) | `POST` | `/v1/billing/{billingKey}` | `customerKey`, `amount`, `orderId` |
| 빌링키 삭제 | `DELETE` | `/v1/billing/authorizations/{billingKey}` | `customerKey` |

### 4.3. 웹훅 통합: 데이터 일관성 보장

결제 시스템에서는 예기치 않은 네트워크 오류나 비동기적 상태 변경(예: 가상계좌 입금)이 발생할 수 있습니다. 웹훅은 이러한 이벤트가 발생했을 때 토스페이먼츠 서버가 우리 서버로 실시간 알림을 보내주는 기능으로, 데이터의 최종 일관성(eventual consistency)을 보장하는 데 필수적입니다.

1.  **웹훅 엔드포인트 구현**: `/api/webhooks/toss` 엔드포인트를 생성하고, `middleware.ts`에서 공개 경로로 설정합니다.

2.  **웹훅 등록**: 토스페이먼츠 개발자센터의 웹훅 메뉴에서 해당 엔드포인트 URL을 등록하고, `PAYMENT_STATUS_CHANGED`(결제 상태 변경)와 같은 필요한 이벤트를 구독합니다.[37]

3.  **웹훅 시그니처 검증의 함정과 안전한 처리 패턴**: 웹훅을 안전하게 처리하기 위해서는 시그니처 검증이 필수적입니다. 하지만 토스페이먼츠의 API 명세를 면밀히 분석한 결과, 중요한 사실이 드러났습니다. `tosspayments-webhook-signature` 헤더는 `payout.changed`, `seller.changed`와 같은 특정 이벤트에만 포함되며, 가장 일반적으로 사용되는 `PAYMENT_STATUS_CHANGED` 이벤트에는 포함되지 않습니다.[38]

    이는 일반 결제 상태 변경 웹훅의 페이로드를 신뢰할 수 없음을 의미합니다. 따라서 프로덕션 환경에서 요구되는 안전한 처리 패턴은 다음과 같습니다.

    1.  웹훅을 \*\*단순 알림(Notification)\*\*으로만 간주합니다.
    2.  웹훅 페이로드에서 `paymentKey` 또는 `orderId`와 같은 식별자만 추출합니다.
    3.  이 식별자를 사용하여, 서버에서 직접 토스페이먼츠의 결제 조회 API(`GET /v1/payments/{paymentKey}`)를 **인증된 요청으로 호출**합니다.
    4.  API를 통해 반환된 \*\*신뢰할 수 있는 최신 결제 상태 정보("Source of Truth")\*\*를 기반으로 데이터베이스를 업데이트합니다.

    이 패턴은 웹훅 페이로드 위변조 공격을 방지하고, 일시적인 네트워크 문제로 웹훅 수신에 실패하더라도 데이터의 정합성을 보장할 수 있는 가장 견고한 방법입니다.

    ```typescript
    // app/api/webhooks/toss/route.ts
    import { NextResponse } from 'next/server';
    import { TOSS_API_HEADERS } from '@/lib/toss';
    import { supabase } from '@/lib/supabaseClient';

    export async function POST(req: Request) {
      try {
        const event = await req.json();

        // 1. 웹훅을 알림으로 간주하고, 페이로드에서 paymentKey를 추출합니다.
        if (event.eventType === 'PAYMENT_STATUS_CHANGED') {
          const { paymentKey, orderId, status } = event.data;

          // 2. 결제 조회 API를 호출하여 최신 상태를 직접 확인합니다.
          const response = await fetch(`https://api.tosspayments.com/v1/payments/${paymentKey}`, {
            headers: TOSS_API_HEADERS,
          });

          if (!response.ok) {
            throw new Error(`Failed to verify payment status for orderId: ${orderId}`);
          }

          const paymentDetails = await response.json();

          // 3. API로 검증된 상태와 웹훅의 상태가 일치하는지 확인하고 DB를 업데이트합니다.
          if (paymentDetails.status === status) {
            if (status === 'DONE') {
              // 결제 완료 처리 로직 (예: subscriptions 테이블 상태 업데이트)
              await supabase
              .from('subscriptions')
              .update({ status: 'Pro' }) // 예시, 실제로는 orderId로 특정 레코드를 찾아야 함
              .eq('order_id', orderId);
            } else if (status === 'CANCELED') {
              // 결제 취소 처리 로직
            }
          }
        }
        
        // 토스페이먼츠에 성공적으로 수신했음을 알립니다.
        return new NextResponse('OK', { status: 200 });
      } catch (error) {
        console.error('Toss Webhook Error:', error);
        return new NextResponse('Webhook processing failed', { status: 500 });
      }
    }
    ```

-----