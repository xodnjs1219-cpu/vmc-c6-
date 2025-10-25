import { match, P } from 'ts-pattern';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AnalysesQuery, AnalysisRow } from './schema';
import type { AnalysesListResponse, PaginationInfo } from './schema';

export async function fetchAnalysesList(
  supabase: SupabaseClient,
  userId: string,
  query: AnalysesQuery
): Promise<
  | { status: 'success'; data: AnalysesListResponse }
  | { status: 'error'; error: string }
> {
  try {
    const offset = (query.page - 1) * query.limit;

    // 전체 개수 조회
    const { count, error: countError } = await supabase
      .from('analyses')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (countError) {
      return {
        status: 'error',
        error: `데이터베이스 오류: ${countError.message}`,
      };
    }

    const totalCount = count ?? 0;

    // 페이지 데이터 조회
    const { data, error: dataError } = await supabase
      .from('analyses')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + query.limit - 1);

    if (dataError) {
      return {
        status: 'error',
        error: `데이터 조회 오류: ${dataError.message}`,
      };
    }

    const analysisRows = (data ?? []) as AnalysisRow[];

    const pagination: PaginationInfo = {
      total_count: totalCount,
      total_pages: Math.ceil(totalCount / query.limit),
      current_page: query.page,
      per_page: query.limit,
      has_next: offset + query.limit < totalCount,
      has_prev: query.page > 1,
    };

    const response: AnalysesListResponse = {
      items: analysisRows.map(({ user_id, ...rest }) => rest),
      pagination,
    };

    return {
      status: 'success',
      data: response,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : '알 수 없는 오류 발생';
    return {
      status: 'error',
      error: message,
    };
  }
}
