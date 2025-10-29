import type { SupabaseClient } from '@supabase/supabase-js';
import { ErrorCodes, AppError, type Result, success, failure } from '@/backend/errors';
import { SUBSCRIPTION_PLANS, type PlanType } from '@/backend/config/subscription-plans';

export interface Subscription {
  user_id: string;
  plan_type: PlanType;
  remaining_tries: number;
  billing_key: string | null;
  customer_key: string | null;
  next_payment_date: string | null;
  subscribed_at: string | null;
  cancellation_scheduled: boolean;
}

/**
 * 구독 관리 서비스
 * 구독 정보 생성, 조회, 업데이트 담당
 */
export class SubscriptionManagementService {
  constructor(private readonly supabase: SupabaseClient) {}

  /**
   * 구독 존재 여부 확인 및 필요 시 Free 플랜 생성
   */
  async getOrCreateSubscription(userId: string): Promise<Result<Subscription>> {
    // 1. 구독 조회
    const { data: subscription, error: subError } = await this.supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (subError) {
      // PGRST116: 레코드가 없음
      if (subError.code === 'PGRST116') {
        return this.createFreeSubscription(userId);
      }

      // 기타 DB 에러
      return failure(
        new AppError(
          ErrorCodes.SUBSCRIPTION_QUERY_ERROR,
          '구독 정보 조회에 실패했습니다.',
          500,
          { originalError: subError },
        ),
      );
    }

    return success(subscription as Subscription);
  }

  /**
   * Free 플랜 구독 생성
   */
  async createFreeSubscription(userId: string): Promise<Result<Subscription>> {
    const freePlan = SUBSCRIPTION_PLANS.Free;

    const { data: newSubscription, error: createError } = await this.supabase
      .from('subscriptions')
      .insert({
        user_id: userId,
        plan_type: freePlan.name,
        remaining_tries: freePlan.monthlyQuota,
        customer_key: userId,
        billing_key: null,
        next_payment_date: null,
        subscribed_at: null,
        cancellation_scheduled: false,
      })
      .select('*')
      .single();

    if (createError) {
      return failure(
        new AppError(
          ErrorCodes.SUBSCRIPTION_CREATE_FAILED,
          '구독 정보 생성에 실패했습니다.',
          500,
          { originalError: createError },
        ),
      );
    }

    return success(newSubscription as Subscription);
  }

  /**
   * 구독 정보 조회 (없으면 에러)
   */
  async getSubscription(userId: string): Promise<Result<Subscription>> {
    const { data, error } = await this.supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      return failure(
        new AppError(
          ErrorCodes.SUBSCRIPTION_NOT_FOUND,
          '구독 정보를 찾을 수 없습니다.',
          404,
          { originalError: error },
        ),
      );
    }

    return success(data as Subscription);
  }

  /**
   * 구독 플랜 업그레이드 (Free -> Pro)
   */
  async upgradeToPro(
    userId: string,
    billingKey: string,
    nextPaymentDate: string,
  ): Promise<Result<Subscription>> {
    const proPlan = SUBSCRIPTION_PLANS.Pro;
    const now = new Date().toISOString();

    const { data, error } = await this.supabase
      .from('subscriptions')
      .update({
        plan_type: proPlan.name,
        billing_key: billingKey,
        next_payment_date: nextPaymentDate,
        remaining_tries: proPlan.monthlyQuota,
        subscribed_at: now,
        updated_at: now,
      })
      .eq('user_id', userId)
      .select('*')
      .single();

    if (error) {
      return failure(
        new AppError(
          ErrorCodes.DATABASE_ERROR,
          '구독 업그레이드에 실패했습니다.',
          500,
          { originalError: error },
        ),
      );
    }

    return success(data as Subscription);
  }

  /**
   * 할당량 차감
   */
  async deductQuota(userId: string): Promise<Result<number>> {
    // 현재 구독 정보 조회
    const subResult = await this.getSubscription(userId);
    if (!subResult.ok) {
      const errorResult = subResult as any;
      return failure(errorResult.error);
    }

    const subscription = subResult.value;
    const newRemainingTries = subscription.remaining_tries - 1;

    if (newRemainingTries < 0) {
      return failure(
        new AppError(
          ErrorCodes.QUOTA_EXCEEDED,
          '무료 분석 횟수를 모두 사용했습니다.',
          403,
        ),
      );
    }

    // 할당량 차감
    const now = new Date().toISOString();
    const { error } = await this.supabase
      .from('subscriptions')
      .update({
        remaining_tries: newRemainingTries,
        updated_at: now,
      })
      .eq('user_id', userId);

    if (error) {
      return failure(
        new AppError(
          ErrorCodes.DATABASE_ERROR,
          '할당량 차감에 실패했습니다.',
          500,
          { originalError: error },
        ),
      );
    }

    return success(newRemainingTries);
  }

  /**
   * 구독 취소 예약
   */
  async scheduleCancellation(userId: string): Promise<Result<void>> {
    const now = new Date().toISOString();

    const { error } = await this.supabase
      .from('subscriptions')
      .update({
        cancellation_scheduled: true,
        updated_at: now,
      })
      .eq('user_id', userId);

    if (error) {
      return failure(
        new AppError(
          ErrorCodes.DATABASE_ERROR,
          '구독 취소 요청이 실패했습니다.',
          500,
          { originalError: error },
        ),
      );
    }

    return success(undefined);
  }
}
