import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchAnalysesList } from './service';

const mockSupabase = {
  from: vi.fn(),
};

describe('fetchAnalysesList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('TC-001: 정상적으로 분석 목록을 반환한다', async () => {
    // Arrange
    const userId = 'user_123';
    const query = { page: 1, limit: 2 };
    const mockCount = 3;
    const mockData = [
      { id: 1, user_id: userId, name: '분석1', created_at: '2023-01-01' },
      { id: 2, user_id: userId, name: '분석2', created_at: '2023-01-02' },
    ];
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'analyses') {
        return {
          select: vi.fn().mockImplementation((sel: string, opts?: any) => {
            if (opts?.count === 'exact' && opts?.head) {
              return {
                eq: vi.fn().mockReturnValue({ count: mockCount, error: null }),
              };
            }
            return {
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  range: vi.fn().mockReturnValue({ data: mockData, error: null }),
                }),
              }),
            };
          }),
        };
      }
      return {};
    });

    // Act
    const result = await fetchAnalysesList(mockSupabase as any, userId, query);

    // Assert
    expect(result.status).toBe('success');
    if (result.status === 'success') {
      expect(result.data.items.length).toBe(2);
      expect(result.data.pagination.total_count).toBe(3);
      expect(result.data.pagination.current_page).toBe(1);
    } else {
      throw new Error('성공 케이스에서 error 반환');
    }
  });

  it('TC-002: count 조회 에러 시 에러 반환', async () => {
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ count: null, error: { message: 'DB 오류' } }),
      }),
    });
    const result = await fetchAnalysesList(mockSupabase as any, 'user_123', { page: 1, limit: 2 });
    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.error).toContain('DB 오류');
    } else {
      throw new Error('에러 케이스에서 success 반환');
    }
  });

  it('TC-003: 데이터 조회 에러 시 에러 반환', async () => {
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'analyses') {
        return {
          select: vi.fn().mockImplementation((sel: string, opts?: any) => {
            if (opts?.count === 'exact' && opts?.head) {
              return {
                eq: vi.fn().mockReturnValue({ count: 2, error: null }),
              };
            }
            return {
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  range: vi.fn().mockReturnValue({ data: null, error: { message: '조회 오류' } }),
                }),
              }),
            };
          }),
        };
      }
      return {};
    });
    const result = await fetchAnalysesList(mockSupabase as any, 'user_123', { page: 1, limit: 2 });
    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.error).toContain('조회 오류');
    } else {
      throw new Error('에러 케이스에서 success 반환');
    }
  });
});
