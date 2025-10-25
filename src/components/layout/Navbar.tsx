'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Sparkles, Menu, X, LogOut } from 'lucide-react';
import { useAuth } from '@clerk/nextjs';
import { useCurrentUser } from '@/features/auth/hooks/useCurrentUser';

export function Navbar() {
  const { isAuthenticated } = useCurrentUser();
  const { signOut } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleLogout = () => {
    signOut();
    setIsMenuOpen(false);
  };

  if (!mounted) {
    return (
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/" className="flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-indigo-600" />
              <span className="text-xl font-bold text-slate-900">AI 사주풀이</span>
            </Link>
          </div>
        </div>
      </nav>
    );
  }

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* 로고 */}
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition">
            <Sparkles className="w-6 h-6 text-indigo-600" />
            <span className="text-xl font-bold text-slate-900">AI 사주풀이</span>
          </Link>

          {/* 데스크톱 메뉴 */}
          <div className="hidden md:flex items-center gap-2">
            {isAuthenticated ? (
              <>
                <Link
                  href="/new-analysis"
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition"
                >
                  새 분석하기
                </Link>
                <Link
                  href="/dashboard"
                  className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-indigo-600 hover:bg-slate-50 rounded-lg transition"
                >
                  대시보드
                </Link>
                <Link
                  href="/subscription"
                  className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-indigo-600 hover:bg-slate-50 rounded-lg transition"
                >
                  구독 관리
                </Link>
                <button
                  onClick={handleLogout}
                  className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-red-600 hover:bg-red-50 rounded-lg transition flex items-center gap-1"
                >
                  <LogOut className="w-4 h-4" />
                  로그아웃
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-indigo-600 hover:bg-slate-50 rounded-lg transition"
                >
                  로그인
                </Link>
                <Link
                  href="/signup"
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition"
                >
                  회원가입
                </Link>
              </>
            )}
          </div>

          {/* 모바일 메뉴 버튼 */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="md:hidden p-2 rounded-lg hover:bg-slate-100 transition"
          >
            {isMenuOpen ? (
              <X className="w-6 h-6 text-slate-700" />
            ) : (
              <Menu className="w-6 h-6 text-slate-700" />
            )}
          </button>
        </div>

        {/* 모바일 메뉴 */}
        {isMenuOpen && (
          <div className="md:hidden py-4 border-t border-slate-200">
            <div className="flex flex-col gap-2">
              {isAuthenticated ? (
                <>
                  <Link
                    href="/new-analysis"
                    onClick={() => setIsMenuOpen(false)}
                    className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition"
                  >
                    새 분석하기
                  </Link>
                  <Link
                    href="/dashboard"
                    onClick={() => setIsMenuOpen(false)}
                    className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-indigo-600 hover:bg-slate-50 rounded-lg transition"
                  >
                    대시보드
                  </Link>
                  <Link
                    href="/subscription"
                    onClick={() => setIsMenuOpen(false)}
                    className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-indigo-600 hover:bg-slate-50 rounded-lg transition"
                  >
                    구독 관리
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-red-600 hover:bg-red-50 rounded-lg transition flex items-center gap-1"
                  >
                    <LogOut className="w-4 h-4" />
                    로그아웃
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href="/login"
                    onClick={() => setIsMenuOpen(false)}
                    className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-indigo-600 hover:bg-slate-50 rounded-lg transition"
                  >
                    로그인
                  </Link>
                  <Link
                    href="/signup"
                    onClick={() => setIsMenuOpen(false)}
                    className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition"
                  >
                    회원가입
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
