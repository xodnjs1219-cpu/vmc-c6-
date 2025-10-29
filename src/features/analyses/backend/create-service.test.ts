import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAnalysis } from './create-service';
import { generateAnalysisWithGeminiRetry } from '@/backend/lib/external/gemini-client';
import { mockFreeUser, mockProUser } from '../../../../tests/fixtures/user';

// Mock dependencies
vi.mock('@/backend/lib/external/gemini-client');
vi.mock('@/backend/lib/external/clerk-client');

describe('createAnalysis', () => {
  let mockSupabase: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockSupabase = {
      from: vi.fn().mockImplementation((table: string) => {
        const selectMock = {
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        };

        const updateMock = {
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        };

        const insertMock = {
          select: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        };

        const deleteMock = {
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        };

        return {
          select: vi.fn().mockReturnValue(selectMock),
          insert: vi.fn().mockReturnValue(insertMock),
          update: vi.fn().mockReturnValue(updateMock),
          delete: vi.fn().mockReturnValue(deleteMock),
        };
      }),
    };
  });

  it('TC-001: Free 사용자 정상 분석 생성', async () => {
    // users 테이블 조회 - 사용자 조회
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'users') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: mockFreeUser.userId, email: 'test@example.com' },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'subscriptions') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { plan_type: 'Free', remaining_tries: 3 },
                error: null,
              }),
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        };
      }
      if (table === 'analyses') {
        return {
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: 'analysis_123',
                  name: '홍길동',
                  birth_date: '1990-01-01',
                  birth_time: null,
                  is_lunar: false,
                  model_type: 'flash',
                  created_at: '2025-01-28T10:00:00Z',
                },
                error: null,
              }),
            }),
          }),
          delete: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      };
    });

    vi.mocked(generateAnalysisWithGeminiRetry).mockResolvedValue('분석 결과');

    const result = await createAnalysis(
      mockSupabase,
      mockFreeUser.userId,
      'test-api-key',
      {
        name: '홍길동',
        birth_date: '1990-01-01',
        birth_time: null,
        is_lunar: false,
        model_type: 'flash',
      }
    );

    expect(result.status).toBe('success');
    if (result.status === 'success') {
      expect(result.data.remaining_tries).toBe(2);
    }
  });

  it('TC-002: Pro 사용자 정상 분석 생성', async () => {
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'users') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: mockProUser.userId, email: 'pro@example.com' },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'subscriptions') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { plan_type: 'Pro', remaining_tries: 10 },
                error: null,
              }),
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        };
      }
      if (table === 'analyses') {
        return {
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: 'analysis_456',
                  name: '김철수',
                  birth_date: '1985-05-15',
                  birth_time: '12:30',
                  is_lunar: true,
                  model_type: 'pro',
                  created_at: '2025-01-28T11:00:00Z',
                },
                error: null,
              }),
            }),
          }),
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      };
    });

    vi.mocked(generateAnalysisWithGeminiRetry).mockResolvedValue('Pro 분석 결과');

    const result = await createAnalysis(
      mockSupabase,
      mockProUser.userId,
      'test-api-key',
      {
        name: '김철수',
        birth_date: '1985-05-15',
        birth_time: '12:30',
        is_lunar: true,
        model_type: 'pro',
      }
    );

    expect(result.status).toBe('success');
    if (result.status === 'success') {
      expect(result.data.remaining_tries).toBe(9);
      expect(result.data.model_type).toBe('pro');
    }
  });

  it('TC-003: Free 사용자 횟수 소진 시 QUOTA_EXCEEDED 에러', async () => {
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'users') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: mockFreeUser.userId, email: 'test@example.com' },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'subscriptions') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { plan_type: 'Free', remaining_tries: 0 },
                error: null,
              }),
            }),
          }),
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      };
    });

    const result = await createAnalysis(
      mockSupabase,
      mockFreeUser.userId,
      'test-api-key',
      {
        name: '홍길동',
        birth_date: '1990-01-01',
        birth_time: null,
        is_lunar: false,
        model_type: 'flash',
      }
    );

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.errorCode).toBe('QUOTA_EXCEEDED');
    }

    expect(vi.mocked(generateAnalysisWithGeminiRetry)).not.toHaveBeenCalled();
  });

  it('TC-004: Gemini API 타임아웃 시 EXTERNAL_SERVICE_ERROR 에러', async () => {
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'users') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: mockFreeUser.userId, email: 'test@example.com' },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'subscriptions') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { plan_type: 'Free', remaining_tries: 3 },
                error: null,
              }),
            }),
          }),
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      };
    });

    vi.mocked(generateAnalysisWithGeminiRetry).mockRejectedValue(
      new Error('GEMINI_TIMEOUT')
    );

    const result = await createAnalysis(
      mockSupabase,
      mockFreeUser.userId,
      'test-api-key',
      {
        name: '홍길동',
        birth_date: '1990-01-01',
        birth_time: null,
        is_lunar: false,
        model_type: 'flash',
      }
    );

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.errorCode).toBe('EXTERNAL_SERVICE_ERROR');
    }
  });

  it('TC-005: Gemini API 실패 후 횟수 차감 방지', async () => {
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'users') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: mockFreeUser.userId, email: 'test@example.com' },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'subscriptions') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { plan_type: 'Free', remaining_tries: 3 },
                error: null,
              }),
            }),
          }),
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      };
    });

    vi.mocked(generateAnalysisWithGeminiRetry).mockRejectedValue(
      new Error('GEMINI_RATE_LIMIT')
    );

    const result = await createAnalysis(
      mockSupabase,
      mockFreeUser.userId,
      'test-api-key',
      {
        name: '홍길동',
        birth_date: '1990-01-01',
        birth_time: null,
        is_lunar: false,
        model_type: 'flash',
      }
    );

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.errorCode).toBe('EXTERNAL_SERVICE_ERROR');
    }
  });

  it('TC-006: DB 저장 실패 시 롤백', async () => {
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'users') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: mockFreeUser.userId, email: 'test@example.com' },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'subscriptions') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { plan_type: 'Free', remaining_tries: 3 },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'analyses') {
        return {
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: null,
                error: { message: 'DB insert failed' },
              }),
            }),
          }),
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      };
    });

    vi.mocked(generateAnalysisWithGeminiRetry).mockResolvedValue('분석 결과');

    const result = await createAnalysis(
      mockSupabase,
      mockFreeUser.userId,
      'test-api-key',
      {
        name: '홍길동',
        birth_date: '1990-01-01',
        birth_time: null,
        is_lunar: false,
        model_type: 'flash',
      }
    );

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.errorCode).toBe('DATABASE_ERROR');
    }
  });
});
