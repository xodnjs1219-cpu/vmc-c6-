import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        hostname: '**',
      },
    ],
  },
  // OneDrive 동기화로 인한 무한 리빌딩 방지
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.watchOptions = {
        ...config.watchOptions,
        poll: 1000, // 1초마다 폴링 (파일 변경 감지를 덜 민감하게)
        aggregateTimeout: 300, // 변경 감지 후 300ms 대기
        ignored: ['**/node_modules', '**/.git', '**/.next', '**/out'],
      };
    }
    return config;
  },
};

export default nextConfig;
