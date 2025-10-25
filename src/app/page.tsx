'use client';

import { HeroSection } from '@/features/home/components/HeroSection';
import { PricingSection } from '@/features/home/components/PricingSection';
import { FeatureSection } from '@/features/home/components/FeatureSection';
import { CTAButtons } from '@/features/home/components/CTAButtons';

export default function Home() {
  return (
    <main className="min-h-screen bg-white">
      <HeroSection />
      <div className="flex justify-center py-12 sm:py-16">
        <CTAButtons />
      </div>
      <FeatureSection />
      <PricingSection />
    </main>
  );
}
