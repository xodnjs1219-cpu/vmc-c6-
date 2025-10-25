'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { PaginationInfo } from '@/features/analyses/lib/dto';

interface DashboardPaginationProps {
  pagination: PaginationInfo;
  onPageChange: (page: number) => void;
  isLoading?: boolean;
}

export function DashboardPagination({
  pagination,
  onPageChange,
  isLoading = false,
}: DashboardPaginationProps) {
  return (
    <div className="flex items-center justify-between">
      <p className="text-xs text-slate-600">
        {pagination.total_count > 0
          ? `${(pagination.current_page - 1) * pagination.per_page + 1} - ${Math.min(pagination.current_page * pagination.per_page, pagination.total_count)} 중 총 ${pagination.total_count}개`
          : '총 0개'}
      </p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={!pagination.has_prev || isLoading}
          onClick={() => onPageChange(pagination.current_page - 1)}
          className="flex items-center gap-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ChevronLeft className="h-4 w-4" />
          이전
        </button>
        <span className="px-3 py-1.5 text-sm text-slate-700">
          {pagination.current_page} / {pagination.total_pages}
        </span>
        <button
          type="button"
          disabled={!pagination.has_next || isLoading}
          onClick={() => onPageChange(pagination.current_page + 1)}
          className="flex items-center gap-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          다음
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
