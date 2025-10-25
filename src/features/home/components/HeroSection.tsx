'use client';

import { Sparkles } from 'lucide-react';
import { HERO_CONTENT } from '@/features/home/constants/content';

export function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 px-6 py-32 text-white md:py-48">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-black/10" />
      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage: "url('data:image/svg+xml,%3Csvg width=\"60\" height=\"60\" xmlns=\"http://www.w3.org/2000/svg\"%3E%3Cpath d=\"M0 0h60v60H0z\" fill=\"none\" stroke=\"white\" stroke-width=\"0.5\" opacity=\"0.3\"/%3E%3C/svg%3E')"
        }}
      />

      <div className="relative mx-auto max-w-5xl text-center">
        <div className="mb-8 inline-flex items-center gap-2 rounded-full bg-white/20 px-5 py-2.5 text-sm font-medium backdrop-blur-sm border border-white/30">
          <Sparkles className="h-5 w-5 text-yellow-300" />
          <span>AI 기반 전문 사주 분석 서비스</span>
        </div>

        <h1 className="mb-6 text-4xl sm:text-5xl font-extrabold tracking-tight md:text-7xl leading-tight break-keep">
          {HERO_CONTENT.title}
        </h1>

        <p className="mb-8 text-xl font-medium text-white/90 md:text-2xl">
          {HERO_CONTENT.subtitle}
        </p>

        <p className="mx-auto max-w-2xl text-lg text-white/80 md:text-xl leading-relaxed">
          {HERO_CONTENT.description}
        </p>
      </div>
    </section>
  );
}
