'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { useCurrentUser } from '@/features/auth/hooks/useCurrentUser';
import { CTA_CONTENT } from '@/features/home/constants/content';

export function CTAButtons() {
  const { isAuthenticated } = useCurrentUser();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
        <Link
          href="/signup"
          data-testid="signup-button"
          className="group inline-flex items-center justify-center gap-2 rounded-xl bg-white px-8 py-4 text-base font-bold text-indigo-600 shadow-xl transition-all hover:shadow-2xl hover:scale-105"
        >
          {CTA_CONTENT.guest.signup}
          <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
        </Link>
        <Link
          href="/login"
          data-testid="login-button"
          className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-white/30 bg-white/10 px-8 py-4 text-base font-bold text-white backdrop-blur-sm transition-all hover:bg-white/20"
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
          className="group inline-flex items-center justify-center gap-2 rounded-xl bg-white px-8 py-4 text-base font-bold text-indigo-600 shadow-xl transition-all hover:shadow-2xl hover:scale-105"
        >
          {CTA_CONTENT.authenticated.newAnalysis}
          <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
      <Link
        href="/signup"
        data-testid="signup-button"
        className="group inline-flex items-center justify-center gap-2 rounded-xl bg-white px-8 py-4 text-base font-bold text-indigo-600 shadow-xl transition-all hover:shadow-2xl hover:scale-105"
      >
        {CTA_CONTENT.guest.signup}
        <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
      </Link>
      <Link
        href="/login"
        data-testid="login-button"
        className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-white/30 bg-white/10 px-8 py-4 text-base font-bold text-white backdrop-blur-sm transition-all hover:bg-white/20"
      >
        {CTA_CONTENT.guest.login}
      </Link>
    </div>
  );
}
