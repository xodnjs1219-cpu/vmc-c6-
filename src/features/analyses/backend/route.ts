import { Hono } from 'hono';
import type { AppEnv } from '@/backend/hono/context';
import { success, failure, respond } from '@/backend/http/response';
import { AnalysesQuerySchema, AnalysesListResponseSchema } from './schema';
import { fetchAnalysesList } from './service';
import { registerAnalysisCreateRoute } from './create-route';
import { fetchAnalysisDetail } from './detail-service';
import { AnalysisDetailSchema } from './detail-schema';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

export function registerAnalysesRoutes(app: Hono<AppEnv>) {
  // POST /api/analyses - 새로운 분석 생성
  registerAnalysisCreateRoute(app);

  // GET /api/analyses - 분석 목록 조회 (페이지네이션)
  app.get('/api/analyses', async (c) => {
    try {
      // Clerk에서 user ID 가져오기 (middleware에서 주입됨)
      const userId = c.req.header('x-clerk-user-id');
      if (!userId) {
        return respond(
          c,
          failure(401 as ContentfulStatusCode, 'UNAUTHORIZED', '인증이 필요합니다.')
        );
      }

      // 쿼리 파라미터 검증
      const queryParams = c.req.query();
      const parseResult = AnalysesQuerySchema.safeParse({
        page: queryParams.page,
        limit: queryParams.limit,
      });

      if (!parseResult.success) {
        return respond(
          c,
          failure(
            400 as ContentfulStatusCode,
            'INVALID_QUERY_PARAMS',
            '유효하지 않은 쿼리 파라미터입니다.'
          )
        );
      }

      const query = parseResult.data;

      // Supabase 클라이언트 가져오기
      const supabase = c.var.supabase;

      // 데이터 조회
      const result = await fetchAnalysesList(supabase, userId, query);

      if (result.status === 'error') {
        return respond(
          c,
          failure(500 as ContentfulStatusCode, 'DATABASE_ERROR', result.error)
        );
      }

      // 응답 검증
      const responseValidation = AnalysesListResponseSchema.safeParse(
        result.data
      );
      if (!responseValidation.success) {
        return respond(
          c,
          failure(500 as ContentfulStatusCode, 'VALIDATION_ERROR', '응답 데이터 검증 오류')
        );
      }

      return respond(c, success(responseValidation.data, 200 as ContentfulStatusCode));
    } catch (error) {
      const logger = c.var.logger;
      logger.error('[GET /api/analyses]', error);
      return respond(
        c,
        failure(500 as ContentfulStatusCode, 'DATABASE_ERROR', '서버 오류가 발생했습니다.')
      );
    }
  });

  // GET /api/analyses/:id - 분석 상세 조회
  app.get('/api/analyses/:id', async (c) => {
    try {
      // Clerk에서 user ID 가져오기
      const userId = c.req.header('x-clerk-user-id');
      if (!userId) {
        return respond(
          c,
          failure(401 as ContentfulStatusCode, 'UNAUTHORIZED', '인증이 필요합니다.')
        );
      }

      const analysisId = c.req.param('id');
      if (!analysisId) {
        return respond(
          c,
          failure(400 as ContentfulStatusCode, 'INVALID_PARAM', '분석 ID가 필요합니다.')
        );
      }

      // Supabase 클라이언트 가져오기
      const supabase = c.var.supabase;

      // 데이터 조회
      const result = await fetchAnalysisDetail(supabase, userId, analysisId);

      if (result.status === 'error') {
        return respond(
          c,
          failure(404 as ContentfulStatusCode, 'NOT_FOUND', result.error)
        );
      }

      // 응답 검증
      const responseValidation = AnalysisDetailSchema.safeParse(result.data);
      if (!responseValidation.success) {
        return respond(
          c,
          failure(500 as ContentfulStatusCode, 'VALIDATION_ERROR', '응답 데이터 검증 오류')
        );
      }

      return respond(c, success(responseValidation.data, 200 as ContentfulStatusCode));
    } catch (error) {
      const logger = c.var.logger;
      logger.error('[GET /api/analyses/:id]', error);
      return respond(
        c,
        failure(500 as ContentfulStatusCode, 'DATABASE_ERROR', '서버 오류가 발생했습니다.')
      );
    }
  });
}

