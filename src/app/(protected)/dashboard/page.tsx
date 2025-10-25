'use client';

import Link from 'next/link';
import { Plus, Home } from 'lucide-react';
import { useDashboard } from '@/features/analyses/hooks/useDashboard';
import { useAnalysesQuery } from '@/features/analyses/hooks/useAnalysesQuery';
import { AnalysisList } from '@/features/analyses/components/AnalysisList';
import { DashboardPagination } from '@/features/analyses/components/DashboardPagination';
import { EmptyAnalysisState } from '@/features/analyses/components/EmptyAnalysisState';
import { ErrorAnalysisState } from '@/features/analyses/components/ErrorAnalysisState';
import { LoadingSpinner } from '@/components/LoadingSpinner';

type DashboardPageProps = {
  params: Promise<Record<string, never>>;
};

export default function DashboardPage({ params }: DashboardPageProps) {
  void params;
  const { currentPage, setPage } = useDashboard();

  const { data, isLoading, isError, error, refetch } = useAnalysesQuery({
    page: currentPage,
    limit: 10,
  });

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-12">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
          >
            <Home className="h-4 w-4" />
            홈으로
          </Link>
          <div className="space-y-1">
            <h1 className="text-3xl font-semibold">분석 내역</h1>
            <p className="text-slate-600">저장된 사주 분석 결과를 확인하세요</p>
          </div>
        </div>
        <Link
          href="/new-analysis"
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
        >
          <Plus className="h-4 w-4" />
          새 분석
        </Link>
      </header>

      {isLoading && (
        <div className="flex justify-center py-12">
          <LoadingSpinner />
        </div>
      )}

      {isError && (
        <ErrorAnalysisState
          error={
            error instanceof Error
              ? error.message
              : '분석 내역을 불러오는데 실패했습니다.'
          }
          onRetry={() => refetch()}
        />
      )}

      {!isLoading && !isError && data && (
        <>
          {data.items.length === 0 ? (
            <EmptyAnalysisState />
          ) : (
            <>
              <AnalysisList analyses={data.items} />
              <DashboardPagination
                pagination={data.pagination}
                onPageChange={handlePageChange}
                isLoading={isLoading}
              />
            </>
          )}
        </>
      )}
    </div>
  );
}
