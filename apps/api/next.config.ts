import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // The shared core ships as TypeScript source.
  transpilePackages: ['@ugent/core'],
};

export default nextConfig;
