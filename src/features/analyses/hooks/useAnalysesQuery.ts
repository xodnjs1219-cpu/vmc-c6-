'use client';

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@clerk/nextjs';
import { apiClient } from '@/lib/remote/api-client';
import { AnalysesListResponseSchema } from '@/features/analyses/lib/dto';
import type { AnalysesListResponse } from '@/features/analyses/lib/dto';

export interface UseAnalysesQueryOptions {
  page?: number;
  limit?: number;
  enabled?: boolean;
}

export function useAnalysesQuery({
  page = 1,
  limit = 10,
  enabled = true,
}: UseAnalysesQueryOptions = {}) {
  const { userId } = useAuth();

  return useQuery({
    queryKey: ['analyses', { page, limit }],
    queryFn: async () => {
      if (!userId) {
        throw new Error('인증이 필요합니다.');
      }

      const response = await apiClient.get<AnalysesListResponse>(
        '/api/analyses',
        {
          params: { page, limit },
          headers: {
            'x-clerk-user-id': userId,
          },
        }
      );
      
      // 응답 검증
      const validated = AnalysesListResponseSchema.parse(response.data);
      return validated;
    },
    enabled: enabled && !!userId,
    staleTime: 5 * 60 * 1000, // 5분
    gcTime: 10 * 60 * 1000, // 10분
  });
}
