'use client';

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@clerk/nextjs';
import { apiClient } from '@/lib/remote/api-client';
import { AnalysisDetailSchema } from '../backend/detail-schema';
import type { AnalysisDetail } from '../backend/detail-schema';

export function useAnalysisDetailQuery(analysisId: string | undefined) {
  const { userId } = useAuth();

  return useQuery({
    queryKey: ['analysis', analysisId],
    queryFn: async (): Promise<AnalysisDetail> => {
      if (!analysisId) {
        throw new Error('분석 ID가 필요합니다.');
      }

      if (!userId) {
        throw new Error('인증이 필요합니다.');
      }

      const response = await apiClient.get(`/api/analyses/${analysisId}`, {
        headers: {
          'x-clerk-user-id': userId,
        },
      });

      // 응답 데이터 검증
      const validated = AnalysisDetailSchema.parse(response.data);
      return validated;
    },
    enabled: !!analysisId && !!userId,
    staleTime: 5 * 60 * 1000, // 5분
    gcTime: 10 * 60 * 1000, // 10분
  });
}
