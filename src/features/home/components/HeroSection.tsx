'use client';

import { Sparkles } from 'lucide-react';
import { HERO_CONTENT } from '@/features/home/constants/content';

export function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-indigo-950 via-purple-900 to-slate-900 px-6 py-20 text-white md:py-32">
      {/* Background decoration */}
      <div className="absolute inset-0 opacity-20" style={{
        backgroundImage: "url('data:image/svg+xml,%3Csvg%20width=%22100%22%20height=%22100%22%20xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cpath%20d=%22M0%200h100v100H0z%22%20fill=%22none%22%20stroke=%22white%22%20stroke-width=%220.5%22/%3E%3C/svg%3E')"
      }} />

      <div className="relative mx-auto max-w-4xl text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm backdrop-blur-sm">
          <Sparkles className="h-4 w-4 text-yellow-300" />
          <span>AI 기반 전문 사주 분석 서비스</span>
        </div>

        <h1 className="mb-6 text-4xl font-bold tracking-tight md:text-6xl">
          {HERO_CONTENT.title}
        </h1>

        <p className="mb-4 text-xl font-medium text-indigo-200 md:text-2xl">
          {HERO_CONTENT.subtitle}
        </p>

        <p className="mx-auto mb-10 max-w-2xl text-base text-slate-300 md:text-lg">
          {HERO_CONTENT.description}
        </p>
      </div>
    </section>
  );
}
