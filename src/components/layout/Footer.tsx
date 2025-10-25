'use client';

import Link from 'next/link';
import { Sparkles } from 'lucide-react';

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-slate-900 text-slate-300 px-6 py-12">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          <div className="col-span-1 md:col-span-2">
            <Link href="/" className="flex items-center gap-2 mb-4 hover:opacity-80 transition">
              <Sparkles className="w-6 h-6 text-indigo-400" />
              <span className="text-xl font-bold text-white">AI 사주풀이</span>
            </Link>
            <p className="text-sm text-slate-400 leading-relaxed max-w-md">
              전통 명리학과 현대 AI 기술의 만남. Google Gemini AI를 활용한 전문적이고 상세한 사주 분석 서비스입니다.
            </p>
          </div>

          <div>
            <h3 className="text-white font-bold mb-4">서비스</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/new-analysis" className="text-sm hover:text-indigo-400 transition">
                  새 분석하기
                </Link>
              </li>
              <li>
                <Link href="/dashboard" className="text-sm hover:text-indigo-400 transition">
                  대시보드
                </Link>
              </li>
              <li>
                <Link href="/subscription" className="text-sm hover:text-indigo-400 transition">
                  구독 관리
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-white font-bold mb-4">계정</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/login" className="text-sm hover:text-indigo-400 transition">
                  로그인
                </Link>
              </li>
              <li>
                <Link href="/signup" className="text-sm hover:text-indigo-400 transition">
                  회원가입
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-slate-800 pt-8">
          <p className="text-center text-sm text-slate-500">
            © {currentYear} AI 사주풀이. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
