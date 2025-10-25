'use client';

import { Loader2 } from 'lucide-react';

export function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center gap-2">
      <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
      <span className="text-sm text-slate-600">로딩 중...</span>
    </div>
  );
}
