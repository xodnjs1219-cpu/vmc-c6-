'use client';

import * as Icons from 'lucide-react';
import { FEATURES } from '@/features/home/constants/content';

export function FeatureSection() {
  return (
    <section className="bg-gradient-to-b from-slate-50 to-white px-6 py-20 md:py-32">
      <div className="mx-auto max-w-6xl">
        <div className="mb-16 text-center">
          <h2 className="mb-4 text-4xl font-bold text-slate-900 md:text-5xl">
            주요 기능
          </h2>
          <p className="text-lg text-slate-600 md:text-xl">
            AI 사주 풀이 서비스의 핵심 기능을 만나보세요
          </p>
        </div>

        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((feature, index) => {
            const IconComponent = Icons[
              feature.icon as keyof typeof Icons
            ] as React.ComponentType<{ className?: string }>;

            return (
              <div
                key={feature.id}
                className="group relative rounded-2xl border border-slate-200 bg-white p-8 shadow-sm transition-all hover:shadow-xl hover:border-indigo-300 hover:-translate-y-1"
                style={{
                  animationDelay: `${index * 100}ms`
                }}
              >
                <div className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg group-hover:scale-110 transition-transform">
                  {IconComponent && <IconComponent className="h-7 w-7" />}
                </div>
                <h3 className="mb-3 text-xl font-bold text-slate-900">
                  {feature.title}
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
