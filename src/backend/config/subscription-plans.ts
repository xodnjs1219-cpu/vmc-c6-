/**
 * 구독 플랜 설정 중앙 관리
 * 모든 플랜 관련 상수와 설정을 한 곳에서 관리
 */

export const SUBSCRIPTION_PLANS = {
  Free: {
    name: 'Free' as const,
    displayName: '무료',
    price: 0,
    monthlyQuota: 3,
    billingCycle: null,
    features: ['월 3회 무료 분석', '기본 분석 모델'],
  },
  Pro: {
    name: 'Pro' as const,
    displayName: '프로',
    price: 3900,
    monthlyQuota: 10,
    billingCycle: 'monthly' as const,
    features: [
      '월 10회 분석',
      '빠른 응답 속도',
      '상세 분석 모델',
      '우선 지원',
    ],
  },
} as const;

export type PlanType = keyof typeof SUBSCRIPTION_PLANS;
export type PlanConfig = (typeof SUBSCRIPTION_PLANS)[PlanType];

/**
 * 플랜 이름으로 설정 가져오기
 */
export function getPlanConfig(planType: PlanType): PlanConfig {
  return SUBSCRIPTION_PLANS[planType];
}

/**
 * 플랜 목록 가져오기
 */
export function getAllPlans(): PlanConfig[] {
  return Object.values(SUBSCRIPTION_PLANS);
}

/**
 * 플랜 타입 검증
 */
export function isValidPlanType(planType: string): planType is PlanType {
  return planType in SUBSCRIPTION_PLANS;
}
