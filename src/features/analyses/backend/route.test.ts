
import { describe, it, expect, vi } from 'vitest';
import { createHonoApp } from '@/backend/hono/app';
vi.mock('@/backend/supabase', () => ({
  createSupabaseServerClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => ({
            data: {
              id: 'test-id',
              name: '테스트 분석',
              birth_date: '2025-10-28',
              birth_time: '12:34',
              is_lunar: false,
              model_type: 'pro',
              created_at: '2025-10-28T00:00:00Z',
            },
          }),
        }),
      }),
    }),
  }),
}));

describe('GET /api/analyses/:id', () => {
  it('Supabase에서 받아온 데이터를 JSON으로 응답한다', async () => {
    const app = createHonoApp();
    const req = new Request('http://localhost/api/analyses/test-id', {
      method: 'GET',
      headers: { 'x-clerk-user-id': 'mock-user' },
    });
    const res = await app.request(req);
    const json = await res.json();
    expect(json.data.name).toBe('테스트 분석');
    expect(json.data.model_type).toBe('pro');
  });
});
