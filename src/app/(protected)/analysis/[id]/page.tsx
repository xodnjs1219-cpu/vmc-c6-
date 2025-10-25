'use client';

import { use } from 'react';
import Link from 'next/link';
import { ArrowLeft, Download, AlertCircle, Loader2 } from 'lucide-react';
import { useAnalysisDetailQuery } from '@/features/analyses/hooks/useAnalysisDetailQuery';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import ReactMarkdown from 'react-markdown';

type AnalysisDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default function AnalysisDetailPage({ params }: AnalysisDetailPageProps) {
  const resolvedParams = use(params);
  const { data: analysis, isLoading, error } = useAnalysisDetailQuery(resolvedParams.id);

  const handleDownload = () => {
    if (!analysis) return;

    // 마크다운을 텍스트로 다운로드 (PDF는 추후 구현)
    const content = analysis.content;
    const element = document.createElement('a');
    element.setAttribute('href', `data:text/markdown;charset=utf-8,${encodeURIComponent(content)}`);
    element.setAttribute('download', `${analysis.name}_분석.md`);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (error || !analysis) {
    return (
      <div className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-12">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 text-sm text-slate-600 transition hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          대시보드로 돌아가기
        </Link>

        <div className="rounded-lg border border-red-200 bg-red-50 p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600" />
            <div>
              <h3 className="font-semibold text-red-900">분석을 불러올 수 없습니다</h3>
              <p className="mt-1 text-sm text-red-800">
                {error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-12">
      <Link
        href="/dashboard"
        className="flex items-center gap-2 text-sm text-slate-600 transition hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" />
        대시보드로 돌아가기
      </Link>

      <header className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold">{analysis.name}님의 사주 분석</h1>
          <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
            <span>
              {new Date(analysis.created_at).toLocaleDateString('ko-KR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </span>
            <span className="text-slate-300">•</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-3 py-1 text-xs font-medium text-indigo-700">
              {analysis.model_type === 'pro' ? 'Pro' : 'Flash'} 모델
            </span>
            <span className="text-slate-300">•</span>
            <span>{analysis.is_lunar ? '음력' : '양력'} {analysis.birth_date}</span>
          </div>
        </div>
        <button
          type="button"
          onClick={handleDownload}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
        >
          <Download className="h-4 w-4" />
          다운로드
        </button>
      </header>

      <div className="prose prose-sm prose-slate max-w-none rounded-lg border border-slate-200 bg-white p-8">
        <ReactMarkdown
          components={{
            h1: ({ children }) => <h1 className="text-2xl font-bold text-slate-900">{children}</h1>,
            h2: ({ children }) => <h2 className="text-xl font-bold text-slate-800 mt-6 mb-2">{children}</h2>,
            h3: ({ children }) => <h3 className="text-lg font-semibold text-slate-700 mt-4 mb-2">{children}</h3>,
            p: ({ children }) => <p className="text-slate-700 leading-relaxed mb-4">{children}</p>,
            ul: ({ children }) => <ul className="list-disc list-inside space-y-2 text-slate-700 mb-4">{children}</ul>,
            li: ({ children }) => <li className="text-slate-700">{children}</li>,
            blockquote: ({ children }) => (
              <blockquote className="border-l-4 border-indigo-300 bg-indigo-50 pl-4 py-2 text-slate-700 italic">
                {children}
              </blockquote>
            ),
            code: ({ children, className }) => {
              const isInline = !className?.includes('language-');
              return isInline ? (
                <code className="bg-slate-100 px-2 py-1 rounded text-sm text-slate-800">{children}</code>
              ) : (
                <code className="block bg-slate-900 text-slate-100 p-4 rounded overflow-x-auto">{children}</code>
              );
            },
          }}
        >
          {analysis.content}
        </ReactMarkdown>
      </div>
    </div>
  );
}
