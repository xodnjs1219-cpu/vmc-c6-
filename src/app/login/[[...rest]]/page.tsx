'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { SignIn } from '@clerk/nextjs';

type LoginPageProps = {
  params: Promise<{ rest?: string[] }>;
};

export default function LoginPage({ params }: LoginPageProps) {
  void params;
  const { user, isLoaded } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (isLoaded && user) {
      router.replace('/dashboard');
    }
  }, [isLoaded, user, router]);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-4xl flex-col items-center justify-center gap-10 px-6 py-16">
      <header className="flex flex-col items-center gap-3 text-center">
        <h1 className="text-3xl font-semibold">로그인</h1>
        <p className="text-slate-500">
          Clerk 계정으로 로그인하고 서비스에 접근하세요.
        </p>
      </header>
      <div className="w-full rounded-xl border border-slate-200 p-6 shadow-sm">
        <SignIn />
      </div>
    </div>
  );
}
