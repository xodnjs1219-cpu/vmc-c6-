'use client';

import * as Icons from 'lucide-react';
import { FEATURES } from '@/features/home/constants/content';

export function FeatureSection() {
  return (
    <section className="bg-white px-6 py-16 md:py-24">
      <div className="mx-auto max-w-6xl">
        <div className="mb-12 text-center">
          <h2 className="mb-4 text-3xl font-bold text-slate-900 md:text-4xl">
            주요 기능
          </h2>
          <p className="text-lg text-slate-600">
            AI 사주 풀이 서비스의 핵심 기능을 만나보세요
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((feature) => {
            const IconComponent = Icons[
              feature.icon as keyof typeof Icons
            ] as React.ComponentType<{ className?: string }>;

            return (
              <div
                key={feature.id}
                className="rounded-xl border border-slate-200 bg-slate-50 p-6 transition hover:border-indigo-300 hover:bg-indigo-50"
              >
                <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600">
                  {IconComponent && <IconComponent className="h-6 w-6" />}
                </div>
                <h3 className="mb-2 text-lg font-semibold text-slate-900">
                  {feature.title}
                </h3>
                <p className="text-sm text-slate-600">
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
