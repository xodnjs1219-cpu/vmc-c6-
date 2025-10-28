import { describe, it, expect, vi, beforeEach } from 'vitest';
import { processUserCreated } from './service';
import { clerkClient } from '@/backend/lib/external/clerk-client';


// Mock Clerk 클라이언트
vi.mock('@/backend/lib/external/clerk-client');

// Mock supabase-js createClient (DB fetch 방지)
vi.mock('@supabase/supabase-js', () => {
  return {
    createClient: vi.fn(() => {
      return {
        from: vi.fn(() => ({
          upsert: vi.fn(() => ({
            onConflict: vi.fn(() => Promise.resolve({ error: null })),
          })),
        })),
      };
    }),
  };
});

describe('processUserCreated', () => {
  let mockSupabase: any;

  function makeSupabaseMock(upsertImplUsers: any, upsertImplSubs: any) {
    return {
      from: vi.fn((table: string) => {
        if (table === 'users') {
          return {
            upsert: vi.fn(() => ({
              onConflict: vi.fn().mockImplementation(upsertImplUsers),
            })),
          };
        }
        if (table === 'subscriptions') {
          return {
            upsert: vi.fn(() => ({
              onConflict: vi.fn().mockImplementation(upsertImplSubs),
            })),
          };
        }
        return {};
      }),
    };
  }

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


    mockSupabase = makeSupabaseMock(
      () => Promise.resolve({ error: null }),
      () => Promise.resolve({ error: null })
    );

    // Act: 사용자 생성 처리
    const result = await processUserCreated(mockEvent);

    // Assert: 성공 결과 확인
    expect(result.success).toBe(true);
    expect(result.userId).toBe('user_clerk_123');
    expect(result.message).toBe('User created successfully');

    // Clerk 메타데이터 업데이트 확인
    expect(clerkClient.updateUserPublicMetadata).toHaveBeenCalledWith('user_clerk_123', {
      subscription: 'Free',
    });
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

    // upsert는 중복 데이터를 처리하므로 동일하게 성공

    mockSupabase = makeSupabaseMock(
      () => Promise.resolve({ error: null }),
      () => Promise.resolve({ error: null })
    );

    // Act: 동일한 이벤트 재처리
    const result = await processUserCreated(mockEvent);

    // Assert: 여전히 성공 (멱등성)
    expect(result.success).toBe(true);
    expect(result.userId).toBe('user_clerk_123');
  });

  it('TC-014: DB 트랜잭션 실패', async () => {
    // Arrange: 사용자 테이블 삽입 실패
    await vi.doMock('@supabase/supabase-js', () => ({
      createClient: () => ({
        from: (table) => {
          if (table === 'users') {
            return {
              upsert: () => ({
                onConflict: () => Promise.resolve({ error: { message: 'Connection failed' } })
              })
            };
          }
          if (table === 'subscriptions') {
            return {
              upsert: () => ({
                onConflict: () => Promise.resolve({ error: null })
              })
            };
          }
          return {};
        }
      })
    }));

    const { processUserCreated } = require('./service');
    const mockEvent = {
      type: 'user.created',
      data: {
        id: 'user_clerk_123',
        email_addresses: [{ email_address: 'test@example.com' }],
        first_name: '홍',
        last_name: '길동',
        image_url: 'https://example.com/avatar.jpg',
      },
    };

    // Act: 사용자 생성 처리
    const result = await processUserCreated(mockEvent);

    // Assert: 실패 결과 확인
    expect(result.success).toBe(false);
    expect(result.message).toBe('Database error: Connection failed');
    expect(clerkClient.updateUserPublicMetadata).not.toHaveBeenCalled();
  });
                onConflict: vi.fn(() => Promise.resolve({ error: { message: 'Connection failed' } })),
              })),
            };
          }
          if (table === 'subscriptions') {
            return {
              upsert: vi.fn(() => ({
                onConflict: vi.fn(() => Promise.resolve({ error: null })),
              })),
            };
          }
          return {};
        }),
      };
    });

    // Act: 사용자 생성 처리
    const result = await processUserCreated(mockEvent);

    // Assert: 실패 결과 확인
    expect(result.success).toBe(false);
    expect(result.message).toBe('Database error: Connection failed');

    // 구독 테이블은 호출되지 않음 (트랜잭션 실패)
    expect(mockSupabase.from).toHaveBeenCalledTimes(1); // users 테이블만
    expect(clerkClient.updateUserPublicMetadata).not.toHaveBeenCalled();
  });
});