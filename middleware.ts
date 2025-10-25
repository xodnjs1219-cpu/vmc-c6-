import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

// 보호된 경로 정의
const isProtectedRoute = createRouteMatcher([
  '/dashboard(.*)',
  '/new-analysis(.*)',
  '/analysis(.*)',
  '/subscription(.*)',
]);

// 공개 경로 정의 (Clerk 인증 페이지)
const isPublicRoute = createRouteMatcher([
  '/login(.*)',
  '/signup(.*)',
]);

export default clerkMiddleware(async (auth, req) => {
  const { userId } = await auth();

  // 공개 경로는 인증 없이 접근 허용
  if (isPublicRoute(req)) {
    return NextResponse.next();
  }

  // 보호된 경로 접근 시 인증 확인
  if (isProtectedRoute(req)) {
    if (!userId) {
      const signInUrl = new URL('/login', req.url);
      signInUrl.searchParams.set('redirect_url', req.url);
      return NextResponse.redirect(signInUrl);
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
