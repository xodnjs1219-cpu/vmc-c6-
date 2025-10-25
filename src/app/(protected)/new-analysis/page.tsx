'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import { useCurrentUser } from '@/features/auth/hooks/useCurrentUser';
import { useCreateAnalysisMutation } from '@/features/analyses/hooks/useCreateAnalysisMutation';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

type NewAnalysisPageProps = {
  params: Promise<Record<string, never>>;
};

export default function NewAnalysisPage({ params }: NewAnalysisPageProps) {
  void params;
  const router = useRouter();
  const { toast } = useToast();
  const { currentUser } = useCurrentUser();
  const createMutation = useCreateAnalysisMutation();

  const [formData, setFormData] = useState({
    name: '',
    birth_date: '',
    birth_time: '',
    is_lunar: false,
    time_unknown: false,
    model_type: 'flash' as 'flash' | 'pro',
  });

  const [showResultModal, setShowResultModal] = useState(false);
  const [resultData, setResultData] = useState<{
    id: string;
    remaining_tries: number;
  } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 유효성 검증
    if (!formData.name.trim()) {
      toast({
        title: '오류',
        description: '분석 대상 이름을 입력해주세요.',
        variant: 'destructive',
      });
      return;
    }

    if (!formData.birth_date) {
      toast({
        title: '오류',
        description: '생년월일을 입력해주세요.',
        variant: 'destructive',
      });
      return;
    }

    createMutation.mutate(
      {
        name: formData.name,
        birth_date: formData.birth_date,
        birth_time: formData.birth_time || null,
        is_lunar: formData.is_lunar,
        model_type: formData.model_type,
      },
      {
        onSuccess: (data) => {
          setResultData({
            id: data.id,
            remaining_tries: data.remaining_tries,
          });
          setShowResultModal(true);
        },
        onError: (error) => {
          const message = error instanceof Error ? error.message : '분석 생성에 실패했습니다.';
          if (message.includes('QUOTA_EXCEEDED')) {
            toast({
              title: '분석 횟수 소진',
              description: '무료 분석 횟수를 모두 사용했습니다.',
              variant: 'destructive',
            });
            setTimeout(() => router.push('/subscription'), 2000);
          } else if (message.includes('EXTERNAL_SERVICE_ERROR')) {
            toast({
              title: '일시적 오류',
              description: '잠시 후 다시 시도해주세요.',
              variant: 'destructive',
            });
          } else {
            toast({
              title: '오류',
              description: message,
              variant: 'destructive',
            });
          }
        },
      }
    );
  };

  const handleViewDetail = () => {
    if (resultData) {
      router.push(`/analysis/${resultData.id}`);
    }
  };

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-12">
      <Link
        href="/dashboard"
        className="flex items-center gap-2 text-sm text-slate-600 transition hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" />
        대시보드로 돌아가기
      </Link>

      <header className="space-y-2">
        <h1 className="text-3xl font-semibold">새 분석하기</h1>
        <p className="text-slate-600">
          {currentUser?.subscriptionPlan === 'Pro' ? 'Pro' : 'Free'} 요금제 사용 중
        </p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-6 rounded-lg border border-slate-200 bg-white p-6">
        {/* 이름 필드 */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-700">
            분석 대상 이름 *
          </label>
          <input
            type="text"
            required
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:border-indigo-500 focus:outline-none"
            placeholder="예: 김철수"
          />
        </div>

        {/* 생년월일 필드 */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-700">
            생년월일 (양력/음력) *
          </label>
          <input
            type="date"
            required
            value={formData.birth_date}
            onChange={(e) => setFormData({ ...formData, birth_date: e.target.value })}
            className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:border-indigo-500 focus:outline-none"
          />
          {/* 음력 여부 - 생년월일 바로 아래로 이동 */}
          <div className="flex items-center gap-3 mt-3">
            <input
              type="checkbox"
              id="isLunar"
              checked={formData.is_lunar}
              onChange={(e) => setFormData({ ...formData, is_lunar: e.target.checked })}
              className="h-4 w-4 rounded border-slate-300"
            />
            <label htmlFor="isLunar" className="text-sm font-medium text-slate-700">
              음력입니다
            </label>
          </div>
        </div>

        {/* 태어난 시간 필드 */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-700">
            태어난 시간 (선택)
          </label>
          <input
            type="time"
            value={formData.birth_time}
            onChange={(e) => setFormData({ ...formData, birth_time: e.target.value })}
            disabled={formData.time_unknown}
            className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:border-indigo-500 focus:outline-none disabled:bg-slate-100 disabled:cursor-not-allowed"
          />
          {/* 시간 모름 체크박스 - 태어난 시간 바로 아래로 이동 */}
          <div className="flex items-center gap-3 mt-3">
            <input
              type="checkbox"
              id="timeUnknown"
              checked={formData.time_unknown}
              onChange={(e) => {
                const checked = e.target.checked;
                setFormData({
                  ...formData,
                  time_unknown: checked,
                  birth_time: checked ? '' : formData.birth_time
                });
              }}
              className="h-4 w-4 rounded border-slate-300"
            />
            <label htmlFor="timeUnknown" className="text-sm font-medium text-slate-700">
              태어난 시간을 모릅니다
            </label>
          </div>
        </div>

        {/* 모델 선택 */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-700">
            분석 모델 선택 *
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex items-center gap-3 rounded-lg border border-slate-300 p-4 cursor-pointer hover:border-indigo-500">
              <input
                type="radio"
                name="modelType"
                value="flash"
                checked={formData.model_type === 'flash'}
                onChange={(e) => setFormData({ ...formData, model_type: e.target.value as 'flash' | 'pro' })}
                className="h-4 w-4"
              />
              <span className="text-sm font-medium">Flash (빠른 분석)</span>
            </label>
            <label
              className={`flex items-center gap-3 rounded-lg border p-4 cursor-pointer transition ${
                currentUser?.subscriptionPlan !== 'Pro'
                  ? 'border-slate-200 bg-slate-50 cursor-not-allowed'
                  : 'border-slate-300 hover:border-indigo-500'
              }`}
            >
              <input
                type="radio"
                name="modelType"
                value="pro"
                checked={formData.model_type === 'pro'}
                onChange={(e) => setFormData({ ...formData, model_type: e.target.value as 'flash' | 'pro' })}
                className="h-4 w-4"
                disabled={currentUser?.subscriptionPlan !== 'Pro'}
              />
              <span className={`text-sm font-medium ${currentUser?.subscriptionPlan !== 'Pro' ? 'text-slate-500' : ''}`}>
                Pro (상세 분석)
              </span>
            </label>
          </div>
          {currentUser?.subscriptionPlan !== 'Pro' && (
            <p className="text-xs text-slate-500 flex items-center gap-1 mt-2">
              <AlertCircle className="h-3 w-3" />
              Pro 모델은 Pro 구독자만 사용 가능합니다.
            </p>
          )}
        </div>

        {/* 제출 버튼 */}
        <button
          type="submit"
          disabled={createMutation.isPending}
          className="w-full rounded-lg bg-indigo-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {createMutation.isPending ? '분석 중...' : '분석 시작'}
        </button>
      </form>

      {/* 결과 모달 */}
      <Dialog open={showResultModal} onOpenChange={setShowResultModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>분석 완료</DialogTitle>
            <DialogDescription>
              사주 분석이 완료되었습니다.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg bg-indigo-50 p-4">
              <p className="text-sm text-indigo-900">
                남은 분석 횟수: <span className="font-semibold">{resultData?.remaining_tries || 0}회</span>
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowResultModal(false)}
            >
              닫기
            </Button>
            <Button onClick={handleViewDetail}>
              상세보기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
