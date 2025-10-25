'use client';

import { AlertCircle } from 'lucide-react';

interface ErrorAnalysisStateProps {
  error: string;
  onRetry?: () => void;
}

export function ErrorAnalysisState({
  error,
  onRetry,
}: ErrorAnalysisStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-rose-200 bg-rose-50 py-12 text-center">
      <AlertCircle className="mb-4 h-12 w-12 text-rose-500" />
      <h3 className="text-lg font-semibold text-slate-900">
        오류가 발생했습니다
      </h3>
      <p className="mt-2 text-sm text-slate-600">{error}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-6 rounded-lg bg-rose-600 px-6 py-2 text-sm font-semibold text-white transition hover:bg-rose-700"
        >
          다시 시도
        </button>
      )}
    </div>
  );
}
