import type { SupabaseClient } from '@supabase/supabase-js';
import { AnalysisDetailSchema } from './detail-schema';

export async function fetchAnalysisDetail(
  supabase: SupabaseClient,
  userId: string,
  analysisId: string
): Promise<
  | { status: 'success'; data: any }
  | { status: 'error'; error: string }
> {
  try {
    const { data, error } = await supabase
      .from('analyses')
      .select('*')
      .eq('id', analysisId)
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // Not found
        return {
          status: 'error',
          error: '분석을 찾을 수 없습니다.',
        };
      }
      return {
        status: 'error',
        error: error.message,
      };
    }

    if (!data) {
      return {
        status: 'error',
        error: '분석을 찾을 수 없습니다.',
      };
    }

    // DB의 'detail' 필드를 'content'로 매핑
    const mappedData = {
      ...data,
      content: data.detail,
    };

    // Zod 검증
    const validated = AnalysisDetailSchema.safeParse(mappedData);
    if (!validated.success) {
      return {
        status: 'error',
        error: '데이터 검증 오류',
      };
    }

    return {
      status: 'success',
      data: validated.data,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : '알 수 없는 오류';
    return {
      status: 'error',
      error: message,
    };
  }
}
