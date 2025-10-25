'use client';

import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@clerk/nextjs';
import { useCurrentUser } from '@/features/auth/hooks/useCurrentUser';
import { CTA_CONTENT } from '@/features/home/constants/content';

export function CTAButtons() {
  const { isAuthenticated, isLoading } = useCurrentUser();
  const { signOut } = useAuth();

  const handleLogout = () => {
    signOut();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 text-sm text-slate-300">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>로딩 중...</span>
      </div>
    );
  }

  if (isAuthenticated) {
    return (
      <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
        <Link
          href="/new-analysis"
          className="rounded-lg bg-indigo-600 px-8 py-3 text-center text-base font-semibold text-white transition hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-300"
        >
          {CTA_CONTENT.authenticated.newAnalysis}
        </Link>
        <Link
          href="/dashboard"
          className="rounded-lg border-2 border-white bg-white/10 px-8 py-3 text-center text-base font-semibold text-white backdrop-blur-sm transition hover:bg-white/20 focus:outline-none focus:ring-4 focus:ring-white/50"
        >
          {CTA_CONTENT.authenticated.dashboard}
        </Link>
        <Link
          href="/subscription"
          className="rounded-lg border-2 border-white bg-white/10 px-8 py-3 text-center text-base font-semibold text-white backdrop-blur-sm transition hover:bg-white/20 focus:outline-none focus:ring-4 focus:ring-white/50"
        >
          {CTA_CONTENT.authenticated.subscription}
        </Link>
        <button
          onClick={handleLogout}
          className="rounded-lg border-2 border-red-500 bg-red-500/10 px-8 py-3 text-center text-base font-semibold text-red-400 backdrop-blur-sm transition hover:bg-red-500/20 focus:outline-none focus:ring-4 focus:ring-red-500/50"
        >
          {CTA_CONTENT.authenticated.logout}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
      <Link
        href="/signup"
        className="rounded-lg bg-indigo-600 px-8 py-3 text-center text-base font-semibold text-white transition hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-300"
      >
        {CTA_CONTENT.guest.signup}
      </Link>
      <Link
        href="/login"
        className="rounded-lg border-2 border-white bg-white/10 px-8 py-3 text-center text-base font-semibold text-white backdrop-blur-sm transition hover:bg-white/20 focus:outline-none focus:ring-4 focus:ring-white/50"
      >
        {CTA_CONTENT.guest.login}
      </Link>
    </div>
  );
}
