export const HERO_CONTENT = {
  title: '당신의 운명을 AI가 풀어드립니다',
  subtitle: 'Gemini AI 기반 전문 사주 풀이 서비스',
  description:
    '전통 명리학과 현대 AI 기술의 만남. 정확하고 상세한 사주 분석을 경험하세요.',
} as const;

export const FEATURES = [
  {
    id: 'feature-1',
    title: 'AI 기반 정확한 분석',
    description: 'Google Gemini 2.5 AI 모델을 활용한 전문적인 사주 풀이',
    icon: 'Sparkles',
  },
  {
    id: 'feature-2',
    title: '간편한 정보 입력',
    description: '생년월일시만 입력하면 즉시 분석 시작',
    icon: 'Clock',
  },
  {
    id: 'feature-3',
    title: '상세한 분석 결과',
    description: '성격, 재물운, 직업운, 애정운을 포함한 종합 분석',
    icon: 'FileText',
  },
  {
    id: 'feature-4',
    title: '분석 결과 보관',
    description: '언제든 다시 볼 수 있는 분석 내역 관리',
    icon: 'Archive',
  },
] as const;

export const PRICING_PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    period: '평생',
    description: '서비스를 체험해보세요',
    features: [
      '총 3회 무료 분석',
      'Gemini 2.5 Flash 모델',
      '기본 사주 분석',
      '분석 결과 다운로드',
    ],
    limitations: ['모델 선택 불가', '추가 분석 불가'],
    highlight: false,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 3900,
    period: '월',
    description: '전문가 수준의 상세 분석',
    features: [
      '월 10회 분석',
      'Gemini 2.5 Pro 모델 선택 가능',
      '고급 사주 분석',
      '분석 결과 다운로드',
      '무제한 과거 내역 조회',
    ],
    limitations: [],
    highlight: true,
  },
] as const;

export const CTA_CONTENT = {
  guest: {
    login: '로그인',
    signup: '회원가입',
  },
  authenticated: {
    dashboard: '대시보드',
    newAnalysis: '새 분석하기',
    subscription: '구독 관리',
    logout: '로그아웃',
  },
} as const;
