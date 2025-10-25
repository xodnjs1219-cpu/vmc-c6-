'use client';

import { useMutation } from '@tanstack/react-query';
import { useAuth } from '@clerk/nextjs';
import { apiClient, extractApiErrorMessage } from '@/lib/remote/api-client';
import { CreateAnalysisRequestSchema, CreateAnalysisResponseSchema } from '../backend/create-schema';
import type { CreateAnalysisRequest, CreateAnalysisResponse } from '../backend/create-schema';

interface UseCreateAnalysisMutationOptions {
  onSuccess?: (data: CreateAnalysisResponse) => void;
  onError?: (error: Error) => void;
}

export function useCreateAnalysisMutation(options?: UseCreateAnalysisMutationOptions) {
  const { userId } = useAuth();

  return useMutation({
    mutationFn: async (request: CreateAnalysisRequest) => {
      if (!userId) {
        throw new Error('인증이 필요합니다.');
      }

      // 요청 데이터 검증
      const validatedRequest = CreateAnalysisRequestSchema.parse(request);

      try {
        // API 호출 (Clerk user ID를 헤더에 포함)
        const response = await apiClient.post('/api/analyses', validatedRequest, {
          headers: {
            'x-clerk-user-id': userId,
          },
        });

        // 백엔드는 성공 시 데이터를 직접 반환함 (response.data가 이미 CreateAnalysisResponse)
        const validatedResponse = CreateAnalysisResponseSchema.parse(response.data);

        return validatedResponse;
      } catch (error) {
        // API 에러 메시지 추출
        const errorMessage = extractApiErrorMessage(error, '분석 생성에 실패했습니다.');
        throw new Error(errorMessage);
      }
    },
    onSuccess: options?.onSuccess,
    onError: options?.onError,
  });
}

