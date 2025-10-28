// tests/fixtures/analysis.ts
export const mockAnalysisRequest = {
  name: '홍길동',
  birth_date: '1990-01-01',
  birth_time: null,
  is_lunar: false,
  model_type: 'flash' as const,
};

export const mockAnalysisResponse = {
  id: 'analysis_123',
  name: '홍길동',
  birth_date: '1990-01-01',
  birth_time: null,
  is_lunar: false,
  model_type: 'flash',
  content: '사주 분석 결과 내용...',
  created_at: '2025-01-28T10:00:00Z',
  remaining_tries: 2,
};

export const mockGeminiAnalysisData = {
  name: '홍길동',
  birth_date: '1990-01-01',
  birth_time: null,
  is_lunar: false,
};