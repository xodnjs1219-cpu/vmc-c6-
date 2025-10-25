'use client';

import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import { ChevronRight, Sparkles } from 'lucide-react';
import type { AnalysisItem } from '@/features/analyses/lib/dto';

interface AnalysisCardProps {
  analysis: AnalysisItem;
}

export function AnalysisCard({ analysis }: AnalysisCardProps) {
  const createdAt = new Date(analysis.created_at);
  const formattedDate = formatDistanceToNow(createdAt, {
    addSuffix: true,
    locale: ko,
  });

  const modelLabel = analysis.model_type === 'pro' ? 'Pro' : 'Flash';

  return (
    <Link
      href={`/analysis/${analysis.id}`}
      className="group flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4 transition hover:border-indigo-300 hover:bg-indigo-50"
    >
      <div className="flex flex-1 items-start gap-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600">
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-slate-900">{analysis.name}</h3>
          <div className="mt-1 flex gap-2 text-xs text-slate-500">
            <span>{analysis.birth_date}</span>
            {analysis.birth_time && <span>{analysis.birth_time}</span>}
            {analysis.is_lunar && <span className="rounded bg-slate-100 px-2 py-0.5">음력</span>}
            <span className="rounded bg-indigo-100 px-2 py-0.5 text-indigo-700">
              {modelLabel}
            </span>
            <span>{formattedDate}</span>
          </div>
        </div>
      </div>
      <ChevronRight className="h-5 w-5 text-slate-300 transition group-hover:text-indigo-600" />
    </Link>
  );
}
