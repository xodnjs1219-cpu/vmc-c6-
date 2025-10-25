'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { SignUp } from '@clerk/nextjs';

type SignupPageProps = {
  params: Promise<{ rest?: string[] }>;
};

export default function SignupPage({ params }: SignupPageProps) {
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
        <h1 className="text-3xl font-semibold">회원가입</h1>
        <p className="text-slate-500">
          새 계정을 생성하여 AI 사주 풀이 서비스를 시작하세요.
        </p>
      </header>
      <div className="w-full rounded-xl border border-slate-200 p-6 shadow-sm">
        <SignUp />
      </div>
    </div>
  );
}
