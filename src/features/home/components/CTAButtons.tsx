'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@clerk/nextjs';
import { useCurrentUser } from '@/features/auth/hooks/useCurrentUser';
import { CTA_CONTENT } from '@/features/home/constants/content';

export function CTAButtons() {
  const { isAuthenticated, isLoading } = useCurrentUser();
  const { signOut } = useAuth();
  const [mounted, setMounted] = useState(false);

  // 클라이언트에서만 렌더링 (hydration 오류 방지)
  useEffect(() => {
    setMounted(true);
  }, []);

  const handleLogout = () => {
    signOut();
  };

  // 서버 렌더링 및 초기 클라이언트 렌더링 시 게스트 UI 표시 (일관성 유지)
  if (!mounted || isLoading) {
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
