import { GoogleGenerativeAI } from '@google/generative-ai';
import { ErrorCodes } from '@/backend/errors';

const GEMINI_TIMEOUT = 90000; // 90초 타임아웃 (사주 분석은 시간이 걸릴 수 있음)

/**
 * Gemini API를 통해 사주 분석 콘텐츠를 생성합니다.
 *
 * @param apiKey - Gemini API 키
 * @param modelType - 사용할 모델 ('flash' 또는 'pro')
 * @param analysisData - 분석 대상 정보
 * @returns 생성된 마크다운 분석 콘텐츠
 * @throws 타임아웃 또는 API 에러
 */
export async function generateAnalysisWithGemini(
  apiKey: string,
  modelType: 'flash' | 'pro',
  analysisData: {
    name: string;
    birth_date: string;
    birth_time?: string | null;
    is_lunar: boolean;
  }
): Promise<string> {
  try {
    console.log('[generateAnalysisWithGemini] Starting Gemini API call');
    console.log('[generateAnalysisWithGemini] Model:', modelType);
    
    const genAI = new GoogleGenerativeAI(apiKey);

    // Gemini 2.5 모델 사용
    const modelName = modelType === 'flash' ? 'gemini-2.5-flash' : 'gemini-2.5-pro';
    console.log('[generateAnalysisWithGemini] Using model:', modelName);

    const prompt = createSajuPrompt(analysisData);
    console.log('[generateAnalysisWithGemini] Prompt created, length:', prompt.length);

    // 타임아웃 처리를 위해 Promise.race 사용
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(
        () => reject(new Error('Gemini API timeout')),
        GEMINI_TIMEOUT
      );
    });

    const model = genAI.getGenerativeModel({ model: modelName });

    const result = await Promise.race([
      model.generateContent(prompt),
      timeoutPromise
    ]);
    
    console.log('[generateAnalysisWithGemini] API response received');
    
    // Gemini API 응답에서 텍스트 추출
    const text = result.response.text();

    if (!text || text.trim().length === 0) {
      console.error('[generateAnalysisWithGemini] Empty response from Gemini API');
      throw new Error('Empty response from Gemini API');
    }

    console.log('[generateAnalysisWithGemini] Text extracted, length:', text.length);
    return text;
  } catch (error) {
    console.error('[generateAnalysisWithGemini] Error occurred:', error);
    if (error instanceof Error) {
      if (error.message.includes('timeout')) {
        throw new Error(ErrorCodes.GEMINI_TIMEOUT);
      }
      if (error.message.includes('API key')) {
        throw new Error(ErrorCodes.GEMINI_AUTH_ERROR);
      }
      if (error.message.includes('rate limit')) {
        throw new Error(ErrorCodes.GEMINI_RATE_LIMIT);
      }
    }
    throw error;
  }
}

/**
 * 사주 분석을 위한 프롬프트를 생성합니다.
 */
function createSajuPrompt(data: {
  name: string;
  birth_date: string;
  birth_time?: string | null;
  is_lunar: boolean;
}): string {
  const birthTimeStr = data.birth_time || '시간 미정';
  const calendarType = data.is_lunar ? '음력' : '양력';

  return `당신은 20년 경력의 전문 사주팔자 상담사입니다.

**사주 정보:**
- 이름: ${data.name}
- 생년월일: ${data.birth_date} (${calendarType})
- 태어난 시간: ${birthTimeStr}

**분석 요구사항**:
1️⃣ 천간(天干)과 지지(地支) 계산
2️⃣ 오행(五行) 분석 (목, 화, 토, 금, 수)
3️⃣ 대운(大運)과 세운(歲運) 해석
4️⃣ 전반적인 성격, 재운, 건강운, 연애운 분석

**출력 형식**: 마크다운

**금지 사항**:
- 의료·법률 조언
- 확정적 미래 예측
- 부정적·공격적 표현`;
}

/**
 * 재시도 로직이 포함된 Gemini API 호출
 */
export async function generateAnalysisWithGeminiRetry(
  apiKey: string,
  modelType: 'flash' | 'pro',
  analysisData: {
    name: string;
    birth_date: string;
    birth_time?: string | null;
    is_lunar: boolean;
  },
  maxRetries: number = 1
): Promise<string> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await generateAnalysisWithGemini(apiKey, modelType, analysisData);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // 타임아웃이나 서버 에러인 경우만 재시도
      if (
        lastError.message === ErrorCodes.GEMINI_TIMEOUT ||
        lastError.message === ErrorCodes.GEMINI_RATE_LIMIT
      ) {
        if (attempt < maxRetries) {
          // 지수 백오프: 1초, 2초, 4초...
          const delayMs = Math.pow(2, attempt) * 1000;
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          continue;
        }
      }

      throw lastError;
    }
  }

  throw lastError || new Error('Gemini API failed');
}
