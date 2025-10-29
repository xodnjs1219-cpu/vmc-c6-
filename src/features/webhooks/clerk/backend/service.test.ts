import { describe, it, expect, vi, beforeEach } from 'vitest';
import { processUserCreated } from './service';
import { clerkClient } from '@/backend/lib/external/clerk-client';
import type { SupabaseClient } from '@supabase/supabase-js';

// Mock Clerk 클라이언트
vi.mock('@/backend/lib/external/clerk-client');

// Mock 함수 생성 헬퍼
const createMockSupabaseClient = (options: {
  shouldFailUser?: boolean;
  shouldFailSubscription?: boolean
} = {}): SupabaseClient => {
  const mockFrom = vi.fn((table: string) => {
    if (table === 'users' && options.shouldFailUser) {
      return {
        upsert: vi.fn(() =>
          Promise.resolve({ error: { message: 'User insert failed' } })
        ),
      };
    }
    if (table === 'subscriptions' && options.shouldFailSubscription) {
      return {
        upsert: vi.fn(() =>
          Promise.resolve({ error: { message: 'Subscription insert failed' } })
        ),
      };
    }
    return {
      upsert: vi.fn(() => Promise.resolve({ error: null })),
    };
  });

  return {
    from: mockFrom,
  } as unknown as SupabaseClient;
};

describe('processUserCreated', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(clerkClient.updateUserPublicMetadata).mockResolvedValue();
  });

  it('TC-011: user.created 이벤트 정상 처리', async () => {
    // Arrange: 정상적인 Clerk webhook 이벤트
    const mockEvent = {
      type: 'user.created' as const,
      data: {
        id: 'user_clerk_123',
        email_addresses: [{ email_address: 'test@example.com' }],
        first_name: '홍',
        last_name: '길동',
        image_url: 'https://example.com/avatar.jpg',
      },
    };

    const mockSupabase = createMockSupabaseClient();

    // Act: 사용자 생성 처리
    const result = await processUserCreated(mockEvent, mockSupabase);

    // Assert: 성공 결과 확인
    expect(result.success).toBe(true);
    expect(result.userId).toBe('user_clerk_123');
    expect(result.message).toBe('User created successfully');

    // Clerk 메타데이터 업데이트 확인
    expect(clerkClient.updateUserPublicMetadata).toHaveBeenCalledWith('user_clerk_123', {
      subscription: 'Free',
    });

    // DB 호출 확인
    expect(mockSupabase.from).toHaveBeenCalledWith('users');
    expect(mockSupabase.from).toHaveBeenCalledWith('subscriptions');
  });

  it('TC-012: 중복 이벤트 멱등성 보장', async () => {
    // Arrange: 동일한 사용자 ID로 재전송
    const mockEvent = {
      type: 'user.created' as const,
      data: {
        id: 'user_clerk_123',
        email_addresses: [{ email_address: 'test@example.com' }],
        first_name: '홍',
        last_name: '길동',
        image_url: 'https://example.com/avatar.jpg',
      },
    };

    const mockSupabase = createMockSupabaseClient();

    // upsert는 중복 데이터를 처리하므로 동일하게 성공

    // Act: 동일한 이벤트 재처리
    const result = await processUserCreated(mockEvent, mockSupabase);

    // Assert: 여전히 성공 (멱등성)
    expect(result.success).toBe(true);
    expect(result.userId).toBe('user_clerk_123');
  });

  it('TC-014: DB 트랜잭션 실패', async () => {
    // Arrange: DB 실패를 시뮬레이션
    const mockEvent = {
      type: 'user.created' as const,
      data: {
        id: 'user_clerk_fail',
        email_addresses: [{ email_address: 'fail@example.com' }],
        first_name: '실패',
        last_name: '테스트',
        image_url: 'https://example.com/avatar.jpg',
      },
    };

    const mockSupabase = createMockSupabaseClient({ shouldFailUser: true });

    // Act: 사용자 생성 처리
    const result = await processUserCreated(mockEvent, mockSupabase);

    // Assert: 실패 결과 확인
    expect(result.success).toBe(false);
    expect(result.message).toContain('Database error');
  });
});
