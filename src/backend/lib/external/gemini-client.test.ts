import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { generateAnalysisWithGeminiRetry } from '@/backend/lib/external/gemini-client';


// GoogleGenerativeAI를 클래스로 모킹
let mockGeminiModel: any;
vi.mock('@google/generative-ai', () => {
  return {
    GoogleGenerativeAI: class {
      constructor() {}
      getGenerativeModel() {
        return mockGeminiModel;
      }
    }
  };
});

describe('generateAnalysisWithGeminiRetry', () => {

  beforeEach(() => {
    vi.clearAllMocks();
    mockGeminiModel = {
      generateContent: vi.fn(),
    };
  });

  it('TC-007: Flash 모델 정상 응답', async () => {
    // Arrange: 정상 응답 모킹
    const mockResponse = { response: { text: () => '사주 분석 결과' } };
  mockGeminiModel.generateContent.mockResolvedValue(mockResponse);

    // Act: API 호출
    const result = await generateAnalysisWithGeminiRetry(
      'test-api-key',
      'flash',
      {
        name: '홍길동',
        birth_date: '1990-01-01',
        birth_time: null,
        is_lunar: false,
      },
      0 // 재시도 없음
    );

    // Assert: 정상 결과 반환
    expect(result).toBe('사주 분석 결과');
  // getGenerativeModel은 내부에서 호출되므로 직접 검증 생략
  expect(mockGeminiModel.generateContent).toHaveBeenCalledTimes(1);
  });

  it('TC-008: 타임아웃 후 재시도하여 성공', async () => {
    // Arrange: 첫 번째 실패, 두 번째 성공
    const mockResponse = { response: { text: () => '분석 결과' } };
    mockGeminiModel.generateContent
      .mockRejectedValueOnce(new Error('Gemini API timeout')) // 첫 번째 호출
      .mockResolvedValueOnce(mockResponse); // 두 번째 호출

    // Act: 재시도 포함 호출
    const result = await generateAnalysisWithGeminiRetry(
      'test-api-key',
      'pro',
      {
        name: '홍길동',
        birth_date: '1990-01-01',
        birth_time: null,
        is_lunar: false,
      },
      1 // 최대 1회 재시도
    );

    // Assert: 성공 결과 반환, 총 2회 호출
    expect(result).toBe('분석 결과');
  expect(mockGeminiModel.generateContent).toHaveBeenCalledTimes(2);
  });

  it('TC-009: 최대 재시도 초과', async () => {
    // Arrange: 3회 모두 실패
  mockGeminiModel.generateContent.mockRejectedValue(new Error('Gemini API timeout'));

    // Act & Assert: 최대 재시도 초과로 에러 발생
    await expect(
      generateAnalysisWithGeminiRetry(
        'test-api-key',
        'flash',
        {
          name: '홍길동',
          birth_date: '1990-01-01',
          birth_time: null,
          is_lunar: false,
        },
        2 // 최대 2회 재시도
      )
    ).rejects.toThrow('GEMINI_TIMEOUT');

  expect(mockGeminiModel.generateContent).toHaveBeenCalledTimes(3); // 초기 1회 + 재시도 2회
  });

  it('TC-010: 지수 백오프 확인', async () => {
    // Arrange: 타이머 모킹으로 지연 확인
    vi.useFakeTimers();

    const mockResponse = { response: { text: () => '결과' } };
    mockGeminiModel.generateContent
      .mockRejectedValueOnce(new Error('GEMINI_TIMEOUT'))
      .mockRejectedValueOnce(new Error('GEMINI_TIMEOUT'))
      .mockResolvedValueOnce(mockResponse);

    // Act: 재시도 호출 시작
    const promise = generateAnalysisWithGeminiRetry(
      'test-api-key',
      'flash',
      {
        name: '홍길동',
        birth_date: '1990-01-01',
        birth_time: null,
        is_lunar: false,
      },
      2
    );

    // 첫 번째 재시도 대기 (1초)
    await vi.advanceTimersByTimeAsync(1000);
  expect(mockGeminiModel.generateContent).toHaveBeenCalledTimes(2);

    // 두 번째 재시도 대기 (2초)
    await vi.advanceTimersByTimeAsync(2000);
  expect(mockGeminiModel.generateContent).toHaveBeenCalledTimes(3);

    // Promise 완료 대기
    const result = await promise;

    // Assert: 최종 성공
    expect(result).toBe('결과');

    vi.useRealTimers();
  });
});