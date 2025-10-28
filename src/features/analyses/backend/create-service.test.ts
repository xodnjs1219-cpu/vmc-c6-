import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAnalysis } from './create-service';
import { generateAnalysisWithGeminiRetry } from '@/backend/lib/external/gemini-client';
import { clerkClient } from '@/backend/lib/external/clerk-client';
import { mockFreeUser, mockProUser, mockUserFromClerk } from '../../../../tests/fixtures/user';
import { mockAnalysisRequest, mockAnalysisResponse } from '../../../../tests/fixtures/analysis';

// Mock dependencies
vi.mock('@/backend/lib/external/gemini-client');
vi.mock('@/backend/lib/external/clerk-client');

describe('createAnalysis', () => {
  let mockSupabase: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // 기본 Supabase 모킹
    mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn(),
          }),
        }),
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn(),
          }),
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn(),
        }),
        upsert: vi.fn().mockReturnValue({
          onConflict: vi.fn(),
        }),
        delete: vi.fn().mockReturnValue({
          eq: vi.fn(),
        }),
      }),
    };
  });

  it('TC-001: Free 사용자 정상 분석 생성', async () => {
    // Arrange: Free 사용자, 정상적인 모든 모킹
    mockSupabase.from('users').select().eq().single.mockResolvedValue({
      data: { id: mockFreeUser.userId },
    });
    mockSupabase.from('subscriptions').select().eq().single.mockResolvedValue({
      data: { plan_type: 'Free', remaining_tries: 3 },
    });
    vi.mocked(generateAnalysisWithGeminiRetry).mockResolvedValue('분석 결과');
    mockSupabase.from('analyses').insert().select().single.mockResolvedValue({
      data: {
        id: 'analysis_123',
        name: '홍길동',
        birth_date: '1990-01-01',
        birth_time: null,
        is_lunar: false,
        model_type: 'flash',
        created_at: '2025-01-28T10:00:00Z',
      },
    });
    mockSupabase.from('subscriptions').update().eq.mockResolvedValue({});

    // Act: 분석 생성
    const result = await createAnalysis(
      mockSupabase,
      mockFreeUser.userId,
      'test-api-key',
      mockAnalysisRequest
    );

    // Assert: 성공 결과 확인
    expect(result.status).toBe('success');
    if (result.status === 'success') {
      expect(result.data.remaining_tries).toBe(2); // 3 - 1 = 2
    }
    expect(generateAnalysisWithGeminiRetry).toHaveBeenCalledWith(
      'test-api-key',
      'flash',
      {
        name: '홍길동',
        birth_date: '1990-01-01',
        birth_time: null,
        is_lunar: false,
      },
      1
    );
  });

  it('TC-002: Pro 사용자 정상 분석 생성', async () => {
    // Arrange: Pro 사용자
    mockSupabase.from('users').select().eq().single.mockResolvedValue({
      data: { id: mockProUser.userId },
    });
    mockSupabase.from('subscriptions').select().eq().single.mockResolvedValue({
      data: { plan_type: 'Pro', remaining_tries: 10 },
    });
    vi.mocked(generateAnalysisWithGeminiRetry).mockResolvedValue('Pro 분석 결과');
    mockSupabase.from('analyses').insert().select().single.mockResolvedValue({
      data: {
        id: 'analysis_456',
        name: '김철수',
        birth_date: '1985-05-15',
        birth_time: '12:30',
        is_lunar: true,
        model_type: 'pro',
        created_at: '2025-01-28T11:00:00Z',
      },
    });
    mockSupabase.from('subscriptions').update().eq.mockResolvedValue({});

    // Act: 분석 생성
    const result = await createAnalysis(
      mockSupabase,
      mockProUser.userId,
      'test-api-key',
      {
        ...mockAnalysisRequest,
        name: '김철수',
        birth_date: '1985-05-15',
        birth_time: '12:30',
        is_lunar: true,
        model_type: 'pro',
      }
    );

    // Assert: 성공 결과 확인
    expect(result.status).toBe('success');
    if (result.status === 'success') {
      expect(result.data.remaining_tries).toBe(9); // 10 - 1 = 9
      expect(result.data.model_type).toBe('pro');
    }
  });

  it('TC-003: Free 사용자 횟수 소진 시 QUOTA_EXCEEDED 에러', async () => {
    // Arrange: 횟수 0인 Free 사용자
    mockSupabase.from('users').select().eq().single.mockResolvedValue({
      data: { id: mockFreeUser.userId },
    });
    mockSupabase.from('subscriptions').select().eq().single.mockResolvedValue({
      data: { plan_type: 'Free', remaining_tries: 0 },
    });

    // Act: 분석 생성 시도
    const result = await createAnalysis(
      mockSupabase,
      mockFreeUser.userId,
      'test-api-key',
      mockAnalysisRequest
    );

    // Assert: QUOTA_EXCEEDED 에러 확인
    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.errorCode).toBe('QUOTA_EXCEEDED');
      expect(result.message).toBe('무료 분석 횟수를 모두 사용했습니다.');
    }

    // Gemini API 호출되지 않음 확인
    expect(generateAnalysisWithGeminiRetry).not.toHaveBeenCalled();
  });

  it('TC-004: Gemini API 타임아웃 시 EXTERNAL_SERVICE_ERROR 에러', async () => {
    // Arrange: 정상 사용자, Gemini 타임아웃
    mockSupabase.from('users').select().eq().single.mockResolvedValue({
      data: { id: mockFreeUser.userId },
    });
    mockSupabase.from('subscriptions').select().eq().single.mockResolvedValue({
      data: { plan_type: 'Free', remaining_tries: 3 },
    });
    vi.mocked(generateAnalysisWithGeminiRetry).mockRejectedValue(
      new Error('GEMINI_TIMEOUT')
    );

    // Act: 분석 생성 시도
    const result = await createAnalysis(
      mockSupabase,
      mockFreeUser.userId,
      'test-api-key',
      mockAnalysisRequest
    );

    // Assert: EXTERNAL_SERVICE_ERROR 에러, 횟수 차감 없음
    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.errorCode).toBe('EXTERNAL_SERVICE_ERROR');
      expect(result.message).toBe('일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
    }

    // DB 변경 없음 확인
    expect(mockSupabase.from('analyses').insert).not.toHaveBeenCalled();
    expect(mockSupabase.from('subscriptions').update).not.toHaveBeenCalled();
  });

  it('TC-005: Gemini API 실패 후 횟수 차감 방지', async () => {
    // Arrange: Gemini API 실패
    mockSupabase.from('users').select().eq().single.mockResolvedValue({
      data: { id: mockFreeUser.userId },
    });
    mockSupabase.from('subscriptions').select().eq().single.mockResolvedValue({
      data: { plan_type: 'Free', remaining_tries: 3 },
    });
    vi.mocked(generateAnalysisWithGeminiRetry).mockRejectedValue(
      new Error('GEMINI_RATE_LIMIT')
    );

    // Act: 분석 생성 시도
    const result = await createAnalysis(
      mockSupabase,
      mockFreeUser.userId,
      'test-api-key',
      mockAnalysisRequest
    );

    // Assert: 에러 발생, DB 변경 없음
    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.errorCode).toBe('EXTERNAL_SERVICE_ERROR');
    }
    expect(mockSupabase.from('analyses').insert).not.toHaveBeenCalled();
    expect(mockSupabase.from('subscriptions').update).not.toHaveBeenCalled();
  });

  it('TC-006: DB 저장 실패 시 롤백', async () => {
    // Arrange: 분석 저장 실패
    mockSupabase.from('users').select().eq().single.mockResolvedValue({
      data: { id: mockFreeUser.userId },
    });
    mockSupabase.from('subscriptions').select().eq().single.mockResolvedValue({
      data: { plan_type: 'Free', remaining_tries: 3 },
    });
    vi.mocked(generateAnalysisWithGeminiRetry).mockResolvedValue('분석 결과');
    mockSupabase.from('analyses').insert().select().single.mockResolvedValue({
      error: { message: 'DB insert failed' },
    });

    // Act: 분석 생성 시도
    const result = await createAnalysis(
      mockSupabase,
      mockFreeUser.userId,
      'test-api-key',
      mockAnalysisRequest
    );

    // Assert: DB 에러, 횟수 차감 없음
    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.errorCode).toBe('DATABASE_ERROR');
    }
    expect(mockSupabase.from('subscriptions').update).not.toHaveBeenCalled();
  });
});