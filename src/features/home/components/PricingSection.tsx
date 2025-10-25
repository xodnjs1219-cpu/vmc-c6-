'use client';

import { Check, X, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PRICING_PLANS } from '@/features/home/constants/content';

export function PricingSection() {
  return (
    <section className="bg-white px-6 py-20 md:py-32">
      <div className="mx-auto max-w-6xl">
        <div className="mb-16 text-center">
          <h2 className="mb-4 text-4xl font-bold text-slate-900 md:text-5xl">
            요금제
          </h2>
          <p className="text-lg text-slate-600 md:text-xl">
            필요에 맞는 플랜을 선택하세요
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-2 max-w-4xl mx-auto">
          {PRICING_PLANS.map((plan) => (
            <div
              key={plan.id}
              className={cn(
                'relative rounded-3xl border-2 bg-white p-8 transition-all hover:shadow-2xl',
                plan.highlight
                  ? 'border-indigo-500 shadow-xl scale-105'
                  : 'border-slate-200 shadow-lg'
              )}
            >
              {plan.highlight && (
                <div className="absolute -top-5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 px-5 py-2 text-sm font-bold text-white shadow-lg">
                  <Sparkles className="h-4 w-4" />
                  추천
                </div>
              )}

              <div className="mb-8">
                <h3 className="mb-3 text-2xl font-bold text-slate-900">
                  {plan.name}
                </h3>
                <div className="mb-3 flex items-baseline gap-2">
                  <span className={cn(
                    "text-5xl font-extrabold",
                    plan.highlight ? "bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent" : "text-slate-900"
                  )}>
                    {plan.price === 0 ? '무료' : `₩${plan.price.toLocaleString()}`}
                  </span>
                  {plan.price > 0 && (
                    <span className="text-slate-600 font-medium">/ {plan.period}</span>
                  )}
                </div>
                <p className="text-slate-600">{plan.description}</p>
              </div>

              <div className="space-y-4">
                {plan.features.map((feature, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-0.5">
                      <Check className="h-5 w-5 text-green-500" />
                    </div>
                    <span className="text-slate-700 leading-relaxed">{feature}</span>
                  </div>
                ))}
                {plan.limitations.map((limitation, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-0.5">
                      <X className="h-5 w-5 text-slate-400" />
                    </div>
                    <span className="text-slate-500 leading-relaxed">{limitation}</span>
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
