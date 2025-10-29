import type { SupabaseClient } from '@supabase/supabase-js';
import { TossPaymentsClient } from '@/backend/lib/external/toss-client';
import { SUBSCRIPTION_PLANS } from '@/backend/config/subscription-plans';
import { ErrorCodes } from '@/backend/errors';

export async function initiateSubscription(
  supabase: SupabaseClient,
  userId: string,
  customerName: string,
  customerEmail: string,
  customerPhone: string
): Promise<
  | { status: 'success'; checkoutUrl: string; orderId: string }
  | { status: 'error'; errorCode: string; message: string }
> {
  try {
    // 1. 현재 구독 상태 확인
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .select('plan_type, billing_key')
      .eq('user_id', userId)
      .single();

    if (subError) {
      return {
        status: 'error',
        errorCode: ErrorCodes.SUBSCRIPTION_NOT_FOUND,
        message: '구독 정보를 찾을 수 없습니다.',
      };
    }

    // 2. 이미 Pro 구독 중인지 확인
    if (subscription?.plan_type === 'Pro') {
      return {
        status: 'error',
        errorCode: ErrorCodes.ALREADY_SUBSCRIBED,
        message: '이미 Pro 구독 중입니다.',
      };
    }

    // 3. 결제 키 생성 (실제로는 Toss API를 통해 얻음)
    const orderId = `${userId}-${Date.now()}`;
    const proPlan = SUBSCRIPTION_PLANS.Pro;

    // 4. Toss Payments 청구 키 등록
    // 실제 구현에서는 클라이언트에서 카드 정보를 받아 서버에서 처리
    // 여기서는 orderId 반환 (실제 결제는 클라이언트에서 진행)
    const checkoutUrl = `/api/payments/checkout?orderId=${orderId}&amount=${proPlan.price}&customerName=${encodeURIComponent(customerName)}&customerEmail=${encodeURIComponent(customerEmail)}&customerPhone=${encodeURIComponent(customerPhone)}`;

    return {
      status: 'success',
      checkoutUrl,
      orderId,
    };
  } catch (error) {
    console.error('Subscription initiation error:', error);
    return {
      status: 'error',
      errorCode: ErrorCodes.INTERNAL_ERROR,
      message: '구독 요청 중 오류가 발생했습니다.',
    };
  }
}

/**
 * Toss Payments 결제 성공 후 구독 업데이트
 */
export async function confirmSubscription(
  supabase: SupabaseClient,
  userId: string,
  billingKey: string
): Promise<
  | { status: 'success'; message: string }
  | { status: 'error'; errorCode: string; message: string }
> {
  try {
    // date-fns를 사용하지 않고 간단한 날짜 계산 (의존성 추가 없이)
    const now = new Date();
    const nextPaymentDate = new Date(now);
    nextPaymentDate.setMonth(nextPaymentDate.getMonth() + 1);
    const nextPaymentDateStr = nextPaymentDate.toISOString().split('T')[0];

    const proPlan = SUBSCRIPTION_PLANS.Pro;

    // 1. subscriptions 테이블 업데이트
    const { error: updateError } = await supabase
      .from('subscriptions')
      .update({
        plan_type: proPlan.name,
        billing_key: billingKey,
        next_payment_date: nextPaymentDateStr,
        remaining_tries: proPlan.monthlyQuota,
        updated_at: now.toISOString(),
      })
      .eq('user_id', userId);

    if (updateError) {
      return {
        status: 'error',
        errorCode: ErrorCodes.DATABASE_ERROR,
        message: '구독 정보 업데이트에 실패했습니다.',
      };
    }

    return {
      status: 'success',
      message: 'Pro 구독이 활성화되었습니다.',
    };
  } catch (error) {
    console.error('Subscription confirmation error:', error);
    return {
      status: 'error',
      errorCode: ErrorCodes.INTERNAL_ERROR,
      message: '구독 확인 중 오류가 발생했습니다.',
    };
  }
}

/**
 * 구독 취소 (다음 결제에서 downgrade)
 */
export async function scheduleSubscriptionCancellation(
  supabase: SupabaseClient,
  userId: string
): Promise<
  | { status: 'success'; message: string }
  | { status: 'error'; errorCode: string; message: string }
> {
  try {
    const now = new Date().toISOString();

    const { error } = await supabase
      .from('subscriptions')
      .update({
        cancellation_scheduled: true,
        updated_at: now,
      })
      .eq('user_id', userId);

    if (error) {
      return {
        status: 'error',
        errorCode: ErrorCodes.DATABASE_ERROR,
        message: '구독 취소 요청이 실패했습니다.',
      };
    }

    return {
      status: 'success',
      message: '다음 결제일에 구독이 취소될 예정입니다.',
    };
  } catch (error) {
    console.error('Subscription cancellation error:', error);
    return {
      status: 'error',
      errorCode: ErrorCodes.INTERNAL_ERROR,
      message: '구독 취소 중 오류가 발생했습니다.',
    };
  }
}
