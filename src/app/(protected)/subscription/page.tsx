'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Check, X, AlertCircle } from 'lucide-react';
import { useAuth } from '@clerk/nextjs';
import { useCurrentUser } from '@/features/auth/hooks/useCurrentUser';
import { useToast } from '@/hooks/use-toast';
import { loadTossPayments } from '@tosspayments/payment-sdk';
import { apiClient } from '@/lib/remote/api-client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

type SubscriptionPageProps = {
  params: Promise<Record<string, never>>;
};

const PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    period: '평생',
    features: ['총 3회 무료 분석', 'Gemini 2.5 Flash 모델'],
    limitations: ['모델 선택 불가', '추가 분석 불가'],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 3900,
    period: '월',
    features: ['월 10회 분석', 'Gemini 2.5 Pro 모델'],
    limitations: [],
  },
];

export default function SubscriptionPage({ params }: SubscriptionPageProps) {
  void params;
  const router = useRouter();
  const { toast } = useToast();
  const { userId } = useAuth();
  const { currentUser } = useCurrentUser();

  const [isLoading, setIsLoading] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  const [upgradeData, setUpgradeData] = useState({
    name: currentUser?.firstName || '',
    email: currentUser?.email || '',
    phone: '',
  });

  const handleUpgrade = async () => {
    // 사용자 정보 검증
    if (!upgradeData.name.trim()) {
      toast({
        title: '오류',
        description: '이름을 입력해주세요.',
        variant: 'destructive',
      });
      return;
    }

    if (!upgradeData.email) {
      toast({
        title: '오류',
        description: '이메일을 입력해주세요.',
        variant: 'destructive',
      });
      return;
    }

    if (!upgradeData.phone.match(/^\d{10,11}$/)) {
      toast({
        title: '오류',
        description: '올바른 전화번호를 입력해주세요. (10-11자 숫자)',
        variant: 'destructive',
      });
      return;
    }

    // userId, tossKey 체크 및 경고
    if (!userId) {
      toast({
        title: '오류',
        description: '로그인 정보가 올바르지 않습니다. 다시 로그인해주세요.',
        variant: 'destructive',
      });
      return;
    }
    const tossKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY;
    if (!tossKey) {
      toast({
        title: '오류',
        description: '결제 시스템 환경변수가 누락되었습니다. 관리자에게 문의하세요.',
        variant: 'destructive',
      });
      return;
    }

    try {
      // 디버깅용 로그
      console.log('TossPayments 호출', { userId, tossKey, upgradeData });
      // 토스페이먼츠 SDK 초기화
      const tossPayments = await loadTossPayments(tossKey);

      // 빌링키 등록 요청
      await tossPayments.requestBillingAuth('카드', {
        customerKey: userId,
        successUrl: `${window.location.origin}/api/payments/subscribe?customerName=${encodeURIComponent(upgradeData.name)}&customerEmail=${encodeURIComponent(upgradeData.email)}&customerPhone=${encodeURIComponent(upgradeData.phone)}`,
        failUrl: `${window.location.origin}/subscription?error=payment_failed`,
      });
      // requestBillingAuth는 결제창을 열고 리다이렉트하므로
      // 여기 도달하는 경우는 거의 없지만, 만약을 위해 유지
      // 모달은 사용자가 결제창을 떠나면 자연스럽게 닫힙니다
    } catch (error) {
      console.error('Toss Payments error:', error);
      toast({
        title: '오류',
        description: '결제 시스템을 초기화할 수 없습니다.',
        variant: 'destructive',
      });
      setIsLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    setIsCancelling(true);

    try {
      await apiClient.post('/api/subscription/cancel', {}, {
        headers: {
          'x-clerk-user-id': userId || '',
        },
      });

      toast({
        title: '성공',
        description: '다음 결제일에 구독이 취소될 예정입니다.',
      });

      setShowCancelModal(false);
      // 페이지 새로고침하여 상태 업데이트
      setTimeout(() => router.refresh(), 1500);
    } catch (error) {
      const message = error instanceof Error ? error.message : '취소 요청 실패';
      toast({
        title: '오류',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-12">
      <Link
        href="/dashboard"
        className="flex items-center gap-2 text-sm text-slate-600 transition hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" />
        대시보드로 돌아가기
      </Link>

      <header className="space-y-2">
        <h1 className="text-3xl font-semibold">구독 관리</h1>
        <p className="text-slate-600">
          현재 요금제: <span className="font-semibold">{currentUser?.subscriptionPlan || 'Free'}</span>
        </p>
      </header>

      <div className="grid gap-8 md:grid-cols-2">
        {PLANS.map((plan) => {
          const isCurrent = currentUser?.subscriptionPlan === plan.name;
          // Pro 플랜만 업그레이드 버튼 활성화
          if (plan.id === 'pro') {
            return (
              <div
                key={plan.id}
                className={`rounded-lg border-2 p-6 transition ${
                  isCurrent ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 bg-white'
                }`}
              >
                <div className="flex items-start justify-between">
                  <h2 className="text-2xl font-bold">{plan.name}</h2>
                  {isCurrent && (
                    <span className="inline-flex items-center rounded-full bg-indigo-600 px-3 py-1 text-xs font-medium text-white">
                      현재 플랜
                    </span>
                  )}
                </div>

                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-4xl font-bold">
                    {plan.price === 0 ? '무료' : `₩${plan.price.toLocaleString()}`}
                  </span>
                  {plan.price > 0 && <span className="text-slate-600">/ {plan.period}</span>}
                </div>

                <div className="mt-6 space-y-3">
                  <h3 className="font-semibold text-slate-900">포함 사항:</h3>
                  {plan.features.map((feature, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <Check className="h-5 w-5 text-green-500" />
                      <span className="text-sm text-slate-700">{feature}</span>
                    </div>
                  ))}
                  {plan.limitations.length > 0 && (
                    <>
                      <h3 className="font-semibold text-slate-900 pt-4">제한 사항:</h3>
                      {plan.limitations.map((limitation, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <X className="h-5 w-5 text-slate-400" />
                          <span className="text-sm text-slate-600">{limitation}</span>
                        </div>
                      ))}
                    </>
                  )}
                </div>

                {isCurrent ? (
                  <button
                    type="button"
                    disabled
                    className="mt-6 w-full rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-500 cursor-not-allowed"
                  >
                    현재 플랜
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsLoading(true)}
                    className="mt-6 w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
                  >
                    {plan.name}로 업그레이드
                  </button>
                )}
              </div>
            );
          }
          // Free 플랜은 업그레이드 버튼 비활성화
          return (
            <div
              key={plan.id}
              className={`rounded-lg border-2 p-6 transition ${
                isCurrent ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 bg-white'
              }`}
            >
              <div className="flex items-start justify-between">
                <h2 className="text-2xl font-bold">{plan.name}</h2>
                {isCurrent && (
                  <span className="inline-flex items-center rounded-full bg-indigo-600 px-3 py-1 text-xs font-medium text-white">
                    현재 플랜
                  </span>
                )}
              </div>

              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-4xl font-bold">
                  {plan.price === 0 ? '무료' : `₩${plan.price.toLocaleString()}`}
                </span>
                {plan.price > 0 && <span className="text-slate-600">/ {plan.period}</span>}
              </div>

              <div className="mt-6 space-y-3">
                <h3 className="font-semibold text-slate-900">포함 사항:</h3>
                {plan.features.map((feature, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Check className="h-5 w-5 text-green-500" />
                    <span className="text-sm text-slate-700">{feature}</span>
                  </div>
                ))}
                {plan.limitations.length > 0 && (
                  <>
                    <h3 className="font-semibold text-slate-900 pt-4">제한 사항:</h3>
                    {plan.limitations.map((limitation, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <X className="h-5 w-5 text-slate-400" />
                        <span className="text-sm text-slate-600">{limitation}</span>
                      </div>
                    ))}
                  </>
                )}
              </div>

              <button
                type="button"
                disabled
                className="mt-6 w-full rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-500 cursor-not-allowed"
              >
                업그레이드 불가
              </button>
            </div>
          );
        })}
      </div>

  {/* 업그레이드 모달 */}
  <Dialog open={isLoading} onOpenChange={setIsLoading}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pro 구독으로 업그레이드</DialogTitle>
            <DialogDescription>
              구독 정보를 입력해주세요.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700">이름 *</label>
              <input
                type="text"
                value={upgradeData.name}
                onChange={(e) => setUpgradeData({ ...upgradeData, name: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:border-indigo-500 focus:outline-none"
                placeholder="이름"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700">이메일 *</label>
              <input
                type="email"
                value={upgradeData.email}
                onChange={(e) => setUpgradeData({ ...upgradeData, email: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:border-indigo-500 focus:outline-none"
                placeholder="이메일"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700">전화번호 *</label>
              <input
                type="tel"
                value={upgradeData.phone}
                onChange={(e) => setUpgradeData({ ...upgradeData, phone: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:border-indigo-500 focus:outline-none"
                placeholder="01012345678"
              />
            </div>

            <div className="rounded-lg bg-blue-50 p-3">
              <p className="text-xs text-blue-900">
                월 ₩3,900의 정기 결제가 설정됩니다.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsLoading(false)}
            >
              취소
            </Button>
            <Button onClick={handleUpgrade}>
              결제하기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 취소 확인 모달 */}
      <Dialog open={showCancelModal} onOpenChange={setShowCancelModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-600" />
              구독 취소 확인
            </DialogTitle>
            <DialogDescription>
              구독을 취소하시겠습니까?
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 rounded-lg bg-red-50 p-4">
            <p className="text-sm text-red-900">
              • 현재 결제 주기가 끝난 후 Free 플랜으로 변경됩니다.
            </p>
            <p className="text-sm text-red-900">
              • 남은 분석 횟수는 초기화됩니다.
            </p>
            <p className="text-sm text-red-900">
              • 언제든지 다시 Pro로 구독할 수 있습니다.
            </p>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCancelModal(false)}
            >
              계속 구독
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancelSubscription}
              disabled={isCancelling}
            >
              {isCancelling ? '처리 중...' : '구독 취소'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {currentUser?.subscriptionPlan === 'Pro' && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-6">
          <h3 className="font-semibold text-slate-900">구독 취소</h3>
          <p className="mt-2 text-sm text-slate-700">
            구독을 취소하시면 현재 결제 주기가 끝난 후부터 Free 플랜으로 변경됩니다.
          </p>
          <button
            type="button"
            onClick={() => setShowCancelModal(true)}
            className="mt-4 rounded-lg border border-rose-300 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
          >
            구독 취소하기
          </button>
        </div>
      )}
    </div>
  );
}
