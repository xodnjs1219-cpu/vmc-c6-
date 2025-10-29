import type { SupabaseClient } from '@supabase/supabase-js';
import { generateAnalysisWithGeminiRetry } from '@/backend/lib/external/gemini-client';
import type { CreateAnalysisRequest, CreateAnalysisResponse } from './create-schema';
import { UserManagementService } from '@/backend/services/user-management';
import { SubscriptionManagementService } from '@/backend/services/subscription-management';
import { ErrorCodes, isError } from '@/backend/errors';

/**
 * 사주 분석을 생성합니다.
 * 1. 사용자 존재 여부 확인
 * 2. 구독 상태 확인 (없으면 자동 생성)
 * 3. Gemini API로 분석 콘텐츠 생성
 * 4. 분석 결과 저장
 * 5. 사용 횟수 차감
 * 6. 트랜잭션 처리
 */
export async function createAnalysis(
  supabase: SupabaseClient,
  userId: string,
  apiKey: string,
  request: CreateAnalysisRequest
): Promise<
  | { status: 'success'; data: CreateAnalysisResponse }
  | { status: 'error'; errorCode: string; message: string }
> {
  try {
    console.log('[createAnalysis] Starting analysis creation for user:', userId);

    const userService = new UserManagementService(supabase);
    const subscriptionService = new SubscriptionManagementService(supabase);

    // 1. 사용자 존재 여부 확인 (없으면 Clerk에서 가져와 생성)
    const userResult = await userService.getOrCreateUser(userId);
    if (!userResult.ok) {
      const errorResult = userResult as any;
      console.error('[createAnalysis] User error:', errorResult.error);
      return {
        status: 'error',
        errorCode: errorResult.error.code,
        message: errorResult.error.message,
      };
    }
    console.log('[createAnalysis] User verified:', userResult.value.id);

    // 2. 구독 상태 확인 (없으면 자동 생성)
    const subscriptionResult = await subscriptionService.getOrCreateSubscription(userId);
    if (!subscriptionResult.ok) {
      const errorResult = subscriptionResult as any;
      console.error('[createAnalysis] Subscription error:', errorResult.error);
      return {
        status: 'error',
        errorCode: errorResult.error.code,
        message: errorResult.error.message,
      };
    }
    const subscription = subscriptionResult.value;
    console.log('[createAnalysis] Subscription verified:', subscription.plan_type);

    // 3. 남은 횟수 확인
    if (subscription.remaining_tries <= 0) {
      return {
        status: 'error',
        errorCode: ErrorCodes.QUOTA_EXCEEDED,
        message: '무료 분석 횟수를 모두 사용했습니다.',
      };
    }

    // 4. Gemini API로 분석 콘텐츠 생성 (재시도 로직 포함)
    let content: string;
    try {
      console.log('[createAnalysis] Calling Gemini API with model:', request.model_type);
      content = await generateAnalysisWithGeminiRetry(
        apiKey,
        request.model_type,
        {
          name: request.name,
          birth_date: request.birth_date,
          birth_time: request.birth_time,
          is_lunar: request.is_lunar,
        },
        1 // 최대 1회 재시도
      );
      console.log('[createAnalysis] Gemini API response received, length:', content.length);
    } catch (error) {
      console.error('[createAnalysis] Gemini API error:', error);
      const errorMsg =
        error instanceof Error ? error.message : '알 수 없는 오류';

      if (errorMsg === ErrorCodes.GEMINI_TIMEOUT) {
        return {
          status: 'error',
          errorCode: ErrorCodes.EXTERNAL_SERVICE_ERROR,
          message: '일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
        };
      }

      return {
        status: 'error',
        errorCode: ErrorCodes.EXTERNAL_SERVICE_ERROR,
        message: '분석 생성 중 오류가 발생했습니다. 다시 시도해주세요.',
      };
    }

    // 5. 데이터베이스에 분석 결과 저장 및 횟수 차감 (트랜잭션)
    const now = new Date().toISOString();

    console.log('[createAnalysis] Inserting analysis into database');

    // 분석 저장
    const { data: analysis, error: insertError } = await supabase
      .from('analyses')
      .insert({
        user_id: userId,
        name: request.name,
        birth_date: request.birth_date,
        birth_time: request.birth_time || null,
        is_lunar: request.is_lunar,
        model_type: request.model_type,
        detail: content,  // 'content' 대신 'detail' 사용
        created_at: now,
      })
      .select('id, name, birth_date, birth_time, is_lunar, model_type, created_at')
      .single();

    if (insertError) {
      console.error('[createAnalysis] Database insert error:', insertError);
      return {
        status: 'error',
        errorCode: ErrorCodes.DATABASE_ERROR,
        message: '분석 결과 저장에 실패했습니다. 다시 시도해주세요.',
      };
    }

    if (!analysis) {
      console.error('[createAnalysis] Analysis creation returned null');
      return {
        status: 'error',
        errorCode: ErrorCodes.DATABASE_ERROR,
        message: '분석 결과 저장에 실패했습니다.',
      };
    }

    console.log('[createAnalysis] Analysis inserted:', analysis.id);

    // 횟수 차감
    const deductResult = await subscriptionService.deductQuota(userId);
    if (!deductResult.ok) {
      const errorResult = deductResult as any;
      console.error('[createAnalysis] Quota deduction error:', errorResult.error);
      // 횟수 차감 실패 시 분석 레코드 삭제 (롤백)
      await supabase.from('analyses').delete().eq('id', analysis.id);

      return {
        status: 'error',
        errorCode: errorResult.error.code,
        message: errorResult.error.message,
      };
    }

    const newRemainingTries = deductResult.value;
    console.log('[createAnalysis] Analysis creation completed successfully');

    return {
      status: 'success',
      data: {
        id: analysis.id,
        name: analysis.name,
        birth_date: analysis.birth_date,
        birth_time: analysis.birth_time,
        is_lunar: analysis.is_lunar,
        model_type: analysis.model_type,
        content,
        created_at: analysis.created_at,
        remaining_tries: newRemainingTries,
      },
    };
  } catch (error) {
    console.error('Unexpected error in createAnalysis:', error);
    return {
      status: 'error',
      errorCode: ErrorCodes.INTERNAL_ERROR,
      message: '예기치 않은 오류가 발생했습니다.',
    };
  }
}
