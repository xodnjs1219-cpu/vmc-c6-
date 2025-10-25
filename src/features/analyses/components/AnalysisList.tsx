'use client';

import { AnalysisCard } from './AnalysisCard';
import type { AnalysisItem } from '@/features/analyses/lib/dto';

interface AnalysisListProps {
  analyses: AnalysisItem[];
}

export function AnalysisList({ analyses }: AnalysisListProps) {
  return (
    <div className="space-y-3">
      {analyses.map((analysis) => (
        <AnalysisCard key={analysis.id} analysis={analysis} />
      ))}
    </div>
  );
}
