import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // The sheet import sends every parsed row to a Server Action; a full test case sheet with steps can pass 1 MB.
  experimental: {
    serverActions: { bodySizeLimit: '8mb' },
  },
  serverExternalPackages: ['exceljs'],
  turbopack: {
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
};

export default nextConfig;
