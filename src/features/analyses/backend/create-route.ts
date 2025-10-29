import { createAnalysis } from './create-service';
import type { AppEnv } from '@/backend/hono/context';
import { Hono } from 'hono';
import { respond, failure, success } from '@/backend/http/response';
import { CreateAnalysisRequestSchema, CreateAnalysisResponseSchema } from './create-schema';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

export function registerAnalysisCreateRoute(app: Hono<AppEnv>) {
  app.post('/api/analyses', async (c) => {
    try {
      // 1. 인증 확인
      const userId = c.req.header('x-clerk-user-id');
      if (!userId) {
        return respond(
          c,
          failure(401 as ContentfulStatusCode, 'UNAUTHORIZED', '인증이 필요합니다.')
        );
      }

      // 2. 요청 본문 파싱 및 검증
      let requestBody;
      try {
        requestBody = await c.req.json();
      } catch {
        return respond(
          c,
          failure(400 as ContentfulStatusCode, 'INVALID_JSON', 'JSON 형식이 올바르지 않습니다.')
        );
      }

      const parseResult = CreateAnalysisRequestSchema.safeParse(requestBody);
      if (!parseResult.success) {
        return respond(
          c,
          failure(400 as ContentfulStatusCode, 'INVALID_INPUT', '입력값이 올바르지 않습니다.')
        );
      }

      // 3. Gemini API 키 확인
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        console.error('[POST /api/analyses] GEMINI_API_KEY is not configured');
        return respond(
          c,
          failure(
            500 as ContentfulStatusCode,
            'INTERNAL_ERROR',
            '서버 설정 오류가 발생했습니다.'
          )
        );
      }

      console.log('[POST /api/analyses] Creating analysis for user:', userId);
      console.log('[POST /api/analyses] Request data:', {
        name: parseResult.data.name,
        birth_date: parseResult.data.birth_date,
        model_type: parseResult.data.model_type,
      });

      // 4. 분석 생성
      const supabase = c.get('supabase');
      const result = await createAnalysis(
        supabase,
        userId,
        apiKey,
        parseResult.data
      );

      if (result.status === 'error') {
        // 에러 코드에 따라 적절한 상태 코드 설정
        console.error('[POST /api/analyses] Service error:', {
          errorCode: result.errorCode,
          message: result.message,
        });

        let statusCode: ContentfulStatusCode = 500 as ContentfulStatusCode;
        if (result.errorCode === 'QUOTA_EXCEEDED') {
          statusCode = 402 as ContentfulStatusCode;
        } else if (result.errorCode === 'EXTERNAL_SERVICE_ERROR') {
          statusCode = 503 as ContentfulStatusCode;
        } else if (result.errorCode === 'INVALID_INPUT') {
          statusCode = 400 as ContentfulStatusCode;
        }

        return respond(
          c,
          failure(statusCode, result.errorCode, result.message)
        );
      }

      // Zod 검증을 통해 응답 데이터 확인
      const validatedResponse = CreateAnalysisResponseSchema.safeParse(result.data);
      if (!validatedResponse.success) {
        console.error('[POST /api/analyses] Response validation error:', validatedResponse.error);
        console.error('[POST /api/analyses] Response data:', result.data);
        return respond(
          c,
          failure(
            500 as ContentfulStatusCode,
            'INTERNAL_ERROR',
            '응답 형식 오류가 발생했습니다.'
          )
        );
      }

      console.log('[POST /api/analyses] Analysis created successfully:', validatedResponse.data.id);

      return respond(
        c,
        success(validatedResponse.data, 200 as ContentfulStatusCode)
      );
    } catch (error) {
      console.error('[POST /api/analyses] Unexpected error:', error);
      if (error instanceof Error) {
        console.error('[POST /api/analyses] Error stack:', error.stack);
      }
      return respond(
        c,
        failure(
          500 as ContentfulStatusCode,
          'INTERNAL_ERROR',
          '예기치 않은 오류가 발생했습니다.'
        )
      );
    }
  });
}
