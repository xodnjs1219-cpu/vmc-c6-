import type { SupabaseClient } from '@supabase/supabase-js';
import { generateAnalysisWithGeminiRetry } from '@/backend/lib/external/gemini-client';
import { clerkClient } from '@/backend/lib/external/clerk-client';
import type { CreateAnalysisRequest, CreateAnalysisResponse } from './create-schema';

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

    // 1. 사용자 존재 여부 확인 (없으면 Clerk에서 가져와 생성)
    let { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('id', userId)
      .single();

    if (userError && userError.code === 'PGRST116') {
      console.log('[createAnalysis] User not found in database, fetching from Clerk');
      
      // Clerk에서 사용자 정보 가져오기
      try {
        const clerkUser = await clerkClient.getUser(userId);
        
        if (!clerkUser) {
          console.error('[createAnalysis] User not found in Clerk:', userId);
          return {
            status: 'error',
            errorCode: 'USER_NOT_FOUND',
            message: '사용자 정보를 찾을 수 없습니다. 다시 로그인해주세요.',
          };
        }

        // 사용자 정보 데이터베이스에 생성
        const { data: newUser, error: createUserError } = await supabase
          .from('users')
          .insert({
            id: clerkUser.id,
            email: clerkUser.email_addresses[0]?.email_address,
            first_name: clerkUser.first_name,
            last_name: clerkUser.last_name,
            image_url: clerkUser.image_url,
          })
          .select('id')
          .single();

        if (createUserError) {
          console.error('[createAnalysis] Failed to create user:', createUserError);
          return {
            status: 'error',
            errorCode: 'USER_CREATE_FAILED',
            message: '사용자 정보 생성에 실패했습니다.',
          };
        }

        user = newUser;
        console.log('[createAnalysis] User created:', user.id);
      } catch (clerkError) {
        console.error('[createAnalysis] Clerk API error:', clerkError);
        return {
          status: 'error',
          errorCode: 'CLERK_API_ERROR',
          message: '사용자 정보 조회에 실패했습니다.',
        };
      }
    } else if (userError) {
      console.error('[createAnalysis] User query error:', userError);
      return {
        status: 'error',
        errorCode: 'USER_QUERY_ERROR',
        message: '사용자 정보 조회에 실패했습니다.',
      };
    } else {
      console.log('[createAnalysis] User found:', user.id);
    }

    // 2. 구독 상태 확인 (없으면 자동 생성)
    let { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .select('plan_type, remaining_tries')
      .eq('user_id', userId)
      .single();

    // subscription이 없으면 자동으로 Free 플랜 생성
    if (subError && subError.code === 'PGRST116') {
      console.log('[createAnalysis] Subscription not found, creating Free subscription');
      
      const { data: newSubscription, error: createError } = await supabase
        .from('subscriptions')
        .insert({
          user_id: userId,
          plan_type: 'Free',
          remaining_tries: 3,
          customer_key: userId,
        })
        .select('plan_type, remaining_tries')
        .single();

      if (createError) {
        console.error('[createAnalysis] Failed to create subscription:', createError);
        return {
          status: 'error',
          errorCode: 'SUBSCRIPTION_CREATE_FAILED',
          message: '구독 정보 생성에 실패했습니다.',
        };
      }

      subscription = newSubscription;
      console.log('[createAnalysis] Free subscription created:', subscription);
    } else if (subError) {
      console.error('[createAnalysis] Subscription query error:', subError);
      return {
        status: 'error',
        errorCode: 'SUBSCRIPTION_QUERY_ERROR',
        message: '구독 정보 조회에 실패했습니다.',
      };
    } else {
      console.log('[createAnalysis] Subscription found:', subscription);
    }

    // 3. 남은 횟수 확인
    if (!subscription || subscription.remaining_tries <= 0) {
      return {
        status: 'error',
        errorCode: 'QUOTA_EXCEEDED',
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

      if (errorMsg === 'GEMINI_TIMEOUT') {
        return {
          status: 'error',
          errorCode: 'EXTERNAL_SERVICE_ERROR',
          message: '일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
        };
      }

      return {
        status: 'error',
        errorCode: 'EXTERNAL_SERVICE_ERROR',
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
        errorCode: 'DATABASE_ERROR',
        message: '분석 결과 저장에 실패했습니다. 다시 시도해주세요.',
      };
    }

    console.log('[createAnalysis] Analysis inserted:', analysis?.id);

    // 횟수 차감
    const { error: updateError } = await supabase
      .from('subscriptions')
      .update({
        remaining_tries: subscription.remaining_tries - 1,
        updated_at: now,
      })
      .eq('user_id', userId);

    if (updateError) {
      console.error('[createAnalysis] Subscription update error:', updateError);
      // 횟수 차감 실패 시 분석 레코드 삭제 (롤백)
      if (analysis?.id) {
        await supabase.from('analyses').delete().eq('id', analysis.id);
      }

      return {
        status: 'error',
        errorCode: 'DATABASE_ERROR',
        message: '분석 횟수 저장에 실패했습니다. 다시 시도해주세요.',
      };
    }

    console.log('[createAnalysis] Analysis creation completed successfully');

    return {
      status: 'success',
      data: {
        id: analysis!.id,
        name: analysis!.name,
        birth_date: analysis!.birth_date,
        birth_time: analysis!.birth_time,
        is_lunar: analysis!.is_lunar,
        model_type: analysis!.model_type,
        content,
        created_at: analysis!.created_at,
        remaining_tries: subscription.remaining_tries - 1,
      },
    };
  } catch (error) {
    console.error('Unexpected error in createAnalysis:', error);
    return {
      status: 'error',
      errorCode: 'INTERNAL_ERROR',
      message: '예기치 않은 오류가 발생했습니다.',
    };
  }
}
