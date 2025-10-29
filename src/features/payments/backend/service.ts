import type { SupabaseClient } from '@supabase/supabase-js';
import { TossPaymentsClient } from '@/backend/lib/external/toss-client';

export async function processSubscriptionPayment(
  supabase: SupabaseClient,
  customerKey: string,
  authKey: string,
  customerName: string,
  customerEmail: string,
  customerPhone: string
): Promise<
  | { status: 'success'; message: string }
  | { status: 'error'; message: string }
> {
  try {
    const tossClient = new TossPaymentsClient();

    // 1. authKey를 사용해서 billingKey 발급
    const billingAuthResponse = await tossClient.issueBillingKey(authKey);

    if (!billingAuthResponse || typeof billingAuthResponse !== 'object' || !('billingKey' in billingAuthResponse)) {
      return {
        status: 'error',
        message: '빌링키 발급에 실패했습니다.',
      };
    }

    const billingKey = billingAuthResponse.billingKey as string;

    // 2. 첫 결제 진행 (월 구독료 3900원)
    const chargeResponse = await tossClient.chargeBilling(billingKey, {
      customerKey,
      amount: 3900,
      orderId: `sub-${customerKey}-${Date.now()}`,
    });

    if (!chargeResponse || typeof chargeResponse !== 'object' || !('status' in chargeResponse) || chargeResponse.status !== 'DONE') {
      return {
        status: 'error',
        message: '첫 결제에 실패했습니다.',
      };
    }

    // 3. 구독 정보 업데이트
    const now = new Date().toISOString();
    const nextPaymentDate = new Date();
    nextPaymentDate.setMonth(nextPaymentDate.getMonth() + 1);
    const nextPaymentDateStr = nextPaymentDate.toISOString().split('T')[0];

    const { error: updateError } = await supabase
      .from('subscriptions')
      .update({
        plan_type: 'Pro',
        billing_key: billingKey,
        customer_key: customerKey,
        next_payment_date: nextPaymentDateStr,
        remaining_tries: 10, // Pro 플랜: 월 10회
        updated_at: now,
      })
      .eq('user_id', customerKey);

    if (updateError) {
      console.error('Subscription update error:', updateError);
      return {
        status: 'error',
        message: '구독 정보 업데이트에 실패했습니다.',
      };
    }

    return {
      status: 'success',
      message: 'Pro 구독이 성공적으로 활성화되었습니다.',
    };
  } catch (error) {
    console.error('Payment processing error:', error);
    return {
      status: 'error',
      message: '결제 처리 중 오류가 발생했습니다.',
    };
  }
}