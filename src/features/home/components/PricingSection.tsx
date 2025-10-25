'use client';

import { Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PRICING_PLANS } from '@/features/home/constants/content';

export function PricingSection() {
  return (
    <section className="bg-slate-50 px-6 py-16 md:py-24">
      <div className="mx-auto max-w-6xl">
        <div className="mb-12 text-center">
          <h2 className="mb-4 text-3xl font-bold text-slate-900 md:text-4xl">
            요금제
          </h2>
          <p className="text-lg text-slate-600">필요에 맞는 플랜을 선택하세요</p>
        </div>

        <div className="grid gap-8 md:grid-cols-2">
          {PRICING_PLANS.map((plan) => (
            <div
              key={plan.id}
              className={cn(
                'relative rounded-2xl border-2 bg-white p-8 shadow-lg transition hover:shadow-xl',
                plan.highlight
                  ? 'border-indigo-500 ring-4 ring-indigo-100'
                  : 'border-slate-200'
              )}
            >
              {plan.highlight && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-indigo-500 px-4 py-1 text-sm font-semibold text-white">
                  추천
                </div>
              )}

              <div className="mb-6">
                <h3 className="mb-2 text-2xl font-bold text-slate-900">
                  {plan.name}
                </h3>
                <div className="mb-2 flex items-baseline gap-2">
                  <span className="text-4xl font-bold text-slate-900">
                    {plan.price === 0 ? '무료' : `₩${plan.price.toLocaleString()}`}
                  </span>
                  {plan.price > 0 && (
                    <span className="text-slate-600">/ {plan.period}</span>
                  )}
                </div>
                <p className="text-sm text-slate-600">{plan.description}</p>
              </div>

              <div className="mb-6 space-y-3">
                {plan.features.map((feature, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <Check className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-500" />
                    <span className="text-sm text-slate-700">{feature}</span>
                  </div>
                ))}
                {plan.limitations.map((limitation, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <X className="mt-0.5 h-5 w-5 flex-shrink-0 text-slate-400" />
                    <span className="text-sm text-slate-500">{limitation}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
