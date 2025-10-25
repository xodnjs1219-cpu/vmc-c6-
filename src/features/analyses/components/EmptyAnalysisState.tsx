'use client';

import Link from 'next/link';
import { FileText } from 'lucide-react';

export function EmptyAnalysisState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 py-12 text-center">
      <FileText className="mb-4 h-12 w-12 text-slate-400" />
      <h3 className="text-lg font-semibold text-slate-900">
        아직 분석이 없습니다
      </h3>
      <p className="mt-2 text-sm text-slate-600">
        새로운 사주 분석을 시작하세요
      </p>
      <Link
        href="/new-analysis"
        className="mt-6 rounded-lg bg-indigo-600 px-6 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
      >
        새 분석하기
      </Link>
    </div>
  );
}
