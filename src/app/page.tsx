'use client';

import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { HeroSection } from '@/features/home/components/HeroSection';
import { PricingSection } from '@/features/home/components/PricingSection';
import { FeatureSection } from '@/features/home/components/FeatureSection';
import { CTAButtons } from '@/features/home/components/CTAButtons';

export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <main className="pt-16">
        <HeroSection />
        <div className="flex justify-center py-16 sm:py-20 -mt-8">
          <CTAButtons />
        </div>
        <FeatureSection />
        <PricingSection />
      </main>
      <Footer />
    </div>
  );
}
